import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import{simulate,HOUR}from'../web/engine.js';
import{nextReplayTime,replayActivity,replayStatus}from'../web/replay.js';
const data=JSON.parse(fs.readFileSync(new URL('../web/data/eth-2025.json',import.meta.url))),start=Date.UTC(2025,3,1),end=Date.UTC(2025,4,1);
const rule=JSON.parse(fs.readFileSync(new URL('../web/data/intraday-results.json',import.meta.url))).protocol.strategies.find(s=>s.id==='trend1h');
const options={start,strategy:rule.id,maxHoldHours:rule.maxHoldHours,stopATR:rule.stopATR,targetR:rule.targetR,cooldownHours:rule.cooldownHours};
test('navegar revela cada atividade somente quando o motor já pode conhecê-la',()=>{
 const full=simulate(data,{...options,until:end});let cursor=start+HOUR,steps=0;
 while(true){const next=nextReplayTime(full,cursor,end);if(next===null)break;assert.ok(next>cursor);const before=simulate(data,{...options,until:next-1}),now=simulate(data,{...options,until:next});
 const revealed=replayActivity(now).filter(e=>e.visibleAt===next);assert.ok(revealed.length>0,'navegação precisa chegar a uma atividade efetivamente disponível');
 assert.equal(replayActivity(before).filter(e=>e.visibleAt===next).length,0);cursor=next;assert.ok(++steps<150);}
 assert.ok(steps>20);assert.equal(full.trades.length,19);
});
test('replay original explica a rejeição por risco em vez de criar operações',()=>{
 const r=simulate(data,{start,until:end});assert.equal(r.trades.length,0);assert.equal(r.rejected,1);assert.match(replayStatus(r,end,end),/Mínimo da corretora excede orçamento de risco/);
});
test('sinal na fronteira final avisa que faltam dados de execução',()=>{
 const mayStart=end,mayEnd=Date.UTC(2025,5,1),r=simulate(data,{start:mayStart,until:mayEnd});assert.ok(r.pending);assert.match(replayStatus(r,mayEnd,mayEnd),/Falta o candle seguinte/);assert.equal(nextReplayTime(r,mayEnd,mayEnd),null);
});
