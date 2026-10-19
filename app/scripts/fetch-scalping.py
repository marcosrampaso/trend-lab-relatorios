"""Dados oficiais1m com checksum; agrega5m sem descartar quote/taker volume."""
import csv,hashlib,io,json,subprocess,zipfile
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime,timezone
root=Path(__file__).resolve().parent.parent
cache=root/'.cache'/'scalping';cache.mkdir(parents=True,exist_ok=True)
p=json.loads((root/'scalping-protocol.json').read_text());freeze=json.loads((root/'scalping-freeze.json').read_text())
sha=hashlib.sha256((root/'scalping-protocol.json').read_bytes()).hexdigest()
if sha!=freeze['protocolSHA256']:raise ValueError('Protocolo alterado')
start=int(datetime.fromisoformat(p['warmupStart'].replace('Z','+00:00')).timestamp()*1000);end=int(datetime.fromisoformat(p['end'].replace('Z','+00:00')).timestamp()*1000)
def get(u):return subprocess.check_output(['curl','-fLsS','--retry','2','--max-time','55',u])
def load(job):
 kind,month=job;name=f'ETHUSDT-1m-{month}.zip';url=f'https://data.binance.vision/data/futures/um/monthly/{kind}/ETHUSDT/1m/{name}';file=cache/(kind+'-'+name);checksum=file.with_suffix('.sha256')
 raw=file.read_bytes() if file.exists() else get(url);expected=checksum.read_text().strip() if checksum.exists() else get(url+'.CHECKSUM').decode().split()[0]
 if hashlib.sha256(raw).hexdigest()!=expected:raise ValueError('Checksum inválido: '+url)
 file.write_bytes(raw);checksum.write_text(expected);z=zipfile.ZipFile(io.BytesIO(raw));rows=[]
 for r in csv.reader(io.StringIO(z.read(z.namelist()[0]).decode())):
  if not r[0].isdigit():continue
  t=int(r[0])
  if start<=t<end:rows.append([t,*[float(x) for x in r[1:6]],float(r[7]),float(r[9])] if kind=='klines' else [t,*[float(x) for x in r[1:5]]])
 return kind,rows,{'url':url,'sha256':expected,'rows':len(rows)}
d={'symbol':'ETHUSDT','intervalMs':60000,'candles':[],'marks':[],'sources':[],'protocolSHA256':sha,'retrievedAt':datetime.now(timezone.utc).isoformat()}
with ThreadPoolExecutor(max_workers=4) as pool:
 for k,rows,source in pool.map(load,[(kind,m) for m in ['2025-03','2025-04','2025-05'] for kind in ['klines','markPriceKlines']]):
  d['candles' if k=='klines' else 'marks'].extend(rows);d['sources'].append(source);print(source['url']+' · '+str(len(rows))+' candles verificados',flush=True)
for key in ['candles','marks']:
 d[key].sort(key=lambda r:r[0]);rows=d[key]
 if len(rows)!=(end-start)//60000 or any(r[0]!=start+i*60000 for i,r in enumerate(rows)):raise ValueError('Lacuna/duplicata: '+key)
 for r in rows:
  if not(r[2]>=max(r[1],r[4]) and r[3]<=min(r[1],r[4]) and r[3]>0):raise ValueError('OHLC inválido')
for r in d['candles']:
 if not(0<=r[7]<=r[5] and r[6]>=0):raise ValueError('Volume taker inválido')
old=json.loads((root/'web/data/eth-2025.json').read_text());d['funding']=[r for r in old['funding'] if start<=r[0]<end];d['filters']=old['filters'];d['filtersAsOf']=old['filtersAsOf']
for k in ['candles','marks']:
 oldmap={r[0]:r for r in old[k]}
 for i in range(0,len(d[k]),60):
  a=d[k][i:i+60];r=[a[0][0],a[0][1],max(x[2] for x in a),min(x[3] for x in a),a[-1][4]];known=oldmap.get(r[0])
  if known and any(abs(x-y)>1e-7 for x,y in zip(r[1:],known[1:5])):raise ValueError('OHLC1h não reconciliado: '+k+' '+str(r[0]))
(root/'data/eth-scalping-1m.json').write_text(json.dumps(d,separators=(',',':')))
five=[]
for i in range(0,len(d['candles']),5):
 a=d['candles'][i:i+5];five.append([a[0][0],a[0][1],max(r[2] for r in a),min(r[3] for r in a),a[-1][4],sum(r[5] for r in a),sum(r[6] for r in a),sum(r[7] for r in a)])
# Browser replay needs the minute execution history; all data stays on localhost.
(root/'web/data/scalping-market.json').write_text(json.dumps({**d,'five':five},separators=(',',':')))
print(json.dumps({'minutes':len(d['candles']),'fiveMinutes':len(five),'sources':len(d['sources']),'hourlyReconciled':True}),flush=True)
