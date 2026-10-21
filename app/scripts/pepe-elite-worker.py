"""Paired child updates using the original environment and training implementation."""
import importlib,json,sys,traceback,hashlib,time
core=importlib.import_module('pepe-elite-core');original=importlib.import_module('pepe-mask-worker')
ROOT,RUN=core.ROOT,core.RUN

def tensor_sha(model):
 digest=hashlib.sha256()
 for name,tensor in sorted(model.policy.state_dict().items()):
  t=tensor.detach().cpu().contiguous();digest.update(name.encode());digest.update(str(t.dtype).encode());digest.update(str(tuple(t.shape)).encode());digest.update(t.numpy().tobytes())
 return digest.hexdigest()

def work(job,train,dev):
 started=time.monotonic();source=ROOT/job['sourcePath']
 if core.sha(source)!=job['sourceSHA256']:raise ValueError('Source model changed')
 receipt_file=RUN/'receipts'/(job['key']+'.json');steps=0
 if receipt_file.exists():
  receipt=core.read(receipt_file)
  if receipt['jobSHA256']!=job_hash(job):raise ValueError('Receipt belongs to another job')
  model_path=ROOT/receipt['modelPath']
  if core.sha(model_path)!=receipt['modelSHA256']:raise ValueError('Receipt snapshot changed')
  model=original.MaskablePPO.load(model_path,env=train,device='cpu');steps=receipt['trainingSteps']
 else:
  model=original.MaskablePPO.load(source,env=train,device='cpu')
  before=tensor_sha(model)
  if job['kind']=='train':
   hp=job['hyperparameters'];model.learning_rate=hp['learning_rate'];model.lr_schedule=lambda _:hp['learning_rate'];model.ent_coef=hp['ent_coef'];model.gamma=hp['gamma'];model.rollout_buffer.gamma=hp['gamma'];model.clip_range=lambda _:hp['clip_range']
   for group in model.policy.optimizer.param_groups:group['lr']=hp['learning_rate']
   model.set_random_seed(job['seed']);train.reset(seed=job['seed']);n=int(model.num_timesteps)
   model.learn(total_timesteps=job['steps'],reset_num_timesteps=False,progress_bar=False);steps=int(model.num_timesteps)-n
   model_path=RUN/'candidates'/(job['key']+'.zip')
   if model_path.exists():raise ValueError('Orphan snapshot: inspect before resuming, never overwrite')
   original.save_model(model,model_path);model_path.chmod(0o444)
  elif job['kind']=='frozen':model_path=source
  else:raise ValueError('Unknown job kind')
  after=tensor_sha(model)
  if job['kind']=='frozen'and before!=after:raise ValueError('Frozen model was modified')
  receipt={'jobSHA256':job_hash(job),'sourceSHA256':job['sourceSHA256'],'modelPath':str(model_path.relative_to(ROOT)),'modelSHA256':core.sha(model_path),'tensorSHA256':after,'trainingSteps':steps,'sourceTensorSHA256':before}
  core.immutable(receipt_file,receipt)
 audit=original.evaluate(model,dev,seed=job['seed']);audit['score']=original.score(audit)
 if core.sha(source)!=job['sourceSHA256']or tensor_sha(model)!=receipt['tensorSHA256']:raise ValueError('Evaluation modified model/source')
 return {'key':job['key'],'round':job['round'],'kind':job['kind'],'arm':job.get('arm'),'parent':job['parent'],'pair':job.get('pair'),'seed':job['seed'],'audit':audit,'score':audit['score'],'seconds':time.monotonic()-started,**receipt,'realOrders':False}

def job_hash(job):return hashlib.sha256(json.dumps(job,sort_keys=True,separators=(',',':')).encode()).hexdigest()
if __name__=='__main__':
 train=original.PepeMaskedEnv('train');dev=original.PepeMaskedEnv('development')
 try:
  for line in sys.stdin:
   job=json.loads(line)
   if job.get('kind')=='close':break
   try:print(json.dumps({'result':work(job,train,dev)},allow_nan=False),flush=True)
   except Exception as e:traceback.print_exc(file=sys.stderr);print(json.dumps({'error':str(e)}),flush=True)
 finally:train.close();dev.close()
