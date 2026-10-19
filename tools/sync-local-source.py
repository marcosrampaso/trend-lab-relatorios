"""Export reviewed source files; never copies runtime databases, candles or weights."""
import argparse, hashlib, json, shutil
from datetime import datetime, timezone
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--source',required=True);args=p.parse_args()
src=Path(args.source).resolve();repo=Path(__file__).resolve().parent.parent
if not (src/'local/server.mjs').is_file() or not (src/'package.json').is_file():raise SystemExit('Expected Trend Lab source checkout')
allowed={'.mjs','.js','.py','.sh','.css','.md','.html','.command','.txt'}
files=[]
for directory in ['local','worker','scripts','tests']:
 for f in (src/directory).rglob('*'):
  if f.is_file() and '__pycache__' not in f.parts and f.suffix in allowed:files.append(f)
for f in src.iterdir():
 if f.is_file() and (f.suffix in {'.md','.command'} or f.name.startswith(('requirements-local-ml','requirements-local-sentiment')) or f.name=='package.json' or f.name.endswith(('-protocol.json','-freeze.json'))):files.append(f)
for f in (src/'web').iterdir():
 if f.is_file() and f.suffix in {'.js','.css','.html'}:files.append(f)
if (src/'web/vendor').exists():files += [f for f in (src/'web/vendor').rglob('*') if f.is_file() and f.suffix in {'.js','.css'}]
files.append(src/'web/data/forward-protocol.json')
for name in ['experimento-noticias.html','experimento-noticias.js','experimento-noticias.css','cripto-sentimento.html','cripto-sentimento.js','cripto-sentimento.css','daytrade-integrado.html','daytrade-integrado.js','cdi-comparativo.html','cdi-overlay.js','cdi-overlay.css','donchian-lab.html','donchian-lab.js','donchian-genetico.html','donchian-genetico.js','donchian-genetico.css','donchian-defesa.html','donchian-defesa.js','g151-evolucao.html','g151-evolucao.js','g151-evolucao.css']:
 files.append(src/'web/pesquisa-genetica'/name)
manifest={}
for f in sorted(set(files)):
 rel=f.relative_to(src);target=repo/'app'/rel;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(f,target)
 manifest[str(rel)]={'sha256':hashlib.sha256(f.read_bytes()).hexdigest(),'bytes':f.stat().st_size}
record={'exportedAt':datetime.now(timezone.utc).isoformat(),'files':manifest,'excluded':['.local','work','data/history-v2','data/scalp-tree*','champions','model binaries','credentials','PDF originals'],'note':'Source snapshot; models and data must be restored separately for full reproduction.'}
(repo/'app/source-manifest.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'files':len(manifest),'bytes':sum(d['bytes'] for d in manifest.values()),'target':'app/'}))
