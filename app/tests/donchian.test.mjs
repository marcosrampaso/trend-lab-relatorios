import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {simulate, HOUR} from '../web/engine.js';
import {prepareDonchian, simulateDonchian, adaptiveWindow, donchianActivity} from '../web/donchian.js';
import {fixedCostAudit} from '../web/cost-audit.js';
const read = p => JSON.parse(fs.readFileSync(new URL('../' + p, import.meta.url)));
const p = read('donchian-protocol.json'), data = read(p.source), prepared = prepareDonchian(data.candles, p);
const saved = read('web/data/donchian-results.json');
const period = p.periods.find(x => x.id === 'newOctober'), start = Date.parse(period.start), until = Date.parse(period.end);
const run = (variant = 'adaptive', extra = {}) => simulateDonchian(data, {protocol:p, variant, start, until, prepared, ...extra});

test('adaptação tem limites e direção definidos sem ajuste pelo resultado', () => {
  const rule = p.adaptive;
  assert.equal(adaptiveWindow(.01,.01,rule),20);
  assert.equal(adaptiveWindow(.02,.01,rule),10);
  assert.equal(adaptiveWindow(.005,.01,rule),40);
  assert.equal(adaptiveWindow(.00001,.01,rule),40);
  assert.equal(adaptiveWindow(1,.01,rule),10);
  assert.equal(adaptiveWindow(0,.01,rule),20);
  assert.ok(prepared.adaptive.every(b => Number.isInteger(b.lookback) && b.lookback >= 10 && b.lookback <= 40));
});
test('canal e escolha da janela excluem o próprio candle de sinal', () => {
  const i = 300, row = data.candles[i];
  const altered = data.candles.slice(0,i+1).map((r,j) => j === i ? [r[0],r[1],r[2]*10,r[3]/10,r[4]*5,r[5]] : r);
  const original = prepareDonchian(data.candles.slice(0,i+1),p), poisoned = prepareDonchian(altered,p);
  for (const variant of ['fixed','adaptive']) {
    const a = original[variant].at(-1), b = poisoned[variant].at(-1);
    assert.equal(a.lookback,b.lookback); assert.equal(a.upper,b.upper); assert.equal(a.lower,b.lower);
    assert.equal(a.volatility,b.volatility); assert.equal(a.reference,b.reference);
    const prior = data.candles.slice(i-a.lookback,i);
    assert.equal(a.upper,Math.max(...prior.map(r=>r[2])));
    assert.equal(a.lower,Math.min(...prior.map(r=>r[3])));
  }
  assert.equal(row[0]+HOUR, original.adaptive.at(-1).at);
});
test('sinal exige rompimento no fechamento e volume estritamente maior que o limite', () => {
  const i=300, prefix=data.candles.slice(0,i+1).map(r=>[...r]);
  const volume=prefix.slice(i-20,i).reduce((n,r)=>n+r[5],0)/20;
  prefix[i][5]=volume*1.2;
  prefix[i][4]=100000; prefix[i][2]=100000;
  assert.equal(prepareDonchian(prefix,p).fixed.at(-1).cross,0);
  prefix[i][5]=volume*1.21;
  assert.equal(prepareDonchian(prefix,p).fixed.at(-1).cross,1);
  prefix[i][4]=1; prefix[i][3]=1;
  assert.equal(prepareDonchian(prefix,p).fixed.at(-1).cross,-1);
  const channel=prepareDonchian(prefix,p).fixed.at(-1);
  prefix[i][4]=channel.upper;
  assert.equal(prepareDonchian(prefix,p).fixed.at(-1).cross,0);
});
test('futuro alterado ou removido não muda indicadores, decisões, fills nem saldo passados', () => {
  const cutoff=start+100*HOUR;
  const poison={...data,candles:data.candles.map(r=>r[0]>=cutoff?[r[0],...r.slice(1).map(v=>v*100)]:r),
    marks:data.marks?.map(r=>r[0]>=cutoff?[r[0],...r.slice(1).map(v=>v*100)]:r),
    funding:data.funding.map(r=>r[0]>=cutoff?[r[0],999]:r)};
  const before=prepareDonchian(data.candles,p,cutoff), after=prepareDonchian(poison.candles,p,cutoff);
  assert.deepEqual(before,after);
  for(const variant of ['fixed','adaptive']) {
    const a=run(variant,{until:cutoff});
    const b=simulateDonchian(poison,{protocol:p,variant,start,until:cutoff});
    const c=simulateDonchian(data,{protocol:p,variant,start,until:cutoff,prepared:before});
    assert.deepEqual(a,b); assert.deepEqual(a,c);
  }
});
test('controle reproduz todas as operações anteriores, nos4 blocos e2 custos', () => {
  for(const period of p.periods) for(const cost of p.costCases) {
    const opts={start:Date.parse(period.start),until:Date.parse(period.end),closeAtEnd:true};
    const a=simulateDonchian(data,{protocol:p,variant:'fixed',costCase:cost.id,prepared,...opts});
    const b=simulate(data,{...opts,strategy:'breakout',maxHoldHours:24,stopATR:1.5,targetR:2,cooldownHours:4,
      config:{fee:cost.fee,slippage:cost.slippage}});
    assert.deepEqual(a.trades,b.trades); assert.equal(a.final,b.final); assert.deepEqual(a.events,b.events);
  }
});
test('replay revela sinal antes da entrada e só usa candles fechados', () => {
  const full=run(), signal=full.signals.find(s=>full.events.some(e=>e.kind==='entry'&&e.at===s.at));
  assert.ok(signal);
  const before=run('adaptive',{until:signal.at}), after=run('adaptive',{until:signal.at+HOUR});
  assert.equal(before.pending.at,signal.at);
  assert.equal(before.events.filter(e=>e.kind==='entry'&&e.at===signal.at).length,0);
  assert.ok(after.events.some(e=>e.kind==='entry'&&e.at===signal.at));
  assert.ok(donchianActivity(after).some(e=>e.kind==='entry'&&e.knownAt===signal.at+HOUR));
  assert.ok(donchianActivity(before).every(e=>e.knownAt<=signal.at));
});
test('os16 resultados publicados reconciliam caixa, custos e limite24h', () => {
  assert.equal(saved.scenarios.length,16); assert.equal(saved.aiApplied,false); assert.equal(saved.exploratory,true);
  for(const s of saved.scenarios) {
    const period=p.periods.find(x=>x.id===s.period);
    const actual=run(s.variant,{start:Date.parse(period.start),until:Date.parse(period.end),costCase:s.costCase,closeAtEnd:true});
    assert.equal(actual.pnl,s.pnlUSDT); assert.deepEqual(actual.trades,s.trades);
    assert.ok(Math.abs(s.trades.reduce((n,t)=>n+t.net,0)-s.pnlUSDT)<1e-8);
    assert.ok(s.trades.every(t=>t.exitAt-t.entryAt<=24*HOUR&&t.plannedRisk>0));
    assert.equal(actual.config.risk,.01); assert.equal(actual.config.totalLimit,.1);
    if(s.costCase==='base') {
      const audit=saved.audits.find(x=>x.period===s.period&&x.variant===s.variant);
      assert.deepEqual(fixedCostAudit(s.trades,p.costCases[0],p.costCases[1]),Object.fromEntries(Object.entries(audit).filter(([k])=>!['period','variant'].includes(k))));
      assert.ok(audit.stressPnL<=audit.basePnL);
    }
  }
});
test('protocolo, código, dados e resultados preservados têm hashes válidos', () => {
  const f=read('donchian-freeze.json');
  for(const[file,expected]of Object.entries({...f.preservedFiles,'donchian-protocol.json':f.protocolSHA256,
    'web/donchian.js':f.implementationSHA256,'scripts/analyze-donchian.mjs':f.analysisSHA256,'web/data/donchian-results.json':f.resultSHA256})) {
    assert.equal(createHash('sha256').update(fs.readFileSync(new URL('../'+file,import.meta.url))).digest('hex'),expected,file);
  }
});
