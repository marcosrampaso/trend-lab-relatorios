"""Operational Ultra adapter. Same six workers/checkpoints/scientific registration.
Original coordinator remains immutable; only dispatch capacity and telemetry change.
Activated only after the explicit Ultra request and a clean checkpoint drain.
"""
import importlib,os,sys,time,subprocess,shutil,signal,statistics,json
runtime=importlib.import_module('exit-runtime')
c=importlib.import_module('pepe-elite-core');ROOT=c.ROOT;RUN=ROOT/'work/pepe-exits-v1';P=c.read(RUN/'protocol.json');reg=c.read(RUN/'registration.json');children={};logs=[];stopping=False
def stop(*_):
 global stopping
 stopping=True;c.atomic(RUN/'control.json',{**c.read(RUN/'control.json'),'desired':'paused','updatedAt':int(time.time()*1000)})
signal.signal(signal.SIGTERM,stop);signal.signal(signal.SIGINT,stop)
def verify():
 if c.sha(RUN/'protocol.json')!=reg['protocolSHA256']:raise ValueError('Protocol changed')
 for group in ['sourceHashes','dataHashes','dependencyHashes','parentHashes']:
  for path,digest in reg[group].items():
   if c.sha(ROOT/path)!=digest:raise ValueError('Registered input changed: '+path)
def states():
 return{f'{a}-{s}':c.read(RUN/'runs'/f'{a}-{s}'/'state.json')if(RUN/'runs'/f'{a}-{s}'/'state.json').exists()else{'key':f'{a}-{s}','arm':a,'seed':s,'steps':0,'status':'pending'}for a in P['trainingRewardArms']for s in P['seeds']}
def publish(status,**extra):
 rows=states();control=c.read(RUN/'control.json');out={'app':'trend-lab-exit-lab','status':status,'phase':status,'protocol':P,'runs':rows,'completedSteps':sum(r['steps']for r in rows.values()),'totalSteps':6*P['trainingStepsPerRun'],'activeWorkers':len(children),'executionRuntime':runtime.capacity(control,memory=runtime.memory_percent()),'control':control,'updatedAt':int(time.time()*1000),'registeredAt':reg['registeredAt'],'realOrders':False,**extra};c.atomic(RUN/'status.json',out);c.atomic(ROOT/'web/data/exit-lab.json',out)
def capacity():
 return runtime.capacity(c.read(RUN/'control.json'),memory=runtime.memory_percent())['workers']
lock=RUN/'coordinator.lock'
try:
 fd=os.open(lock,os.O_CREAT|os.O_EXCL|os.O_WRONLY);os.write(fd,str(os.getpid()).encode());os.close(fd)
except FileExistsError:raise SystemExit('Coordinator lock exists; verify process before recovery')
try:
 verify()
 if not(RUN/'controls.json').exists():
  publish('controls');subprocess.run(['node','scripts/run-exit-controls.mjs'],cwd=ROOT,check=True)
 if not c.read(RUN/'controls.json')['parityPassed']:raise ValueError('Controls parity failed')
 while True:
  control=c.read(RUN/'control.json');rows=states()
  for key,process in list(children.items()):
   if process.poll()is not None:
    if process.returncode:raise RuntimeError('Worker failed: '+key)
    del children[key]
  if any(r['status']=='error'for r in rows.values()):raise RuntimeError('A run needs inspection; see its log')
  if all(r['status']=='complete'for r in rows.values()):
   verify();final={a:{'seeds':P['seeds'],'meanMonthlyBRL':statistics.mean(rows[f'{a}-{s}']['evaluations'][-1]['meanMonthlyBRL']for s in P['seeds']),'meanPairedDeltaBRL':statistics.mean(rows[f'{a}-{s}']['evaluations'][-1]['meanDeltaBRL']for s in P['seeds'])}for a in P['trainingRewardArms']};c.immutable(RUN/'completion.json',{'completedAt':int(time.time()*1000),'arms':final,'independentFinalTest':False,'realOrders':False});publish('complete',comparison=final);break
  if control['desired']!='running'and not children:publish('paused');break
  if shutil.disk_usage(ROOT).free<10*1024**3:stop();publish('disk_guard')
  if control['desired']=='running'and not stopping:
   for key,row in rows.items():
    if len(children)>=capacity():break
    if key in children or row['status']=='complete':continue
    log=(RUN/'runs'/key/'worker.log');log.parent.mkdir(parents=True,exist_ok=True);handle=log.open('a');logs.append(handle);children[key]=subprocess.Popen([str(ROOT/'.venv-rl/bin/python'),'scripts/exit-lab-runtime-worker.py',row['arm'],str(row['seed'])],cwd=ROOT,stdout=handle,stderr=handle)
  publish('training'if control['desired']=='running'else'pausing');time.sleep(2)
except Exception as e:
 stop();publish('error',error=f'{type(e).__name__}: {e}');raise
finally:
 for process in children.values():
  if process.poll()is None:
   try:process.wait(timeout=300)
   except subprocess.TimeoutExpired:process.terminate()
 for log in logs:log.close()
 lock.unlink(missing_ok=True)
