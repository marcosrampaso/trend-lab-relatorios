import json,subprocess,os
import gymnasium as gym
import numpy as np
from pepe_mask_env import PepeMaskedEnv,ROOT
class PepeV4V2Env(PepeMaskedEnv):
 def __init__(self,role='train',cost='stress'):
  if role not in ['train','development','diagnostic_train']:raise ValueError('V4 final test not registered')
  super().__init__('train'if role=='train'else'development',cost);self.v4role=role;self.v4protocol=json.loads((ROOT/'work/pepe-v4-v2/protocol.json').read_text())
 def _request(self,obj):
  if self.process is None:self.process=subprocess.Popen([os.environ.get('TREND_NODE','node'),'scripts/pepe-v4-v2-bridge.mjs'],cwd=ROOT,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=None,text=True,bufsize=1)
  return super()._request(obj)
 def reset(self,*,seed=None,options=None):
  if self.v4role=='train':return super().reset(seed=seed,options=options)
  blocks=self.v4protocol['fitnessBlocks'if self.v4role=='development'else'diagnosticTrainBlocks'];window=options or blocks[0]
  if not any(window['start']==b['start']and window['end']==b['end']for b in blocks):raise ValueError('Unregistered audit window')
  gym.Env.reset(self,seed=seed);self.elapsed_steps=0;self.accumulated_reward=0
  d=self._request({'command':'reset','role':self.v4role,'start':window['start'],'end':window['end'],'cost':self.cost})
  return np.asarray(d['observation'],dtype=np.float32),{'at':d['at']}
