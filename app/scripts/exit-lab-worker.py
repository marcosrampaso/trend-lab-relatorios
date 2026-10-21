"""One predeclared exit-only policy; no genetic adoption or checkpoint selection."""
import os,sys,json,time,importlib,statistics
from pathlib import Path
os.environ.setdefault('OMP_NUM_THREADS','2');os.environ.setdefault('OPENBLAS_NUM_THREADS','2')
import torch,numpy as np
from sb3_contrib import MaskablePPO
from exit_lab_env import ExitEnv,ROOT,RUN
c=importlib.import_module('pepe-elite-core')
torch.set_num_threads(2);torch.set_num_interop_threads(1)
arm,seed=sys.argv[1],int(sys.argv[2]);P=c.read(RUN/'protocol.json');key=f'{arm}-{seed}';base=RUN/'runs'/key;base.mkdir(parents=True,exist_ok=True)
if arm not in P['trainingRewardArms']or seed not in P['seeds']:raise ValueError('Unregistered run')
started=time.time();state=c.read(base/'state.json')if(base/'state.json').exists()else{'key':key,'arm':arm,'seed':seed,'steps':0,'evaluations':[],'chunks':[],'startedAt':int(time.time()*1000)}
def publish(**updates):
 state.update(updatedAt=int(time.time()*1000),**updates);c.atomic(base/'state.json',state)
def evaluate(model,steps):
 target=base/f'evaluation-{steps}.json'
 if target.exists():return c.read(target)
 env=ExitEnv('development',arm);positions=[];wallets=[]
 try:
  entries=[e for e in env.dataset['entries']if e['split']=='development']
  for row in entries:
   r=env.request({'command':'reset','id':row['id'],'role':'development','arm':arm})
   while not r['done']:
    a,_=model.predict(np.asarray(r['observation'],dtype=np.float32),deterministic=True,action_masks=env.action_masks());r=env.request({'command':'step','action':int(a)})
   positions.append(r['summary'])
  for month in sorted(set(e['month']for e in entries)):
   r=env.request({'command':'wallet-reset','month':month,'role':'development'})
   while not r['done']:
    a,_=model.predict(np.asarray(r['observation'],dtype=np.float32),deterministic=True,action_masks=env.action_masks());r=env.request({'command':'wallet-step','action':int(a)})
   wallets.append(r['summary'])
 finally:env.close()
 result={'key':key,'steps':steps,'arm':arm,'seed':seed,'modelSHA256':c.sha(base/f'model-{steps}.zip'),'positions':positions,'wallets':wallets,'meanDeltaBRL':statistics.mean(r['deltaBRL']for r in positions),'meanPositionBRL':statistics.mean(r['netBRL']for r in positions),'meanMonthlyBRL':statistics.mean(r['pnlBRL']for r in wallets),'meanMonthlyDD':statistics.mean(r['maxDD']for r in wallets),'learnedProtectionApplied':sum(r['learnedProtectionApplied']for r in wallets),'automaticApplied':sum(r['automaticApplied']for r in wallets),'realOrders':False,'evaluatedAt':int(time.time()*1000)}
 c.immutable(target,result);return result
env=ExitEnv('train',arm)
try:
 if state['steps']:
  previous=base/f"model-{state['steps']}.zip"
  if c.sha(previous)!=state['modelSHA256']:raise ValueError('Checkpoint changed')
  model=MaskablePPO.load(previous,env=env,device='cpu')
 else:
  model=MaskablePPO('MlpPolicy',env,seed=seed,device='cpu',policy_kwargs={'net_arch':P['exitNetwork']},verbose=0,**P['ppoExit']);model.save(base/'model-0.zip');(base/'model-0.zip').chmod(0o444)
 def audit(steps):
  publish(status='evaluating');before={k:v.clone()for k,v in model.policy.state_dict().items()};n=model.num_timesteps;ev=evaluate(model,steps)
  if model.num_timesteps!=n or any(not torch.equal(v,before[k])for k,v in model.policy.state_dict().items()):raise ValueError('Evaluation modified model')
  small={k:v for k,v in ev.items()if k not in ['positions','wallets']};state['evaluations']=[e for e in state['evaluations']if e['steps']!=steps]+[small];publish()
 if state['steps']in P['evaluateAtSteps']:audit(state['steps'])
 while state['steps']<P['trainingStepsPerRun']:
  if c.read(RUN/'control.json')['desired']!='running':publish(status='paused');break
  if __import__('shutil').disk_usage(ROOT).free<10*1024**3:raise RuntimeError('Disk reserve below10GiB')
  chunk=state['steps']//P['chunkSteps'];model.set_random_seed(seed+chunk);env.reset(seed=seed+chunk);model._last_obs=None
  publish(status='training',chunk=chunk+1);at=time.time();model.learn(total_timesteps=P['chunkSteps'],reset_num_timesteps=False,progress_bar=False)
  steps=int(model.num_timesteps)
  if steps!=state['steps']+P['chunkSteps']:raise ValueError('Unexpected step count')
  target=base/f'model-{steps}.zip'
  if target.exists():raise ValueError('Refusing to overwrite checkpoint')
  model.save(target);target.chmod(0o444)
  receipt={'steps':steps,'elapsedSeconds':time.time()-at,'modelSHA256':c.sha(target),'recentEpisodes':env.episodes[-20:],'rewardMean':float(np.mean(model.ep_info_buffer and [e['r']for e in model.ep_info_buffer]or[0]))}
  c.immutable(base/f'checkpoint-{steps}.json',receipt);state['chunks'].append({k:v for k,v in receipt.items()if k!='recentEpisodes'});publish(steps=steps,modelSHA256=receipt['modelSHA256'])
  if steps in P['evaluateAtSteps']:audit(steps)
 if state['steps']==P['trainingStepsPerRun']:publish(status='complete',elapsedSeconds=time.time()-started)
except Exception as e:publish(status='error',error=f'{type(e).__name__}: {e}');raise
finally:env.close()
