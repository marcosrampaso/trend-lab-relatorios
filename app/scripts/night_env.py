"""Seven isolated chronological folds; no future reward may enter an earlier fold."""
import importlib,os,subprocess
import numpy as np
import gymnasium as gym
from gymnasium import spaces
from pepe_finrl_env import PepeScalpEnv,timestamp
c=importlib.import_module('night-core')
class NightEnv(PepeScalpEnv):
 def __init__(self,role,arm,fold):
  super().__init__('train'if role=='train'else'development','stress');self.nrole=role;self.arm=arm;self.fold=fold;self.p=c.protocol();self.observation_space=spaces.Box(-10,10,(51,),dtype=np.float32);self._mask=np.array([True]+[False]*9)
 def _request(self,obj):
  if self.process is None:self.process=subprocess.Popen(['node','scripts/night-bridge.mjs'],cwd=c.ROOT,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=None,text=True,bufsize=1)
  result=super()._request(obj)
  if 'actionMasks'in result:self._mask=np.asarray(result['actionMasks'],bool)
  return result
 def action_masks(self):return self._mask.copy()
 def reset(self,*,seed=None,options=None):
  gym.Env.reset(self,seed=seed);fold=self.p['folds'][self.fold];window=self.p['validation']if self.nrole=='validation'else fold
  start,end=window['start'],window['end']
  if self.nrole=='train':
   span=7*86400000;eligible=[t for t in range(fold['trainStart'],fold['trainEnd']-span+1,86400000)if not(t<timestamp('2024-09')and t+span>timestamp('2024-08'))];start=int(self.np_random.choice(eligible));end=start+span
  self.elapsed_steps=0;self.accumulated_reward=0
  d=self._request({'command':'reset','role':self.nrole,'arm':self.arm,'fold':self.fold,'start':start,'end':end,'cost':'stress'});return np.asarray(d['observation'],np.float32),{'at':d['at']}
 def step(self,action):
  if not self._mask[int(action)]:raise ValueError('Invalid state action')
  return super().step(action)
