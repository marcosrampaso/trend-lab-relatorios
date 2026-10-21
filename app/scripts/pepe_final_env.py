"""Evaluation-only exact calendar, separate from the locked original environment."""
import json,subprocess,os
import gymnasium as gym
import numpy as np
from pepe_mask_env import PepeMaskedEnv,ROOT
class PepeFinalEnv(PepeMaskedEnv):
 def __init__(self,cost):
  super().__init__('development',cost)
  self.final_protocol=json.loads((ROOT/'work/pepe-v3-final-v1/protocol.json').read_text())
 def _request(self,obj):
  if self.process is None:self.process=subprocess.Popen([os.environ.get('TREND_NODE','node'),'scripts/pepe-final-bridge.mjs'],cwd=ROOT,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=None,text=True,bufsize=1)
  return super()._request(obj)
 def reset(self,*,seed=None,options=None):
  if options is not None:raise ValueError('Final calendar cannot be overridden')
  gym.Env.reset(self,seed=seed)
  from pepe_finrl_env import timestamp
  self.elapsed_steps=0;self.accumulated_reward=0
  p=self.final_protocol['test'];d=self._request({'command':'reset','role':'test','start':timestamp(p['start']),'end':timestamp(p['end']),'cost':self.cost})
  return np.asarray(d['observation'],dtype=np.float32),{'at':d['at']}
