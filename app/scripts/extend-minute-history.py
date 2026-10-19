"""Append authorized historical archives in a separate dataset; never change training inputs."""
import ast, calendar, csv, hashlib, io, json, math, os, shutil, subprocess, zipfile
from pathlib import Path
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor, as_completed
ROOT=Path(__file__).resolve().parent.parent
DEST=ROOT/'data/scalp-tree-extended'
CACHE=ROOT/'.cache/scalp-tree-extended'
STATUS=ROOT/'web/data/history-expansion-status.json'
def atomic(file, obj):
    file.parent.mkdir(parents=True,exist_ok=True)
    tmp=file.with_suffix(file.suffix+'.tmp');tmp.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n');tmp.replace(file)
def sha(file):return hashlib.sha256(file.read_bytes()).hexdigest()
def fetch(url):return subprocess.check_output(['curl','-fLsS','--retry','2','--connect-timeout','10','--max-time','55',url],stderr=subprocess.PIPE)
def archive(kind,month):
    funding=kind=='fundingRate';name=f'ETHUSDT-{ "fundingRate" if funding else "1m"}-{month}.zip'
    url=f'https://data.binance.vision/data/futures/um/monthly/{kind}/ETHUSDT/'+('' if funding else '1m/')+name
    file=CACHE/(kind+'-'+name);check=file.with_suffix('.sha256')
    raw=file.read_bytes() if file.exists() else fetch(url)
    expected=check.read_text().strip() if check.exists() else fetch(url+'.CHECKSUM').decode().split()[0]
    if hashlib.sha256(raw).hexdigest()!=expected:raise ValueError('Checksum divergente '+url)
    file.write_bytes(raw);check.write_text(expected)
    z=zipfile.ZipFile(io.BytesIO(raw));rows=[r for r in csv.reader(io.StringIO(z.read(z.namelist()[0]).decode('utf-8-sig'))) if r and r[0].isdigit()]
    return rows,{'url':url,'sha256':expected,'rows':len(rows)}
def load(month):
    if shutil.disk_usage(ROOT).free<8*1024**3:raise RuntimeError('Menos de 8 GiB livres; coleta pausada')
    out=DEST/(month+'.json')
    if out.exists():
        d=json.loads(out.read_text());return {'month':month,'path':str(out.relative_to(ROOT)),'sha256':sha(out),'minutes':len(d['candles']),'sources':d['sources']}
    year,mon=map(int,month.split('-'));start=int(datetime(year,mon,1,tzinfo=timezone.utc).timestamp()*1000);count=calendar.monthrange(year,mon)[1]*1440
    d={'month':month,'candles':[],'marks':[],'sources':[]}
    for kind,key in [('klines','candles'),('markPriceKlines','marks')]:
        rows,source=archive(kind,month)
        values=[[int(r[0]),*map(float,r[1:6]),float(r[7]),float(r[9])] if key=='candles' else [int(r[0]),*map(float,r[1:5])] for r in rows]
        by={r[0]:r for r in values}
        if len(by)!=len(values):raise ValueError('Duplicata '+month)
        wanted=set(range(start,start+count*60000,60000));missing=sorted(wanted-set(by))
        while missing:
            batch=[missing[0]]
            for t in missing[1:]:
                if t!=batch[-1]+60000 or len(batch)>=1000:break
                batch.append(t)
            endpoint='klines' if key=='candles' else 'markPriceKlines'
            url=f'https://fapi.binance.com/fapi/v1/{endpoint}?symbol=ETHUSDT&interval=1m&startTime={batch[0]}&endTime={batch[-1]+59999}&limit=1500'
            rf=CACHE/f'{kind}-{month}-{batch[0]}-repair.json';raw=rf.read_bytes() if rf.exists() else fetch(url);rf.write_bytes(raw)
            for r in json.loads(raw):
                if int(r[0]) in batch:by[int(r[0])]=[int(r[0]),*map(float,r[1:6]),float(r[7]),float(r[9])] if key=='candles' else [int(r[0]),*map(float,r[1:5])]
            if any(t not in by for t in batch):raise ValueError('Minutos ausentes não recuperados '+month)
            d['sources'].append({'url':url,'sha256':hashlib.sha256(raw).hexdigest(),'rows':len(batch),'repair':True});missing=sorted(wanted-set(by))
        values=[by[t] for t in sorted(by)]
        if len(values)!=count or any(r[0]!=start+i*60000 for i,r in enumerate(values)):raise ValueError('Cobertura incompleta '+month)
        if any(not all(math.isfinite(v) for v in r) or not(r[2]>=max(r[1],r[4]) and r[3]<=min(r[1],r[4]) and r[3]>0) for r in values):raise ValueError('OHLC inválido '+month)
        if key=='candles' and any(not(0<=r[7]<=r[5] and r[6]>=0) for r in values):raise ValueError('Volume inválido')
        d[key]=values;d['sources'].append(source)
    atomic(out,d)
    return {'month':month,'path':str(out.relative_to(ROOT)),'sha256':sha(out),'minutes':count,'sources':d['sources']}
def main():
    DEST.mkdir(parents=True,exist_ok=True);CACHE.mkdir(parents=True,exist_ok=True)
    original=ROOT/'data/scalp-tree/manifest.json';original_sha=sha(original);existing=json.loads(original.read_text())['months']
    requested=[f'{y}-{m:02}' for y in range(2019,2024) for m in range(1,13) if '2019-12'<=f'{y}-{m:02}'<'2023-12']
    state={'state':'downloading','pid':os.getpid(),'startedAt':datetime.now(timezone.utc).isoformat(),'additionalRequested':48,'targetMonths':82,'completed':0,'unavailable':[],'existingMonths':len(existing),'requestedFirst':'2019-12','end':'2026-10','realOrders':False};entries=[]
    def save():
        state.update(updatedAt=datetime.now(timezone.utc).isoformat(),completed=len(entries),freeGiB=round(shutil.disk_usage(ROOT).free/1024**3,2));atomic(STATUS,state)
        atomic(DEST/'manifest.json',{'symbol':'ETHUSDT','intervalMs':60000,'requestedFirst':'2019-12','end':'2026-10','months':sorted(entries+existing,key=lambda e:e['month']),'unavailable':state['unavailable'],'originalManifestSHA256':original_sha,'totalMonths':len(entries)+len(existing),'complete':state['state']=='completed','fundingSource':'web/data/eth-donchian-history.json','fundingSourceSHA256':sha(ROOT/'web/data/eth-donchian-history.json'),'note':'Dados novos separados; referências aos 34 shards congelados. Mês sem mark price/cobertura íntegra não entra em backtest.'})
    save()
    with ThreadPoolExecutor(max_workers=2) as pool:
        jobs={pool.submit(load,m):m for m in requested}
        for job in as_completed(jobs):
            month=jobs[job]
            try:entries.append(job.result());print(json.dumps({'month':month,'verified':True}),flush=True)
            except Exception as e:
                reason=str(e)
                if isinstance(e,subprocess.CalledProcessError):reason=(e.stderr or b'').decode()[-300:] or reason
                state['unavailable'].append({'month':month,'reason':reason});print(json.dumps({'month':month,'error':reason}),flush=True)
            if sha(original)!=original_sha:raise RuntimeError('Manifesto original alterado')
            save()
    state['state']='completed' if not state['unavailable'] else 'partial';save()
if __name__=='__main__':main()
