"""One-thread paired tree ablation: identical labels/rows/parameters, 12 versus 30 inputs."""
import os
for key in ['OMP_NUM_THREADS','OPENBLAS_NUM_THREADS','MKL_NUM_THREADS','VECLIB_MAXIMUM_THREADS','NUMEXPR_NUM_THREADS']:
    os.environ[key]='1'
import sys,json,hashlib,time
from pathlib import Path
from datetime import datetime,timezone
import numpy as np
from sklearn.tree import DecisionTreeClassifier,export_text
from threadpoolctl import threadpool_limits
import joblib

def read(p):return json.loads(Path(p).read_text())
def save(p,v):
    p=Path(p);p.parent.mkdir(parents=True,exist_ok=True);t=p.with_suffix('.tmp');t.write_text(json.dumps(v,allow_nan=False));t.replace(p)
def month_at(value,offset=0):
    y,m=map(int,value[:7].split('-'));n=y*12+m-1+offset;return int(datetime(n//12,n%12+1,1,tzinfo=timezone.utc).timestamp()*1000)
def main():
    run=Path(sys.argv[1]);reg=read(run/'registration.json');g=reg['champion'];p=reg['protocol'];inputs=read(run/'inputs.json');features=read(run/'features.json')['features'];baseline=read(run/'baseline-predictions.json');cache={};results=[]
    for file,h in {**reg['fingerprints'],**inputs['sources']}.items():
        if hashlib.sha256(Path(file).read_bytes()).hexdigest()!=h:raise ValueError('Fonte alterada: '+file)
    def status(state):save('web/data/exit-study-status.json',{'run':str(run),'state':state,'champion':g['id'],'completed':len(results),'updatedAt':datetime.now(timezone.utc).isoformat(),'realOrders':False})
    status('training_features')
    for arm_id,folds in baseline.items():
        family,hold=arm_id.split('/');hold=int(hold)
        if hold not in cache:cache[hold]=read(inputs['labelFiles'][str(hold)])['groups']
        lookup={r['at']:r for r in features[family]}
        for fold,expected in folds.items():
            end=month_at(fold,-3);start=month_at(fold,-3-g['trainMonths']);validation_end=month_at(fold)
            labels=[r for r in cache[hold][family] if start<=r['at']<end and r['labelAvailableAt']<end]
            if any(r['at'] not in lookup or lookup[r['at']]['x'][:12]!=r['x'] for r in labels):raise ValueError('Exemplos incompatíveis')
            validation=[lookup[at] for at,_ in expected]
            if any(not end<=r['at']<validation_end for r in validation):raise ValueError('Acesso fora da validação')
            y=np.asarray([r['y'] for r in labels]);name=arm_id.replace('/','-')+'-'+fold
            for count in [12,30]:
                started=time.monotonic();model=DecisionTreeClassifier(**g['params'],random_state=inputs['seed'])
                with threadpool_limits(limits=1):
                    model.fit(np.asarray([lookup[r['at']]['x'][:count] for r in labels]),y)
                    scores=model.predict_proba(np.asarray([r['x'][:count] for r in validation]))[:,list(model.classes_).index(1)]
                delta=max(abs(float(score)-old) for score,(_,old) in zip(scores,expected))
                if count==12 and delta>1e-12:raise ValueError('Modelo12 não reproduziu o campeão: '+str(delta))
                target=run/'models'/(name+'-f'+str(count)+'.joblib');target.parent.mkdir(parents=True,exist_ok=True);joblib.dump(model,target,compress=3)
                row={'arm':arm_id,'fold':fold,'features':count,'trainCount':len(labels),'trainStart':start,'trainEnd':end,'maxTrainLabelAvailableAt':max(r['labelAvailableAt'] for r in labels),'validationEnd':validation_end,'validation':[[r['at'],float(score)] for r,score in zip(validation,scores)],'baselineMaxScoreDifference':delta,'featureImportances':dict(zip(inputs['featureNames'][:count],model.feature_importances_.tolist())),'rules':export_text(model,feature_names=inputs['featureNames'][:count]),'artifactSHA256':hashlib.sha256(target.read_bytes()).hexdigest(),'seconds':time.monotonic()-started,'testPredictionsGenerated':False}
                save(run/'predictions'/(name+'-f'+str(count)+'.json'),row);results.append(row);status('training_features');print(json.dumps({'arm':arm_id,'fold':fold,'features':count,'seconds':row['seconds']}),flush=True)
    save(run/'feature-training.json',{'models':results,'workers':1,'threads':1,'sameLabels':True,'sameParameters':True,'testPredictionsGenerated':False});status('features_trained')
if __name__=='__main__':main()
