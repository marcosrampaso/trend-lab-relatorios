"""Bounded, validation-only sensitivity audit. Never promotes or retrains a model."""
import copy
import hashlib
import html
import importlib.util
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(file):
    return json.loads(Path(file).read_text())


def write(file, value):
    Path(file).parent.mkdir(parents=True, exist_ok=True)
    Path(file).write_text(json.dumps(value))


def main():
    import os
    os.chdir(ROOT)
    spec = importlib.util.spec_from_file_location('helpers', ROOT / 'scripts/adaptive-genetic.py')
    helpers = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(helpers)
    campaign = read('web/data/adaptive-evolution-status.json')
    run = Path('work/local-ml/runs') / campaign['runId']
    registration = read(run / 'registration.json')
    for file, expected in registration['fingerprint'].items():
        if file in ['baseRegistration', 'previousWinner']:
            continue  # Provenance metadata, not current source paths.
        if hashlib.sha256(Path(file).read_bytes()).hexdigest() != expected:
            raise ValueError('Fonte registrada alterada: ' + file)
    report = read(run / 'report.json')
    winner = report['winner']
    genome = winner['genome']
    cache = read(run / 'model-cache.json')
    audit_id = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    folder = run / 'diagnostics' / audit_id
    prediction_files = {}
    sources = {}
    for arm in genome['routes'].values():
        if not arm['family']:
            continue
        arm_id = arm['family'] + '/' + str(arm['hold'])
        if arm_id in prediction_files:
            continue
        files = cache[helpers.model_key(genome, arm['family'], arm['hold'])]
        sanitized = []
        for file in files:
            row = read(file)
            sources[file] = hashlib.sha256(Path(file).read_bytes()).hexdigest()
            # The scorer can only see validation predictions in this audit.
            row['test'] = []
            target = folder / 'predictions' / Path(file).name
            write(target, row)
            sanitized.append(str(target.resolve()))
        prediction_files[arm_id] = sanitized

    candidates = [copy.deepcopy(genome)]
    labels = {genome['id']: 'Reprodução do campeão'}
    seen = {genome['id']}

    def add(label, change):
        child = copy.deepcopy(genome)
        change(child)
        child = helpers.identify(child)
        if child['id'] not in seen:
            seen.add(child['id'])
            candidates.append(child)
            labels[child['id']] = label

    for regime in ['trend', 'range', 'volatile']:
        threshold = genome['routes'][regime]['threshold']
        for delta in [-.10, -.05, -.02, -.005, .005, .02, .05, .10]:
            value = round(min(.95, max(.05, threshold + delta)), 6)
            add(f'{regime}: limiar {value}', lambda g, r=regime, v=value: g['routes'][r].update(threshold=v))
        add(f'{regime}: sem filtro de IA', lambda g, r=regime: g['routes'][r].update(threshold=0))
        add(f'{regime}: não abrir operações', lambda g, r=regime: g['routes'][r].update(family=None))
    for delta in [-.6, -.3, -.1, .1, .3, .6]:
        value = round(max(.2, genome['trendCut'] + delta), 6)
        add(f'Corte de tendência {value}', lambda g, v=value: g.update(trendCut=v))
    for ratio in [.8, .9, 1.1, 1.2]:
        value = round(genome['volatilityCut'] * ratio, 8)
        add(f'Corte de volatilidade {value}', lambda g, v=value: g.update(volatilityCut=v))

    output = folder / 'scores.json'
    request = folder / 'request.json'
    write(request, {'generation': report['generation'], 'genomes': [dict(g, predictionFiles=prediction_files) for g in candidates], 'output': str(output)})
    subprocess.run(['node', 'scripts/score-adaptive-genetic.mjs', str(run.resolve()), str(request.resolve())], check=True)
    rows = read(output)['candidates']
    baseline = next(r for r in rows if r['genome']['id'] == genome['id'])
    if baseline['eligible'] != winner['eligible'] or abs(baseline['fitnessUSDT'] - winner['fitnessUSDT']) > 1e-9:
        raise ValueError('Campeão não reproduzido; diagnóstico inválido')
    better = [r for r in rows if r['eligible'] and r['fitnessUSDT'] > baseline['fitnessUSDT'] + 1e-9]
    for row in rows:
        row['change'] = labels[row['genome']['id']]
    result = {'generatedAt': datetime.now(timezone.utc).isoformat(), 'runId': campaign['runId'], 'snapshotGeneration': report['generation'], 'championId': genome['id'], 'trialCount': len(rows), 'betterCount': len(better), 'usedFinalTest': False, 'promoted': False, 'retrained': False, 'sources': sources, 'rows': rows, 'caveat': 'Sensibilidade em validação já usada na busca. Mais tentativas aumentam o risco de sobreajuste; nenhum resultado comprova retorno futuro.'}
    write(folder / 'audit.json', result)
    write('web/data/plateau-audit.json', result)
    ordered = sorted(rows, key=lambda r: (r['eligible'], r['fitnessUSDT'] if r['eligible'] else r['diagnosticMeanUSDT']), reverse=True)
    table = ''.join(f"<tr><td>{html.escape(r['change'])}</td><td>{'Sim' if r['eligible'] else 'Não'}</td><td>R$ {5 * (r['fitnessUSDT'] if r['eligible'] else r['diagnosticMeanUSDT']):.2f}</td><td>{r['totalTrades']}</td><td>{100*r['maxDD']:.2f}%</td></tr>" for r in ordered)
    page = f'''<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Diagnóstico do platô · Trend Lab</title><style>body{{background:#101827;color:#e9eef7;font:16px system-ui;max-width:1000px;margin:32px auto;padding:0 20px;line-height:1.6}}a{{color:#76c5ff}}h1{{line-height:1.2}}.scroll{{overflow:auto}}table{{border-collapse:collapse;width:100%}}td,th{{padding:10px;border-bottom:1px solid #334155;text-align:left;white-space:nowrap}}small{{color:#b8c7dc}}</style><a href="./index.html">← Evolução</a><h1>O que está limitando o campeão?</h1><p>Auditoria da geração {report['generation']}: <b>{len(rows)} avaliações controladas</b>, incluindo a reprodução exata do campeão. <b>{len(better)} alternativas elegíveis superaram seu resultado.</b></p><p>Foram variados um limite de entrada ou um corte de regime por vez, além de controles sem filtro de IA e sem operações em cada regime. Modelo, risco de 1%, capital de R$ 1.000, custos e janelas permaneceram iguais. Não houve novo treinamento nem alteração do bot em execução.</p><p>O resultado é a média mensal do pior cenário agregado entre custos base e dobrados, nos mesmos nove meses de validação. Cada mês reinicia o capital para esta métrica; ela não representa rendimento composto. Linhas inelegíveis mostram apenas a média diagnóstica, sem aprovação pelos critérios originais.</p><p><b>Limite:</b> esta validação já foi consultada milhares de vezes. Encontrar um número maior aqui pode ser sobreajuste. O teste final não foi usado, e nenhuma alternativa foi promovida.</p><div class="scroll"><table><thead><tr><th>Alteração isolada</th><th>Elegível</th><th>Média mensal</th><th>Operações mín.</th><th>Queda máxima</th></tr></thead><tbody>{table}</tbody></table></div><p><small>Gerado em {result['generatedAt']} · campeão {genome['id']} · simulação histórica, sem ordens reais.</small></p></html>'''
    Path('web/evolucao/diagnostico.html').write_text(page)
    print(json.dumps({'trials': len(rows), 'better': len(better), 'baselineMonthlyBRL': baseline['fitnessUSDT'] * 5, 'top': [{'change': r['change'], 'monthlyBRL': r['fitnessUSDT'] * 5, 'trades': r['totalTrades']} for r in ordered[:5]], 'audit': str(folder / 'audit.json')}))


if __name__ == '__main__':
    main()
