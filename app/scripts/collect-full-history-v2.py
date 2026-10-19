"""Expand ETHUSDT public history separately and derive gap-aware UTC timeframes."""
import calendar,csv,gzip,hashlib,io,json,math,os,re,shutil,subprocess,time,zipfile
from datetime import datetime,timezone,timedelta
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor,as_completed
ROOT=Path(__file__).resolve().parent.parent;DEST=ROOT/'data/history-v2';CACHE=ROOT/'.cache/history-v2';WORK=ROOT/'work/history-v2'
INTERVALS={'3m':3,'5m':5,'15m':15,'30m':30,'1h':60,'2h':120,'4h':240,'6h':360,'8h':480,'12h':720,'1d':1440}
def read(file):return json.loads(Path(file).read_text())
def sha(file):return hashlib.sha256(Path(file).read_bytes()).hexdigest()
def atomic(file,obj):
    file=Path(file);file.parent.mkdir(parents=True,exist_ok=True);tmp=file.with_suffix(file.suffix+'.tmp');tmp.write_text(json.dumps(obj,separators=(',',':'),ensure_ascii=False));tmp.replace(file)
def fetch(url):
    if shutil.disk_usage(ROOT).free<12*1024**3:raise RuntimeError('Menos de12GiB livres')
    return subprocess.check_output(['curl','-fLsS','--retry','2','--retry-delay','1','--connect-timeout','10','--max-time','45',url],stderr=subprocess.PIPE)
def archive(kind,period,daily=False):
    stem=f'ETHUSDT-1m-{period}.zip';url=f'https://data.binance.vision/data/futures/um/{"daily"if daily else"monthly"}/{kind}/ETHUSDT/1m/{stem}'
    old=ROOT/'.cache/scalp-tree-extended'/f'{kind}-{stem}';file=CACHE/f'{kind}-{stem}';checksum=file.with_suffix('.sha256')
    if old.exists()and old.with_suffix('.sha256').exists():file=old;checksum=old.with_suffix('.sha256')
    raw=file.read_bytes()if file.exists()else fetch(url);expected=checksum.read_text().strip()if checksum.exists()else fetch(url+'.CHECKSUM').decode().split()[0]
    if hashlib.sha256(raw).hexdigest()!=expected:raise ValueError('Checksum divergente '+url)
    if not file.exists():file.write_bytes(raw);checksum.write_text(expected)
    z=zipfile.ZipFile(io.BytesIO(raw));rows=[r for r in csv.reader(io.StringIO(z.read(z.namelist()[0]).decode('utf-8-sig')))if r and r[0].isdigit()]
    values=[]
    for r in rows:
        at=int(r[0]);at=at//1000 if at>=10**14 else at
        value=[at,*map(float,r[1:6]),float(r[7]),float(r[9])]if kind=='klines'else[at,*map(float,r[1:5])]
        if at%60000 or not all(math.isfinite(v)for v in value)or not(value[2]>=max(value[1],value[4])and value[3]<=min(value[1],value[4])and value[3]>0):raise ValueError('OHLC inválido '+period)
        values.append(value)
    if len({r[0]for r in values})!=len(values):raise ValueError('Minutos duplicados')
    return values,{'url':url,'sha256':expected,'rows':len(values),'officialChecksum':True}
def gaps(rows,start,end,width=60000):
    result=[];cursor=start
    for row in rows:
        at=row[0]
        if at<start or at>=end:continue
        if at>cursor:result.append({'start':cursor,'end':at,'missing':(at-cursor)//width})
        cursor=at+width
    if cursor<end:result.append({'start':cursor,'end':end,'missing':(end-cursor)//width})
    return result
def aggregate(rows,minutes,volume=True):
    width=minutes*60000;out=[];group=[];bucket=None;discarded=0
    def finish(group):
        if len(group)!=minutes or group[0][0]%width or any(r[0]!=group[0][0]+i*60000 for i,r in enumerate(group)):return None
        r=[group[0][0],group[0][1],max(x[2]for x in group),min(x[3]for x in group),group[-1][4]]
        if volume:r.extend(sum(x[k]for x in group)for k in [5,6,7])
        return r
    for row in rows:
        key=row[0]//width*width
        if key!=bucket:
            if group:
                r=finish(group)
                if r:out.append(r)
                else:discarded+=1
            group=[];bucket=key
        group.append(row)
    if group:
        r=finish(group)
        if r:out.append(r)
        else:discarded+=1
    return out,discarded
def save_gzip(file,value):
    file.parent.mkdir(parents=True,exist_ok=True);tmp=file.with_suffix(file.suffix+'.tmp')
    with tmp.open('wb')as raw:
        with gzip.GzipFile(filename='',fileobj=raw,mode='wb',mtime=0,compresslevel=4)as gz:gz.write(json.dumps(value,separators=(',',':')).encode())
    tmp.replace(file)
def month_bounds(month):
    y,m=map(int,month.split('-'));start=datetime(y,m,1,tzinfo=timezone.utc);end=datetime(y+(m==12),m%12+1,1,tzinfo=timezone.utc);return int(start.timestamp()*1000),int(end.timestamp()*1000)
def collect_missing_month(month):
    file=DEST/'minutes'/f'{month}.json'
    if file.exists():return {'month':month,'path':str(file.relative_to(ROOT)),'sha256':sha(file),'new':True}
    start,end=month_bounds(month);parts={};sources=[]
    for kind,key in [('klines','candles'),('markPriceKlines','marks')]:
        rows,provenance=archive(kind,month);sources.append(provenance);by={r[0]:r for r in rows}
        # Pre-listing leading absence is recorded, not filled. Internal gaps may
        # be repaired only with official daily archives, then the public API.
        effective=max(start,min(by))if by else end
        missing=gaps([by[t]for t in sorted(by)],effective,end)
        days=sorted({datetime.fromtimestamp(t/1000,timezone.utc).strftime('%Y-%m-%d')for gap in missing for t in range(gap['start'],gap['end'],60000)})
        for day in days:
            try:
                daily,provenance=archive(kind,day,True);sources.append(provenance)
                for r in daily:by.setdefault(r[0],r)
            except Exception as e:sources.append({'period':day,'unavailable':str(e)[:180]})
        parts[key]=[by[t]for t in sorted(by)if start<=t<end]
    atomic(file,{'month':month,**parts,'sources':sources})
    return {'month':month,'path':str(file.relative_to(ROOT)),'sha256':sha(file),'new':True}
def collect_current(month,snapshot):
    file=DEST/'minutes'/f'{month}.json';start,end=month_bounds(month);parts={'candles':[],'marks':[]};sources=[];failures=[]
    start_day=datetime.fromtimestamp(start/1000,timezone.utc);today=datetime.fromtimestamp(snapshot/1000,timezone.utc).replace(hour=0,minute=0,second=0,microsecond=0)
    day=start_day
    while day<today:
        for kind,key in [('klines','candles'),('markPriceKlines','marks')]:
            date=day.strftime('%Y-%m-%d')
            try:rows,provenance=archive(kind,date,True);parts[key].extend(rows);sources.append(provenance)
            except Exception as e:failures.append({'day':date,'kind':kind,'reason':str(e)[:150]})
        day+=timedelta(days=1)
    for endpoint,key in [('klines','candles'),('markPriceKlines','marks')]:
        cursor=int(today.timestamp()*1000)
        while cursor<snapshot:
            url=f'https://fapi.binance.com/fapi/v1/{endpoint}?symbol=ETHUSDT&interval=1m&startTime={cursor}&endTime={snapshot-1}&limit=1500'
            try:
                raw=fetch(url);rows=json.loads(raw);assert isinstance(rows,list);sources.append({'url':url,'sha256':hashlib.sha256(raw).hexdigest(),'rows':len(rows),'officialChecksum':False})
                values=[[int(r[0]),*map(float,r[1:6]),float(r[7]),float(r[9])]if key=='candles'else[int(r[0]),*map(float,r[1:5])]for r in rows if int(r[0])+60000<=snapshot]
                if not values:break
                parts[key].extend(values);cursor=values[-1][0]+60000
            except Exception as e:failures.append({'day':today.strftime('%Y-%m-%d'),'kind':endpoint,'reason':str(e)[:150]});break
    for key in parts:parts[key]=sorted({r[0]:r for r in parts[key]if r[0]+60000<=snapshot}.values())
    atomic(file,{'month':month,**parts,'sources':sources,'failures':failures,'snapshotEnd':snapshot});return {'month':month,'path':str(file.relative_to(ROOT)),'sha256':sha(file),'new':True,'failures':failures}
def build_entry(item,snapshot):
    file=ROOT/item['path'];assert sha(file)==item['sha256'];data=read(file);start,calendar_end=month_bounds(item['month']);end=min(calendar_end,snapshot)
    candle_gaps=gaps(data['candles'],start,end);mark_gaps=gaps(data['marks'],start,end);candle_times={r[0]for r in data['candles']};mark_times={r[0]for r in data['marks']}
    entry={**item,'start':start,'end':end,'firstCandle':data['candles'][0][0]if data['candles']else None,'minutes':len(data['candles']),'markMinutes':len(data['marks']),'alignedMinutes':len(candle_times&mark_times),'complete':not candle_gaps and not mark_gaps and end==calendar_end,'completeThroughSnapshot':not candle_gaps and not mark_gaps,'candleGaps':candle_gaps,'markGaps':mark_gaps,'frames':{'1m':{'path':item['path'],'sha256':item['sha256'],'rows':len(data['candles']),'intervalMinutes':1,'encoding':'json'}}}
    for name,minutes in INTERVALS.items():
        target=DEST/'frames'/name/(item['month']+'.json.gz');candles,discarded=aggregate(data['candles'],minutes);marks,mark_discarded=aggregate(data['marks'],minutes,False)
        stale=not target.exists()
        if not stale:
            with gzip.open(target,'rt')as gz:stale=json.load(gz)['sourceSHA256']!=item['sha256']
        if stale:save_gzip(target,{'month':item['month'],'interval':name,'intervalMinutes':minutes,'candles':candles,'marks':marks,'discardedBuckets':discarded,'discardedMarkBuckets':mark_discarded,'sourceSHA256':item['sha256']})
        entry['frames'][name]={'path':str(target.relative_to(ROOT)),'sha256':sha(target),'rows':len(candles),'intervalMinutes':minutes,'encoding':'gzip','discardedBuckets':discarded}
    return entry
def main():
    os.chdir(ROOT);DEST.mkdir(parents=True,exist_ok=True);CACHE.mkdir(parents=True,exist_ok=True);WORK.mkdir(parents=True,exist_ok=True)
    snapshot=int(time.time()//60)*60000;old=read(ROOT/'data/scalp-tree-extended/manifest.json');discovery=read(WORK/'discovery.json');existing={m['month']:m for m in old['months']};available=sorted({re.search(r'(\d{4}-\d{2})\.zip$',key).group(1)for key in discovery['keys']});current=datetime.fromtimestamp(snapshot/1000,timezone.utc).strftime('%Y-%m')
    state={'stage':'downloading','startedAt':datetime.now(timezone.utc).isoformat(),'updatedAt':datetime.now(timezone.utc).isoformat(),'pid':os.getpid(),'symbol':'ETHUSDT','snapshotEnd':snapshot,'officialFirstArchive':available[0],'monthlyArchivesAvailable':len(available),'reusedMonths':len(existing),'completed':0,'total':len(available)+(current not in available),'errors':[],'realOrders':False};entries=[]
    def publish():
        state.update(updatedAt=datetime.now(timezone.utc).isoformat(),completed=len(entries),freeGiB=round(shutil.disk_usage(ROOT).free/1024**3,2));atomic(DEST/'manifest.json',{'version':'ethusdt-full-history-v2','symbol':'ETHUSDT','snapshotEnd':snapshot,'intervals':{'1m':1,**INTERVALS},'months':sorted(entries,key=lambda m:m['month']),'discovery':discovery,'notes':['Fonte1min oficial; períodos maiores derivados emUTC, somente buckets completos.','Lacunas e período anterior ao primeiro candle não são interpolados. Não alterar bases congeladas.','Novos dados não entram em um piloto já registrado. Coleta não equivale a treinamento.']});atomic(WORK/'status.json',state);atomic(ROOT/'web/data/history-v2-status.json',state)
    publish();missing=[m for m in available if m not in existing]
    with ThreadPoolExecutor(max_workers=2)as pool:
        jobs={pool.submit(collect_missing_month,m):m for m in missing}
        if current not in available:jobs[pool.submit(collect_current,current,snapshot)]=current
        for future in as_completed(jobs):
            m=jobs[future]
            try:existing[m]=future.result()
            except Exception as e:state['errors'].append({'month':m,'reason':str(e)[:250]})
            publish()
    state['stage']='aggregating';publish()
    for m,item in sorted(existing.items()):
        if m>current:continue
        entries.append(build_entry(item,snapshot));state['month']=m;publish();print(json.dumps({'month':m,'frames':len(INTERVALS)+1,'complete':entries[-1]['complete']}),flush=True)
    funding=read(ROOT/'web/data/eth-donchian-history.json')['funding'];start=funding[-1][0]+1
    url=f'https://fapi.binance.com/fapi/v1/fundingRate?symbol=ETHUSDT&startTime={start}&endTime={snapshot-1}&limit=1000'
    try:
        raw=fetch(url);rows=json.loads(raw);assert isinstance(rows,list);funding.extend([int(r['fundingTime']),float(r['fundingRate'])]for r in rows);atomic(DEST/'funding.json',{'rows':sorted({r[0]:r for r in funding}.values()),'sourceURL':url,'responseSHA256':hashlib.sha256(raw).hexdigest(),'originalSHA256':sha(ROOT/'web/data/eth-donchian-history.json')})
    except Exception as e:state['errors'].append({'part':'funding_append','reason':str(e)[:250]});atomic(DEST/'funding.json',{'rows':funding,'incomplete':True})
    state.update(stage='complete'if not state['errors']else'partial',finishedAt=datetime.now(timezone.utc).isoformat(),completeCalendarMonths=sum(e['complete']for e in entries if e['month']!=current),candleMinutes=sum(e['minutes']for e in entries),alignedMinutes=sum(e['alignedMinutes']for e in entries));publish()
if __name__=='__main__':main()
