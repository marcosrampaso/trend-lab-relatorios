"""Read-only policy assessment after the V4 shortlist has been frozen."""
import json,os,subprocess
import gymnasium as gym
import numpy as np
from pepe_mask_env import PepeMaskedEnv,ROOT
class V4ValidationEnv(PepeMaskedEnv):
 def __init__(self,role):
  if role not in ['validation','continuous']:raise ValueError('Assessment role only')
  super().__init__('development','stress');self.assessmentRole=role;self.p=json.loads((ROOT/'work/pepe-v4-v2/protocol.json').read_text())
 def _request(self,obj):
  if self.process is None:self.process=subprocess.Popen([os.environ.get('TREND_NODE','node'),'scripts/pepe-v4-validation-bridge.mjs'],cwd=ROOT,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=None,text=True,bufsize=1)
  return super()._request(obj)
 def reset(self,*,seed=None,options=None):
  gym.Env.reset(self,seed=seed);blocks=self.p['validationBlocks']if self.assessmentRole=='validation'else[self.p['continuousAudit']];w=options or blocks[0]
  if not any(w['start']==b['start']and w['end']==b['end']for b in blocks):raise ValueError('Unregistered assessment calendar')
  self.elapsed_steps=0;self.accumulated_reward=0;d=self._request({'command':'reset','role':self.assessmentRole,'start':w['start'],'end':w['end'],'cost':'stress'})
  return np.asarray(d['observation'],dtype=np.float32),{'at':d['at']}
