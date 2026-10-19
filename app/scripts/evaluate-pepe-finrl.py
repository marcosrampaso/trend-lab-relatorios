"""Evaluate only the preselected, hashed PPO model on the locked later calendar."""
import hashlib,json,os,sys,time
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
os.environ.setdefault('MPLCONFIGDIR',str(ROOT/'work/finrl-cache/matplotlib'));os.environ.setdefault('XDG_CACHE_HOME',str(ROOT/'work/finrl-cache'))
from stable_baselines3 import PPO
import torch
from pepe_finrl_env import PepeScalpEnv,POLICY
RUN=ROOT/'work/pepe-finrl-v2';selected=json.loads((RUN/'selection.json').read_text());path=ROOT/selected['modelPath']
if hashlib.sha256(path.read_bytes()).hexdigest()!=selected['modelSHA256']:raise RuntimeError('Selected PPO model changed')
torch.set_num_threads(2);model=PPO.load(path,device='cpu')
for cost in POLICY['costCases']:
 out=RUN/('test-'+cost['id']+'.json')
 if out.exists():continue
 env=PepeScalpEnv('test',cost['id'])
 try:
  obs,_=env.reset(seed=selected['seed']);done=False
  while not done:
   action,_=model.predict(obs,deterministic=True);obs,_,done,_,_=env.step(action)
  summary={**env.last_summary,'cost':cost['id'],'modelSHA256':selected['modelSHA256'],'selectedBeforeTest':True,'completedAt':int(time.time()*1000)};tmp=out.with_suffix('.tmp');tmp.write_text(json.dumps(summary,separators=(',',':')));tmp.replace(out);print(json.dumps({'test':cost['id'],'pnlBRL':summary['pnlBRL'],'count':summary['count'],'maxDD':summary['maxDD']}),flush=True)
 finally:env.close()
