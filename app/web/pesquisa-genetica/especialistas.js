import {money,percent,esc,plot} from './pepe-study-chart.js';
const $=id=>document.getElementById(id),modes={long:'Só compras',short:'Só vendas',combined:'Combinados'};
let finalData,metadata,timer;
const side=key=>key.includes('--1-')?'Venda':'Compra';
function title(key){return(key.startsWith('genetic')?'Genética':'PPO')+' · '+side(key)+' · '+key.split('-').at(-1);}
function showWallet(){
  const row=finalData?.results[$('arm').value]?.wallets.find(w=>w.month===$('month').value);if(!row)return;
  plot($('wallet'),[{name:'Especialistas',color:'#7bdcba',points:row.curve.map(p=>({x:p.at,y:p.brl}))},{name:'CDI bruto',color:'#f4c467',points:row.cdi.curve.map(p=>({x:p.at,y:p.brl}))}],{time:true,label:'Carteira mensal de especialistas e CDI bruto'});
  $('wallet-note').textContent=`${row.month}: líquido ${money(row.pnlBRL)}, CDI ${money(row.cdi.pnlBRL)}, ${row.count} operações. Sinais propostos ${row.sourceEntryCount}; limites impediram ${row.riskSkips}, sobreposição ignorou ${row.overlapSkips}.`;
}
function months(){
  const w=finalData?.results[$('arm').value]?.wallets??[];
  $('month').innerHTML=w.map(w=>`<option>${esc(w.month)}</option>`).join('');showWallet();
}
function fitnessChart(histories){
  const lines=[['genetic-1-151','#7bdcba'],['genetic--1-151','#8cbaff']],W=960,H=260,L=70,R=20,T=20,B=38;
  const all=lines.flatMap(([k])=>histories[k]??[]);if(!all.length)return;
  const lo=Math.min(0,...all.map(r=>r.fitness)),hi=Math.max(.001,...all.map(r=>r.fitness));
  const X=g=>L+g/19*(W-L-R),Y=v=>T+(hi-v)/(hi-lo||1)*(H-T-B);let svg='';
  for(let i=0;i<4;i++){const v=lo+(hi-lo)*i/3;svg+=`<line x1="${L}" x2="${W-R}" y1="${Y(v)}" y2="${Y(v)}" stroke="#34485e"/><text x="${L-9}" y="${Y(v)+4}" text-anchor="end" fill="#b2c3d8" font-size="12">${v.toFixed(4)}</text>`;}
  for(const[k,color]of lines){const h=histories[k]??[];svg+=`<path fill="none" stroke="${color}" stroke-width="2.8" d="${h.map((r,i)=>(i?'L':'M')+X(r.generation)+','+Y(r.fitness)).join(' ')}"/>`;}
  for(const g of[0,10,19])svg+=`<text x="${X(g)}" y="${H-8}" text-anchor="middle" fill="#b2c3d8" font-size="12">G${g}</text>`;
  $('generations').innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Fitness genético de treino por geração, não rentabilidade">${svg}</svg>`;
}
async function refresh(){
  try{
    const s=await fetch('../data/specialists-status.json',{cache:'no-store'});if(!s.ok)throw Error('Piloto ainda indisponível');const status=await s.json();
    const r=await fetch('../data/specialists-progress.json',{cache:'no-store'});if(r.ok)metadata=await r.json();
    const phase={labels:'Preparando exemplos',training:'Treinando especialistas',evaluating:'Avaliando carteiras',complete:'Piloto concluído · nenhuma promoção automática',error:'Piloto interrompido por erro',registered:'Protocolo registrado'};
    $('status').textContent=phase[status.phase]??status.phase;
    $('status-note').textContent=`${status.labels}/${status.months} meses preparados · ${status.jobs.filter(j=>j.phase==='complete').length}/6 especialistas finalizados · ${status.activeWorkers} processos ativos · atualizado ${new Date(status.updatedAt).toLocaleString('pt-BR')}.`;
    $('jobs').innerHTML=status.jobs.map(j=>{const m=metadata?.metrics?.[j.key];return`<tr><td>${esc(title(j.key))}</td><td>${esc(j.phase)}</td><td>${j.phase==='complete'?'Concluído':j.generation!==undefined?j.generation+'/20 gerações':j.steps!==undefined?j.steps+'/32.768 passos':'Aguardando'}</td><td>${m?m.trainRows+' / '+m.calibrationRows:'—'}</td></tr>`;}).join('');
    if(metadata){$('protocol').textContent=JSON.stringify(metadata.protocol,null,2);fitnessChart(metadata.histories);}
    if(status.phase==='error')throw Error(status.error??'Verifique o registro local');
    if(status.phase==='complete'){
      const result=await fetch('../data/specialists.json',{cache:'no-store'});if(!result.ok)throw Error('Resultado final ainda não publicado');finalData=await result.json();
      $('metrics').innerHTML=[['Especialistas concluídos','6'],['Genética por lado','48 × 20'],['PPO por especialista','32.768 passos'],['Carteiras avaliadas','45']].map(([k,v])=>`<article><span>${k}</span><strong>${v}</strong></article>`).join('');
      $('results').innerHTML=Object.entries(finalData.results).map(([key,v])=>`<tr><td>${esc(v.system)}</td><td>${modes[v.mode]}</td><td>${money(v.meanMonthlyBRL)}</td><td>${v.aboveCDI}/5</td><td>${v.losingMonths}/5</td><td>${v.zeroTradeMonths}/5</td><td>${v.count}</td><td>${percent(v.meanDD)}</td></tr>`).join('');
      $('result-note').textContent='Todos os nove braços finais estão publicados, incluindo meses sem ordens. Resultados retrospectivos; nenhum campeão foi aprovado.';
      $('ppo-note').textContent=`Média das duas sementes PPO, sem escolher a melhor: compras ${money(finalData.ppoMean.long)}, vendas ${money(finalData.ppoMean.short)}, combinação ${money(finalData.ppoMean.combined)} por carteira mensal.`;
      $('arm').innerHTML=Object.entries(finalData.results).map(([k,v])=>`<option value="${k}">${esc(v.system+' · '+modes[v.mode])}</option>`).join('');months();$('error').textContent='';return;
    }
    $('error').textContent='';
  }catch(e){$('error').textContent=e.message;}
  timer=setTimeout(refresh,5000);
}
$('arm').onchange=months;$('month').onchange=showWallet;refresh();
