"""Use the total200 selected genotype, never its audit score, as auxiliary context."""
import os
for k in ['OMP_NUM_THREADS','OPENBLAS_NUM_THREADS','MKL_NUM_THREADS']:os.environ[k]='1'
import importlib,json,subprocess,time
import numpy as np
import joblib
c=importlib.import_module('night-core');R,B=c.ROOT,c.BASE
from payoff_entry_core import logit,expected_payoff

def verify_revision():
 r=c.read(B/'registration-2.json')
 for f,h in r['sources'].items():
  if c.sha(R/f)!=h:raise ValueError('Revision source changed '+f)

def main():
 c.verify();verify_revision();source=R/'work/pepe-payoff-genetic-200-v1';s=c.read(source/'checkpoint.json')
 if s['completedGenerations']!=200 or not s.get('audit'):raise ValueError('Wait for total200 and its audit')
 complete=B/'context-complete.json'
 if complete.exists():
  d=c.read(complete)
  for f,h in d['artifacts'].items():
   if c.sha(R/f)!=h:raise ValueError('Context artifact changed')
  return d
 # Models fit2023 and sigmoid calibrated Jan-Feb2024; no later outcomes.
 audit=c.read(source/'final-audit/result.json');paths={}
 for side in [1,-1]:
  paths[side]=next(R/f for f in audit['artifacts']if f.endswith('.joblib')and f'/side{side}-'in f)
  if c.sha(paths[side])!=audit['artifacts'][str(paths[side].relative_to(R))]:raise ValueError('Auxiliary model hash')
  m=audit['maturity'][str(side)]
  if m['maxTrainExitAt']>=1704067200000 or m['maxCalibrationExitAt']>=1709251200000:raise ValueError('Future model label')
 subprocess.run(['node','scripts/night-grids-v2.mjs'],cwd=R,check=True)
 bundles={side:joblib.load(path)for side,path in paths.items()};artifacts={}
 for f in sorted((B/'grids').glob('*.json')):
  grid=c.read(f);x=np.asarray([r['x']for r in grid['rows']],float);v={}
  for side,b in bundles.items():
   a=x[:,b['columns']];pr=b['calibrator'].predict_proba(logit(b['classifier'].predict_proba(a)[:,1]))[:,1];gain=np.maximum(0,b['gain'].predict(a));loss=np.maximum(0,b['loss'].predict(a));ev=expected_payoff(pr,gain,loss)
   v[side]=np.column_stack([pr,gain,loss,ev])
  rows=[{'at':r['at'],'x':r['x'],'aux':np.concatenate([v[1][i],v[-1][i]]).tolist()if r['at']>=1709251200000 else [0.]*8,'available':r['at']>=1709251200000}for i,r in enumerate(grid['rows'])]
  out=B/'context'/f.name;c.immutable(out,{'month':grid['month'],'knownModelAfter':1709251200000,'rows':rows});artifacts[str(out.relative_to(R))]=c.sha(out);artifacts[str(f.relative_to(R))]=c.sha(f)
 result={'genome':s['best']['genome'],'id':s['best']['id'],'sourceSelectionCheckpointSHA256':c.sha(source/'checkpoint.json'),'models':{str(k):{'path':str(v.relative_to(R)),'sha256':c.sha(v)}for k,v in paths.items()},'artifacts':artifacts,'trainedThrough':'2023-12','calibratedThrough':'2024-02','auxiliaryTarget':'NET outcome of the frozen fixed5m exit policy; NOT a calibrated probability of PPO policy profitability.','createdAt':int(time.time()*1000)};c.immutable(complete,result);return result
if __name__=='__main__':main()
