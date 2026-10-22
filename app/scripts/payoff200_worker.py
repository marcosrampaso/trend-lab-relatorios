import os
for k in ['OMP_NUM_THREADS','OPENBLAS_NUM_THREADS','MKL_NUM_THREADS','NUMEXPR_NUM_THREADS']:os.environ[k]='1'
import json,hashlib,time
from pathlib import Path
import numpy as np
import joblib
from sklearn.ensemble import HistGradientBoostingClassifier,HistGradientBoostingRegressor
from sklearn.linear_model import LogisticRegression
from payoff_entry_core import mature_rows,logit,expected_payoff
from payoff_genetic_core import validate,identity,columns

ROOT=Path(__file__).resolve().parent.parent;BASE=ROOT/'work/pepe-payoff-genetic-200-v1';P=None;DATA=None
def read(f):return json.loads(Path(f).read_text())
def sha(f):return hashlib.sha256(Path(f).read_bytes()).hexdigest()
def atomic(f,value):
    f=Path(f);tmp=f.with_name(f.name+f'.{os.getpid()}.tmp');tmp.write_text(json.dumps(value,allow_nan=False,separators=(',',':')));tmp.replace(f)
def immutable(f,value):
    with Path(f).open('x') as s:json.dump(value,s,allow_nan=False,separators=(',',':'))
    Path(f).chmod(0o444)
def initialize():
    global P,DATA
    P=read(BASE/'protocol.json');DATA=read(BASE/'dataset.json')
def block(months,side,end):return mature_rows([r for m in months for r in DATA['months'][m]],side,end,P['embargoMinutes'])
def fit_predict(g,train,calibration,grid,seed,archive=None):
    cols=columns(g);x=np.asarray([r['x'] for r in train],float)[:,cols];y=np.asarray([r['netR'] for r in train]);win=y>0
    c=np.asarray([r['x']for r in calibration],float)[:,cols];cy=np.asarray([r['netR']for r in calibration]);a=np.asarray([r['x']for r in grid],float)[:,cols]
    if len(train)<200 or len(calibration)<200 or not np.isfinite(x).all() or not np.isfinite(c).all() or not np.isfinite(a).all():raise ValueError('Invalid/insufficient causal data')
    opts={k:g[k] for k in g if k!='groups'};opts.update(early_stopping=False,random_state=seed)
    classifier=HistGradientBoostingClassifier(**opts).fit(x,win);gain=HistGradientBoostingRegressor(**opts).fit(x[win],y[win]);loss=HistGradientBoostingRegressor(**opts).fit(x[~win],-y[~win])
    calibrator=LogisticRegression(C=1,max_iter=1000).fit(logit(classifier.predict_proba(c)[:,1]),cy>0)
    prob=calibrator.predict_proba(logit(classifier.predict_proba(a)[:,1]))[:,1];gains=np.maximum(0,gain.predict(a));losses=np.maximum(0,loss.predict(a));scores=expected_payoff(prob,gains,losses)
    if archive:
        joblib.dump({'columns':cols,'classifier':classifier,'gain':gain,'loss':loss,'calibrator':calibrator,'genome':g},archive);Path(archive).chmod(0o444)
    metadata={'trainRows':len(train),'calibrationRows':len(calibration),'maxTrainExitAt':max(r['exitAt']for r in train),'maxCalibrationExitAt':max(r['exitAt']for r in calibration)}
    return scores,metadata
def choose(long,short,threshold):
    if max(long,short)<=threshold or abs(long-short)<1e-8:return 0
    return 1 if long>short else -1
def evaluate_genome(genome,archive=None):
    if P is None:initialize()
    validate(genome);key=identity(genome);file=BASE/'fits'/f'{key}.json'
    if file.exists() and archive is None:return read(file)
    started=time.monotonic();folds=[]
    if archive:Path(archive).mkdir(parents=True,exist_ok=False)
    for i,f in enumerate(P['folds']):
        grid=DATA['grids'][f['validationMonth']];scores={};maturity={}
        for side in [1,-1]:
            train=block(f['trainMonths'],side,f['trainEnd']);cal=block([f['calibrationMonth']],side,f['calibrationEnd'])
            out=Path(archive)/f'fold{i}-side{side}.joblib' if archive else None
            scores[side],maturity[str(side)]=fit_predict(genome,train,cal,grid,P['seed']+i*101+side,out)
        entries=[]
        for j,row in enumerate(grid):
            side=choose(scores[1][j],scores[-1][j],P['threshold'])
            if side:entries.append({'at':row['at'],'atr':row['atr'],'side':side})
        folds.append({'month':f['validationMonth'],'entries':entries,'maturity':maturity})
        if archive:immutable(Path(archive)/f'fold{i}-forecasts.json',{'month':f['validationMonth'],'at':[r['at']for r in grid],'long':scores[1].tolist(),'short':scores[-1].tolist()})
    result={'id':key,'genome':genome,'folds':folds,'fitSeconds':time.monotonic()-started}
    if file.exists():
        old=read(file)
        if old['genome']!=genome or old['folds']!=folds:raise ValueError('Deterministic model refit mismatch')
    else:immutable(file,result)
    return result
