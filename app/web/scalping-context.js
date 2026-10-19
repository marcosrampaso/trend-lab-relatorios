const HOUR = 3600000;

// A candle is available at its closing time, never at its opening time.
export function aggregateHours(rows, hours) {
  const width = hours * HOUR, out = [];
  for (let i = 0; i < rows.length;) {
    if (rows[i][0] % width) { i++; continue; }
    const group = rows.slice(i, i + hours);
    if (group.length < hours) break;
    if (group.some((r, j) => r[0] !== group[0][0] + j * HOUR)) throw Error('Lacuna no contexto horário');
    out.push([group[0][0], group[0][1], Math.max(...group.map(r => r[2])), Math.min(...group.map(r => r[3])), group.at(-1)[4], group.reduce((n, r) => n + r[5], 0)]);
    i += hours;
  }
  return out;
}

export function trendFrames(rows, hours, rule) {
  let fast, slow;
  return aggregateHours(rows, hours).map((r, i) => {
    fast = fast === undefined ? r[4] : fast + 2 / (rule.fast + 1) * (r[4] - fast);
    slow = slow === undefined ? r[4] : slow + 2 / (rule.slow + 1) * (r[4] - slow);
    return {at: r[0] + hours * HOUR, fast, slow, close: r[4], side: i + 1 < rule.minimumBars ? null : Math.sign(fast - slow)};
  });
}

export function frameAt(frames, at) {
  let lo = 0, hi = frames.length;
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (frames[mid].at <= at) lo = mid + 1; else hi = mid; }
  return frames[lo - 1] ?? null;
}

export function contextAt(frames, at, side = 0) {
  const hourly = frameAt(frames.hourly, at), fourHourly = frameAt(frames.fourHourly, at);
  const ready = hourly?.side != null && fourHourly?.side != null;
  const allowed = Boolean(ready && side && hourly.side === side && fourHourly.side === side);
  return {hourly, fourHourly, ready, allowed, reason: !ready ? 'Contexto em aquecimento' : allowed ? '1h e4h alinhados ao sinal' : 'Sinal diverge de1h ou4h'};
}

export function filterScalpSignals(prepared, frames, mode) {
  if (mode === 'observe') return prepared;
  if (mode !== 'align') throw Error('Filtro de contexto inválido');
  return {...prepared, signals: Object.fromEntries(Object.entries(prepared.signals).map(([key, signals]) => [key, signals.filter(s => contextAt(frames, s.at, s.side).allowed)]))};
}
