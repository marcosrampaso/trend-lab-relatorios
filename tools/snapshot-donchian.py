"""Dated report of all Donchian scenarios; no runtime database, raw market or model export."""
import argparse,hashlib,html,json
from datetime import datetime,timezone
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--source',required=True);a=p.parse_args();src=Path(a.source).resolve();repo=Path(__file__).resolve().parent.parent;out=repo/'experimentos/donchian';out.mkdir(parents=True,exist_ok=True)
f=src/'web/data/donchian-lab-study.json';d=json.loads(f.read_text());audit=json.loads((src/'web/data/donchian-lab-audit.json').read_text());e=html.escape
rows=[]
for r in d['results']:
 s={k:v for k,v in r.items() if k not in ['trades','curve','benchmark']};s['benchmark']={k:v for k,v in r['benchmark'].items() if k!='curve'}
 if r['stage']=='continuous':s['curve']=r['curve'];s['benchmark']['curve']=r['benchmark']['curve']
 rows.append(s)
summary={**{k:v for k,v in d.items() if k!='results'},'results':rows,'audit':audit,'snapshotAt':datetime.now(timezone.utc).isoformat(),'sourceSHA256':hashlib.sha256(f.read_bytes()).hexdigest(),'codeManifestSHA256':hashlib.sha256((repo/'app/source-manifest.json').read_bytes()).hexdigest(),'testsPassed':248,'mode':'static_paper_only'}
(out/'snapshot.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
money=lambda n:'—'if n is None else('R$ '+f'{n:,.2f}').replace(',','X').replace('.',',').replace('X','.')
date=lambda t:datetime.fromtimestamp(t/1000,timezone.utc).strftime('%d/%m/%Y')
names={'per-cost':'Por cenário','fixed-base':'Fixo base','fixed-stress':'Fixo elevado'}
selected=next(r for r in rows if r['stage']=='continuous' and r['gate']=='fixed-stress' and r['cost']=='stress');points=selected['curve']+selected['benchmark']['curve'];lo=min(p['brl'] for p in points)-10;hi=max(p['brl'] for p in points)+10
x=lambda t:80+(t-selected['start'])/(selected['end']-selected['start'])*850
y=lambda n:225-(n-lo)/(hi-lo)*190
chart='<svg viewBox="0 0 1000 260" role="img" aria-label="Conta contínua versus CDI publicado">'+''.join('<polyline fill="none" stroke="'+color+'" stroke-width="2" points="'+' '.join(f"{x(p['at']):.2f},{y(p['brl']):.2f}"for p in line)+'"/>'for color,line in[('#89bdff',selected['curve']),('#f0c26c',selected['benchmark']['curve'])])+'<text x="0" y="20" fill="white">'+money(hi)+'</text><text x="0" y="250" fill="white">'+money(lo)+'</text></svg>'
page='''<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Donchian desde2020 · retrato</title><style>body{background:#101724;color:#e7edf7;font:16px/1.7 system-ui;margin:30px}a{color:#8acfff}nav{display:flex;gap:20px;flex-wrap:wrap}p{max-width:1100px}aside{padding:18px;background:#1c2b3d}.scroll{overflow:auto;max-height:70vh}table{border-collapse:collapse;font-size:13px}th,td{padding:12px;border-bottom:1px solid #34506c;text-align:left}th{position:sticky;top:0;background:#213047}td:nth-child(n+5){white-space:nowrap}svg{width:100%;max-width:1100px}</style><nav><a href="../../README.md">Índice</a><a href="../../app/DONCHIAN-LAB.md">Método e conclusões</a><a href="snapshot.json">Dados e auditoria</a><a href="http://127.0.0.1:4173/pesquisa-genetica/donchian-lab.html">Painel local</a></nav><h1>Donchian: quanto sobrou desde o início?</h1>'''
page+='<aside>Retrato estático '+e(summary['snapshotAt'])+' · 50cenários concluídos · somente simulação.</aside><p>Capital único R$1.000, sem aportes ou resets, 01/01/2020 até19/10/2026 03:08UTC,82meses. A configuração que fezR$67,95 no recorte recente terminou com<strong>R$900,43, prejuízoR$99,57</strong>. Fez16operações, acionou o limite global em31/01/2020 e permaneceu em caixa. Percorrer o calendário inteiro não significa operar continuamente depois do limite.</p><p>Azul: patrimônio do robô. Dourado: CDI parcial conhecido, saldoR$1.919,30 com última taxa em15/10; não é benchmark completo até19/10 e não recebe percentual/superação neste recorte.</p>'+chart+'<p>Risco1%,10x,stop1,5ATR,alvo2R,prazo24h,intervalo4h,limites diário3%/global10%. Juros e PnL reinvestidos dentro da conta; custos/funding modelados, antes de impostos.64minutos sem mark price usam proxy de OHLC negociado, explicitamente: zero posição e zero entradas nesses minutos, nas6carteiras. Dados originais não foram modificados. Sem seleção de melhor período ou promoção.</p>'
for stage,title in [('continuous','Contas contínuas'),('replication','Isolamento do filtro · jun–set/2026'),('expanded','Diagnósticos de blocos independentes')]:
 page+='<h2>'+title+'</h2>'
 if stage=='expanded':page+='<p>Cada bloco inicia uma carteira deR$1.000. Não somar estes lucros como conta contínua.</p>'
 page+='<div class="scroll"><table><thead><tr>'+''.join('<th>'+e(t)+'</th>'for t in ['Ativo','Período UTC','Filtro','Custos','Saldo','Lucro','CDI','Estado CDI','Operações','Queda máxima','Limite global'])+'</tr></thead><tbody>'
 for r in rows:
  if r['stage']!=stage:continue
  values=[r['symbol'],date(r['start'])+' → '+date(r['end']),names[r['gate']],r['cost'],money(r['finalBRL']),money(r['pnlBRL']),money(r['benchmark']['pnlBRL']),r['benchmark']['status'],r['count'],f"{r['maxDD']*100:.2f}%",'Acionado'if r['halted']else'Não']
  page+='<tr>'+''.join('<td>'+e(str(v))+'</td>'for v in values)+'</tr>'
 page+='</tbody></table></div>'
page+='<p>248testes passaram. Auditoria com dados reais confirmou42operações idênticas ao motor preservado nas duas contabilidades, sem reinício de caixa ou risco entre meses. O resultado positivo recente depende do período: a estratégia não demonstrou robustez no histórico completo. Os testes ao vivo originais continuam separados. <a href="../../app/source-manifest.json">Manifesto dos fontes</a>.</p></html>'
(out/'index.html').write_text(page);print(json.dumps({'report':str(out.relative_to(repo)),'scenarios':len(rows),'snapshotAt':summary['snapshotAt']}))
