import os
for k in ['OMP_NUM_THREADS','OPENBLAS_NUM_THREADS','MKL_NUM_THREADS']:os.environ[k]='1'
import importlib,json,sys
import joblib,numpy as np
from payoff_entry_core import logit,expected_payoff
c=importlib.import_module('night-core');d=c.read(c.BASE/'context-complete.json');models={}
for side,row in d['models'].items():
 if c.sha(c.ROOT/row['path'])!=row['sha256']:raise ValueError('Paper weights changed')
 models[side]=joblib.load(c.ROOT/row['path'])
for line in sys.stdin:
 try:
  row=json.loads(line);x=np.asarray(row['x'],float).reshape(1,19);out={}
  for side,b in models.items():
   a=x[:,b['columns']];p=b['calibrator'].predict_proba(logit(b['classifier'].predict_proba(a)[:,1]))[:,1];g=np.maximum(0,b['gain'].predict(a));l=np.maximum(0,b['loss'].predict(a));out[side]=float(expected_payoff(p,g,l)[0])
  print(json.dumps(out,allow_nan=False),flush=True)
 except Exception as e:print(json.dumps({'error':str(e)}),flush=True)
