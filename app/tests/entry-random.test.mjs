import test from 'node:test';
import assert from 'node:assert/strict';
import {randomSubset,quantile,compareRandom,summarizeReplicate} from '../scripts/entry-random-core.mjs';
test('matched subsets are reproducible, without replacement, independent of input order',()=>{
  const entries=Array.from({length:20},(_,i)=>({id:'entry-'+i}));
  const a=randomSubset(entries,7,10001,'2024-04');
  assert.equal(a.length,7);assert.equal(new Set(a.map(e=>e.id)).size,7);
  assert.deepEqual(a,randomSubset(entries,7,10001,'2024-04'));
  assert.deepEqual(a.map(e=>e.id).sort(),randomSubset(entries.slice().reverse(),7,10001,'2024-04').map(e=>e.id).sort());
  assert.notDeepEqual(a,randomSubset(entries,7,10002,'2024-04'));
  assert.deepEqual(entries.map(e=>e.id),Array.from({length:20},(_,i)=>'entry-'+i));
});
test('assignment never reads market, future return or trade fields',()=>{
  const entries=Array.from({length:10},(_,i)=>({id:String(i),get trade(){throw Error('Future data read');},get net(){throw Error('Future data read');}}));
  assert.equal(randomSubset(entries,3,10001,'2024-04').length,3);
  assert.equal(randomSubset(entries,0,10001,'2024-04').length,0);
  assert.equal(randomSubset(entries,10,10001,'2024-04').length,10);
  assert.throws(()=>randomSubset(entries,11,10001,'2024-04'),/sample size/);
  assert.throws(()=>randomSubset([{id:'x'},{id:'x'}],1,10001,'2024-04'),/Duplicate/);
});
test('distribution uses all observations, interpolated quantiles and half ties',()=>{
  const values=[-10,-2,-2,6];const r=compareRandom(values,-2);
  assert.equal(quantile(values,.5),-2);assert.equal(r.meanBRL,-2);
  assert.equal(r.referencePercentile,50);assert.equal(r.randomAtLeastAsGood,3);
  assert.equal(r.monteCarloUpperTailWithPlusOne,4/5);
  assert.equal(r.envelopeIsConfidenceInterval,false);assert.equal(r.formalPValue,false);
  assert.throws(()=>quantile([],0),/Invalid/);
});
test('zero-trade months remain in the mean; missing or duplicate months fail',()=>{
  const w=(month,pnlBRL,count)=>({month,pnlBRL,count,cdi:{pnlBRL:1},maxDD:0,feesBRL:0,grossBRL:pnlBRL,fundingBRL:0,riskSkips:0,overlapSkips:0,avgHoldHours:count?2:null});
  const a=w('a',-10,1),b=w('b',0,0),r=summarizeReplicate([a,b],['a','b']);
  assert.equal(r.meanMonthlyBRL,-5);assert.equal(r.zeroTradeMonths,1);assert.equal(r.exposureHours,2);
  assert.throws(()=>summarizeReplicate([a],['a','b']),/calendar/);
  assert.throws(()=>summarizeReplicate([a,a],['a','b']),/calendar/);
});
