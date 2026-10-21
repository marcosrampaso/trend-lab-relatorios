import{MINUTE,closedCandles,visibleEvents,positionAt,decisionAt,nextTime}from'./especialistas-replay-core.js';
const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=x=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(x),num=x=>new Intl.NumberFormat('pt-BR').format(x),price=x=>Number(x).toFixed(7),date=t=>new Date(t).toISOString().slice(0,19).replace('T',' ')+' UTC';
const names={'genetic-151':'Genética 151','ppo-101':'PPO 101','ppo-202':'PPO 202'},modes={long:'Compras',short:'Vendas',combined:'Combinados'};
const kinds={entry:'Entrada',exit:'Saída','partial-exit':'Parcial','stop-update':'Stop atualizado',rejected:'Entrada recusada',skipped:'Entrada ignorada','partial-rejected':'Parcial recusada',halt:'Limite global'};
let audit,packet,forecasts,wallet,arm,month,at,timer=null,loadToken=0;const cache=new Map();
async function json(url){const r=await fetch(url);if(!r.ok)throw Error('Não foi possível carregar '+url);return r.json();}
function cards(id,rows){$(id).innerHTML=rows.map(([a,b])=>`<article><span>${esc(a)}</span><strong>${esc(b)}</strong></article>`).join('');}
function pause() {clearInterval(timer);timer=null;$('play').textContent='▶ Reproduzir';}
function setTime(t){at=Math.min(month.end,Math.max(month.start,Math.round(t/MINUTE)*MINUTE));render();if(at>=month.end)pause();}
function plot(){
 const W=Math.max(300,Math.min(1040,$('candles').clientWidth)),H=W<600?430:520;
 const minutes=Number($('interval').value),width=minutes*MINUTE,rows=closedCandles(packet.candles,at,minutes).slice(W<600?-40:-100);
 if(!rows.length){$('candles').innerHTML='<p style="padding:30px">Aguardando o primeiro candle completo. Avance o relógio.</p>';return;}
 const L=78,R=16,T=25,B=H-140,V=H-60,lowT=rows[0][0],endT=rows.at(-1)[0]+width;
 const ev=visibleEvents(wallet,at),shown=ev.filter(e=>e.at>=lowT&&e.at<=endT&&['entry','partial-exit','exit','stop-update','rejected'].includes(e.kind));
 const extra=shown.flatMap(e=>[e.price??e.stop]).filter(Number.isFinite),position=positionAt(wallet,at);
 if(position)extra.push(position.entry,position.stop);
 for(const e of ev.filter(e=>e.kind==='entry')){const exit=ev.find(x=>x.kind==='exit'&&x.tradeIndex===e.tradeIndex);if((exit?.at??at)>=lowT&&e.at<=endT)extra.push(e.initialStop,e.price);}
 const lo=Math.min(...rows.map(r=>r[3]),...extra),hi=Math.max(...rows.map(r=>r[2]),...extra),pad=Math.max((hi-lo)*.12,hi*.0001),min=lo-pad,max=hi+pad;
 const x=t=>L+(t-lowT)/(endT-lowT)*(W-L-R),y=p=>B-(p-min)/(max-min)*(B-T),vol=Math.max(...rows.map(r=>r[5]),1),bw=Math.max(2,(W-L-R)/rows.length*.62);
 let svg=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${rows.length} candles fechados, ${minutes} minuto(s), com ordens e volume"><rect width="${W}" height="${H}" fill="#101b29"/>`;
 for(let i=0;i<=4;i++){const p=min+(max-min)*i/4,yy=y(p);svg+=`<path d="M${L} ${yy}H${W-R}" stroke="#293b50"/><text x="8" y="${yy+4}" fill="#aebfd2" font-size="13">${price(p)}</text>`;}
 for(const r of rows){const xx=x(r[0]+width/2),color=r[4]>=r[1]?'#7bdcba':'#ff9388',top=y(Math.max(r[1],r[4])),bottom=y(Math.min(r[1],r[4]));
  svg+=`<g><title>${date(r[0])} · ${minutes}m\nA ${price(r[1])} · M ${price(r[2])} · m ${price(r[3])} · F ${price(r[4])}\nVolume ${num(r[5])}</title><path d="M${xx} ${y(r[2])}V${y(r[3])}" stroke="${color}"/><rect x="${xx-bw/2}" y="${top}" width="${bw}" height="${Math.max(1,bottom-top)}" fill="${color}"/><rect x="${xx-bw/2}" y="${V-r[5]/vol*55}" width="${bw}" height="${Math.max(.5,r[5]/vol*55)}" fill="${color}" opacity=".45"/></g>`;
 }
 // Reconstruct the stop trajectory from confirmed events only; never use final stop in the ledger.
 for(const [i,t]of wallet.trades.entries()){
  const entry=ev.find(e=>e.kind==='entry'&&e.tradeIndex===i);if(!entry||t.entryAt>endT)continue;
  const exit=ev.find(e=>e.kind==='exit'&&e.tradeIndex===i),finish=Math.min(endT,exit?.at??at),changes=ev.filter(e=>e.kind==='stop-update'&&e.tradeIndex===i);
  const levels=[{at:t.entryAt,stop:entry.initialStop},...changes];
  for(let j=0;j<levels.length;j++){const s=levels[j],start=Math.max(lowT,s.at),end=Math.min(finish,levels[j+1]?.effectiveAt??finish);if(end<=start)continue;
   svg+=`<path d="M${x(start)} ${y(s.stop)}H${x(end)}" stroke="#bba6ff" stroke-dasharray="6 4" stroke-width="2"><title>Stop efetivo ${price(s.stop)}</title></path>`;
  }
  if(finish>lowT)svg+=`<path d="M${x(Math.max(lowT,t.entryAt))} ${y(entry.price)}H${x(finish)}" stroke="#8cbaff" stroke-dasharray="2 4" opacity=".65"/>`;
 }
 for(const e of shown){const xx=x(Math.min(endT-width/2,Math.max(lowT+width/2,Math.floor(e.at/width)*width+width/2))),yy=y(e.price??e.stop??rows.find(r=>r[0]<=e.at&&r[0]+width>e.at)?.[4]??rows.at(-1)[4]);
  const color=e.kind==='entry'?(e.side===1?'#7bdcba':'#ff9388'):e.kind==='stop-update'?'#bba6ff':e.kind==='rejected'?'#ff9388':'#f4c467';
  const symbol=e.kind==='entry'?(e.side===1?'▲':'▼'):e.kind==='stop-update'?'●':e.kind==='rejected'?'×':'◆';
  svg+=`<text x="${xx}" y="${yy-9}" text-anchor="middle" font-size="21" font-weight="700" fill="${color}" stroke="#101b29" stroke-width=".5"><title>${esc(kinds[e.kind])} · ${date(e.at)}\n${esc(e.reason??'')} · ${price(e.price??e.stop??0)}</title>${symbol}</text>`;
 }
 svg+=`<text x="${L}" y="${V+21}" fill="#aebfd2" font-size="13">Volume</text>`;
 const timeLabels=W<600?[[lowT,'start'],[endT,'end']]:[[lowT,'start'],[lowT+(endT-lowT)/2,'middle'],[endT,'end']];
 for(const [t,anchor]of timeLabels)svg+=`<text x="${x(t)}" y="${H-15}" text-anchor="${anchor}" fill="#aebfd2" font-size="13">${new Date(t).toISOString().slice(5,16).replace('T',' ')}</text>`;
 $('candles').innerHTML=svg+'</svg>';
}
function render(){
 $('clock').textContent=date(at);$('timeline').value=(at-month.start)/MINUTE;
 const events=visibleEvents(wallet,at),pos=positionAt(wallet,at),legs=events.filter(e=>e.leg),net=legs.reduce((s,e)=>s+e.leg.net*audit.fx,0);
 cards('state',[['Estado da posição',pos?(pos.side===1?'Compra aberta':'Venda aberta'):'Em caixa'],['Quantidade restante',pos?num(pos.qty)+' contratos':'0'],['Stop efetivo agora',pos?price(pos.stop)+' USDT':'—'],['Líquido das realizações confirmadas',money(net)]]);
 const known=forecasts.filter(f=>f.at<=at),last=known.at(-1);
 if(last){const d=decisionAt(last,arm,audit.threshold);$('last-decision').textContent=date(last.at)+' · '+d.reason;
  $('scores').textContent=[['Compra',d.long],['Venda',d.short]].map(([label,p])=>`${label}: política ${p.eligible?'aceita':'recusa'}; expectativa calibrada ${p.netR.toFixed(3)}R`).join(' · ');
  if(arm.mode!=='combined')$('scores').textContent+=' · Só '+modes[arm.mode].toLowerCase()+' participam desta variante.';
  if(d.side){const orderEvent=events.find(e=>e.at===last.at&&['entry','rejected','skipped'].includes(e.kind));$('last-decision').textContent+=' · '+(orderEvent?(kinds[orderEvent.kind]+(orderEvent.reason?': '+orderEvent.reason:'')):'aprovação do sinal; aguardando confirmação da execução');}
 }else{$('last-decision').textContent='Nenhuma oportunidade alcançada neste mês.';$('scores').textContent='As decisões surgem a cada 30 minutos, usando dados já fechados.';}
 $('events').innerHTML=events.length?events.slice(-35).reverse().map(e=>`<p><b>${esc(kinds[e.kind]??e.kind)}</b> · ${esc(date(e.at))}${e.price?' · '+price(e.price)+' USDT':''}${e.stop?' · stop '+price(e.stop):''}${e.qty?' · '+num(e.qty)+' contratos':''}${e.reason?' · '+esc(e.reason):''}${e.leg?' · líquido desta realização '+money(e.leg.net*audit.fx):''}</p>`).join(''):'<p>Sem eventos de execução até este instante. Use “Próxima decisão” para ver o modelo avaliar uma oportunidade.</p>';
 $('event').disabled=!wallet.events.some(e=>e.knownAt>at);$('decision').disabled=!forecasts.some(f=>f.at>at);$('step').disabled=at>=month.end;plot();
}
function diagnostics(){
 const all=Object.values(audit.arms),means=all.filter(a=>a.mode==='combined'),ppo=means.filter(a=>a.system.startsWith('ppo'));
 const first=Object.values(means[0].months),cdi=first.reduce((s,w)=>s+w.cdi.pnlBRL,0)/first.length;
 cards('summary',[['Genética · líquido mensal médio',money(means.find(a=>a.system==='genetic-151').meanMonthlyBRL)],['PPO · média dos dois seeds',money(ppo.reduce((s,a)=>s+a.meanMonthlyBRL,0)/ppo.length)],['CDI bruto · média dos mesmos meses',money(cdi)],['Carteiras reproduzidas sem diferença',audit.parityWallets+' / 45']]);
 $('experts').innerHTML=Object.values(audit.experts).map(e=>`<tr><td>${e.family==='genetic'?'Genética':'PPO'} ${e.seed} · ${e.side===1?'compra':'venda'}</td><td>${num(e.total)}</td><td>${num(e.policyEligible)}</td><td>${num(e.calibrationVeto)}</td><td>${num(e.accepted)}</td></tr>`).join('');
 $('integrity').textContent='Integridade: os 45 resumos foram reproduzidos com igualdade exata de ordens, custos, saldo, curva, stops e contagens. Pesos, previsões e fontes registradas foram verificados por SHA-256 antes e depois; nenhum treino novo foi executado.';
}
function monthDiagnostics(){
 const a=wallet;cards('funnel',[['Horários avaliados',num(a.long.total)],['Compras · aceitas / após calibração',`${a.long.policyEligible} / ${a.long.accepted}`],['Vendas · aceitas / após calibração',`${a.short.policyEligible} / ${a.short.accepted}`],['Sinais escolhidos → posições',`${a.sourceEntryCount} → ${a.count}`]]);
 $('funnel-title').textContent='Funil de '+month.month+' · '+names[arm.system]+' · '+modes[arm.mode];
 $('execution-note').textContent=`${a.rejected} entradas recusadas, ${a.skipped} ignoradas pelo motor, ${a.overlapSkips} sinais com posição já aberta, ${a.riskSkips} bloqueios de risco. Resultado retrospectivo completo: ${money(a.pnlBRL)}; CDI ${money(a.cdi.pnlBRL)}.`+(a.rejectedReasons.length?' Motivos: '+[...new Set(a.rejectedReasons.map(e=>e.reason))].join('; ')+'.':'');
}
async function load(){
 pause();const token=++loadToken;const controlIds=['trade','go-trade','trade-end','play','step','decision','event','reset','timeline','interval'];for(const id of controlIds)$(id).disabled=true;$('error').textContent='Carregando candles e previsões…';
 try{arm=audit.arms[$('arm').value];month=audit.months.find(m=>m.month===$('month').value);wallet=arm.months[month.month];
  const wanted=month.month;
  if(!cache.has(wanted))cache.set(wanted,await Promise.all([json('/data/specialist-replay/'+wanted+'.json'),json('/data/specialist-replay/'+wanted+'-decisions.json')]));
  if(token!==loadToken)return;[packet,forecasts]=cache.get(wanted);for(const id of controlIds)$(id).disabled=false;
  $('timeline').max=(month.end-month.start)/MINUTE;$('trade').innerHTML=wallet.trades.length?wallet.trades.map((t,i)=>`<option value="${i}">#${i+1} · ${date(t.entryAt)} · ${t.side===1?'Compra':'Venda'}</option>`).join(''):'<option>Nenhuma operação neste mês</option>';
  for(const id of ['trade','go-trade','trade-end'])$(id).disabled=!wallet.trades.length;
  $('month-note').textContent=`${month.month} · ${wallet.sourceEntryCount} sinais escolhidos, ${wallet.count} posições preenchidas. `+(wallet.count?'Use a operação arquivada para navegar antes da entrada ou até sua saída.':'Não há ordens para reproduzir; os candles e as decisões de ficar em caixa continuam visíveis.');
  monthDiagnostics();$('error').textContent='';
  const initial=wallet.trades[0]?.entryAt??wallet.rejectedReasons[0]?.at??month.start+30*MINUTE;
  setTime(Math.max(month.start,initial-10*MINUTE));
  const url=new URL(location.href);url.searchParams.set('arm',$('arm').value);url.searchParams.set('month',month.month);history.replaceState(null,'',url);
 }catch(e){$('error').textContent=e.message;}
}
$('play').onclick=()=>{if(timer){pause();return;}if(at>=month.end)setTime(month.start);$('play').textContent='⏸ Pausar';timer=setInterval(()=>setTime(at+MINUTE*Number($('interval').value)*Number($('speed').value)),250);};
$('step').onclick=()=>{pause();setTime(at+MINUTE*Number($('interval').value));};
$('decision').onclick=()=>{pause();setTime(nextTime(forecasts.map(f=>f.at),at,month.end));};
$('event').onclick=()=>{pause();setTime(nextTime([...new Set(wallet.events.map(e=>e.knownAt))].sort((a,b)=>a-b),at,month.end));};
$('reset').onclick=()=>{pause();setTime(month.start);};$('timeline').oninput=()=>{pause();setTime(month.start+Number($('timeline').value)*MINUTE);};
$('go-trade').onclick=()=>{pause();setTime(wallet.trades[Number($('trade').value)].entryAt-10*MINUTE);};
$('trade-end').onclick=()=>{pause();const i=Number($('trade').value),events=wallet.events.filter(e=>e.kind==='exit'&&e.tradeIndex===i);setTime(events.at(-1).knownAt);};
$('interval').onchange=()=>{pause();render();};$('arm').onchange=load;$('month').onchange=load;window.addEventListener('pagehide',pause);window.addEventListener('resize',()=>{if(packet)plot();});
try{audit=await json('/data/specialist-replay/index.json');const params=new URL(location.href).searchParams;
 $('arm').innerHTML=Object.entries(audit.arms).map(([k,a])=>`<option value="${k}">${names[a.system]} · ${modes[a.mode]}</option>`).join('');
 $('month').innerHTML=audit.months.map(m=>`<option>${m.month}</option>`).join('');
 $('arm').value=audit.arms[params.get('arm')]?params.get('arm'):'genetic-151-combined';if(audit.months.some(m=>m.month===params.get('month')))$('month').value=params.get('month');diagnostics();await load();
}catch(e){$('error').textContent=e.message;}
