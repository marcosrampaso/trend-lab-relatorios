"""Freeze monthly opportunities from the already selected V3 parent; never train it."""
import sys,importlib,json,subprocess,os,time
from pathlib import Path
import gymnasium as gym
import numpy as np
core=importlib.import_module('pepe-elite-core');ROOT=core.ROOT;RUN=ROOT/'work/pepe-exits-v1';original=importlib.import_module('pepe-mask-worker');tensor_sha=importlib.import_module('pepe-elite-worker').tensor_sha
P=core.read(RUN/'source-protocol.json')
class Source(original.PepeMaskedEnv):
 def _request(self,obj):
  if self.process is None:self.process=subprocess.Popen([os.environ.get('TREND_NODE','node'),'scripts/exit-lab-source-bridge.mjs'],cwd=ROOT,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=None,text=True,bufsize=1)
  return super()._request(obj)
 def reset(self,*,seed=None,options=None):
  gym.Env.reset(self,seed=seed);w=options;self.elapsed_steps=0;self.accumulated_reward=0;r=self._request({'command':'reset','role':'source','start':w['start'],'end':w['end'],'cost':'stress'});return np.asarray(r['observation'],dtype=np.float32),{}
def main():
 if(RUN/'dataset-registration.json').exists():print('Sources already frozen');return
 model=original.MaskablePPO.load(ROOT/P['founder']['modelPath'],device='cpu');before=tensor_sha(model);env=Source('development');rows=[];packets={}
 try:
  for n,m in enumerate(P['months']):
   file=RUN/'sources'/(m['month']+'.json')
   if not file.exists():
    a=original.evaluate(model,env,window=m,seed=P['seed']);book=a.pop('snapshots');entries=[]
    for i,t in enumerate(a['trades']):
     snapshot=book.get(str(t['entryAt']))
     if not snapshot:raise ValueError('Missing causal entry snapshot')
     entries.append({'id':m['month']+'-'+str(i),'month':m['month'],'split':m['split'],'end':m['end'],'trade':t,'before':snapshot['before'],'atr':snapshot['atr'],'controllable':t['exitAt']>t['entryAt']+300000})
    core.immutable(file,{'month':m,'entries':entries,'sourceSummary':a,'founderSHA256':P['founder']['modelSHA256'],'frozenTensors':before,'trainingSteps':0})
   packet=core.read(file);rel=str(file.relative_to(ROOT));packets[rel]=core.sha(file)
   rows.extend({'id':e['id'],'month':e['month'],'split':e['split'],'controllable':e['controllable'],'path':rel}for e in packet['entries'])
   core.atomic(RUN/'preparation-status.json',{'monthsCompleted':n+1,'targetMonths':len(P['months']),'entries':len(rows),'updatedAt':int(time.time()*1000)})
 finally:env.close()
 if tensor_sha(model)!=before or core.sha(ROOT/P['founder']['modelPath'])!=P['founder']['modelSHA256']:raise ValueError('Source weights changed')
 for split in ['train','development']:
  if sum(e['split']==split and e['controllable']for e in rows)<P['minimumControllable'][split]:raise ValueError('Insufficient controllable positions: '+split)
 core.immutable(RUN/'dataset-index.json',{'entries':rows,'notAPortfolio':True,'generatedAt':int(time.time()*1000)})
 core.immutable(RUN/'dataset-registration.json',{'registeredAt':int(time.time()*1000),'protocolSHA256':core.sha(RUN/'source-protocol.json'),'indexSHA256':core.sha(RUN/'dataset-index.json'),'packetHashes':packets,'parentTensorsUnchanged':True,'noTrainingOnSource':True})
 print(json.dumps({'entries':len(rows),'controllable':{s:sum(e['split']==s and e['controllable']for e in rows)for s in ['train','development']}}))
if __name__=='__main__':main()
