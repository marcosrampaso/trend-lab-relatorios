"""250 logical policies; seven causal fold states each; paired PBT research."""
import os
for k in ['OMP_NUM_THREADS','OPENBLAS_NUM_THREADS','MKL_NUM_THREADS']:os.environ[k]='1'
import importlib,concurrent.futures,subprocess,json,random,time,signal,statistics,shutil,fcntl,threading,re
c=importlib.import_module('night-core');R,B=c.ROOT,c.BASE;P=c.protocol();STOP=False

def stop(*_):
 global STOP;STOP=True
signal.signal(signal.SIGTERM,stop);signal.signal(signal.SIGINT,stop)
def control():return c.read(B/'control.json')
def memory():
 try:
  text=subprocess.check_output(['vm_stat'],text=True);page=int(re.search(r'page size of (\d+)',text)[1]);return sum(int(re.search(v+r':\s+(\d+)',text)[1])for v in ['Pages free','Pages inactive','Pages speculative'])*page/1024**2
 except Exception:return 2000
class Worker:
 def __init__(self,n):self.n=n;self.p=None
 def call(self,job):
  if self.p is None:
   self.log=(B/f'ppo-worker-{self.n}.log').open('a');self.p=subprocess.Popen([str(R/'.venv-rl/bin/python'),'-u','scripts/night-worker.py'],cwd=R,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=self.log,text=True,bufsize=1)
  self.p.stdin.write(json.dumps(job)+'\n');self.p.stdin.flush();line=self.p.stdout.readline()
  if not line:raise RuntimeError('PPO worker stopped; see lane log')
  out=json.loads(line)
  if 'error'in out:raise RuntimeError(out['error'])
  return out['result']
 def close(self):
  if self.p:
   if self.p.poll()is None:
    try:self.p.stdin.write('{"kind":"close"}\n');self.p.stdin.flush();self.p.wait(timeout=15)
    except Exception:self.p.terminate()
   self.log.close();self.p=None

def initialize():
 agents=[]
 for arm in P['arms']:
  for island in range(5):
   for member in range(25):
    seed=P['seed']+island*100003+member*997;rng=random.Random(seed)
    agents.append({'id':len(agents),'arm':arm,'island':island,'seed':seed,'hyperparameters':{k:rng.choice(v)for k,v in P['hyperparameters'].items()},'models':[None]*7,'incumbent':None,'fresh':[True]*7})
 return {'generation':0,'agents':agents,'history':[],'stagnation':0}
def run():
 c.verify();bench=c.read(B/'benchmarks.json');file=B/'ppo-checkpoint.json';cp=c.read(file)if file.exists()else initialize();workers=[Worker(i)for i in range(5)]
 def publish(phase,done=0,active=0,error=None):
  state={'phase':phase,'generation':cp['generation'],'targetGenerations':1000,'population':250,'jobsCompleted':done,'activeWorkers':active,'maximumWorkers':5,'threadsPerWorker':2,'history':cp['history'],'error':error,'pid':os.getpid(),'updatedAt':int(time.time()*1000),'realOrders':False};c.atomic(B/'ppo-status.json',state);c.atomic(R/'web/data/night-ppo.json',state)
 try:
  with(B/'ppo.lock').open('a')as lock:
   fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
   while cp['generation']<1000 and not STOP:
    low=shutil.disk_usage(B).free<5*1024**3 or memory()<1400
    if control()['desired']!='running'or low:
     if low:c.atomic(B/'control.json',{'desired':'paused','reason':'memory_or_disk'})
     publish('paused_resources'if low else'paused');time.sleep(2);continue
    g=cp['generation']+1;fold=(g-1)%7;evaluate=g%28==0 or g==1000;rows={};jobs=[]
    for a in cp['agents']:
     source=a['models'][fold];job={'key':f'g{g:04d}-a{a["id"]:03d}','agent':a['id'],'arm':a['arm'],'island':a['island'],'fold':fold,'generation':g,'seed':a['seed']+fold*101,'steps':1024,'hyperparameters':a['hyperparameters'],'sourcePath':source['modelPath']if source else None,'sourceSHA256':source['modelSHA256']if source else None,'foldModels':a['models'],'fresh':a['fresh'][fold],'evaluate':evaluate}
     out=B/'results'/(job['key']+'.json')
     if out.exists():rows[a['id']]=c.read(out)
     else:jobs.append(job)
    capacity=min(5,1 if control().get('mode')=='eco'else max(1,int((memory()-512)/500)));iterator=iter(jobs);pending={};publish('training',len(rows),capacity)
    with concurrent.futures.ThreadPoolExecutor(max_workers=capacity)as pool:
     while pending or jobs:
      for w in workers[:capacity]:
       if w.n not in pending and not STOP and control()['desired']=='running':
        j=next(iterator,None)
        if j:pending[w.n]=(pool.submit(w.call,j),j)
      jobs=[]
      if not pending:break
      completed=False
      for n,(future,j)in list(pending.items()):
       if not future.done():continue
       result=future.result();c.immutable(B/'results'/(j['key']+'.json'),result);rows[j['agent']]=result;pending.pop(n);completed=True;publish('training'if control()['desired']=='running'else'pausing',len(rows),len(pending))
      if not completed:time.sleep(.2)
      # Continue pulling until the iterator is exhausted; jobs list is just the loop sentinel.
      if pending:jobs=[True]
      elif len(rows)<250 and control()['desired']=='running'and not STOP:jobs=[True]
    if len(rows)!=250:
     for w in workers:w.close()
     continue
    for a in cp['agents']:
     r=rows[a['id']];a['models'][fold]={'modelPath':r['modelPath'],'modelSHA256':r['modelSHA256']};a['fresh'][fold]=False
     if evaluate:
      summary=c.temporal_summary(r['blocks'],bench);snapshot={**summary,'models':[dict(m)for m in a['models']],'resultPath':str((B/'results'/(r['key']+'.json')).relative_to(R)),'generation':g,'seed':a['seed'],'hyperparameters':a['hyperparameters']}
      if a['incumbent']is None or snapshot['score']>a['incumbent']['score']+1e-9:a['incumbent']=snapshot
    if evaluate:
     stats={}
     for arm in P['arms']:
      cohort=[c.temporal_summary(rows[a['id']]['blocks'],bench)for a in cp['agents']if a['arm']==arm];v=[r['meanMonthlyBRL']for r in cohort]
      stats[arm]={'meanMonthlyBRL':statistics.mean(v),'medianMonthlyBRL':statistics.median(v),'cashPolicies':sum(r['count']==0 for r in cohort),'bestScore':max(r['score']for r in cohort),'meanCDIBRL':statistics.mean(r['meanCDIBRL']for r in cohort),'meanWorstMonthlyBRL':statistics.mean(r['worstMonthlyBRL']for r in cohort)}
     cp['history'].append({'generation':g,'arms':stats,'selectionOnly':True});c.immutable(B/'generations'/f'g{g:04d}.json',cp['history'][-1])
     if g<1000:
      for arm in P['arms']:
       for island in range(5):
        group=sorted([a for a in cp['agents']if a['arm']==arm and a['island']==island],key=lambda a:(-a['incumbent']['score'],a['id']));rng=random.Random(P['seed']+g*7919+island);key=arm+str(island);previous=cp.setdefault('islandBest',{}).get(key);best=group[0]['incumbent']['score'];stale=cp.setdefault('islandStale',{}).get(key,0);stale=stale+1 if previous is not None and best<=previous+1e-9 else 0;cp['islandBest'][key]=best;cp['islandStale'][key]=stale;immigrants=2 if stale>=4 else 1
        for i,a in enumerate(group[-5:]):
         if i<immigrants:a['models']=[None]*7;a['fresh']=[True]*7
         else:
          parent=rng.choice(group[:5]);a['models']=[dict(m)for m in parent['incumbent']['models']];a['fresh']=[False]*7;a['hyperparameters']=dict(parent['incumbent']['hyperparameters'])
         k=rng.choice(list(P['hyperparameters']));a['hyperparameters'][k]=rng.choice(P['hyperparameters'][k])
    cp['generation']=g;c.atomic(file,cp);publish('training')
   if cp['generation']==1000:
    champions=[]
    for arm in P['arms']:
     for island in range(5):
      a=max((a for a in cp['agents']if a['arm']==arm and a['island']==island),key=lambda a:a['incumbent']['score']);champions.append({'arm':arm,'island':island,**a['incumbent']})
    c.immutable(B/'ppo-selection.json',{'selectedAfterGenerations':1000,'champions':champions,'validationUsedToSelect':False});publish('selection_complete')
   else:publish('paused')
 except Exception as e:publish('error',error=str(e));raise
 finally:
  for w in workers:w.close()
if __name__=='__main__':run()
