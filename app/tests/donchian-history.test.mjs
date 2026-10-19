import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {prepareDonchian, simulateDonchian} from '../web/donchian.js';
import {HOUR} from '../web/engine.js';
const read=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url)));
const report=read('web/data/donchian-history-results.json'), p=report.protocol;
const data=read(p.source), old=read('web/data/donchian-results.json');
const prepared=prepareDonchian(data.candles,p);

test('histórico2020–2026 tem candles contínuos, marks alinhados e funding sem lacunas',()=>{
  assert.equal(data.candles.length,59520);assert.equal(data.funding.length,7440);
  assert.equal(data.candles[0][0],Date.UTC(2020,0,1));assert.equal(data.candles.at(-1)[0]+HOUR,Date.UTC(2026,9,16));
  assert.equal(data.marks.length,data.candles.length);
  assert.ok(data.candles.every((r,i)=>r[0]===data.candles[0][0]+i*HOUR&&r[0]===data.marks[i][0]));
  for(const rows of [data.candles,data.marks])assert.ok(rows.every(r=>r[3]>0&&r[3]<=Math.min(r[1],r[4])&&r[2]>=Math.max(r[1],r[4])));
  assert.ok(data.funding.every((r,i)=>i===0||r[0]>data.funding[i-1][0]&&r[0]-data.funding[i-1][0]<=8*HOUR+60000));
});
test('177 arquivos têm checksums e48 mark prices foram recuperados sem interpolação',()=>{
  assert.equal(data.sources.length,177);assert.equal(data.repairs.reduce((s,r)=>s+r.records,0),48);
  assert.ok([...data.sources,...data.repairs].every(s=>s.url.startsWith('https://data.binance.vision/')||s.url.startsWith('https://fapi.binance.com/')));
  assert.ok([...data.sources,...data.repairs].every(s=>/^[a-f0-9]{64}$/.test(s.sha256)));
  const legacy=read(data.legacy.file), hash=createHash('sha256').update(fs.readFileSync(new URL('../'+data.legacy.file,import.meta.url))).digest('hex');
  assert.equal(hash,data.legacy.sha256);
  for(const key of ['candles','marks','funding'])assert.deepEqual(data[key].filter(r=>r[0]>=Date.UTC(2024,11,1)),legacy[key]);
});
test('cinco novos blocos têm aquecimento anterior e mantêm todos os parâmetros da versão1',()=>{
  const original=old.protocol;
  for(const key of ['capitalBRL','fx','risk','leverage','dailyLimit','totalLimit','stopATR','targetR','maxHoldHours','cooldownHours','volumePeriod','volumeMultiplier','warmupBars','adaptive','variants','costCases'])assert.deepEqual(p[key],original[key],key);
  assert.equal(p.periods.length,9);assert.equal(p.periods[0].start,'2020-02-01T00:00:00Z');
  for(const period of p.periods.filter(x=>x.status==='retrospective_extension'))for(const variant of p.variants)assert.ok(prepared[variant.id].find(b=>b.time===Date.parse(period.start))?.ready);
});
test('todos os16 cenários anteriores permanecem idênticos, inclusive cada operação e curva',()=>{
  for(const s of old.scenarios)assert.deepEqual(report.scenarios.find(x=>x.period===s.period&&x.variant===s.variant&&x.costCase===s.costCase),s);
  assert.equal(report.scenarios.length,36);
});
test('reprodução dos novos anos reconcilia caixa e mantém limite24h e pausas',()=>{
  for(const period of p.periods.filter(x=>x.status==='retrospective_extension'))for(const variant of p.variants)for(const cost of p.costCases){
    const r=simulateDonchian(data,{protocol:p,variant:variant.id,costCase:cost.id,start:Date.parse(period.start),until:Date.parse(period.end),prepared,closeAtEnd:true});
    const s=report.scenarios.find(x=>x.period===period.id&&x.variant===variant.id&&x.costCase===cost.id);
    assert.equal(r.pnl,s.pnlUSDT);assert.deepEqual(r.trades,s.trades);
    assert.ok(Math.abs(r.trades.reduce((n,t)=>n+t.net,0)-r.pnl)<1e-8);
    assert.ok(r.trades.every(t=>t.exitAt-t.entryAt<=24*HOUR));
    if(r.halted)assert.ok(r.trades.every(t=>t.entryAt<r.haltAt));
  }
});
test('histórico posterior não muda decisões num replay antigo',()=>{
  const start=Date.UTC(2021,0,1), until=start+200*HOUR;
  const poisoned={...data,candles:data.candles.map(r=>r[0]>=until?[r[0],...r.slice(1).map(v=>v*100)]:r),marks:data.marks.map(r=>r[0]>=until?[r[0],...r.slice(1).map(v=>v*100)]:r),funding:data.funding.map(r=>r[0]>=until?[r[0],99]:r)};
  for(const variant of p.variants){
    const a=simulateDonchian(data,{protocol:p,variant:variant.id,start,until,prepared});
    const b=simulateDonchian(poisoned,{protocol:p,variant:variant.id,start,until});
    assert.deepEqual(a,b);
  }
});
test('congelamento protege a extensão e todos os estudos anteriores',()=>{
  const f=read('donchian-history-freeze.json');
  for(const[file,expected]of Object.entries({...f.preservedFiles,'donchian-history-protocol.json':f.protocolSHA256,
    'scripts/fetch-donchian-history.py':f.fetchSHA256,'scripts/analyze-donchian-history.mjs':f.analysisSHA256,
    'web/data/eth-donchian-history.json':f.dataSHA256,'web/data/donchian-history-results.json':f.resultSHA256})){
    assert.equal(createHash('sha256').update(fs.readFileSync(new URL('../'+file,import.meta.url))).digest('hex'),expected,file);
  }
});
