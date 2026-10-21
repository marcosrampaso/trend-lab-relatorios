"""Isolated paired preservation study. No mutation of V3 artifacts or rules."""
from pathlib import Path
import hashlib,json,os,time,statistics,random
ROOT=Path(__file__).resolve().parent.parent
RUN=ROOT/'work/pepe-elite-study-v1'
def read(p):return json.loads(Path(p).read_text())
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def atomic(p,value):
 p=Path(p);p.parent.mkdir(parents=True,exist_ok=True);tmp=p.with_name(p.name+f'.{os.getpid()}.tmp');tmp.write_text(json.dumps(value,ensure_ascii=False,allow_nan=False));tmp.replace(p)
def immutable(p,value):
 p=Path(p);p.parent.mkdir(parents=True,exist_ok=True)
 with p.open('x') as f:json.dump(value,f,ensure_ascii=False,allow_nan=False)
 p.chmod(0o444)
def copy_once(source,target):
 import shutil
 source,target=Path(source),Path(target);target.parent.mkdir(parents=True,exist_ok=True)
 if target.exists():
  if sha(source)!=sha(target):raise ValueError('Immutable model conflict')
  return
 with source.open('rb')as inp,target.open('xb')as out:shutil.copyfileobj(inp,out)
 target.chmod(0o444)
 if sha(source)!=sha(target):raise ValueError('Copy verification failed')
def compact(a):return{k:v for k,v in a.items() if k not in ['trades','curve']}
def score(a,protocol):return a['pnlBRL']-protocol['drawdownPenalty']*a['maxDD']*protocol['capitalBRL']
def promote(arm,candidate,incumbent,epsilon=1e-8):
 if arm not in ['control','protected']:raise ValueError('Unknown arm')
 accepted=arm=='control' or candidate['score']>incumbent['score']+epsilon
 return (candidate if accepted else incumbent),accepted

def summarize(rows):
 if not rows:return None
 aa=[r['audit'] for r in rows];p=[a['pnlBRL']for a in aa]
 return {'count':len(rows),'meanPNL':statistics.mean(p),'medianPNL':statistics.median(p),'positive':sum(x>1e-8 for x in p),'negative':sum(x< -1e-8 for x in p),'cash':sum(a['count']==0 for a in aa),'halted':sum(a['halted']for a in aa),'meanScore':statistics.mean(r['score']for r in rows),'meanFees':statistics.mean(a['feesBRL']for a in aa),'meanSlippage':statistics.mean(a['slippageBRL']for a in aa),'meanGross':statistics.mean(a['grossBRL']for a in aa),'meanDD':statistics.mean(a['maxDD']for a in aa)}

def capacity_ok(v3,available_memory):
 # One extra two-thread worker is allowed only outside V3 Ultra capacity.
 return available_memory is not None and available_memory>=20 and not(v3.get('status')in ['training','scanning_parents'] and (v3.get('executionRuntime',{}).get('workers',3)>3))
