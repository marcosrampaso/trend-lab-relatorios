import {money,percent,esc,plot} from './pepe-study-chart.js';
const $=id=>document.getElementById(id), names={control:'Sem filtro',cost_gate:'Com filtro ATR/custo'};
const colors={control:'#8cbaff',cost_gate:'#7bdcba'};
const criteriaNames={meanMonthlyPositive:'Líquido mensal médio positivo',meanPairedDeltaPositive:'Diferença média positiva contra o controle',medianPairedDeltaPositive:'Diferença mediana positiva contra o controle',sufficientCDIMonths:'Superar CDI em pelo menos 3 dos 5 meses',sufficientTrades:'Pelo menos 30 operações executadas'};
let data;
const sign=v=>v>=0?'positive':'negative';
function drawWallet(){
  const month=$('month').value,control=data.arms.control.find(w=>w.month===month);
  const gate=data.arms.cost_gate.find(w=>w.month===month);if(!gate||!control)return;
  plot($('wallet'),[...Object.keys(names).map(k=>({name:names[k],color:colors[k],points:data.arms[k].find(w=>w.month===month).curve.map(p=>({x:p.at,y:p.brl}))})),{name:'CDI bruto',color:'#f4c467',points:control.cdi.curve.map(p=>({x:p.at,y:p.brl}))}],{time:true,label:'Carteiras mensais com e sem filtro e CDI bruto'});
  $('wallet-note').textContent=`${month}: sem filtro ${money(control.pnlBRL)}; com filtro ${money(gate.pnlBRL)}; diferença ${money(gate.pnlBRL-control.pnlBRL)}. O filtro aceitou ${gate.sourceEntryCount}/${gate.totalSourceSignals} sinais e a carteira executou ${gate.count}. CDI: ${money(control.cdi.pnlBRL)}.`;
}
function renderSplit(){
  const split=$('split').value,s=data.summary[split];
  $('arms').innerHTML=Object.entries(s.arms).map(([k,r])=>`<tr><td>${names[k]}</td><td class="${sign(r.meanMonthlyBRL)}">${money(r.meanMonthlyBRL)}</td><td>${percent(r.meanDD)}</td><td>${r.aboveCDI}/${s.months}</td><td>${r.losingMonths}/${s.months}</td><td>${r.zeroTradeMonths}/${s.months}</td><td>${r.trades}</td></tr>`).join('');
  $('contrast').textContent=`O filtro aceitou ${s.accepted}/${s.signals} sinais. Diferença mensal média: ${money(s.meanPairedDeltaBRL)}; mediana: ${money(s.medianPairedDeltaBRL)}. CDI médio: ${money(s.meanCDIBRL)}. Esses resultados descrevem calendários já utilizados, sem comprovar generalização.`;
  $('months').innerHTML=s.rows.map(w=>`<tr><td>${esc(w.month)}</td><td>${money(w.controlBRL)}</td><td>${money(w.gateBRL)}</td><td class="${sign(w.deltaBRL)}">${money(w.deltaBRL)}</td><td>${money(w.cdiBRL)}</td><td>${w.accepted}/${w.signals}</td><td>${w.controlTrades} / ${w.gateTrades}</td></tr>`).join('');
  plot($('monthly'),[...Object.keys(names).map(k=>({name:names[k],color:colors[k],points:data.arms[k].filter(w=>w.split===split).map(w=>({x:w.cdi.start,y:w.pnlBRL}))})),{name:'CDI bruto',color:'#f4c467',points:data.arms.control.filter(w=>w.split===split).map(w=>({x:w.cdi.start,y:w.cdi.pnlBRL}))}],{time:true,label:'Resultados mensais independentes e CDI'});
  $('costs').innerHTML=Object.entries(s.arms).map(([k,r])=>`<tr><td>${names[k]}</td><td>${money(r.grossBRL)}</td><td>${money(r.feesBRL)}</td><td>${money(r.fundingBRL)}</td><td>${r.gateRejected}</td><td>${r.riskSkips}</td><td>${r.overlapSkips}</td></tr>`).join('');
  const old=$('month').value;$('month').innerHTML=s.rows.map(w=>`<option>${esc(w.month)}</option>`).join('');
  if(s.rows.some(w=>w.month===old))$('month').value=old;drawWallet();
}
function render(){
  const d=data.summary.development,g=d.arms.cost_gate;
  $('status').textContent=data.mayRegisterProspective?'Teste concluído · critérios exploratórios atingidos':'Teste concluído · hipótese não passou os critérios';
  $('summary').textContent=`320 sinais · 15 meses · ${data.controlParityWallets} carteiras do controle reproduzidas exatamente. Limiar fixado em 2 antes da execução. Conclusão: ${new Date(data.completedAt).toLocaleString('pt-BR')}. Nenhum filtro aplicado ao bot.`;
  $('metrics').innerHTML=[['Com filtro · média mensal',money(g.meanMonthlyBRL)],['Diferença contra controle',money(d.meanPairedDeltaBRL)],['Sinais aceitos · desenvolvimento',d.accepted+'/'+d.signals],['Meses acima do CDI',g.aboveCDI+'/'+d.months]].map(([k,v])=>`<article><span>${esc(k)}</span><strong>${esc(v)}</strong></article>`).join('');
  $('criteria').innerHTML=Object.entries(data.criteria).map(([k,v])=>`<tr><td>${criteriaNames[k]}</td><td>${v?'Atingido':'Não atingido'}</td></tr>`).join('');
  $('conclusion-title').textContent=data.mayRegisterProspective?'Há motivo para registrar um teste futuro.':'Não promover este filtro.';
  $('conclusion').textContent=`No desenvolvimento, o filtro teve média ${money(g.meanMonthlyBRL)}, contra ${money(d.arms.control.meanMonthlyBRL)} do controle. Executou ${g.trades} operações, perdeu em ${g.losingMonths}/${d.months} meses e superou CDI em ${g.aboveCDI}/${d.months}. ${data.mayRegisterProspective?'Passar nestes recortes consumidos não demonstra lucro futuro.':'Não reuniu os critérios definidos para avançar. Reduzir a perda ou operar pouco não basta para demonstrar vantagem.'} O próximo passo não será procurar outro múltiplo neste mesmo resultado.`;
  $('protocol').textContent=JSON.stringify(data.protocol,null,2);renderSplit();
}
try{
  const r=await fetch('../data/entry-cost-gate.json',{cache:'no-store'});
  if(!r.ok)throw Error('O estudo ainda está calculando; resultado congelado indisponível.');
  data=await r.json();if(data.app!=='trend-lab-entry-cost-gate')throw Error('Identidade do resultado inválida');render();
}catch(e){$('error').textContent=e.message;}
$('split').onchange=()=>data&&renderSplit();$('month').onchange=()=>data&&drawWallet();
