"""Official minute archives, checksums, monthly shards; never overwrite frozen studies."""
import csv, hashlib, io, json, subprocess, zipfile, calendar
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

root=Path(__file__).resolve().parent.parent
p=json.loads((root/'scalp-tree-protocol.json').read_text())
cache=root/'.cache/scalp-tree'; cache.mkdir(parents=True,exist_ok=True)
dest=root/'data/scalp-tree'; dest.mkdir(parents=True,exist_ok=True)
history=json.loads((root/'web/data/eth-donchian-history.json').read_text())
freeze=json.loads((root/'donchian-history-freeze.json').read_text())
if hashlib.sha256((root/'web/data/eth-donchian-history.json').read_bytes()).hexdigest()!=freeze['dataSHA256']:
    raise ValueError('Histórico horário alterado')
hmap={r[0]:r for r in history['candles']}
months=[]; year,month=map(int,p['warmupStart'][:7].split('-'))
while f'{year:04d}-{month:02d}'<p['end'][:7]:
    months.append(f'{year:04d}-{month:02d}')
    year,month=(year+1,1) if month==12 else (year,month+1)

def get(url):
    return subprocess.check_output(['curl','-fLsS','--retry','2','--connect-timeout','10','--max-time','55',url])

def load(month):
    output=dest/(month+'.json')
    if output.exists():
        existing=json.loads(output.read_text())
        if existing.get('month')!=month: raise ValueError('Shard incorreto')
        return {'month':month,'path':str(output.relative_to(root)),'sha256':hashlib.sha256(output.read_bytes()).hexdigest(),'minutes':len(existing['candles']),'sources':existing['sources'],'hourlyDifferences':existing.get('hourlyDifferences',[])}
    data={'month':month,'candles':[],'marks':[],'sources':[]}
    year,mon=map(int,month.split('-')); first=int(datetime(year,mon,1,tzinfo=timezone.utc).timestamp()*1000)
    count=calendar.monthrange(year,mon)[1]*1440
    for kind,key in [('klines','candles'),('markPriceKlines','marks')]:
        name=f'ETHUSDT-1m-{month}.zip'; url=f'https://data.binance.vision/data/futures/um/monthly/{kind}/ETHUSDT/1m/{name}'
        file=cache/(kind+'-'+name); checksum=file.with_suffix('.sha256')
        raw=file.read_bytes() if file.exists() else get(url)
        expected=checksum.read_text().strip() if checksum.exists() else get(url+'.CHECKSUM').decode().split()[0]
        if hashlib.sha256(raw).hexdigest()!=expected: raise ValueError('Checksum inválido '+url)
        file.write_bytes(raw); checksum.write_text(expected)
        z=zipfile.ZipFile(io.BytesIO(raw))
        for r in csv.reader(io.StringIO(z.read(z.namelist()[0]).decode())):
            if not r[0].isdigit(): continue
            t=int(r[0])
            row=[t,*map(float,r[1:6]),float(r[7]),float(r[9])] if key=='candles' else [t,*map(float,r[1:5])]
            data[key].append(row)
        rows=data[key]
        data['sources'].append({'url':url,'sha256':expected,'rows':len(rows)})
        by_time={r[0]:r for r in rows}
        if len(by_time)!=len(rows): raise ValueError('Duplicatas '+url)
        missing=sorted(set(range(first,first+count*60000,60000))-set(by_time))
        while missing:
            batch=[missing[0]]
            for t in missing[1:]:
                if t!=batch[-1]+60000 or len(batch)>=1000: break
                batch.append(t)
            endpoint='klines' if key=='candles' else 'markPriceKlines'
            repair_url=f'https://fapi.binance.com/fapi/v1/{endpoint}?symbol=ETHUSDT&interval=1m&startTime={batch[0]}&endTime={batch[-1]+59999}&limit=1500'
            repair_file=cache/(f'{kind}-{month}-{batch[0]}-repair.json')
            repair=repair_file.read_bytes() if repair_file.exists() else get(repair_url)
            repair_file.write_bytes(repair)
            recovered=json.loads(repair)
            for r in recovered:
                t=int(r[0])
                if t in batch:
                    by_time[t]=[t,*map(float,r[1:6]),float(r[7]),float(r[9])] if key=='candles' else [t,*map(float,r[1:5])]
            if any(t not in by_time for t in batch): raise ValueError('API não recuperou minutos ausentes')
            data['sources'].append({'url':repair_url,'sha256':hashlib.sha256(repair).hexdigest(),'rows':len(batch),'repair':True,'note':'API oficial sem checksum externo; resposta preservada, sem interpolação.'})
            missing=sorted(set(missing)-set(by_time))
        rows=data[key]=[by_time[t] for t in sorted(by_time)]
        if len(rows)!=count or any(r[0]!=first+i*60000 for i,r in enumerate(rows)): raise ValueError('Lacuna/duplicata '+url)
        if any(not(r[2]>=max(r[1],r[4]) and r[3]<=min(r[1],r[4]) and r[3]>0) for r in rows): raise ValueError('OHLC inválido')
    if any(not(0<=r[7]<=r[5] and r[6]>=0) for r in data['candles']): raise ValueError('Volume inválido')
    data['hourlyDifferences']=[]
    for i in range(0,len(data['candles']),60):
        a=data['candles'][i:i+60]; h=hmap[a[0][0]]
        values=[a[0][1],max(r[2] for r in a),min(r[3] for r in a),a[-1][4]]
        if any(abs(v-h[k+1])>1e-7 for k,v in enumerate(values)):
            data['hourlyDifferences'].append({'at':a[0][0],'minuteAggregated':values,'earlierHourlyArchive':h[1:5]})
    output.write_text(json.dumps(data,separators=(',',':')))
    return {'month':month,'path':str(output.relative_to(root)),'sha256':hashlib.sha256(output.read_bytes()).hexdigest(),'minutes':count,'sources':data['sources'],'hourlyDifferences':data['hourlyDifferences']}

entries=[]
with ThreadPoolExecutor(max_workers=4) as pool:
    for item in pool.map(load,months):
        entries.append(item); print(json.dumps({'month':item['month'],'minutes':item['minutes'],'verified':True}),flush=True)
differences=sum(len(e['hourlyDifferences']) for e in entries)
manifest={'symbol':'ETHUSDT','intervalMs':60000,'first':p['warmupStart'],'end':p['end'],'retrievedAt':datetime.now(timezone.utc).isoformat(),'months':entries,'fundingSourceSHA256':freeze['dataSHA256'],'totalMinutes':sum(e['minutes'] for e in entries),'checksums':len(entries)*2,'hourlyReconciled':differences==0,'differentHours':differences,'contextSource':'Contexto1h/4h agregado da mesma base1min nesta janela; histórico horário anterior somente para aquecimento. Divergências entre arquivos oficiais preservadas para auditoria.'}
target=dest/'manifest.json'
if target.exists():
    old=json.loads(target.read_text()); manifest['retrievedAt']=old['retrievedAt']
    if old!=manifest: raise ValueError('Manifesto anterior divergente; não sobrescrito')
else: target.write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps({'months':len(entries),'minutes':manifest['totalMinutes'],'checksums':manifest['checksums']}),flush=True)
