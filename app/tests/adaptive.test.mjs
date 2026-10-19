import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';
import{simulateAdaptive}from'../web/adaptive-engine.js';import{simulateScalpTree}from'../web/scalp-tree-engine.js';import{regimeFor,routedSignals}from'../web/adaptive-policy.js';
const read=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url))),p={...read('scalping-protocol.json'),capitalBRL:1000},start=Date.UTC(2025,3,1),M=60000;
const genome={volatilityCut:.002,trendCut:.7,routes:{trend:{family:'cross',hold:720,threshold:.4},range:{family:'bands',hold:30,threshold:.4},volatile:{family:null,hold:30,threshold:.4}}};
const feature=(at,x=[])=>({at,hourlyAt:at,fourHourlyAt:at,x:[1,.2,.001,0,0,0,1,1,1,1,.5,0].map((v,i)=>x[i]??v)});
function data(n=100){const candles=Array.from({length:n},(_,i)=>[start+i*M,2000,2001,1999,2000,10]);return{candles,marks:candles.map(r=>r.slice(0,5)),funding:[[start+15*M,.0001]],filters:read('web/data/scalping-market.json').filters};}
const sig=(minutes,family='cross',side=1,hold=30,entryAllowed=true)=>({at:start+minutes*M,knownAt:start+minutes*M,side,atr:10,target:null,context:{},family,holdMinutes:hold,entryAllowed,regime:'trend'});
test('regime usa contexto conhecido de1h/4h e pode ficar em caixa em volatilidade alta',()=>{
 assert.equal(regimeFor(feature(start),genome),'trend');assert.equal(regimeFor(feature(start,[1,.2,.003]),genome),'volatile');assert.equal(regimeFor(feature(start,[1,.2,.001,0,0,0,1,-1]),genome),'range');assert.equal(regimeFor({...feature(start),fourHourlyAt:start+1},genome),null);
 const input={cross:[sig(0)],bands:[sig(0,'bands')],vwap:[]},maps={cross:new Map([[start,feature(start)]]),bands:new Map([[start,feature(start)]]),vwap:new Map()},scores=new Map([['cross/720',new Map([[start,.6]])]]);
 const routed=routedSignals(input,maps,genome,scores,{start,end:start+M});assert.deepEqual(routed.filter(s=>s.entryAllowed).map(s=>s.family),['cross']);assert.equal(routed.find(s=>s.family==='cross').holdMinutes,720);
});
test('roteador não consulta scores posteriores nem permite score ausente',()=>{
 const input={cross:[sig(0),sig(10)],bands:[],vwap:[]},maps={cross:new Map([[start,feature(start)],[start+10*M,feature(start+10*M)]]),bands:new Map(),vwap:new Map()},scores=new Map([['cross/720',new Map([[start,.6],[start+10*M,.2]])]]);
 const a=routedSignals(input,maps,genome,scores,{start,end:start+M});scores.get('cross/720').set(start+10*M,999);assert.deepEqual(routedSignals(input,maps,genome,scores,{start,end:start+M}),a);assert.equal(routedSignals(input,maps,genome,new Map(),{start,end:start+M})[0].entryAllowed,false);
});
test('rota estática reproduz caixa, custos e saídas do motor anterior comR$1000',()=>{
 const d=data(),signals=[sig(0),sig(10,'cross',-1)],old=simulateScalpTree(d,{strategy:'cross',start,until:start+100*M,protocol:p,prepared:{signals:{cross:signals}},entryFilter:()=>null,closeAtEnd:true}),actual=simulateAdaptive(d,{start,until:start+100*M,protocol:p,signals,closeAtEnd:true});
 for(const k of['initial','final','cash','fees','fundingNet','maxDD','pnl'])assert.equal(actual[k],old[k]);assert.equal(actual.initial,200);assert.equal(actual.trades.length,old.trades.length);
});
test('estratégias compartilham uma posição e prazo fica congelado na entrada',()=>{
 const r=simulateAdaptive(data(),{start,until:start+100*M,protocol:p,signals:[sig(0,'cross',1,60),sig(10,'bands',-1,30),sig(20,'cross',1,30)],closeAtEnd:true});
 assert.equal(r.trades.length,1);assert.equal(r.trades[0].holdMinutes,60);assert.equal(r.trades[0].exitAt,start+60*M);assert.equal(r.trades[0].family,'cross');assert.equal(r.trades[0].reason,'Limite de 60min');assert.ok(Math.abs(r.trades.reduce((n,t)=>n+t.net,0)-r.pnl)<1e-8);
});
test('veto ou troca de rota não esconde saída por sinal contrário da mesma família',()=>{
 const r=simulateAdaptive(data(),{start,until:start+100*M,protocol:p,signals:[sig(0,'cross',1,720),sig(10,'cross',-1,30,false),sig(10,'bands',1,30,false)],closeAtEnd:true});assert.equal(r.trades[0].exitAt,start+10*M);assert.equal(r.trades[0].reason,'Sinal contrário');assert.equal(r.trades.length,1);
});
test('alterar candles e decisões futuras preserva a carteira anterior',()=>{
 const d=data(),signals=[sig(0),sig(10,'bands',-1)],opts={start,until:start+40*M,protocol:p,signals,closeAtEnd:true},a=simulateAdaptive(d,opts),future={...d,candles:d.candles.map(r=>r[0]>=start+40*M?[r[0],999,9999,1,999,r[5]]:r)};assert.deepEqual(simulateAdaptive(future,opts),a);assert.throws(()=>simulateAdaptive(d,{...opts,signals:[{...sig(0),knownAt:start+1}]}),/inválido/);
});
