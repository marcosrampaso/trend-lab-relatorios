import {contextAt} from './scalping-context.js';

export function installScalpContext({root, money, num, dt, download, onChange}) {
  let study, minutes=30, mode='observe', cachedPrepared, cachedFiltered, modelActive=false, beforeModel;
  const controls=document.createElement('article'); controls.className='panel prose';
  controls.innerHTML=`<span class="eyebrow">DURAÇÃO E CONTEXTO · EXPERIMENTO SEPARADO</span>
    <h2>5min para o gatilho. 1h e4h para o contexto.</h2>
    <p>Aumentar o prazo permite esperar mais; stops, alvos e sinais contrários ainda podem encerrar antes. Compare cada mudança com o controle original.</p>
    <div class="scalp-selects"><label for="scalp-hold">PRAZO MÁXIMO<select id="scalp-hold"><option value="30">30min · controle</option><option value="60">60min</option><option value="120">120min</option><option value="240">240min · intradiário</option></select></label>
    <label for="scalp-context-mode">TENDÊNCIA MAIOR<select id="scalp-context-mode"><option value="observe">Observar · manter os sinais</option><option value="align">Filtrar · 1h e4h a favor</option></select></label></div>
    <div class="context-cards"><article><span>CURTO · EMA9/21 ·5MIN</span><strong id="scalp-short-context">—</strong></article><article><span>INTERMEDIÁRIO · EMA20/50 ·1H</span><strong id="scalp-hour-context">—</strong><small id="scalp-hour-known"></small></article><article><span>AMPLO · EMA20/50 ·4H</span><strong id="scalp-four-context">—</strong><small id="scalp-four-known"></small></article></div>
    <p id="scalp-context-note" role="status"></p><p id="scalp-context-signal" class="small-copy"></p>
    <p class="micro">Contexto usa somente candles fechados até o sinal; 4h alinhado aUTC. EMA20/50 descreve direção, sem prever lucro. Na reversão, exigir alinhamento também é uma hipótese a testar.</p>`;
  root.querySelector('#scalp-content').prepend(controls);
  const panel=document.createElement('article'); panel.className='panel prose';
  panel.innerHTML=`<details><summary>Revelar estudo de duração e contexto · mostra resultados posteriores ao replay</summary>
    <h2>96 cenários, incluindo os que pioraram.</h2><p id="scalp-context-verdict"></p>
    <div class="table-scroll"><table><thead><tr><th>PRAZO / CONTEXTO</th><th>LÍQUIDO</th><th>CUSTOS2×</th><th>OPERAÇÕES · BASE/2×</th><th>QUEDA MÁX. · BASE</th><th>SAÍDAS POR TEMPO · BASE</th></tr></thead><tbody id="scalp-context-comparison"></tbody></table></div>
    <p id="scalp-context-detail" class="table-note"></p><p class="table-note">Dois meses já conhecidos. Carteiras param ao atingir o limite global; perdas próximas de−10% não provam equivalência. Cada mês reiniciaR$300. Custos2× recalculam a carteira e podem mudar o caminho das operações.</p>
    <button id="scalp-context-download" class="button subtle">Exportar96 cenários ↓</button>
    <h3>Como o bot deve aprender</h3><ol><li>Registrar todos os gatilhos, ganhos e perdas, custos e motivo de saída.</li><li>Ampliar o histórico1min para24 meses com diferentes regimes.</li><li>Treinar árvore rasa usando somente resultados já encerrados e disponíveis.</li><li>Validar em blocos temporais posteriores; comparar filtro fixo, retreino mensal e controle.</li><li>Rejeitar ajustes sem melhora líquida sob custos dobrados; depois observar prospectivamente.</li></ol>
    <p>Este estudo de duração não treinou modelos. A rodada posterior de treinamento está no painel “A árvore foi treinada”, acima, com dados ampliados e validação temporal. Aprender após cada perda pode ajustar ruído; cada candidato precisa superar o controle.</p>
    <p class="micro">Plano completo e critérios de pesquisa noJSON exportado. Limiares estatísticos não garantem lucro.</p></details>`;
  root.querySelector('#scalp-content').append(panel);
  const $=s=>root.querySelector(s), side=s=>s==null?'Aquecendo':s>0?'Alta':s<0?'Baixa':'Neutro';
  const changed=()=>{minutes=Number($('#scalp-hold').value);mode=$('#scalp-context-mode').value;cachedPrepared=null;cachedFiltered=null;
    try{localStorage.setItem('tl-scalp-context-v1',JSON.stringify({minutes,mode}));}catch{}onChange();};
  $('#scalp-hold').onchange=changed;$('#scalp-context-mode').onchange=changed;
  $('#scalp-context-download').onclick=()=>download('trend-lab-scalping-contexto.json',JSON.stringify(study,null,2),'application/json');
  return {
    get minutes(){return minutes;}, get mode(){return mode;},
    setStudy(value){study=value;
      try{const saved=JSON.parse(localStorage.getItem('tl-scalp-context-v1'));if(study.protocol.maxHoldMinutes.includes(saved?.minutes)&&study.protocol.contextModes.includes(saved?.mode)){minutes=saved.minutes;mode=saved.mode;}}catch{}
      $('#scalp-hold').value=minutes;$('#scalp-context-mode').value=mode;
    },
    setModelActive(active){if(active&&!modelActive){beforeModel={minutes,mode};minutes=30;mode='observe';}else if(!active&&modelActive){({minutes,mode}=beforeModel); }modelActive=active;$('#scalp-hold').value=minutes;$('#scalp-context-mode').value=mode;$('#scalp-hold').disabled=active;$('#scalp-context-mode').disabled=active;},
    get frames(){return study?.frames;},
    render({cursor,bar,rawSignal,period,strategy,costCase}){
      if(!study)return;
      const current=contextAt(study.frames,cursor,bar?.side), signal=rawSignal&&contextAt(study.frames,rawSignal.at,rawSignal.side);
      $('#scalp-short-context').textContent=side(bar?.side);
      $('#scalp-hour-context').textContent=side(current.hourly?.side);$('#scalp-four-context').textContent=side(current.fourHourly?.side);
      $('#scalp-hour-known').textContent=current.hourly?'Fechou '+dt(current.hourly.at):'Sem candle disponível';
      $('#scalp-four-known').textContent=current.fourHourly?'Fechou '+dt(current.fourHourly.at):'Sem candle disponível';
      $('#scalp-context-note').textContent=(mode==='observe'?'Somente observação. ':'Filtro experimental ativo. ')+(current.ready?(current.hourly.side===current.fourHourly.side?'1h e4h apontam na mesma direção.':'1h e4h em conflito.'):'Contexto em aquecimento.');
      $('#scalp-context-signal').textContent=rawSignal?'Último gatilho original: '+dt(rawSignal.at)+' · '+(rawSignal.side>0?'LONG':'SHORT')+' · '+signal.reason+(mode==='observe'?' · não vetado pelo contexto.':signal.allowed?' · contexto permite; demais limites continuam.':' · vetado pelo contexto.'):'Nenhum gatilho original disponível até este relógio.';
      const cases=study.scenarios.filter(s=>s.period===period&&s.strategy===strategy);
      const positives=study.scenarios.filter(s=>s.pnlUSDT>0).length;
      $('#scalp-context-verdict').textContent=positives+' de96 cenários terminaram positivos. Exibindo a família e o mês selecionados; nenhum candidato promovido. Estudo exploratório, sem teste futuro intocado.';
      $('#scalp-context-comparison').innerHTML=study.protocol.maxHoldMinutes.flatMap(m=>study.protocol.contextModes.map(c=>{
        const b=cases.find(s=>s.maxHoldMinutes===m&&s.mode===c&&s.costCase==='base'),t=cases.find(s=>s.maxHoldMinutes===m&&s.mode===c&&s.costCase==='stress');
        const selected=m===minutes&&c===mode, timeout=b.exits['Limite de '+m+'min']?.count??0;
        return '<tr'+(selected?' class="selected"':'')+'><td>'+(selected?'● ':'')+m+'min · '+(c==='observe'?'sem filtro':'1h+4h')+'</td><td class="'+(b.pnlUSDT>=0?'positive':'negative')+'">'+money(b.pnlUSDT*5)+'</td><td class="'+(t.pnlUSDT>=0?'positive':'negative')+'">'+money(t.pnlUSDT*5)+'</td><td>'+b.count+' / '+t.count+'</td><td>'+num(b.maxDD*100,1)+'%</td><td>'+timeout+'/'+b.count+'</td></tr>';
      })).join('');
      const s=cases.find(s=>s.maxHoldMinutes===minutes&&s.mode===mode&&s.costCase===costCase);
      $('#scalp-context-detail').textContent='Seleção · '+(costCase==='base'?'custos base':'custos dobrados')+' · bruto após slippage '+money(s.grossUSDT*5)+' − taxas '+money(s.feesUSDT*5)+' + funding '+money(s.fundingUSDT*5)+' = '+money(s.pnlUSDT*5)+'. Expectativa/operação '+(s.expectancyUSDT==null?'sem operações':money(s.expectancyUSDT*5))+'. Sinais vetados '+s.contextVetoes+'/'+s.rawSignals+'. '+(s.halted?'Parou no limite global em '+dt(s.haltAt)+'.':'Não atingiu a parada global.')+' Motivos: '+Object.entries(s.exits).map(([k,v])=>k+': '+v.count).join(' · ')+'.';
    }
  };
}
