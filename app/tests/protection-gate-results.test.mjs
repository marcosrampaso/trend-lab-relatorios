import test from'node:test';import assert from'node:assert/strict';import{read,hash}from'../scripts/multiasset-io.mjs';
const base='work/pepe-protection-gate-v1',r=read(base+'/result.json'),reg=read(base+'/registration.json'),rows=r.protocol.months.flatMap(m=>read(base+'/pairs/'+m.month+'.json').rows),signals=read(r.protocol.parent+'/signals.json');
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
test('frozen ancestors, entry signals and new scientific sources are unchanged',()=>{
 assert.equal(hash(base+'/protocol.json'),reg.protocolSHA256);for(const[f,h]of Object.entries({...reg.inputs,...reg.sourceHashes}))assert.equal(hash(f),h,f);
 assert.equal(r.parity,23408);assert.equal(r.walletParity,32);assert.equal(r.train,false);assert.equal(r.realOrders,false);
});
test('all paired fills are identical and treatment never protects before actual partial',()=>{
 assert.equal(rows.length,r.totalPairs);const unique=new Set();for(const pair of rows){unique.add(pair.at+':'+pair.side);
  assert.deepEqual(pair.current.identity,pair.afterFirstPartial.identity);close(pair.deltaR,pair.afterFirstPartial.netR-pair.current.netR);
  const next=pair.afterFirstPartial;assert.equal(next.protectedBeforePartial,false);
  if(next.firstProtectionAt!==null){assert.ok(next.firstPartialAt!==null);assert.ok(next.firstProtectionAt>=next.firstPartialAt);}
  for(const arm of r.protocol.arms){const a=pair[arm];close(a.grossBRL-a.feesBRL+a.fundingBRL,a.netBRL);}
 }assert.equal(unique.size,rows.length);
});
test('monthly treatment stop histories respect successful partial events and accounts reconcile',()=>{
 for(const[key,arms]of Object.entries(r.wallets))for(const[arm,v]of Object.entries(arms))for(const w of v.wallets){
  close(w.trades.reduce((n,t)=>n+t.net*r.protocol.engine.fx,0),w.pnlBRL);assert.equal(w.initialBRL,1000);assert.ok(w.cdi.comparable);
  assert.equal(w.sourceEntryCount,signals[key][w.month].length);
  for(let i=1;i<w.trades.length;i++)assert.ok(w.trades[i].entryAt>=w.trades[i-1].exitAt);
  if(arm==='afterFirstPartial')for(const t of w.trades)if(t.stopHistory.length){assert.ok(t.legs.length>1);assert.ok(t.stopHistory.every(s=>s.effectiveAt>=t.legs[0].exitAt));}
 }
});
test('calendar summaries and profit-to-loss conversions match paired evidence',()=>{
 for(const[stage,v]of Object.entries(r.stages))for(const side of[1,-1]){const subset=rows.filter(p=>p.stage===stage&&p.side===side),s=v.sides[side];
  assert.equal(subset.length,s.count);for(const arm of r.protocol.arms)close(s[arm].meanNetR,subset.reduce((n,p)=>n+p[arm].netR,0)/subset.length);
  assert.equal(s.profitToLoss,subset.filter(p=>p.current.netR>0&&p.afterFirstPartial.netR<0).length);
  assert.equal(s.lossToProfit,subset.filter(p=>p.current.netR<0&&p.afterFirstPartial.netR>0).length);
  assert.equal(s.better+s.worse+s.equal,subset.length);
 }
});
