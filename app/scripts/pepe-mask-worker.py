"""Persistent MaskablePPO worker. No access to consumed or future final tests."""
import hashlib,json,os,sys,time,traceback
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
os.environ.setdefault('MPLCONFIGDIR',str(ROOT/'work/finrl-cache/matplotlib'));os.environ.setdefault('XDG_CACHE_HOME',str(ROOT/'work/finrl-cache'))
import numpy as np
import torch
from stable_baselines3 import PPO
from sb3_contrib import MaskablePPO
from pepe_mask_env import PepeMaskedEnv,POLICY
RUN=ROOT/'work/pepe-finrl-mask-v3'
torch.set_num_threads(2);torch.set_num_interop_threads(1)
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def atomic(p,obj):
 p=Path(p);p.parent.mkdir(parents=True,exist_ok=True);tmp=p.with_name(p.name+'.tmp');tmp.write_text(json.dumps(obj,separators=(',',':'),allow_nan=False));tmp.replace(p)
def save_model(model,path):
 path=Path(path);path.parent.mkdir(parents=True,exist_ok=True);tmp=path.with_name(path.stem+'.tmp.zip');model.save(tmp);tmp.replace(path)
def new_model(env,hp,seed):
 return MaskablePPO('MlpPolicy',env,policy_kwargs={'net_arch':{'pi':POLICY['policyNetwork'],'vf':POLICY['policyNetwork']}},**{**POLICY['ppo'],**hp},device='cpu',seed=seed,verbose=0)
def transfer(source,env,hp,seed):
 old=PPO.load(source,device='cpu');new=new_model(env,hp,seed);a=old.policy.state_dict();b=new.policy.state_dict()
 if a.keys()!=b.keys()or any(a[k].shape!=b[k].shape for k in a):raise ValueError('Incompatible policy tensors')
 new.policy.load_state_dict(a,strict=True)
 if any(not torch.equal(a[k],new.policy.state_dict()[k])for k in a):raise ValueError('Transfer changed policy tensors')
 return new,{'keys':len(a),'parameters':sum(x.numel()for x in a.values()),'allTensorsIdentical':True,'optimizerTransferred':False,'oldAlgorithm':'PPO','newAlgorithm':'MaskablePPO'}
def evaluate(model,env,window=None,seed=0):
 obs,_=env.reset(seed=seed,options=window);done=False;invalid=0
 while not done:
  masks=env.action_masks();action,_=model.predict(obs,action_masks=masks,deterministic=True)
  if not masks[int(action)]:invalid+=1;raise ValueError('Policy emitted masked action')
  obs,_,done,_,_=env.step(action)
 return{**env.last_summary,'stateInvalidActions':invalid}
def compact(r):return{k:v for k,v in r.items()if k not in ['curve','trades']}
def score(r):return r['pnlBRL']-POLICY['drawdownPenalty']*r['maxDD']*POLICY['capitalBRL']
def work(job,train,dev):
 started=time.monotonic();hp=job['hyperparameters'];seed=job['seed'];kind=job['kind'];file=ROOT/job['modelPath'];proof=None;trained=0
 if kind=='scan':model,proof=transfer(file,train,hp,seed)
 else:
  if file.exists():model=MaskablePPO.load(file,env=train,device='cpu')
  elif job.get('parentPath'):
   model=new_model(train,hp,seed);parent=MaskablePPO.load(ROOT/job['parentPath'],device='cpu');model.policy.load_state_dict(parent.policy.state_dict(),strict=True)
  else:model=new_model(train,hp,seed)
  model.learning_rate=hp['learning_rate'];model.lr_schedule=lambda _:hp['learning_rate'];model.ent_coef=hp['ent_coef'];model.gamma=hp['gamma'];model.rollout_buffer.gamma=hp['gamma'];model.clip_range=lambda _:hp['clip_range']
  for group in model.policy.optimizer.param_groups:group['lr']=hp['learning_rate']
  receipt=RUN/'receipts'/f"g{job['generation']}-a{job['id']}.json"
  previous=json.loads(receipt.read_text())if receipt.exists()else None
  if previous:
   snapshot=ROOT/previous['snapshotPath']
   if sha(snapshot)!=previous['modelSHA256']:raise ValueError('Training receipt snapshot mismatch')
   if not file.exists()or sha(file)!=previous['modelSHA256']:
    import shutil;shutil.copyfile(snapshot,file)
   trained=previous['trainingSteps'];model=MaskablePPO.load(file,env=train,device='cpu')
  else:
   model.set_random_seed(seed+job['generation']*104729);train.reset(seed=seed+job['generation']*100003);before=int(model.num_timesteps);model.learn(total_timesteps=POLICY['stepsPerGeneration'],reset_num_timesteps=False,progress_bar=False);trained=int(model.num_timesteps)-before;snapshot=RUN/'receipts'/f"g{job['generation']}-a{job['id']}.zip";save_model(model,snapshot);atomic(receipt,{'modelSHA256':sha(snapshot),'trainingSteps':trained,'snapshotPath':str(snapshot.relative_to(ROOT))});import shutil;file.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(snapshot,file)
 # FULL fixed continuous wallet first; every model audited before selection.
 audit=evaluate(model,dev,seed=seed);audit.update(score=score(audit))
 probe=None
 if kind!='scan':probe=evaluate(model,dev,job['window'],seed)
 result={'id':job['id'],'generation':job.get('generation',0),'source':job.get('source'),'sourceSHA256':sha(file),'modelPath':str(file.relative_to(ROOT)),'hyperparameters':hp,'seed':seed,'audit':audit,'probe':probe,'score':audit['score'],'trainingSteps':trained,'seconds':time.monotonic()-started,'transfer':proof}
 if job.get('saveConverted'):save_model(model,ROOT/job['saveConverted']);result['convertedSHA256']=sha(ROOT/job['saveConverted'])
 return result
if __name__=='__main__':
 train=PepeMaskedEnv('train');dev=PepeMaskedEnv('development')
 try:
  for line in sys.stdin:
   try:
    job=json.loads(line)
    if job.get('kind')=='close':break
    out=work(job,train,dev);print(json.dumps({'result':out},separators=(',',':'),allow_nan=False),flush=True)
   except Exception as error:traceback.print_exc(file=sys.stderr);print(json.dumps({'error':str(error)}),flush=True)
 finally:train.close();dev.close()
