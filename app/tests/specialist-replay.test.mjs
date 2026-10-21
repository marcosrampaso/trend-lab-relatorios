import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import{MINUTE,closedCandles,visibleEvents,positionAt,decisionAt,nextTime}from'../web/pesquisa-genetica/especialistas-replay-core.js';
const root=new URL('../',import.meta.url),read=p=>JSON.parse(fs.readFileSync(new URL(p,root))),audit=read('web/data/specialist-replay/index.json');
test('one-minute candles and aggregated OHLC cannot reveal unclosed candles',()=>{
 const rows=Array.from({length:10},(_,i)=>[i*MINUTE,10+i,12+i,9+i,11+i,100]);
 assert.equal(closedCandles(rows,MINUTE-1).length,0);
 assert.equal(closedCandles(rows,5*MINUTE-1,5).length,0);
 assert.deepEqual(closedCandles(rows,5*MINUTE,5),[[0,10,16,9,15,500]]);
 assert.equal(closedCandles(rows.filter((_,i)=>i!==2),5*MINUTE,5).length,0);
 assert.equal(closedCandles(rows,10*MINUTE-1,5).length,1);
});
test('all 45 archived wallets have exact exported ledger and rejection parity',()=>{
 const original=read('work/pepe-specialists-v1/result.json');assert.equal(audit.parityWallets,45);
 for(const [key,arm]of Object.entries(original.results))for(const w of arm.wallets){const copy=audit.arms[key].months[w.month];
  for(const[k,v]of Object.entries(w))assert.deepEqual(copy[k],v,key+' '+w.month+' '+k);
  assert.equal(copy.events.filter(e=>e.kind==='entry').length,w.count);
  assert.equal(copy.rejectedReasons.length,w.rejected+w.skipped);
  assert.ok(copy.events.every(e=>e.knownAt>=e.at));
 }
});
test('real entry, parities, moving stop and final exit are revealed in archived order',()=>{
 const w=audit.arms['genetic-151-combined'].months['2024-04'],t=w.trades[0],entry=w.events.find(e=>e.kind==='entry');
 assert.equal(positionAt(w,entry.knownAt-1),null);
 const initial=positionAt(w,entry.knownAt);assert.equal(initial.stop,t.initialStop);assert.equal(initial.qty,t.initialQty);
 for(const e of w.events.filter(e=>e.tradeIndex===0&&e.kind==='stop-update')){
  assert.ok(!visibleEvents(w,e.knownAt-1).includes(e));assert.equal(positionAt(w,e.knownAt).stop,e.stop);
 }
 const partial=w.events.find(e=>e.kind==='partial-exit');assert.equal(positionAt(w,partial.knownAt).qty,t.initialQty-partial.qty);
 const exit=w.events.find(e=>e.kind==='exit'&&e.tradeIndex===0);assert.ok(positionAt(w,exit.knownAt-1));assert.equal(positionAt(w,exit.knownAt),null);
 const net=visibleEvents(w,exit.knownAt).filter(e=>e.leg).reduce((s,e)=>s+e.leg.net*audit.fx,0);assert.ok(Math.abs(net-t.net*audit.fx)<1e-8);
});
test('no-trade months retain candles and explain policy versus calibration veto',()=>{
 const w=audit.arms['ppo-202-combined'].months['2024-07'];assert.equal(w.count,0);assert.equal(w.events.length,0);
 const rows=read('web/data/specialist-replay/2024-07-decisions.json'),arm=audit.arms['ppo-202-combined'];
 for(const r of rows)assert.equal(decisionAt(r,arm,audit.threshold).side,0);
 assert.equal(rows.length,w.long.total);assert.equal(read('web/data/specialist-replay/2024-07.json').candles.length,44640);
 const fake={experts:{'ppo-1-202':{eligible:true,netR:.05},'ppo--1-202':{eligible:false,netR:.8}}};
 assert.match(decisionAt(fake,arm).reason,/calibrada/);assert.equal(decisionAt(fake,arm).side,0);
 assert.equal(nextTime([5,10,15],10,20),15);assert.equal(nextTime([],10,20),20);
});
test('April PPO entry rejection is executable-risk incompatibility, not a missing order',()=>{
 const w=audit.arms['ppo-101-combined'].months['2024-04'];assert.equal(w.sourceEntryCount,2);assert.equal(w.count,0);
 assert.equal(w.rejectedReasons.length,2);assert.ok(w.rejectedReasons.every(e=>e.reason==='Stop além da liquidação estimada'));
});
