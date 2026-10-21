import test from 'node:test';
import assert from 'node:assert/strict';
import {costGate,partitionSignals} from '../scripts/entry-cost-gate-core.mjs';
const at=Date.UTC(2024,0,1), cost={fee:.001,slippage:.001};
const feature={at,knownAt:at,close:100,atr:1};
const filters=[{filterType:'PRICE_FILTER',tickSize:'.01'}];
test('estimated round trip charges both adverse fills and both fees for either side',()=>{
  for(const side of[1,-1]){
    const r=costGate({decisionAt:at,side,feature},cost,filters);
    assert.ok(Math.abs(r.frictionPerUnit-.4)<1e-10);
    assert.equal(r.allowed,true);
    assert.equal(costGate({decisionAt:at,side,feature:{...feature,atr:.5}},cost,filters).allowed,false);
  }
});
test('reject future, missing and stale features before accepting a signal',()=>{
  for(const f of[{...feature,knownAt:at+1},{...feature,at:at+1},
    {...feature,at:at-300000,knownAt:at-300000},{...feature,knownAt:undefined}])
    assert.throws(()=>costGate({decisionAt:at,side:1,feature:f},cost,filters),/Future\/stale/);
});
test('tick friction is adverse and cutoff is exactly the registered multiple',()=>{
  const r=costGate({decisionAt:at,side:1,feature:{...feature,close:100.005}},cost,filters);
  assert.ok(r.frictionPerUnit>.4);
  assert.equal(costGate({decisionAt:at,side:1,feature:{...feature,atr:r.frictionPerUnit*2,close:100.005}},cost,filters).allowed,true);
  assert.equal(costGate({decisionAt:at,side:1,feature:{...feature,atr:r.frictionPerUnit*2-1e-8,close:100.005}},cost,filters).allowed,false);
});
test('partition never reads realized returns, next open/fill or future excursions',()=>{
  const trade={entryAt:at,side:1};
  for(const key of['entry','entryReference','net','exitAt','exit','legs'])
    Object.defineProperty(trade,key,{get(){throw Error('Future outcome read');}});
  const entry={id:'a',month:'2024-01',split:'development',trade,atr:1};
  const packet={month:{month:'2024-01'},entries:[entry]};
  const market={filters,context(t){assert.equal(t,at);return feature;}};
  const r=partitionSignals(packet,market,{costCases:[{id:'stress',...cost}]});
  assert.equal(r.filtered.entries[0],entry);
  assert.equal(packet.entries.length,1);
  const lowRangePacket={...packet,entries:[{...entry,atr:.5}]};
  assert.equal(partitionSignals(lowRangePacket,{...market,context:()=>({...feature,atr:.5})},{costCases:[{id:'stress',...cost}]}).filtered.entries.length,0);
});
