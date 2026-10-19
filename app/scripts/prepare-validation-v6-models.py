"""Fit fixed, simpler predictors causally; never optimize against future folds."""
import os
for key in ['OMP_NUM_THREADS','OPENBLAS_NUM_THREADS','MKL_NUM_THREADS','VECLIB_MAXIMUM_THREADS','NUMEXPR_NUM_THREADS']:os.environ[key]='1'
import concurrent.futures as futures,datetime,hashlib,importlib.util,json,multiprocessing as mp,subprocess,time
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent;SOURCE=ROOT/'work/expanded-validation/g151-fixed-funding-v2';DEST=ROOT/'work/genetic-validation-v6/models'
def read(p):return json.loads(Path(p).read_text())
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def atomic(p,d):
    p=Path(p);p.parent.mkdir(parents=True,exist_ok=True);tmp=p.with_suffix(p.suffix+'.tmp');tmp.write_text(json.dumps(d,separators=(',',':'),allow_nan=False));tmp.replace(p)
def at(m,offset=0):
    y,n=map(int,m[:7].split('-'));v=y*12+n-1+offset;return int(datetime.datetime(v//12,v%12+1,1,tzinfo=datetime.timezone.utc).timestamp()*1000)
def ym(m,offset):return datetime.datetime.fromtimestamp(at(m,offset)/1000,datetime.timezone.utc).strftime('%Y-%m')
def job(task):
    import numpy as np
    from threadpoolctl import threadpool_limits
    spec=importlib.util.spec_from_file_location('models',ROOT/'scripts/train-local-ml.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    block,family,config=task;start=time.monotonic();rows=[]
    for offset in range(-9,0):rows.extend(read(SOURCE/'months'/f'{ym(block["id"],offset)}.json')['labels'][family])
    cut=at(block['id']);rows=[r for r in rows if at(block['id'],-9)<=r['at']<cut and r['labelAvailableAt']<cut]
    if len(rows)<300 or len({r['y']for r in rows})<2:raise ValueError('Treino insuficiente')
    features=[]
    for m in block['months']:features.extend(read(SOURCE/'months'/f'{m}.json')['features'][family])
    estimator=module.estimator(config,2026101802)
    with threadpool_limits(limits=1):
        estimator.fit(np.asarray([r['x']for r in rows]),np.asarray([r['y']for r in rows]));scores=estimator.predict_proba(np.asarray([r['x']for r in features]))[:,list(estimator.classes_).index(1)]
    if not np.isfinite(scores).all():raise ValueError('Score inválido')
    result={'block':block['id'],'family':family,'predictor':config['id'],'trainStart':at(block['id'],-9),'trainEnd':cut,'maxTrainLabelAvailableAt':max(r['labelAvailableAt']for r in rows),'trainCount':len(rows),'modelParams':config['params'],'algorithm':config['algorithm'],'seeds':[{'seed':2026101802}],'sourceRegistrationSHA256':sha(SOURCE/'registration.json'),'trainingRegistrationSHA256':sha(DEST/'registration.json'),'predictions':[[r['at'],float(s)]for r,s in zip(features,scores)],'seconds':time.monotonic()-start,'labelRisk':.01,'newMLFit':True}
    atomic(DEST/f'{block["id"]}-{family}-{config["id"]}.json',result);return {'block':block['id'],'family':family,'predictor':config['id'],'seconds':result['seconds']}
def main():
    os.chdir(ROOT);protocol=read(ROOT/'genetic-validation-v6-protocol.json');source=read(SOURCE/'registration.json');configs=[v for k,v in protocol['predictors'].items()if k!='rf_g151'];files=[ROOT/'genetic-validation-v6-protocol.json',Path(__file__),SOURCE/'registration.json',ROOT/'scripts/train-local-ml.py',*sorted((SOURCE/'months').glob('*.json'))];hashes={str(f.relative_to(ROOT)):sha(f)for f in files};registration=DEST/'registration.json'
    if registration.exists():
        if read(registration)['sourceHashes']!=hashes:raise ValueError('Fontes alteradas')
    else:atomic(registration,{'registeredAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'configs':configs,'sourceHashes':hashes,'workers':2,'labelRisk':.01,'realOrders':False})
    tasks=[(b,f,c)for b in source['plan']['blocks']for f in ['cross','bands']for c in configs if not(DEST/f'{b["id"]}-{f}-{c["id"]}.json').exists()]
    total=len(source['plan']['blocks'])*2*len(configs);completed=total-len(tasks)
    def publish(stage):atomic(DEST/'status.json',{'stage':stage,'updatedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'completed':completed,'total':total,'workers':2,'realOrders':False})
    publish('training')
    with futures.ProcessPoolExecutor(max_workers=2,mp_context=mp.get_context('spawn'))as pool:
        jobs=[pool.submit(job,t)for t in tasks]
        for future in futures.as_completed(jobs):print(json.dumps(future.result()),flush=True);completed+=1;publish('training')
    publish('complete')
    subprocess.run(['node','scripts/run-genetic-validation-v6.mjs'],check=True)
if __name__=='__main__':main()
