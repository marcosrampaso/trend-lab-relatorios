"""Finite offline shadow POC; no PPO policy or final-test access."""
import os
for key in ['OMP_NUM_THREADS','OPENBLAS_NUM_THREADS','MKL_NUM_THREADS','NUMEXPR_NUM_THREADS']:os.environ[key]='1'
try:os.nice(10)
except OSError:pass
import hashlib,json,time,sys,importlib.util
from pathlib import Path
from datetime import datetime,timezone
ROOT=Path(__file__).resolve().parent.parent;os.chdir(ROOT)
spec=importlib.util.spec_from_file_location('nb_core',ROOT/'scripts/pepe-nb-risk-core.py');core=importlib.util.module_from_spec(spec);spec.loader.exec_module(core)
import numpy as np
from sklearn.naive_bayes import GaussianNB
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import make_pipeline
from sklearn.calibration import CalibratedClassifierCV
from sklearn.frozen import FrozenEstimator
from sklearn.metrics import log_loss,balanced_accuracy_score,confusion_matrix
import sklearn,joblib
BASE=ROOT/'work/pepe-nb-poc-v2';BASE.mkdir(parents=True,exist_ok=True)
read=lambda p:json.loads(Path(p).read_text())
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
stamp=lambda m:int(datetime.strptime(m,'%Y-%m').replace(tzinfo=timezone.utc).timestamp()*1000)
def atomic(file,obj):
 file=Path(file);file.parent.mkdir(parents=True,exist_ok=True);tmp=file.with_suffix('.tmp');tmp.write_text(json.dumps(obj,separators=(',',':'),allow_nan=False));tmp.replace(file)
config={'id':'pepe-nb-poc-v2','symbol':'1000PEPEUSDT','horizonMinutes':30,'stopATR':1.5,'thresholdsInStopDistance':[.5,1.0],'classes':core.CLASSES,'fit':['2023-06','2024-06'],'calibration':['2024-06','2024-08'],'evaluation':['2024-10','2025-01'],'samplingMinutes':30,'entrySlippage':.001,'features':['ATR/price','logRVOL','VWAP distance/ATR','trend1h','trend4h','return5m','volumeAvailable','candidateSide'],'label':'Adverse price excursion over next30m from next1m simulated open; low<0.5 stop-distance, moderate0.5..<1, high>=1. Not probability of profit; no transaction fees/funding in the path label.','scope':'Offline diagnostic; evaluation quarter overlaps existing PPO development. No Jan2025+ validation or final PEPE test is opened. No PPO actions blocked or resized.','realOrders':False,'ppoConnected':False}
index=read('data/pepe-finrl-v1/features/index.json');selected=[m for m in index['months']if any(a<=m['month']<b for a,b in [config['fit'],config['calibration'],config['evaluation']])]
source_files=['scripts/run-pepe-nb-poc.py','scripts/pepe-nb-risk-core.py','data/pepe-finrl-v1/features/index.json']
registration={'registeredAt':int(time.time()*1000),'config':config,'sourceHashes':{f:sha(f)for f in source_files},'dataHashes':{f:h for m in selected for f,h in [(m['path'],m['sha256']),(m['rawPath'],m['rawSHA256'])]},'sklearn':sklearn.__version__}
registered=BASE/'registration.json'
if registered.exists():
 prior=read(registered)
 if prior['config']!=config or prior['sourceHashes']!=registration['sourceHashes']or prior['dataHashes']!=registration['dataHashes']:raise RuntimeError('Registered NB inputs changed; use a new experiment')
else:atomic(registered,registration)
report={'status':'preparing','updatedAt':int(time.time()*1000),'config':config,'registrationSHA256':sha(registered),'realOrders':False,'ppoConnected':False,'models':[]}
def publish():report['updatedAt']=int(time.time()*1000);atomic(ROOT/'web/data/pepe-nb-poc.json',report)
publish();started=time.monotonic();splits={name:{'x':[],'y':[],'at':[],'ratio':[]}for name in ['fit','calibration','evaluation']}
try:
 for m in selected:
  for f,h in [(m['path'],m['sha256']),(m['rawPath'],m['rawSHA256'])]:
   if sha(f)!=h:raise RuntimeError('Changed data '+f)
  packet=read(m['path']);rows=packet['features'];raw=read(m['rawPath']);candles=raw['candles'];start=packet['start'];name=next(n for n in splits if config[n][0]<=m['month']<config[n][1]);split_end=stamp(config[name][1]);b=splits[name]
  for row in rows:
   at=row['at']
   if at%1800000 or not core.eligible_window(at,start,min(packet['end'],split_end)):continue
   offset=(at-start)//60000;future=candles[offset:offset+30]
   if len(future)!=30 or future[0][0]!=at or future[-1][0]!=at+29*60000:raise RuntimeError('Incomplete label interval')
   if future[0][5]<=0:continue
   if row['knownAt']>at:raise RuntimeError('Future feature')
   for side in [1,-1]:
    entry=future[0][1]*(1+side*config['entrySlippage']);label,ratio=core.risk_label(side,entry,row['atr'],future);b['x'].append(core.features(row,side));b['y'].append(label);b['at'].append(at);b['ratio'].append(ratio)
 report['dataset']={n:{'rows':len(b['y']),'classCounts':np.bincount(b['y'],minlength=3).tolist(),'firstAt':min(b['at']),'lastAt':max(b['at']),'labelsMatureBefore':stamp(config[n][1])}for n,b in splits.items()};report['status']='training';publish()
 X={n:np.asarray(b['x'],dtype=float)for n,b in splits.items()};Y={n:np.asarray(b['y'],dtype=int)for n,b in splits.items()}
 if any(len(np.unique(y))!=3 for y in Y.values()):raise RuntimeError('All classes required in each temporal split')
 models={};gnb=GaussianNB(var_smoothing=1e-6).fit(X['fit'],Y['fit']);models['GaussianNB sem calibração']=gnb
 models['GaussianNB calibrado']=CalibratedClassifierCV(FrozenEstimator(gnb),method='sigmoid').fit(X['calibration'],Y['calibration'])
 logistic=make_pipeline(StandardScaler(),LogisticRegression(max_iter=500,random_state=19)).fit(X['fit'],Y['fit']);models['Regressão logística calibrada']=CalibratedClassifierCV(FrozenEstimator(logistic),method='sigmoid').fit(X['calibration'],Y['calibration'])
 prior=(np.bincount(Y['fit'],minlength=3)+1)/(len(Y['fit'])+3);cuts=np.quantile(X['fit'][:,0],[1/3,2/3]);bucket_train=np.searchsorted(cuts,X['fit'][:,0]);bucket_prob=np.array([(np.bincount(Y['fit'][bucket_train==i],minlength=3)+1)/(np.sum(bucket_train==i)+3)for i in range(3)])
 predictions={name:model.predict_proba(X['evaluation'])for name,model in models.items()};predictions['Frequência histórica constante']=np.tile(prior,(len(Y['evaluation']),1));predictions['Regra simples por volatilidade']=bucket_prob[np.searchsorted(cuts,X['evaluation'][:,0])]
 def metrics(name,probs):
  truth=Y['evaluation'];onehot=np.eye(3)[truth];risk=probs[:,2];actual=(truth==2).astype(float);bins=[]
  for i in range(10):
   mask=(risk>=i/10)&(risk<((i+1)/10)if i<9 else risk<=1)
   if np.any(mask):bins.append({'lower':i/10,'upper':(i+1)/10,'count':int(mask.sum()),'predicted':float(risk[mask].mean()),'observed':float(actual[mask].mean())})
  return{'name':name,'logLoss':float(log_loss(truth,probs,labels=[0,1,2])),'brierMulticlass':float(np.mean(np.sum((probs-onehot)**2,axis=1))),'brierHighRisk':float(np.mean((risk-actual)**2)),'balancedAccuracy':float(balanced_accuracy_score(truth,probs.argmax(axis=1))),'confusionMatrix':confusion_matrix(truth,probs.argmax(axis=1),labels=[0,1,2]).tolist(),'highRiskCalibration':bins}
 report['models']=[metrics(n,p)for n,p in predictions.items()];nb=next(m for m in report['models']if m['name']=='GaussianNB calibrado');baselines=[m for m in report['models']if m['name']in ['Frequência histórica constante','Regra simples por volatilidade','Regressão logística calibrada']];report['nbBeatsAllBaselinesOnBrier']=all(nb['brierMulticlass']<m['brierMulticlass']for m in baselines);report['examples']=[]
 for i in np.linspace(0,len(Y['evaluation'])-1,12,dtype=int):report['examples'].append({'at':splits['evaluation']['at'][i],'side':int(X['evaluation'][i,-1]),'predictedClass':core.CLASSES[int(predictions['GaussianNB calibrado'][i].argmax())],'actualClass':core.CLASSES[int(Y['evaluation'][i])],'probabilities':predictions['GaussianNB calibrado'][i].tolist(),'adverseExcursionR':splits['evaluation']['ratio'][i]})
 for name,model in models.items():joblib.dump(model,BASE/({'GaussianNB sem calibração':'gaussian-raw','GaussianNB calibrado':'gaussian-calibrated','Regressão logística calibrada':'logistic-calibrated'}[name]+'.joblib'))
 report['status']='complete';report['seconds']=time.monotonic()-started;report['conclusion']='Diagnóstico concluído. '+('NB calibrado teve Brier menor que as três referências neste trimestre; isso não demonstra lucro ou autoriza bloquear o PPO.'if report['nbBeatsAllBaselinesOnBrier']else'NB calibrado não superou todas as referências pelo Brier neste trimestre. Manter apenas como observador; não promover ao PPO.');publish();atomic(BASE/'result.json',report);print(json.dumps({'status':'complete','rows':report['dataset'],'conclusion':report['conclusion'],'finalTestOpened':False}))
except Exception as e:report['status']='error';report['error']=str(e);publish();raise
