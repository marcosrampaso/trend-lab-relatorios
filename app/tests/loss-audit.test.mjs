import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {attribution,potentialTargetNet,modelVetoMinutes,priceExcursions} from '../scripts/loss-audit-core.mjs';
import {simulateAdaptive} from '../web/research-allocation-v5.js';
const p=JSON.parse(fs.readFileSync(new URL('../scalping-protocol.json',import.meta.url))),start=Date.UTC(2025,0,1),M=60000;
test('cost attribution reconciles fills without subtracting slippage twice',()=>{
 const t={side:1,qty:2,entryReference:100,exitReference:102,entry:100.1,exit:101.9,entryFee:.2,exitFee:.2,funding:.1,gross:3.6,slippageCost:.4,net:3.3};const r=attribution([t]);assert.ok(Math.abs(r.referenceGrossBRL-r.slippageBRL-r.feesBRL+r.fundingBRL-r.netBRL)<1e-9);assert.ok(Math.abs(r.netBRL-16.5)<1e-9);
});
test('a geometrically valid target can still realize a net loss; existing engine has no net-cost target floor',()=>{
 const candles=Array.from({length:2},(_,i)=>[start+i*M,100,100.2,99.9,100.1,10]),data={candles,marks:candles.map(r=>r.slice(0,5)),funding:[],filters:[]},signal={at:start,knownAt:start,family:'bands',side:1,atr:1,target:100.1,entryAllowed:true,holdMinutes:240},cost=p.costCases[1];
 const r=simulateAdaptive(data,{start,until:start+2*M,protocol:{...p,capitalBRL:1000},signals:[signal],cost,closeAtEnd:true});assert.equal(r.trades.length,1);assert.equal(r.trades[0].reason,'Alvo');assert.ok(r.trades[0].net<0);assert.ok(potentialTargetNet(r.trades[0],cost)<0);
});
test('telemetry recovers router veto minutes even when legacy summary says zero',()=>{assert.equal(modelVetoMinutes({vetoes:0,reasons:{'Roteador/modelo vetou nova entrada':42}}),42);});
test('excursion audit excludes unknown ordering inside the exit candle and flags stop plus target ambiguity',()=>{
 const t={side:1,entryAt:start,exitAt:start+2*M,entryReference:100,entry:100,stop:99,target:102,reason:'Stop',holdMinutes:4},rows=[[start,100,100.5,99.5,100],[start+M,100,103,98,99],[start+2*M,99,102,98,101],[start+3*M,101,104,100,102]];const r=priceExcursions(t,rows);assert.equal(r.mfeBeforeExitBarR,.5);assert.equal(r.ambiguousExitBar,true);assert.equal(r.targetReachedAfterExit,true);assert.equal(r.postExitCoveredMinutes,2);
});
