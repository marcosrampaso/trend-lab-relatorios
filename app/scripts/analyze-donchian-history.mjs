import fs from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {simulate, HOUR} from '../web/engine.js';
import {prepareDonchian, simulateDonchian} from '../web/donchian.js';
import {fixedCostAudit} from '../web/cost-audit.js';
const read = p => JSON.parse(fs.readFileSync(p));
const hash = p => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const protocol = read('donchian-history-protocol.json'), freeze = read('donchian-history-freeze.json');
for (const [p, expected] of Object.entries({...freeze.preservedFiles, 'donchian-history-protocol.json': freeze.protocolSHA256,
  ...(freeze.dataSHA256 ? {[protocol.source]: freeze.dataSHA256} : {}),
  ...(freeze.fetchSHA256 ? {'scripts/fetch-donchian-history.py': freeze.fetchSHA256} : {}),
  ...(freeze.analysisSHA256 ? {'scripts/analyze-donchian-history.mjs': freeze.analysisSHA256} : {})})) {
  assert.equal(hash(p), expected, 'Arquivo congelado alterado: ' + p);
}
const inputs = new Map([...new Set(protocol.periods.map(p => p.source))].map(file => {const data=read(file);return [file,{data,prepared:prepareDonchian(data.candles,protocol)}];}));
const history=inputs.get(protocol.source).data;
const oldStudy=read('web/data/donchian-results.json');
const previous = read('web/data/intraday-results.json');
const scenarios = [];
for (const period of protocol.periods) for (const variant of protocol.variants) for (const cost of protocol.costCases) {
  const {data,prepared}=inputs.get(period.source);
  const start = Date.parse(period.start), until = Date.parse(period.end);
  assert.ok(prepared[variant.id].find(b => b.time === start)?.ready, 'Aquecimento insuficiente');
  const r = simulateDonchian(data, {protocol, variant: variant.id, costCase: cost.id, start, until, prepared, closeAtEnd: true});
  if (variant.id === 'fixed') {
    const original = simulate(data, {start, until, strategy: 'breakout', maxHoldHours: 24,
      stopATR: 1.5, targetR: 2, cooldownHours: 4, config: {fee: cost.fee, slippage: cost.slippage}, closeAtEnd: true});
    assert.deepEqual(r.trades, original.trades, 'Controle divergiu do motor preservado');
    const saved = previous.scenarios.find(s => s.period === period.id && s.strategy === 'breakout' && s.costCase === cost.id);
    if(saved) assert.equal(r.pnl, saved.pnlUSDT, 'Controle divergiu do estudo anterior');
  }
  assert.ok(Math.abs(r.trades.reduce((s, t) => s + t.net, 0) - r.pnl) < 1e-8, 'Caixa não reconciliado');
  assert.ok(r.trades.every(t => t.exitAt - t.entryAt <= 24 * HOUR), 'Duração excedida');
  const wins = r.trades.filter(t => t.net > 0), losses = r.trades.filter(t => t.net < 0);
  const winning = wins.reduce((s, t) => s + t.net, 0), losing = -losses.reduce((s, t) => s + t.net, 0);
  const decisionBars = prepared[variant.id].filter(b => b.at > start && b.at <= until);
  scenarios.push({period: period.id, variant: variant.id, costCase: cost.id,
    initialUSDT: r.initial, finalUSDT: r.final, pnlUSDT: r.pnl, returnPct: r.returnPct,
    maxDD: r.maxDD, count: r.trades.length, signals: r.signals.length, rejected: r.rejected,
    winRate: r.trades.length ? wins.length / r.trades.length : null,
    profitFactor: losing ? winning / losing : null,
    meanNet: r.trades.length ? r.pnl / r.trades.length : null,
    avgWinLoss: wins.length && losses.length ? (winning / wins.length) / (losing / losses.length) : null,
    fees: r.fees, funding: r.fundingNet, slippage: r.trades.reduce((s, t) => s + t.slippageCost, 0),
    halted: r.halted, haltAt: r.haltAt, liquidations: r.liquidations,
    lookback: {min: Math.min(...decisionBars.map(b => b.lookback)), max: Math.max(...decisionBars.map(b => b.lookback)),
      mean: decisionBars.reduce((s, b) => s + b.lookback, 0) / decisionBars.length},
    trades: r.trades, curve: r.equity.filter((x, i) => i % 6 === 0 || i === r.equity.length - 1)});
}
const audits = scenarios.filter(s => s.costCase === 'base').map(s => ({period: s.period, variant: s.variant,
  ...fixedCostAudit(s.trades, protocol.costCases[0], protocol.costCases[1])}));
for(const old of oldStudy.scenarios) assert.deepEqual(scenarios.find(s=>s.period===old.period&&s.variant===old.variant&&s.costCase===old.costCase),old,'Cenário da versão1 não preservado');
const output = 'web/data/donchian-history-results.json';
const prior = fs.existsSync(output) ? read(output) : null;
const report = {generatedAt: prior?.generatedAt ?? new Date().toISOString(), exploratory: true,
  newsApplied: false, aiApplied: false, execution: '1h', protocol,
  registration: {registeredAt: freeze.registeredAt, protocolSHA256: freeze.protocolSHA256, preservedFiles: freeze.preservedFiles},
  implementationSHA256: hash('web/donchian.js'), sourcesSHA256: Object.fromEntries([...inputs.keys()].map(file=>[file,hash(file)])),
  history:{candles:history.candles.length,firstOpen:history.candles[0][0],until:history.candles.at(-1)[0]+HOUR,funding:history.funding.length,archives:history.sources.length,repairs:history.repairs.length,firstTestStart:Date.parse(protocol.dataPlan.firstTestStart)},
  scenarios, audits};
const bytes = JSON.stringify(report);
if (freeze.resultSHA256) {
  assert.equal(createHash('sha256').update(bytes).digest('hex'), freeze.resultSHA256, 'Reprodução divergiu; nenhum relatório foi sobrescrito');
  assert.equal(hash(output), freeze.resultSHA256);
} else fs.writeFileSync(output, bytes);
console.log(JSON.stringify(scenarios.map(s => ({period: s.period, variant: s.variant, cost: s.costCase,
  netBRL: s.pnlUSDT * protocol.fx, count: s.count, maxDD: s.maxDD, halted: s.halted, lookback: s.lookback})), null, 2));
