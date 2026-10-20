"""Archive completed entry-classification evidence; no model execution or financial A/B."""
import argparse
import hashlib
import html
import json
import shutil
from pathlib import Path

p=argparse.ArgumentParser();p.add_argument('--source',required=True);a=p.parse_args()
src=Path(a.source).resolve();repo=Path(__file__).resolve().parent.parent
out=repo/'experiments/pepe-entry-risk-v1'
d=json.loads((src/'web/data/pepe-entry-risk.json').read_text())
if d['status']!='complete':raise SystemExit('Completed experiment required')
out.mkdir(parents=True,exist_ok=True)
files={'snapshot.json':src/'web/data/pepe-entry-risk.json',
       'registration.json':src/'work/pepe-entry-risk-v1/registration.json',
       'artifact-manifest.json':src/'work/pepe-entry-risk-v1/artifact-manifest.json',
       'painel.jpg':src/'output/entry-risk/probabilidades.jpg'}
manifest={}
for name,path in files.items():
    shutil.copyfile(path,out/name);manifest[name]=hashlib.sha256((out/name).read_bytes()).hexdigest()
rows=''.join('<tr>'+''.join('<td>'+html.escape(str(v))+'</td>' for v in [r['id'],f"{r['brier']:.5f}",f"{r['logLoss']:.5f}",f"{100*r['balancedAccuracy']:.1f}%" if r['balancedAccuracy'] is not None else '—'])+'</tr>'for r in d['results'])
body='''<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PEPE · risco nas entradas PPO</title><style>body{background:#101722;color:#e5eff8;font:16px/1.7 system-ui;max-width:1100px;margin:40px auto;padding:20px}a{color:#8fe1c5}table{border-collapse:collapse;width:100%}td,th{padding:12px;text-align:left;border-bottom:1px solid #34485b}.table{overflow:auto}img{max-width:100%}</style>
<h1>Risco nas entradas propostas pelo PPO</h1><p>Experimento concluído em 20/10/2026. Oito políticas arquivadas, 140 preenchimentos, 137 entradas únicas após deduplicação. Treino: 91; calibração: 11; avaliação: 34 resolvidas e uma censurada.</p><p>'''+html.escape(d['conclusion'])+'''</p><p>Rótulo hipotético de stop inicial de 1,5 ATR antes do alvo nominal de 2R, a partir de entradas preenchidas no replay. O PPO não executa esse alvo automaticamente: esse rótulo não representa a saída dinâmica, lucro líquido ou utilidade de um filtro. Sem prazo fixo; censura no fim da etapa.</p>
<div class="table"><table><tr><th>Variante</th><th>Brier</th><th>Log loss</th><th>Acurácia balanceada</th></tr>'''+rows+'''</table></div>
<p>Referência simples superou todos os modelos nesta amostra. A seleção reteve as 16 entradas; braços selecionados e completos são idênticos. Amostra abaixo dos pisos registrados, especialmente a calibração. Dados janeiro–junho/2025 já consumidos em pesquisas anteriores: não é novo teste independente.</p>
<h2>Comparação financeira adiada</h2><p>Passo 4 somente após conclusão das 1.000 gerações da V3, com outro protocolo e uma nova janela registrada antes do resultado. Mesma política com/sem filtro, carteira contínua, custos, CDI e blocos sem operações na média. Nada inicia automaticamente ou é promovido ao PPO.</p>
<p><a href="http://127.0.0.1:4173/pesquisa-genetica/risco-entradas.html">Painel local</a> · <a href="../../app/PEPE-RISCO-ENTRADAS.md">Método e considerações</a> · <a href="snapshot.json">Resultados completos</a> · <a href="registration.json">Registro congelado</a></p><img src="painel.jpg" alt="Painel concluído"><p>Pesos, previsões binárias, ledgers e candles permanecem locais. Sem ordens reais.</p></html>'''
(out/'index.html').write_text(body)
(out/'snapshot-manifest.json').write_text(json.dumps({'files':manifest,'modelsIncluded':False,'rawMarketDataIncluded':False,'financialComparisonStarted':False},indent=2)+'\n')
print(json.dumps({'snapshot':str(out.relative_to(repo)),'status':d['status']}))
