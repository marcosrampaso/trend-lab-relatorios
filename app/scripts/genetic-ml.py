"""Bounded genetic refinement after the registered extended grid. Validation fitness only."""
import argparse,concurrent.futures as futures,hashlib,importlib.util,json,math,multiprocessing as mp
import os,random,signal,subprocess,time
from datetime import datetime,timezone
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
spec=importlib.util.spec_from_file_location('extended_trainer',ROOT/'scripts/train-local-ml-extended.py');ext=importlib.util.module_from_spec(spec);spec.loader.exec_module(ext)
read,atomic,sha,now=ext.read,ext.atomic,ext.sha,ext.now
STOP=False
def stop(signum,frame):
 global STOP;STOP=True
def canonical(v):return json.dumps(v,sort_keys=True,separators=(',',':'))
def identify(g):
 g=json.loads(canonical(g));g.pop('id',None);g['id']=hashlib.sha256(canonical(g).encode()).hexdigest()[:20];return g
def model_key(g):return hashlib.sha256(canonical({k:v for k,v in g.items() if k not in ['id','threshold']}).encode()).hexdigest()[:20]
def fit_job(task,run):return ext.fit(task,run)
def choose_root(report,p):
 configs={c['id']:c for c in report['protocol']['configs']};groups={}
 for t in report['trials']:
  if t['fold'] not in p['validationFolds'] or not t['eligible'] or t['algorithm']=='constant':continue
  key=canonical([t['family'],t['hold'],t['trainMonths'],t['configId'],t['threshold']]);groups.setdefault(key,[]).append(t)
 candidates=[]
 for rows in groups.values():
  if {r['fold'] for r in rows}!=set(p['validationFolds']) or len(rows)!=len(p['validationFolds']):continue
  t=rows[0];fitness=min(sum(r['basePnL'] for r in rows),sum(r['stressPnL'] for r in rows))/9
  g=identify({'family':t['family'],'hold':t['hold'],'trainMonths':t['trainMonths'],'algorithm':t['algorithm'],'params':configs[t['configId']]['params'],'threshold':t['threshold']})
  candidates.append({'genome':g,'fitnessUSDT':fitness,'eligible':True,'baseConfigId':t['configId'],'source':'base_validation_only'})
 if not candidates:raise ValueError('Nenhum candidato inicial elegível nos3 blocos')
 return sorted(candidates,key=lambda r:(-r['fitnessUSDT'],r['genome']['threshold'],r['genome']['hold'],r['genome']['trainMonths'],r['baseConfigId']))[0]
def mutate(parent,rng,p):
 g=json.loads(canonical(parent));g.pop('id',None);a=g['algorithm'];q=g['params'];b=p['mutations']
 def logmove(x,lo,hi):return min(hi,max(lo,float(x)*math.exp(rng.gauss(0,.5))))
 choices=['threshold','hold','trainMonths','params']
 for gene in rng.sample(choices,rng.randint(1,3)):
  if gene=='threshold':g['threshold']=round(min(.8,max(.2,(g['threshold'] or .35)+rng.gauss(0,.07))),3)
  elif gene=='hold':g['hold']=rng.choice(b['holdingMinutes'])
  elif gene=='trainMonths':g['trainMonths']=rng.choice(b['trainWindows'])
  elif a=='logistic':q['C']=logmove(q['C'],*b['logisticC'])
  elif a in ['tree','random_forest','extra_trees']:
   q['max_depth']=max(2,min(16,(q.get('max_depth') or 8)+rng.choice([-2,-1,1,2])))
   q['min_samples_leaf']=max(50,min(300,round(q['min_samples_leaf']*math.exp(rng.gauss(0,.25)))))
   if a!='tree':q['n_estimators']=max(400,min(2000,q['n_estimators']+rng.choice([-200,200])))
  elif a=='hist_boosting':
   q['max_iter']=max(100,min(1000,q['max_iter']+rng.choice([-100,100])));q['max_leaf_nodes']=rng.choice(b['boostLeaves']);q['l2_regularization']=logmove(q['l2_regularization'],*b['boostL2']);q['min_samples_leaf']=max(50,min(300,round(q['min_samples_leaf']*math.exp(rng.gauss(0,.25)))))
  elif a=='mlp':
   q['hidden_layer_sizes']=rng.choice(b['mlpLayers']);q['alpha']=logmove(q['alpha'],*b['mlpAlpha']);q['max_iter']=max(600,min(5000,q['max_iter']+rng.choice([-500,500])));q['learning_rate_init']=logmove(q.get('learning_rate_init',.001),*b['mlpLearningRate'])
 return identify(g)
def main():
 ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--run-id',required=True);ap.add_argument('--resume',action='store_true');args=ap.parse_args()
 if not args.run_id or not all(c.isalnum() or c in '-_' for c in args.run_id):ap.error('run-id inválido')
 p=read(ROOT/'genetic-ml-protocol.json');base=ROOT/'work/local-ml/runs'/p['baseRun'];base_status=read(base/'status.json');base_registration=read(base/'registration.json');deadline=datetime.fromisoformat(base_status['deadlineAt']).timestamp();run=ROOT/'work/local-ml/runs'/args.run_id;run.mkdir(parents=True,exist_ok=True)
 files=['genetic-ml-protocol.json','scripts/genetic-ml.py','scripts/score-genetic-ml.mjs','scripts/train-local-ml-extended.py','scripts/train-local-ml.py','scripts/extended-ml-utils.mjs','scripts/local-ml-evaluation.mjs']
 fingerprint={f:sha(ROOT/f) for f in files};fingerprint['baseRegistration']=sha(base/'registration.json')
 record=run/'registration.json'
 if record.exists():
  if not args.resume or read(record)['fingerprint']!=fingerprint:raise ValueError('Checkpoint genético incompatível')
 else:atomic(record,{'protocol':p,'fingerprint':fingerprint,'createdAt':now(),'baseDeadlineAt':base_status['deadlineAt']})
 status={'runId':args.run_id,'baseRun':p['baseRun'],'pid':os.getpid(),'state':'waiting_base','startedAt':now(),'deadlineAt':base_status['deadlineAt'],'generation':0,'maxGenerations':p['maxGenerations'],'childrenPerGeneration':10,'modelJobsCompleted':0,'workers':min(10,os.cpu_count() or 1),'realOrders':False}
 def publish(**extra):status.update(extra);status['updatedAt']=now();atomic(run/'evolution-status.json',status);atomic(ROOT/'web/data/cpu-evolution-status.json',status)
 def exhausted():
  d=os.statvfs(ROOT);return d.f_bavail*d.f_frsize<p['minimumFreeDiskGB']*1024**3
 def available():return not STOP and time.time()<deadline-120 and not exhausted()
 def score(genomes,generation,final=False):
  request={'genomes':genomes,'generation':generation,'baseRun':str(base),'final':final,'folds':p['validationFolds'],'finalTestFold':p['finalTestFold']};request_file=run/(f'generation-{generation}.json' if not final else 'final-request.json');atomic(request_file,request)
  output=run/(f'scores-{generation}.json' if not final else 'final-result.json')
  if output.exists():return read(output)
  with open(run/'fitness.log','a') as log:
   child=subprocess.Popen(['node',str(ROOT/'scripts/score-genetic-ml.mjs'),str(run),str(request_file)],cwd=ROOT,stdout=log,stderr=subprocess.STDOUT)
   while child.poll() is None and not STOP and time.time()<deadline and not exhausted():time.sleep(.5)
   if child.poll() is None:
    child.terminate()
    try:child.wait(timeout=5)
    except subprocess.TimeoutExpired:child.kill();child.wait()
    return None
   if child.returncode:raise RuntimeError('Falha no cálculo de fitness; consulte fitness.log')
  return read(output)
 signal.signal(signal.SIGTERM,stop);signal.signal(signal.SIGINT,stop);publish()
 try:
  while available():
   state=read(base/'status.json')
   if state['state']=='completed':break
   if state['state'] in ['failed','stopped','time_limit']:publish(state='base_incomplete',reason='Rodada base interrompida; genética não iniciada');return
   publish(baseCompleted=state.get('completed',0),baseTotal=state.get('total',0));time.sleep(5)
  if not available():publish(state='stopped' if STOP else 'time_limit',reason='Sem tempo disponível após a grade base');return
  if sha(ROOT/'local-ml-extended-protocol.json')!=p['baseProtocolSHA256']:raise ValueError('Protocolo base mudou')
  report=read(base/'evaluation.json');root=choose_root(report,p);atomic(run/'initial-parent.json',root)
  (run/'labels').mkdir(exist_ok=True)
  for hold in [30,60,120,240]:
   target=run/'labels'/f'hold-{hold}.json'
   if not target.exists():target.symlink_to(base/'labels'/f'hold-{hold}.json')
  state_file=run/'evolution.json'
  if state_file.exists():state=read(state_file)
  else:state={'parent':root,'generation':0,'stagnation':0,'seen':[root['genome']['id']],'history':[],'allCandidates':[root]};atomic(state_file,state)
  base_tasks=read(base/'tasks.json')['tasks'];bp=base_registration['protocol'];seeds=bp['seeds'] if root['genome']['algorithm'] in bp['repeatAlgorithms'] else [bp['seed']]
  # Root predictions are reused read-only; mutation models use a key excluding threshold.
  root_paths=[str(base/'predictions'/(t['id']+'.json')) for t in base_tasks if t['family']==root['genome']['family'] and t['hold']==root['genome']['hold'] and t['trainMonths']==root['genome']['trainMonths'] and t['config']['id']==root['baseConfigId'] and t['fold'] in p['validationFolds']]
  model_cache=read(run/'model-cache.json') if (run/'model-cache.json').exists() else {model_key(root['genome']):root_paths}
  executor=futures.ProcessPoolExecutor(max_workers=status['workers'],mp_context=mp.get_context('spawn'));jobs_done=0
  try:
   while state['generation']<p['maxGenerations'] and state['stagnation']<p['stagnationGenerations'] and available():
    generation=state['generation']+1;file=run/f'children-{generation}.json'
    if file.exists():children=read(file)
    else:
     rng=random.Random(p['seed']+generation);seen=set(state['seen']);children=[]
     for attempt in range(1000):
      g=mutate(state['parent']['genome'],rng,p)
      if g['id'] not in seen:children.append(g);seen.add(g['id'])
      if len(children)==10:break
     if len(children)!=10:raise ValueError('Espaço de mutações esgotado')
     atomic(file,children)
    publish(state='training',generation=generation,bestValidationMonthlyBRL=state['parent']['fitnessUSDT']*5,bestGenome=state['parent']['genome'],stagnation=state['stagnation'])
    todo=[]
    for g in children:
     key=model_key(g)
     if key in model_cache:continue
     paths=[]
     for fold in p['validationFolds']:
      for seed in seeds:
       task={'id':key+'-'+fold+'-s'+str(seed),'family':g['family'],'fold':fold,'hold':g['hold'],'trainMonths':g['trainMonths'],'config':{'id':key,'algorithm':g['algorithm'],'params':g['params']},'seed':seed};target=run/'predictions'/(task['id']+'.json');paths.append(str(target))
       if target.exists():
        old=read(target)
        if not old.get('skipped') and sha(ROOT/old['artifact'])!=old['artifactSHA256']:raise ValueError('Modelo genético corrompido')
       else:todo.append(task)
     model_cache[key]=paths
    active={};iterator=iter(todo)
    def queue():
     while len(active)<status['workers'] and available():
      task=next(iterator,None)
      if task is None:break
      active[executor.submit(fit_job,task,str(run))]=task
    queue()
    while active and available():
     done,_=futures.wait(active,timeout=1,return_when=futures.FIRST_COMPLETED)
     for f in done:
      task=active.pop(f);f.result();jobs_done+=1;publish(modelJobsCompleted=jobs_done,lastModel=task['id'])
     queue()
    if not available():break
    atomic(run/'model-cache.json',model_cache)
    request_genomes=[{**g,'predictionFiles':model_cache[model_key(g)]} for g in children]
    publish(state='evaluating_generation');results=score(request_genomes,generation)
    if results is None:break
    eligible=[r for r in results['candidates'] if r['eligible']];winner=max([state['parent'],*eligible],key=lambda r:r['fitnessUSDT']);improved=winner['fitnessUSDT']>state['parent']['fitnessUSDT']+1e-8
    state['parent']=winner;state['generation']=generation;state['stagnation']=0 if improved else state['stagnation']+1;state['seen'].extend(g['id'] for g in children);state['allCandidates'].extend(results['candidates']);state['history'].append({'generation':generation,'bestValidationMonthlyBRL':winner['fitnessUSDT']*5,'improved':improved});atomic(state_file,state)
    publish(state='generation_completed',bestValidationMonthlyBRL=winner['fitnessUSDT']*5,bestGenome=winner['genome'],stagnation=state['stagnation'])
  finally:
   executor.shutdown(wait=False,cancel_futures=True)
   for child in mp.active_children():child.terminate()
  parent=state['parent'];reason='Máximo de gerações' if state['generation']>=p['maxGenerations'] else 'Oito gerações sem melhora' if state['stagnation']>=8 else 'Tempo, parada ou disco'
  atomic(run/'winner-frozen.json',{'frozenAt':now(),'winner':parent,'reason':reason,'generation':state['generation']})
  final=None
  if not STOP and time.time()<deadline-30:
   publish(state='final_test');g=parent['genome'];files=model_cache.get(model_key(g),root_paths);final=score([{**g,'predictionFiles':files}],state['generation'],final=True)
  report={'runId':args.run_id,'winner':parent,'generations':state['generation'],'history':state['history'],'reason':reason,'finalTest':final,'realOrders':False,'caveat':'Fitness de validação, não lucro garantido. Histórico já visto; teste final consultado após congelar o vencedor. Nenhuma promoção automática.'};atomic(run/'report.json',report);atomic(ROOT/'web/data/cpu-evolution-results.json',report)
  publish(state='stopped' if STOP else 'completed' if final else 'time_limit',finishedAt=now(),bestValidationMonthlyBRL=parent['fitnessUSDT']*5,bestGenome=parent['genome'],reason=reason)
 except Exception as e:publish(state='failed',reason=str(e));raise
if __name__=='__main__':
 for var in ['OMP_NUM_THREADS','OPENBLAS_NUM_THREADS','MKL_NUM_THREADS','VECLIB_MAXIMUM_THREADS','NUMEXPR_NUM_THREADS']:os.environ[var]='1'
 main()
