const $=id=>document.getElementById(id),escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>n==null?'—':new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n),number=n=>new Intl.NumberFormat('pt-BR').format(n),percent=n=>n==null?'—':(n*100).toFixed(1).replace('.',',')+'%',r=n=>n==null?'—':n.toFixed(3).replace('.',',')+'R';
const side=s=>Number(s)===1?'Compra':'Venda',name=k=>{const a=k.split('-');return(a[0]==='genetic'?'Genética · semente ':'PPO · semente ')+a.at(-1)+' · '+side(k.includes('--')?-1:1);};
const controlNames={cash:'Ficar em caixa',all_long:'Sempre comprar',all_short:'Sempre vender',aligned_trend:'Tendência alinhada 1h / 4h'};
const groupNames={aligned:'A favor de 1h e 4h',opposed:'Contra 1h e 4h',mixed:'Tendências divergentes / neutras',upTo025R:'Custo ≤ 0,25R de preço', '025to05R':'Custo > 0,25 até 0,50R de preço',above05R:'Custo > 0,50R de preço',unavailable:'Sem estimativa',below1:'RVOL < 1','1to2':'1 ≤ RVOL < 2',atLeast2:'RVOL ≥ 2'};
let data,old;
async function json(url,optional=false){const res=await fetch(url,{cache:'no-store'});if(!res.ok){if(optional&&res.status===404)return null;throw Error('Não foi possível carregar '+url);}return res.json();}
const cells=rows=>rows.map(row=>'<tr>'+row.map(c=>'<td>'+escape(c)+'</td>').join('')+'</tr>').join('');
function cards(id,rows){$(id).innerHTML=rows.map(([label,value])=>`<article><span>${escape(label)}</span><strong>${escape(value)}</strong></article>`).join('');}
function drawCosts(){const s=data.sides[$('cost-side').value],rows=[['Bruto · preços de referência',s.meanReferenceGrossBRL,'#8cbaff'],['Slippage / ticks',-s.meanSlippageBRL,'#ffac9d'],['Taxas',-s.meanFeesBRL,'#f4c467'],['Funding',s.meanFundingBRL,'#bba6ff'],['Líquido',s.meanNetBRLFilled,'#ff9388']],scale=Math.max(...rows.map(x=>Math.abs(x[1])));
 $('costs').innerHTML=rows.map(([label,v,color])=>`<div class="cost-row"><span>${escape(label)}</span><div class="cost-track"><i style="background:${color};width:${Math.abs(v)/scale*100}%"></i></div><b>${escape(money(v))}</b></div>`).join('');
 $('cost-note').textContent=`${side($('cost-side').value)}: bruto médio de referência ${money(s.meanReferenceGrossBRL)} − slippage/ticks ${money(s.meanSlippageBRL)} − taxas ${money(s.meanFeesBRL)} + funding ${money(s.meanFundingBRL)} = ${money(s.meanNetBRLFilled)} líquido. Valores arredondados apenas na exibição.`;
}
function drawGroups(){const dimension=$('dimension').value,rows=[];for(const group of data.groups[dimension])for(const [direction,s]of Object.entries(group.sides)){
 const known=s.byMonth.filter(m=>m.count>0),positive=known.filter(m=>m.meanNetR>0).length;rows.push([groupNames[group.value],side(direction),number(s.count),number(s.filled),r(s.meanNetR),positive+' / '+known.length]);}
 $('groups').innerHTML=cells(rows);$('groups-note').textContent='Nenhum dos grupos não vazios apresentou média líquida positiva no agregado de cinco meses. Menor custo relativo melhorou a média, mas ela continuou negativa. Um mês isolado positivo não estabelece uma estratégia; os resultados por bloco estão no JSON.';
}
function drawWallet(){const policy=$('control').value,month=$('month').value,w=data.controls[policy].wallets.find(w=>w.month===month),model=old.results['genetic-151-combined'].wallets.find(w=>w.month===month);
 const curves=[w.curve,model.curve,w.cdi.curve].map(a=>a.map(v=>[v.at,v.brl]));
 // Frozen wealth curves use {at,brl}; fail visibly rather than fabricating a curve.
 if(curves.some(a=>!a.length||a.some(v=>!v.every(Number.isFinite))))throw Error('Formato de curva financeira inesperado');
 const [start,end]=[w.cdi.start,w.cdi.end],W=980,H=340,L=75,R=20,T=20,B=285,min=Math.min(...curves.flatMap(a=>a.map(v=>v[1])))-10,max=Math.max(...curves.flatMap(a=>a.map(v=>v[1])))+10;
 const x=t=>L+(t-start)/(end-start)*(W-L-R),y=v=>B-(v-min)/(max-min)*(B-T);let svg=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Carteira do controle, especialistas genéticos e CDI no mesmo mês">`;
 for(let i=0;i<=4;i++){const v=min+(max-min)*i/4;svg+=`<path d="M${L} ${y(v)}H${W-R}" stroke="#2d4354"/><text x="5" y="${y(v)+4}" fill="#aebfd2" font-size="13">${escape(money(v))}</text>`;}
 curves.forEach((c,i)=>{svg+=`<path d="${c.map(([t,v],j)=>(j?'L':'M')+x(t)+' '+y(v)).join(' ')}" fill="none" stroke="${['#7bdcba','#8cbaff','#f4c467'][i]}" stroke-width="2.5"/>`;});
 for(const[t,anchor]of [[start,'start'],[end,'end']])svg+=`<text x="${x(t)}" y="320" text-anchor="${anchor}" fill="#aebfd2" font-size="14">${new Date(t).toISOString().slice(0,10)}</text>`;
 $('wallet').innerHTML=svg+'</svg>';$('wallet-note').textContent=`${controlNames[policy]} · ${month}: líquido ${money(w.pnlBRL)}, ${w.count} posições, queda máxima ${percent(w.maxDD)}. Genética: ${money(model.pnlBRL)}. CDI: ${money(w.cdi.pnlBRL)}. ${w.halted?'Limite global atingido; permanece em caixa até o fim do mês.':'Sem limite global atingido.'}`;
}
function render(){
 const buy=data.sides['1'],sell=data.sides['-1'],filled=buy.filled+sell.filled,total=data.total;
 $('status').textContent='Auditoria concluída · retorno líquido e calibração são os gargalos.';
 cards('headline',[['Oportunidades isoladas',number(total)],['Preenchidas na simulação',number(filled)+' / '+number(total)],['Positivas · compras',percent(buy.positiveRateFilled)],['Positivas · vendas',percent(sell.positiveRateFilled)]]);
 const breakEven=s=>-s.meanLossR/(s.meanWinR-s.meanLossR),findings=[
  `${percent(filled/total)} das oportunidades eram executáveis. Só oito foram recusadas por stop além da liquidação estimada; não há evidência de que essa barreira explique a inatividade geral.`,
  `As compras positivas ganharam em média ${r(buy.meanWinR)}, mas as negativas perderam ${r(buy.meanLossR)}. Nas vendas: ${r(sell.meanWinR)} contra ${r(sell.meanLossR)}. Com essa distribuição, seria necessário acertar cerca de ${percent(breakEven(buy))} / ${percent(breakEven(sell))} para empatar.`,
  `O bruto a preços de referência ficou próximo de zero: ${money(buy.meanReferenceGrossBRL)} por compra e ${money(sell.meanReferenceGrossBRL)} por venda, antes de cerca de ${money(buy.meanFeesBRL+buy.meanSlippageBRL)} / ${money(sell.meanFeesBRL+sell.meanSlippageBRL)} de taxas e slippage. Essa atribuição usa a mesma trajetória de ordens.`,
  'Os três controles ativos atingiram o limite global em todos os cinco meses. Gerar mais ordens, sozinho, piorou os resultados.',
  'As faixas positivas relevantes da calibração tinham apenas sete exemplos para a genética de compra e dez para o PPO 101 de venda. A estimativa otimista não se sustentou depois.'
 ];$('findings').innerHTML=findings.map(t=>'<li>'+escape(t)+'</li>').join('');
 const f=data.feasibility;$('feasibility').innerHTML=cells([['Pré-checagem permite',number(f.predictedPassFilled),number(f.predictedPassUnfilled)],['Pré-checagem recusa',number(f.predictedFailFilled),number(f.predictedFailUnfilled)]]);
 $('feasibility-note').textContent=`Neste histórico, a estimativa no último fechamento concordou com ${number(f.predictedPassFilled+f.predictedFailUnfilled)} dos ${number(total)} resultados de preenchimento isolado. As oito recusas eram de stop além da liquidação. Isso descreve viabilidade no motor, não lucratividade ou execução garantida na Binance.`;
 $('payoff').innerHTML=cells(Object.entries(data.sides).map(([direction,s])=>[side(direction),number(s.count),number(s.filled),percent(s.positiveRateFilled),r(s.meanWinR),r(s.meanLossR),percent(breakEven(s)),r(s.meanNetR)]));
 $('payoff-note').textContent='A escada atual realiza 25% / 50% / 25% da quantidade em alvos líquidos de 10% / 20% / 40% da margem inicial, enquanto o stop depende de 1,5 ATR. Os resultados mostram ganhos típicos menores que as perdas. Isso aponta para auditar a relação entre alvo, stop e custos; não prova que uma nova saída resolverá a estratégia.';
 $('months').innerHTML=cells(data.months.map(m=>[m.month,r(m.sides['1'].meanNetR),r(m.sides['-1'].meanNetR),m.sides['1'].positive+' / '+m.sides['1'].filled,m.sides['-1'].positive+' / '+m.sides['-1'].filled,m.sides['1'].boundaries+m.sides['-1'].boundaries]));
 $('boundary-note').textContent=`Encerramentos na fronteira do mês: ${buy.boundaries+sell.boundaries}. Sem esses casos, a média continua ${r(buy.meanNetRWithoutBoundary)} para compras e ${r(sell.meanNetRWithoutBoundary)} para vendas. Essas são médias de oportunidades, não retorno de carteira.`;
 const rows=Object.entries(data.controls).map(([k,c])=>[controlNames[k],money(c.meanMonthlyBRL),c.aboveCDI+' / 5',c.count,c.haltedMonths+' / 5']);
 for(const system of ['genetic-151','ppo-101','ppo-202']){const c=old.results[system+'-combined'];rows.push([system==='genetic-151'?'Especialistas · genética (semente 151)':'Especialistas · '+system.toUpperCase(),money(c.meanMonthlyBRL),c.aboveCDI+' / 5',c.count,c.wallets.filter(w=>w.halted).length+' / 5']);}
 const meanCDI=data.controls.cash.wallets.reduce((s,w)=>s+w.cdi.pnlBRL,0)/5;rows.push(['CDI bruto',money(meanCDI),'—','—','—']);$('controls').innerHTML=cells(rows);
 $('control').innerHTML=Object.entries(controlNames).map(([k,v])=>`<option value="${k}">${escape(v)}</option>`).join('');$('control').value='aligned_trend';$('month').innerHTML=data.protocol.months.map(m=>`<option>${m.month}</option>`).join('');
 $('models').innerHTML=cells(Object.values(data.calibration.models).map(m=>[name(m.key),m.accepted.count,r(m.accepted.predictedMeanR),r(m.accepted.actualMeanR),m.acceptedProfitable+' / '+m.acceptedUnfilled,number(m.evaluation.clippedBelow+m.evaluation.clippedAbove)]));
 $('calibration-note').textContent='Genética de compra: a faixa acima de 0,25R tinha sete exemplos em março; quatro sinais foram aceitos depois, dois além do intervalo de scores observado na calibração. PPO 101 de venda: a faixa (0,1; 0,25]R tinha dez exemplos; dos três sinais aceitos, dois nem eram executáveis. Não há suporte para tratar essas estimativas como confiáveis.';
 $('bins').innerHTML=Object.values(data.calibration.models).map(m=>`<details><summary>${escape(name(m.key))} · suporte por faixa</summary><div class="v4-table"><table><thead><tr><th>Previsão líquida</th><th>Exemplos em março</th><th>Suporte</th><th>Oportunidades avaliadas</th><th>Média observada</th><th>Política aceita</th></tr></thead><tbody>${cells(m.bins.map(b=>[b.name,b.calibration.count,b.lowCalibrationSupport?'Menos de 50':'Pelo menos 50',b.evaluation.count,r(b.evaluation.actualMeanR),b.eligibleEvaluation]))}</tbody></table></div></details>`).join('');
 $('accepted').innerHTML=cells(data.accepted.map(a=>[name(a.key),new Date(a.at).toISOString().slice(0,16).replace('T',' '),r(a.predictedNetR),a.known.feasible?'Permite':'Recusa',a.filled?'Sim':'Não',money(a.netBRL),a.unfilledReason??a.reason]));
 $('recommendation').textContent='A prioridade é investigar uma relação de ganho/perda compatível com os custos e demonstrar que sinais conhecidos antes da entrada conseguem selecionar resultados melhores. O simples alinhamento de tendência, os cortes de volume e o custo relativo não mostraram média líquida positiva neste conjunto. A pré-checagem de execução é útil, mas insuficiente para resolver a expectativa negativa.';
 $('integrity').textContent=`Integridade: ${data.parity} casos antigos reproduzidos exatamente; ${number(data.integrity.unchangedInputs)} arquivos de entrada e fontes registrados conferidos antes e depois. Nenhum peso, sinal original, limiar ou regra de risco foi alterado. A semente genética 151 deste piloto é uma nova regra linear; não é o antigo campeão G151.`;
 $('protocol').textContent=JSON.stringify(data.protocol,null,2);drawCosts();drawGroups();drawWallet();
}
$('cost-side').onchange=drawCosts;$('dimension').onchange=drawGroups;$('control').onchange=drawWallet;$('month').onchange=drawWallet;
async function load(){try{const status=await json('/data/opportunity-status.json',true);data=await json('/data/opportunities.json',true);
 if(!data){$('status').textContent='Auditoria em andamento';$('error').textContent=status?`${status.phase} · ${number(status.completed??0)} / ${number(status.total??14582)} oportunidades`:'Aguardando início';setTimeout(load,10000);return;}
 old=await json('/data/specialists.json');$('error').textContent='';render();
}catch(e){$('error').textContent=e.message;}}
load();
