"""Small V4 stage: 25 children, 20 generations, frozen champions and receipts."""
import importlib,threading,signal,os,subprocess,json,time,fcntl,shutil,hashlib
core=importlib.import_module('pepe-v4-core');runtime=importlib.import_module('run-pepe-mask-ultra')
ROOT,RUN=core.ROOT,core.RUN;STOP=False;LOCK=threading.Lock();WORKERS=[];P=None

def stop(*_):
 global STOP;STOP=True
signal.signal(signal.SIGTERM,stop);signal.signal(signal.SIGINT,stop)
def paused():return STOP or core.read(RUN/'control.json')['desired']!='running'
def guard():return 'paused_disk'if shutil.disk_usage(ROOT).free<10*1024**3 else None

def capacity():
 config={'profiles':{'eco':{'workers':1},'boost':{'workers':3},'ultra':{'workers':5}},'maximumWorkers':5,'threadsPerWorker':2,'memorySoftPercent':20,'memoryCriticalPercent':12};mem=runtime.available_memory_percent();r=runtime.effective_capacity(core.read(RUN/'control.json'),config,int(time.time()*1000),mem)
 if mem is None:r['workers']=min(3,r['workers'])
 r['version']='pepe-v4-v1';r['adapterActive']=True;r['profiles']=config['profiles'];return r

class Worker:
 def __init__(self,n):self.n=n;self.p=None;self.log=None
 def call(self,j):
  if self.p is None:
   self.log=(RUN/f'worker-{self.n}.log').open('a');self.p=subprocess.Popen([str(ROOT/'.venv-rl/bin/python'),'scripts/pepe-v4-worker.py'],cwd=ROOT,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=self.log,text=True,bufsize=1,env={**os.environ,'OMP_NUM_THREADS':'2','OPENBLAS_NUM_THREADS':'2'})
  self.p.stdin.write(json.dumps(j)+'\n');self.p.stdin.flush();line=self.p.stdout.readline()
  if not line:raise RuntimeError('V4 worker stopped')
  r=json.loads(line)
  if 'error'in r:raise RuntimeError(r['error'])
  return r['result']
 def close(self):
  if self.p is not None:
   if self.p.poll()is None:
    try:self.p.stdin.write('{"kind":"close"}\n');self.p.stdin.flush();self.p.wait(timeout=10)
    except Exception:self.p.terminate()
   self.p=None;self.log.close()

def makejob(key,source,*,g=0,id=None,params=None,diagnostic=False):
 return {'key':key,'kind':'train'if id is not None else'frozen','round':g,'parent':'V3-selected'if g==0 else source['modelSHA256'],'pair':id,'arm':'protected'if id is not None else None,'sourcePath':source['modelPath'],'sourceSHA256':source['modelSHA256'],'seed':P['seed']+(id or 0)*997+g*104729,'steps':P['stepsPerGeneration']if id is not None else 0,'hyperparameters':params or P['founder']['hyperparameters'],'diagnostic':diagnostic}

def main():
 global P
 P=core.read(RUN/'protocol.json');reg=core.read(RUN/'registration.json')
 if core.sha(RUN/'protocol.json')!=reg['protocolSHA256']:raise ValueError('V4 protocol changed')
 for p,h in {**reg['sourceHashes'],**reg['dataHashes'],**reg['dependencyHashes'],**reg['parentHashes']}.items():
  if core.sha(ROOT/p)!=h:raise ValueError('Frozen V4 input changed: '+p)
 cp=core.read(RUN/'checkpoint.json');state=core.read(RUN/'status.json')
 def publish(status,**extra):
  best=cp.get('best');state.update(app='trend-lab-pepe-v4',status=status,pid=os.getpid(),updatedAt=int(time.time()*1000),generation=cp['generation'],currentGeneration=cp['generation']+1,population=P['population'],history=cp['history'],best=best,baseline=cp.get('baseline'),trainDiagnostic=cp.get('trainDiagnostic'),executionRuntime=capacity(),protocol=P,finalTest={'status':'locked','reason':'V3 September final is consumed and forbidden in V4; register a new future period after selection'},realOrders=False,**extra)
  core.atomic(RUN/'status.json',state);core.atomic(ROOT/'web/data/pepe-v4.json',state)
 def result(j,w):
  f=RUN/'results'/(j['key']+'.json');digest=hashlib.sha256(json.dumps(j,sort_keys=True,separators=(',',':')).encode()).hexdigest()
  if f.exists():
   r=core.read(f)
   if r['jobSHA256']!=digest or core.sha(ROOT/r['modelPath'])!=r['modelSHA256']:raise ValueError('Cached candidate mismatch')
   return r
  r=w.call(j);core.immutable(f,r);return r
 def small(r):return{**r,'blocks':[{**b,'summary':core.compact(b['summary'])}for b in r['blocks']],'audit':core.compact(r['audit'])}
 with (RUN/'coordinator.lock').open('a')as file:
  fcntl.flock(file,fcntl.LOCK_EX|fcntl.LOCK_NB);WORKERS.extend(Worker(n)for n in range(5))
  try:
   if paused():return
   publish('training',phase='auditing_founder',jobsCompleted=0,error=None)
   if cp['baseline']is None:
    r=result(makejob('founder-development',P['founder']),WORKERS[0]);cp['baseline']=small(r);cp['best']=small(r);core.atomic(RUN/'checkpoint.json',cp)
   if cp['trainDiagnostic']is None:
    r=result(makejob('founder-train-diagnostic',P['founder'],diagnostic=True),WORKERS[0]);cp['trainDiagnostic']=small(r);core.atomic(RUN/'checkpoint.json',cp)
   if not cp['agents']:
    cp['agents']=[{'id':i,'hyperparameters':{**P['founder']['hyperparameters'],'learning_rate':P['learningRates'][i%len(P['learningRates'])]},'incumbent':cp['baseline'],'parentGeneration':0}for i in range(P['population'])];core.atomic(RUN/'checkpoint.json',cp)
   publish('training',phase='children',jobsCompleted=0)
   while cp['generation']<P['generations']and not paused()and not guard():
    g=cp['generation']+1;rows=[];state['jobsCompleted']=0
    # Founder always stays outside learn(); verify exact weights at each generation.
    if core.sha(ROOT/P['founder']['modelPath'])!=P['founder']['modelSHA256']:raise ValueError('Frozen founder changed')
    jobs=[makejob(f'g{g:03}-a{a["id"]:02}',a['incumbent'],g=g,id=a['id'],params=a['hyperparameters'])for a in cp['agents']]
    def accept(r,j,w):
     rows.append(r);state['jobsCompleted']=len(rows);publish('training',phase='children')
    def calljob(j,w):return result(j,w)
    class Slot:
     def __init__(self,w):self.n=w.n;self.w=w
     def call(self,j):return calljob(j,self.w)
     def close(self):self.w.close()
    runtime.dispatch(jobs,accept,[Slot(w)for w in WORKERS],lock=LOCK,capacity=lambda:capacity()['workers'],paused=paused,guard=guard)
    if len(rows)!=P['population']:break
    by={r['pair']:r for r in rows};agents=[];promotions=0
    for a in cp['agents']:
     candidate=small(by[a['id']]);chosen,adopted=core.promote(candidate,a['incumbent']);promotions+=int(adopted);agents.append({**a,'incumbent':chosen})
     if chosen['score']>cp['best']['score']+1e-8:
      cp['best']=chosen;archive=RUN/'champions'/f'g{g:03}-a{a["id"]:02}.json'
      if archive.exists():
       if core.read(archive)!=chosen:raise ValueError('Champion archive conflict')
      else:core.immutable(archive,chosen)
    candidates=[r['audit']for r in rows];accepted=[a['incumbent']['audit']for a in agents]
    summary={'generation':g,'rawMeanPNL':sum(a['pnlBRL']for a in candidates)/len(candidates),'rawMedianPNL':__import__('statistics').median(a['pnlBRL']for a in candidates),'rawMeanScore':sum(a['score']for a in candidates)/len(candidates),'acceptedMeanPNL':sum(a['pnlBRL']for a in accepted)/len(accepted),'bestScore':cp['best']['score'],'bestMeanPNL':cp['best']['audit']['pnlBRL'],'positiveCandidates':sum(a['pnlBRL']>0 for a in candidates),'cashCandidates':sum(a['count']==0 for a in candidates),'promotions':promotions,'bestModelSHA256':cp['best']['modelSHA256']}
    agents,events=core.evolve(agents,cp['best'],g,P);record={'summary':summary,'reproduction':events}
    out=RUN/'generations'/f'g{g:03}.json'
    if out.exists():
     if core.read(out)!=record:raise ValueError('Generation replay conflict')
    else:core.immutable(out,record)
    cp.update(generation=g,agents=agents,history=[*cp['history'],summary]);core.atomic(RUN/'checkpoint.json',cp);publish('training',phase='children',jobsCompleted=0)
   publish('pilot_complete'if cp['generation']==P['generations']else guard()or'paused',phase='closed'if cp['generation']==P['generations']else'children')
  except Exception as e:publish('error',error=str(e));raise
  finally:
   for w in WORKERS:w.close()
if __name__=='__main__':main()
