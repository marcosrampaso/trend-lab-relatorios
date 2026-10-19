export function installProfitability({data,chartOptions,money,num,pct,dt,download,csv}){
  const $=s=>document.querySelector(s),fx=data.baseConfig.fx;
  const state={period:'test',risk:.01};
  const find=(risk=state.risk,cost='base',period=state.period)=>data.scenarios.find(s=>s.period===period&&s.risk===risk&&s.costCase===cost);
  const tone=(el,v)=>{el.classList.toggle('positive',v>0);el.classList.toggle('negative',v<0);};
  const L=window.LightweightCharts,chart=L.createChart($('#profit-chart'),chartOptions());
  const colors=['#5fd2b0','#f4b36a','#a395df'];
  const lines=data.protocol.risks.map((risk,i)=>chart.addSeries(L.LineSeries,{color:colors[i],lineWidth:2,priceLineVisible:false,lastValueVisible:true,title:String(risk*100)+'%'}));
  const cashLine=chart.addSeries(L.LineSeries,{color:'#6d7e91',lineWidth:1,lineStyle:2,priceLineVisible:false,lastValueVisible:false});
  const reference=chart.addSeries(L.LineSeries,{color:'#dce4ed',lineWidth:1,lineStyle:1,priceLineVisible:false,lastValueVisible:false});
  function render(){
    const s=find(),stress=find(state.risk,'stress');
    const usd=v=>money(v*fx);
    const signMoney=v=>(v>0?'+':'')+usd(v);
    const negative=s.pnlUSDT<0,empty=s.count===0;
    $('#profit-verdict').classList.toggle('loss',negative);$('#profit-verdict').classList.toggle('gain',s.pnlUSDT>0);
    $('#profit-verdict-icon').textContent=empty?'—':negative?'↘':'↗';
    $('#profit-verdict-title').textContent=empty?'Este cenário não executou operações.':negative?'O período terminou em prejuízo.':'Houve lucro neste recorte histórico.';
    $('#profit-verdict-copy').textContent=empty?'Os mínimos de negociação e o orçamento de risco limitaram as entradas. Saldo parado não demonstra rentabilidade.':`${usd(s.initialUSDT)} → ${usd(s.finalUSDT)} em ${s.count} operações. ${s.pnlUSDT>0?'O resultado positivo, isoladamente, não comprova uma vantagem futura.':'A rentabilidade da estratégia não foi demonstrada neste teste.'}`;
    $('#profit-net').textContent=signMoney(s.pnlUSDT);tone($('#profit-net'),s.pnlUSDT);$('#profit-net-note').textContent=pct(s.returnPct)+' · antes de impostos';
    $('#profit-final').textContent=usd(s.finalUSDT);$('#profit-dd').textContent=num(s.maxDrawdown*100)+'%';$('#profit-count').textContent=s.count;
    $('#profit-count-note').textContent=s.rejected+' entradas rejeitadas · '+s.signals+' sinais';
    for(const [id,value]of [['gross',s.beforeCostsUSDT],['fees',-s.feesUSDT],['slip',-s.slippageUSDT],['funding',s.fundingUSDT],['total',s.pnlUSDT]]){const el=$('#profit-'+id);el.textContent=signMoney(value);tone(el,value);}
    $('#profit-stress').textContent=pct(stress.returnPct)+' · '+usd(stress.finalUSDT)+' finais';tone($('#profit-stress'),stress.returnPct);
    $('#profit-halt').textContent=s.halted?'Limite global atingido em '+dt(s.haltAt)+'. O simulador ficou parado até o fim. A perda ultrapassou o limite planejado devido à execução.':'Limite global de perda: 10% sobre o capital inicial, não uma proteção de 10% sobre cada novo pico. Pausa diária: 3% no dia UTC.';
    data.protocol.risks.forEach((risk,i)=>{const r=find(risk);lines[i].setData(r.curve.map(p=>({time:p.time/1000,value:p.value*fx})));lines[i].applyOptions({lineWidth:risk===state.risk?3:1});});
    const curve=s.curve;cashLine.setData(curve.length?[{time:curve[0].time/1000,value:300},{time:curve.at(-1).time/1000,value:300}]:[]);
    reference.setData($('#profit-reference').checked?curve.map(p=>({time:p.time/1000,value:p.reference*fx})):[]);chart.timeScale().fitContent();
    $('#profit-scenarios').innerHTML=data.protocol.risks.map(risk=>`<tr class="${risk===state.risk?'scenario-selected':''}"><td>${num(risk*100,0)}% por operação</td>${data.protocol.periods.map(p=>{const r=find(risk,'base',p.id);return `<td class="${p.id===state.period?'selected-period ':''}${r.returnPct>0?'positive':r.returnPct<0?'negative':''}"><strong>${pct(r.returnPct)}</strong><small>${usd(r.finalUSDT)} · ${r.count} operações${r.halted?' · PAUSADO':''}</small></td>`;}).join('')}</tr>`).join('');
    $('#profit-months').innerHTML=s.monthly.map(m=>`<tr><td>${m.month}</td><td>${usd(m.startUSDT)}</td><td>${usd(m.finalUSDT)}</td><td class="${m.pnlUSDT>=0?'positive':'negative'}">${signMoney(m.pnlUSDT)}</td><td class="${m.returnPct>=0?'positive':'negative'}">${pct(m.returnPct)}</td><td>${m.trades}</td></tr>`).join('');
    $('#profit-win').textContent=s.winRate===null?'Sem operações':num(s.winRate*100)+'%';
    $('#profit-factor').textContent=s.count===0?'—':s.profitFactor===null?'Sem perdas na amostra':num(s.profitFactor);
    $('#profit-expectancy').textContent=s.expectancyUSDT===null?'—':usd(s.expectancyUSDT);tone($('#profit-expectancy'),s.expectancyUSDT??0);
    $('#profit-ci').textContent=s.expectancyInterval?usd(s.expectancyInterval.lower)+' a '+usd(s.expectancyInterval.upper):'Amostra insuficiente';
    $('#profit-rejected').textContent=s.rejected;$('#profit-liq').textContent=s.liquidations;
    $('#profit-confidence').textContent=s.count<30?`Amostra pequena: ${s.count} operações encerradas. Uma taxa de acerto ou média isolada não basta para concluir consistência.`:s.expectancyInterval?.lower>0?'A média histórica ficou positiva neste intervalo exploratório. Isso ainda exige validação prospectiva e não assegura lucro futuro.':'O intervalo da média histórica inclui zero ou perdas. A amostra não sustenta uma conclusão de ganho consistente.';
    $('#profit-trades').innerHTML=s.trades.length?[...s.trades].reverse().map(t=>`<tr><td>${dt(t.entryAt)}</td><td>${dt(t.exitAt)}</td><td class="${t.side===1?'positive':'negative'}">${t.side===1?'LONG':'SHORT'}</td><td>${num(t.qty,3)}</td><td>${t.reason}</td><td class="${t.net>=0?'positive':'negative'}">${signMoney(t.net)}</td></tr>`).join(''):'<tr class="empty"><td colspan="6">Nenhuma operação foi executada neste cenário.</td></tr>';
    $('#profit-provenance').textContent=`${num(data.data.candles,0)} candles · ${num(data.data.fundingEvents,0)} eventos de funding · ${data.data.files} arquivos mensais verificados. ${data.data.repairs?.reduce((sum,r)=>sum+r.missingHours,0)??0} mark prices recuperados pela API oficial. Protocolo ${data.protocolSHA256.slice(0,12)}… congelado em ${dt(Date.parse(data.freeze.frozenAt))}.`;
    $('#profit-limitations').replaceChildren(...data.limitations.map(text=>{const li=document.createElement('li');li.textContent=text;return li;}));
    window.trendProfitability={data,selected:s,state};
  }
  $('#profit-period').onchange=e=>{state.period=e.target.value;render();};$('#profit-risk').onchange=e=>{state.risk=Number(e.target.value);render();};$('#profit-reference').onchange=render;
  $('#export-profit-report').onclick=()=>download('trend-lab-rentabilidade.json',JSON.stringify(data,null,2),'application/json');
  $('#export-profit-trades').onclick=()=>{const s=find();download('trend-lab-rentabilidade-operacoes.csv',csv([['periodo','risco','entrada_utc','saida_utc','lado','quantidade_eth','entrada_usdt','saida_usdt','taxas_usdt','funding_usdt','slippage_usdt','liquido_usdt','motivo'],...s.trades.map(t=>[s.period,s.risk,new Date(t.entryAt).toISOString(),new Date(t.exitAt).toISOString(),t.side===1?'LONG':'SHORT',t.qty,t.entry,t.exit,t.entryFee+t.exitFee,t.funding,t.slippageCost,t.net,t.reason])]));};
  render();return {render,chart};
}
