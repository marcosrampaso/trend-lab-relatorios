"""Bounded serial optimizer replication. Never selects a winning seed."""
import datetime,hashlib,json,os,signal,subprocess,time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];os.chdir(ROOT)
RUN=ROOT/'work/genetic-validation-v6/stability';RUN.mkdir(parents=True,exist_ok=True)
def read(p):return json.loads(Path(p).read_text())
def atomic(p,value):
 p=Path(p);tmp=p.with_suffix('.tmp');tmp.write_text(json.dumps(value,ensure_ascii=False));tmp.replace(p)
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
registration=read(RUN/'registration.json');deadline=datetime.datetime.fromisoformat(registration['deadlineAt']).timestamp()
child=None;stop=False
statuses=[]
def shutdown(sig,frame):
 global stop
 stop=True
 if child and child.poll() is None:child.terminate()
for sig in [signal.SIGTERM,signal.SIGINT]:signal.signal(sig,shutdown)
def publish(stage,replica=None,error=None):
 global statuses
 statuses=[]
 for i in [1,2,3]:
  path=RUN/f'replica-{i}/status.json'
  statuses.append({'replica':i,**(read(path) if path.exists() else {'stage':'pending'})})
 atomic(RUN/'status.json',{'stage':stage,'updatedAt':now(),'pid':os.getpid(),'deadlineAt':registration['deadlineAt'],'replica':replica,'replicas':statuses,'error':error,'realOrders':False,'purpose':'stability_audit','selectBestSeed':False})
try:
 # Register every seed before calculating any result of the new study.
 for i in [1,2,3]:subprocess.run(['node','scripts/run-genetic-stability-v6.mjs',f'--replica={i}','--register-only'],check=True)
 for i in [1,2,3]:
  if stop or time.time()>=deadline:break
  child=subprocess.Popen(['node','scripts/run-genetic-stability-v6.mjs',f'--replica={i}'])
  while child.poll() is None:
   publish('running',i)
   if stop or time.time()>=deadline:child.terminate()
   try:child.wait(timeout=10)
   except subprocess.TimeoutExpired:pass
  if child.returncode:raise RuntimeError(f'Réplica {i} encerrou com código {child.returncode}')
 complete=all((RUN/f'replica-{i}/status.json').exists() and read(RUN/f'replica-{i}/status.json')['stage']=='complete' for i in [1,2,3])
 publish('complete' if complete else 'stopped')
except Exception as e:
 publish('failed',error=str(e));raise
