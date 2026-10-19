"""Download oficial de15min com CHECKSUM, continuidade e reparo REST rastreável."""
import csv,hashlib,io,json,subprocess,zipfile
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime,timezone
root=Path(__file__).resolve().parent.parent
cache=root/'.cache'/'15m';cache.mkdir(parents=True,exist_ok=True)
(root/'data').mkdir(exist_ok=True)
def get(u):return subprocess.check_output(['curl','-fLsS','--retry','2','--max-time','50',u])
def load(job):
 kind,period,daily=job;name=f'ETHUSDT-15m-{period}.zip';u=f'https://data.binance.vision/data/futures/um/{"daily" if daily else "monthly"}/{kind}/ETHUSDT/15m/{name}';p=cache/(kind+'-'+name);cp=p.with_suffix('.sha256')
 b=p.read_bytes() if p.exists() else get(u);expected=cp.read_text().strip() if cp.exists() else get(u+'.CHECKSUM').decode().split()[0];sha=hashlib.sha256(b).hexdigest()
 if sha!=expected:raise ValueError('Checksum: '+u)
 p.write_bytes(b);cp.write_text(expected);z=zipfile.ZipFile(io.BytesIO(b));keys=['open','high','low','close']+(['volume'] if kind=='klines' else [])
 rows=[[int(r['open_time']),*[float(r[k]) for k in keys]] for r in csv.DictReader(io.StringIO(z.read(z.namelist()[0]).decode()))]
 return kind,rows,{'url':u,'sha256':sha}
protocol=(root/'improvements-protocol.json').read_bytes();sha=hashlib.sha256(protocol).hexdigest()
if sha!=json.loads((root/'improvements-freeze.json').read_text())['protocolSHA256']:raise ValueError('Protocolo alterado')
months=['2024-12']+[f'{y}-{m:02}' for y,last in [(2025,12),(2026,9)] for m in range(1,last+1)]
jobs=[(k,p,False) for p in months for k in ['klines','markPriceKlines']]+[(k,f'2026-10-{d:02}',True) for d in range(1,16) for k in ['klines','markPriceKlines']]
d={'candles':[],'marks':[],'sources':[],'repairs':[],'protocolSHA256':sha,'retrievedAt':datetime.now(timezone.utc).isoformat()}
with ThreadPoolExecutor(max_workers=4) as pool:
 for i,(k,rows,source) in enumerate(pool.map(load,jobs),1):
  d['candles' if k=='klines' else 'marks'].extend(rows);d['sources'].append(source)
  if i%10==0:print(f'{i}/{len(jobs)} arquivos verificados',flush=True)
for k,endpoint in [('candles','klines'),('marks','markPriceKlines')]:
 rows=d[k];rows.sort(key=lambda r:r[0]);known={r[0] for r in rows};expected=set(range(d['candles'][0][0],d['candles'][-1][0]+900000,900000));missing=sorted(expected-known)
 for start in missing[::1000]:
  end=min(start+999*900000,missing[-1]);u=f'https://fapi.binance.com/fapi/v1/{endpoint}?symbol=ETHUSDT&interval=15m&startTime={start}&endTime={end+899999}&limit=1000';raw=get(u);rest=json.loads(raw);added=[[int(r[0]),*[float(v) for v in r[1:6 if k=="candles" else 5]]] for r in rest if int(r[0]) in expected-known];rows.extend(added);known.update(r[0] for r in added);d['repairs'].append({'url':u,'sha256':hashlib.sha256(raw).hexdigest(),'rows':len(added)})
 rows.sort(key=lambda r:r[0])
 if len({r[0] for r in rows})!=len(rows) or any(b[0]-a[0]!=900000 for a,b in zip(rows,rows[1:])):raise ValueError('Lacuna/duplicata '+k)
if [r[0] for r in d['candles']]!=[r[0] for r in d['marks']]:raise ValueError('Mark desalinhado')
(root/'data/eth-15m.json').write_text(json.dumps(d,separators=(',',':')))
print(json.dumps({'candles':len(d['candles']),'sources':len(d['sources']),'repairs':d['repairs']}),flush=True)
