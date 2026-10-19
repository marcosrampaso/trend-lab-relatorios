import {predictTree} from './tree-ml.js';
import {scalpFeatures,scalpEntryFilter} from './scalp-tree.js';

const names={cross:'EMA9/21',vwap:'VWAP + volume',bands:'Bollinger + RSI'};
const featureNames=['Lado','RSI5min a favor','ATR/preço5min','Log volume relativo','VWAP/ATR a favor','EMA5min/ATR a favor','Alinhamento1h','Alinhamento4h','EMA1h/ATR a favor','EMA4h/ATR a favor','Custo/stop','Delta taker a favor'];
export function installScalpTreeUI({root,money,num,dt,download,onChange}){
  let models,results,preview,mode='observe',current,cachedKey,cachedFeatures;
  const panel=document.createElement('article');panel.className='panel prose scalp-trained';
  panel.innerHTML=`<span class="eyebrow">IA PARA SCALPING · TREINO SUPERVISIONADO LOCAL</span><h2>A árvore foi treinada.</h2>
    <p id="scalp-tree-data" role="status">Carregando modelos e avaliação temporal…</p>
    <label for="scalp-tree-mode">ÁRVORE NO REPLAY<select id="scalp-tree-mode"><option value="observe">Inspecionar · replay sem árvore</option><option value="fixed">Aplicar árvore fixa ·30min</option><option value="rolling">Aplicar retreino histórico mensal ·30min</option></select></label>
    <p id="scalp-tree-model-note"></p><p class="micro">Aplicar força prazo30min e substitui o filtro manual1h/4h pelo filtro aprendido. Os períodos maiores continuam como entradas do modelo. Alterar a seleção reinicia o replay.</p>
    <div class="context-cards"><article><span>EXEMPLOS DE TREINO</span><strong id="scalp-tree-train">—</strong><small id="scalp-tree-cutoff"></small></article><article><span>SCORE / LIMIAR</span><strong id="scalp-tree-score">—</strong><small id="scalp-tree-decision"></small></article></div>
    <p id="scalp-tree-signal"></p><ol id="scalp-tree-path"></ol>
    <p class="micro">Score de classe estimado no treino, sem calibração de probabilidade de lucro. Rótulos usam custos dobrados. O modelo aprende com ganhos e perdas e veta somente entradas; stops e saídas contrárias continuam ativos.</p>
    <details><summary>Ver a árvore e as12 entradas do último gatilho</summary><div id="scalp-tree-structure"></div><div class="table-scroll"><table><thead><tr><th>ENTRADA</th><th>VALOR</th></tr></thead><tbody id="scalp-tree-features"></tbody></table></div></details>
    <details><summary>Revelar avaliação posterior e checagem final · consulta resultados futuros do replay</summary>
      <h3>Controle, árvore fixa e retreino mensal</h3><p id="scalp-tree-verdict"></p>
      <div class="table-scroll"><table><thead><tr><th>CARTEIRA</th><th>MÉDIA/MÊS · BASE</th><th>MÉDIA/MÊS ·2×</th><th>MESES POSITIVOS ·2×</th><th>OPERAÇÕES ·2×</th></tr></thead><tbody id="scalp-tree-comparison"></tbody></table></div>
      <p id="scalp-tree-gate"></p><p id="scalp-tree-interval"></p>
      <label for="scalp-tree-test-month">MÊS DA AVALIAÇÃO<select id="scalp-tree-test-month"></select></label>
      <div class="table-scroll"><table><thead><tr><th>CARTEIRA</th><th>BASE</th><th>2×</th><th>OPERAÇÕES · BASE/2×</th></tr></thead><tbody id="scalp-tree-month"></tbody></table></div>
      <p class="micro">Cada mês começa comR$300. Médias mensais não são retorno composto. Meses conhecidos e avaliação retrospectiva; janeiro2025–junho2026 têm retreino anterior ao mês. Julho–setembro2026 usam o modelo de1julho congelado para a checagem final. Nenhuma promoção ao processo automático.</p>
      <button id="scalp-tree-download" class="button subtle">Exportar treino e resultados ↓</button>
    </details>`;
  root.querySelector('#scalp-content').firstElementChild.after(panel);
  const fullDate=t=>new Date(t).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
  const $=s=>root.querySelector(s),variantName=v=>v==='control'?'Sem árvore':v==='fixed'?'Árvore fixa':'Retreino mensal';
  $('#scalp-tree-mode').onchange=e=>{mode=e.target.value;cachedKey=null;try{localStorage.setItem('tl-scalp-tree-v1',mode);}catch{}onChange(mode!=='observe');};
  $('#scalp-tree-download').onclick=()=>download('trend-lab-arvore-scalping.json',JSON.stringify({models,results},null,2),'application/json');
  $('#scalp-tree-test-month').onchange=()=>current&&renderEvaluation(current.strategy);
  function bundleFor(family,period){
    const month=period==='april'?'2025-04':'2025-05';
    return models.models.find(m=>m.family===family&&m.month===(mode==='fixed'?'2025-01':month));
  }
  function mapFor(prepared,family,p){
    const key=family;
    if(cachedKey!==key){cachedKey=key;cachedFeatures=new Map(prepared.signals[family].map(s=>scalpFeatures(s.context,s.side,preview.frames,p)).filter(Boolean).map(s=>[s.at,s]));}
    return cachedFeatures;
  }
  function structure(node){
    if(!node.left)return '<p>Folha · '+node.count+' exemplos / '+node.positive+' positivos · score '+num(node.probability*100,1)+'%</p>';
    return '<details><summary>'+featureNames[node.feature]+' ≤ '+num(node.threshold,6)+' · '+node.count+' exemplos</summary><div class="tree-branch"><strong>Sim</strong>'+structure(node.left)+'<strong>Não</strong>'+structure(node.right)+'</div></details>';
  }
  function renderEvaluation(family){
    const cases=results.scenarios.filter(s=>s.family===family),checks=results.comparisons.filter(s=>s.family===family);
    const passed=checks.filter(s=>s.researchPassed).length;
    $('#scalp-tree-verdict').textContent=names[family]+' · '+passed+'/2 modelos passaram os critérios de pesquisa. Avaliação em21 meses posteriores ao treino inicial, incluindo3 meses finais reservados.';
    $('#scalp-tree-comparison').innerHTML=['control','fixed','rolling'].map(v=>{
      const b=cases.filter(s=>s.variant===v&&s.costCase==='base'),t=cases.filter(s=>s.variant===v&&s.costCase==='stress');
      const avg=a=>a.reduce((n,s)=>n+s.pnlUSDT,0)/a.length;
      return '<tr><td>'+variantName(v)+'</td><td>'+money(avg(b)*5)+'</td><td>'+money(avg(t)*5)+'</td><td>'+t.filter(s=>s.pnlUSDT>0).length+'/21</td><td>'+t.reduce((n,s)=>n+s.count,0)+'</td></tr>';
    }).join('');
    $('#scalp-tree-gate').textContent=checks.map(c=>variantName(c.variant)+': '+(c.researchPassed?'passou a triagem retrospectiva':c.reasons.join('; '))+'. Checagem final2×: '+money(c.holdoutStressPnLUSDT*5)).join(' ');
    $('#scalp-tree-interval').textContent=checks.map(c=>variantName(c.variant)+' · diferença média mensal2× contra controle '+money(c.interval.meanUSDT*5)+'; intervalo simultâneo ['+money(c.interval.lowerUSDT*5)+', '+money(c.interval.upperUSDT*5)+'].').join(' ')+' Bootstrap em blocos mensais; resultados exploratórios.';
    const month=$('#scalp-tree-test-month').value;
    $('#scalp-tree-month').innerHTML=['control','fixed','rolling'].map(v=>{
      const b=cases.find(s=>s.month===month&&s.variant===v&&s.costCase==='base'),t=cases.find(s=>s.month===month&&s.variant===v&&s.costCase==='stress');
      return '<tr><td>'+variantName(v)+'</td><td>'+money(b.pnlUSDT*5)+'</td><td>'+money(t.pnlUSDT*5)+'</td><td>'+b.count+' / '+t.count+'</td></tr>';
    }).join('');
  }
  return {
    get active(){return mode!=='observe';},
    selection(family,period){const b=bundleFor(family,period);return {mode,applied:mode!=='observe',modelId:b.id,threshold:b.threshold,availableAt:b.availableAt,informationCutoff:b.informationCutoff,protocol:models.protocol.version};},
    setData(m,r,v){models=m;results=r;preview=v;try{const saved=localStorage.getItem('tl-scalp-tree-v1');if(['observe','fixed','rolling'].includes(saved))mode=saved;}catch{}$('#scalp-tree-mode').value=mode;
      $('#scalp-tree-data').textContent=m.models.length+' árvores treinadas · '+Object.values(r.samples.counts).reduce((n,v)=>n+v,0).toLocaleString('pt-BR')+' exemplos rotulados em33 meses · '+r.data.minutes.toLocaleString('pt-BR')+' candles1min incluindo aquecimento. Treino concluído '+dt(Date.parse(m.trainedAt))+'.';
      for(const month of [...new Set(r.scenarios.map(s=>s.month))])$('#scalp-tree-test-month').add(new Option(month,month));
      $('#scalp-tree-test-month').value='2026-09';
    },
    entryFilter({prepared,family,period,start,protocol}){
      return mode==='observe'?null:scalpEntryFilter(bundleFor(family,period),mapFor(prepared,family,protocol),start);
    },
    render(state){
      if(!models)return;current=state;
      const {strategy,period,rawSignal,prepared,protocol}=state,bundle=bundleFor(strategy,period),features=mapFor(prepared,strategy,protocol);
      const row=rawSignal&&features.get(rawSignal.at),prediction=row&&predictTree(bundle.model,row.x);
      $('#scalp-tree-train').textContent=bundle.training.count;
      $('#scalp-tree-cutoff').textContent='Corte do treino '+fullDate(bundle.window.trainEnd)+' · escolha até '+fullDate(bundle.informationCutoff);
      $('#scalp-tree-model-note').textContent=(mode==='observe'?'Inspeção do retreino disponível no início do mês; o replay continua sem árvore. ':'Filtro de árvore aplicado ao replay; simulação30min. ')+(bundle.validationApproved?'Validação passou a triagem inicial.':'Validação não aprovou rentabilidade; apenas pesquisa.')+' Versão '+bundle.id+'.';
      $('#scalp-tree-score').textContent=prediction?num(prediction.probability*100,1)+'% / '+num(bundle.threshold*100,0)+'%':'Sem gatilho';
      $('#scalp-tree-decision').textContent=bundle.threshold===0?'Limiar0: validação manteve o controle sem veto':prediction?(prediction.probability>=bundle.threshold?'Árvore permite; demais limites continuam':'Árvore veta esta entrada'):'Aguardando gatilho';
      $('#scalp-tree-signal').textContent=rawSignal?'Último gatilho '+dt(rawSignal.at)+' · '+(rawSignal.side>0?'LONG':'SHORT')+(prediction?' · folha com '+prediction.leafCount+' exemplos e '+prediction.leafPositive+' positivos.':' · contexto ainda indisponível.'):'Nenhum gatilho até este relógio.';
      $('#scalp-tree-path').replaceChildren();for(const step of prediction?.path??[]){const li=document.createElement('li');li.textContent=featureNames[bundle.model.features.indexOf(step.feature)]+': '+num(step.value,6)+(step.left?' ≤ ':' > ')+num(step.threshold,6);$('#scalp-tree-path').append(li);}
      $('#scalp-tree-features').innerHTML=row?row.x.map((v,i)=>'<tr><td>'+featureNames[i]+'</td><td>'+num(v,5)+'</td></tr>').join(''):'';
      $('#scalp-tree-structure').innerHTML=structure(bundle.model.root);
      renderEvaluation(strategy);
    }
  };
}
