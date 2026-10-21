"""One low-concurrency worker; matched continual versus rollback arms, frozen parents."""
import importlib,os,json,signal,subprocess,time,fcntl,shutil,hashlib
core=importlib.import_module('pepe-elite-core');runtime=importlib.import_module('run-pepe-mask-ultra')
ROOT,RUN=core.ROOT,core.RUN
STOP=False

def stop(*_):
 global STOP;STOP=True
signal.signal(signal.SIGTERM,stop);signal.signal(signal.SIGINT,stop)
def stopping():return STOP or core.read(RUN/'control.json')['desired']!='running'
def guard():
 if shutil.disk_usage(ROOT).free<10*1024**3:return 'paused_disk'
 return None

def job(parent,round_number,*,arm=None,pair=None,source=None):
 p=parent
 return {'key':f'r{round_number:02}-p{p["id"]}-'+(f's{pair}-{arm}'if arm else'frozen'), 'kind':'train'if arm else'frozen','round':round_number,'parent':p['id'],'pair':pair,'arm':arm,'sourcePath':source['modelPath']if source else p['modelPath'],'sourceSHA256':source['modelSHA256']if source else p['modelSHA256'],'hyperparameters':p['hyperparameters'],'seed':P['seed']+p['id']*100003+(pair or 0)*997+round_number*104729,'steps':P['stepsPerRound']if arm else 0}

class Worker:
 def __init__(self):
  self.log=(RUN/'worker.log').open('a');self.p=subprocess.Popen([str(ROOT/'.venv-rl/bin/python'),'scripts/pepe-elite-worker.py'],cwd=ROOT,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=self.log,text=True,bufsize=1,env={**os.environ,'OMP_NUM_THREADS':'2','OPENBLAS_NUM_THREADS':'2'})
 def call(self,j):
  self.p.stdin.write(json.dumps(j)+'\n');self.p.stdin.flush();line=self.p.stdout.readline()
  if not line:raise RuntimeError('Elite worker stopped; inspect worker.log')
  result=json.loads(line)
  if 'error'in result:raise RuntimeError(result['error'])
  return result['result']
 def close(self):
  if self.p.poll()is None:
   try:self.p.stdin.write('{"kind":"close"}\n');self.p.stdin.flush();self.p.wait(timeout=10)
   except Exception:self.p.terminate()
  self.log.close()

P=None

def main():
 global P
 P=core.read(RUN/'protocol.json');reg=core.read(RUN/'registration.json')
 if core.sha(RUN/'protocol.json')!=reg['protocolSHA256']:raise ValueError('Study protocol changed')
 if core.sha(ROOT/'work/pepe-finrl-mask-v3/registration.json')!=reg['originalV3RegistrationSHA256']:raise ValueError('Original registration changed')
 for path,digest in {**reg['sourceHashes'],**reg['dataHashes'],**reg['dependencyHashes'],**reg['parentHashes']}.items():
  if core.sha(ROOT/path)!=digest:raise ValueError('Registered input changed: '+path)
 state=core.read(RUN/'status.json');cp=core.read(RUN/'checkpoint.json');worker=None
 def publish(phase,**extra):
  state.update(status=phase,pid=os.getpid(),updatedAt=int(time.time()*1000),round=cp['round'],targetRounds=P['rounds'],protocol=P,history=cp['history'],realOrders=False,finalTest={'status':'locked','reason':'Repeated development calendar; no independent test opened'},**extra)
  core.atomic(RUN/'status.json',state);core.atomic(ROOT/'web/data/pepe-elite-study.json',state)
 def evaluate(j):
  nonlocal worker
  f=RUN/'results'/(j['key']+'.json')
  if f.exists():
   result=core.read(f);digest=hashlib.sha256(json.dumps(j,sort_keys=True,separators=(',',':')).encode()).hexdigest()
   if result['jobSHA256']!=digest or core.sha(ROOT/result['modelPath'])!=result['modelSHA256']:raise ValueError('Cached job/model mismatch')
   return result
  while not stopping()and not guard():
   v3=core.read(ROOT/'work/pepe-finrl-mask-v3/status.json')
   if core.capacity_ok(v3,runtime.available_memory_percent()):break
   if worker:worker.close();worker=None
   publish('waiting_resources',currentJob=j['key']);time.sleep(5)
  if stopping()or guard():return None
  if worker is None:worker=Worker()
  publish('running',currentJob=j['key'])
  result=worker.call(j);core.immutable(f,result)
  state['jobsCompleted']=len(list((RUN/'results').glob('*.json')));publish('running',currentJob=None)
  return result
 with (RUN/'coordinator.lock').open('a')as file:
  fcntl.flock(file,fcntl.LOCK_EX|fcntl.LOCK_NB)
  try:
   # Evaluate founding weights once before any child update; immutable baselines.
   for p in P['parents']:
    result=evaluate(job(p,0))
    if result is None:publish(guard()or'paused');return
    baseline=core.compact(result['audit']);pkey=str(p['id'])
    for field in ['pnlBRL','score','count','maxDD']:
     if abs(baseline[field]-p['expectedAudit'][field])>1e-6:raise ValueError('Founding audit differs from archived evidence: '+field)
    if pkey not in cp['baselines']:
     cp['baselines'][pkey]={**result,'audit':baseline}
     for pair in range(P['pairsPerParent']):
      for arm in ['control','protected']:cp['incumbents'][f'p{p["id"]}-s{pair}-{arm}']={**result,'audit':baseline}
     core.atomic(RUN/'checkpoint.json',cp)
   state['baselines']=cp['baselines'];publish('running',error=None)
   while cp['round']<P['rounds']and not stopping()and not guard():
    n=cp['round']+1;candidate_rows=[];frozen=[];incumbents=dict(cp['incumbents']);accepted_count=0
    for p in P['parents']:
     result=evaluate(job(p,n))
     if result is None:break
     if result['tensorSHA256']!=cp['baselines'][str(p['id'])]['tensorSHA256']or abs(result['score']-cp['baselines'][str(p['id'])]['score'])>1e-6:raise ValueError('Frozen parent audit drifted')
     frozen.append(result)
     for pair in range(P['pairsPerParent']):
      for arm in ['control','protected']:
       key=f'p{p["id"]}-s{pair}-{arm}';before=cp['incumbents'][key];result=evaluate(job(p,n,arm=arm,pair=pair,source=before))
       if result is None:break
       chosen,accepted=core.promote(arm,result,before);incumbents[key]={**chosen,'audit':core.compact(chosen['audit'])};accepted_count+=int(accepted and arm=='protected');candidate_rows.append(result)
      if stopping()or guard():break
     if stopping()or guard():break
    if len(candidate_rows)!=len(P['parents'])*P['pairsPerParent']*2:break
    # Deterministic paired R1 starts from identical tensors/optimizer, seeds and hyperparameters.
    if n==1:
     for parent in P['parents']:
      for pair in range(P['pairsPerParent']):
       a=[v for v in candidate_rows if v['parent']==parent['id']and v['pair']==pair]
       if len({x['tensorSHA256']for x in a})!=1:raise ValueError('Round-one paired updates diverged; comparison invalid')
    summary={'round':n,'candidates':core.summarize(candidate_rows),'controlCandidates':core.summarize([x for x in candidate_rows if x['arm']=='control']),'protectedCandidates':core.summarize([x for x in candidate_rows if x['arm']=='protected']),'controlAccepted':core.summarize([v for k,v in incumbents.items()if k.endswith('-control')]),'protectedAccepted':core.summarize([v for k,v in incumbents.items()if k.endswith('-protected')]),'protectedPromotions':accepted_count,'frozen':[{**v,'audit':core.compact(v['audit'])}for v in frozen],'pairedDeltas':[{'parent':p['id'],'pair':pair,'candidatePNLDelta':next(v['audit']['pnlBRL']for v in candidate_rows if v['parent']==p['id']and v['pair']==pair and v['arm']=='protected')-next(v['audit']['pnlBRL']for v in candidate_rows if v['parent']==p['id']and v['pair']==pair and v['arm']=='control')}for p in P['parents']for pair in range(P['pairsPerParent'])]}
    record=RUN/'rounds'/f'r{n:02}.json'
    if record.exists():
     if core.read(record)!=summary:raise ValueError('Interrupted round evidence conflict')
    else:core.immutable(record,summary)
    cp.update(round=n,incumbents=incumbents,history=[*cp['history'],summary]);core.atomic(RUN/'checkpoint.json',cp);publish('running')
   publish('complete'if cp['round']==P['rounds']else guard()or'paused',currentJob=None)
  except Exception as e:publish('error',error=str(e));raise
  finally:
   if worker:worker.close()
if __name__=='__main__':main()
