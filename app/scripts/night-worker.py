"""One threaded PPO worker, with atomic immutable training receipts."""
import os
for k in ['OMP_NUM_THREADS','OPENBLAS_NUM_THREADS','MKL_NUM_THREADS','NUMEXPR_NUM_THREADS']:os.environ[k]='1'
import importlib,json,sys,traceback,hashlib,time,shutil
import torch
from sb3_contrib import MaskablePPO
from night_env import NightEnv
c=importlib.import_module('night-core');R,B=c.ROOT,c.BASE;P=c.protocol();torch.set_num_threads(2);torch.set_num_interop_threads(1);envs={}
def env(role,arm,fold):
 key=(role,arm,fold)
 if key not in envs:
  # A lane retains only its latest train and development adapters to bound RAM.
  for k in list(envs):
   if k[0]==role:envs.pop(k).close()
  envs[key]=NightEnv(role,arm,fold)
 return envs[key]
def load(path,e,hp,seed,fresh=False):
 if path and not fresh:
  model=MaskablePPO.load(R/path,env=e,device='cpu');model.learning_rate=hp['learning_rate'];model.lr_schedule=lambda _:hp['learning_rate'];model.ent_coef=hp['ent_coef'];model.gamma=hp['gamma'];model.rollout_buffer.gamma=hp['gamma'];model.clip_range=lambda _:hp['clip_range']
  for g in model.policy.optimizer.param_groups:g['lr']=hp['learning_rate']
  return model
 return MaskablePPO('MlpPolicy',e,policy_kwargs={'net_arch':{'pi':[32,32],'vf':[32,32]}},**{**P['ppo'],**hp},seed=seed,device='cpu',verbose=0)
def evaluate(model,e,seed):
 before=c.tensor_hash(model);obs,_=e.reset(seed=seed);done=False
 while not done:
  a,_=model.predict(obs,action_masks=e.action_masks(),deterministic=True);obs,_,done,_,_=e.step(a)
 if before!=c.tensor_hash(model):raise ValueError('Evaluation changed weights')
 return e.last_summary

def work(j):
 start=time.monotonic();arm=j['arm'];fold=j['fold'];seed=j['seed'];hp=j['hyperparameters'];path=j.get('sourcePath')
 if path and c.sha(R/path)!=j['sourceSHA256']:raise ValueError('Parent weight changed')
 folder=B/'models'/j['key'];receipt=folder/'training.json';e=env('train',arm,fold);digest=hashlib.sha256(json.dumps(j,sort_keys=True,separators=(',',':')).encode()).hexdigest()
 if receipt.exists():
  r=c.read(receipt)
  if r['jobSHA256']!=digest or c.sha(R/r['modelPath'])!=r['modelSHA256']:raise ValueError('Immutable training receipt changed')
 else:
  if folder.exists():raise ValueError('Incomplete atomic training receipt')
  model=load(path,e,hp,seed,j.get('fresh',False));before=model.num_timesteps;model.set_random_seed(seed+j['generation']*104729);model.learn(total_timesteps=j['steps'],reset_num_timesteps=False,progress_bar=False)
  tmp=folder.with_name(folder.name+f'.{os.getpid()}.tmp');tmp.mkdir();model.save(tmp/'model.zip');r={'jobSHA256':digest,'modelPath':str((folder/'model.zip').relative_to(R)),'modelSHA256':c.sha(tmp/'model.zip'),'tensorSHA256':c.tensor_hash(model),'trainingSteps':int(model.num_timesteps-before),'fold':fold,'trainEnd':P['folds'][fold]['trainEnd']};c.immutable(tmp/'training.json',r);(tmp/'model.zip').chmod(0o444);tmp.rename(folder)
 out={**r,'key':j['key'],'agent':j['agent'],'arm':arm,'island':j['island'],'generation':j['generation'],'hyperparameters':hp,'seed':seed,'seconds':time.monotonic()-start}
 if j.get('evaluate'):
  policies=[*j['foldModels']];policies[fold]={'modelPath':r['modelPath'],'modelSHA256':r['modelSHA256']};blocks=[]
  for i,parent in enumerate(policies):
   ev=env('development',arm,i)
   if parent:
    if c.sha(R/parent['modelPath'])!=parent['modelSHA256']:raise ValueError('Fold model changed')
    model=load(parent['modelPath'],ev,hp,seed+i*101)
   else:model=load(None,ev,hp,seed+i*101,True)
   summary=evaluate(model,ev,seed);blocks.append({'fold':i,**summary})
  out['blocks']=blocks
 return out
if __name__=='__main__':
 try:
  for line in sys.stdin:
   try:
    j=json.loads(line)
    if j.get('kind')=='close':break
    print(json.dumps({'result':work(j)},allow_nan=False),flush=True)
   except Exception as e:traceback.print_exc(file=sys.stderr);print(json.dumps({'error':str(e)}),flush=True)
 finally:
  for e in envs.values():e.close()
