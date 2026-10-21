import test from 'node:test';import assert from 'node:assert/strict';
import {read,hash} from '../scripts/multiasset-io.mjs';
const base='work/pepe-minute-protection-v1',r=read(base+'/result.json'),reg=read(base+'/registration.json'),rows=r.protocol.months.flatMap(m=>read(base+'/pairs/'+m.month+'.json').rows),signals=read(r.protocol.signalsParent+'/signals.json');
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
test('registered science and frozen ancestors are unchanged; all controls reproduced',()=>{
 assert.equal(hash(base+'/protocol.json'),reg.protocolSHA256);for(const[f,h]of Object.entries({...reg.inputs,...reg.sourceHashes}))assert.equal(hash(f),h,f);
 assert.equal(r.parity,23408);assert.equal(r.walletParity,32);assert.equal(r.train,false);assert.equal(r.independentValidation,false);assert.equal(r.automaticPromotion,false);assert.equal(r.realOrders,false);
});
test('all pairs retain identical entry fills, reconcile net costs and report every conversion',()=>{
 assert.equal(rows.length,23408);assert.equal(new Set(rows.map(v=>v.at+':'+v.side)).size,rows.length);
 for(const v of rows){assert.deepEqual(v.current.identity,v.minute.identity);close(v.deltaR,v.minute.netR-v.current.netR);for(const arm of r.protocol.arms){const a=v[arm];close(a.grossBRL-a.feesBRL+a.fundingBRL,a.netBRL);}}
 for(const[stage,value]of Object.entries(r.stages))for(const side of[1,-1]){const a=rows.filter(v=>v.stage===stage&&v.side===side),s=value.sides[side];assert.equal(a.length,s.count);close(s.minute.meanNetR,a.reduce((n,v)=>n+v.minute.netR,0)/a.length);assert.equal(s.lossToProfit,a.filter(v=>v.current.netR<0&&v.minute.netR>0).length);assert.equal(s.profitToLoss,a.filter(v=>v.current.netR>0&&v.minute.netR<0).length);assert.equal(s.better+s.worse+s.equal,s.count);}
});
test('monthly wallet accounts, frozen entry calendars, target schedule and CDI reconcile',()=>{
 let count=0;for(const[key,arms]of Object.entries(r.wallets))for(const[arm,value]of Object.entries(arms))for(const w of value.wallets){count++;close(w.trades.reduce((n,t)=>n+t.net*r.protocol.engine.fx,0),w.pnlBRL);assert.equal(w.initialBRL,1000);assert.ok(w.cdi.comparable);assert.equal(w.sourceEntryCount,signals[key][w.month].length);
  for(const t of w.trades){assert.equal(t.entryAt%300000,0);for(const leg of t.legs)if(leg.reason.startsWith('Escada'))assert.equal(leg.exitAt%300000,0);}
  for(let i=1;i<w.trades.length;i++)assert.ok(w.trades[i].entryAt>=w.trades[i-1].exitAt);
 }assert.equal(count,64);
});
