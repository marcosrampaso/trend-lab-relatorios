import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';import{createHash}from'node:crypto';
import{contextIndicators,contextChecks,createContextFilter}from'../web/decision-context.js';import{simulate,HOUR}from'../web/engine.js';
const protocol=JSON.parse(fs.readFileSync(new URL('../context-protocol.json',import.meta.url))),data=JSON.parse(fs.readFileSync(new URL('../web/data/eth-2025.json',import.meta.url)));
const row=(t,c,v=100)=>[t,c,c+1,c-1,c,v];
test('RSI usa14 variações e semente Wilder; alta, queda e preço constante têm limites definidos',()=>{
 const rows=Array.from({length:15},(_,i)=>row(i*HOUR,100+i));rows.push(row(15*HOUR,113));const c=contextIndicators(rows);assert.equal(c[13].rsi,null);assert.equal(c[14].rsi,100);assert.ok(Math.abs(c[15].rsi-100*13/14)<1e-10);
 assert.equal(contextIndicators(Array.from({length:20},(_,i)=>row(i*HOUR,100-i))).at(-1).rsi,0);assert.equal(contextIndicators(Array.from({length:20},(_,i)=>row(i*HOUR,100))).at(-1).rsi,50);
});
test('volume relativo exclui o próprio candle da média e trata volume zero',()=>{
 const rows=Array.from({length:20},(_,i)=>row(i*HOUR,100));rows.push(row(20*HOUR,100,300));const c=contextIndicators(rows);assert.equal(c[19].rvol,null);assert.equal(c[20].volumeMean,100);assert.equal(c[20].rvol,3);assert.equal(contextIndicators(rows.map(r=>[...r.slice(0,5),0])).at(-1).rvol,null);
});
test('ATR e ADX têm aquecimento Wilder; ADX não cria direção nem probabilidade',()=>{
 const c=contextIndicators(Array.from({length:35},(_,i)=>row(i*HOUR,100+i)));assert.equal(c[12].atr,null);assert.equal(c[13].atr,2);assert.equal(c[26].adx,null);assert.equal(c[27].adx,100);assert.equal(c[27].plusDI,50);assert.equal(c[27].minusDI,0);assert.equal(contextIndicators(Array.from({length:35},(_,i)=>row(i*HOUR,100))).at(-1).adx,0);
});
test('VWAP usa preço típico ponderado e reinicia na mudança de diaUTC',()=>{
 const start=Date.UTC(2025,0,1,22),c=contextIndicators([row(start,100,1),row(start+HOUR,200,3),row(start+2*HOUR,300,1)]);assert.equal(c[1].vwap,175);assert.equal(c[2].vwap,300);assert.equal(c[2].vwapDay,'2025-01-02');
});
test('futuro alterado e candle incompleto não mudam nenhum indicador ou veto',()=>{
 const until=Date.UTC(2025,3,9,12),poisoned=data.candles.map(r=>r[0]+HOUR>until?[r[0],...r.slice(1).map(v=>v*100)]:r);const original=contextIndicators(data.candles,until);assert.deepEqual(original,contextIndicators(poisoned,until+HOUR/2));assert.ok(original.every(c=>c.at<=until));
 const full=createContextFilter(contextIndicators(data.candles),'combined',protocol),prefix=createContextFilter(original,'combined',protocol);for(const c of original.slice(-10))for(const side of[-1,1])assert.equal(full.veto({at:c.at,side}),prefix.veto({at:c.at,side}));assert.match(prefix.veto({at:until+HOUR,side:1}),/indisponível/);
});
test('filtros aplicam intervalos simétricos e combinação exige as duas condições',()=>{
 assert.ok(contextChecks({rvol:1.2,rsi:60},1,'combined',protocol).every(c=>c.pass));assert.ok(contextChecks({rvol:1.2,rsi:40},-1,'combined',protocol).every(c=>c.pass));assert.equal(contextChecks({rvol:1.19,rsi:60},1,'combined',protocol).filter(c=>!c.pass).length,1);assert.equal(contextChecks({rvol:2,rsi:71},1,'rsi',protocol)[0].pass,false);assert.equal(contextChecks({rvol:2,rsi:29},-1,'rsi',protocol)[0].pass,false);assert.deepEqual(contextChecks(null,0,'observe',protocol),[]);
});
test('veto de contexto é causal na carteira e preserva capital e risco',()=>{
 const until=Date.UTC(2025,3,8),poisoned={...data,candles:data.candles.map(r=>r[0]>=until?[r[0],...r.slice(1).map(v=>v*100)]:r)},options={start:Date.UTC(2025,3,1),until,strategy:'trend1h',maxHoldHours:24,stopATR:1.5,targetR:2,cooldownHours:4};
 const run=d=>{const f=createContextFilter(contextIndicators(d.candles,until),'combined',protocol);return simulate(d,{...options,entryFilter:({signal})=>f.veto(signal)});};assert.deepEqual(run(data),run(poisoned));assert.equal(run(data).config.risk,.01);assert.equal(run(data).config.capitalBRL,300);
});
test('estudo publica48 cenários, preserva os controles e reconcilia todos os custos',()=>{
 const read=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url))),r=read('web/data/context-results.json'),hash=p=>createHash('sha256').update(fs.readFileSync(new URL('../'+p,import.meta.url))).digest('hex');assert.equal(r.scenarios.length,48);assert.equal(hash('context-protocol.json'),r.freeze.protocolSHA256);assert.equal(hash('web/decision-context.js'),r.implementationSHA256);for(const[p,h]of Object.entries(r.freeze.preservedFiles))assert.equal(hash(p),h,p);
 const previous=read('web/data/intraday-results.json');for(const s of r.scenarios){assert.ok(Math.abs(s.trades.reduce((n,t)=>n+t.net,0)-s.pnlUSDT)<1e-8);assert.ok(s.trades.every(t=>t.context.at===t.signalAt&&t.exitAt-t.entryAt<=24*HOUR));if(s.variant==='observe'){const old=previous.scenarios.find(x=>x.period===s.period&&x.strategy==='trend1h'&&x.costCase===s.costCase);if(old){assert.equal(s.pnlUSDT,old.pnlUSDT);assert.equal(s.count,old.count);}}else for(const t of s.trades)assert.ok(contextChecks(t.context,t.side,s.variant,r.protocol).every(c=>c.pass));}
 for(const a of r.audits)assert.ok(a.stressPnL<=a.basePnL+1e-10);
});
test('cenário filtrado publicado é reproduzível com o motor preservado',()=>{
 const r=JSON.parse(fs.readFileSync(new URL('../web/data/context-results.json',import.meta.url))),p=protocol.periods.find(p=>p.id==='may'),f=createContextFilter(contextIndicators(data.candles),'combined',protocol);const actual=simulate(data,{start:Date.parse(p.start),until:Date.parse(p.end),strategy:'trend1h',maxHoldHours:24,stopATR:1.5,targetR:2,cooldownHours:4,entryFilter:({signal})=>f.veto(signal),closeAtEnd:true});const saved=r.scenarios.find(s=>s.period==='may'&&s.variant==='combined'&&s.costCase==='base');assert.equal(actual.pnl,saved.pnlUSDT);assert.equal(actual.trades.length,saved.count);
});
