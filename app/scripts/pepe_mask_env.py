"""Isolated masked environment; old adapter and experiment stay frozen."""
import numpy as np
from pepe_finrl_env import PepeScalpEnv,ROOT
import pepe_finrl_env as legacy
import json
POLICY=json.loads((ROOT/'pepe-finrl-mask-protocol.json').read_text())
class PepeMaskedEnv(PepeScalpEnv):
 def __init__(self,role='train',cost=None):
  if role=='test':raise ValueError('V3 final test locked: register a new prospective calendar first')
  # The parent adapter keeps the identical 38 observation / 10 action ABI.
  super().__init__(role,cost or POLICY['trainingCost']);self._mask=np.array([True]+[False]*9)
 def _request(self,obj):
  if self.process is None:
   import subprocess,os
   self.process=subprocess.Popen([os.environ.get('TREND_NODE','node'),'scripts/pepe-mask-bridge.mjs'],cwd=ROOT,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=None,text=True,bufsize=1)
  result=super()._request(obj)
  if 'actionMasks' in result:self._mask=np.asarray(result['actionMasks'],dtype=bool)
  return result
 def action_masks(self):return self._mask.copy()
 def step(self,action):
  if not self._mask[int(action)]:raise ValueError('Masked state-incompatible action')
  return super().step(action)
