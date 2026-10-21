"""Read-only calibration support audit. Does not fit, train or save models."""
import os
for key in ['OMP_NUM_THREADS','OPENBLAS_NUM_THREADS','MKL_NUM_THREADS','NUMEXPR_NUM_THREADS']:
    os.environ[key]='1'
import json,hashlib,time
from pathlib import Path
import numpy as np
import joblib,torch
from stable_baselines3 import PPO
ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'work/pepe-opportunity-v1';P=json.loads((OUT/'protocol.json').read_text())
ORIGIN=ROOT/P['origin'];old=json.loads((ORIGIN/'protocol.json').read_text())
reg=json.loads((OUT/'registration.json').read_text())
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
for f,h in {**reg['inputs'],**reg['sourceHashes']}.items():
    if sha(ROOT/f)!=h:raise ValueError('Changed input '+f)
torch.set_num_threads(1);torch.set_num_interop_threads(1)
cal=json.loads((ORIGIN/'labels/2024-03.json').read_text())['rows']
evaluation=[]
for m in P['months']:
    outcomes={(r['at'],r['side']):r for r in json.loads((OUT/'months'/f"{m['month']}.json").read_text())['rows']}
    for r in json.loads((ORIGIN/'labels'/f"{m['month']}.json").read_text())['rows']:
        evaluation.append({**r,'month':m['month'],'outcomes':{s:outcomes[(r['at'],s)] for s in [1,-1]}})
def bin_id(v):return 0 if v<=0 else 1 if v<=.1 else 2 if v<=.25 else 3
names=['≤0R','(0; 0,1]R','(0,1; 0,25]R','>0,25R']
def describe(pred,actual,raw,lo,hi):
    return {'count':len(pred),'predictedMeanR':float(np.mean(pred)) if len(pred) else None,
        'actualMeanR':float(np.mean(actual)) if len(pred) else None,
        'maeR':float(np.mean(np.abs(pred-actual))) if len(pred) else None,
        'clippedBelow':int(np.sum(raw<lo)),'clippedAbove':int(np.sum(raw>hi))}
results={}
for j in P['jobs']:
    side=j['side'];folder=ORIGIN/'models'/j['key']
    C=[r for r in cal if r['side']==side and r['exitAt']<=old['stageEnds']['calibration']-old['embargoMinutes']*60000]
    scaler=joblib.load(folder/'scaler.joblib');calibrator=joblib.load(folder/'calibrator.joblib')
    if j['family']=='genetic':
        g=np.asarray(json.loads((folder/'genome.json').read_text())['genome'])
        def score(A):return A@g[:-1]+g[-1]
        cutoff=0
    else:
        model=PPO.load(folder/'model.zip',device='cpu');cutoff=.5
        def score(A):
            with torch.no_grad():
                return np.concatenate([model.policy.get_distribution(torch.as_tensor(a,device='cpu')).distribution.probs[:,1].cpu().numpy()
                    for a in np.array_split(A,max(1,int(np.ceil(len(A)/2048))))])
    cr=score(scaler.transform(np.asarray([r['x'] for r in C],np.float32)).astype(np.float32))
    er=score(scaler.transform(np.asarray([r['x'] for r in evaluation],np.float32)).astype(np.float32))
    cp=calibrator.predict(cr);cy=np.asarray([r['netR'] for r in C]);ey=np.asarray([r['outcomes'][side]['netR'] for r in evaluation])
    frozen=json.loads((folder/'predictions.json').read_text())['predictions']
    if [r['at'] for r in frozen]!=[r['at'] for r in evaluation]:raise ValueError('Timestamp mismatch')
    ep=np.asarray([r['netR'] for r in frozen]);reconstructed=calibrator.predict(er)
    delta=float(np.max(np.abs(ep-reconstructed)))
    if delta>1e-5 or any(bool(s>cutoff)!=r['eligible'] for s,r in zip(er,frozen)):
        raise ValueError('Frozen prediction parity failed '+j['key'])
    lo=float(np.min(cr));hi=float(np.max(cr));cb=np.asarray([bin_id(v) for v in cp]);eb=np.asarray([bin_id(v) for v in ep])
    bins=[]
    for i,name in enumerate(names):
        c=cb==i;e=eb==i
        bins.append({'name':name,'calibration':describe(cp[c],cy[c],cr[c],lo,hi),'evaluation':describe(ep[e],ey[e],er[e],lo,hi),
            'lowCalibrationSupport':int(np.sum(c))<50,'eligibleEvaluation':sum(bool(r['eligible']) for r,keep in zip(frozen,e) if keep)})
    eligible=np.asarray([r['eligible'] for r in frozen]);accepted=eligible&(ep>P['threshold'])
    model_result={'key':j['key'],'side':side,'parityMaxDifference':delta,'calibrationRows':len(C),'rawCalibrationMin':lo,'rawCalibrationMax':hi,
        'evaluation':describe(ep,ey,er,lo,hi),'accepted':describe(ep[accepted],ey[accepted],er[accepted],lo,hi),
        'acceptedUnfilled':sum(not r['outcomes'][side]['filled'] for r,keep in zip(evaluation,accepted) if keep),
        'acceptedProfitable':sum(r['outcomes'][side]['filled'] and r['outcomes'][side]['netR']>0 for r,keep in zip(evaluation,accepted) if keep),
        'profitableOpportunitiesRejected':sum(r['outcomes'][side]['filled'] and r['outcomes'][side]['netR']>0 for r,keep in zip(evaluation,accepted) if not keep),
        'bins':bins,'byMonth':[]}
    for m in P['months']:
        keep=np.asarray([r['month']==m['month'] for r in evaluation]);selected=keep&accepted
        model_result['byMonth'].append({'month':m['month'],'all':describe(ep[keep],ey[keep],er[keep],lo,hi),
            'accepted':describe(ep[selected],ey[selected],er[selected],lo,hi)})
    results[j['key']]=model_result
for f,h in {**reg['inputs'],**reg['sourceHashes']}.items():
    if sha(ROOT/f)!=h:raise ValueError('Input changed during audit '+f)
with (OUT/'calibration.json').open('x') as f:json.dump({'createdAt':int(time.time()*1000),'models':results,'fitPerformed':False},f,allow_nan=False)
(OUT/'calibration.json').chmod(0o444)
print(json.dumps({'calibrationAuditComplete':True,'models':len(results)}))
