export const MINUTE=60000;
export function closedCandles(rows,at,minutes=1){
 if(![1,5,15].includes(minutes))throw Error('Intervalo inválido');
 const complete=rows.filter(r=>r[0]+MINUTE<=at);
 if(minutes===1)return complete;
 const buckets=new Map(),width=minutes*MINUTE;
 for(const r of complete){const start=Math.floor(r[0]/width)*width;let b=buckets.get(start);
  if(!b){b={rows:[],c:[start,r[1],r[2],r[3],r[4],0]};buckets.set(start,b);}
  b.rows.push(r);b.c[2]=Math.max(b.c[2],r[2]);b.c[3]=Math.min(b.c[3],r[3]);b.c[4]=r[4];b.c[5]+=r[5];}
 return [...buckets.values()].filter(b=>b.rows.length===minutes&&b.rows.every((r,i)=>r[0]===b.c[0]+i*MINUTE)&&b.c[0]+width<=at).map(b=>b.c);
}
export function visibleEvents(wallet,at){return wallet.events.filter(e=>e.knownAt<=at);}
export function positionAt(wallet,at){
 let pos=null;
 for(const e of visibleEvents(wallet,at)){
  if(e.kind==='entry')pos={side:e.side,entry:e.price,qty:e.initialQty,stop:e.initialStop,tradeIndex:e.tradeIndex};
  else if(e.kind==='stop-update'&&pos)pos.stop=e.stop;
  else if(e.kind==='partial-exit'&&pos)pos.qty-=e.qty;
  else if(e.kind==='exit')pos=null;
 }
 return pos;
}
export function decisionAt(row,arm,threshold=.1){
 const [family,seed]=arm.system.split('-'),long=row.experts[family+'-1-'+seed],short=row.experts[family+'--1-'+seed];
 const available=[{side:1,p:long},{side:-1,p:short}].filter(x=>arm.mode==='combined'||(arm.mode==='long'?x.side===1:x.side===-1));
 const passed=available.filter(x=>x.p.eligible&&x.p.netR>threshold).sort((a,b)=>b.p.netR-a.p.netR);
 const tie=passed.length===2&&Math.abs(passed[0].p.netR-passed[1].p.netR)<1e-8;
 const side=tie?0:passed[0]?.side??0;
 return{side,long,short,reason:side?(side===1?'Compra aprovada':'Venda aprovada'):tie?'Caixa · empate entre os lados':available.every(x=>!x.p.eligible)?'Caixa · política recusou entrada':'Caixa · expectativa calibrada não supera 0,1R'};
}
export function nextTime(times,at,end){return times.find(t=>t>at)??end;}
