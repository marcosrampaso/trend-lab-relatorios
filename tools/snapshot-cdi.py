"""Compact dated CDI comparison; excludes portfolio curves and private runtime files."""
import argparse, hashlib, html, json
from datetime import datetime, timezone
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--source',required=True);a=p.parse_args()
src=Path(a.source).resolve();repo=Path(__file__).resolve().parent.parent;out=repo/'experimentos/cdi';out.mkdir(parents=True,exist_ok=True)
f=src/'web/data/cdi-comparison.json';d=json.loads(f.read_text())
compact=lambda r:{k:v for k,v in r.items() if k!='curve'}
data={**d,'scenarios':[compact(s) for s in d['scenarios']],'benchmarks':{k:compact(b) for k,b in d['benchmarks'].items()},'snapshotAt':datetime.now(timezone.utc).isoformat(),'snapshotMode':'static_paper_only','sourceSHA256':hashlib.sha256(f.read_bytes()).hexdigest(),'codeManifestSHA256':hashlib.sha256((repo/'app/source-manifest.json').read_bytes()).hexdigest(),'testsPassed':248}
(out/'snapshot.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
e=html.escape
money=lambda x:'—' if x is None else ('R$ '+f'{x:,.2f}').replace(',','X').replace('.',',').replace('X','.')
pct=lambda x:'—' if x is None else f'{x:.2f}%'.replace('.',',')
date=lambda t:datetime.fromtimestamp(t/1000,timezone.utc).strftime('%d/%m/%Y')
names={'donchian-lab-study':'Donchian / lucros desde o início','multiasset-history':'BTC × ETH histórico','btc-context-study':'Filtro BTC','daytrade-integrated-history':'Day trade histórico','multiasset-forward':'BTC × ETH prospectivo','daytrade-integrated-forward':'Day trade prospectivo','news-filter-v1':'Notícias rompimento','g151-news-filter-v1':'Notícias G151','legacy':'Históricos anteriores','compound-benchmark-results':'Genética / blocos'}
rows=[]
for s in d['scenarios']:
 b=d['benchmarks'][s['benchmarkKey']]
 values=[names.get(s['group'],s['group']),s['symbol'],s['label'],s['cost'],date(s['start'])+' → '+date(s['end']),money(s['capitalBRL']),money(s['pnlBRL']),money(b['pnlBRL']),money(s['excessCDIBRL']),pct(s['percentOfCDI']),b['status'],s['health']]
 rows.append('<tr>'+''.join('<td>'+e(str(v))+'</td>'for v in values)+'</tr>')
page='''<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Todos os testes × CDI · retrato</title><style>body{background:#101724;color:#e7edf7;font:15px/1.7 system-ui;margin:30px}a{color:#8acfff}nav{display:flex;gap:20px;flex-wrap:wrap}aside{padding:18px;background:#1c2b3d}p{max-width:1100px}.scroll{overflow:auto;max-height:70vh}table{border-collapse:collapse;font-size:13px}th,td{padding:12px;border-bottom:1px solid #34506c;text-align:left}th{position:sticky;top:0;background:#213047}td:nth-child(n+6){white-space:nowrap}</style><nav><a href="../../README.md">Índice</a><a href="../../app/COMPARACAO-CDI.md">Método e limitações</a><a href="snapshot.json">Dados e proveniência</a><a href="http://127.0.0.1:4173/pesquisa-genetica/cdi-comparativo.html">Painel local com filtros e curvas</a></nav><h1>Todos os testes × CDI</h1>'''
page+='<aside>Retrato estático: '+e(data['snapshotAt'])+' · '+str(len(rows))+' cenários · última taxa disponível '+e(d['lastDailyDate'])+'.</aside><p>100% do CDI bruto teórico, juros reinvestidos, mesmo capital e datas por carteira. Robôs líquidos de custos modelados; ambos antes de impostos. Fontes BCB/Ipeadata, taxas diárias reconciliadas com os acumulados mensais. Dias UTC completos, início parcial excluído, sem projeção ou taxa anual atual aplicada ao passado. Referência provisória não recebe diferença ou percentual do CDI.</p><p>Junho–setembro/2026, R$ 1.000: CDI R$ 45,86; G151 ETH R$ 27,50 e Donchian adaptativo ETH R$ 27,04 nos custos base. Ganho positivo não implica superar o benchmark. A EMA BTC base supera o CDI nesse recorte, mas perde com custos elevados. Não há promoção automática nem validação independente. Cenários sobrepostos não podem ser somados.</p><div class="scroll"><table><thead><tr>'+''.join('<th>'+e(x)+'</th>'for x in ['Grupo','Ativo','Carteira','Custos','Período UTC','Capital','Lucro bot','Lucro CDI','Diferença CDI','% CDI','Referência','Estado origem'])+'</tr></thead><tbody>'+''.join(rows)+'</tbody></table></div><p>248 testes passaram. Este retrato não acompanha os processos ao vivo. As regras dos bots, modelos e estudos antigos foram preservados. Curvas originais ficam no painel local; nenhum caminho de patrimônio foi inventado. <a href="../../app/source-manifest.json">Manifesto dos fontes</a> · <a href="../../app/tests/cdi-reference.test.mjs">Testes do CDI</a>.</p></html>'
(out/'index.html').write_text(page)
print(json.dumps({'report':str(out.relative_to(repo)),'scenarios':len(rows),'snapshotAt':data['snapshotAt']}))
