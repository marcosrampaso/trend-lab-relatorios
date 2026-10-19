"""Persistent CPU worker: one PPO model at a time, no final-test access."""
import contextlib,hashlib,json,os,sys,time,traceback
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
os.environ.setdefault('MPLCONFIGDIR',str(ROOT/'work/finrl-cache/matplotlib'));os.environ.setdefault('XDG_CACHE_HOME',str(ROOT/'work/finrl-cache'));Path(os.environ['MPLCONFIGDIR']).mkdir(parents=True,exist_ok=True)
import numpy as np
import torch
from stable_baselines3 import PPO
from pepe_finrl_env import PepeScalpEnv,finrl_agent,POLICY
RUN=ROOT/'work/pepe-finrl-v2';torch.set_num_threads(POLICY['threadsPerWorker']);torch.set_num_interop_threads(1)
train=PepeScalpEnv('train');development=PepeScalpEnv('development');validation=PepeScalpEnv('validation');DRLAgent=finrl_agent()
def sha(file):return hashlib.sha256(file.read_bytes()).hexdigest()
def atomic(file,obj):
 file.parent.mkdir(parents=True,exist_ok=True);tmp=file.with_name(file.name+'.tmp');tmp.write_text(json.dumps(obj,separators=(',',':')));tmp.replace(file)
def load_model(job):
 file=ROOT/job['modelPath'];hp=job['hyperparameters']
 if file.exists():model=PPO.load(file,env=train,device='cpu')
 else:
  with contextlib.redirect_stdout(sys.stderr):model=DRLAgent(train).get_model('ppo',policy='MlpPolicy',policy_kwargs={'net_arch':{'pi':POLICY['policyNetwork'],'vf':POLICY['policyNetwork']}},model_kwargs={**POLICY['ppo'],**hp,'device':'cpu'},seed=job['seed'],verbose=0)
 model.learning_rate=hp['learning_rate'];model.lr_schedule=lambda _:hp['learning_rate'];model.ent_coef=hp['ent_coef'];model.gamma=hp['gamma'];model.rollout_buffer.gamma=hp['gamma'];model.clip_range=lambda _:hp['clip_range']
 for group in model.policy.optimizer.param_groups:group['lr']=hp['learning_rate']
 return model

def evaluate(model,role,window,seed):
 env=development if role=='development'else validation;obs,_=env.reset(seed=seed,options=window);done=False
 while not done:
  action,_=model.predict(obs,deterministic=True);obs,_,done,_,_=env.step(action)
 return env.last_summary

def work(job):
 started=time.monotonic();model=load_model(job);model.set_random_seed(job['seed']+job['generation']*104729)
 if job['kind']=='train':
  train.reset(seed=job['seed']+job['generation']*100003);before=int(model.num_timesteps);model.learn(total_timesteps=POLICY['stepsPerGeneration'],reset_num_timesteps=False,progress_bar=False);trained=int(model.num_timesteps)-before;file=ROOT/job['modelPath'];file.parent.mkdir(parents=True,exist_ok=True);tmp=file.with_name(file.stem+'.tmp.zip');model.save(tmp);tmp.replace(file)
 else:trained=0
 role='validation'if job['kind']=='validation'else'development';window=job.get('window')if role=='development'else None;summary=evaluate(model,role,window,job['seed']);score=summary['pnlBRL']-POLICY['drawdownPenalty']*summary['maxDD']*POLICY['capitalBRL'];out={**summary,'id':job['id'],'generation':job['generation'],'score':score,'trainingSteps':trained,'seconds':time.monotonic()-started,'modelPath':job['modelPath'],'modelSHA256':sha(ROOT/job['modelPath']),'hyperparameters':job['hyperparameters'],'phase':role}
 if job['kind']!='train':
  name=f"{job['kind']}-g{job['generation']}-a{job['id']}";atomic(RUN/'evaluations'/(name+'.json'),out)
  file=RUN/'candidates'/(name+'.zip');file.parent.mkdir(parents=True,exist_ok=True);file.write_bytes((ROOT/job['modelPath']).read_bytes());out['modelPath']=str(file.relative_to(ROOT));out['modelSHA256']=sha(file)
 trades=out.pop('trades');out['window']=window or{'start':int(__import__('datetime').datetime.strptime(POLICY[role]['start'],'%Y-%m').replace(tzinfo=__import__('datetime').timezone.utc).timestamp()*1000),'end':int(__import__('datetime').datetime.strptime(POLICY[role]['end'],'%Y-%m').replace(tzinfo=__import__('datetime').timezone.utc).timestamp()*1000)};out['leverageStats']=[{'leverage':leverage,'count':len([t for t in trades if t['leverage']==leverage]),'pnlBRL':sum(t['net']*POLICY['fx']for t in trades if t['leverage']==leverage)}for leverage in POLICY['allowedLeverages']];out['bestTrades']=sorted(trades,key=lambda t:t['net'],reverse=True)[:10];out['worstTrades']=sorted(trades,key=lambda t:t['net'])[:10];return out
try:
 registration=json.loads((RUN/'registration.json').read_text())
 for file,digest in{**registration['sourceHashes'],**registration['dependencies']['sourceHashes']}.items():
  if sha(ROOT/file)!=digest:raise RuntimeError('Changed registered source '+file)
 for line in sys.stdin:
  try:
   job=json.loads(line)
   if job.get('kind')=='close':break
   result=work(job);print(json.dumps({'result':result},separators=(',',':')),flush=True)
  except Exception as error:traceback.print_exc(file=sys.stderr);print(json.dumps({'error':str(error)}),flush=True)
finally:train.close();development.close();validation.close()
