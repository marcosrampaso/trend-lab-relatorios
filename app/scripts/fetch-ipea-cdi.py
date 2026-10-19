"""Official Ipeadata mirror of BCB CDI daily/monthly. No estimated or forward-filled rates."""
import argparse,hashlib,json,math,urllib.request
from pathlib import Path
from datetime import datetime,timezone
ROOT=Path(__file__).resolve().parent.parent
def save(path,value):
 tmp=path.with_suffix('.tmp');tmp.write_text(json.dumps(value,ensure_ascii=False,indent=2));tmp.replace(path)
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--cached',action='store_true');args=ap.parse_args();folder=ROOT/'data/cdi';folder.mkdir(parents=True,exist_ok=True);sources=[];results={}
 cached_metadata=ROOT/'work/cdi/ipea-cdi-metadata.json';metadata=json.loads(cached_metadata.read_text()) if args.cached and cached_metadata.exists() else []
 for code,name,period in [('SGS366_CDI366','daily','Diária'),('BM12_TJCDI12','monthly','Mensal')]:
  url="https://www.ipeadata.gov.br/api/odata4/ValoresSerie(SERCODIGO='"+code+"')";rawfile=folder/(code+'-raw.json');meta=next((r for r in metadata if r['SERCODIGO']==code),None)
  if not meta:
   with urllib.request.urlopen("https://www.ipeadata.gov.br/api/odata4/Metadados('"+code+"')",timeout=30) as r:meta=json.load(r)['value'][0]
  if meta['PERNOME']!=period or 'Banco Central' not in meta['FNTNOME']:raise ValueError('Metadados de CDI não correspondem à série esperada')
  if args.cached and rawfile.exists():raw=rawfile.read_bytes()
  else:
   with urllib.request.urlopen(url,timeout=30) as response:raw=response.read()
  data=json.loads(raw)['value'];rows=[];seen=set()
  for r in data:
   date=r['VALDATA'][:10]
   if not '2025-06-01'<=date<'2026-09-01':continue
   value=float(r['VALVALOR']);datetime.strptime(date,'%Y-%m-%d')
   if date in seen or not math.isfinite(value) or not 0<=value<(5 if name=='daily' else 50):raise ValueError('Taxa ou data inválida')
   seen.add(date);rows.append({'date':date,'value':value})
  rows.sort(key=lambda r:r['date'])
  if len(rows)<(200 if name=='daily' else 15):raise ValueError('Cobertura insuficiente')
  rawfile.write_bytes(raw);save(folder/(code+'-metadata.json'),meta);save(folder/(name+'.json'),rows)
  sources.append({'provider':'Ipeadata','originalSource':meta['FNTNOME'],'series':code,'periodicity':period,'unit':'% ao dia' if name=='daily' else '% ao mês','source':url,'metadataSource':"https://www.ipeadata.gov.br/api/odata4/Metadados('"+code+"')",'retrievedAt':datetime.now(timezone.utc).isoformat(),'rawFile':str(rawfile.relative_to(ROOT)),'rawSHA256':hashlib.sha256(raw).hexdigest(),'normalizedFile':'data/cdi/'+name+'.json','normalizedSHA256':hashlib.sha256((folder/(name+'.json')).read_bytes()).hexdigest(),'count':len(rows),'first':rows[0]['date'],'last':rows[-1]['date']});results[name]=rows
 for m in results['monthly']:
  a=[r for r in results['daily'] if r['date'][:7]==m['date'][:7]];factor=math.prod(1+r['value']/100 for r in a);difference=abs((factor-1)*100-m['value'])
  if len(a)<15 or difference>.0055:raise ValueError('Série diária diverge do acumulado mensal: '+m['date'])
 save(folder/'sources.json',{'sources':sources,'coverageCheckedMonths':len(results['monthly']),'directBCBStatus':'A API direta devolveu HTML de requisição inválida; usadas séries oficiais doBCB republicadas peloIpeadata.','methodology':'https://www.b3.com.br/pt_br/market-data-e-indices/indices/indices-de-segmentos-e-setoriais/di/metodologia-de-calcudo-acumulado-de-di/'})
 print(json.dumps({'daily':len(results['daily']),'monthly':len(results['monthly']),'monthlyCrossChecks':'OK'}))
if __name__=='__main__':main()
