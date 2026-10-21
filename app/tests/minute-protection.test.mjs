import test from 'node:test';import assert from 'node:assert/strict';
import {read} from '../scripts/multiasset-io.mjs';import {Market} from '../scripts/exit-lab-core.mjs';
import {createResearchAccount} from '../scripts/protection-gate-engine.mjs';
import {singlePosition} from '../scripts/protection-gate-core.mjs';
import {minuteProtectionAction,MinuteProtectionMarket} from '../scripts/minute-protection-core.mjs';
const p={...read('work/pepe-protection-gate-v1/protocol.json').engine,protectionGate:'current'},market=new Market(),cost=p.costCases.find(c=>c.id==='stress'),start=Date.UTC(2024,0,1);
function setup(){const a=createResearchAccount({start,until:start+180000,protocol:p,cost,filters:market.filters,agentMode:true,stopContext:[]});a.queueEntry(1,.0001,start,15);return a;}
function consume(a,at,open,close=open,low=Math.min(open,close)-.000001){const r=[at,open,Math.max(open,close)+.000001,low,close,100000];a.consume({candles:[r],marks:[r],funding:[]});}
test('extra minute decision requests lock only after a known profitable close, never a partial',()=>{
 const a=setup();consume(a,start,.01,.0102);const s=a.state();assert.equal(minuteProtectionAction(s,start+60000,p,cost,market.filters),6);
 assert.equal(minuteProtectionAction({...s,at:start+300000},start+300000,p,cost,market.filters),null);
 a.queueAction(6,start+60000);consume(a,start+60000,.0102,.01021);consume(a,start+120000,.01021);
 const r=a.finish();assert.equal(r.partialExits,0);assert.ok(r.trades[0].stopHistory.every(v=>v.effectiveAt>=start+60000));assert.equal(r.decisions[0].action,6);
});
test('an opening gap through the original stop still loses despite an earlier positive close',()=>{
 const a=setup();consume(a,start,.01,.0102);a.queueAction(minuteProtectionAction(a.state(),start+60000,p,cost,market.filters),start+60000);
 consume(a,start+60000,.0097);consume(a,start+120000,.0097);const r=a.finish();assert.ok(r.pnl<0);assert.equal(r.trades[0].reason,'Stop');assert.equal(r.stopMoves,0);assert.equal(r.decisions[0].reason,'Gap atravessou o stop');
});
test('a profitable high with an unprofitable close does not activate protection',()=>{
 const a=setup(),r=[start,.01,.0104,.00999,.01,100000];a.consume({candles:[r],marks:[r],funding:[]});assert.equal(minuteProtectionAction(a.state(),start+60000,p,cost,market.filters),null);
});
test('flat state, partial stage, stale data and off-grid time cannot introduce another action',()=>{
 const a=setup();assert.equal(minuteProtectionAction(a.state(),start+60000,p,cost,market.filters),null);
 consume(a,start,.01,.0102);const s=a.state();assert.throws(()=>minuteProtectionAction(s,start+120000,p,cost,market.filters),/Noncausal/);assert.throws(()=>minuteProtectionAction(s,start+60001,p,cost,market.filters),/Non-minute/);
 assert.equal(minuteProtectionAction({...s,position:{...s.position,ladderStage:2}},start+60000,p,cost,market.filters),6);
});
test('one-minute streaming control reproduces the old full opportunity without any extra request',()=>{
 const m=read('work/pepe-protection-gate-v1/protocol.json').months[0],f=read('work/pepe-r-ladder-v1/grids/'+m.month+'.json').rows.find(v=>v.at===Date.UTC(2024,3,12,17,30)),mm=new MinuteProtectionMarket(p),old=read('work/pepe-protection-gate-v1/pairs/'+m.month+'.json').rows.find(r=>r.at===f.at&&r.side===1);
 const actual=singlePosition(f,1,m.end,p,mm,mm.contexts(m.start,m.end));assert.deepEqual(actual,old.current);assert.equal(mm.requests,0);
});
