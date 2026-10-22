"""Local chained experiment utilities and preregistered research statistics."""
import hashlib,json,os,statistics,time
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent;BASE=ROOT/'work/pepe-night-v1'
def read(f):return json.loads(Path(f).read_text())
def sha(f):return hashlib.sha256(Path(f).read_bytes()).hexdigest()
def atomic(f,v):
 f=Path(f);f.parent.mkdir(parents=True,exist_ok=True);t=f.with_name(f.name+f'.{os.getpid()}.tmp');t.write_text(json.dumps(v,ensure_ascii=False,allow_nan=False,separators=(',',':')));t.replace(f)
def immutable(f,v):
 f=Path(f);f.parent.mkdir(parents=True,exist_ok=True)
 if f.exists():
  if read(f)!=v:raise ValueError('Immutable conflict '+str(f))
  return
 with f.open('x')as out:json.dump(v,out,ensure_ascii=False,allow_nan=False,separators=(',',':'))
 f.chmod(0o444)
def protocol():return read(BASE/'protocol.json')
def verify():
 r=read(BASE/'registration.json')
 if sha(BASE/'protocol.json')!=r['protocolSHA256']:raise ValueError('Night protocol changed')
 for f,h in {**r['sources'],**r['inputs']}.items():
  if sha(ROOT/f)!=h:raise ValueError('Registered night input changed '+f)
def aggregate(blocks):
 if len(blocks)!=3:raise ValueError('All three selection quarters required')
 ex=[r['pnlBRL']-r['cdi']['pnlBRL']for r in blocks];dd=max(r['maxDD']for r in blocks)
 return {'score':statistics.median(ex)-.25*statistics.pstdev(ex)-250*dd,'meanQuarterlyBRL':statistics.mean(r['pnlBRL']for r in blocks),'medianQuarterlyBRL':statistics.median(r['pnlBRL']for r in blocks),'meanCDIBRL':statistics.mean(r['cdi']['pnlBRL']for r in blocks),'count':sum(r['count']for r in blocks),'aboveCDI':sum(x>0 for x in ex),'maxDD':dd,'independentValidation':False}
def compact(r):return {k:v for k,v in r.items()if k not in ['curve','trades']}
def tensor_hash(model):
 h=hashlib.sha256()
 for k,v in sorted(model.policy.state_dict().items()):h.update(k.encode());h.update(v.detach().cpu().numpy().tobytes())
 return h.hexdigest()
def publish(value):
 v={'updatedAt':int(time.time()*1000),'realOrders':False,**value};atomic(BASE/'status.json',v);atomic(ROOT/'web/data/night-study.json',v)

def temporal_summary(blocks,benchmarks):
 from datetime import datetime,timezone
 values=[];cd=[]
 for r in blocks:
  q=benchmarks[str(r['fold'])];curve=r['curve'];a=q['start'];prev=1000.;previousCDI=1000.
  for end in q['monthEnds']:
   equity=next((v['brl']for v in reversed(curve)if v['at']<=end),1000.)
   baseline=next((v['brl']for v in reversed(q['cdi']['curve'])if v['at']<=end),1000.)
   values.append(equity-prev);cd.append(baseline-previousCDI);prev=equity;previousCDI=baseline
  if abs(sum(values[-3:])-r['pnlBRL'])>1e-5:raise ValueError('Monthly mark-to-market reconciliation')
 if len(values)!=21:raise ValueError('All21 selection months required')
 excess=[a-b for a,b in zip(values,cd)];dd=max(r['maxDD']for r in blocks)
 return {'score':statistics.median(excess)-.25*statistics.pstdev(excess)-250*dd,'meanMonthlyBRL':statistics.mean(values),'medianMonthlyBRL':statistics.median(values),'worstMonthlyBRL':min(values),'meanCDIBRL':statistics.mean(cd),'monthlyPNL':values,'aboveCDI':sum(v>0 for v in excess),'count':sum(r['count']for r in blocks),'maxDD':dd,'independentValidation':False}
