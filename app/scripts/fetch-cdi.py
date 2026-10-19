"""Download public BCB daily CDI and monthly cross-check; reject HTML and partial responses."""
import hashlib,json,urllib.request,urllib.parse
from pathlib import Path
from datetime import datetime,timezone
ROOT=Path(__file__).resolve().parent.parent
def main():
 folder=ROOT/'data/cdi';folder.mkdir(parents=True,exist_ok=True)
 for series,file,manifest,unit in [(12,'sgs-12.json','manifest.json','% a.d.'),(4391,'sgs-4391.json','monthly-manifest.json','% a.m.')]:
  query=urllib.parse.urlencode({'formato':'json','dataInicial':'01/06/2025','dataFinal':'31/08/2026'});url=f'https://api.bcb.gov.br/dados/serie/bcdata.sgs.{series}/dados?'+query
  request=urllib.request.Request(url,headers={'Accept':'application/json','User-Agent':'TrendLab-Research/1.0'})
  with urllib.request.urlopen(request,timeout=30) as response:raw=response.read()
  try:rows=json.loads(raw)
  except json.JSONDecodeError:raise ValueError('BCB não devolveu JSON; arquivo anterior preservado')
  if not isinstance(rows,list) or len(rows)<(200 if series==12 else 15):raise ValueError('Série BCB incompleta; arquivo anterior preservado')
  for row in rows:datetime.strptime(row['data'],'%d/%m/%Y');float(row['valor'])
  metadata={'source':url,'series':series,'unit':unit,'retrievedAt':datetime.now(timezone.utc).isoformat(),'sha256':hashlib.sha256(raw).hexdigest(),'observations':len(rows),'first':rows[0]['data'],'last':rows[-1]['data'],'requestedStart':'2025-06-01','requestedEnd':'2026-08-31'}
  target=folder/file;tmp=target.with_suffix('.tmp');tmp.write_bytes(raw);tmp.replace(target)
  target=folder/manifest;tmp=target.with_suffix('.tmp');tmp.write_text(json.dumps(metadata,indent=2));tmp.replace(target);print(json.dumps(metadata))
if __name__=='__main__':main()
