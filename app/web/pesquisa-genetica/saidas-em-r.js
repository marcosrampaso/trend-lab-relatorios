const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=v=>v==null?'—':new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v),num=v=>new Intl.NumberFormat('pt-BR').format(v),pct=v=>(v*100).toFixed(1).replace('.',',')+'%',R=v=>v==null?'—':v.toFixed(4).replace('.',',')+'R';
const names={'genetic-151':'Genética · semente 151','ppo-101':'PPO · semente 101','ppo-202':'PPO · semente 202',aligned_trend:'Controle · tendência 1h/4h'};
let data,display;const cells=a=>a.map(r=>'<tr>'+r.map(v=>'<td>'+esc(v)+'</td>').join('')+'</tr>').join('');
async function get(url,optional=false){const r=await fetch(url,{cache:'no-store'});if(!r.ok){if(optional&&r.status===404)return null;throw Error('Falha ao carregar '+url);}return r.json();}
function cards(id,a){$(id).innerHTML=a.map(([label,value])=>`<article><span>${esc(label)}</span><strong>${esc(value)}</strong></article>`).join('');}
function draw(){const stage=$('stage').value,source=$('source').value,month=$('month').value,old=data.wallets[source].margin.wallets.find(w=>w.month===month),next=data.wallets[source].priceRisk.wallets.find(w=>w.month===month);
 const curves=[old.curve,next.curve,old.cdi.curve],W=980,H=335,L=75,B=280,T=20,end=old.cdi.end,start=old.cdi.start,values=curves.flatMap(a=>a.map(p=>p.brl)),lo=Math.min(...values)-10,hi=Math.max(...values)+10;
 const x=t=>L+(t-start)/(end-start)*(W-L-20),y=v=>B-(v-lo)/(hi-lo)*(B-T);let svg=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Escadas atual e em R comparadas ao CDI no mesmo calendário">`;
 for(let i=0;i<=4;i++){const v=lo+(hi-lo)*i/4;svg+=`<path d="M${L} ${y(v)}H${W-20}" stroke="#2d4354"/><text x="5" y="${y(v)+4}" fill="#aebfd2" font-size="13">${esc(money(v))}</text>`;}
 curves.forEach((a,i)=>{svg+=`<path d="${a.map((p,j)=>(j?'L':'M')+x(p.at)+' '+y(p.brl)).join(' ')}" fill="none" stroke="${['#8cbaff','#7bdcba','#f4c467'][i]}" stroke-width="2.5"/>`;});
 for(const[t,anchor]of [[start,'start'],[end,'end']])svg+=`<text x="${x(t)}" y="315" text-anchor="${anchor}" fill="#aebfd2" font-size="14">${new Date(t).toISOString().slice(0,10)}</text>`;
 $('chart').innerHTML=svg+'</svg>';$('chart-note').textContent=`${names[source]} · ${month}. Líquido atual ${money(old.pnlBRL)}; em R ${money(next.pnlBRL)}; CDI ${money(old.cdi.pnlBRL)}. Posições ${old.count} / ${next.count}. Sinais com posição ocupada ${old.overlapSkips} / ${next.overlapSkips}; bloqueios de risco ${old.riskSkips} / ${next.riskSkips}.`;
}
function changeStage(){const key=$('stage').value,stage=data.stages[key],mechanism=display.stages[key];
 $('calendar-note').textContent=key==='pairedDiagnostic'?'Cinco meses originais: abril, maio, junho, julho e setembro de 2024. Comparação retrospectiva pareada.':'Outubro, novembro e dezembro de 2024: calendário posterior fixado antes do cálculo, com modelos de entrada congelados. Histórico já usado pelo laboratório; sem independência nova.';
 $('paired').innerHTML=cells(Object.entries(stage.sides).map(([side,s])=>[side==='1'?'Compra':'Venda',num(s.count),R(s.margin.meanNetR),R(s.priceRisk.meanNetR),R(s.meanDeltaR),`${s.better} / ${s.worse} / ${s.equal}`]));
 $('months').innerHTML=cells(stage.months.map(m=>[m.month,R(m.sides['1'].margin.meanNetR),R(m.sides['1'].priceRisk.meanNetR),R(m.sides['-1'].margin.meanNetR),R(m.sides['-1'].priceRisk.meanNetR)]));
 $('boundary-note').textContent=Object.entries(stage.sides).map(([side,s])=>`${side==='1'?'Compra':'Venda'} sem fronteiras mensais: atual ${R(s.margin.meanWithoutBoundaryR)}, em R ${R(s.priceRisk.meanWithoutBoundaryR)}.`).join(' ');
 $('unchanged').textContent=`${num(mechanism.unchanged)} dos ${num(mechanism.count)} pares (${pct(mechanism.unchanged/mechanism.count)}) tiveram resultado líquido igual. Muitos encerramentos ocorreram no stop, antes de completar a escada.`;
 const labels={filled:'Posições preenchidas',initialStop:'Encerraram no stop inicial',protectedStop:'Encerraram no stop protegido',protectionWithoutPartial:'Proteção aplicada, sem nenhuma parcial',anyPartial:'Tiveram alguma realização parcial'};
 $('mechanisms').innerHTML=cells(Object.entries(labels).map(([k,v])=>[v,num(mechanism.arms.margin[k]),num(mechanism.arms.priceRisk[k])]));
 $('wallets').innerHTML=cells(Object.entries(data.wallets).map(([key,v])=>{const a=v.margin.stages[$('stage').value],b=v.priceRisk.stages[$('stage').value];return[names[key],money(a.meanMonthlyBRL),money(b.meanMonthlyBRL),`${a.aboveCDI}/${a.months} · ${b.aboveCDI}/${b.months}`,`${a.count} / ${b.count}`];}));
 const ppo=arm=>['ppo-101','ppo-202'].reduce((s,k)=>s+data.wallets[k][arm].stages[key].meanMonthlyBRL,0)/2;
 $('ppo-average').textContent=`Média das duas sementes PPO, sem escolher a melhor: atual ${money(ppo('margin'))} por mês; em R ${money(ppo('priceRisk'))}.`;
 $('month').innerHTML=data.protocol.months.filter(m=>m.stage===key).map(m=>`<option>${m.month}</option>`).join('');
 const examples=display.examples.filter(r=>r.stage===key);$('examples').innerHTML=cells(examples.map(r=>[names[r.key],new Date(r.at).toISOString().slice(0,16).replace('T',' '),r.side===1?'Compra':'Venda',money(r.margin.netBRL),money(r.priceRisk.netBRL),money(r.deltaBRL),(r.margin.rejection??r.margin.reason)+' / '+(r.priceRisk.rejection??r.priceRisk.reason)]));
 $('example-note').textContent=examples.length?`${examples.length} sinais selecionados neste calendário; a amostra dos especialistas continua pequena. A genética de semente 151 deste piloto é uma regra linear nova, diferente do antigo campeão G151.`:'Nenhum sinal selecionado neste calendário.';draw();
}
function render(){
 $('status').textContent='Teste concluído · mudar só a escada não resolveu as perdas.';
 cards('metrics',[['Pares com entrada igual',num(data.totalPairs)],['Saídas de controle reproduzidas',num(data.parity)],['Carteiras comparadas',Object.values(data.wallets).reduce((s,a)=>s+a.margin.wallets.length+a.priceRisk.wallets.length,0)],['Modelos retreinados','0']]);
 const g=data.wallets['genetic-151'],ppo=data.wallets['ppo-101'];
 $('findings').innerHTML=[
 'A média líquida das oportunidades continuou negativa nos dois lados e nos dois calendários. As diferenças de escada foram pequenas.',
 `Genética nos cinco meses originais: ${money(g.margin.stages.pairedDiagnostic.meanMonthlyBRL)} → ${money(g.priceRisk.stages.pairedDiagnostic.meanMonthlyBRL)} de líquido mensal médio.`,
 `PPO 101 em outubro–dezembro: ${money(ppo.margin.stages.temporalReplay.meanMonthlyBRL)} → ${money(ppo.priceRisk.stages.temporalReplay.meanMonthlyBRL)} por mês. Nenhuma das escadas superou o CDI em qualquer desses meses.`,
 'A hipótese de que os modelos já acertam a entrada continua sem demonstração. Os pesos foram preservados; não promovemos a nova regra.'
 ].map(v=>'<li>'+esc(v)+'</li>').join('');
 const selected=display.selectedEvidence;$('selected-evidence').textContent=`Nas ${selected.filled} oportunidades preenchidas que os próprios modelos selecionaram no calendário original, ${selected.losers} perderam. Dessas perdedoras, ${selected.losersWithPriorPositiveDecision} mostraram lucro líquido numa decisão de cinco minutos antes da perda. Essa amostra é pequena e não demonstra habilidade de entrada.`;
 const prior=display.priorProfit;$('prior-profit').textContent=`Na auditoria anterior, ${prior['1'].priorPositiveDecision} de ${num(prior['1'].losers)} compras perdedoras (${pct(prior['1'].priorPositiveDecision/prior['1'].losers)}) e ${prior['-1'].priorPositiveDecision} de ${num(prior['-1'].losers)} vendas perdedoras (${pct(prior['-1'].priorPositiveDecision/prior['-1'].losers)}) chegaram a mostrar uma estimativa de encerramento líquido positiva numa decisão de cinco minutos antes de terminar negativas.`;
 $('recommendation').textContent='A troca isolada para alvos em R não demonstrou melhora financeira suficiente. Um mecanismo a investigar separadamente é o instante de ativação da proteção, que pode encerrar posições antes das realizações. Qualquer comparação dessa ativação precisa manter entrada, risco e demais saídas iguais; desligar stops ou ampliar risco para buscar lucro não foi testado nem aplicado.';
 $('integrity').textContent=`Integridade: ${num(data.parity)} resultados antigos de oportunidade e ${data.walletParity} resumos/ledgers mensais reproduzidos exatamente; entradas idênticas conferidas nos ${num(data.totalPairs)} pares. ${num(data.integrity.unchangedInputs)} inputs e fontes registrados conferidos antes e depois. Todos os sinais foram congelados antes dos resultados de saída.`;
 $('protocol').textContent=JSON.stringify(data.protocol,null,2);changeStage();
}
$('stage').onchange=changeStage;$('source').onchange=draw;$('month').onchange=draw;
async function load(){try{data=await get('/data/r-ladder.json',true);if(!data){const status=await get('/data/r-ladder-status.json',true);$('status').textContent='Comparação em andamento';$('error').textContent=status?`${status.phase} · ${num(status.completed??0)} / ${num(status.total??0)} pares`:'Aguardando';setTimeout(load,10000);return;}display=await get('/data/r-ladder-display.json');$('error').textContent='';render();}catch(e){$('error').textContent=e.message;}}
load();
