"""Read-only audit of completed entry study. No fitting, threshold search or PPO control."""
import collections
import hashlib
import html
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT=Path(__file__).resolve().parent.parent
BASE=ROOT/'work/pepe-quality-audit-v1'


def read(path):return json.loads(Path(path).read_text())
def sha(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def month(at):return datetime.fromtimestamp(at/1000,timezone.utc).strftime('%Y-%m')
def day(at):return datetime.fromtimestamp(at/1000,timezone.utc).strftime('%Y-%m-%d')


def key(row):return tuple(row[k]for k in ['entryAt','side','entry','initialStop','strategyTarget'])


def audit(cases,ledgers,features):
    indexed={pid:{key(t):t for t in trades}for pid,trades in ledgers.items()}
    output=[]
    for name in ['fit','calibration','evaluation']:
        all_rows=[r for r in cases if r['stage']==name]
        resolved=[r for r in all_rows if r['status']=='resolved']
        counter=collections.Counter();labels=collections.Counter();directions=collections.Counter();days=set();conflicts=0
        for case in resolved:
            versions=[indexed[pid][key(case)]for pid in case['policyIDs']]
            trade=versions[0]
            net=trade['net']
            actual=1 if net<0 else 0
            counter['negativeNet'if net<0 else'positiveNet'if net>0 else'zeroNet']+=1
            counter['referenceDisagreesWithNetSign']+=actual!=case['y']
            counter['labelMaturesAfterActualExit']+=case['labelAt']>trade['exitAt']
            conflicts+=len({t['net']<0 for t in versions})>1
            labels['stopFirst'if case['y']else'targetFirst']+=1
            directions['long'if case['side']==1 else'short']+=1
            days.add(day(case['decisionAt']))
        if sum(labels.values())!=len(resolved):raise ValueError('Label reconciliation')
        output.append({'stage':name,'total':len(all_rows),'resolved':len(resolved),'activeDays':len(days),
                       'labels':dict(labels),'directions':dict(directions),'outcomeDiagnostic':dict(counter),
                       'duplicatePoliciesWithDifferentNetSign':conflicts,
                       'months':dict(sorted(collections.Counter(month(r['decisionAt'])for r in all_rows).items()))})
    fitted=[r for r in cases if r['stage']=='fit'and r['status']=='resolved']
    variability=[]
    for i,name in enumerate(features):
        values=[r['x'][i]for r in fitted]
        variability.append({'feature':name,'uniqueTrainingValues':len(set(values)),
                            'min':min(values),'max':max(values),'constantInTraining':len(set(values))==1})
    return{'stages':output,'features':variability,'resolved':sum(s['resolved']for s in output),
           'referenceDisagreesWithNetSign':sum(s['outcomeDiagnostic'].get('referenceDisagreesWithNetSign',0)for s in output),
           'labelMaturesAfterActualExit':sum(s['outcomeDiagnostic'].get('labelMaturesAfterActualExit',0)for s in output)}


def main():
    if BASE.exists():raise ValueError('Preserve completed audit; use another ID for a new audit')
    source=ROOT/'work/pepe-entry-risk-v1'
    previous=read(source/'artifact-manifest.json')
    for path,digest in previous['files'].items():
        if sha(ROOT/path)!=digest:raise ValueError('Original study changed: '+path)
    protocol=read(ROOT/'pepe-entry-risk-protocol.json')
    cases=read(source/'entry-cases.json')
    replay_files=sorted(source.glob('replay-*.json'))
    ledgers={d['policy']['id']:d['baselineLedger']['trades']for d in map(read,replay_files)}
    result={'id':'pepe-quality-audit-v1','createdAt':datetime.now(timezone.utc).isoformat(),
            'status':'diagnosis_and_plan_complete','audit':audit(cases,ledgers,protocol['features']),
            'files':{str(p.relative_to(ROOT)):sha(p)for p in [source/'entry-cases.json',*replay_files,
                        ROOT/'pepe-entry-risk-protocol.json',ROOT/'scripts/audit-pepe-research-quality.py']},
            'trainingStarted':False,'newDataOpened':False,'oldEvaluationReusedForTuning':False,
            'ppoChanged':False,'financialComparisonStarted':False,
            'nextExperiment':{'status':'awaiting_dataset_and_preregistered_calendar',
                'qualityTarget':{'balancedAccuracy':0.60,'meaning':'Engineering research target, not a universal standard or profit guarantee.',
                    'additionalRequirements':['Confidence interval by calendar-day blocks above 0.50, with sufficient independent temporal coverage.',
                        'Both class recalls at least 0.50 at a threshold fixed before final evaluation.',
                        'Lower Brier and log loss than a training-frequency baseline on the same evaluation calendar.',
                        'At least three predeclared temporal blocks with class coverage; no dropping bad or inactive blocks.']},
                'proposedSampleFloors':{'fit':{'uniqueEntries':1000,'perClass':200},
                    'calibration':{'uniqueEntries':200,'perClass':50},
                    'thresholdSelection':{'uniqueEntries':200,'perClass':50},
                    'evaluation':{'uniqueEntries':300,'perClass':100,'activeCalendarDays':60}},
                'sampleNote':'Prospective design screening floors, not a statistical power calculation. More correlated policies do not create more independent market days.',
                'labelPolicy':'Keep stop-versus-2R as its own primary question. Net-loss classification is a separate hypothesis with policy version and actual exits frozen, never silently relabel the original experiment.',
                'dataPlan':'Use already inspected periods only for development. Select a policy cohort before opening a new evaluation calendar, deduplicate shared entries, preserve each policy continuous wallet and loss limits. Buy/sell and regime coverage must be reported; do not force trades to fill a quota.',
                'causalFeatureHypotheses':['BTC trend and volatility from closed bars, including relative PEPE/BTC movement.',
                    'PEPE volatility, volume and trend-strength regimes with cutoffs learned on fit only.',
                    'Spread/execution cost relative to initial stop distance using only estimates known before entry.'],
                'modelPlan':'Compare a regularized logistic baseline with shallow histogram boosting. One feature group at a time; limited candidate list registered before evaluation. Keep class weighting a separate ablation.',
                'selectorPlan':'In the next version explicitly detect zero L1 importance, retain protected data-quality fields and report the empty market subset; do not call 16 retained zero-weight features successful selection.',
                'thresholdPlan':'Fit -> later probability calibration -> separate later threshold selection -> locked evaluation. No random K-fold or threshold selection on the 34 observed cases.',
                'calendar':None,'calendarRequiredBeforeExecution':True,'automaticRetriesUntil60':False,
                'step4':'Financial with/without-filter comparison still deferred until V3 finishes 1000 generations, under a separate protocol. No classifier promotion on accuracy alone.'}}
    BASE.mkdir(parents=True)
    destination=BASE/'audit-and-plan.json'
    with destination.open('x')as f:json.dump(result,f,ensure_ascii=False,indent=2,allow_nan=False)
    destination.chmod(0o444)
    (ROOT/'web/data/pepe-quality-plan.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':'),allow_nan=False))
    a=result['audit'];esc=html.escape
    stage_names={'fit':'Treino','calibration':'Calibração','evaluation':'Avaliação'}
    rows=''.join('<tr>'+''.join('<td>'+esc(str(v))+'</td>'for v in [stage_names[s['stage']],s['resolved'],s['activeDays'],s['directions'].get('long',0),s['directions'].get('short',0),s['outcomeDiagnostic'].get('referenceDisagreesWithNetSign',0),s['labelMaturesAfterActualExit']if 'labelMaturesAfterActualExit'in s else s['outcomeDiagnostic'].get('labelMaturesAfterActualExit',0)])+'</tr>'for s in a['stages'])
    page='''<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Plano de qualidade de pesquisa · Trend Lab</title><link rel="stylesheet" href="experimento-noticias.css"><style>.quality-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.quality-cards article{border:1px solid #344b63;border-radius:14px;padding:20px;background:#152335}.quality-cards strong{display:block;font-size:28px;color:#8be0c4}.quality-cards span{font-size:14px;color:#b2c6d9}.quality-note{background:#242923;border:1px solid #6a6848;padding:22px;border-radius:14px}table{width:100%;border-collapse:collapse}td,th{padding:13px;border-bottom:1px solid #34485e;text-align:left}.quality-steps li{margin:18px 0;line-height:1.8}@media(max-width:700px){.quality-cards{grid-template-columns:1fr}}</style></head><body><main>
<header><div class="eyebrow">DIAGNÓSTICO CONCLUÍDO · PRÓXIMO TREINO AINDA NÃO INICIADO</div><h1>Buscar 60% com evidência.<br><span>Antes, melhorar o experimento.</span></h1><p class="lead">60% de acurácia balanceada é uma meta inicial de pesquisa proposta para a próxima rodada. Não é promessa, padrão universal ou aprovação para operar. Nenhum modelo novo foi ajustado neste diagnóstico.</p></header>
<div class="quality-cards"><article><span>Treino atual</span><strong>91 entradas</strong><span>31 dias com entradas; não são 91 dias independentes</span></article><article><span>Calibração atual</span><strong>11 entradas</strong><span>7 dias; seis alvos primeiro e cinco stops primeiro</span></article><article><span>Avaliação atual</span><strong>34 resolvidas</strong><span>15 dias; todas as entradas são compras</span></article></div>
<section><h2>O que o diagnóstico encontrou</h2><p>Há entradas em janeiro, março, abril, maio e junho/2025; fevereiro não teve entradas. A avaliação tem 32 entradas em maio e só três em junho, uma delas censurada. As políticas são correlacionadas; quantidade de agentes não substitui diversidade de calendário.</p><div class="table-wrap"><table><thead><tr><th>Etapa</th><th>Resolvidas</th><th>Dias com entradas</th><th>Compras</th><th>Vendas</th><th>Rótulo discorda do sinal líquido</th><th>Rótulo após saída efetiva</th></tr></thead><tbody>'''+rows+'''</tbody></table></div><p>Em '''+str(a['referenceDisagreesWithNetSign'])+''' de '''+str(a['resolved'])+''' casos resolvidos, o evento de stop/alvo e o sinal do resultado líquido efetivo do PPO discordam. Em '''+str(a['labelMaturesAfterActualExit'])+''' casos o evento só se resolve depois da saída do PPO. São perguntas diferentes, não uma correção silenciosa do teste original.</p><p>As três flags de disponibilidade são constantes nesta amostra de entradas válidas. Isso não é erro: continuam protegidas como qualidade de dados. O seletor L1 teve coeficientes zerados e reteve todos os campos pelo limiar médio zero; não houve redução de variáveis nesta rodada.</p></section>
<section><h2>Como avançar, em ordem</h2><ol class="quality-steps"><li><strong>Ampliar a amostra e a cobertura.</strong> Mais entradas únicas em vários meses, com direções e regimes identificados, sem reiniciar carteiras que pararam por perda nem forçar ordens. Períodos já vistos servem ao desenvolvimento; uma avaliação nova precisa de calendário registrado antes da abertura.</li><li><strong>Fixar a pergunta.</strong> Stop inicial versus alvo de 2R continua uma hipótese própria. Prever perda líquida nas saídas efetivas do PPO exige outro rótulo, com a versão da política congelada. Não trocar de rótulo e comparar os percentuais como se fossem a mesma tarefa.</li><li><strong>Testar informação adicional por grupo.</strong> Contexto de BTC, regime de volatilidade/volume do PEPE e custo estimado em relação à distância do stop. Somente candles fechados e informações disponíveis antes da decisão. Um grupo por vez, sem uma coleção de indicadores correlacionados escolhida no teste.</li><li><strong>Comparar modelos simples e limitar tentativas.</strong> Logística regularizada e boosting de árvores rasas. Seleção detectará explicitamente coeficientes zerados na próxima versão. Pesos de classe serão uma ablação separada; nenhum ajuste infinito até aparecer 60%.</li><li><strong>Separar quatro etapas no tempo.</strong> Treino/seleção interna → calibração posterior → escolha posterior do limiar → avaliação bloqueada. O limiar não será escolhido nos 34 casos já observados.</li></ol></section>
<section><h2>O que contará como atingir a meta</h2><ul class="quality-steps"><li>Acurácia balanceada de pelo menos 60% na avaliação bloqueada; intervalo por blocos de dias acima de 50%, com cobertura temporal suficiente.</li><li>Recall de pelo menos 50% nas duas classes, com o limiar já fixado antes de observar a avaliação.</li><li>Brier e log loss melhores que a frequência histórica do treino no mesmo calendário.</li><li>Três blocos temporais definidos antes dos resultados, com cobertura das classes. Nenhum bloco ruim ou sem operações será omitido. Sem eventos suficientes, declarar evidência insuficiente.</li></ul><p>Planejamento inicial de amostra: 1.000 entradas de treino, 200 de calibração, 200 de escolha de limiar e 300 de avaliação, com pelo menos 100 por classe e 60 dias com entradas na avaliação. São pisos de triagem propostos, não cálculo de poder estatístico nem garantia de suficiência. Dependência entre exemplos reduz a informação disponível.</p></section>
<section class="quality-note"><h2>Estado da próxima rodada</h2><p><strong>Aguardando ampliação da base e registro do calendário.</strong> Este diagnóstico não treinou candidatos, não abriu dados novos, não alterou a genética e não reutilizou a avaliação para escolher parâmetros. O protocolo executável completo será congelado antes de iniciar essa rodada.</p><p>A comparação financeira com e sem filtro permanece para depois das 1.000 gerações da V3, como combinado. Precisará de expectativa líquida após custos, CDI no mesmo calendário, trajetória contínua e todos os blocos, inclusive sem operações. Atingir 60% de classificação não aprova um filtro automaticamente.</p></section>
<section><h2>Fontes e evidência</h2><p><a href="../data/pepe-quality-plan.json" download>Diagnóstico e plano em JSON</a> · <a href="risco-entradas.html">Experimento original</a> · <a href="pepe-v3.html">Treino V3</a></p><p><a href="https://scikit-learn.org/stable/modules/classification_threshold.html">Escolha de limiar</a> · <a href="https://scikit-learn.org/stable/modules/calibration.html">Calibração</a> · <a href="https://scikit-learn.org/stable/modules/cross_validation.html#time-series-split">Validação temporal</a></p><p>Auditoria descritiva sobre dados já consumidos. Arquivos originais preservados por hashes. Sem ordens reais.</p></section></main></body></html>'''
    (ROOT/'web/pesquisa-genetica/qualidade-pesquisa.html').write_text(page)
    print(json.dumps({'status':result['status'],'resolved':a['resolved'],'labelDisagreements':a['referenceDisagreesWithNetSign'],'afterActualExit':a['labelMaturesAfterActualExit'],'trainingStarted':False}))


if __name__=='__main__':main()
