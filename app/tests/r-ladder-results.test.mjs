import test from'node:test';import assert from'node:assert/strict';import{read,hash}from'../scripts/multiasset-io.mjs';
const base='work/pepe-r-ladder-v1',r=read(base+'/result.json'),reg=read(base+'/registration.json'),rows=r.protocol.months.flatMap(m=>read(base+'/pairs/'+m.month+'.json').rows),signals=read(base+'/signals.json');
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
test('all source models, old engines and scientific inputs remain frozen',()=>{
 assert.equal(hash(base+'/protocol.json'),reg.protocolSHA256);for(const[f,h]of Object.entries({...reg.inputs,...reg.sourceHashes}))assert.equal(hash(f),h,f);
 assert.equal(hash(base+'/signals.json'),r.integrity.signalsSHA256);assert.equal(r.train,false);assert.equal(r.realOrders,false);
 assert.equal(r.parity,14582);assert.equal(r.walletParity,20);
});
test('every paired actual fill is identical and no out-of-calendar outcome enters a stage',()=>{
 assert.equal(rows.length,r.totalPairs);const unique=new Set();for(const o of rows){
  unique.add(o.at+':'+o.side);const m=r.protocol.months.find(m=>m.month===o.month);assert.equal(o.stage,m.stage);assert.ok(o.at>=m.start&&o.at<m.end);
  assert.deepEqual(o.margin.identity,o.priceRisk.identity);close(o.priceRisk.netR-o.margin.netR,o.deltaR);close(o.priceRisk.netBRL-o.margin.netBRL,o.deltaBRL);
  for(const arm of r.protocol.arms){const a=o[arm];assert.ok(a.exitAt<=m.end);close(a.grossBRL-a.feesBRL+a.fundingBRL,a.netBRL);}
 }assert.equal(unique.size,rows.length);
});
test('monthly wallets keep frozen signals, own balances, risk blocks and correct CDI',()=>{
 for(const[key,arms]of Object.entries(r.wallets))for(const[arm,a]of Object.entries(arms))for(const w of a.wallets){
  assert.equal(w.sourceEntryCount,signals[key][w.month].length);assert.equal(w.initialBRL,1000);assert.equal(w.cdi.comparable,true);
  close(w.trades.reduce((s,t)=>s+t.net*r.protocol.engine.fx,0),w.pnlBRL);close(w.grossBRL-w.feesBRL+w.fundingBRL,w.pnlBRL);
  for(let i=1;i<w.trades.length;i++)assert.ok(w.trades[i].entryAt>=w.trades[i-1].exitAt);
 }
});
test('fixed chronological stages and reported no-trade means reconcile with pair outcomes',()=>{
 for(const[stage,data]of Object.entries(r.stages))for(const side of['1','-1']){
  const selected=rows.filter(o=>o.stage===stage&&o.side===Number(side)),s=data.sides[side];assert.equal(s.count,selected.length);
  for(const arm of r.protocol.arms)close(s[arm].meanNetR,selected.reduce((n,o)=>n+o[arm].netR,0)/selected.length);
  assert.equal(s.better+s.worse+s.equal,selected.length);
 }
 const display=read('web/data/r-ladder-display.json');assert.equal(display.sourceSHA256,hash(base+'/result.json'));
 assert.equal(display.stages.pairedDiagnostic.unchanged,rows.filter(r=>r.stage==='pairedDiagnostic'&&Math.abs(r.deltaR)<=1e-9).length);
});
