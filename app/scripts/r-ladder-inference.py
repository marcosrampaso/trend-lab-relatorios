"""Read-only inference of frozen entry models; old exit calibration is not refitted."""
import os
for k in ['OMP_NUM_THREADS','OPENBLAS_NUM_THREADS','MKL_NUM_THREADS','NUMEXPR_NUM_THREADS']:os.environ[k]='1'
import json,hashlib
from pathlib import Path
import numpy as np,joblib,torch
from stable_baselines3 import PPO
ROOT=Path(__file__).resolve().parent.parent;OUT=ROOT/'work/pepe-r-ladder-v1';P=json.loads((OUT/'protocol.json').read_text())
REG=json.loads((OUT/'registration.json').read_text());checks={**REG['inputs'],**REG['sourceHashes']}
def verify():
 for f,h in checks.items():
  if hashlib.sha256((ROOT/f).read_bytes()).hexdigest()!=h:raise ValueError('Changed source '+f)
verify();torch.set_num_threads(1);torch.set_num_interop_threads(1)
for j in P['jobs']:
 folder=ROOT/P['origin']/'models'/j['key'];scaler=joblib.load(folder/'scaler.joblib');cal=joblib.load(folder/'calibrator.joblib')
 if j['family']=='genetic':
  g=np.asarray(json.loads((folder/'genome.json').read_text())['genome'])
  def score(A):return A@g[:-1]+g[-1]
  cutoff=0
 else:
  model=PPO.load(folder/'model.zip',device='cpu');cutoff=.5
  def score(A):
   with torch.no_grad():return np.concatenate([model.policy.get_distribution(torch.as_tensor(a,device='cpu')).distribution.probs[:,1].cpu().numpy() for a in np.array_split(A,max(1,int(np.ceil(len(A)/2048))))])
 saved={r['at']:r for r in json.loads((folder/'predictions.json').read_text())['predictions']};predictions=[];max_delta=0.;old_count=0
 for m in P['months']:
  rows=json.loads((OUT/'grids'/f"{m['month']}.json").read_text())['rows'];A=np.asarray([r['x'] for r in rows],np.float32)
  raw=score(scaler.transform(A).astype(np.float32));values=cal.predict(raw)
  for f,s,v in zip(rows,raw,values):
   now={'at':f['at'],'eligible':bool(s>cutoff),'netR':float(v)}
   if f['at'] in saved:
    prior=saved[f['at']];max_delta=max(max_delta,abs(prior['netR']-now['netR']));old_count+=1
    if prior['eligible']!=now['eligible'] or abs(prior['netR']-now['netR'])>1e-5:raise ValueError('Old entry prediction changed')
    now=prior
   predictions.append(now)
 file=OUT/'predictions'/f"{j['key']}.json"
 with file.open('x') as f:json.dump({'key':j['key'],'predictions':predictions,'oldParityRows':old_count,'parityMaxDifference':max_delta,'fitPerformed':False,'forecastTarget':'original margin-exit outcome only; not a calibrated forecast for R-ladder'},f,allow_nan=False)
 file.chmod(0o444)
verify();print(json.dumps({'frozenInferenceComplete':True,'fitPerformed':False}))
