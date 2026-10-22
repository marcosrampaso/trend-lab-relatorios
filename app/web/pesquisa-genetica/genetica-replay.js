import{MINUTE,closedCandles,visibleEvents,positionAt}from'./especialistas-replay-core.js';import{money,esc}from'./pepe-study-chart.js';
const $=id=>document.getElementById(id),num=x=>Number(x).toLocaleString('pt-BR'),price=x=>Number(x).toFixed(7),date=t=>new Date(t).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}),kinds={entry:'Entrada',exit:'Saída','partial-exit':'Parcial','stop-update':'Stop atualizado'};
let packet,wallet,at,timer=null,index;let serial=0;
async function json(url){const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw Error('Dados ainda indisponíveis');return r.json();}
function pause(){clearInterval(timer);timer=null;$('play').textContent='▶ Reproduzir';}
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

function render(){if(!wallet||!packet)return;const p=positionAt(wallet,at),events=visibleEvents(wallet,at);$('clock').textContent=date(at);$('timeline').value=(at-packet.start)/MINUTE;$('state').textContent=p?`${p.side===1?'Compra':'Venda'} aberta · entrada ${price(p.entry)} · stop ${price(p.stop)} · quantidade ${num(p.qty)}`:'Em caixa neste instante';$('events').innerHTML=events.slice(-25).reverse().map(e=>`<p><b>${esc(kinds[e.kind]??e.kind)}</b> · ${esc(date(e.at))}${e.price?' · '+price(e.price):''}${e.stop?' · stop '+price(e.stop):''}${e.leg?' · líquido '+money(e.leg.net*5):''}${e.reason?' · '+esc(e.reason):''}</p>`).join('')||'<p>Nenhum evento revelado ainda.</p>';plot();}
function setTime(t){at=Math.min(packet.end,Math.max(packet.start,t));render();if(at===packet.end)pause();}
async function load(){pause();const n=++serial;try{const month=$('month').value;wallet=index.wallets.find(w=>w.month===month);packet=await json('/data/genetic-replay/'+month+'.json');packet.start??=Date.parse(month+'-01T00:00:00Z');packet.end??=new Date(new Date(packet.start).setUTCMonth(new Date(packet.start).getUTCMonth()+1)).getTime();if(packet.candles[0][0]!==packet.start||packet.candles.at(-1)[0]+MINUTE!==packet.end)throw Error('Limites do mês não conferem com os candles');if(n!==serial)return;$('timeline').max=(packet.end-packet.start)/MINUTE;$('trade').innerHTML=wallet.trades.length?wallet.trades.map((t,i)=>`<option value="${i}">#${i+1} · ${esc(date(t.entryAt))} · ${t.side===1?'Compra':'Venda'} · ${money(t.net*5)}</option>`).join(''):'<option>Sem operações neste mês</option>';$('entry').disabled=$('exit').disabled=!wallet.trades.length;$('note').textContent=`Campeão ${index.championID} · G${index.championGeneration} · ${wallet.count} posições neste mês · ${money(wallet.pnlBRL)} líquidos. Arquivo atualizado ${date(index.updatedAt)}. Histórico, sem ordens reais.`;$('error').textContent='';setTime((wallet.trades[0]?.entryAt??packet.start+15*MINUTE)-10*MINUTE);}catch(e){$('error').textContent=e.message;}}
$('month').onchange=load;$('entry').onclick=()=>{pause();setTime(wallet.trades[Number($('trade').value)].entryAt-10*MINUTE);};$('exit').onclick=()=>{pause();setTime(wallet.trades[Number($('trade').value)].exitAt+MINUTE);};$('step').onclick=()=>{pause();setTime(at+MINUTE*Number($('interval').value));};$('play').onclick=()=>{if(timer){pause();return;}$('play').textContent='⏸ Pausar';timer=setInterval(()=>setTime(at+MINUTE*Number($('interval').value)),180);};$('timeline').oninput=()=>{pause();setTime(packet.start+Number($('timeline').value)*MINUTE);};$('interval').onchange=render;window.addEventListener('pagehide',pause);window.addEventListener('resize',()=>wallet&&plot());
async function refresh(){try{const v=await json('/data/genetic-replay/index.json');if(index?.championID===v.championID&&index?.source===v.source)return;index=v;const prior=$('month').value;$('month').innerHTML=v.wallets.map(w=>`<option value="${w.month}">${w.month} · ${w.count} posições</option>`).join('');$('month').value=v.wallets.some(w=>w.month===prior)?prior:([...v.wallets].reverse().find(w=>w.count>0)??v.wallets.at(-1)).month;await load();}catch(e){$('error').textContent=e.message;}}
refresh();setInterval(refresh,20000);
