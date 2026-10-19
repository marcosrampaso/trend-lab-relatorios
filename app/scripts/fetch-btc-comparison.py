"""Monthly public Binance archives, checksummed; isolated BTC research dataset."""
import csv,hashlib,io,json,subprocess,zipfile,calendar,time
from pathlib import Path
from datetime import datetime,timezone
from concurrent.futures import ThreadPoolExecutor,as_completed
ROOT=Path(__file__).resolve().parent.parent
DEST=ROOT/'work/multiasset-v1/history';CACHE=DEST/'cache'
def atomic(file,data):
 file=Path(file);file.parent.mkdir(parents=True,exist_ok=True);tmp=file.with_suffix('.tmp');tmp.write_text(json.dumps(data,separators=(',',':'),allow_nan=False));tmp.replace(file)
def get(url):return subprocess.check_output(['curl','-fLsS','--retry','3','--connect-timeout','10','--max-time','90',url])
def monthly(month):
 target=DEST/(month+'.json')
 if target.exists():
  d=json.loads(target.read_text());return {'month':month,'path':str(target.relative_to(ROOT)),'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'minutes':len(d['candles']),'sources':d['sources']}
 y,m=map(int,month.split('-'));start=int(datetime(y,m,1,tzinfo=timezone.utc).timestamp()*1000);count=calendar.monthrange(y,m)[1]*1440
 data={'month':month,'symbol':'BTCUSDT','candles':[],'marks':[],'funding':[],'sources':[]}
 for kind,key in [('klines','candles'),('markPriceKlines','marks')]:
  name=f'BTCUSDT-1m-{month}.zip';url=f'https://data.binance.vision/data/futures/um/monthly/{kind}/BTCUSDT/1m/{name}'
  cached=CACHE/(kind+'-'+name);raw=cached.read_bytes() if cached.exists() else get(url)
  expected=get(url+'.CHECKSUM').decode().split()[0]
  if hashlib.sha256(raw).hexdigest()!=expected:raise ValueError('Checksum '+url)
  cached.write_bytes(raw);z=zipfile.ZipFile(io.BytesIO(raw));by={}
  for row in csv.reader(io.StringIO(z.read(z.namelist()[0]).decode())):
   if not row or not row[0].isdigit():continue
   t=int(row[0]);values=[t,*map(float,row[1:6]),float(row[7]),float(row[9])] if key=='candles' else [t,*map(float,row[1:5])]
   if t in by:raise ValueError('Duplicate candle')
   by[t]=values
  missing=sorted(set(range(start,start+count*60000,60000))-set(by))
  data['sources'].append({'url':url,'sha256':expected,'checksumVerified':True})
  while missing:
   group=[missing[0]]
   for t in missing[1:]:
    if t!=group[-1]+60000 or len(group)>=1000:break
    group.append(t)
   repair=f'https://fapi.binance.com/fapi/v1/{kind}?symbol=BTCUSDT&interval=1m&startTime={group[0]}&endTime={group[-1]+59999}&limit=1500';raw=get(repair)
   for row in json.loads(raw):
    if int(row[0]) in group:by[int(row[0])]=[int(row[0]),*map(float,row[1:6]),float(row[7]),float(row[9])] if key=='candles' else [int(row[0]),*map(float,row[1:5])]
   if any(t not in by for t in group):raise ValueError('Unrepaired gap')
   data['sources'].append({'url':repair,'sha256':hashlib.sha256(raw).hexdigest(),'repair':True,'checksumVerified':False});missing=sorted(set(missing)-set(by))
  data[key]=[by[t] for t in sorted(by)]
  if len(data[key])!=count or any(r[0]!=start+i*60000 for i,r in enumerate(data[key])):raise ValueError('Coverage gap')
  if any(not all(v==v for v in r) or r[3]<=0 or r[2]<max(r[1],r[4]) or r[3]>min(r[1],r[4]) for r in data[key]):raise ValueError('Invalid OHLC')
 cursor=start;end=start+count*60000
 while cursor<end:
  url=f'https://fapi.binance.com/fapi/v1/fundingRate?symbol=BTCUSDT&startTime={cursor}&endTime={end-1}&limit=1000';raw=get(url);rows=json.loads(raw)
  if not isinstance(rows,list):raise ValueError('Funding response')
  data['sources'].append({'url':url,'sha256':hashlib.sha256(raw).hexdigest(),'checksumVerified':False})
  if not rows:break
  data['funding'].extend([int(x['fundingTime']),float(x['fundingRate'])] for x in rows);cursor=int(rows[-1]['fundingTime'])+1
  if len(rows)<1000:break
 atomic(target,data)
 return {'month':month,'path':str(target.relative_to(ROOT)),'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'minutes':count,'sources':data['sources']}
def main():
 CACHE.mkdir(parents=True,exist_ok=True);p=json.loads((ROOT/'multiasset-sentiment-protocol.json').read_text());h=p['history'];months=[];y,m=map(int,h['warmupStart'][:7].split('-'))
 while f'{y:04d}-{m:02d}'<h['testEnd'][:7]:
  months.append(f'{y:04d}-{m:02d}');y,m=(y+1,1) if m==12 else(y,m+1)
 registered=DEST/'registration.json'
 if not registered.exists():atomic(registered,{'registeredAt':datetime.now(timezone.utc).isoformat(),'protocol':p,'protocolSHA256':hashlib.sha256((ROOT/'multiasset-sentiment-protocol.json').read_bytes()).hexdigest(),'sourceSHA256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest()})
 entries=[]
 with ThreadPoolExecutor(max_workers=3) as pool:
  for f in as_completed([pool.submit(monthly,x) for x in months]):
   item=f.result();entries.append(item);atomic(DEST/'progress.json',{'completed':len(entries),'total':len(months),'latest':item['month']});print(json.dumps({'month':item['month'],'completed':len(entries),'total':len(months)}),flush=True)
 raw=get('https://fapi.binance.com/fapi/v1/exchangeInfo');exchange=json.loads(raw);filters={s['symbol']:s['filters'] for s in exchange['symbols'] if s['symbol'] in p['symbols']}
 if len(filters)!=2:raise ValueError('Exchange filters missing')
 atomic(DEST/'exchange.json',{'asOf':datetime.now(timezone.utc).isoformat(),'sha256':hashlib.sha256(raw).hexdigest(),'filters':filters})
 atomic(DEST/'manifest.json',{'symbol':'BTCUSDT','first':h['warmupStart'],'end':h['testEnd'],'retrievedAt':datetime.now(timezone.utc).isoformat(),'months':sorted(entries,key=lambda x:x['month']),'totalMinutes':sum(x['minutes'] for x in entries)})
 print('BTC history ready',flush=True)
if __name__=='__main__':main()
