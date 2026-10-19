import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {fundingBuckets} from '../web/research-funding-buckets.js';
import {simulateAdaptive as legacy} from '../web/adaptive-engine.js';
import {simulateAdaptive as corrected} from '../web/research-adaptive-funding.js';
import {simulateScalpTree} from '../web/research-scalp-funding.js';
const read=file=>JSON.parse(fs.readFileSync(new URL('../'+file,import.meta.url)));
const protocol={...read('scalping-protocol.json'),capitalBRL:1000},start=Date.parse('2025-01-01T00:00:00Z'),until=start+4*60000;
const candles=Array.from({length:4},(_,i)=>[start+i*60000,2000,2001,1999,2000,10]);
const data=funding=>({candles,marks:candles.map(r=>r.slice(0,5)),funding,filters:read('web/data/scalping-market.json').filters});
const signal={at:start,side:1,atr:10,target:null,context:{},family:'cross',knownAt:start,holdMinutes:120,entryAllowed:true};
const options={start,until,protocol,cost:protocol.costCases[0],signals:[signal],closeAtEnd:true};
test('funding keeps exact timestamp classification, rate and exclusive end boundary',()=>{
 const r=fundingBuckets([[start,.001],[start+60001,-.002],[until,.5]],start,until);
 assert.equal(r.before.get(start),.001);assert.equal(r.after.get(start+60000),-.002);assert.equal(r.before.size,1);
 assert.throws(()=>fundingBuckets([[start,.001],[start+1,.002]],start,until));
});
test('no funding and exactly minute-aligned funding preserve frozen engine outputs',()=>{
 for(const events of [[],[[start+60000,.001]]])assert.deepEqual(corrected(data(events),options),legacy(data(events),options));
});
test('subminute payment after entry is charged; legacy omission is reproduced explicitly',()=>{
 const events=[[start+1,.001]],r=corrected(data(events),options),old=legacy(data(events),options);
 assert.equal(old.fundingNet,0);assert.equal(r.trades.length,1);
 const expected=-r.trades[0].qty*2000*.001;assert.equal(r.fundingNet,expected);assert.equal(r.trades[0].funding,expected);
 assert.ok(Math.abs(r.pnl-(old.pnl+expected))<1e-10);
 assert.ok(Math.abs(r.pnl-r.trades.reduce((n,t)=>n+t.net,0))<1e-10);
});
test('payment after an opening exit is not charged to the closed position',()=>{
 const exit={...signal,at:start+60000,knownAt:start+60000,side:-1,entryAllowed:false};
 assert.equal(corrected(data([[start+60001,.001]]),{...options,signals:[signal,exit]}).fundingNet,0);
 assert.ok(corrected(data([[start+60000,.001]]),{...options,signals:[signal,exit]}).fundingNet<0);
});
test('labels and portfolio use the same corrected payment sequence',()=>{
 const events=[[start+1,.001]],result=simulateScalpTree(data(events),{...options,strategy:'cross',protocol:{...protocol,maxHoldMinutes:120},prepared:{signals:{cross:[signal]}},entryFilter:()=>null});
 assert.equal(result.fundingNet,corrected(data(events),options).fundingNet);
 assert.equal(result.pnl,corrected(data(events),options).pnl);
});
