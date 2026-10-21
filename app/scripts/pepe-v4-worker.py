"""Use the tested receipt/learning code; evaluate all three registered blocks."""
import importlib,json,sys,traceback
core=importlib.import_module('pepe-v4-core');worker=importlib.import_module('pepe-elite-worker')
worker.core=core;worker.ROOT=core.ROOT;worker.RUN=core.RUN
from pepe_v4_env import PepeV4Env
P=core.read(core.RUN/'protocol.json')

def work(job,train,dev,diagnostic):
 env=diagnostic if job.get('diagnostic')else dev;blocks=P['diagnosticTrainBlocks']if job.get('diagnostic')else P['fitnessBlocks'];train.episodes=[]
 result=worker.work(job,train,env);model=worker.original.MaskablePPO.load(core.ROOT/result['modelPath'],device='cpu')
 audits=[{'id':blocks[0]['id'],'start':blocks[0]['start'],'end':blocks[0]['end'],'summary':result['audit']}]
 for block in blocks[1:]:audits.append({'id':block['id'],'start':block['start'],'end':block['end'],'summary':worker.original.evaluate(model,env,window=block,seed=job['seed'])})
 if worker.tensor_sha(model)!=result['tensorSHA256']:raise ValueError('Audits changed tensors')
 combined=core.aggregate(audits,P);return{**result,'blocks':audits,'audit':combined,'score':combined['score'],'trainingEpisodes':train.episodes,'diagnosticOnly':bool(job.get('diagnostic'))}
if __name__=='__main__':
 train=PepeV4Env('train');dev=PepeV4Env('development');diagnostic=PepeV4Env('diagnostic_train')
 try:
  for line in sys.stdin:
   job=json.loads(line)
   if job.get('kind')=='close':break
   try:print(json.dumps({'result':work(job,train,dev,diagnostic)},allow_nan=False),flush=True)
   except Exception as e:traceback.print_exc(file=sys.stderr);print(json.dumps({'error':str(e)}),flush=True)
 finally:train.close();dev.close();diagnostic.close()
