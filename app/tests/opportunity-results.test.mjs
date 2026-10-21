// Post-run reconciliation; intentionally outside the frozen scientific implementation.
import test from 'node:test';import assert from 'node:assert/strict';
import{read,hash}from'../scripts/multiasset-io.mjs';
const base='work/pepe-opportunity-v1',r=read(base+'/result.json'),p=r.protocol,reg=read(base+'/registration.json');
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
test('all frozen input and scientific-source hashes remain unchanged',()=>{
 assert.equal(hash(base+'/protocol.json'),reg.protocolSHA256);
 for(const [f,h]of Object.entries({...reg.inputs,...reg.sourceHashes}))assert.equal(hash(f),h,f);
 assert.equal(r.parity,30);assert.equal(r.realOrders,false);assert.equal(r.retrained,false);
});
test('every grid timestamp has both sides and cost attribution never double-counts slippage',()=>{
 let count=0;for(const m of p.months){const rows=read(base+'/months/'+m.month+'.json').rows,grid=read(p.origin+'/labels/'+m.month+'.json').rows;
  assert.equal(rows.length,grid.length*2);const unique=new Set();for(const o of rows){assert.ok(o.at>=m.start&&o.at<m.end);unique.add(o.at+':'+o.side);
   close(o.referenceGrossBRL-o.slippageBRL-o.feesBRL+o.fundingBRL,o.netBRL);
   if(!o.filled){close(o.netBRL,0);assert.ok(o.unfilledReason);}
  }assert.equal(unique.size,rows.length);count+=rows.length;
 }assert.equal(count,r.total);assert.equal(Object.values(r.feasibility).reduce((s,v)=>s+v,0),r.total);
});
test('regime partitions and month summaries include every opportunity once per side',()=>{
 for(const side of['1','-1']){
  const overall=r.sides[side];assert.equal(overall.count,r.months.reduce((s,m)=>s+m.sides[side].count,0));
  for(const values of Object.values(r.groups))assert.equal(values.reduce((s,v)=>s+v.sides[side].count,0),overall.count);
  close(overall.meanNetR,r.months.reduce((s,m)=>s+m.sides[side].count*m.sides[side].meanNetR,0)/overall.count);
 }
});
test('controls use continuous monthly wallets, reconcile BRL and retain no-trade cash',()=>{
 for(const[k,c]of Object.entries(r.controls)){
  assert.equal(c.wallets.length,5);close(c.meanMonthlyBRL,c.wallets.reduce((s,w)=>s+w.pnlBRL,0)/5);
  for(const w of c.wallets){close(w.trades.reduce((s,t)=>s+t.net*p.engine.fx,0),w.pnlBRL);close(w.grossBRL-w.feesBRL+w.fundingBRL,w.pnlBRL);
   assert.equal(w.initialBRL,1000);assert.equal(w.cdi.comparable,true);
   const sorted=w.trades.slice().sort((a,b)=>a.entryAt-b.entryAt);for(let i=1;i<sorted.length;i++)assert.ok(sorted[i].entryAt>=sorted[i-1].exitAt);
   if(k==='cash'){assert.equal(w.count,0);close(w.pnlBRL,0);}
  }
 }
});
test('calibration remains read-only with exact acceptance coverage and complete fixed bins',()=>{
 assert.equal(r.calibration.fitPerformed,false);
 for(const j of p.jobs){const m=r.calibration.models[j.key],pred=read(p.origin+'/models/'+j.key+'/predictions.json').predictions;
  const accepted=pred.filter(x=>x.eligible&&x.netR>p.threshold);assert.equal(accepted.length,m.accepted.count);
  assert.ok(m.parityMaxDifference<=1e-5);assert.equal(m.bins.reduce((s,b)=>s+b.calibration.count,0),m.calibrationRows);
  assert.equal(m.bins.reduce((s,b)=>s+b.evaluation.count,0),pred.length);
 }
 assert.equal(r.accepted.length,Object.values(r.calibration.models).reduce((s,m)=>s+m.accepted.count,0));
});
