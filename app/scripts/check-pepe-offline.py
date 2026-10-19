"""Real PPO smoke with Python/Node network entry points blocked, temporary weights only."""
import os,sys,json,time,socket
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent;os.chdir(ROOT)
os.environ['MPLCONFIGDIR']=str(ROOT/'work/finrl-cache/matplotlib');os.environ['XDG_CACHE_HOME']=str(ROOT/'work/finrl-cache');os.environ['NODE_OPTIONS']='--import='+str(ROOT/'scripts/pepe-offline-guard.mjs');os.environ['HF_HUB_OFFLINE']='1';os.environ['TRANSFORMERS_OFFLINE']='1'
def denied(*a,**k):raise RuntimeError('Python networking disabled for offline check')
socket.socket.connect=denied;socket.create_connection=denied;socket.getaddrinfo=denied
import torch
torch.set_num_threads(1)
from pepe_finrl_env import PepeScalpEnv,finrl_agent
from pepe_1000_env import PepeScalpEnv as LargeEnv
started=time.monotonic();results=[]
for name,Env in [('250',PepeScalpEnv),('1000',LargeEnv)]:
 env=Env('train')
 try:
  model=finrl_agent()(env).get_model('ppo',policy_kwargs={'net_arch':{'pi':[64,64],'vf':[64,64]}},model_kwargs={'n_steps':256,'batch_size':64,'n_epochs':1,'device':'cpu'},seed=271,verbose=0);model.learn(total_timesteps=256,progress_bar=False);results.append({'population':int(name),'steps':int(model.num_timesteps),'observations':int(env.observation_space.shape[0]),'actions':int(env.action_space.n),'ok':True})
 finally:env.close()
report={'status':'complete','checkedAt':int(time.time()*1000),'networkGuard':'Python socket connect/getaddrinfo and Node TCP/HTTP/DNS/fetch blocked in test subprocesses; not a system-wide network audit','results':results,'seconds':time.monotonic()-started,'savedTrainingWeights':False,'finalTestOpened':False}
file=ROOT/'web/data/pepe-offline-check.json';tmp=file.with_suffix('.tmp');tmp.write_text(json.dumps(report));tmp.replace(file);print(json.dumps(report))
