import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {fullHistoryPlan,assertWindow,identify,validateGenome,assess,choose,random,mutate} from '../scripts/genetic-validation-v6-core.mjs';
import {simulateAdaptive as baseEngine} from '../web/research-adaptive-funding.js';
import {simulateAdaptive as allocationEngine} from '../web/research-allocation-v5.js';
const read=file=>JSON.parse(fs.readFileSync(new URL('../'+file,import.meta.url))),source=read('work/expanded-validation/g151-fixed-funding-v2/registration.json'),p=read('genetic-validation-v6-protocol.json'),baseline=identify({...source.genome,risk:.01,leverage:10,predictor:'rf_g151'});
test('all eligible history is used; warmup, gaps and reserve are not fabricated',()=>{
 const plan=fullHistoryPlan(source.plan.testMonths);assert.equal(plan.folds.length,9);assert.equal(plan.nestedMonths,26);assert.equal(plan.excluded.length,21);assert.equal(plan.folds[0].id,'2024-07');assert.deepEqual(plan.folds.at(-1).outerMonths,['2026-07','2026-08']);
 for(const fold of plan.folds){assert.equal(fold.innerMonths.length,12);assert.ok(fold.innerEnd<fold.outerStart);assert.ok(!fold.innerMonths.includes('2026-09'));assert.throws(()=>assertWindow(fold,'inner',fold.outerStart,fold.outerEnd));assert.throws(()=>assertWindow(fold,'outer',fold.outerStart,fold.outerEnd));assertWindow(fold,'outer',fold.outerStart,fold.outerEnd,{fold:fold.id,registrationSHA256:'registered'});}
});
test('allocation mutations stay in authorized grid; predictor and labels cannot be swapped',()=>{
 const rng=random(9);let g=baseline;for(let i=0;i<1000;i++){g=mutate(g,rng);validateGenome(g,baseline);assert.ok(g.risk<=.2&&g.leverage<=20);}
 assert.throws(()=>validateGenome(identify({...baseline,risk:.21}),baseline));assert.throws(()=>validateGenome(identify({...baseline,params:{...baseline.params,max_depth:99}}),baseline));
 assert.throws(()=>validateGenome(identify({...baseline,routes:{...baseline.routes,trend:{family:'cross',hold:240,threshold:.4}}}),baseline));
});
const blocks=(profits=[30,40,50,60])=>profits.map(pnlBRL=>({base:{pnlBRL,count:15,maxDD:.02,halted:false},stress:{pnlBRL,count:15,maxDD:.02,halted:false},cdi:{available:true,profitBRL:20}}));
test('profitable aggregate alone is insufficient; coverage, CDI, drawdown and halts all gate selection',()=>{
 assert.ok(assess(blocks(),p.criteria).eligible);assert.equal(choose([{genome:baseline,metrics:assess(blocks([-100,100,100,100]),p.criteria)}])?.genome.id,baseline.id);
 const concentrated=blocks([-50,-50,-50,300]);assert.ok(!assess(concentrated,p.criteria).eligible);
 const few=blocks();few[0].stress.count=0;assert.ok(!assess(few,p.criteria).eligible);
 const stopped=blocks();stopped[0].stress.halted=true;assert.ok(!assess(stopped,p.criteria).eligible);
 const bad=assess(blocks([-20,-20,-20,-20]),p.criteria);assert.equal(bad.stressBRL,-80);assert.equal(choose([{genome:baseline,metrics:bad}]),null);
 assert.throws(()=>assess(blocks().map(r=>({...r,cdi:{available:false}})),p.criteria));
});
test('unchanged allocation reproduces corrected engine; high-risk research does not change operational engine',()=>{
 const start=Date.parse('2025-01-01T00:00:00Z'),candles=Array.from({length:4},(_,i)=>[start+i*60000,2000,2001,1999,2000,10]),data={candles,marks:candles.map(r=>r.slice(0,5)),funding:[[start+1,.0001]],filters:read('web/data/scalping-market.json').filters},strategy={...read('scalping-protocol.json'),capitalBRL:1000},signal={at:start,side:1,atr:10,target:null,context:{},family:'cross',knownAt:start,holdMinutes:120,entryAllowed:true},opts={start,until:start+4*60000,protocol:strategy,signals:[signal],closeAtEnd:true};
 assert.deepEqual(allocationEngine(data,opts),baseEngine(data,opts));assert.doesNotThrow(()=>allocationEngine(data,{...opts,protocol:{...strategy,risk:.2,leverage:20}}));assert.throws(()=>baseEngine(data,{...opts,protocol:{...strategy,risk:.2,leverage:20}}));assert.throws(()=>allocationEngine(data,{...opts,protocol:{...strategy,risk:.21,leverage:20}}));
});
