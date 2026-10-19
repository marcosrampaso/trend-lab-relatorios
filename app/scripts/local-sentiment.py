"""English RSS headline classification on CPU. No chat, broker or inference API."""
import os
for key in ('OMP_NUM_THREADS','OPENBLAS_NUM_THREADS','MKL_NUM_THREADS','VECLIB_MAXIMUM_THREADS'):os.environ[key]='2'
os.environ['TOKENIZERS_PARALLELISM']='false'
os.environ['HF_HUB_OFFLINE']='1'
os.environ['TRANSFORMERS_OFFLINE']='1'
import hashlib,json,re,sys,time,urllib.request,xml.etree.ElementTree as ET
from pathlib import Path
from datetime import datetime,timezone
from email.utils import parsedate_to_datetime
ROOT=Path(__file__).resolve().parent.parent
STATE=ROOT/'work/local-sentiment';PUBLIC=ROOT/'web/data/local-sentiment.json'
def atomic(p,d):
 p.parent.mkdir(parents=True,exist_ok=True);t=p.with_suffix('.tmp');t.write_text(json.dumps(d,allow_nan=False,separators=(',',':')));t.replace(p)
def get(url):
 req=urllib.request.Request(url,headers={'User-Agent':'TrendLab/1.0 (local paper research)'})
 with urllib.request.urlopen(req,timeout=20) as r:
  raw=r.read(2_000_001)
  if len(raw)>2_000_000:raise ValueError('Feed exceeds limit')
  return raw
def articles(raw,feed,observed):
 if b'<!DOCTYPE' in raw.upper() or b'<!ENTITY' in raw.upper():raise ValueError('XML entities disallowed')
 out=[]
 for x in ET.fromstring(raw).findall('.//item'):
  title=re.sub(r'\s+',' ',x.findtext('title') or '').strip()[:1000];url=(x.findtext('link') or '').strip()
  try:published=int(parsedate_to_datetime(x.findtext('pubDate') or '').timestamp()*1000)
  except (ValueError,TypeError,OverflowError):continue
  if not title or not url.startswith('https://') or published>observed or observed-published>300*60000:continue
  assets=[s for s,pattern in [('BTCUSDT',r'\b(bitcoin|btc)\b'),('ETHUSDT',r'\b(ethereum|ether|eth)\b')] if re.search(pattern,title,re.I)]
  if not assets:continue
  normalized=re.sub(r'[^a-z0-9]+',' ',title.lower()).strip()
  out.append({'id':hashlib.sha256(normalized.encode()).hexdigest(),'title':title,'url':url,'publisher':urllib.parse.urlparse(feed).hostname,'feed':feed,'publishedAt':published,'firstSeenAt':observed,'assets':assets,'language':'en','input':'headline only'})
 return out
def main():
 p=json.loads((ROOT/'multiasset-sentiment-protocol.json').read_text())['sentiment'];manifest=json.loads((STATE/'model-manifest.json').read_text());target=STATE/'model'
 if manifest['revision']!=p['revision']:raise ValueError('Model revision mismatch')
 for f,h in manifest['files'].items():
  if hashlib.sha256((target/f).read_bytes()).hexdigest()!=h:raise ValueError('Model hash mismatch '+f)
 import torch
 from transformers import AutoTokenizer,AutoModelForSequenceClassification
 torch.set_num_threads(2);tokenizer=AutoTokenizer.from_pretrained(target,local_files_only=True,trust_remote_code=False);model=AutoModelForSequenceClassification.from_pretrained(target,local_files_only=True,trust_remote_code=False,use_safetensors=True).to('cpu').eval()
 labels={int(k):v for k,v in model.config.id2label.items()}
 if set(labels.values())!={'negative','neutral','positive'}:raise ValueError('Label schema mismatch')
 saved=STATE/'articles';saved.mkdir(parents=True,exist_ok=True)
 record=STATE/'registration.json'
 if not record.exists():atomic(record,{'registeredAt':int(time.time()*1000),'model':manifest,'protocol':p,'implementationSHA256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest()})
 registration=json.loads(record.read_text())
 if registration['protocol']!=p or registration['model']!=manifest or registration['implementationSHA256']!=hashlib.sha256(Path(__file__).read_bytes()).hexdigest():raise ValueError('Frozen sentiment collector changed; register a new run')
 while True:
  try:
   status=json.loads(get('http://127.0.0.1:4173/api/local/status'))
   if status.get('app')!='trend-lab-local':raise ValueError('Wrong local server')
   if status.get('paused'):
    atomic(PUBLIC,{'status':'paused','updatedAt':int(time.time()*1000),'articles':[],'revision':p['revision']});time.sleep(30);continue
   errors=[];seen=set();now=int(time.time()*1000)
   for feed in p['feeds']:
    try:
     raw=get(feed)
     for row in articles(raw,feed,now):
      if row['id'] in seen:continue
      seen.add(row['id']);file=saved/(row['id']+'.json')
      if file.exists():continue
      inputs=tokenizer(row['title'],return_tensors='pt',truncation=True,max_length=512)
      with torch.inference_mode():scores=torch.softmax(model(**inputs).logits,dim=-1)[0].tolist()
      row.update({'scores':{labels[i]:float(v) for i,v in enumerate(scores)},'classifiedAt':int(time.time()*1000),'revision':p['revision'],'feedSHA256':hashlib.sha256(raw).hexdigest()})
      with file.open('x') as f:json.dump(row,f,allow_nan=False,separators=(',',':'))
    except Exception as e:errors.append({'feed':feed,'error':str(e)[:300]})
   now=int(time.time()*1000);rows=[json.loads(f.read_text()) for f in saved.glob('*.json')];rows=[r for r in rows if r['publishedAt']+p['ttlMinutes']*60000>now]
   result={'status':'collecting' if not errors else 'degraded','updatedAt':now,'lastSuccessAt':now if len(errors)<len(p['feeds']) else None,'model':p['model'],'revision':p['revision'],'device':'cpu','threads':2,'articles':sorted(rows,key=lambda r:r['publishedAt'],reverse=True),'errors':errors,'input':'English headlines only; asset relevance by explicit keyword; no profit forecast','training':False,'paidAPI':False}
   atomic(PUBLIC,result);print(json.dumps({'status':result['status'],'articles':len(rows),'errors':errors}),flush=True)
  except Exception as e:atomic(PUBLIC,{'status':'error','updatedAt':int(time.time()*1000),'articles':[],'revision':p['revision'],'error':str(e)[:500]});print(str(e),file=sys.stderr,flush=True)
  if '--once' in sys.argv:return
  time.sleep(p['pollSeconds'])
if __name__=='__main__':main()
