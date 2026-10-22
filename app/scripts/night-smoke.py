"""Mandatory real-context rollout before the250-policy population starts."""
import importlib,json
c=importlib.import_module('night-core')
def main():
 from night_env import NightEnv
 import numpy as np
 details=[]
 for arm in ['original','context']:
  e=NightEnv('development',arm,0)
  try:
   obs,info=e.reset(seed=20261022);assert obs.shape==(51,)and np.isfinite(obs).all()
   if arm=='context':assert obs[-1]==1 and any(abs(x)>0 for x in obs[-9:-1])
   before=info['at'];obs,reward,done,_,info=e.step(0);assert info['at']>before and np.isfinite(obs).all()and np.isfinite(reward)
   details.append({'arm':arm,'observations':51,'closedAt':before,'validMasks':bool(e.action_masks()[0])})
  finally:e.close()
 c.immutable(c.BASE/'smoke-context.json',{'passed':True,'details':details,'realOrders':False})
if __name__=='__main__':main()
