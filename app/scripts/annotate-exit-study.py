"""Presentation-only audit notes and precise tree rules; no scoring or promotion."""
import json,sys,hashlib,html
from pathlib import Path
import joblib
from sklearn.tree import export_text
run=Path(sys.argv[1]);raw=json.loads((run/'results.json').read_text());inputs=json.loads((run/'inputs.json').read_text());data=json.loads(Path('web/pesquisa-genetica/saidas-dados.json').read_text());page=Path('web/pesquisa-genetica/saidas.html');text=page.read_text()
for model in data['models']:
    name=model['arm'].replace('/','-')+'-'+model['fold']+'-f'+str(model['features'])+'.joblib';file=run/'models'/name
    if hashlib.sha256(file.read_bytes()).hexdigest()!=model['artifactSHA256']:raise ValueError('Modelo alterado')
    precise=export_text(joblib.load(file),feature_names=inputs['featureNames'][:model['features']],decimals=6)
    if model['features']==30:text=text.replace(html.escape(model['rules'],quote=True).replace('&#x27;','&#39;'),html.escape(precise,quote=True).replace('&#x27;','&#39;'))
    model.setdefault('originalRuleDisplay',model['rules']);model['rules']=precise
trail=next(r for r in data['results'] if r['id']=='trailing');invalidated=sum(m['stress']['exitReasons'].get('Contexto5min invalidado',0) for m in trail['months']);count=sum(m['stress']['count'] for m in trail['months'])
comment=f'<section class="sheet"><h2>O que explica a piora das variantes?</h2><p>Na variante com trailing, {invalidated} de {count} operações terminaram por invalidação da EMA em5min. O campeão usa principalmente reversão Bollinger: uma direção curta contrária à posição pode existir justamente na entrada. Essa regra de saída pode cortar a tentativa de reversão cedo demais.</p><p>É uma interpretação do histórico, não uma causa isolada comprovada. As variantes combinaram trailing, invalidação e mudança do alvo; estes números não demonstram que trailing sozinho piora o bot. Um próximo ensaio deve separar esses componentes antes de ajustar parâmetros.</p><p>As árvores de30entradas usaram os mesmos limiares do campeão, sem recalibração na validação. Um resultado pior nesta ablação não demonstra que os novos indicadores são inúteis. Mais entradas podem mudar os cortes de uma árvore rasa e exigir outra etapa de seleção, com orçamento de tentativas e dados posteriores definidos antes.</p></section>'
needle='<section class="sheet"><h2>De12 para30 entradas';assert needle in text
if '<h2>O que explica a piora das variantes?</h2>' not in text:text=text.replace(needle,comment+needle,1)
if 'Cortes exibidos com seis casas decimais.' not in text:text=text.replace('<h2>Regras aprendidas pelas árvores de30 entradas</h2>','<h2>Regras aprendidas pelas árvores de30 entradas</h2><p class="note">Cortes exibidos com seis casas decimais. A classe mostrada na folha usa o corte de classificação0,5; as entradas do bot usam o score e os limiares registrados do campeão, que podem ser menores. Classe0 na folha não significa veto automático.</p>',1)
if 'Elegível indica apenas cobertura' not in text:text=text.replace('Mês reinicia R$1.000.','Elegível indica apenas cobertura de amostra e limites de queda; resultado negativo não é aprovação para operar. Mês reinicia R$1.000.',1)
if 'id="comparacao"' not in text:
    labels={'champion':'Referência','no-clock':'Sem relógio','trailing':'Trailing + EMA','adaptive-target':'Alvo adaptativo + EMA','features30':'30 entradas'}
    cards=''
    for result in data['results']:
        value=result['monthlyBRL'];display=('−' if value<0 else '')+'R$ '+f'{abs(value):.2f}'.replace('.',',')
        cards+=f'<article><span>{labels[result["id"]]}</span><strong style="color:var({"--red" if value<0 else "--accent"})">{display}</strong><small>Por mês · pior custo agregado</small></article>'
    cards='<section id="comparacao"><h2>Comparação das cinco variantes</h2><div class="metrics">'+cards+'</div><p class="note">Mesmas nove janelas, capital mensal reiniciado em R$1.000. Comparação exploratória; sem promoção automática.</p></section>'
    text=text.replace('<section class="sheet"><h2>Por que testar o relógio?',cards+'<section class="sheet"><h2>Por que testar o relógio?',1)
    text=text.replace('<aside class="verdict compact">','<p><a class="text-link" href="#comparacao">Ir à comparação ↓</a></p><aside class="verdict compact">',1)
data['presentationSources']={str(Path(__file__).relative_to(Path.cwd())):hashlib.sha256(Path(__file__).read_bytes()).hexdigest()};data['interpretation']={'trailingContextExitCount':invalidated,'trailingTradeCount':count,'componentsIsolated':False,'note':'Anotação posterior aos resultados. Sem nova hipótese testada, sem alterar PnL, seleção ou a campanha.'}
page.write_text(text);Path('web/pesquisa-genetica/saidas-dados.json').write_text(json.dumps(data,ensure_ascii=False));print(json.dumps({'annotated':True,'contextExits':invalidated,'trades':count,'rawResultsPreserved':True}))
