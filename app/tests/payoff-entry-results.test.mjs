import test from 'node:test';import assert from 'node:assert/strict';import {read,hash} from '../scripts/multiasset-io.mjs';import {entryChoice} from '../scripts/specialist-core.mjs';
const base='work/pepe-payoff-entry-v1',r=read(base+'/result.json'),p=r.protocol,reg=read(base+'/registration.json'),close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
test('no frozen scientific input changed and models remain research only',()=>{
 assert.equal(hash(base+'/protocol.json'),reg.protocolSHA256);for(const[f,h]of Object.entries({...reg.inputs,...reg.sourceHashes}))assert.equal(hash(f),h,f);
 assert.equal(r.integrity.walletParity,32);assert.equal(r.independentValidation,false);assert.equal(r.realOrders,false);assert.equal(r.automaticPromotion,false);assert.equal(Object.keys(r.models).length,4);
});
test('all six policies use only the registered forecasts and fixed threshold',()=>{
 let count=0;for(const family of p.families){const forecasts=Object.fromEntries(p.sides.map(side=>[side,new Map(read(base+'/models/'+family+'-'+side+'/predictions.json').predictions.map(v=>[v.at,v.netR]))]));
  for(const mode of p.modes)for(const m of p.months){const grid=read(p.gridsParent+'/grids/'+m.month+'.json').rows,entries=grid.filter(f=>entryChoice(forecasts[1].get(f.at),forecasts[-1].get(f.at),mode,p.threshold)!==0),w=r.results[family+'-'+mode].wallets.find(v=>v.month===m.month);count++;
   assert.equal(w.sourceEntryCount,entries.length);for(const t of w.trades){assert.ok(entries.some(e=>e.at===t.entryAt));assert.equal(t.side,entryChoice(forecasts[1].get(t.entryAt),forecasts[-1].get(t.entryAt),mode,p.threshold));}
  }
 }assert.equal(count,48);
});
test('all monthly accounts and CDI include zero trades and reconcile without compounding resets',()=>{
 for(const policy of Object.values(r.results)){assert.equal(policy.wallets.length,8);for(const w of policy.wallets){assert.equal(w.initialBRL,1000);assert.ok(w.cdi.comparable);close(w.trades.reduce((n,t)=>n+t.net*p.engine.fx,0),w.pnlBRL);close(w.grossBRL-w.feesBRL+w.fundingBRL,w.pnlBRL);}
  for(const[stage,s]of Object.entries(policy.stages)){const a=policy.wallets.filter(w=>w.stage===stage);assert.equal(s.months,a.length);close(s.meanMonthlyBRL,a.reduce((n,w)=>n+w.pnlBRL,0)/a.length);assert.equal(s.aboveCDI,a.filter(w=>w.pnlBRL>w.cdi.pnlBRL).length);assert.equal(s.zeroTradeMonths,a.filter(w=>w.count===0).length);}
 }
});
