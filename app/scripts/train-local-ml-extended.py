"""Registered extended research campaign; bounded CPU, checkpoints, no orders."""
import argparse,concurrent.futures as futures,hashlib,importlib.util,json,multiprocessing as mp
import os,platform,random,resource,signal,subprocess,sys,time,warnings
from datetime import datetime,timezone
from functools import lru_cache
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
spec=importlib.util.spec_from_file_location('base_trainer',ROOT/'scripts/train-local-ml.py')
base=importlib.util.module_from_spec(spec);spec.loader.exec_module(base)
read,atomic,sha,month_at,temporal,now=base.read,base.atomic,base.sha,base.month_at,base.temporal,base.now
STOP=False
def stop(signum,frame):
 global STOP;STOP=True
def task_plan(p):
 tasks=[]
 for fold in p['folds']:
  for window in p['trainWindows']:
   if month_at(fold,-p['validationMonths']-window)<int(datetime.fromisoformat(p['datasetStart'].replace('Z','+00:00')).timestamp()*1000):continue
   for hold in p['holdingMinutes']:
    for family in p['families']:
     for c in p['configs']:
      for seed in p['seeds'] if c['algorithm'] in p['repeatAlgorithms'] else [p['seed']]:
       tasks.append({'id':f'{family}-{fold}-h{hold}-w{window}-{c["id"]}-s{seed}','family':family,'fold':fold,'hold':hold,'trainMonths':window,'config':c,'seed':seed})
 random.Random(p['seed']).shuffle(tasks)
 return tasks
@lru_cache(maxsize=2)
def dataset(run,hold):return read(Path(run)/'labels'/f'hold-{hold}.json')['groups']
@lru_cache(maxsize=1)
def raw_features():return read(ROOT/'data/scalp-tree/features.json')['features']
def fit(task,run):
 import numpy as np,joblib
 from threadpoolctl import threadpool_limits,threadpool_info
 from sklearn.metrics import brier_score_loss,balanced_accuracy_score
 started=time.monotonic();cpu=resource.getrusage(resource.RUSAGE_SELF);wall=now();family=task['family'];fold=task['fold'];end=month_at(fold,-3);validation_end=month_at(fold);test_end=month_at(fold,1)
 train=temporal(dataset(run,task['hold'])[family],month_at(fold,-3-task['trainMonths']),end)
 target=Path(run)/'predictions'/(task['id']+'.json')
 if len(train)<300 or len({r['y'] for r in train})<2:
  result={**task,'skipped':True,'reason':'Treino insuficiente ou sem duas classes','trainCount':len(train)};atomic(target,result);return{'id':task['id'],'skipped':True,'warnings':0}
 rows=raw_features()[family];val=[s for s in rows if end<=s['at']<validation_end];test=[s for s in rows if validation_end<=s['at']<test_end]
 labels=temporal(dataset(run,task['hold'])[family],end,validation_end);model=base.estimator(task['config'],task['seed'])
 with threadpool_limits(limits=1),warnings.catch_warnings(record=True) as caught:
  warnings.simplefilter('always');model.fit(np.asarray([s['x'] for s in train]),np.asarray([s['y'] for s in train]))
  def scores(rows):
   v=model.predict_proba(np.asarray([s['x'] for s in rows]))[:,list(model.classes_).index(1)]
   if not np.isfinite(v).all():raise ValueError('Score inválido')
   return [[s['at'],float(x)] for s,x in zip(rows,v)]
  validation=scores(val);testing=scores(test);known=dict(validation)
  metrics={'brier':float(brier_score_loss([s['y'] for s in labels],[known[s['at']] for s in labels])),'balancedAccuracy':float(balanced_accuracy_score([s['y'] for s in labels],[known[s['at']]>=.5 for s in labels]))}
  pools=[{'internal_api':x['internal_api'],'num_threads':x['num_threads']} for x in threadpool_info()]
 artifact=Path(run)/'models'/(task['id']+'.joblib');artifact.parent.mkdir(parents=True,exist_ok=True);tmp=artifact.with_suffix('.tmp');joblib.dump(model,tmp,compress=3);tmp.replace(artifact)
 usage=resource.getrusage(resource.RUSAGE_SELF)
 result={**task,'trainCount':len(train),'trainStart':month_at(fold,-3-task['trainMonths']),'trainEnd':end,'maxTrainLabelAvailableAt':max(s['labelAvailableAt'] for s in train),'validationEnd':validation_end,'testEnd':test_end,'validation':validation,'test':testing,'validationMetrics':metrics,'warnings':sorted(set(str(w.message) for w in caught)),'startedAt':wall,'seconds':time.monotonic()-started,'cpuSeconds':usage.ru_utime+usage.ru_stime-cpu.ru_utime-cpu.ru_stime,'maxWorkerRSSBytes':usage.ru_maxrss*(1 if sys.platform=='darwin' else 1024),'workerPID':os.getpid(),'threadPools':pools,'artifact':str(artifact.relative_to(ROOT)),'artifactSHA256':sha(artifact)}
 atomic(target,result);return{'id':task['id'],'seconds':result['seconds'],'warnings':len(result['warnings']),'skipped':False}
def main():
 import sklearn,numpy,scipy,joblib
 ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--profile',choices=['extended'],default='extended');ap.add_argument('--workers',type=int,default=10);ap.add_argument('--max-minutes',type=float);ap.add_argument('--run-id',required=True);ap.add_argument('--resume',action='store_true');args=ap.parse_args()
 if not args.run_id or not all(c.isalnum() or c in '-_' for c in args.run_id):ap.error('run-id inválido')
 if args.workers<1 or args.max_minutes is not None and (args.max_minutes<=0 or args.max_minutes>480):ap.error('Limite máximo8h e pelo menos1 processo')
 p=read(ROOT/'local-ml-extended-protocol.json');tasks=task_plan(p);workers=min(args.workers,os.cpu_count() or 1,10);minutes=args.max_minutes or p['maxMinutes'];run=ROOT/'work/local-ml/runs'/args.run_id;run.mkdir(parents=True,exist_ok=True)
 files=['local-ml-extended-protocol.json','scripts/train-local-ml-extended.py','scripts/train-local-ml.py','scripts/evaluate-extended-ml.mjs','scripts/extended-ml-utils.mjs','scripts/build-extended-ml-labels.mjs','scripts/local-ml-evaluation.mjs','web/scalp-tree-engine.js','web/scalping.js','scalping-protocol.json','data/scalp-tree/samples.json','data/scalp-tree/features.json','data/scalp-tree/manifest.json']
 fingerprint={f:sha(ROOT/f) for f in files};fingerprint.update(python=platform.python_version(),sklearn=sklearn.__version__,numpy=numpy.__version__,scipy=scipy.__version__,joblib=joblib.__version__)
 record=run/'registration.json'
 if record.exists():
  if not args.resume or read(record)['fingerprint']!=fingerprint:raise ValueError('Retomada exige mesmos dados, código, protocolo e versões')
 else:atomic(record,{'createdAt':now(),'protocol':p,'fingerprint':fingerprint})
 started=time.monotonic();deadline=started+minutes*60
 status={'mode':'extended','profile':'extended','runId':args.run_id,'pid':os.getpid(),'state':'preparing','startedAt':now(),'workers':workers,'threadsPerWorker':1,'completed':0,'total':len(tasks),'failed':0,'skipped':0,'warnings':0,'deadlineAt':datetime.fromtimestamp(time.time()+minutes*60,timezone.utc).isoformat(),'fingerprint':fingerprint}
 def publish(**extra):
  if (run/'status.json').exists():
   latest=read(run/'status.json')
   if latest.get('pid')==os.getpid():status.update(latest)
  status.update(extra);status.update(updatedAt=now(),elapsedSeconds=time.monotonic()-started);atomic(run/'status.json',status);atomic(ROOT/'web/data/cpu-training-status.json',status)
 def exhausted():
  disk=os.statvfs(ROOT)
  return disk.f_bavail*disk.f_frsize<p['minimumFreeDiskGB']*1024**3
 def child_stage(script):
  with open(run/(Path(script).stem+'.log'),'a') as log:
   child=subprocess.Popen(['node',str(ROOT/script),str(run)],cwd=ROOT,stdout=log,stderr=subprocess.STDOUT)
   while child.poll() is None and not STOP and time.monotonic()<deadline and not exhausted():time.sleep(.5)
   if child.poll() is None:
    child.terminate()
    try:child.wait(timeout=5)
    except subprocess.TimeoutExpired:child.kill();child.wait()
    return False
   if child.returncode:raise RuntimeError('Etapa falhou: '+script+'; consulte o log da rodada')
   return True
 signal.signal(signal.SIGTERM,stop);signal.signal(signal.SIGINT,stop);publish()
 try:
  if exhausted():publish(state='stopped',reason='Disco livre abaixo de4GB');return
  if not child_stage('scripts/build-extended-ml-labels.mjs'):publish(state='stopped' if STOP else 'time_limit',reason='Preparação interrompida; checkpoints salvos');return
  label_hashes={str(hold):sha(run/'labels'/f'hold-{hold}.json') for hold in p['holdingMinutes']}
  if (run/'label-hashes.json').exists() and read(run/'label-hashes.json')!=label_hashes:raise ValueError('Rótulos do checkpoint alterados')
  atomic(run/'label-hashes.json',label_hashes);atomic(run/'tasks.json',{'tasks':tasks})
  pending=[];done=0;skipped=0;warning_count=0
  for task in tasks:
   file=run/'predictions'/(task['id']+'.json')
   if file.exists():
    saved=read(file)
    if any(saved[k]!=task[k] for k in task):raise ValueError('Checkpoint divergente')
    if not saved.get('skipped') and sha(ROOT/saved['artifact'])!=saved['artifactSHA256']:raise ValueError('Artefato corrompido')
    done+=1;skipped+=bool(saved.get('skipped'));warning_count+=len(saved.get('warnings',[]))
   else:pending.append(task)
  publish(state='training',completed=done,skipped=skipped,warnings=warning_count)
  executor=futures.ProcessPoolExecutor(max_workers=workers,mp_context=mp.get_context('spawn'));active={};iterator=iter(pending);errors=[]
  def queue():
   while len(active)<workers and not STOP and time.monotonic()<deadline:
    task=next(iterator,None)
    if task is None:break
    active[executor.submit(fit,task,str(run))]=task
  try:
   queue()
   while active and not STOP and time.monotonic()<deadline and not exhausted():
    finished,_=futures.wait(active,timeout=1,return_when=futures.FIRST_COMPLETED)
    for future in finished:
     task=active.pop(future)
     try:
      item=future.result();done+=1;skipped+=item['skipped'];warning_count+=item['warnings'];print(json.dumps(item),flush=True)
     except Exception as e:errors.append({'id':task['id'],'error':str(e)})
     publish(completed=done,skipped=skipped,warnings=warning_count,failed=len(errors),lastCompleted=task['id'])
    queue()
  finally:
   executor.shutdown(wait=False,cancel_futures=True)
   for child in mp.active_children():child.terminate()
  if errors:publish(state='failed',errors=errors);return
  if done<len(tasks):publish(state='stopped' if STOP or exhausted() else 'time_limit',reason='Checkpoints preservados');return
  publish(state='evaluating',evaluationCompleted=0,evaluationTotal=len(p['families'])*len(p['folds']))
  if not child_stage('scripts/evaluate-extended-ml.mjs'):publish(state='stopped' if STOP or exhausted() else 'time_limit',reason='Avaliação interrompida; checkpoints salvos');return
  publish(state='completed',finishedAt=now(),artifactDirectory=str(run.relative_to(ROOT)))
 except Exception as e:publish(state='failed',reason=str(e));raise
if __name__=='__main__':
 for var in ['OMP_NUM_THREADS','OPENBLAS_NUM_THREADS','MKL_NUM_THREADS','VECLIB_MAXIMUM_THREADS','NUMEXPR_NUM_THREADS']:os.environ[var]='1'
 main()
