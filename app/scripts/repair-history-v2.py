"""Attempt official minute repairs only in the new, unfrozen history catalogue."""
import importlib.util,json,hashlib
from pathlib import Path
from datetime import datetime,timezone
spec=importlib.util.spec_from_file_location('history',Path(__file__).with_name('collect-full-history-v2.py'));h=importlib.util.module_from_spec(spec);spec.loader.exec_module(h)
def main():
    manifest=h.read(h.DEST/'manifest.json');journal=[]
    for item in manifest['months']:
        if item['complete']:continue
        file=h.ROOT/item['path']
        if not file.is_relative_to(h.DEST):raise RuntimeError('Não alterar base congelada')
        data=h.read(file);before=h.sha(file);changed=False
        for key,kind,gaps in [('candles','klines',item['candleGaps']),('marks','markPriceKlines',item['markGaps'])]:
            by={r[0]:r for r in data[key]}
            for gap in gaps:
                cursor=gap['start']
                while cursor<gap['end']:
                    end=min(gap['end'],cursor+1500*60000);url=f'https://fapi.binance.com/fapi/v1/{kind}?symbol=ETHUSDT&interval=1m&startTime={cursor}&endTime={end-1}&limit=1500';record={'month':item['month'],'kind':kind,'start':cursor,'end':end,'url':url}
                    try:
                        raw=h.fetch(url);rows=json.loads(raw);assert isinstance(rows,list);record['responseSHA256']=hashlib.sha256(raw).hexdigest();count=0
                        for r in rows:
                            at=int(r[0])
                            if not(cursor<=at<end and at+60000<=manifest['snapshotEnd'])or at in by:continue
                            value=[at,*map(float,r[1:6]),float(r[7]),float(r[9])]if key=='candles'else[at,*map(float,r[1:5])]
                            if at%60000 or not(value[2]>=max(value[1],value[4])and value[3]<=min(value[1],value[4])and value[3]>0):raise ValueError('Minuto inválido')
                            by[at]=value;changed=True;count+=1
                        record['recovered']=count
                    except Exception as e:record['error']=str(e)[:160]
                    journal.append(record);h.atomic(h.WORK/'repairs.json',{'updatedAt':datetime.now(timezone.utc).isoformat(),'records':journal});cursor=end
            data[key]=[by[t]for t in sorted(by)]
        if changed:
            data.setdefault('repairs',[]).extend(r for r in journal if r['month']==item['month']);h.atomic(file,data);item['sha256']=h.sha(file);item.update(h.build_entry(item,manifest['snapshotEnd']));item['previousSHA256']=before
    h.atomic(h.DEST/'manifest.json',manifest);status=h.read(h.WORK/'status.json');status.update(repairFinishedAt=datetime.now(timezone.utc).isoformat(),completeCalendarMonths=sum(m['complete']for m in manifest['months']if m['month']!='2026-10'),candleMinutes=sum(m['minutes']for m in manifest['months']),alignedMinutes=sum(m['alignedMinutes']for m in manifest['months']),recoveredMinutes=sum(r.get('recovered',0)for r in journal));h.atomic(h.WORK/'status.json',status);h.atomic(h.ROOT/'web/data/history-v2-status.json',status);print(json.dumps(status))
if __name__=='__main__':main()
