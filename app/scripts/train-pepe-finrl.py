"""One registered PPO seed; never opens final-test data."""
import argparse,hashlib,json,os,signal,time,traceback
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
os.environ.setdefault('MPLCONFIGDIR',str(ROOT/'work/finrl-cache/matplotlib'));os.environ.setdefault('XDG_CACHE_HOME',str(ROOT/'work/finrl-cache'));Path(os.environ['MPLCONFIGDIR']).mkdir(parents=True,exist_ok=True)
import numpy as np
import torch
from stable_baselines3.common.callbacks import BaseCallback
from stable_baselines3 import PPO
from pepe_finrl_env import PepeScalpEnv,finrl_agent,POLICY
p=argparse.ArgumentParser();p.add_argument('--seed',type=int,required=True);args=p.parse_args();seed=args.seed
RUN=ROOT/'work/pepe-finrl-v1';OUT=RUN/'seeds'/str(seed);OUT.mkdir(parents=True,exist_ok=True);started=time.monotonic();elapsed_before=0;stop_requested=False;history=[];checks=[];best=None;steps=0

def atomic(file,obj):
 file.parent.mkdir(parents=True,exist_ok=True);tmp=file.with_name(file.name+'.'+str(os.getpid())+'.tmp');tmp.write_text(json.dumps(obj,separators=(',',':')));tmp.replace(file)
def sha(file):return hashlib.sha256(file.read_bytes()).hexdigest()
def status(state,error=None):
 recent=train.episodes[-50:]if train is not None else[];atomic(OUT/'status.json',{'seed':seed,'pid':os.getpid(),'status':state,'steps':steps,'total':POLICY['totalTimestepsPerSeed'],'seconds':elapsed_before+time.monotonic()-started,'updatedAt':int(time.time()*1000),'history':history,'checks':checks,'best':best,'episodes':len(train.episodes)if train is not None else 0,'recentMeanPnlBRL':float(np.mean([e['pnlBRL']for e in recent]))if recent else None,'recentMeanReward':float(np.mean([e['reward']for e in recent]))if recent else None,'error':error,'realOrders':False})
def on_signal(*_):
 global stop_requested
 stop_requested=True
signal.signal(signal.SIGTERM,on_signal);signal.signal(signal.SIGINT,on_signal)
train=None;validation=None
try:
 registration=json.loads((RUN/'registration.json').read_text())
 if seed not in POLICY['seeds']:raise ValueError('Unregistered seed')
 for file,digest in {**registration['sourceHashes'],**registration['dependencies']['sourceHashes']}.items():
  if sha(ROOT/file)!=digest:raise ValueError('Registered source changed '+file)
 torch.set_num_threads(POLICY['threadsPerSeed']);torch.set_num_interop_threads(1)
 train=PepeScalpEnv('train');validation=PepeScalpEnv('validation')
 saved=json.loads((OUT/'status.json').read_text())if(OUT/'status.json').exists()else None
 if saved:
  elapsed_before=saved['seconds'];history=saved['history'];checks=saved['checks'];best=saved['best'];steps=saved['steps']
 status('initializing')
 model=finrl_agent()(train).get_model('ppo',policy='MlpPolicy',policy_kwargs={'net_arch':{'pi':POLICY['policyNetwork'],'vf':POLICY['policyNetwork']}},model_kwargs={**POLICY['ppo'],'device':'cpu'},seed=seed,verbose=0)
 if saved:
  file=OUT/'last-model.zip'
  if not file.exists():
   checkpoint=max(checks,key=lambda c:c['step']);file=ROOT/checkpoint['modelPath'];steps=checkpoint['step'];history=[h for h in history if h['steps']<=steps]
  model=PPO.load(file,env=train,device='cpu');steps=int(model.num_timesteps)
 def evaluate(step):
  global best
  status('validating');observation,_=validation.reset(seed=seed);done=False
  while not done:
   action,_=model.predict(observation,deterministic=True);observation,_,done,_,_=validation.step(action)
  r=validation.last_summary;score=r['pnlBRL']-POLICY['drawdownPenalty']*r['maxDD']*POLICY['capitalBRL'];file=OUT/f'model-{step}.zip';model.save(file);summary={k:v for k,v in r.items()if k!='trades'};record={'step':step,'pnlBRL':r['pnlBRL'],'maxDD':r['maxDD'],'count':r['count'],'score':score,'modelPath':str(file.relative_to(ROOT)),'modelSHA256':sha(file),'actions':r['actions'],'ignoredActions':r['ignoredActions']};checks.append(record);atomic(OUT/f'validation-{step}.json',summary)
  if best is None or score>best['score']+1e-10:best=record
  status('training')
 class Progress(BaseCallback):
  def _on_step(self):
   global steps
   steps=int(self.num_timesteps)
   if steps%2048==0:
    recent=train.episodes[-50:];history.append({'steps':steps,'seconds':elapsed_before+time.monotonic()-started,'meanPnlBRL':float(np.mean([e['pnlBRL']for e in recent]))if recent else None,'meanReward':float(np.mean([e['reward']for e in recent]))if recent else None});status('training')
   if steps%POLICY['validationEverySteps']==0 and steps<POLICY['totalTimestepsPerSeed']:evaluate(steps)
   return not stop_requested and elapsed_before+time.monotonic()-started<POLICY['maxSecondsPerSeed']
 if not checks:evaluate(0)
 remaining=POLICY['totalTimestepsPerSeed']-steps
 if remaining>0 and elapsed_before<POLICY['maxSecondsPerSeed']:model.learn(total_timesteps=remaining,callback=Progress(),progress_bar=False,reset_num_timesteps=not bool(saved))
 steps=int(model.num_timesteps)
 if not stop_requested and(checks[-1]['step']!=steps):evaluate(steps)
 model.save(OUT/'last-model.zip');status('stopped'if stop_requested else'complete'if steps>=POLICY['totalTimestepsPerSeed']else'time_limit')
except Exception as e:
 status('error',str(e));traceback.print_exc();raise
finally:
 if train is not None:train.close()
 if validation is not None:validation.close()
