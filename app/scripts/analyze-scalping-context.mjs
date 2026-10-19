import fs from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {prepareScalping, simulateScalping, MINUTE} from '../web/scalping.js';
import {trendFrames, contextAt} from '../web/scalping-context.js';
import {simulateContextScalping} from '../web/scalping-context-engine.js';

const read = p => JSON.parse(fs.readFileSync(p));
const hash = p => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const original = read('scalping-protocol.json'), protocol = read('scalping-context-protocol.json');
const frozen = read('scalping-freeze.json'), historyFreeze = read('donchian-history-freeze.json');
const preserved = {...frozen.preservedFiles,
  'scalping-protocol.json': frozen.protocolSHA256, 'web/scalping.js': frozen.implementationSHA256,
  'web/data/scalping-market.json': frozen.dataSHA256, 'web/data/scalping-results.json': frozen.resultSHA256,
  'web/data/eth-donchian-history.json': historyFreeze.dataSHA256};
for (const [file, expected] of Object.entries(preserved)) assert.equal(hash(file), expected, file);

const data = read('web/data/scalping-market.json'), history = read('web/data/eth-donchian-history.json');
const old = read('web/data/scalping-results.json'), prepared = prepareScalping(data, original);
const start = Date.parse(original.periods[0].start), end = Date.parse(original.end);
const historyMap = new Map(history.candles.map(r => [r[0], r]));
// Both resolutions must describe the same underlying ETHUSDT market.
let reconciledHours = 0;
for (let i = 0; i < data.candles.length; i += 60) {
  const a = data.candles.slice(i, i + 60);
  if (a.length !== 60 || a[0][0] % 3600000) continue;
  assert.ok(a.every((r,j) => r[0] === a[0][0] + j * MINUTE));
  const h = historyMap.get(a[0][0]); assert.ok(h, 'Hora ausente');
  const values = [a[0][1], Math.max(...a.map(r => r[2])), Math.min(...a.map(r => r[3])), a.at(-1)[4]];
  for (let k = 0; k < 4; k++) assert.ok(Math.abs(values[k] - h[k+1]) < 1e-7, 'OHLC diverge');
  reconciledHours++;
}
const frames = Object.fromEntries([[1, 'hourly'], [4, 'fourHourly']].map(([hours, key]) => [key,
  trendFrames(history.candles, hours, protocol.trend).filter(b => b.at >= start - 4 * 3600000 && b.at <= end)]));
const scenarios = [];
for (const period of original.periods) for (const strategy of original.strategies)
for (const mode of protocol.contextModes) for (const minutes of protocol.maxHoldMinutes)
for (const cost of original.costCases) {
  const p = {...original, maxHoldMinutes: minutes};
  const r = simulateContextScalping(data, {strategy: strategy.id, start: Date.parse(period.start), until: Date.parse(period.end), protocol: p, cost, prepared, frames, mode, closeAtEnd: true});
  assert.ok(Math.abs(r.pnl - r.trades.reduce((n,t) => n+t.net,0)) < 1e-8, 'Caixa não reconciliado');
  assert.ok(r.trades.every(t => t.exitAt - t.entryAt <= minutes * MINUTE), 'Prazo excedido');
  if (minutes === 30 && mode === 'observe') {
    const control = old.scenarios.find(s => s.period === period.id && s.strategy === strategy.id && s.costCase === cost.id);
    assert.equal(r.pnl, control.pnlUSDT); assert.deepEqual(r.trades, control.trades);
  }
  const win = r.trades.filter(t => t.net > 0).reduce((n,t) => n+t.net,0);
  const loss = -r.trades.filter(t => t.net < 0).reduce((n,t) => n+t.net,0);
  const n = r.trades.length;
  const rawSignals = prepared.signals[strategy.id].filter(s => s.at >= Date.parse(period.start) && s.at <= Date.parse(period.end)).length;
  const acceptedSignals = mode==='observe' ? rawSignals : prepared.signals[strategy.id].filter(s=>s.at>=Date.parse(period.start)&&s.at<=Date.parse(period.end)&&contextAt(frames,s.at,s.side).allowed).length;
  const exits = {};
  for (const t of r.trades) { const x = exits[t.reason] ??= {count:0, netUSDT:0}; x.count++; x.netUSDT += t.net; }
  scenarios.push({period: period.id, strategy: strategy.id, mode, maxHoldMinutes: minutes, costCase: cost.id,
    pnlUSDT: r.pnl, returnPct: r.returnPct, count: n, rawSignals, acceptedSignals, contextVetoes: rawSignals-acceptedSignals,
    grossUSDT: r.trades.reduce((n,t) => n+t.gross,0), feesUSDT: r.fees, fundingUSDT: r.fundingNet,
    slippageUSDT: r.trades.reduce((n,t) => n+t.slippageCost,0), maxDD: r.maxDD,
    expectancyUSDT: n ? r.pnl/n : null, profitFactor: loss ? win/loss : null,
    winRate: n ? r.trades.filter(t => t.net > 0).length/n : null,
    avgMinutes: n ? r.trades.reduce((n,t) => n+(t.exitAt-t.entryAt)/MINUTE,0)/n : null,
    halted: r.halted, haltAt: r.haltAt, exits,
    trades: r.trades.map(({context,...t}) => t),
    curve: r.equity.filter((v,i) => i%60 === 0 || i === r.equity.length-1)});
}
assert.equal(scenarios.length, 96);
const target = 'web/data/scalping-context-results.json';
const report = {generatedAt: fs.existsSync(target) ? read(target).generatedAt : new Date().toISOString(),
  protocol, originalProtocol: original, preserved, reconciledHours, frames, scenarios,
  trialCount:96, newTraining:false, promoted:false,
  limitations:['Dois meses já conhecidos; sem teste futuro intocado.', 'Paradas globais encurtam a amostra; diferenças de centavos perto de−10% não indicam vantagem.', '4h muda o horizonte da operação; não altera candles de sinal5min.', 'Cada carteira reiniciaR$300. Não somar retornos nem chamar múltiplos cenários de amostras independentes.']};
const bytes = JSON.stringify(report);
if (fs.existsSync(target)) assert.equal(fs.readFileSync(target, 'utf8'), bytes, 'Resultado anterior divergiu');
else fs.writeFileSync(target, bytes);
const freezePath='scalping-context-freeze.json';
const files=[...Object.keys(preserved), 'scalping-context-protocol.json', 'web/scalping-context.js', 'web/scalping-context-engine.js', 'scripts/analyze-scalping-context.mjs', target];
const checks=Object.fromEntries(files.map(p=>[p,hash(p)]));
if(fs.existsSync(freezePath)) assert.deepEqual(read(freezePath).files,checks);
else fs.writeFileSync(freezePath, JSON.stringify({registeredAt:protocol.registeredAt,files:checks},null,2)+'\n');
console.log(JSON.stringify(scenarios.filter(s=>s.costCase==='base').map(s=>({month:s.period,strategy:s.strategy,mode:s.mode,minutes:s.maxHoldMinutes,netBRL:+(s.pnlUSDT*original.fx).toFixed(2),trades:s.count,dd:+(s.maxDD*100).toFixed(2),halt:s.haltAt?new Date(s.haltAt).toISOString():null})),null,2));
