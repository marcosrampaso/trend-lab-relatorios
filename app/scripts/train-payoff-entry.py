"""Fixed chronological net-payoff entry experiment; no search or exit learning."""
import os
for key in ['OMP_NUM_THREADS','OPENBLAS_NUM_THREADS','MKL_NUM_THREADS','NUMEXPR_NUM_THREADS']:
    os.environ[key]='1'
import hashlib,json,time
from pathlib import Path
import numpy as np
import joblib
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import HistGradientBoostingClassifier,HistGradientBoostingRegressor
from sklearn.metrics import roc_auc_score,brier_score_loss,mean_absolute_error
from payoff_entry_core import mature_rows,logit,expected_payoff,score_bin

ROOT=Path(__file__).resolve().parent.parent
BASE=ROOT/'work/pepe-payoff-entry-v1'
def read(file):return json.loads(Path(file).read_text())
def sha(file):return hashlib.sha256(Path(file).read_bytes()).hexdigest()
def write(file,value):
    with Path(file).open('x') as stream:json.dump(value,stream,allow_nan=False,separators=(',',':'))
    Path(file).chmod(0o444)
P=read(BASE/'protocol.json');REG=read(BASE/'registration.json')
def verify():
    if sha(BASE/'protocol.json')!=REG['protocolSHA256']:raise ValueError('Changed protocol')
    for f,h in {**REG['inputs'],**REG['sourceHashes']}.items():
        if sha(ROOT/f)!=h:raise ValueError('Changed registered input '+f)
verify()
def stage_rows(months,side,end):
    rows=[]
    for m in months:
        rows.extend({**r,'month':m['month']} for r in read(ROOT/P['specialists']/'labels'/f"{m['month']}.json")['rows'])
    out=mature_rows(rows,side,end,P['embargoMinutes'])
    if len(out)<200:raise ValueError('Insufficient chronological rows')
    return out
def X(rows):
    a=np.asarray([r['x'] for r in rows],dtype=float)
    if a.ndim!=2 or a.shape[1]!=19 or not np.isfinite(a).all():raise ValueError('Invalid feature input')
    return a
def Y(rows):return np.asarray([r['netR'] for r in rows],dtype=float)
def components(bundle,a):
    z=bundle['scaler'].transform(a) if bundle['scaler'] is not None else a
    raw=bundle['classifier'].predict_proba(z)[:,1]
    prob=bundle['calibrator'].predict_proba(logit(raw))[:,1]
    gain=np.full(len(a),bundle['constantGain']) if bundle['gain'] is None else np.maximum(0,bundle['gain'].predict(a))
    loss=np.full(len(a),bundle['constantLoss']) if bundle['loss'] is None else np.maximum(0,bundle['loss'].predict(a))
    return raw,prob,gain,loss,expected_payoff(prob,gain,loss)
def mean(a):return float(np.mean(a)) if len(a) else None
def metrics(rows,bundle):
    a=X(rows);y=Y(rows);raw,prob,gain,loss,score=components(bundle,a);positive=y>0;chosen=score>P['threshold']
    bins=[]
    for key in ['nonpositive','zeroTo01','01To025','above025']:
        take=np.asarray([score_bin(v)==key for v in score]);n=int(take.sum())
        bins.append({'bin':key,'count':n,'supported':n>=P['minimumBinSupport'],'predictedMeanR':mean(score[take]),'observedMeanR':mean(y[take]),'positiveRate':mean(positive[take])})
    reliability=[]
    for low in [0,.2,.4,.6,.8]:
        take=(prob>=low)&(prob<(low+.2) if low<.8 else prob<=1)
        reliability.append({'low':low,'high':low+.2,'count':int(take.sum()),'predictedProbability':mean(prob[take]),'observedFrequency':mean(positive[take])})
    denominator=gain+loss
    return {'count':len(y),'positiveRate':mean(positive),'meanNetR':mean(y),'meanWinR':mean(y[positive]),'meanLossR':mean(y[y<0]),
        'rawAUC':float(roc_auc_score(positive,raw)) if len(set(positive))==2 else None,
        'auc':float(roc_auc_score(positive,prob)) if len(set(positive))==2 else None,
        'brier':float(brier_score_loss(positive,prob)),'trainingPriorBrier':float(brier_score_loss(positive,np.full(len(y),bundle['prior']))),
        'expectedMAE':float(mean_absolute_error(y,score)),'predictedMeanR':mean(score),'meanBreakEvenProbability':mean(np.divide(loss,denominator,out=np.zeros_like(loss),where=denominator>0)),
        'selected':int(chosen.sum()),'coverage':mean(chosen),'selectedMeanR':mean(y[chosen]),'selectedPredictedR':mean(score[chosen]),
        'opportunityContributionR':mean(y*chosen),'bins':bins,'reliability':reliability}

artifacts={}
for side in P['sides']:
    train=stage_rows(P['trainMonths'],side,P['cutoffs']['train'])
    calibration=stage_rows(P['probabilityCalibrationMonths'],side,P['cutoffs']['calibration'])
    diagnostic=stage_rows(P['diagnosticMonths'],side,P['cutoffs']['diagnostic'])
    a,y=X(train),Y(train);c,cy=X(calibration),Y(calibration);win=y>0
    for family in P['families']:
        key=f'{family}-{side}';out=BASE/'models'/key
        if out.exists():raise ValueError('Existing model directory; refuse overwrite '+key)
        out.mkdir()
        print(json.dumps({'phase':'training','key':key,'trainRows':len(train),'calibrationRows':len(calibration)}),flush=True)
        bundle={'scaler':None,'classifier':None,'calibrator':None,'gain':None,'loss':None,'prior':float(win.mean()),'constantGain':float(y[win].mean()),'constantLoss':float(-y[~win].mean())}
        if family=='logistic':
            opts=P['models']['logistic'];scaler=StandardScaler().fit(a);bundle['scaler']=scaler
            bundle['classifier']=LogisticRegression(C=opts['C'],max_iter=opts['max_iter']).fit(scaler.transform(a),win)
        else:
            opts={k:P['models']['payoff_boost'][k] for k in ['learning_rate','max_iter','max_leaf_nodes','max_depth','min_samples_leaf','l2_regularization','early_stopping','random_state']}
            bundle['classifier']=HistGradientBoostingClassifier(**opts).fit(a,win)
            bundle['gain']=HistGradientBoostingRegressor(**opts).fit(a[win],y[win])
            bundle['loss']=HistGradientBoostingRegressor(**opts).fit(a[~win],-y[~win])
        z=bundle['scaler'].transform(c) if bundle['scaler'] is not None else c
        raw=bundle['classifier'].predict_proba(z)[:,1];cal=P['models']['calibration']
        bundle['calibrator']=LogisticRegression(C=cal['C'],max_iter=cal['max_iter']).fit(logit(raw),cy>0)
        # The model archive is written before loading evaluation outcomes.
        model_file=out/'model.joblib';joblib.dump(bundle,model_file);model_file.chmod(0o444)
        stages={name:metrics(rows,bundle) for name,rows in [('train',train),('calibration',calibration),('diagnostic',diagnostic)]}
        sensitivity={};original=X(diagnostic);target=Y(diagnostic);base_mae=stages['diagnostic']['expectedMAE']
        for group,columns in P['sensitivityGroups'].items():
            values=[]
            for days in [7,14,21]:
                shifted=original.copy();shifted[:,columns]=np.roll(original[:,columns],days*48,axis=0)
                score=components(bundle,shifted)[-1];values.append(float(mean_absolute_error(target,score))-base_mae)
            sensitivity[group]={'shiftsDays':[7,14,21],'deltaMAE':values,'meanDeltaMAE':float(np.mean(values))}
        predictions=[];evaluation={}
        for m in P['months']:
            grid=read(ROOT/P['gridsParent']/'grids'/f"{m['month']}.json")['rows']
            if any(r['knownAt']>r['at'] for r in grid):raise ValueError('Future feature')
            raw,prob,gain,loss,score=components(bundle,X(grid))
            predictions.extend({'at':r['at'],'month':m['month'],'probProfit':float(pr),'gainR':float(g),'lossR':float(l),'netR':float(v),'bin':score_bin(v)} for r,pr,g,l,v in zip(grid,prob,gain,loss,score))
            labels={r['at']:r['current'] for r in read(ROOT/P['parent']/'pairs'/f"{m['month']}.json")['rows'] if r['side']==side}
            evaluation[m['month']]=metrics([{**f,'netR':labels[f['at']]['netR']} for f in grid],bundle)
        info={'key':key,'family':family,'side':side,'stages':stages,'evaluation':evaluation,'sensitivity':sensitivity,
            'stageMaturity':{name:{'count':len(rows),'maxFeatureAt':max(r['at'] for r in rows),'maxExitAt':max(r['exitAt'] for r in rows)} for name,rows in [('train',train),('calibration',calibration),('diagnostic',diagnostic)]},
            'calibrationSlope':float(bundle['calibrator'].coef_[0,0]),'modelSHA256':sha(model_file),'notIndependentValidation':True}
        write(out/'metrics.json',info);write(out/'predictions.json',{'key':key,'side':side,'predictions':predictions})
        files={str(f.relative_to(ROOT)):sha(f) for f in out.iterdir() if f.is_file()}
        write(out/'complete.json',{'key':key,'completedAt':int(time.time()*1000),'artifacts':files});artifacts[key]=files
        print(json.dumps({'phase':'complete','key':key,'MarchSelected':stages['diagnostic']['selected']}),flush=True)
verify();write(BASE/'training-complete.json',{'completedAt':int(time.time()*1000),'models':artifacts,'train':True,'realOrders':False})
