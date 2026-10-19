"""Fixed G151 temporal evaluation, two CPU workers, no parameter search or orders."""
import os
for name in ['OMP_NUM_THREADS','OPENBLAS_NUM_THREADS','MKL_NUM_THREADS','VECLIB_MAXIMUM_THREADS','NUMEXPR_NUM_THREADS']:
    os.environ[name]='1'
import concurrent.futures as futures
import hashlib,json,multiprocessing as mp,subprocess,time,traceback
from datetime import datetime,timezone
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
RUN=ROOT/'work/expanded-validation/g151-fixed-funding-v2'
def read(file):return json.loads(Path(file).read_text())
def sha(file):return hashlib.sha256(Path(file).read_bytes()).hexdigest()
def atomic(file,data):
    file=Path(file);file.parent.mkdir(parents=True,exist_ok=True)
    tmp=file.with_suffix(file.suffix+'.tmp');tmp.write_text(json.dumps(data,separators=(',',':'),allow_nan=False));tmp.replace(file)
def now():return datetime.now(timezone.utc).isoformat()
def at(month,offset=0):
    y,m=map(int,month[:7].split('-'));n=y*12+m-1+offset
    return int(datetime(n//12,n%12+1,1,tzinfo=timezone.utc).timestamp()*1000)
def month(value):return datetime.fromtimestamp(value/1000,timezone.utc).strftime('%Y-%m')
def valid_train(rows,start,end):return [r for r in rows if start<=r['at']<end and r['labelAvailableAt']<end]

def fit_arm(task):
    import numpy as np
    from sklearn.ensemble import RandomForestClassifier
    from threadpoolctl import threadpool_limits
    started=time.monotonic();p=read(RUN/'registration.json');block,family,hold=task
    train_start,train_end=at(block['trainStart']),at(block['trainEnd'])
    train=[]
    for offset in range(9):train.extend(read(RUN/'months'/f'{month(at(block["trainStart"],offset))}.json')['labels'][family])
    train=valid_train(train,train_start,train_end)
    if len(train)<300 or len({r['y'] for r in train})<2:raise ValueError('Treino insuficiente '+str(task))
    features=[]
    for m in block['months']:features.extend(read(RUN/'months'/f'{m}.json')['features'][family])
    if any(r['at']<train_end or r['hourlyAt']>r['at'] or r['fourHourlyAt']>r['at'] for r in features):raise ValueError('Feature futura')
    x=np.asarray([r['x']for r in train]);y=np.asarray([r['y']for r in train]);test=np.asarray([r['x']for r in features])
    predictions=[];seed_results=[]
    for seed in p['seeds']:
        estimator=RandomForestClassifier(**p['genome']['params'],n_jobs=1,random_state=seed)
        with threadpool_limits(limits=1):
            estimator.fit(x,y)
            values=estimator.predict_proba(test)[:,list(estimator.classes_).index(1)] if len(features) else np.asarray([])
        if not np.isfinite(values).all():raise ValueError('Predições inválidas')
        predictions.append(values)
        seed_results.append({'seed':seed,'predictionSHA256':hashlib.sha256(values.tobytes()).hexdigest()})
    values=np.mean(np.asarray(predictions),axis=0)
    output={'block':block['id'],'family':family,'hold':hold,'trainStart':train_start,'trainEnd':train_end,'maxTrainLabelAvailableAt':max(r['labelAvailableAt']for r in train),'trainCount':len(train),'classCounts':{str(v):int(sum(y==v))for v in [0,1]},'seeds':seed_results,'predictions':[[r['at'],float(v)]for r,v in zip(features,values)],'seconds':time.monotonic()-started,'completedAt':now(),'registrationSHA256':sha(RUN/'registration.json'),'trainingRowsSHA256':hashlib.sha256(json.dumps(train,separators=(',',':')).encode()).hexdigest(),'modelParams':p['genome']['params'],'noTuning':True}
    file=RUN/'predictions'/f'{block["id"]}-{family}.json';atomic(file,output)
    return {'block':block['id'],'family':family,'seconds':output['seconds'],'trainCount':len(train)}

def main():
    os.chdir(ROOT)
    subprocess.run(['node','scripts/prepare-expanded-validation-funding.mjs'],check=True)
    p=read(RUN/'registration.json');tasks=[]
    for block in p['plan']['blocks']:
        for family,hold in [('cross',120),('bands',240)]:
            file=RUN/'predictions'/f'{block["id"]}-{family}.json'
            if file.exists() and read(file)['registrationSHA256']==sha(RUN/'registration.json'):continue
            tasks.append((block,family,hold))
    def update(stage,**extra):
        s=read(RUN/'status.json');s.update(stage=stage,updatedAt=now(),**extra);atomic(RUN/'status.json',s)
    update('training',pid=os.getpid(),workers=2,jobsPending=len(tasks),jobsTotal=len(p['plan']['blocks'])*2)
    subprocess.run(['node','scripts/evaluate-expanded-validation-funding.mjs'],check=True)
    with futures.ProcessPoolExecutor(max_workers=2,mp_context=mp.get_context('spawn'))as pool:
        pending={pool.submit(fit_arm,t):t for t in tasks}
        for job in futures.as_completed(pending):
            result=job.result();print(json.dumps(result),flush=True)
            update('training',lastFit=result,jobsCompleted=len(list((RUN/'predictions').glob('*.json'))))
            subprocess.run(['node','scripts/evaluate-expanded-validation-funding.mjs'],check=True)
    update('complete',finishedAt=now())
    subprocess.run(['node','scripts/evaluate-expanded-validation-funding.mjs'],check=True)

if __name__=='__main__':
    try:main()
    except Exception as error:
        s=read(RUN/'status.json')if(RUN/'status.json').exists()else{}
        s.update(stage='failed',updatedAt=now(),error=str(error));atomic(RUN/'status.json',s)
        traceback.print_exc();raise
