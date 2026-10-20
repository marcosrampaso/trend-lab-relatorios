"""Forensic replay in an isolated directory; never alters the completed experiment."""
import os,json,hashlib,subprocess,sys,time
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent;os.chdir(ROOT)
os.environ['MPLCONFIGDIR']=str(ROOT/'work/finrl-cache/matplotlib');os.environ['XDG_CACHE_HOME']=str(ROOT/'work/finrl-cache')
BASE=ROOT/'work/pepe-g830-audit-v1';BASE.mkdir(parents=True,exist_ok=True);PARENT=ROOT/'work/pepe-finrl-v2';policy=json.loads((ROOT/'pepe-finrl-protocol.json').read_text());cache={}
def read(p):return json.loads(Path(p).read_text())
def atomic(file,obj):
 tmp=Path(str(file)+'.tmp');tmp.write_text(json.dumps(obj,separators=(',',':')));tmp.replace(file)
def generation(g):
 if g not in cache:cache[g]=read(PARENT/f'generations/g{g}.json')
 return cache[g]
def row(g,aid):return next(r for r in generation(g)['results']if r['id']==aid)
def seed_for(g,aid):
 for prev in range(g-1,0,-1):
  change=next((c for c in generation(prev)['changes']if c['id']==aid),None)
  if change:return policy['globalSeed']+prev*100003+aid*997
 return policy['globalSeed']+aid*997
winner=max(generation(830)['results'],key=lambda r:r['score']);chain=[];g=830;aid=winner['id']
while True:
 chain.append((g,aid))
 if g==1:break
 change=next((c for c in generation(g-1)['changes']if c['id']==aid),None)
 if change:
  if change['fresh']:break
  aid=change['parent']
 g-=1
chain.reverse();weights=BASE/'replayed.zip'
if weights.exists():raise RuntimeError('Audit already has replay weights; preserve previous attempt')
registration={'registeredAt':int(time.time()*1000),'purpose':'Forensic reconstruction of G830 champion; post-hoc development audit only; not independent holdout','targetGeneration':830,'targetID':winner['id'],'historicalModelSHA256':winner['modelSHA256'],'lineage':chain,'sourceSHA256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'parentRegistrationSHA256':hashlib.sha256((PARENT/'registration.json').read_bytes()).hexdigest(),'lineageLedgers':{str(g):hashlib.sha256((PARENT/f'generations/g{g}.json').read_bytes()).hexdigest()for g,_ in chain},'noParentWrites':True,'noFinalTest':True};atomic(BASE/'registration.json',registration)
log=open(BASE/'worker.log','a');worker=subprocess.Popen([str(ROOT/'.venv-rl/bin/python'),'scripts/pepe-pbt-worker.py'],cwd=ROOT,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=log,text=True,bufsize=1);checks=[]
try:
 for g,aid in chain:
  expected=row(g,aid);job={'kind':'train','id':aid,'generation':g,'seed':seed_for(g,aid),'modelPath':str(weights.relative_to(ROOT)),'hyperparameters':expected['hyperparameters'],'window':generation(g)['probeWindow']};worker.stdin.write(json.dumps(job)+'\n');worker.stdin.flush();line=worker.stdout.readline()
  if not line:raise RuntimeError('Replay worker stopped')
  response=json.loads(line)
  if 'error'in response:raise RuntimeError(response['error'])
  got=response['result'];differences={}
  for key in ['pnlBRL','finalBRL','maxDD','feesBRL','fundingBRL','grossBRL','slippageBRL','score']:
   if abs(got[key]-expected[key])>1e-7:differences[key]={'expected':expected[key],'replay':got[key]}
  for key in ['count','actions','ignoredActions','partialExits','stopMoves','boundaryExits']:
   if got[key]!=expected[key]:differences[key]={'expected':expected[key],'replay':got[key]}
  check={'generation':g,'id':aid,'seed':job['seed'],'matchedRecordedMetrics':not differences,'differences':differences,'historicalZipSHA256':expected['modelSHA256'],'replayedZipSHA256':got['modelSHA256'],'replay':got};checks.append(check);atomic(BASE/'replay-checks.json',checks);print(json.dumps({k:check[k]for k in ['generation','id','matchedRecordedMetrics','differences']}),flush=True)
  if differences:raise RuntimeError('Replay diverges; do not claim recovery of original policy')
finally:
 if worker.poll()is None:
  worker.stdin.write('{"kind":"close"}\n');worker.stdin.flush();worker.wait(timeout=10)
 log.close()
# Do not claim byte-identical recovery: archive hashes differ, even with all replay checks matching.
import torch
torch.set_num_threads(2)
from stable_baselines3 import PPO
from pepe_finrl_env import PepeScalpEnv
model=PPO.load(weights,device='cpu');env=PepeScalpEnv('development')
try:
 obs,_=env.reset(seed=seed_for(830,winner['id']));done=False
 while not done:
  action,_=model.predict(obs,deterministic=True);obs,_,done,_,_=env.step(action)
 quarter=env.last_summary
finally:env.close()
result={'status':'complete','completedAt':int(time.time()*1000),'lineageSteps':len(checks),'allRecordedProbeMetricsMatched':all(x['matchedRecordedMetrics']for x in checks),'exactHistoricalWeightsRecovered':False,'weightsCaveat':'Original G830 zip was not archived; this is an isolated reconstruction matching recorded probes, not cryptographic recovery of the original.','historicalProbe':winner,'replayedProbe':checks[-1]['replay'],'fullQuarter':quarter,'scope':'Exploratory post-hoc development-quarter evaluation Oct-Dec2024. No2025/2026 final-test data used. No original checkpoint or score changed.','realOrders':False};atomic(BASE/'result.json',result);atomic(ROOT/'web/data/pepe-g830-audit.json',result);print(json.dumps({'audit':'complete','probePnlBRL':result['replayedProbe']['pnlBRL'],'quarterPnlBRL':quarter['pnlBRL'],'quarterCount':quarter['count'],'quarterMaxDD':quarter['maxDD']}),flush=True)
