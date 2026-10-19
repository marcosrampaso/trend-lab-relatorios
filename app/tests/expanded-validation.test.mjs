import test from 'node:test';import assert from 'node:assert/strict';
import {planHistory,tradeStats,auditTrades} from '../scripts/expanded-validation-common.mjs';
import {monthAt} from '../web/scalp-tree.js';
const months=(first,n)=>Array.from({length:n},(_,i)=>new Date(monthAt(first,i)).toISOString().slice(0,7));
test('gaps restart warmup/training; reserved September never enters test blocks',()=>{
 const p=planHistory([...months('2020-02',10),...months('2021-01',18),...months('2022-08',50)]);
 assert.equal(p.segments.length,3);assert.equal(p.testMonths.length,47);assert.equal(p.blocks.length,16);
 assert.equal(p.segments[0].test.length,0);assert.equal(p.testMonths[0],'2021-11');assert.equal(p.testMonths.at(-1),'2026-08');
 for(const b of p.blocks){assert.equal(monthAt(b.trainStart,9),monthAt(b.trainEnd));assert.equal(b.trainEnd,b.months[0]);assert.ok(b.months.length<=3);assert.ok(!b.months.includes('2026-09'));}
});
test('money reconciliation and holding violations fail rather than publish success',()=>{
 const t={net:2,entryAt:0,exitAt:120*60000,holdMinutes:120};auditTrades({position:null,trades:[t],pnl:2});
 assert.throws(()=>auditTrades({position:null,trades:[t],pnl:3}));
 assert.throws(()=>auditTrades({position:null,trades:[{...t,exitAt:121*60000}],pnl:2}));
});
test('slippage remains embedded in gross, and is not subtracted twice from net',()=>{
 const ts=[{net:7,gross:10,entryFee:1,exitFee:2,slippageCost:4,funding:0,entryAt:0,exitAt:60000},{net:-2,gross:-1,entryFee:.5,exitFee:.5,slippageCost:.2,funding:0,entryAt:0,exitAt:120000}];
 const s=tradeStats(ts);assert.equal(s.netBRL,25);assert.equal(s.feesBRL,20);assert.equal(s.slippageBRL,21);assert.equal(s.grossAfterSlippageBRL,45);assert.equal(s.profitFactor,3.5);
});
