"""Independent data/temporal audit for the fixed-champion evaluation."""
import datetime,hashlib,json
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
RUN=ROOT/'work/expanded-validation/g151-fixed-funding-v2'
read=lambda p:json.loads(Path(p).read_text())
p=read(RUN/'registration.json');manifest=read(ROOT/'data/scalp-tree-extended/manifest.json')
history=read(ROOT/manifest['fundingSource']);fund={int(t//60000*60000):[t,r]for t,r in history['funding']}
assert len(fund)==len(history['funding']),'Repeated funding minute'
raw=[]
for item in manifest['months']:
    file=ROOT/item['path'];assert hashlib.sha256(file.read_bytes()).hexdigest()==item['sha256']
    data=read(file);y,m=map(int,item['month'].split('-'));start=int(datetime.datetime(y,m,1,tzinfo=datetime.timezone.utc).timestamp()*1000);end=int(datetime.datetime(y+(m==12),m%12+1,1,tzinfo=datetime.timezone.utc).timestamp()*1000);expected=(end-start)//60000
    assert len(data['candles'])==len(data['marks'])==expected,item['month']
    assert all(c[0]==start+i*60000==mark[0]for i,(c,mark)in enumerate(zip(data['candles'],data['marks']))),item['month']
    slots=list(range(start,end,8*3600000));assert all(t in fund for t in slots),item['month']+' funding gaps'
    raw.append({'month':item['month'],'minutes':expected,'continuous':True,'alignedMarks':True,'fundingEvents':len(slots),'subminuteFunding':sum(fund[t][0]!=t for t in slots),'sha256':item['sha256']})
for file,expected in p['sourceSHA256'].items():assert hashlib.sha256((ROOT/file).read_bytes()).hexdigest()==expected,file
labels=[];legacy=ROOT/'work/expanded-validation/g151-fixed-v1'
for file in sorted((RUN/'months').glob('*.json')):
    part=read(file);old=read(legacy/'months'/file.name)
    for family,features in part['features'].items():
        assert features==old['features'][family]
        assert all(f['hourlyAt']<=f['at']and f['fourHourlyAt']<=f['at']for f in features)
    changes={}
    for family,rows in part['labels'].items():
        previous={r['at']:r for r in old['labels'][family]};current={r['at']:r for r in rows}
        for r in rows:
            assert r['labelAvailableAt']==r['at']+1445*60000
            assert r['y']==int(r['netUSDT']>0)
        changes[family]={'oldCount':len(previous),'newCount':len(current),'yChanged':sum(r['y']!=previous[t]['y']for t,r in current.items()if t in previous),'newlyExecutable':len(current.keys()-previous.keys()),'noLongerExecutable':len(previous.keys()-current.keys())}
    labels.append({'month':part['month'],'changes':changes})
predictions=[];reserved=int(datetime.datetime.strptime(p['plan']['reserved'],'%Y-%m').replace(tzinfo=datetime.timezone.utc).timestamp()*1000)
for file in sorted((RUN/'predictions').glob('*.json')):
    r=read(file);assert r['maxTrainLabelAvailableAt']<r['trainEnd'];assert r['modelParams']==p['genome']['params'];assert[r['seed']for r in r['seeds']]==p['seeds']
    assert all(r['trainEnd']<=at<reserved for at,score in r['predictions'])
    predictions.append({k:r[k]for k in ['block','family','trainCount','trainStart','trainEnd','maxTrainLabelAvailableAt','seconds']})
audit={'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'verifiedRawMonths':len(raw),'minuteCount':sum(r['minutes']for r in raw),'subminuteFundingRecords':sum(r['subminuteFunding']for r in raw),'raw':raw,'labels':labels,'labelClassChanges':sum(v['yChanged']for r in labels for v in r['changes'].values()),'sourceHashesVerified':len(p['sourceSHA256']),'modelsCompleted':len(predictions)*5,'temporalAudits':predictions,'futureFeatures':0,'finalTestEvaluated':False,'realOrders':False}
for file in [RUN/'data-audit.json',ROOT/'web/data/expanded-validation-audit.json']:
    tmp=file.with_suffix(file.suffix+'.tmp');tmp.write_text(json.dumps(audit,separators=(',',':')));tmp.replace(file)
print(json.dumps({k:v for k,v in audit.items()if k not in ['raw','labels','temporalAudits']}))
