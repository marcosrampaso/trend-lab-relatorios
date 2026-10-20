"""Copy the completed retrospective classification evidence; never runs training."""
import argparse
import hashlib
import html
import json
import shutil
from pathlib import Path

p = argparse.ArgumentParser()
p.add_argument('--source', required=True)
a = p.parse_args()
src = Path(a.source).resolve()
repo = Path(__file__).resolve().parent.parent
out = repo / 'experiments/pepe-risk-selection-v1'
state = json.loads((src / 'web/data/pepe-risk-selection.json').read_text())
if state['status'] != 'complete':
    raise SystemExit('Only completed experiments may be archived here')
out.mkdir(parents=True, exist_ok=True)
files = {
    'registration.json': src / 'work/pepe-risk-selection-v1/registration.json',
    'result.json': src / 'work/pepe-risk-selection-v1/result.json',
    'artifact-manifest.json': src / 'work/pepe-risk-selection-v1/artifact-manifest.json',
    'snapshot.json': src / 'web/data/pepe-risk-selection.json',
    'experimento.jpg': src / 'output/risk-selection/experimento.jpg',
}
manifest = {}
for name, source in files.items():
    shutil.copyfile(source, out / name)
    manifest[name] = hashlib.sha256((out / name).read_bytes()).hexdigest()
rows = ''.join('<tr>' + ''.join('<td>' + html.escape(str(v)) + '</td>' for v in [
    r['id'], f"{r['brierMulticlass']:.6f}", f"{r['logLoss']:.6f}", f"{100*r['balancedAccuracy']:.1f}%"
]) + '</tr>' for r in state['aggregate'])
page = '''<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PEPE · seleção e calibração</title>
<style>body{background:#0d1420;color:#e4edf7;font:16px/1.7 system-ui;max-width:1100px;margin:40px auto;padding:20px}a{color:#8de2c7}table{border-collapse:collapse;width:100%}td,th{padding:12px;text-align:left;border-bottom:1px solid #34445a}img{max-width:100%}.table{overflow:auto}</style>
<h1>PEPE · seleção, classificação, calibração e avaliação</h1><p>Retrato concluído em 20/10/2026. 36 pipelines, 90 avaliações, três janelas e três sementes; 26.392 candidatas únicas avaliadas.</p>
<p>''' + html.escape(state['conclusion']) + '''</p>
<p>Naive Bayes e regressão logística, com 16 variáveis ou seleção L1 no treino; calibração sigmoid em bloco posterior com pipeline congelado. Avaliações: maio–julho/2024, outubro–dezembro/2024 e abril–junho/2025. Agosto/2024 excluído.</p>
<p>Rótulo: excursão adversa nos próximos 30 minutos, relativa a 1,5 ATR. Não é lucro líquido nem garantia de segurança. As janelas já foram pesquisadas; não são um teste final independente. Nenhum filtro PPO foi ativado.</p>
<div class="table"><table><tr><th>Variante</th><th>Brier</th><th>Log loss</th><th>Acurácia balanceada</th></tr>''' + rows + '''</table></div>
<p>A seleção ajudou o NB sem calibração; sigmoid ajudou o NB. Acrescentar seleção ao NB já calibrado não demonstrou melhora consistente. Logística com todas as entradas sem calibração teve menor log loss observado; a regra simples de volatilidade teve maior acurácia balanceada. Não houve promoção automática.</p>
<p><a href="http://127.0.0.1:4173/pesquisa-genetica/selecao-calibracao.html">Painel interativo local</a> · <a href="../../app/PEPE-SELECAO-CALIBRACAO.md">Método e limitações</a> · <a href="snapshot.json">Resultados completos</a> · <a href="registration.json">Registro</a> · <a href="artifact-manifest.json">Hashes dos modelos locais</a></p>
<img src="experimento.jpg" alt="Painel local concluído"><p>Pesos, previsões binárias, candles e banco privado permanecem na máquina. Sem ordens reais.</p></html>'''
(out / 'index.html').write_text(page)
(out / 'snapshot-manifest.json').write_text(json.dumps({'files': manifest, 'modelsIncluded': False, 'rawMarketDataIncluded': False, 'independentFinalTest': False}, indent=2) + '\n')
print(json.dumps({'snapshot': str(out.relative_to(repo)), 'status': state['status']}))
