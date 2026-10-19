import {simulate, HOUR} from './engine.js';
import {intradayBars} from './strategies.js';

// The window is selected before the signal candle. No fitted parameters or LLM.
export function adaptiveWindow(recent, reference, rule) {
  if (!(recent > 0 && reference > 0)) return rule.base;
  return Math.max(rule.min, Math.min(rule.max, Math.round(rule.base * reference / recent)));
}

export function prepareDonchian(rows, protocol, until = Infinity) {
  const original = intradayBars(rows, until, 'breakout');
  const result = {fixed: [], adaptive: []};
  const a = protocol.adaptive;
  for (let i = 0; i < original.length; i++) {
    const b = original[i];
    const prior = original.slice(Math.max(0, i - a.referenceBars), i);
    const recent = prior.at(-1);
    const volatility = recent?.atr / recent?.close;
    const reference = prior.length === a.referenceBars
      ? prior.reduce((sum, x) => sum + x.atr / x.close, 0) / prior.length : null;
    const volumeRows = original.slice(Math.max(0, i - protocol.volumePeriod), i);
    const avgVolume = volumeRows.length === protocol.volumePeriod
      ? volumeRows.reduce((sum, x) => sum + x.volume, 0) / protocol.volumePeriod : null;
    for (const variant of ['fixed', 'adaptive']) {
      const lookback = variant === 'fixed' ? a.base : adaptiveWindow(volatility, reference, a);
      const channel = original.slice(Math.max(0, i - lookback), i);
      const ready = i >= protocol.warmupBars - 1 && channel.length === lookback
        && (variant === 'fixed' || reference !== null);
      const upper = channel.length === lookback ? Math.max(...channel.map(x => x.high)) : null;
      const lower = channel.length === lookback ? Math.min(...channel.map(x => x.low)) : null;
      const volumePass = avgVolume > 0 && b.volume > avgVolume * protocol.volumeMultiplier;
      const side = ready && volumePass ? b.close > upper ? 1 : b.close < lower ? -1 : 0 : 0;
      result[variant].push({...b, ready, lookback, upper, lower, volatility, reference,
        rvol: avgVolume > 0 ? b.volume / avgVolume : null, volumePass, side, cross: side});
    }
  }
  return result;
}

export function simulateDonchian(data, {protocol, variant = 'fixed', costCase = 'base', start, until,
  prepared = null, closeAtEnd = false} = {}) {
  if (!protocol.variants.some(x => x.id === variant)) throw Error('Variante inválida');
  const cost = protocol.costCases.find(x => x.id === costCase);
  if (!cost || !Number.isFinite(start) || !Number.isFinite(until) || until <= start) throw Error('Cenário inválido');
  const bars = (prepared ?? prepareDonchian(data.candles, protocol, until))[variant];
  const signals = bars.filter(b => b.ready && b.cross && b.at > start && b.at <= until)
    .map(b => ({at: b.at, side: b.cross, price: b.close, atr: b.atr, fast: b.fast, slow: b.slow,
      lookback: b.lookback, upper: b.upper, lower: b.lower, rvol: b.rvol}));
  const report = simulate(data, {start, until, strategy: 'breakout',
    maxHoldHours: protocol.maxHoldHours, stopATR: protocol.stopATR, targetR: protocol.targetR,
    cooldownHours: protocol.cooldownHours, registeredSignals: new Map(signals.map(s => [s.at, s])),
    config: {capitalBRL: protocol.capitalBRL, fx: protocol.fx, risk: protocol.risk,
      leverage: protocol.leverage, dailyLimit: protocol.dailyLimit, totalLimit: protocol.totalLimit,
      fee: cost.fee, slippage: cost.slippage}, closeAtEnd});
  // Registered signals are consumed on the next open. Reveal their closed-candle
  // context immediately, but never reveal that next candle's fills in advance.
  report.signals = signals;
  report.pending = signals.at(-1)?.at === until ? signals.at(-1) : null;
  return report;
}

export function donchianActivity(report) {
  return [...report.signals.map(s => ({...s, kind: 'signal', knownAt: s.at})),
    ...report.events.map(e => ({...e, knownAt: e.kind === 'entry' || e.kind === 'rejected'
      || e.kind === 'filtered' || e.kind === 'exit' && (e.reason === 'Cruzamento contrário'
        || e.reason?.startsWith('Limite de ')) ? e.at + HOUR : e.at}))]
    .sort((a, b) => a.knownAt - b.knownAt || a.at - b.at);
}
