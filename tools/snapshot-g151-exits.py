"""Publish derived G151 exit results and a portable dashboard; no raw candles or weights."""
import argparse, hashlib, json, re, shutil
from pathlib import Path
from datetime import datetime, timezone
p=argparse.ArgumentParser();p.add_argument('--source',required=True);args=p.parse_args()
src=Path(args.source).resolve();repo=Path(__file__).resolve().parent.parent;out=repo/'experimentos/g151-saidas';out.mkdir(parents=True,exist_ok=True)
d=json.loads((src/'web/data/g151-exits.json').read_text());audit=json.loads((src/'web/data/g151-exits-audit.json').read_text())
if d['status']!='complete' or audit['windows']!=928:raise SystemExit('Incomplete G151 experiment')
if hashlib.sha256((src/'web/data/g151-exits.json').read_bytes()).hexdigest()!=audit['reportSHA256']:raise SystemExit('Audit/report mismatch')
log=(src/'work/g151-exits-all-tests.log').read_text();tests=re.search(r'ℹ pass (\d+)',log)
if not tests or not re.search(r'ℹ fail 0\b',log):raise SystemExit('Missing passing tests')
# Monthly summaries live in aggregates; omit individual months and keep at most ten
# actual protected positions per continuous account. Full local result stays untouched.
snapshot={**d,'rows':[],'continuous':[{**c,'trades':[t for t in c['trades'] if t['stopHistory']][:10],'sampleLimit':10}for c in d['continuous']],'snapshotAt':datetime.now(timezone.utc).isoformat(),'testsPassed':int(tests.group(1)),'codeManifestSHA256':hashlib.sha256((repo/'app/source-manifest.json').read_bytes()).hexdigest(),'snapshotNote':'Derived aggregates, daily curves and up to10 real protected positions/account. Not a running service.'}
(out/'snapshot.json').write_text(json.dumps(snapshot,ensure_ascii=False,separators=(',',':'))+'\n');(out/'audit.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2)+'\n')
for name in ['experimento-noticias.css','g151-evolucao.css']:shutil.copyfile(src/'web/pesquisa-genetica'/name,out/name)
page=(src/'web/pesquisa-genetica/g151-evolucao.html').read_text().replace('../?view=replay','../../README.md').replace('../data/g151-exits.json','snapshot.json').replace('Dados completos','Retrato dos dados').replace('../data/g151-exits-audit.json','audit.json').replace('Até 50 posições','Até 10 posições').replace('<div class="eyebrow">G151 · RANDOM FOREST · ESTUDO DE SAÍDAS</div>','<div class="eyebrow">G151 · RETRATO ESTÁTICO · SOMENTE SIMULAÇÃO</div>')
(out/'index.html').write_text(page)
script=(src/'web/pesquisa-genetica/g151-evolucao.js').read_text().replace("'../data/g151-exits.json?t='","'snapshot.json?t='")
(out/'g151-evolucao.js').write_text(script)
print(json.dumps({'report':str(out.relative_to(repo)),'snapshotBytes':(out/'snapshot.json').stat().st_size,'testsPassed':int(tests.group(1)),'realOrders':False}))
