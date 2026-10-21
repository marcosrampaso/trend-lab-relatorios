"""New exit-only ABI; frozen entry source and isolated research environment."""
import json,os,subprocess,select
from pathlib import Path
import gymnasium as gym
import numpy as np
ROOT=Path(__file__).resolve().parent.parent
RUN=ROOT/'work/pepe-exits-v1'
class ExitEnv(gym.Env):
 def __init__(self,role='train',arm='liquidation'):
  if role not in ['train','development']or arm not in ['mark','liquidation']:raise ValueError('Unregistered exit role/reward')
  self.role,self.arm=role,arm;self.p=json.loads((RUN/'protocol.json').read_text());self.dataset=json.loads((RUN/'dataset-index.json').read_text());self.entries=[e for e in self.dataset['entries']if e['split']==role and e['controllable']];self.process=None;self.last_summary=None;self.episodes=[];self.action_space=gym.spaces.Discrete(6);self.observation_space=gym.spaces.Box(-10,10,shape=(self.p['exitObservationCount'],),dtype=np.float32);self._mask=np.array([True]+[False]*5)
 def request(self,obj):
  if self.process is None:self.process=subprocess.Popen([os.environ.get('TREND_NODE','node'),'scripts/exit-lab-bridge.mjs'],cwd=ROOT,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=None,text=True,bufsize=1)
  self.process.stdin.write(json.dumps(obj)+'\n');self.process.stdin.flush()
  if not select.select([self.process.stdout],[],[],90)[0]:raise TimeoutError('Exit bridge timeout')
  line=self.process.stdout.readline()
  if not line:raise RuntimeError('Exit bridge closed')
  r=json.loads(line)
  if 'error'in r:raise RuntimeError(r['error'])
  if 'actionMasks'in r:self._mask=np.asarray(r['actionMasks'],dtype=bool)
  return r
 def reset(self,*,seed=None,options=None):
  super().reset(seed=seed);entry=options['entry']if options else self.entries[int(self.np_random.integers(len(self.entries)))]['id']
  if entry not in [e['id']for e in self.entries]:raise ValueError('Wrong split or uncontrollable entry')
  r=self.request({'command':'reset','id':entry,'role':self.role,'arm':self.arm});self.total_reward=0;self.steps=0
  if r['done']:raise ValueError('Training sample ended before first decision')
  return np.asarray(r['observation'],dtype=np.float32),{}
 def action_masks(self):return self._mask.copy()
 def step(self,action):
  r=self.request({'command':'step','action':int(action)});self.total_reward+=r['reward'];self.steps+=1;info={}
  if r['done']:
   self.last_summary=r['summary'];self.episodes.append({k:self.last_summary[k]for k in ['id','netBRL','baselineBRL','deltaBRL','stopMoves','partialExits','actions']});self.episodes=self.episodes[-1000:];info['episode']={'r':self.total_reward,'l':self.steps}
  return np.asarray(r['observation'],dtype=np.float32),float(r['reward']),bool(r['terminated']),bool(r['truncated']),info
 def close(self):
  if self.process is not None:
   if self.process.poll()is None:
    try:self.process.stdin.write('{"command":"close"}\n');self.process.stdin.flush();self.process.wait(timeout=5)
    except Exception:self.process.terminate()
   self.process.stdin.close();self.process.stdout.close();self.process=None
