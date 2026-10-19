"""Isolated official Ipeadata/BCB CDI reference; preserves prior studies and revisions."""
import concurrent.futures,hashlib,json,math,urllib.request
from pathlib import Path
from datetime import datetime,timezone
ROOT=Path(__file__).resolve().parent.parent;OUT=ROOT/'work/cdi-comparison-v1';OUT.mkdir(parents=True,exist_ok=True)
def get(code):
 url="https://www.ipeadata.gov.br/api/odata4/ValoresSerie(SERCODIGO='"+code+"')"
 req=urllib.request.Request(url,headers={'User-Agent':'TrendLab/1.0 (CDI reference)'})
 with urllib.request.urlopen(req,timeout=25) as r:raw=r.read(5000000)
 d=json.loads(raw);rows=[];seen=set()
 for x in d['value']:
  date=x['VALDATA'][:10]
  if date<'2019-12-01' or date>datetime.now(timezone.utc).strftime('%Y-%m-%d'):continue
  datetime.strptime(date,'%Y-%m-%d');v=float(x['VALVALOR'])
  if x['SERCODIGO']!=code or date in seen or not math.isfinite(v) or not 0<=v<50:raise ValueError('Invalid CDI series')
  seen.add(date);rows.append({'date':date,'value':v})
 return raw,sorted(rows,key=lambda r:r['date']),url
def main():
 old=json.loads((ROOT/'data/cdi/extended/sources.json').read_text())
 for s in old['sources']:
  for f,h in [(s['rawFile'],s['rawSHA256']),(s['normalizedFile'],s['normalizedSHA256'])]:
   if hashlib.sha256((ROOT/f).read_bytes()).hexdigest()!=h:raise ValueError('Frozen CDI input changed')
 codes=['SGS366_CDI366','BM12_TJCDI12'];fetched={};errors=[]
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
  tasks={pool.submit(get,c):c for c in codes}
  for task in concurrent.futures.as_completed(tasks):
   try:fetched[tasks[task]]=task.result()
   except Exception as e:errors.append({'series':tasks[task],'error':str(e)})
 data={};sources=[];stamp=datetime.now(timezone.utc).isoformat();excluded={r['date'] for r in old.get('excludedNonBusinessObservations',[])}
 prior=json.loads((OUT/'rates.json').read_text()) if (OUT/'rates.json').exists() else {}
 for code,name in zip(codes,['daily','monthly']):
  existing=json.loads((ROOT/'data/cdi/extended'/f'{name}.json').read_text());m={r['date']:r for r in existing}
  for r in prior.get(name,[]):
   if name=='monthly' and r['date'][:7]>=stamp[:7]:continue
   if r['date'] in m and abs(m[r['date']]['value']-r['value'])>1e-10:raise ValueError('Cached CDI conflicts with frozen reference')
   m[r['date']]=r
  if code in fetched:
   raw,rows,url=fetched[code];rawfile=OUT/(code+'-'+hashlib.sha256(raw).hexdigest()[:16]+'.json')
   if not rawfile.exists():rawfile.write_bytes(raw)
   for r in rows:
    if r['date'] in excluded:continue
    if r['date'] in m and abs(m[r['date']]['value']-r['value'])>1e-10:raise ValueError('Published historical CDI revision; kept old reference, manual review required: '+r['date'])
    m[r['date']]=r
   sources.append({'provider':'Ipeadata','originalSource':'Banco Central do Brasil','series':code,'unit':'% ao dia' if name=='daily' else '% ao mês','url':url,'rawFile':str(rawfile.relative_to(ROOT)),'sha256':hashlib.sha256(raw).hexdigest(),'retrievedAt':stamp})
  else:sources.append({'provider':'Ipeadata cached validated series','series':code,'source':old['sources'][codes.index(code)]})
  data[name]=sorted(m.values(),key=lambda r:r['date'])
 currentMonth=stamp[:7];checks=[]
 for m in data['monthly']:
  if m['date'][:7]>=currentMonth:continue
  rows=[r for r in data['daily'] if r['date'][:7]==m['date'][:7]];calc=(math.prod(1+r['value']/100 for r in rows)-1)*100
  if len(rows)<15 or abs(calc-m['value'])>.0055:raise ValueError('Daily CDI/monthly reconciliation failed '+m['date'])
  checks.append({'month':m['date'][:7],'observations':len(rows),'calculatedPct':calc,'publishedPct':m['value'],'verified':True})
 result={**data,'checks':checks,'sources':sources,'updatedAt':stamp,'lastDailyDate':data['daily'][-1]['date'],'excludedNonBusinessDates':sorted(excluded),'errors':errors,'status':'fresh' if not errors else 'cached-partial','method':'Daily multiplicative100%CDI before taxes. UTC calendar-day convention; complete days only, initial partial day excluded; no forward fill or current annual rate applied to the past.'}
 tmp=OUT/'rates.tmp';tmp.write_text(json.dumps(result,ensure_ascii=False));tmp.replace(OUT/'rates.json');print(json.dumps({'status':result['status'],'daily':len(data['daily']),'lastDailyDate':result['lastDailyDate'],'verifiedMonths':len(checks),'errors':errors}),flush=True)
if __name__=='__main__':main()
