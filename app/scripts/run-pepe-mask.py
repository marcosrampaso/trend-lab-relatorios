"""Local 250-agent masked PBT. Resumable jobs, write-once evidence, continuous audits."""
import concurrent.futures,importlib,os,json,signal,subprocess,sys,time,threading,shutil
from pathlib import Path
core=importlib.import_module('pepe-mask-core');ROOT,RUN,P=core.ROOT,core.RUN,core.P
os.chdir(ROOT);STOP=False;ACTIVE_LIMIT=None;LOCK=threading.Lock();WORKERS=[]
def stop(*_):
 global STOP;STOP=True
signal.signal(signal.SIGTERM,stop);signal.signal(signal.SIGINT,stop)
def control():return core.read(RUN/'control.json')
def paused():return STOP or control()['desired']!='running'
def guard():
 if ACTIVE_LIMIT is not None and time.monotonic()>=ACTIVE_LIMIT:return'paused_budget'
 if shutil.disk_usage(ROOT).free<P['minimumFreeGiB']*1024**3:return'paused_disk'
 return None
class Worker:
 def __init__(self,n):
  self.n=n;self.log=(RUN/f'worker-{n}.log').open('a');self.p=subprocess.Popen([str(ROOT/'.venv-rl/bin/python'),'scripts/pepe-mask-worker.py'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=self.log,text=True,bufsize=1,env={**os.environ,'OMP_NUM_THREADS':'2','OPENBLAS_NUM_THREADS':'2'})
 def call(self,job):
  self.p.stdin.write(json.dumps(job)+'\n');self.p.stdin.flush();line=self.p.stdout.readline()
  if not line:raise RuntimeError('Masked worker stopped; see worker log')
  value=json.loads(line)
  if 'error'in value:raise RuntimeError(value['error'])
  return value['result']
 def close(self):
  if self.p.poll()is None:
   try:self.p.stdin.write('{"kind":"close"}\n');self.p.stdin.flush();self.p.wait(timeout=10)
   except Exception:self.p.terminate()
  self.log.close()
def verify():
 reg=core.read(RUN/'registration.json')
 for f,d in{**reg['sourceHashes'],**reg['dataHashes'],**reg['dependencyHashes']}.items():
  if core.sha(ROOT/f)!=d:raise ValueError('Frozen V3 source/input changed: '+f)
def publish(state):
 for field,target,phase in [('bestAudit','auditEvidence','audit'),('bestProbe','probeEvidence','probe')]:
  if state.get(field):
   evidence=core.read(ROOT/state[field]['archive']['evaluationPath']);state[target]={'generation':evidence['generation'],'id':evidence['id'],'window':evidence.get('window')if phase=='probe'else{'start':1727740800000,'end':1735689600000},'summary':evidence[phase],'archive':state[field]['archive']}
 state.update(app='trend-lab-pepe-masked-v3',version=P['version'],pid=os.getpid(),updatedAt=int(time.time()*1000),realOrders=False,control=control(),protocol=P)
 core.atomic(RUN/'status.json',state);core.atomic(ROOT/'web/data/pepe-mask.json',state)
def lanes(jobs,callback):
 queue=iter(jobs)
 def lane(worker):
  while True:
   with LOCK:
    if paused()or guard():return
    if worker.n>=(P['workers']if control()['mode']=='boost'else P['ecoWorkers']):return
    job=next(queue,None)
   if job is None:return
   value=worker.call(job)
   with LOCK:callback(value,job,worker)
 with concurrent.futures.ThreadPoolExecutor(max_workers=len(WORKERS))as pool:
  futures=[pool.submit(lane,w)for w in WORKERS]
  for f in concurrent.futures.as_completed(futures):f.result()
def scan():
 inv=core.read(RUN/'parent-inventory.json');folder=RUN/'parent-scan';folder.mkdir(exist_ok=True);results=[]
 for f in sorted(folder.glob('candidate-*.json')):results.append(core.read(f))
 done={r['id']for r in results};best=core.rank(results,active=True);best=best[0]if best else None
 state={'status':'scanning_parents','generation':0,'scanTotal':inv['uniqueFiles'],'scanCompleted':len(results),'scanNominal':inv['nominalFiles'],'scanRanking':[core.compact_result(r)for r in core.rank(results)[:20]],'history':[],'finalTest':{'status':'locked','reason':'No new prospective calendar registered; old final test consumed'}}
 def accept(r,job,worker):
  nonlocal best
  if r['sourceSHA256']!=job['sourceSHA256']:raise ValueError('Historical input changed during scan')
  core.immutable_json(folder/f'candidate-{job["scanIndex"]:04}.json',r);results.append(r)
  if r['audit']['count']>0 and(best is None or core.rank([best,r],active=True)[0]is r):
   converted=ROOT/job['saveConverted'];a=core.archive(r,'parent-scan-record',converted);best={**r,'archive':a};core.atomic(folder/'best-active.json',best)
  state.update(scanCompleted=len(results),scanRanking=[core.compact_result(x)for x in core.rank(results)[:20]],bestActive=core.compact_result(best)if best else None);publish(state)
 jobs=[{**r,'kind':'scan','scanIndex':i,'generation':0,'saveConverted':f'work/pepe-finrl-mask-v3/converted/scan-{i:04}.zip'}for i,r in enumerate(inv['candidates'])if r['id']not in done]
 publish(state);lanes(jobs,accept)
 if len(results)<inv['uniqueFiles']:state['status']='paused';publish(state);return False
 best=core.rank(results,active=True)[0]if core.rank(results,active=True)else core.rank(results)[0]
 # Convert selected source once more if its transient conversion was intentionally removed.
 converted=RUN/'converted'/f"scan-{next(i for i,a in enumerate(inv['candidates'])if a['id']==best['id']):04}.zip"
 a=core.archive(best,'initial-parent',converted);selection={'selectedAt':int(time.time()*1000),'candidate':best['id'],'archive':a,'audit':best['audit'],'source':best['source'],'sourceSHA256':best['sourceSHA256'],'transfer':best['transfer'],'criterion':inv['criterion'],'cashBaselineScore':0,'activeCandidates':len([r for r in results if r['audit']['count']>0]),'evaluated':len(results),'nominalFiles':inv['nominalFiles'],'profitable':best['audit']['pnlBRL']>0,'beatsCashScore':best['score']>0,'selectionUsesTest':False,'noIndependentProfitProof':True}
 core.immutable_json(RUN/'parent-selection.json',selection);return True

def initialize():
 if(RUN/'checkpoint.json').exists():return
 chosen=core.read(RUN/'parent-selection.json');parent=chosen['archive']['modelPath'];agents=[]
 import random;rng=random.Random(P['globalSeed'])
 for i in range(P['population']):
  path=f'work/pepe-finrl-mask-v3/population/agent-{i:03}.zip';Path(ROOT/path).parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(ROOT/parent,ROOT/path)
  agents.append({'id':i,'age':0,'seed':P['globalSeed']+i*997,'modelPath':path,'hyperparameters':chosen['archive']['hyperparameters']if i==0 else core.hp(rng),'parent':chosen['candidate'],'bornGeneration':0})
 core.atomic(RUN/'checkpoint.json',{'generation':0,'agents':agents,'history':[],'trainingSteps':0,'activeSeconds':0,'bestAudit':None,'bestProbe':None,'stagnation':0})

def train():
 global ACTIVE_LIMIT
 initialize();cp=core.read(RUN/'checkpoint.json');started=time.monotonic();initial=cp['activeSeconds'];error=None
 ACTIVE_LIMIT=started+max(0,P['maxWallHours']*3600-initial)
 def seconds():return initial+time.monotonic()-started
 state={'status':'training','generation':cp['generation'],'population':P['population'],'history':cp['history'],'parent':core.read(RUN/'parent-selection.json'),'finalTest':{'status':'locked','reason':'New prospective period not yet registered; no V3 test PNL exists'}}
 def update():
  state.update(generation=cp['generation'],history=cp['history'],bestAudit=cp['bestAudit'],bestProbe=cp['bestProbe'],trainingSteps=cp['trainingSteps'],activeSeconds=seconds());publish(state)
 while cp['generation']<P['generations']and not paused()and not guard()and seconds()<P['maxWallHours']*3600:
  g=cp['generation']+1;folder=RUN/'generations'/f'g{g}';folder.mkdir(parents=True,exist_ok=True);results=[core.read(f)for f in folder.glob('agent-*.json')];done={r['id']for r in results};probe_window=core.window(g);state.update(status='training',currentGeneration=g,jobsCompleted=len(results),probeWindow=probe_window);update()
  def records(r):
   # Each trained receipt retains the exact pre-inheritance model for crash recovery.
   snapshot=RUN/'receipts'/f"g{g}-a{r['id']}.zip"
   for kind,field,metric in [('audit','bestAudit',r['score']),('probe','bestProbe',r['probe']['pnlBRL'])]:
    previous=cp[field];old=previous['metric']if previous else float('-inf')
    if metric>old+1e-9:
     a=core.archive(r,kind+'-record',snapshot);cp[field]={'metric':metric,'result':core.compact_result(r),'archive':a}
  for completed in results:records(completed)
  def accept(r,job,worker):
   r.update(parent=job['parent'],window=probe_window);core.immutable_json(folder/f'agent-{r["id"]:03}.json',r);results.append(r);records(r)
   state['jobsCompleted']=len(results);state['ranking']=[core.compact_result(x)for x in core.rank(results)[:15]];update()
  jobs=[{**a,'kind':'train','generation':g,'window':probe_window}for a in cp['agents']if a['id']not in done]
  lanes(jobs,accept)
  if len(results)!=P['population']:break
  ranked=core.rank(results);best=ranked[0];previous=cp['history'][-1]['bestAuditScoreEver']if cp['history']else float('-inf');cp['stagnation']=0 if best['score']>previous+1e-9 else cp['stagnation']+1
  planfile=folder/'evolution.json'
  if planfile.exists():plan=core.read(planfile)
  else:
   plan=core.plan_evolution(cp['agents'],results,g,cp['stagnation']);paths={}
   for parent_id in{c['parent']for c in plan['changes']if not c['fresh']}:
    row=next(r for r in results if r['id']==parent_id);paths[parent_id]=core.archive(row,'breeding-parent',RUN/'receipts'/f"g{g}-a{parent_id}.zip")['modelPath']
   for change in plan['changes']:change['parentPath']=paths.get(change['parent'])
   plan.pop('parents');core.immutable_json(planfile,plan)
  changes={c['id']:c for c in plan['changes']};agents=[]
  for a in cp['agents']:
   c=changes.get(a['id'])
   if c:
    target=ROOT/a['modelPath']
    if c['fresh']:target.unlink(missing_ok=True)
    else:
     tmp=target.with_name(target.name+'.inherit.tmp');shutil.copyfile(ROOT/c['parentPath'],tmp);tmp.replace(target)
    a={**a,'age':0,'seed':P['globalSeed']+g*100003+a['id']*997,'hyperparameters':c['hyperparameters'],'parent':c['parentPath'],'bornGeneration':g}
   else:a={**a,'age':a['age']+1}
   agents.append(a)
  # Completed per-agent evidence + immutable evolution plan makes interrupted commit replay safe.
  cp['agents']=agents;cp['generation']=g;cp['trainingSteps']+=sum(r['trainingSteps']for r in results);cp['history'].append({'generation':g,'bestAuditScore':best['score'],'bestAuditBRL':best['audit']['pnlBRL'],'bestAuditScoreEver':cp['bestAudit']['metric'],'meanAuditBRL':sum(r['audit']['pnlBRL']for r in results)/len(results),'bestProbeBRL':max(r['probe']['pnlBRL']for r in results),'probeWindow':probe_window,'replacements':len(changes),'immigrants':plan['immigrants']});cp['activeSeconds']=seconds();core.atomic(RUN/'checkpoint.json',cp);state['jobsCompleted']=0;update()
 cp['activeSeconds']=seconds();core.atomic(RUN/'checkpoint.json',cp);state['status']='complete_training_final_locked'if cp['generation']==P['generations']else guard()or('paused_budget'if seconds()>=P['maxWallHours']*3600 else'paused');update()

def main():
 verify()
 for i in range(P['workers']):WORKERS.append(Worker(i))
 try:
  if not(RUN/'parent-selection.json').exists():
   if not scan():return
  if not paused():train()
 except Exception as error:
  previous=core.read(RUN/'status.json')if(RUN/'status.json').exists()else{};publish({**previous,'status':'error','error':str(error)});raise
 finally:
  for w in WORKERS:w.close()
if __name__=='__main__':main()
