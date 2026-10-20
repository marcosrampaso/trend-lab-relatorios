(()=>{
 const $=s=>document.querySelector(s),money=x=>x.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}),num=x=>x.toLocaleString('pt-BR',{maximumFractionDigits:3}),date=x=>new Date(x).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}),regimes={trend:'Tendência',range:'Lateralização',volatile:'Volatilidade alta'},families={cross:'EMA',bands:'Bollinger + RSI',vwap:'VWAP'};
 document.querySelectorAll('[data-print]').forEach(b=>b.addEventListener('click',()=>window.print()));
 const search=$('[data-generation-search]');if(search)search.addEventListener('input',()=>{const value=search.value.trim();document.querySelectorAll('#geracoes tbody tr').forEach(r=>r.hidden=value!==''&&r.cells[0].textContent!==value);});
 const source=$('#ledger-data');if(!source)return;
 try{
  const trades=JSON.parse(source.textContent),filters=['cost','month','regime','side'];
  function render(){
   const chosen=Object.fromEntries(filters.map(k=>[k,$('#trade-'+k).value])),result=$('#trade-result').value,rows=trades.filter(t=>filters.every(k=>chosen[k]===''||String(t[k])===chosen[k])&&(result===''||(result==='loss'?t.net<0:t.net>0)));
   $('#trade-ledger').replaceChildren(...rows.map(t=>{const tr=document.createElement('tr');const values=[date(t.entryAt),date(t.exitAt),regimes[t.regime],t.side===1?'Compra':'Venda',families[t.family],t.holdMinutes+' / '+num((t.exitAt-t.entryAt)/60000)+' min',Number.isFinite(t.score)?num(t.score):'Sem filtro',money(t.net*5),money((t.entryFee+t.exitFee)*5),money(t.slippageCost*5),money(t.funding*5),t.reason];for(const v of values){const td=document.createElement('td');td.textContent=v;tr.append(td);}return tr;}));
   $('#ledger-summary').textContent=rows.length+' operações · contribuição líquida '+money(rows.reduce((n,t)=>n+t.net*5,0))+' · '+(chosen.cost==='stress'?'custos dobrados':'custos base');
   $('#ledger-status').textContent=rows.length?'Filtros mostram contribuições das operações originais; não reexecutam uma carteira alternativa.':'Nenhuma operação corresponde aos filtros selecionados.';
  }
  for(const k of [...filters,'result'])$('#trade-'+k).addEventListener('change',render);render();
 }catch{$('#ledger-status').textContent='Não foi possível montar a tabela. O CSV continua disponível para download.';}
})();
