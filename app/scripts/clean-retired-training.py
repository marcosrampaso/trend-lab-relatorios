"""Authorized cleanup, gated by independently verified champion backup and exact G0 replay."""
import argparse,gzip,hashlib,json,os,shutil,time,zipfile
from datetime import datetime,timezone
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
RUNS=['adaptive-20261018T162430002Z','extended-20261018-v2','search-v3-20261018T183222773Z']
def read(p):return json.loads(Path(p).read_text())
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--apply',action='store_true');args=ap.parse_args();prepared=read(ROOT/'work/search-v4-prepared.json');bundle=ROOT/prepared['bundle'];run=ROOT/'work/local-ml/runs'/prepared['runId'];verified=read(run/'baseline-frozen.json')
 if abs(verified['monthlyDifferenceBRL'])>1e-9 or verified['winner']['genome']['id']!='c6cb2a8370cd058b0be0':raise ValueError('G0 não verificada')
 if sha(bundle/'manifest.json')!=prepared['bundleManifestSHA256'] or sha(prepared['archive'])!=prepared['archiveSHA256']:raise ValueError('Backup alterado')
 for name,h in read(bundle/'manifest.json').items():
  if sha(bundle/name)!=h:raise ValueError('Backup corrompido '+name)
 for file in (run/'predictions').glob('*.json'):
  p=read(file)
  if sha(ROOT/p['artifact'])!=p['artifactSHA256']:raise ValueError('Modelo G0 corrompido')
 targets=[ROOT/'work/local-ml/runs'/r/n for r in RUNS for n in ['models','predictions']];files=[]
 for target in targets:
  if target.is_symlink() or target.resolve()!=target:raise ValueError('Diretório inesperado')
  for f in target.iterdir():
   if f.is_dir() and not f.is_symlink():raise ValueError('Subpasta não prevista '+str(f))
   files.append(f)
 estimated=sum(f.lstat().st_size for f in files if not f.is_symlink());plan={'createdAt':datetime.now(timezone.utc).isoformat(),'targets':[str(t.relative_to(ROOT)) for t in targets],'fileCount':len(files),'estimatedGiB':estimated/1024**3,'newRun':prepared['runId'],'championBackup':prepared['bundle'],'apply':args.apply};folder=ROOT/'work/training-cleanup';folder.mkdir(exist_ok=True);(folder/'plan.json').write_text(json.dumps(plan,indent=2)+'\n');print(json.dumps(plan),flush=True)
 if not args.apply:return
 before=shutil.disk_usage(ROOT).free;count=0;log=folder/'removed-artifacts.jsonl.gz'
 with gzip.open(log,'wt') as audit:
  for f in files:
   info={'path':str(f.relative_to(ROOT)),'bytes':f.lstat().st_size,'wasSymlink':f.is_symlink()};audit.write(json.dumps(info)+'\n');f.unlink();count+=1
 for r in RUNS:
  (ROOT/'work/local-ml/runs'/r/'pruned-artifacts.json').write_text(json.dumps({'authorizedBy':'Usuário: limpar tudo preservando o melhor, novaG0=G151','at':plan['createdAt'],'removed':['models/*','predictions/*'],'preserved':'Metadados, protocolos, scores e rótulos; campeão completo em'+prepared['bundle'],'newRun':prepared['runId'],'archiveSHA256':prepared['archiveSHA256']},ensure_ascii=False,indent=2)+'\n')
 result={**plan,'removedFiles':count,'freeBeforeGiB':before/1024**3,'freeAfterGiB':shutil.disk_usage(ROOT).free/1024**3,'finishedAt':datetime.now(timezone.utc).isoformat(),'removedArtifactsLogSHA256':sha(log),'historyChanged':False,'liveDatabaseChanged':False};(folder/'result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps(result),flush=True)
if __name__=='__main__':main()
