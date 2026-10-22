"""Sequential local chain; no chat tokens and no real orders."""
import importlib,os,shutil,json,subprocess,time,threading,signal,fcntl
c=importlib.import_module('night-core');R,B=c.ROOT,c.BASE;P=c.protocol();STOP=False;children=[]
def stop(*_):
 global STOP;STOP=True;c.atomic(B/'control.json',{**c.read(B/'control.json'),'desired':'paused'})
signal.signal(signal.SIGTERM,stop);signal.signal(signal.SIGINT,stop)
def paused():return STOP or c.read(B/'control.json')['desired']!='running'
def publish(phase,**v):c.publish({'phase':phase,'queue':P['queue'],'pid':os.getpid(),'maxWallHours':None,**v})
def wait_ready():
 while not STOP and paused():time.sleep(2)
 return not STOP
def launch(args,name,wait=True):
 with(B/(name+'.log')).open('a')as log:child=subprocess.Popen(args,cwd=R,stdin=subprocess.DEVNULL,stdout=log,stderr=log,start_new_session=True)
 children.append(child);c.atomic(B/(name+'-service.json'),{'pid':child.pid,'startedAt':int(time.time()*1000),'args':args,'maxWallHours':None})
 if wait:
  ticks=0
  while child.poll()is None:
   time.sleep(2);ticks+=1
   if name=='genetic200'and ticks%8==0:
    v=c.read(R/P['source200']/'status.json')if(R/P['source200']/'status.json').exists()else{}
    publish('genetic_200',sourceGenerations=v.get('completedGenerations'),sourcePhase=v.get('phase'))
    subprocess.run(['node','scripts/export-genetic-replay.mjs','200'],cwd=R,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
   if STOP:child.terminate()
  if child.returncode:raise RuntimeError(name+' failed; see '+name+'.log')
 return child

def prepare_continuation():
 target=R/P['source200'];old=R/P['source100']
 if(target/'checkpoint.json').exists():return
 cp=c.read(old/'checkpoint.json')
 if cp['completedGenerations']!=100 or not cp.get('audit'):raise ValueError('Need original100 and original audit')
 if c.sha(target/'protocol.json')!=c.read(target/'registration.json')['protocolSHA256']:raise ValueError('Continuation protocol changed')
 for d in ['candidates','fits','wallet-cache']:
  for f in(old/d).glob('*.json'):
   to=target/d/f.name
   if not to.exists():os.link(f,to)
 from payoff_genetic_core import identity,evolve
 records={identity(a['genome']):c.read(target/'candidates'/(identity(a['genome'])+'.json'))for a in cp['population']}
 cp['population'],cp['operators']=evolve(cp['population'],records,c.read(old/'protocol.json')['seed'],100,cp['stagnation']);cp.pop('audit',None);cp['completedMembers']=0
 c.immutable(target/'continuation-origin.json',{'sourceCheckpointSHA256':c.sha(old/'checkpoint.json'),'sourceCompletedGenerations':100,'auditCopiedIntoFitness':False,'registeredAdditionalGenerations':100});c.atomic(target/'checkpoint.json',cp);c.atomic(target/'control.json',{'desired':'running'})

def main():
 c.verify();server=importlib.import_module('night-control').serve();threading.Thread(target=server.serve_forever,daemon=True).start()
 with(B/'chain.lock').open('a')as lock:
  fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
  try:
   while not STOP:
    source=c.read(R/P['source100']/'status.json');publish('waiting_100',sourceGenerations=source.get('completedGenerations'),sourcePhase=source['phase'])
    if source['phase']=='error':raise RuntimeError('Original100 failed: '+str(source.get('error')))
    if source['phase']=='complete':break
    subprocess.run(['node','scripts/export-genetic-replay.mjs'],cwd=R,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);time.sleep(15)
   if not wait_ready():return
   prepare_continuation();target=R/P['source200'];status=c.read(target/'status.json')if(target/'status.json').exists()else{}
   if status.get('phase')!='complete':publish('genetic_200');launch([str(R/'.venv-rl/bin/python'),'-u','scripts/run-payoff200.py'],'genetic200')
   if not wait_ready():return
   launch(['node','scripts/night-benchmarks.mjs'],'benchmarks');publish('preparing_context');launch([str(R/'.venv-rl/bin/python'),'-u','scripts/night-context.py'],'context')
   if not wait_ready():return
   launch([str(R/'.venv-rl/bin/python'),'-u','scripts/night-smoke.py'],'context-smoke');publish('expanded_audit');launch(['node','scripts/night-audit.mjs'],'expanded-audit')
   launch(['node','scripts/export-genetic-replay.mjs','200'],'replay')
   if not wait_ready():return
   publish('ppo_and_paper',sourceGenerations=200)
   paper=launch(['node','scripts/night-paper.mjs'],'paper',False)
   while not STOP:
    ppo=launch([str(R/'.venv-rl/bin/python'),'-u','scripts/run-night-ppo.py'],'ppo',False)
    while ppo.poll()is None and not STOP:
     time.sleep(5)
     ps=c.read(B/'ppo-status.json')if(B/'ppo-status.json').exists()else{}
     publish('ppo_and_paper',ppoGeneration=ps.get('generation',0),ppoPhase=ps.get('phase'),paperPID=paper.pid)
     if paper.poll()is not None:raise RuntimeError('Paper monitor exited; offline errors should be reported without exiting')
    if STOP:ppo.terminate();break
    if ppo.returncode:raise RuntimeError('PPO coordinator failed; see ppo.log')
    break
   if not STOP and(B/'ppo-selection.json').exists():
    publish('ppo_final_audit');launch([str(R/'.venv-rl/bin/python'),'-u','scripts/night-final.py'],'ppo-final')
    publish('ppo_complete_paper_monitoring')
    while not STOP:time.sleep(5)
  except Exception as e:publish('error',error=str(e));raise
  finally:
   for child in children:
    if child.poll()is None:child.terminate()
   server.shutdown();server.server_close()
if __name__=='__main__':main()
