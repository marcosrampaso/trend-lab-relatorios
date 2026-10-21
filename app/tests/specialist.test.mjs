import test from 'node:test';import assert from 'node:assert/strict';
import {entryChoice,featureInput,candleFeatures} from '../scripts/specialist-core.mjs';
import {candidateOutcome} from '../scripts/specialist-core.mjs';
import {Market} from '../scripts/exit-lab-core.mjs';
import {read} from '../scripts/multiasset-io.mjs';
test('specialists may choose either direction or cash; ties do not force exposure',()=>{
  assert.equal(entryChoice(.2,.15),1);assert.equal(entryChoice(.15,.3),-1);
  assert.equal(entryChoice(-1,-2),0);assert.equal(entryChoice(.1,.1),0);
  assert.equal(entryChoice(.3,.3),0);assert.equal(entryChoice(.3,.5,'long'),1);
  assert.equal(entryChoice(.3,.5,'short'),-1);
  assert.throws(()=>entryChoice(NaN,1),/Nonfinite/);
});
test('fixed exit wrapper reproduces an already-frozen source position from equal initial state',()=>{
  const packet=read('work/pepe-exits-v1/sources/2024-04.json'),entry=packet.entries[0];
  assert.equal(entry.before.cash,200);assert.equal(entry.before.dayStart,200);
  const market=new Market(),p=read('work/pepe-exits-v1/protocol.json');
  const f=market.context(entry.trade.entryAt),raw=market.packet(f.at),i=(f.at-raw.start)/60000;
  const feature=candleFeatures(f,raw.candles.slice(i-5,i));
  const r=candidateOutcome(feature,entry.trade.side,entry.end,{...p,leverage:entry.trade.leverage},market,market.contexts(f.at,entry.end));
  const old=read('work/pepe-entry-audit-v1/result.json').rules.ladder_lock.positions.find(r=>r.id===entry.id);
  assert.ok(Math.abs(r.netBRL-old.netBRL)<1e-7);assert.equal(r.exitAt,old.trade.exitAt);
});
test('only closed finite input features enter an expert',()=>{
  const f={at:100,knownAt:100,atr:1,close:10,x:Array(19).fill(.1)};
  assert.deepEqual(featureInput(f,100),f.x);assert.notEqual(featureInput(f,100),f.x);
  assert.throws(()=>featureInput({...f,knownAt:101},100),/future/);
  assert.throws(()=>featureInput({...f,x:[NaN]},100),/future/);
});
test('candle shape uses exactly five already-closed minutes',()=>{
  const at=300000,f={at,knownAt:at,atr:2,close:10,x:Array(15).fill(0)};
  const rows=Array.from({length:5},(_,i)=>[i*60000,9,11,8,10,1]);
  const result=candleFeatures(f,rows);assert.equal(result.x.length,19);
  assert.deepEqual(result.x.slice(-4),[.5,.5,.5,1.5]);
  assert.throws(()=>candleFeatures(f,[...rows.slice(1),[at,9,50,1,10,1]]),/Unclosed/);
});
