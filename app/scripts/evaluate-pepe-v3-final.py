"""Final frozen-policy evaluation, declared costs, no learn() and no selection."""
import importlib,time,fcntl,os,hashlib
core=importlib.import_module('pepe-elite-core');ROOT=core.ROOT;RUN=ROOT/'work/pepe-v3-final-v1'
def main():
 reg=core.read(RUN/'registration.json');selection=core.read(RUN/'selection.json')
 for p,d in {**reg['sourceHashes'],**reg['dataHashes'],**reg['dependencyHashes']}.items():
  if core.sha(ROOT/p)!=d:raise ValueError('Final input changed: '+p)
 import torch
 from sb3_contrib import MaskablePPO
 from pepe_final_env import PepeFinalEnv
 torch.set_num_threads(2);torch.set_num_interop_threads(1)
 with (RUN/'evaluation.lock').open('a')as lock:
  fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
  for cost in reg['costsDeclaredBeforeEvaluation']:
   resultfile=RUN/f'result-{cost}.json'
   if resultfile.exists():continue
   model=MaskablePPO.load(ROOT/selection['modelPath'],device='cpu');env=PepeFinalEnv(cost)
   def tensor_hash():
    h=hashlib.sha256()
    for key,value in sorted(model.policy.state_dict().items()):h.update(key.encode());h.update(value.detach().cpu().numpy().tobytes())
    return h.hexdigest()
   before=tensor_hash()
   core.atomic(RUN/'status.json',{'status':'evaluating','cost':cost,'pid':os.getpid(),'selected':selection,'updatedAt':int(time.time()*1000),'realOrders':False})
   try:
    obs,_=env.reset(seed=selection['seed']);done=False
    while not done:
     action,_=model.predict(obs,action_masks=env.action_masks(),deterministic=True);obs,_,done,_,_=env.step(action)
    if tensor_hash()!=before:raise ValueError('Evaluation changed policy tensors')
    if core.sha(ROOT/selection['modelPath'])!=selection['modelSHA256']:raise ValueError('Frozen model changed')
    result={'cost':cost,'summary':env.last_summary,'selectedModelSHA256':selection['modelSHA256'],'registrationSHA256':core.sha(RUN/'registration.json'),'completedAt':int(time.time()*1000),'selectionBeforeTest':True,'trainingSteps':0,'policyTensorSHA256':before,'policyTensorsUnchanged':True,'realOrders':False}
    core.immutable(resultfile,result);print({'cost':cost,'pnlBRL':env.last_summary['pnlBRL'],'count':env.last_summary['count']},flush=True)
   finally:env.close()
  core.atomic(RUN/'status.json',{'status':'complete','selected':selection,'updatedAt':int(time.time()*1000),'realOrders':False})
if __name__=='__main__':
 try:main()
 except Exception as e:
  core.atomic(RUN/'status.json',{'status':'error','error':str(e),'updatedAt':int(time.time()*1000),'realOrders':False})
  raise
