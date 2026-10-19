"""Fixed G151 architecture fitted to BTC, before the test period; no search."""
import os
for key in ('OMP_NUM_THREADS','OPENBLAS_NUM_THREADS','MKL_NUM_THREADS','VECLIB_MAXIMUM_THREADS'):os.environ[key]='1'
import hashlib,json,sys,time,concurrent.futures,multiprocessing
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent;BASE=ROOT/'work/multiasset-v1'
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def atomic(p,d):
 t=p.with_suffix('.tmp');t.write_text(json.dumps(d,allow_nan=False));t.replace(p)
def fit(task):
 import joblib,numpy as np
 from sklearn.ensemble import RandomForestClassifier
 from threadpoolctl import threadpool_limits
 family,seed=task;d=json.loads((BASE/'btc-training.json').read_text());rows=d['groups'][family]
 if len(rows)<300 or len({r['y'] for r in rows})!=2:raise ValueError('Insufficient BTC labels')
 if any(r['at']<d['trainStart'] or r['labelAvailableAt']>=d['trainEnd'] or r['at']>=d['trainEnd'] for r in rows):raise ValueError('Future training label')
 target=BASE/'models'/f'{family}-{seed}.joblib';model=RandomForestClassifier(**d['params'],random_state=seed,n_jobs=1)
 with threadpool_limits(limits=1):model.fit(np.asarray([r['x'] for r in rows]),np.asarray([r['y'] for r in rows]))
 joblib.dump(model,target,compress=3)
 record={'family':family,'seed':seed,'path':str(target.relative_to(ROOT)),'sha256':sha(target),'trainStart':d['trainStart'],'trainEnd':d['trainEnd'],'maxLabelAvailableAt':max(r['labelAvailableAt'] for r in rows),'trainCount':len(rows),'positive':sum(r['y'] for r in rows),'params':d['params'],'trainingDataSHA256':sha(BASE/'btc-training.json')}
 atomic(target.with_suffix('.json'),record);return record
def main():
 import sklearn,numpy,joblib
 (BASE/'models').mkdir(exist_ok=True);d=json.loads((BASE/'btc-training.json').read_text());p=json.loads((ROOT/'multiasset-sentiment-protocol.json').read_text());tasks=[(f,s) for f in d['groups'] for s in d['seeds']];done=[];status={'status':'training','startedAt':int(time.time()*1000),'completed':0,'total':len(tasks),'workers':p['forest']['workers'],'sklearn':sklearn.__version__,'numpy':numpy.__version__,'joblib':joblib.__version__,'trainingDataSHA256':sha(BASE/'btc-training.json')}
 atomic(BASE/'training-status.json',status)
 with concurrent.futures.ProcessPoolExecutor(max_workers=p['forest']['workers'],mp_context=multiprocessing.get_context('spawn')) as pool:
  for item in pool.map(fit,tasks):
   done.append(item);status.update({'completed':len(done),'updatedAt':int(time.time()*1000)});atomic(BASE/'training-status.json',status);print(json.dumps({'family':item['family'],'seed':item['seed'],'completed':len(done),'total':len(tasks)}),flush=True)
 atomic(BASE/'btc-models.json',{'models':{f:[r for r in done if r['family']==f] for f in d['groups']},'params':d['params'],'trainedAt':int(time.time()*1000),'source':'BTCUSDT matured labels, corrected funding and1min delayed entry; fixed G151 architecture','versions':{k:status[k] for k in ['sklearn','numpy','joblib']}});status['status']='complete';atomic(BASE/'training-status.json',status)
if __name__=='__main__':main()
