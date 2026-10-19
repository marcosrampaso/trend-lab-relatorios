"""Separate public PEPE futures dataset, verified archives; never touches ETH data."""
import calendar,csv,hashlib,io,json,math,os,shutil,subprocess,zipfile
from pathlib import Path
from datetime import datetime,timezone
from concurrent.futures import ThreadPoolExecutor,as_completed
ROOT=Path(__file__).resolve().parent.parent;DEST=ROOT/'data/pepe-finrl-v1';CACHE=ROOT/'.cache/pepe-finrl-v1';STATUS=ROOT/'web/data/pepe-history-status.json';SYMBOL='1000PEPEUSDT'
def atomic(file,obj):
 file.parent.mkdir(parents=True,exist_ok=True);tmp=file.with_name(file.name+'.tmp');tmp.write_text(json.dumps(obj,separators=(',',':')));tmp.replace(file)
def sha(file):return hashlib.sha256(file.read_bytes()).hexdigest()
def fetch(url):return subprocess.check_output(['curl','-fLsS','--retry','2','--connect-timeout','10','--max-time','55',url],stderr=subprocess.PIPE)
def archive(kind,month):
 funding=kind=='fundingRate';name=f'{SYMBOL}-{"fundingRate" if funding else "1m"}-{month}.zip';url=f'https://data.binance.vision/data/futures/um/monthly/{kind}/{SYMBOL}/'+(''if funding else'1m/')+name;file=CACHE/(kind+'-'+name);check=file.with_suffix('.sha256');raw=file.read_bytes()if file.exists()else fetch(url);expected=check.read_text().strip()if check.exists()else fetch(url+'.CHECKSUM').decode().split()[0]
 if hashlib.sha256(raw).hexdigest()!=expected:raise ValueError('Checksum mismatch '+url)
 file.write_bytes(raw);check.write_text(expected);z=zipfile.ZipFile(io.BytesIO(raw));rows=[r for r in csv.reader(io.StringIO(z.read(z.namelist()[0]).decode('utf-8-sig')))if r and r[0].isdigit()];return rows,{'url':url,'sha256':expected,'rows':len(rows)}
def collect(month):
 if shutil.disk_usage(ROOT).free<10*1024**3:raise RuntimeError('Disk reserve below10GiB')
 out=DEST/(month+'.json')
 if out.exists():
  d=json.loads(out.read_text());return{'month':month,'path':str(out.relative_to(ROOT)),'sha256':sha(out),'minutes':len(d['candles']),'start':d['candles'][0][0],'end':d['candles'][-1][0]+60000,'sources':d['sources'],'eligibleForTrading':not d.get('contextOnly',False),'markGaps':d.get('markGaps',[])}
 year,mon=map(int,month.split('-'));start=int(datetime(year,mon,1,tzinfo=timezone.utc).timestamp()*1000);end=start+calendar.monthrange(year,mon)[1]*86400000;d={'month':month,'symbol':SYMBOL,'candles':[],'marks':[],'funding':[],'sources':[]}
 for kind,key in [('klines','candles'),('markPriceKlines','marks')]:
  rows,source=archive(kind,month);values=[[int(r[0]),*map(float,r[1:6]),float(r[7]),float(r[9])]if key=='candles'else[int(r[0]),*map(float,r[1:5])]for r in rows];by={r[0]:r for r in values}
  if len(by)!=len(values)or not values:raise ValueError('Empty/duplicate '+month)
  first=max(start,values[0][0])if month=='2023-05'else start;wanted=set(range(first,end,60000));missing=sorted(wanted-set(by))
  while missing:
   batch=[missing[0]]
   for t in missing[1:]:
    if t!=batch[-1]+60000 or len(batch)>=1000:break
    batch.append(t)
   endpoint='klines'if key=='candles'else'markPriceKlines';url=f'https://fapi.binance.com/fapi/v1/{endpoint}?symbol={SYMBOL}&interval=1m&startTime={batch[0]}&endTime={batch[-1]+59999}&limit=1500';rf=CACHE/f'{kind}-{month}-{batch[0]}-repair.json';raw=rf.read_bytes()if rf.exists()else fetch(url);rf.write_bytes(raw)
   for r in json.loads(raw):
    if int(r[0])in batch:by[int(r[0])]=[int(r[0]),*map(float,r[1:6]),float(r[7]),float(r[9])]if key=='candles'else[int(r[0]),*map(float,r[1:5])]
   if any(t not in by for t in batch):
    if kind=='markPriceKlines'and month=='2024-08'and missing==[1723456920000,1723456980000]:
     d['contextOnly']=True;d['markGaps']=missing;d['sources'].append({'url':url,'sha256':hashlib.sha256(raw).hexdigest(),'rows':0,'repair':False,'note':'Two missing mark minutes also absent from checksum-verified daily archive; entire month excluded from trading/training rewards.'});break
    raise ValueError('Unrecovered missing minute '+month)
   d['sources'].append({'url':url,'sha256':hashlib.sha256(raw).hexdigest(),'rows':len(batch),'repair':True});missing=sorted(wanted-set(by))
  values=[by[t]for t in sorted(wanted)if t in by]
  if any((r[0]!=first+i*60000 and not(key=='marks'and d.get('contextOnly')))or not all(math.isfinite(v)for v in r)or not(r[2]>=max(r[1],r[4])and r[3]<=min(r[1],r[4])and r[3]>0)for i,r in enumerate(values)):raise ValueError('Invalid coverage/OHLC '+month)
  if key=='candles'and any(not(0<=r[7]<=r[5]and r[6]>=0)for r in values):raise ValueError('Invalid volume')
  d[key]=values;d['sources'].append(source)
 if month=='2023-05':
  common=max(d['candles'][0][0],d['marks'][0][0]);d['candles']=[r for r in d['candles']if r[0]>=common];d['marks']=[r for r in d['marks']if r[0]>=common]
 if not d.get('contextOnly')and [r[0]for r in d['marks']]!=[r[0]for r in d['candles']]:raise ValueError('Mark/execution mismatch '+month)
 rows,source=archive('fundingRate',month);d['funding']=[[int(r[0]),float(r[-1])]for r in rows]
 if not d['funding']or any(not math.isfinite(r[1])or not start<=r[0]<end for r in d['funding']):raise ValueError('Invalid funding '+month)
 d['sources'].append(source);atomic(out,d);return{'month':month,'path':str(out.relative_to(ROOT)),'sha256':sha(out),'minutes':len(d['candles']),'start':d['candles'][0][0],'end':end,'sources':d['sources'],'eligibleForTrading':not d.get('contextOnly',False),'markGaps':d.get('markGaps',[])}
def main():
 DEST.mkdir(parents=True,exist_ok=True);CACHE.mkdir(parents=True,exist_ok=True);months=[f'{y}-{m:02}'for y in range(2023,2027)for m in range(1,13)if'2023-05'<=f'{y}-{m:02}'<'2026-10'];entries=[];state={'status':'downloading','symbol':SYMBOL,'pid':os.getpid(),'startedAt':datetime.now(timezone.utc).isoformat(),'completed':0,'total':len(months),'failures':[],'realOrders':False}
 exchange=DEST/'exchange.json'
 if not exchange.exists():
  d=json.loads(fetch('https://fapi.binance.com/fapi/v1/exchangeInfo'));s=next(s for s in d['symbols']if s['symbol']==SYMBOL)
  if s['status']!='TRADING'or s['contractType']!='PERPETUAL'or s['marginAsset']!='USDT':raise ValueError('Unexpected PEPE contract')
  atomic(exchange,{'observedAt':datetime.now(timezone.utc).isoformat(),'symbol':s,'source':'https://fapi.binance.com/fapi/v1/exchangeInfo'})
 def save():
  state.update(completed=len(entries),updatedAt=datetime.now(timezone.utc).isoformat(),freeGiB=round(shutil.disk_usage(ROOT).free/1024**3,2));atomic(STATUS,state);atomic(DEST/'manifest.json',{'symbol':SYMBOL,'intervalMs':60000,'complete':state['status']=='complete','months':sorted(entries,key=lambda x:x['month']),'exchangeSHA256':sha(exchange),'requested':months,'failures':state['failures'],'warmupOnly':'2023-05'})
 save()
 with ThreadPoolExecutor(max_workers=3)as pool:
  jobs={pool.submit(collect,m):m for m in months}
  for job in as_completed(jobs):
   try:entries.append(job.result());print(json.dumps({'month':jobs[job],'verified':True}),flush=True)
   except Exception as e:state['failures'].append({'month':jobs[job],'reason':((e.stderr or b'').decode()[-300:]if isinstance(e,subprocess.CalledProcessError)else str(e))});print(json.dumps(state['failures'][-1]),flush=True)
   save()
 state['status']='complete'if not state['failures']else'error';save()
 if state['failures']:raise RuntimeError('PEPE history incomplete')
if __name__=='__main__':main()
