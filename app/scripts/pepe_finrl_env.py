"""Gymnasium adapter: actual FinRL DRLAgent, closed-bar observations, audited Node futures engine."""
import atexit,json,os,select,subprocess,sys,types
from pathlib import Path
from datetime import datetime,timezone
from importlib import metadata
from importlib.machinery import ModuleSpec
import gymnasium as gym
from gymnasium import spaces
import numpy as np
ROOT=Path(__file__).resolve().parent.parent
POLICY=json.loads((ROOT/'pepe-finrl-protocol.json').read_text())
def timestamp(month):return int(datetime.strptime(month,'%Y-%m').replace(tzinfo=timezone.utc).timestamp()*1000)
def finrl_agent():
 # FinRL0.3.7 package __init__ eagerly imports unused broker/data integrations.
 # Load its real installed research submodules without that root-side effect.
 path=metadata.distribution('FinRL').locate_file('finrl');pkg=types.ModuleType('finrl');pkg.__path__=[str(path)];pkg.__spec__=ModuleSpec('finrl',loader=None,is_package=True);sys.modules.setdefault('finrl',pkg)
 from finrl.agents.stablebaselines3.models import DRLAgent
 return DRLAgent
class PepeScalpEnv(gym.Env):
 metadata={'render_modes':[]}
 def __init__(self,role='train',cost=None):
  super().__init__()
  if role not in ['train','development','validation','test']:raise ValueError('Unknown split')
  if role=='test'and not(ROOT/'work/pepe-finrl-v2/selection.json').exists():raise ValueError('Final test locked until selection is frozen')
  self.role=role;self.cost=cost or POLICY['trainingCost'];self.action_space=spaces.Discrete(10);self.observation_space=spaces.Box(low=-10,high=10,shape=(POLICY['observationCount'],),dtype=np.float32);self.process=None;self.episodes=[];self.elapsed_steps=0;self.accumulated_reward=0;self.last_summary=None;atexit.register(self.close)
 def _request(self,obj):
  if self.process is None:
   self.process=subprocess.Popen([os.environ.get('TREND_NODE','node'),'scripts/pepe-finrl-bridge.mjs'],cwd=ROOT,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=None,text=True,bufsize=1)
  if self.process.poll()is not None:raise RuntimeError('Futures bridge stopped')
  self.process.stdin.write(json.dumps(obj,separators=(',',':'))+'\n');self.process.stdin.flush()
  if not select.select([self.process.stdout],[],[],90)[0]:raise TimeoutError('Futures bridge timeout')
  line=self.process.stdout.readline()
  if not line:raise RuntimeError('Futures bridge closed output')
  d=json.loads(line)
  if 'error'in d:raise RuntimeError(d['error'])
  return d
 def reset(self,*,seed=None,options=None):
  super().reset(seed=seed);split=POLICY[self.role];start=timestamp(split['start']);end=timestamp(split['end'])
  if options and self.role=='development':
   start=options['start'];end=options['end']
   if not timestamp(POLICY['development']['start'])<=start<end<=timestamp(POLICY['development']['end']):raise ValueError('Probe outside development')
  if self.role=='train':
   days=POLICY['trainingEpisodeDays'];last=(end-start)//86400000-days
   eligible=[]
   for day in range(last+1):
    a=start+day*86400000;b=a+days*86400000
    if not any(a<timestamp(m['end'])and b>timestamp(m['start'])for m in POLICY.get('excludedTraining',[])):eligible.append(a)
   if not eligible:raise ValueError('No training episodes')
   start=eligible[int(self.np_random.integers(len(eligible)))];end=start+days*86400000
  self.elapsed_steps=0;self.accumulated_reward=0;d=self._request({'command':'reset','role':self.role,'start':start,'end':end,'cost':self.cost});return np.asarray(d['observation'],dtype=np.float32),{'at':d['at']}
 def step(self,action):
  d=self._request({'command':'step','action':int(action)});self.elapsed_steps+=1;self.accumulated_reward+=d['reward'];info={'at':d['at']}
  if d['done']:
   self.last_summary=d['summary'];self.episodes.append({'reward':self.accumulated_reward,'pnlBRL':self.last_summary['pnlBRL'],'count':self.last_summary['count'],'maxDD':self.last_summary['maxDD']});self.episodes=self.episodes[-1000:];info['episode']={'r':self.accumulated_reward,'l':self.elapsed_steps}
  return np.asarray(d['observation'],dtype=np.float32),float(d['reward']),bool(d['done']),False,info
 def close(self):
  if self.process is not None:
   if self.process.poll()is None:
    try:self.process.stdin.write('{"command":"close"}\n');self.process.stdin.flush();self.process.wait(timeout=2)
    except(Exception):self.process.terminate()
   self.process.stdin.close();self.process.stdout.close();self.process=None
