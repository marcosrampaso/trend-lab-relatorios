import {HOUR,DEFAULTS,indicators,snapshot,makeProbe,evaluateProbe,simulate} from './engine.js';
import {intradayBars} from './strategies.js';
import {nextReplayTime,replayActivity,replayStatus} from './replay.js';
import {contextIndicators,createContextFilter} from './decision-context.js';
import {installScalping} from './scalping-ui.js';
import {installDonchian} from './donchian-ui.js';
import {installStrategiesML} from './tree-ui.js';
import {installContextUI} from './context-ui.js';
import {installProfitability} from './profitability.js';
import {installLab} from './lab.js';
import {installImprovements} from './improvements.js';
import {installRangeVwap} from './range-vwap-ui.js';

const $=s=>document.querySelector(s),all=s=>[...document.querySelectorAll(s)];
const dateFmt=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
const shortFmt=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'short'});
const num=(n,d=2)=>Number(n).toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d});
const money=n=>Number(n).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const pct=n=>(n>0?'+':'')+num(n*100)+'%';
const dt=t=>dateFmt.format(new Date(t));
const storage={get(k,f){try{return JSON.parse(localStorage.getItem(k))??f;}catch{return f;}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch{toast('Armazenamento indisponível. Exporte as leituras antes de fechar.');}}};
const savedConfig=storage.get('tl-config-v1',{});
let config={...DEFAULTS,...savedConfig};if(!(config.fx>0&&config.capitalBRL>0&&config.leverage<=10&&config.leverage>=1))config={...DEFAULTS};
let data,liveData=null,view='replay',phase='april',cursor=Date.parse('2025-04-10T15:00:00Z'),report,chart,candlesSeries,fastSeries,slowSeries,equityChart,equitySeries,markers,volumeSeries;
let probes=storage.get('tl-probes-v1',[]);if(!Array.isArray(probes))probes=[];
let playTimer=null,liveTimer=null,toastTimer=null,fetching=false;
let profitLab=null,improvementLab=null,scalpingLab=null,donchianLab=null,mlLab=null;
let dayLab=null,replayStrategy='baseline',replayTrendRule=null,replaySpeed=1,playbackPauseReason='',replayContextMode='observe',contextLab=null,replayContexts=[],replayContextProtocol=null;
const contextFilters=new Map();
function contextFilter(mode=replayContextMode){if(!contextFilters.has(mode))contextFilters.set(mode,createContextFilter(replayContexts,mode,replayContextProtocol));return contextFilters.get(mode);}
function replayOptions(){return replayStrategy==='baseline'?{}:{strategy:replayTrendRule.id,maxHoldHours:replayTrendRule.maxHoldHours,stopATR:replayTrendRule.stopATR,targetR:replayTrendRule.targetR,cooldownHours:replayTrendRule.cooldownHours,entryFilter:replayContextMode==='observe'?null:({signal})=>contextFilter().veto(signal)};}
function simulateReplay(until){return simulate(data,{until,start:periods[phase].start,config,...replayOptions()});}
const periods={april:{start:Date.UTC(2025,3,1),end:Date.UTC(2025,4,1),name:'ABRIL',phase:'VALIDAÇÃO'},may:{start:Date.UTC(2025,4,1),end:Date.UTC(2025,5,1),name:'MAIO',phase:'TESTE POSTERIOR'}};
const savedReplay=storage.get('tl-replay-v1',null);
if(savedReplay&&typeof savedReplay==='object'){
  if(Object.hasOwn(periods,savedReplay.phase))phase=savedReplay.phase;
  if(['baseline','trend1h'].includes(savedReplay.strategy))replayStrategy=savedReplay.strategy;
  const p=periods[phase];if(Number.isFinite(savedReplay.cursor)&&savedReplay.cursor>=p.start+HOUR&&savedReplay.cursor<=p.end)cursor=Math.floor(savedReplay.cursor/HOUR)*HOUR;
  if([1,6,24].includes(savedReplay.speed))replaySpeed=savedReplay.speed;
  if(['observe','volume','rsi','combined'].includes(savedReplay.contextMode))replayContextMode=savedReplay.contextMode;
}
function toast(text){$('#toast').textContent=text;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),4500);}
function tone(el,value){el.classList.toggle('positive',value>0);el.classList.toggle('negative',value<0);}
function inputTime(t){const p=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(t));return p.replace(' ','T');}
function tickLabel(time,type){const date=new Date(Number(time)*1000);if(type===0)return String(date.getUTCFullYear());return new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',...(type>=3?{hour:'2-digit',minute:'2-digit'}:type===1?{month:'short'}:{day:'2-digit',month:'2-digit'})}).format(date);}
function chartOptions(){return {autoSize:true,layout:{background:{color:'#101720'},textColor:'#7f90a4',fontSize:10,fontFamily:'IBM Plex Mono, monospace',attributionLogo:true},grid:{vertLines:{color:'#1b253133'},horzLines:{color:'#1b253188'}},crosshair:{mode:0,vertLine:{color:'#5d6b7e',labelBackgroundColor:'#344256'},horzLine:{color:'#5d6b7e',labelBackgroundColor:'#344256'}},rightPriceScale:{borderColor:'#25303e'},timeScale:{borderColor:'#25303e',timeVisible:true,secondsVisible:false,rightOffset:5,tickMarkFormatter:tickLabel},localization:{locale:'pt-BR',timeFormatter:t=>dt(Number(t)*1000)},handleScroll:true,handleScale:true};}
function setupCharts(){
  const L=window.LightweightCharts;if(!L)throw Error('Não foi possível carregar a biblioteca de gráficos.');
  chart=L.createChart($('#chart'),chartOptions());
  candlesSeries=chart.addSeries(L.CandlestickSeries,{upColor:'#5fd2b0',downColor:'#db7d86',borderVisible:false,wickUpColor:'#5fd2b0',wickDownColor:'#db7d86',priceLineVisible:false});
  fastSeries=chart.addSeries(L.LineSeries,{color:'#5fd2b0',lineWidth:1,priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false});
  slowSeries=chart.addSeries(L.LineSeries,{color:'#a395df',lineWidth:1,priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false});
  volumeSeries=chart.addSeries(L.HistogramSeries,{priceScaleId:'volume',priceFormat:{type:'volume'},priceLineVisible:false,lastValueVisible:false,color:'#5fd2b033'});chart.priceScale('volume').applyOptions({scaleMargins:{top:.82,bottom:0},visible:false});chart.priceScale('right').applyOptions({scaleMargins:{top:.08,bottom:.24}});
  markers=L.createSeriesMarkers(candlesSeries,[]);
  equityChart=L.createChart($('#equity-chart'),{...chartOptions(),handleScroll:false,handleScale:false,rightPriceScale:{borderVisible:false},timeScale:{visible:true,borderVisible:false},crosshair:{vertLine:{visible:false},horzLine:{visible:false}},grid:{vertLines:{visible:false},horzLines:{color:'#1b253155'}}});
  equitySeries=equityChart.addSeries(L.AreaSeries,{lineColor:'#5fd2b0',topColor:'#5fd2b022',bottomColor:'#5fd2b000',lineWidth:2,priceLineVisible:false,lastValueVisible:true});
}
function drawMarket(rows,until,sim){
  const s=snapshot(rows,until,config),bars=s.visible.slice(-260),intraday=view==='replay'&&replayStrategy==='trend1h',ind=intraday?intradayBars(s.visible,until,'trend1h'):indicators(s.visible,until,config);if(intraday)s.indicator=ind.at(-1);let j=0;
  $('#market-resolution').textContent='Binance Futures · Candles 1h · Tendência '+(intraday?'1h':'4h');
  $('#legend-fast').textContent=intraday?'EMA 9 · 1h':'EMA 16 · 4h';$('#legend-slow').textContent=intraday?'EMA 21 · 1h':'EMA 64 · 4h';$('#fast-label').textContent='EMA rápida · '+(intraday?'9':'16');$('#slow-label').textContent='EMA lenta · '+(intraday?'21':'64');$('#atr-label').textContent='ATR · 14 / '+(intraday?'1h':'4h');$('#signal-label').textContent='Último candle '+(intraday?'1h':'4h')+' fechado';
  const fast=[],slow=[];
  for(const b of bars){const at=b[0]+HOUR;while(j+1<ind.length&&ind[j+1].at<=at)j++;if(ind[j]?.ready&&ind[j].at<=at){fast.push({time:at/1000,value:ind[j].fast});slow.push({time:at/1000,value:ind[j].slow});}}
  candlesSeries.setData(bars.map(r=>({time:(r[0]+HOUR)/1000,open:r[1],high:r[2],low:r[3],close:r[4]})));
  volumeSeries.setData(bars.map(r=>({time:(r[0]+HOUR)/1000,value:r[5],color:r[4]>=r[1]?'#5fd2b040':'#db7d8640'})));
  fastSeries.setData(fast);slowSeries.setData(slow);
  const first=bars[0]?.[0]??0,last=bars.at(-1)?.[0]??0;
  markers.setMarkers((sim?.events??[]).filter(e=>['entry','exit'].includes(e.kind)&&e.at>=first&&e.at<=last+HOUR).map(e=>({time:((Math.floor(e.at/HOUR)*HOUR)+(e.kind==='entry'?HOUR:0))/1000,position:e.kind==='entry'?(e.side===1?'belowBar':'aboveBar'):(e.side===1?'aboveBar':'belowBar'),color:e.kind==='entry'?'#f4b36a':'#a0afc1',shape:e.kind==='entry'?(e.side===1?'arrowUp':'arrowDown'):'circle',text:e.kind==='entry'?'Entrada':'Saída'})).sort((a,b)=>a.time-b.time));
  chart.timeScale().fitContent();
  $('#price').textContent=s.last==null?'—':num(s.last);
  const previous=s.visible.at(-2)?.[4]??s.last,change=s.last/previous-1;$('#price-change').textContent=pct(change)+' · último candle 1h';tone($('#price-change'),change);
  $('#snapshot-time').textContent=dt(until);$('#visible-count').textContent=s.visible.length+' candles disponíveis · '+bars.length+' na tela';$('#chart-cutoff').textContent='Fechamentos até '+dt(until);
  const i=s.indicator;$('#fast').textContent=i?num(i.fast):'—';$('#slow').textContent=i?num(i.slow):'—';$('#atr').textContent=i?.atr?num(i.atr):'—';$('#signal-time').textContent=i?dt(i.at):'—';
  $('#regime').textContent=i?.ready?(i.side===1?'Tendência de alta':i.side===-1?'Tendência de baixa':'Sem direção'):'Preparando indicadores';$('#regime-icon').textContent=i?.side===1?'↗':'↘';tone($('#regime-icon'),i?.side??0);
  $('#position').textContent=view==='live'?'Sem execução':sim?.position?(sim.position.side===1?'Comprada':'Vendida'):'Fora do mercado';$('#record').disabled=!i?.ready;
}
function renderMetrics(r){
  const fx=config.fx;$('#equity').textContent=money(r.final*fx);$('#equity-note').textContent='Inicial '+money(config.capitalBRL)+' · câmbio hipotético '+num(fx);
  $('#pnl').textContent=(r.pnl>0?'+':'')+money(r.pnl*fx);tone($('#pnl'),r.pnl);$('#return').textContent=pct(r.returnPct)+' · após taxas e funding';
  $('#drawdown').textContent=num(r.maxDD*100)+'%';$('#trade-count').textContent=r.trades.length;$('#trade-note').textContent=r.position?'1 posição aberta · '+num(r.position.margin*fx)+' BRL de margem':'Nenhuma posição aberta';
  $('#fees').textContent=money(r.fees*fx);$('#funding').textContent=money(r.fundingNet*fx);tone($('#funding'),r.fundingNet);$('#liquidations').textContent=r.liquidations;
  equitySeries.setData(r.equity.map(p=>({time:p.time/1000,value:p.value*fx})));equityChart.timeScale().fitContent();
  $('#trades').innerHTML=r.trades.length?[...r.trades].reverse().map(t=>`<tr><td>${dt(t.entryAt)}</td><td>${dt(t.exitAt)}</td><td class="${t.side===1?'positive':'negative'}">${t.side===1?'LONG':'SHORT'}</td><td>${num(t.entry)}</td><td>${num(t.exit)}</td><td>${t.reason}</td><td class="${t.net>=0?'positive':'negative'}">${money(t.net*fx)}</td></tr>`).join(''):'<tr class="empty"><td colspan="7">Nenhuma operação encerrada até este instante. Avance o relógio para observar a estratégia.</td></tr>';
  $('#sim-status').textContent=[r.halted?'Simulador pausado pelo limite global ou liquidação estimada.':r.blocked?'Entradas pausadas pelo limite diário.':'Simulação ativa no período selecionado.',r.rejected+' entradas inviáveis pelos mínimos ou margem.','Reinício de capital ao trocar abril/maio. Funding histórico incluído; liquidação aproximada.'].join(' ');
  $('#signals').innerHTML=r.signals.length?[...r.signals].reverse().map(s=>{const event=r.events.find(e=>e.at===s.at&&['entry','rejected','filtered'].includes(e.kind));const label=event?.kind==='entry'?'Entrada simulada':event?.reason??(r.pending?.at===s.at?'Aguardando candle seguinte completo':'Sem nova entrada · posição, pausa ou intervalo entre operações');const ev=evaluateProbe({at:s.at,target:s.at+3*HOUR,price:s.price,side:s.side},data.candles,cursor);return `<tr><td>${dt(s.at)}</td><td class="${s.side===1?'positive':'negative'}">${s.side===1?'LONG':'SHORT'}</td><td>${num(s.price)}</td><td>${label}</td><td class="${ev.status==='resolved'?(ev.directional>=0?'positive':'negative'):''}">${ev.status==='resolved'?pct(ev.directional):'Aguardando +3h'}</td></tr>`;}).join(''):'<tr class="empty"><td colspan="5">Nenhum cruzamento novo neste período até o relógio atual. A tendência pode continuar sem gerar uma entrada.</td></tr>';
}
function renderProbes(){
  const live=view==='live',rows=live?liveData?.candles:data?.candles,until=live?(liveData?.until??0):cursor;
  const list=probes.filter(p=>p.mode===(live?'live':'replay')&&(live||(p.strategy??'baseline')===replayStrategy)&&p.at<=until).slice(-50).reverse();
  $('#probes').innerHTML=list.length?list.map(p=>{const e=evaluateProbe(p,rows??[],until);const done=e.status==='resolved';return `<tr><td>${dt(p.at)}</td><td class="${p.side===1?'positive':'negative'}">${p.side===1?'ALTA':p.side===-1?'BAIXA':'NEUTRA'}</td><td>${num(p.price)}</td><td>${dt(p.target)}</td><td>${done?num(e.price):'—'}</td><td class="${done?(e.directional>=0?'positive':'negative'):''}">${done?pct(e.directional):'Futuro oculto'}</td><td><span class="badge ${done?(e.correct?'green':'amber'):'neutral'}">${done?(e.correct?'A FAVOR':'CONTRA'):e.status==='unavailable'?'SEM DADOS':'AGUARDANDO'}</span></td></tr>`;}).join(''):'<tr class="empty"><td colspan="7">Registre uma leitura e avance 3 horas para conferir o que aconteceu.</td></tr>';
}
function renderReplay(){
  if(!data)return;const p=periods[phase];cursor=Math.min(p.end,Math.max(p.start+HOUR,cursor));
  $('#asof').value=inputTime(cursor);$('#asof').min=inputTime(p.start+HOUR);$('#asof').max=inputTime(p.end);$('#scrubber').min=p.start+HOUR;$('#scrubber').max=p.end;$('#scrubber').value=cursor;
  $('#range-start').textContent=shortFmt.format(p.start);$('#range-end').textContent=shortFmt.format(p.end);$('#hidden-label').textContent='Disponível até '+dt(cursor)+' · futuro oculto';$('#phase-label').textContent=p.phase;$('#balance-phase').textContent=p.name;
  $('#april').classList.toggle('selected',phase==='april');$('#may').classList.toggle('selected',phase==='may');$('#advance').disabled=cursor>=p.end;$('#back').disabled=cursor<=p.start+HOUR;
  report=simulateReplay(cursor);renderMetrics(report);drawMarket(data.candles,cursor,report);renderProbes();renderReplayBot();
  try{localStorage.setItem('tl-replay-v1',JSON.stringify({phase,strategy:replayStrategy,cursor,speed:replaySpeed,contextMode:replayContextMode}));}catch{}
}
function renderReplayBot(){
  const p=periods[phase],r=report,position=r.position;
  $('#replay-rules').textContent=replayStrategy==='baseline'?'Estratégia original: cruzamento EMA 16/64 de 4h, stop de 2 ATR e sem limite intradiário.':'Hipótese intradiária já testada: cruzamento EMA 9/21 de 1h, stop de 1,5 ATR, alvo de 2R, máximo de 24h e intervalo de 4h após saída. Selecionar reinicia o período; mais operações não comprovam lucro.';
  $('#replay-original-rules').hidden=replayStrategy!=='baseline';
  $('#replay-bot-clock').textContent=dt(cursor)+' / 2025';
  $('#replay-bot-status').textContent=replayStatus(r,cursor,p.end);
  $('#replay-bot-counts').textContent=r.equity.length+' candles avaliados · sinais: '+r.signals.length+' · entradas: '+r.events.filter(e=>e.kind==='entry').length+' · vetos: '+r.events.filter(e=>e.kind==='filtered').length+' · rejeições: '+r.rejected+' · encerradas: '+r.trades.length;
  $('#replay-bot-position').textContent=position?`${position.side===1?'LONG':'SHORT'} · ${num(position.qty,3)} ETH · entrada ${num(position.entry)} USDT · stop atual ${num(position.stop)}${position.target?' · alvo '+num(position.target):''} · risco planejado ${money(position.plannedRisk*config.fx)}`:'Sem posição aberta · orçamento por operação '+money(config.capitalBRL*config.risk)+' sobre o capital inicial.';
  contextLab?.render({context:replayContexts.findLast(c=>c.at<=cursor),signal:r.signals.at(-1),signalContext:r.signals.length?contextFilter('observe').at(r.signals.at(-1).at):null,mode:replayContextMode,strategy:replayStrategy,report:r});
  const list=$('#replay-activity');list.replaceChildren();
  for(const e of replayActivity(r).slice(-8).reverse()){
    const li=document.createElement('li'),side=e.side===1?'LONG':'SHORT';
    const text=e.kind==='signal'?'Sinal '+side+' confirmado':e.kind==='entry'?'Entrada simulada '+side+' a '+num(e.price)+' USDT':e.kind==='exit'?'Saída a '+num(e.price)+' USDT · '+e.reason:e.reason??e.kind;
    li.textContent=dt(e.at)+' · '+text+(e.visibleAt>e.at?' · revelado com o fechamento às '+dt(e.visibleAt):'');list.append(li);
  }
  if(!list.children.length){const li=document.createElement('li');li.textContent='Nenhum sinal até este relógio. Use Próxima atividade para avançar até uma decisão.';list.append(li);}
  $('#next-activity').disabled=cursor>=p.end;$('#play').disabled=cursor>=p.end;$('#end-replay').disabled=cursor>=p.end;$('#replay-strategy').value=replayStrategy;$('#replay-speed').value=String(replaySpeed);renderPlaybackNote();
}
function nextActivity(){
  stopPlay();const p=periods[phase],next=nextReplayTime(simulateReplay(p.end),cursor,p.end);
  cursor=next??p.end;renderReplay();
  if(next===null)toast('Nenhuma nova atividade até o fim deste período. Relógio avançado até o último candle.');
}
function renderPlaybackNote(){
  $('#replay-playback-note').textContent=cursor>=periods[phase].end?'Fim do período. Reinicie ou selecione outro mês para continuar.':playTimer?'Reproduzindo · velocidade alvo: '+replaySpeed+' hora(s) por segundo. O bot só entra com sinal e risco aprovados.':playbackPauseReason||'Replay pausado. Clique em Reproduzir ou avance até a próxima atividade; nenhuma operação nova aparece com o relógio parado.';
}
function stopPlay(reason=''){clearInterval(playTimer);playTimer=null;playbackPauseReason=reason;$('#play').textContent='▶ Reproduzir';renderPlaybackNote();}
function startPlay(){if(cursor>=periods[phase].end)return;playbackPauseReason='';$('#play').textContent='Ⅱ Pausar';playTimer=setInterval(()=>advance(1),1000/replaySpeed);renderPlaybackNote();}
function advance(hours){const p=periods[phase];cursor=Math.min(p.end,Math.max(p.start+HOUR,cursor+hours*HOUR));if(cursor===p.end)stopPlay();renderReplay();}
function setPhase(next){stopPlay();phase=next;cursor=periods[next].start+HOUR;renderReplay();toast(next==='may'?'Maio é teste posterior. Evite ajustar regras após consultar os resultados.':'Validação de abril. Capital reiniciado para este período.');}
function changeView(next){
  stopPlay();view=next;if(window.__TREND_LAB_LOCAL__&&window.trendLab){const u=new URL(location.href);u.searchParams.set('view',next);history.replaceState(null,'',u);}
  window.dispatchEvent(new CustomEvent('trend-view-change',{detail:{view:next}}));all('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===next));
  const method=next==='method',live=next==='live',profit=next==='profit';$('#replay-view').hidden=next!=='replay';$('#live-banner').hidden=!live;$('#method-view').hidden=!method;$('#profit-view').hidden=!profit;$('#market-section').hidden=method||profit;$('#observations-panel').hidden=method||profit;$('#results-panel').hidden=next!=='replay';$('#trades-panel').hidden=next!=='replay';$('#settings-button').hidden=profit;
  const ml=next==='ml';$('#ml-view').hidden=!ml;const donchian=next==='donchian';$('#donchian-view').hidden=!donchian;const scalp=next==='scalping';$('#scalping-view').hidden=!scalp;const improve=next==='improve';$('#improve-view').hidden=!improve;const day=next==='intraday',news=next==='news';$('#intraday-view').hidden=!day;$('#news-view').hidden=!news;if(day||news||improve||scalp||donchian||ml){$('#market-section').hidden=true;$('#observations-panel').hidden=true;$('#settings-button').hidden=true;}
  $('#heading').textContent=profit?'Rentabilidade sob teste.':method?'Da teoria à hipótese testável.':live?'O mercado, sem atalhos.':'O passado, candle por candle.';$('#subtitle').textContent=profit?'Lucros, perdas e custos da mesma estratégia em períodos diferentes.':method?'Famílias de estratégias, regras propostas e limites dos dados, com referências.':live?'Somente leitura. O sinal usa candles encerrados e não envia ordens.':'Decida com o que era conhecido. Avance o relógio. Confira o resultado.';$('#breadcrumb').textContent=profit?'Rentabilidade':method?'Teoria e método':live?'Mercado agora':'Replay histórico';
  if(day||news){$('#heading').textContent=day?'Novas hipóteses, até 24 horas.':'Contexto de mercado, com evidências.';$('#subtitle').textContent=day?'Estratégias intradiárias sob os mesmos custos, capital e risco.':'Análises por este chat, com horário de disponibilidade registrado no servidor.';$('#breadcrumb').textContent=day?'Day trade':'Notícias e IA';}
  if(improve){$('#heading').textContent='Melhorar também é medir.';$('#subtitle').textContent='Custos, execução e notícias comparados com decisões registradas antes do resultado.';$('#breadcrumb').textContent='Melhorias e futuro';}
  if(scalp){$('#heading').textContent='Scalping, minuto por minuto.';$('#subtitle').textContent='Sinais de5min e execução simulada em1min, com custos e limites de risco.';$('#breadcrumb').textContent='Scalping · 5min';}
  if(donchian){$('#heading').textContent='Donchian: fixo ou adaptativo?';$('#subtitle').textContent='Uma variável por vez, com todos os períodos, perdas e custos visíveis.';$('#breadcrumb').textContent='Donchian · comparação';}
  if(ml){$('#heading').textContent='Árvores, contexto e estratégias.';$('#subtitle').textContent='Treino com dados passados, seleção temporal e resultados completos com custos.';$('#breadcrumb').textContent='IA · modelos e estratégias';}
  clearInterval(liveTimer);liveTimer=null;
  if(ml){mlLab?.show();}else if(donchian){donchianLab?.show();}else if(scalp){scalpingLab?.show();}else if(live){$('#record').disabled=true;markers?.setMarkers([]);refreshLive();liveTimer=setInterval(refreshLive,60000);}else if(improve){improvementLab?.refreshForward();}else if(day){dayLab?.render();}else if(news){dayLab?.refreshNews();}else if(profit){profitLab?.render();}else if(!method)renderReplay();
}
async function refreshLive(){
  if(fetching)return;fetching=true;$('#refresh').disabled=true;$('#live-status').textContent='Consultando a API pública da Binance…';
  try{const response=await fetch(window.__TREND_LAB_LOCAL__?'/api/local/market':'https://fapi.binance.com/fapi/v1/klines?symbol=ETHUSDT&interval=1h&limit=1000',{signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('HTTP '+response.status);const raw=await response.json();if(!Array.isArray(raw))throw Error('Resposta inválida');const now=Date.now();const candles=raw.filter(r=>Number(r[6])<now).map(r=>[Number(r[0]),...r.slice(1,6).map(Number)]);if(candles.length<260)throw Error('Histórico insuficiente');liveData={candles,until:candles.at(-1)[0]+HOUR};if(view==='live'){drawMarket(candles,liveData.until,null);renderProbes();}$('#live-status').textContent='Consulta às '+dt(now)+' · último fechamento '+dt(liveData.until)+' · atualização a cada 60s com a página aberta.';
  }catch(err){$('#live-status').textContent='Consulta indisponível nesta rede/região ('+err.message+'). '+(liveData?'Dados anteriores mantidos até '+dt(liveData.until)+'. ':'')+'O replay continua disponível; use o TradingView como referência.';$('#record').disabled=true;}
  finally{fetching=false;$('#refresh').disabled=false;}
}
function record(){
  const live=view==='live',rows=live?liveData?.candles:data.candles,at=live?liveData?.until:cursor;if(!rows)return;
  if(probes.some(p=>p.at===at&&p.mode===(live?'live':'replay')&&(live||(p.strategy??'baseline')===replayStrategy))){toast('Já existe uma leitura registrada neste instante.');return;}
  const p={...makeProbe(rows,at,config),mode:live?'live':'replay',symbol:'ETHUSDT',recordedAt:Date.now(),strategy:live?'baseline':replayStrategy};if(!live&&replayStrategy==='trend1h'){const i=intradayBars(rows,at,'trend1h').at(-1);Object.assign(p,{side:i.side,fast:i.fast,slow:i.slow});}probes=[...probes,p].slice(-200);storage.set('tl-probes-v1',probes);renderProbes();toast('Leitura registrada. Resultado disponível a partir de '+dt(p.target)+'.');
}
function download(filename,content,type='text/csv;charset=utf-8'){const u=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=u;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1000);}
function csv(rows){return '\uFEFF'+rows.map(r=>r.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(';')).join('\r\n');}
function exportTrades(){if(!report)return;download('trend-lab-operacoes.csv',csv([['entrada_utc','saida_utc','lado','quantidade_eth','entrada_usdt','saida_usdt','resultado_liquido_usdt','funding_usdt','motivo'],...report.trades.map(t=>[new Date(t.entryAt).toISOString(),new Date(t.exitAt).toISOString(),t.side===1?'LONG':'SHORT',t.qty,t.entry,t.exit,t.net,t.funding,t.reason])]));}
function exportProbes(){const live=view==='live',until=live?(liveData?.until??0):cursor,rows=live?liveData?.candles:data.candles;const list=probes.filter(p=>p.mode===(live?'live':'replay')&&p.at<=until);download('trend-lab-leituras.json',JSON.stringify({exportedAt:new Date().toISOString(),asOf:new Date(until).toISOString(),readings:list.map(p=>({...p,result:evaluateProbe(p,rows??[],until)}))},null,2),'application/json');}
function openSettings(){const percentages=['risk','fee','slippage','maintenance','totalLimit'];for(const el of $('#settings-form').elements){if(el.name&&config[el.name]!==undefined)el.value=+(config[el.name]*(percentages.includes(el.name)?100:1)).toFixed(6);}$('#settings').showModal();}
$('#settings-form').addEventListener('submit',e=>{e.preventDefault();const f=new FormData(e.target),next={...config};for(const [k,v]of f){next[k]=Number(v)/(['risk','fee','slippage','maintenance','totalLimit'].includes(k)?100:1);}config=next;storage.set('tl-config-v1',config);$('#settings').close();if(view==='replay')renderReplay();toast('Hipóteses atualizadas. Nenhuma alteração feita na Binance.');});
all('[data-view]').forEach(b=>b.addEventListener('click',()=>changeView(b.dataset.view)));$('#method-link').onclick=()=>changeView('method');$('#theory-open').onclick=()=>{changeView('method');window.scrollTo({top:0,behavior:'smooth'});};$('#april').onclick=()=>setPhase('april');$('#may').onclick=()=>setPhase('may');$('#advance').onclick=()=>advance(1);$('#back').onclick=()=>advance(-1);$('#next-activity').onclick=nextActivity;$('#end-replay').onclick=()=>{stopPlay();cursor=periods[phase].end;renderReplay();toast('Relógio avançado até o fim. Todas as operações do período estão no diário.');};$('#replay-speed').onchange=e=>{const wasPlaying=Boolean(playTimer);stopPlay();replaySpeed=Number(e.target.value);if(wasPlaying)startPlay();renderReplay();};$('#restart-replay').onclick=()=>{stopPlay();cursor=periods[phase].start+HOUR;renderReplay();};$('#context-mode').onchange=e=>{stopPlay();replayContextMode=e.target.value;cursor=periods[phase].start+HOUR;renderReplay();toast('Filtro experimental alterado. Período reiniciado com o mesmo capital e risco.');};$('#replay-strategy').onchange=e=>{stopPlay();replayStrategy=e.target.value;cursor=periods[phase].start+HOUR;renderReplay();toast('Período reiniciado com a estratégia selecionada. Capital e risco mantidos.');};$('#record').onclick=record;$('#refresh').onclick=refreshLive;$('#export-trades').onclick=exportTrades;$('#export-probes').onclick=exportProbes;$('#settings-button').onclick=openSettings;$('#close-settings').onclick=()=>$('#settings').close();
$('#play').onclick=()=>{if(playTimer){stopPlay();return;}startPlay();};$('#scrubber').oninput=e=>{stopPlay();cursor=Number(e.target.value);renderReplay();};$('#asof').onchange=e=>{stopPlay();const t=Date.parse(e.target.value+'-03:00');if(Number.isFinite(t)){cursor=Math.floor(t/HOUR)*HOUR;renderReplay();}};
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(playTimer)stopPlay('Reprodução pausada ao sair da aba. Clique em Reproduzir para continuar deste relógio.');clearInterval(liveTimer);liveTimer=null;}else if(view==='live'){refreshLive();liveTimer=setInterval(refreshLive,60000);}});
try{const responses=await Promise.all([fetch('./data/eth-2025.json'),fetch('./data/profitability.json'),fetch('./data/intraday-results.json'),fetch('./data/improvements-results.json'),fetch('./data/direction-results.json'),fetch('./data/range-vwap-results.json'),fetch('./data/context-results.json')]);if(responses.some(r=>!r.ok))throw Error('Falha nos arquivos de pesquisa');data=await responses[0].json();const profitData=await responses[1].json();const intradayData=await responses[2].json();replayTrendRule=intradayData.protocol.strategies.find(s=>s.id==='trend1h');const contextData=await responses[6].json();replayContextProtocol=contextData.protocol;replayContexts=contextIndicators(data.candles);setupCharts();contextLab=installContextUI({data:contextData,money,num,pct,dt,download});scalpingLab=installScalping({chartOptions,money,num,pct,dt,download});donchianLab=installDonchian({chartOptions,money,num,pct,dt,download});mlLab=installStrategiesML({chartOptions,money,num,dt,download});$('#data-info').textContent=`${data.candles.length} candles horários · ${data.funding.length} eventos de funding · filtros consultados em ${dt(Date.parse(data.filtersAsOf))}. Consulte os hashes no manifesto de dados. A aba Rentabilidade amplia a análise até setembro de 2026, com método e cenários congelados.`;renderReplay();profitLab=installProfitability({data:profitData,chartOptions,money,num,pct,dt,download,csv});dayLab=installLab({data:intradayData,chartOptions,money,num,pct,dt,download,getView:()=>view});improvementLab=installImprovements({data:await responses[3].json(),auditData:await responses[4].json(),money,num,pct,dt,download,getView:()=>view});installRangeVwap({data:await responses[5].json(),chartOptions,money,num,pct,dt,download});changeView('improve');window.trendLab={get state(){return {view,phase,cursor,report,probes,config,replayStrategy,replaySpeed,replayContextMode,playing:Boolean(playTimer)};}};}
catch(err){$('#subtitle').textContent='Não foi possível iniciar o laboratório: '+err.message;toast(err.message);console.error(err);}
