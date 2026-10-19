"""Inference for the preserved ETH forests or new, locally trained BTC forests."""
import os
for key in ('OMP_NUM_THREADS','OPENBLAS_NUM_THREADS','MKL_NUM_THREADS','VECLIB_MAXIMUM_THREADS'):os.environ[key]='1'
import hashlib,json,sys
from pathlib import Path
import numpy as np,joblib
from threadpoolctl import threadpool_limits
ROOT=Path(__file__).resolve().parent.parent
def predict(r):
 out=[]
 with threadpool_limits(limits=1):
  for family in ('cross','bands'):
   rows=[v for v in r['rows'] if v['family']==family]
   if not rows:continue
   x=np.asarray([v['x'] for v in rows],dtype=float)
   if x.shape!=(len(rows),12) or not np.isfinite(x).all():raise ValueError('Feature schema')
   inventory=r['models'][family]
   if len(inventory)!=5:raise ValueError('Five seeds required')
   values=[]
   for item in inventory:
    file=(ROOT/item['path']).resolve()
    if not any(file.is_relative_to((ROOT/a).resolve()) for a in ['champions/g151-c6cb2a8370cd058b0be0/models','work/multiasset-v1/models']):raise ValueError('Unexpected model path')
    if hashlib.sha256(file.read_bytes()).hexdigest()!=item['sha256']:raise ValueError('Model hash mismatch')
    model=joblib.load(file)
    if model.n_features_in_!=12 or any(model.get_params()[k]!=v for k,v in r['params'].items()):raise ValueError('Architecture changed')
    values.append(model.predict_proba(x)[:,list(model.classes_).index(1)])
   out.extend({'id':row['id'],'score':float(v)} for row,v in zip(rows,np.mean(values,axis=0)))
 return {'scores':out,'trained':False}
if __name__=='__main__':
 try:print(json.dumps(predict(json.load(sys.stdin)),allow_nan=False))
 except Exception as e:print(str(e),file=sys.stderr);sys.exit(1)
