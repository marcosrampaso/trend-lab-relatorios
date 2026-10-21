// One preregistered entry change. ATR measures recent range, not expected profit.
export const COST_GATE_RUN = 'work/pepe-entry-cost-v1';

export function costGate({decisionAt, side, feature}, cost, filters, multiple = 2) {
  if (![1, -1].includes(side) || !Number.isFinite(decisionAt) || !(multiple > 0))
    throw Error('Invalid gate input');
  if (!feature || !Number.isFinite(feature.at) || !Number.isFinite(feature.knownAt)
      || feature.knownAt > decisionAt || feature.at > decisionAt
      || decisionAt - feature.at >= 300000 || feature.knownAt < feature.at)
    throw Error('Future/stale gate feature');
  if (!(feature.close > 0) || !(feature.atr > 0)
      || !Number.isFinite(feature.close) || !Number.isFinite(feature.atr)
      || !(cost.fee >= 0) || !(cost.slippage >= 0 && cost.slippage < 1))
    throw Error('Invalid price/ATR/cost');
  const tick = Number(filters.find(f => f.filterType === 'PRICE_FILTER')?.tickSize ?? 0);
  const round = (value, direction) => !(tick > 0) ? value
    : (direction > 0 ? Math.ceil(value / tick - 1e-8)
      : Math.floor(value / tick + 1e-8)) * tick;
  // Estimate both fills at the LAST KNOWN close. Never use the next open/fill.
  const entry = round(feature.close * (1 + side * cost.slippage), side);
  const exit = round(feature.close * (1 - side * cost.slippage), -side);
  const friction = side * (entry - exit) + cost.fee * (entry + exit);
  if (!(friction > 0) || !Number.isFinite(friction)) throw Error('Invalid friction');
  return {decisionAt, featureAt:feature.at, knownAt:feature.knownAt,
    referenceClose:feature.close, atr:feature.atr, estimatedEntry:entry,
    estimatedExit:exit, frictionPerUnit:friction, atrToFriction:feature.atr / friction,
    multiple, allowed:feature.atr >= multiple * friction,
    fundingIncluded:false, forecastOfProfit:false};
}

export function partitionSignals(packet, market, protocol, multiple = 2) {
  const cost = protocol.costCases.find(c => c.id === 'stress');
  const decisions = packet.entries.map(e => {
    const feature = market.context(e.trade.entryAt);
    if (Math.abs(feature.atr - e.atr) > 1e-12) throw Error('Source ATR is not the known ATR');
    return {id:e.id, month:e.month, split:e.split, ...costGate({
      decisionAt:e.trade.entryAt, side:e.trade.side, feature
    }, cost, market.filters, multiple)};
  });
  const ids = new Set(decisions.filter(d => d.allowed).map(d => d.id));
  return {decisions, filtered:{...packet, entries:packet.entries.filter(e => ids.has(e.id))}};
}
