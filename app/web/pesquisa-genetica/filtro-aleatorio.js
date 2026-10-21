import {money,percent,esc} from './pepe-study-chart.js';
const $=id=>document.getElementById(id),number=v=>Number.isFinite(v)?v.toLocaleString('pt-BR',{maximumFractionDigits:2}):'—';
let timer,complete=false;
function histogram(data){
  const values=data.replicates.map(r=>r.meanMonthlyBRL),reference=data.comparison.referenceBRL;
  const min=Math.min(...values,reference,0,data.meanCDIBRL),max=Math.max(...values,reference,0,data.meanCDIBRL);
  const margin=Math.max(1,(max-min)*.05),lo=min-margin,hi=max+margin;
  const count=20,bins=Array(count).fill(0);for(const v of values)bins[Math.min(count-1,Math.floor((v-lo)/(hi-lo)*count))]++;
  const peak=Math.max(...bins,1),W=960,H=340,L=58,R=22,T=26,B=62;
  const X=v=>L+(v-lo)/(hi-lo)*(W-L-R),Y=n=>H-B-n/peak*(H-T-B),bar=(W-L-R)/count;
  let svg='';
  for(let i=0;i<=4;i++){
    const n=peak*i/4,y=Y(n);svg+=`<line x1="${L}" x2="${W-R}" y1="${y}" y2="${y}" stroke="#34485e"/><text x="${L-10}" y="${y+4}" text-anchor="end" fill="#b2c3d8" font-size="12">${Math.round(n)}</text>`;
  }
  bins.forEach((n,i)=>{const low=lo+(hi-lo)*i/count,high=lo+(hi-lo)*(i+1)/count;svg+=`<rect x="${L+i*bar+1}" y="${Y(n)}" width="${bar-2}" height="${H-B-Y(n)}" fill="#8cbaff" opacity=".75"><title>${esc(money(low))} a ${esc(money(high))}: ${n} seleções</title></rect>`;});
  for(const[v,color,label]of[[reference,'#7bdcba','Filtro'],[data.meanCDIBRL,'#f4c467','CDI'],[0,'#aebfd2','Caixa']])
    svg+=`<line x1="${X(v)}" x2="${X(v)}" y1="${T}" y2="${H-B}" stroke="${color}" stroke-width="2.5"><title>${label}: ${esc(money(v))}</title></line>`;
  for(let i=0;i<=4;i++){const v=lo+(hi-lo)*i/4;svg+=`<text x="${X(v)}" y="${H-B+24}" text-anchor="${i===0?'start':i===4?'end':'middle'}" fill="#b2c3d8" font-size="12">${esc(money(v))}</text>`;}
  svg+=`<text x="${W/2}" y="${H-8}" text-anchor="middle" fill="#b2c3d8" font-size="12">Líquido mensal médio · altura = quantidade de seleções</text>`;
  $('histogram').innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Distribuição das médias mensais aleatórias, filtro, CDI e caixa">${svg}</svg>`;
}
function render(data){
  complete=true;clearTimeout(timer);const c=data.comparison,g=data.controlSummary.cost_gate;
  $('status').textContent='Comparação concluída · 200 seleções preservadas';
  $('progress').value=1000;$('progress-note').textContent='1.000 avaliações mensais concluídas, incluindo repetições idênticas.';
  $('summary').textContent=`Cinco meses de desenvolvimento já consumidos. R$ 1.000 por carteira mensal independente. Resultado em ${new Date(data.completedAt).toLocaleString('pt-BR')}. Nenhum filtro aplicado ao bot.`;
  $('metrics').innerHTML=[['Filtro · média mensal',money(c.referenceBRL)],['Acaso · mediana mensal',money(c.medianBRL)],['Percentil do filtro',number(c.referencePercentile)],['Acaso igualou ou superou',c.randomAtLeastAsGood+'/'+c.replicates]].map(([k,v])=>`<article><span>${esc(k)}</span><strong>${esc(v)}</strong></article>`).join('');
  $('distribution-note').textContent=`O filtro ficou no percentil ${number(c.referencePercentile)}. ${c.randomAtLeastAsGood} das ${c.replicates} seleções aleatórias o igualaram ou superaram (${percent(c.randomAtLeastAsGoodFraction)}). A faixa central simulada foi ${money(c.q025BRL)} a ${money(c.q975BRL)}. Isso não é uma probabilidade de lucro nem um teste formal de significância.`;
  $('references').innerHTML=[['Sem filtro',data.controlSummary.control.meanMonthlyBRL],['Filtro ATR/custo',c.referenceBRL],['Acaso · média das 200 médias mensais',c.meanBRL],['Acaso · mediana',c.medianBRL],['Acaso · mínimo',c.minimumBRL],['Acaso · máximo',c.maximumBRL],['Caixa sem rendimento',0],['CDI bruto médio',data.meanCDIBRL]].map(([k,v])=>`<tr><td>${esc(k)}</td><td>${money(v)}</td></tr>`).join('');
  $('months').innerHTML=data.monthly.map(m=>`<tr><td>${esc(m.month)}</td><td>${m.accepted}/${m.signals}</td><td>${money(m.referenceBRL)}</td><td>${money(m.medianBRL)}</td><td>${money(m.q025BRL)} a ${money(m.q975BRL)}</td><td>${money(m.cdiBRL)}</td><td>${m.uniqueSubsets}/${c.replicates}</td></tr>`).join('');
  const fields={trades:['Operações executadas',number],exposureHours:['Horas expostas',number],feesBRL:['Taxas totais das cinco carteiras',money],meanDD:['Queda máxima média',percent]};
  $('activity').innerHTML=Object.entries(fields).map(([key,[label,fmt]])=>{const d=data.diagnostics[key];return`<tr><td>${label}</td><td>${fmt(d.gate)}</td><td>${fmt(d.min)}</td><td>${fmt(d.median)}</td><td>${fmt(d.max)}</td></tr>`;}).join('');
  $('replicates').innerHTML=data.replicates.map(r=>`<tr><td>${r.seed}</td><td>${money(r.meanMonthlyBRL)}</td><td>${money(c.referenceBRL-r.meanMonthlyBRL)}</td><td>${r.trades}</td><td>${r.aboveCDI}/5</td><td>${r.losingMonths}/5</td><td>${number(r.exposureHours)}</td></tr>`).join('');
  $('conclusion-title').textContent=c.referenceAboveCentralEnvelope?'O filtro foi incomum dentro deste sorteio condicionado.':'Não apareceu uma seleção incomum frente ao acaso.';
  $('conclusion').textContent=`O filtro teve média ${money(c.referenceBRL)}, e o acaso teve mediana ${money(c.medianBRL)}. ${c.referenceAboveCentralEnvelope?'O filtro ficou acima do percentil 97,5 das simulações, mas isso permanece uma observação retrospectiva em históricos consumidos.':'O resultado do filtro não ficou acima do percentil 97,5 das simulações. Não demonstramos uma seleção excepcional além da redução de atividade sob este controle.'} Ele continua negativo, com ${g.trades} operações e ${g.aboveCDI}/5 meses acima do CDI. Nenhuma aprovação.`;
  $('verification').textContent=`Dez carteiras de referência reproduzidas exatamente. ${data.randomWallets} avaliações mensais nas 200 seleções; ${data.uniqueWalletSimulations} simulações distintas executadas, incluindo referências. Subconjuntos idênticos reutilizam resultados determinísticos, mantendo todas as ocorrências na distribuição. Isso economiza CPU sem escolher sementes.`;
  $('protocol').textContent=JSON.stringify(data.protocol,null,2);histogram(data);$('results').hidden=false;
}
async function refresh(){
  try{
    const r=await fetch('../data/entry-random.json',{cache:'no-store'});
    if(r.ok){const data=await r.json();if(data.app!=='trend-lab-entry-random')throw Error('Identidade inválida');render(data);return;}
    const s=await fetch('../data/entry-random-status.json',{cache:'no-store'});
    if(!s.ok)throw Error('Estado da comparação indisponível');const status=await s.json();
    $('status').textContent=status.phase==='error'?'Execução interrompida por erro':'Comparação em execução';
    $('progress').value=status.completedWallets;$('progress-note').textContent=`${status.completedWallets}/${status.totalWallets} avaliações mensais · ${status.activeWorkers} processos ativos. Sem novo treino.`;
    if(status.phase==='error')throw Error(status.error);$('error').textContent='';
  }catch(e){$('error').textContent=e.message;}
  if(!complete)timer=setTimeout(refresh,6000);
}
refresh();
