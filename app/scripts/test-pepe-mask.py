"""Behavioral checks: real weight transfer, masks in actual PPO learning, crash receipt, immutable evidence."""
import importlib,sys,tempfile,hashlib
from pathlib import Path
c=importlib.import_module('pepe-mask-core');w=importlib.import_module('pepe-mask-worker');t=w.PepeMaskedEnv('train');d=w.PepeMaskedEnv('development')
try:
 model,proof=w.transfer(c.ROOT/'work/pepe-g830-audit-v1/replayed.zip',t,{k:c.P['ppo'][k]for k in c.P['hyperparameters']},17)
 assert proof['allTensorsIdentical']and not proof['optimizerTransferred']
 obs,_=t.reset(seed=17)
 for _ in range(32):
  action,_=model.predict(obs,action_masks=t.action_masks(),deterministic=True);assert t.action_masks()[int(action)];obs,*_=t.step(action)
 with tempfile.TemporaryDirectory(dir=c.ROOT/'work',prefix='mask-smoke-')as tmp:
  temp=Path(tmp);w.RUN=temp;c.RUN=temp;c.immutable_json(temp/'registration.json',{'test':True})
  job={'kind':'train','id':0,'generation':1,'seed':20261020,'modelPath':str((temp/'smoke.zip').relative_to(c.ROOT)),'hyperparameters':{k:c.P['ppo'][k]for k in c.P['hyperparameters']},'window':{'start':1727740800000,'end':1727913600000}}
  a=w.work(job,t,d);digest=w.sha(c.ROOT/job['modelPath']);b=w.work(job,t,d)
  assert a['trainingSteps']==1024 and b['trainingSteps']==1024 and a['audit']==b['audit']and digest==w.sha(c.ROOT/job['modelPath'])
  assert a['audit']['stateInvalidActions']==0 and a['probe']['stateInvalidActions']==0
  archived=c.archive(a,'smoke');path=c.ROOT/archived['modelPath'];assert c.sha(path)==digest
  try:c.immutable_json(path,{});raise AssertionError('Archive overwrite allowed')
  except FileExistsError:pass
  assert c.rank([{'id':1,'audit':{'pnlBRL':20,'maxDD':.2}},{'id':2,'audit':{'pnlBRL':5,'maxDD':.01}}])[0]['id']==2
  # Full fixed calendar survives a global halt as flat cash through December31.
  assert a['audit']['curve'][0]['at']==1727740800000 and a['audit']['curve'][-1]['at']==1735689600000
  print({'passed':True,'transfer':proof,'maskedTrainingSteps':a['trainingSteps'],'repeatDidNotRetrain':True,'fixedAuditPNL':a['audit']['pnlBRL'],'stateInvalid':a['audit']['stateInvalidActions'],'immutableArchive':True})
finally:t.close();d.close()
