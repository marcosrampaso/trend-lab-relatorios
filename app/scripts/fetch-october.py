import csv, hashlib, io, json, subprocess, zipfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from datetime import datetime, timezone
root=Path(__file__).resolve().parent.parent
cache=root/'.cache'/'october';cache.mkdir(parents=True,exist_ok=True)
def get(u):return subprocess.check_output(['curl','-fLsS','--retry','2','--max-time','45',u])
def load(job):
 kind,day=job;filename=f'ETHUSDT-1h-2026-10-{day:02}.zip';u=f'https://data.binance.vision/data/futures/um/daily/{kind}/ETHUSDT/1h/{filename}';p=cache/(kind+'-'+filename)
 b=p.read_bytes() if p.exists() else get(u);expected=get(u+'.CHECKSUM').decode().split()[0];sha=hashlib.sha256(b).hexdigest()
 if sha!=expected:raise ValueError('checksum inválido')
 p.write_bytes(b);z=zipfile.ZipFile(io.BytesIO(b));rows=list(csv.DictReader(io.StringIO(z.read(z.namelist()[0]).decode())))
 keys=['open','high','low','close']+(['volume'] if kind=='klines' else [])
 return kind,[[int(r['open_time']),*[float(r[k]) for k in keys]] for r in rows],{'url':u,'sha256':sha}
protocolHash=hashlib.sha256((root/'intraday-protocol.json').read_bytes()).hexdigest();f=json.loads((root/'intraday-freeze.json').read_text())
if f['protocolSHA256']!=protocolHash:raise ValueError('Protocolo alterado')
d=json.loads((root/'web/data/eth-extended.json').read_text());sources=[]
with ThreadPoolExecutor(max_workers=4) as pool:
 for i,(kind,rows,source) in enumerate(pool.map(load,[(k,day) for day in range(1,16) for k in ['klines','markPriceKlines']]),1):
  d['candles' if kind=='klines' else 'marks'].extend(rows);sources.append(source)
  if i%6==0:print(f'{i}/30 arquivos diários verificados',flush=True)
start=int(datetime(2026,10,1,tzinfo=timezone.utc).timestamp()*1000);end=int(datetime(2026,10,16,tzinfo=timezone.utc).timestamp()*1000)
u=f'https://fapi.binance.com/fapi/v1/fundingRate?symbol=ETHUSDT&startTime={start}&endTime={end-1}&limit=1000';raw=get(u);fund=json.loads(raw)
d['funding'].extend([[int(r['fundingTime']),float(r['fundingRate'])] for r in fund])
for k in ['candles','marks','funding']:d[k].sort(key=lambda r:r[0])
for k in ['candles','marks']:
 if any(b[0]-a[0]!=3600000 for a,b in zip(d[k],d[k][1:])):raise ValueError('Lacuna '+k)
if [r[0] for r in d['candles']]!=[r[0] for r in d['marks']]:raise ValueError('Mark desalinhado')
d['intradaySources']=sources;d['octoberFundingSource']={'url':u,'sha256':hashlib.sha256(raw).hexdigest()};d['intradayProtocolSHA256']=protocolHash;d['octoberRetrievedAt']=datetime.now(timezone.utc).isoformat()
(root/'web/data/eth-intraday.json').write_text(json.dumps(d,separators=(',',':')))
print(json.dumps({'candles':len(d['candles']),'octoberFunding':len(fund),'sources':len(sources)}),flush=True)
