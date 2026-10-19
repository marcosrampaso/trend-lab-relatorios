"""Long local genetic search with causal regime routing, diversity and resumable checkpoints."""
import argparse,concurrent.futures as futures,copy,hashlib,importlib.util,json,math,multiprocessing as mp
import os,random,shutil,signal,subprocess,time
from datetime import datetime,timezone
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
spec=importlib.util.spec_from_file_location('adaptive_extended',ROOT/'scripts/train-local-ml-extended.py');ext=importlib.util.module_from_spec(spec);spec.loader.exec_module(ext)
read,atomic,sha,now=ext.read,ext.atomic,ext.sha,ext.now
REGIMES=['trend','range','volatile'];STOP=False
def stop(signum,frame):
 global STOP;STOP=True
def canonical(v):return json.dumps(v,sort_keys=True,separators=(',',':'))
def identify(g):
 g=json.loads(canonical(g));g.pop('id',None);g['id']=hashlib.sha256(canonical(g).encode()).hexdigest()[:20];return g
def model_key(g,family,hold):
 return hashlib.sha256(canonical({'algorithm':g['algorithm'],'params':g['params'],'trainMonths':g['trainMonths'],'family':family,'hold':hold}).encode()).hexdigest()[:20]
def default_params(a,rng):
 if a=='logistic':return {'C':10**rng.uniform(-3,1)}
 if a in ['tree','random_forest','extra_trees']:
  q={'max_depth':rng.choice([3,4,6,8,10,14]),'min_samples_leaf':rng.choice([30,50,75,100,150,200])}
  if a!='tree':q['n_estimators']=rng.choice([200,400,800,1200])
  return q
 if a=='hist_boosting':return {'max_iter':rng.choice([150,300,500]),'max_leaf_nodes':rng.choice([7,15,31]),'min_samples_leaf':rng.choice([30,50,100,150]),'l2_regularization':10**rng.uniform(-1,2)}
 if a=='mlp':return {'hidden_layer_sizes':rng.choice([[16],[32,16],[64,32],[96,48]]),'alpha':10**rng.uniform(-4,0),'max_iter':rng.choice([1000,2000,3000]),'learning_rate_init':10**rng.uniform(-4,-2)}
 raise ValueError('Algoritmo inválido')
def random_arm(rng,p):return {'family':rng.choice([*p['families'],None]),'hold':rng.choice(p['holdingMinutes']),'threshold':round(rng.uniform(.2,.85),3)}
def random_genome(rng,p):
 a=rng.choice(p['algorithms']);g={'algorithm':a,'params':default_params(a,rng),'trainMonths':rng.choice(p['trainWindows']),'volatilityCut':round(10**rng.uniform(math.log10(.0004),math.log10(.006)),6),'trendCut':round(rng.uniform(.2,3),3),'routes':{k:random_arm(rng,p) for k in REGIMES}}
 if all(r['family'] is None for r in g['routes'].values()):g['routes']['range']['family']='bands'
 return identify(g)
def from_static(g):
 return identify({'algorithm':g['algorithm'],'params':g['params'],'trainMonths':g['trainMonths'],'volatilityCut':.0015,'trendCut':.7,'routes':{k:{'family':g['family'],'hold':g['hold'],'threshold':g['threshold']} for k in REGIMES}})
def mutate(parent,rng,p,burst=False):
 g=copy.deepcopy(parent);g.pop('id',None);scale=1.2 if burst else .4
 genes=['algorithm','params','trainMonths','volatilityCut','trendCut',*REGIMES]
 for gene in rng.sample(genes,rng.randint(2,6) if burst else rng.randint(1,3)):
  if gene=='algorithm':g['algorithm']=rng.choice(p['algorithms']);g['params']=default_params(g['algorithm'],rng)
  elif gene=='params':g['params']=default_params(g['algorithm'],rng) if burst else move_params(g['algorithm'],g['params'],rng,scale)
  elif gene=='trainMonths':g[gene]=rng.choice(p['trainWindows'])
  elif gene=='volatilityCut':g[gene]=round(min(.006,max(.0004,g[gene]*math.exp(rng.gauss(0,scale)))),6)
  elif gene=='trendCut':g[gene]=round(min(3,max(.2,g[gene]*math.exp(rng.gauss(0,scale)))),3)
  else:
   arm=g['routes'][gene]
   if burst or rng.random()<.4:arm['family']=rng.choice([*p['families'],None])
   if rng.random()<.6:arm['hold']=rng.choice(p['holdingMinutes'])
   arm['threshold']=round(min(.85,max(.2,(arm['threshold'] or .4)+rng.gauss(0,.16 if burst else .06))),3)
 if all(r['family'] is None for r in g['routes'].values()):g['routes'][rng.choice(REGIMES)]['family']=rng.choice(p['families'])
 return identify(g)
def move_params(a,params,rng,scale):
 q=copy.deepcopy(params)
 def move(x,lo,hi):return min(hi,max(lo,x*math.exp(rng.gauss(0,scale))))
 if a=='logistic':q['C']=move(q['C'],.0001,100)
 elif a in ['tree','random_forest','extra_trees']:
  q['max_depth']=max(2,min(16,(q.get('max_depth') or 8)+rng.choice([-3,-1,1,3])));q['min_samples_leaf']=int(round(move(q['min_samples_leaf'],30,300)))
  if a!='tree':q['n_estimators']=max(200,min(1600,q['n_estimators']+rng.choice([-200,200])))
 elif a=='hist_boosting':
  q['max_iter']=max(100,min(1000,q['max_iter']+rng.choice([-100,100])));q['max_leaf_nodes']=rng.choice([7,15,31,63]);q['l2_regularization']=move(q['l2_regularization'],.01,100)
 else:
  q['hidden_layer_sizes']=rng.choice([[16],[32,16],[64,32],[96,48],[128,64]]);q['alpha']=move(q['alpha'],.00001,5);q['learning_rate_init']=move(q.get('learning_rate_init',.001),.0001,.01);q['max_iter']=max(600,min(4000,q['max_iter']+rng.choice([-400,400])))
 return q
def crossover(a,b,rng):
 g=copy.deepcopy(a);g.pop('id',None)
 if rng.random()<.5:g['algorithm']=b['algorithm'];g['params']=copy.deepcopy(b['params'])
 for k in ['trainMonths','volatilityCut','trendCut']:
  if rng.random()<.5:g[k]=b[k]
 for k in REGIMES:
  if rng.random()<.5:g['routes'][k]=copy.deepcopy(b['routes'][k])
 return identify(g)
def rank_key(r):return (bool(r.get('eligible')),r.get('fitnessUSDT') if r.get('fitnessUSDT') is not None else r.get('diagnosticMeanUSDT',-1e100),-r.get('maxDD',1),r.get('positiveMonths',0))
spec3=importlib.util.spec_from_file_location('search_v3_operators',ROOT/'scripts/search-v3-operators.py');ops=importlib.util.module_from_spec(spec3);spec3.loader.exec_module(ops)
diverse_pool,next_generation=ops.diverse_pool,ops.next_generation
def seed_population(report,previous,p):
 config={c['id']:c for c in report['protocol']['configs']};groups={}
 for t in report['trials']:
  if t['fold'] not in p['validationFolds'] or not t['eligible'] or t['algorithm']=='constant':continue
  key=canonical([t['family'],t['hold'],t['trainMonths'],t['configId'],t['threshold']]);groups.setdefault(key,[]).append(t)
 ranked=[]
 for rows in groups.values():
  if len(rows)!=len(p['validationFolds']) or {r['fold'] for r in rows}!=set(p['validationFolds']):continue
  t=rows[0];fitness=min(sum(r['basePnL'] for r in rows),sum(r['stressPnL'] for r in rows))/9
  g=from_static({'family':t['family'],'hold':t['hold'],'trainMonths':t['trainMonths'],'algorithm':t['algorithm'],'params':config[t['configId']]['params'],'threshold':t['threshold']});ranked.append((fitness,t['family'],t['algorithm'],g))
 ranked.sort(key=lambda r:r[0],reverse=True);selected=[from_static(previous['genome'])];niches=set();audit=[]
 for score,family,algorithm,g in ranked:
  key=(family,algorithm)
  if key in niches:continue
  niches.add(key);audit.append({'family':family,'algorithm':algorithm,'previousValidationUSDT':score,'genome':g})
  if g['id'] not in {x['id'] for x in selected}:selected.append(g)
 rng=random.Random(p['seed'])
 while len(selected)<p['populationSize']:
  g=random_genome(rng,p)
  if g['id'] not in {x['id'] for x in selected}:selected.append(g)
 return selected[:p['populationSize']],audit
def fit_job(task,run):return ext.fit(task,run)
def main():
 ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--run-id',required=True);ap.add_argument('--resume',action='store_true');ap.add_argument('--smoke',action='store_true');ap.add_argument('--from-run');args=ap.parse_args()
 if not args.run_id or not all(c.isalnum() or c in '-_' for c in args.run_id):ap.error('run-id inválido')
 p=read(ROOT/'adaptive-search-v3-protocol.json');run=ROOT/'work/local-ml/runs'/args.run_id;run.mkdir(parents=True,exist_ok=True)
 files=['adaptive-search-v3-protocol.json','scripts/adaptive-search-v3.py','scripts/search-v3-operators.py','adaptive-genetic-protocol.json','scripts/adaptive-genetic.py','scripts/build-adaptive-labels.mjs','scripts/score-adaptive-genetic.mjs','web/adaptive-policy.js','web/adaptive-engine.js','scripts/train-local-ml-extended.py','scripts/train-local-ml.py','scripts/local-ml-evaluation.mjs','scripts/extended-ml-utils.mjs','scalping-protocol.json','data/scalp-tree/features.json','data/scalp-tree/manifest.json']
 fingerprint={f:sha(ROOT/f) for f in files};record=run/'registration.json';base=ROOT/'work/local-ml/runs'/p['baseRun'];previous=ROOT/'work/local-ml/runs'/p['previousRun']
 fingerprint['baseRegistration']=sha(base/'registration.json');fingerprint['previousWinner']=sha(previous/'winner-frozen.json')
 if record.exists():
  saved=read(record)
  if not args.resume or saved['fingerprint']!=fingerprint:raise ValueError('Checkpoint incompatível; preservar rodada anterior')
  registration=saved
 else:
  if not args.from_run or not all(c.isalnum() or c in '-_' for c in args.from_run):raise ValueError('Continuação exige rodada de origem válida')
  parent=ROOT/'work/local-ml/runs'/args.from_run;parent_record=read(parent/'registration.json');parent_status=read(parent/'status.json')
  if parent_status['state'] not in ['stopped','completed','time_limit']:raise ValueError('Encerrar rodada de origem antes de continuar')
  if time.time()>datetime.fromisoformat(parent_record['deadlineAt']).timestamp()-120:raise ValueError('Prazo original encerrado')
  for key in ['capitalBRL','fx','risk','leverage','holdingMinutes','trainWindows','validationFolds','finalTestFold','seeds','minimumTotalTradesBothCosts','minimumFoldTradesBothCosts','maximumValidationDrawdown']:
   if parent_record['protocol'][key]!=p[key]:raise ValueError('Regra preservada alterada: '+key)
  registration={'createdAt':now(),'deadlineAt':parent_record['deadlineAt'],'protocol':p,'fingerprint':fingerprint,'parentRun':args.from_run,'parentRegistrationSHA256':sha(parent/'registration.json'),'parentStateSHA256':sha(parent/'evolution.json'),'inheritedBytes':sum(f.stat().st_size for f in parent.rglob('*') if f.is_file())};atomic(record,registration)
  (run/'labels').symlink_to(parent/'labels',target_is_directory=True);(run/'predictions').mkdir(exist_ok=True)
  for file in (parent/'predictions').glob('*.json'):(run/'predictions'/file.name).symlink_to(file)
  inherited_cache={k:[str(run/'predictions'/Path(f).name) for f in paths] for k,paths in read(parent/'model-cache.json').items()};atomic(run/'model-cache.json',inherited_cache)
  inherited=read(parent/'evolution.json');all_rows=[]
  for file in sorted(parent.glob('scores-*.json')):all_rows.extend(read(file)['candidates'])
  inherited['searchArchive']=diverse_pool(all_rows,96);atomic(run/'evolution.json',inherited);atomic(run/'continuation-audit.json',{'parentRun':args.from_run,'generation':inherited['generation'],'bestValidationMonthlyBRL':inherited['best']['fitnessUSDT']*5,'originalDeadlineAt':registration['deadlineAt'],'inheritedPredictions':len(list((run/'predictions').glob('*.json'))),'archiveAlgorithms':{a:sum(r['genome']['algorithm']==a for r in inherited['searchArchive']) for a in p['algorithms']},'testUsed':False})
  inherited_status=read(parent/'status.json');inherited_status.pop('finishedAt',None);inherited_status.pop('reason',None);inherited_status.update(runId=args.run_id,inheritedModelJobs=inherited_status['modelJobsCompleted'],continuedFrom=args.from_run,searchVersion=p['version']);atomic(run/'status.json',inherited_status)
 deadline=datetime.fromisoformat(registration['deadlineAt']).timestamp();status_file=run/'status.json';status=read(status_file) if status_file.exists() else {'runId':args.run_id,'startedAt':now(),'generation':0,'maxGenerations':p['maxGenerations'],'populationSize':p['populationSize'],'modelJobsCompleted':0,'failedFits':0,'warnings':0,'restarts':0,'candidatesEvaluated':0}
 status.update(pid=os.getpid(),state='preparing',deadlineAt=registration['deadlineAt'],workers=min(p['workers'],os.cpu_count() or 1),threadsPerWorker=1,capitalBRL=p['capitalBRL'],risk=p['risk'],realOrders=False,protocolVersion=p['version'])
 def publish(**extra):
  status.update(extra);status['updatedAt']=now();atomic(status_file,status);atomic(ROOT/'web/data/adaptive-evolution-status.json',status)
 disk_cache={'at':0,'bytes':0}
 def limit_reason(reserve=90):
  if STOP:return 'stopped'
  if time.time()>=deadline-reserve:return 'time_limit'
  if shutil.disk_usage(ROOT).free<p['minimumFreeDiskGB']*1024**3:return 'disk_limit'
  if time.time()-disk_cache['at']>30:
   disk_cache.update(at=time.time(),bytes=registration.get('inheritedBytes',0)+sum(f.stat().st_size for f in run.rglob('*') if f.is_file() and not f.is_symlink()))
  if disk_cache['bytes']>p['maxRunDiskGB']*1024**3:return 'disk_limit'
  return None
 def stage(script,params,final=False):
  with open(run/(Path(script).stem+'.log'),'a') as log:
   child=subprocess.Popen(['node',str(ROOT/script),str(run),*params],cwd=ROOT,stdout=log,stderr=subprocess.STDOUT)
   while child.poll() is None and not limit_reason(0 if final else 90):time.sleep(.5)
   if child.poll() is None:
    child.terminate()
    try:child.wait(timeout=5)
    except subprocess.TimeoutExpired:child.kill();child.wait()
    return False
   if child.returncode:raise RuntimeError('Etapa falhou: '+script+'; consulte log da rodada')
  return True
 def snapshot(state):
  atomic(run/'evolution.json',state);report={'runId':args.run_id,'protocol':p,'capitalBRL':p['capitalBRL'],'baseline':state.get('baseline'),'winner':state.get('best'),'generation':state['generation'],'history':state['history'],'completed':False,'realOrders':False,'usedTestForSelection':False,'updatedAt':now(),'caveat':'Pesquisa em dados já conhecidos; fitness de validação não prova lucro futuro.'};atomic(run/'report.json',report);atomic(ROOT/'web/data/adaptive-evolution-results.json',report)
 signal.signal(signal.SIGTERM,stop);signal.signal(signal.SIGINT,stop);publish()
 try:
  if not stage('scripts/build-adaptive-labels.mjs',[]):publish(state=limit_reason() or 'failed',reason='Preparação interrompida; checkpoints salvos');return
  # The label builder also publishes progress. Preserve it when returning to the trainer.
  status.update(read(status_file));publish(state='seeding')
  state_file=run/'evolution.json'
  if state_file.exists():state=read(state_file)
  else:
   initial,audit=seed_population(read(base/'evaluation.json'),read(previous/'winner-frozen.json')['winner'],p);atomic(run/'seed-audit.json',{'source':'validation_only_R300_for_initialization_only','rows':audit,'previousWinner':read(previous/'winner-frozen.json')['winner'],'recalculateAtCapitalBRL':p['capitalBRL']});atomic(run/'children-0.json',initial)
   state={'generation':-1,'stagnation':0,'seen':[],'history':[],'population':[],'best':None,'baseline':None};atomic(state_file,state)
  snapshot(state)
  cache=read(run/'model-cache.json') if (run/'model-cache.json').exists() else {};executor=futures.ProcessPoolExecutor(max_workers=status['workers'],mp_context=mp.get_context('spawn'))
  try:
   while state['generation']<p['maxGenerations'] and not limit_reason():
    generation=state['generation']+1;children_file=run/f'children-{generation}.json';mix_file=run/f'mix-{generation}.json'
    if children_file.exists():children=read(children_file);mix=read(mix_file) if mix_file.exists() else {'burst':False,'restart':False,'immigrants':p['populationSize']-19}
    else:children,mix=next_generation(state,p,generation);atomic(children_file,children);atomic(mix_file,mix)
    publish(state='training',generation=generation,stagnation=state['stagnation'],burst=mix['burst'],generationImmigrants=mix['immigrants'],generationFitsCompleted=0,searchLanes=mix.get('lanes'),parentAlgorithms=mix.get('parentAlgorithms'),parentDistinctBehaviors=mix.get('parentDistinctBehaviors'))
    tasks={};maps={}
    for g in children:
     files_by_arm={}
     for arm in g['routes'].values():
      if not arm['family'] or arm['threshold']==0:continue
      key=model_key(g,arm['family'],arm['hold']);arm_id=arm['family']+'/'+str(arm['hold']);paths=[]
      for fold in p['validationFolds']:
       for seed in p['seeds'] if g['algorithm'] in p['repeatAlgorithms'] else [p['seeds'][0]]:
        task={'id':key+'-'+fold+'-s'+str(seed),'family':arm['family'],'fold':fold,'hold':arm['hold'],'trainMonths':g['trainMonths'],'config':{'id':key,'algorithm':g['algorithm'],'params':g['params']},'seed':seed};target=run/'predictions'/(task['id']+'.json');paths.append(str(target))
        if target.exists():
         old=read(target)
         if not old.get('skipped') and sha(ROOT/old['artifact'])!=old['artifactSHA256']:raise ValueError('Artefato de modelo alterado')
        else:tasks[task['id']]=task
      cache[key]=paths;files_by_arm[arm_id]=paths
     maps[g['id']]=files_by_arm
    atomic(run/'model-cache.json',cache);publish(generationFitsTotal=len(tasks));active={};pending=iter(tasks.values())
    def queue():
     while len(active)<status['workers'] and not limit_reason():
      task=next(pending,None)
      if task is None:break
      active[executor.submit(fit_job,task,str(run))]=task
    queue()
    while active and not limit_reason():
     done,_=futures.wait(active,timeout=1,return_when=futures.FIRST_COMPLETED)
     for f in done:
      task=active.pop(f)
      try:item=f.result();status['warnings']+=item.get('warnings',0)
      except Exception as error:
       atomic(run/'predictions'/(task['id']+'.json'),{**task,'skipped':True,'reason':str(error),'failed':True});status['failedFits']+=1
      status['modelJobsCompleted']+=1;status['generationFitsCompleted']+=1;publish(lastModel=task['id'])
     queue()
    if limit_reason():break
    output=run/f'scores-{generation}.json';request_file=run/f'request-{generation}.json';atomic(request_file,{'generation':generation,'genomes':[{**g,'predictionFiles':maps[g['id']]} for g in children],'output':str(output)})
    publish(state='evaluating_generation')
    if not output.exists() and not stage('scripts/score-adaptive-genetic.mjs',[str(request_file)]):break
    candidates=read(output)['candidates'];eligible=[r for r in candidates if r['eligible']];old_best=state['best'];winner=max([*([old_best] if old_best else []),*eligible],key=rank_key,default=None)
    if generation==0:state['baseline']=candidates[0]
    significant=winner is not None and (old_best is None or winner['fitnessUSDT']>old_best['fitnessUSDT']+p['improvementEpsilonUSDT'])
    state['stagnation']=0 if significant else state['stagnation']+1;state['best']=winner;state['population']=diverse_pool([*state['population'],*candidates],p['populationSize']);state['searchArchive']=diverse_pool([*state.get('searchArchive',[]),*candidates],96);state['seen'].extend(g['id'] for g in children);state['generation']=generation
    status['restarts']+=int(mix['restart']);status['candidatesEvaluated']+=len(candidates)
    point={'generation':generation,'bestValidationMonthlyBRL':winner['fitnessUSDT']*5 if winner else None,'eligible':len(eligible),'improved':significant,'burst':mix['burst'],'restart':mix['restart'],'immigrants':mix['immigrants'],'maxDD':winner.get('maxDD') if winner else None,'positiveMonths':winner.get('positiveMonths') if winner else None,'generationBestBRL':max((r['fitnessUSDT']*5 for r in eligible),default=None),'uniqueBehaviors':len({ops.behavior_key(r) for r in candidates}),'lanes':mix.get('lanes'),'parentAlgorithms':mix.get('parentAlgorithms')};state['history'].append(point);snapshot(state)
    publish(state='generation_completed',bestValidationMonthlyBRL=point['bestValidationMonthlyBRL'],bestGenome=winner['genome'] if winner else None,stagnation=state['stagnation'],eligibleCandidates=len(eligible),baselineValidationMonthlyBRL=state['baseline']['fitnessUSDT']*5 if state['baseline']['fitnessUSDT'] is not None else None)
    if args.smoke:break
  finally:
   executor.shutdown(wait=False,cancel_futures=True)
   for child in mp.active_children():child.terminate()
  reason=limit_reason() or 'completed';report=read(run/'report.json') if (run/'report.json').exists() else {'runId':args.run_id,'winner':state.get('best'),'realOrders':False}
  if state.get('best'):
   atomic(run/'winner-frozen.json',{'frozenAt':now(),'winner':state['best'],'reason':reason,'generation':state['generation']})
   if not STOP and time.time()<deadline-20 and reason!='disk_limit':
    g=state['best']['genome'];predictions={}
    for arm in g['routes'].values():
     if arm['family'] and arm['threshold']>0:predictions[arm['family']+'/'+str(arm['hold'])]=cache[model_key(g,arm['family'],arm['hold'])]
    request_file=run/'final-request.json';output=run/'final-result.json';atomic(request_file,{'final':True,'genomes':[{**g,'predictionFiles':predictions}],'output':str(output)})
    if output.exists() or stage('scripts/score-adaptive-genetic.mjs',[str(request_file)],final=True):report['finalTest']=read(output)
  report.update(completed=True,reason=reason,finishedAt=now());atomic(run/'report.json',report);atomic(ROOT/'web/data/adaptive-evolution-results.json',report);publish(state=reason,reason=reason,finishedAt=now())
 except Exception as error:publish(state='failed',reason=str(error));raise
if __name__=='__main__':
 for var in ['OMP_NUM_THREADS','OPENBLAS_NUM_THREADS','MKL_NUM_THREADS','VECLIB_MAXIMUM_THREADS','NUMEXPR_NUM_THREADS']:os.environ[var]='1'
 main()
