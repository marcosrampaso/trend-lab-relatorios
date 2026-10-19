import {HOUR} from './engine.js';
import {prepareDonchian, simulateDonchian, donchianActivity} from './donchian.js';

export function installDonchian({chartOptions, money, num, pct, dt, download}) {
  const $ = s => document.querySelector(s), root = $('#donchian-view');
  let markets, study, p, preparations, loading, ready = false, active = false;
  let period = 'newOctober', variant = 'adaptive', costCase = 'base', cursor, report, control, timer;
  let chart, candles, upper, lower, markers, equityChart, fixedLine, adaptiveLine;
  const cache = new Map();
  root.innerHTML = `
    <article class="panel prose"><span class="eyebrow">DONCHIAN · COMPARAÇÃO CONTROLADA</span>
      <h2>Uma mudança: a duração do canal.</h2>
      <p>Controle de 20 horas versus janela adaptativa de 10 a 40 horas. Volatilidade maior encurta a janela; menor alonga. As duas carteiras usam o mesmo volume mínimo, risco, stop, alvo e custos.</p>
      <p>Hipótese nossa inspirada no artigo de Joe Tay. A fórmula do autor e a gestão Agno não foram divulgadas. Este teste não replica os retornos do artigo.</p>
      <p id="don-history">Histórico ampliado em preparação.</p><p>O Donchian usa regras determinísticas; esta rodada amplia a avaliação histórica, sem treinar um modelo de aprendizado de máquina.</p>
      <button class="button secondary" id="don-ml-open">Ver modelos treinados e estratégias →</button><p id="don-loading" role="status">Abra esta aba para carregar o estudo local.</p>
    </article>
    <div id="don-content" hidden>
      <article class="panel don-study"><div class="panel-header"><div>
        <h2>Comparação histórica completa</h2><p id="don-verdict"></p>
        <p>Esta tabela revela os resultados finais. O replay abaixo mantém seu próprio relógio.</p>
      </div><button class="button subtle" id="don-export-study">Exportar estudo ↓</button><button class="button subtle" id="don-export-history">Exportar histórico ↓</button></div>
      <div class="table-scroll"><table><thead><tr><th>PERÍODO · RETROSPECTIVO</th><th>FIXO · BASE</th><th>ADAPTATIVO · BASE</th><th>FIXO · CUSTOS2X</th><th>ADAPTATIVO · CUSTOS2X</th></tr></thead><tbody id="don-comparison"></tbody></table></div>
      <p class="table-note">Cada bloco reiniciaR$300. Não somar retornos. Comparação retrospectiva, sem validação futura; outubro contém apenas 15 dias. <span id="don-scenario-count"></span> Custos 2x recalculam quantidades, decisões e pausas.</p>
      <details class="don-method"><summary>Fórmula, custos e limites da comparação</summary>
        <p>Antes do candle de sinal: N=limitar(arredondar(20×volatilidade de referência/volatilidade recente),10,40). Volatilidade recente=ATR14/preço da hora anterior; referência=média das 168 horas anteriores. O candle que gera o sinal fica fora do canal.</p>
        <p>Fechamento além da máxima/mínima dos N candles anteriores e volume&gt;1,2× a média dos 20 volumes anteriores. Stop 1,5ATR; alvo 2R (=3ATR); máximo 24h; intervalo 4h após saída. O alvo é o do nosso controle, diferente dos 2ATR do artigo.</p>
        <p>Risco 1% por operação,10x, limite diário 3% e global 10% sobre o capital inicial, verificados em fechamentos 1h. Gaps e custos podem ultrapassar limites. Queda desde o pico pode superar 10% sem ativar a pausa global. Liquidação aproximada por mark price; stop antes do alvo em conflito na mesma hora.</p>
        <p>Taxa base 0,05% e slippage 0,02% por lado, funding histórico, antes de impostos e câmbio hipotéticoR$5/USDT. Filtros de lote consultados posteriormente. Não resolve ticks, spread observado, fila ou latência.</p>
        <p id="don-registration"></p><p id="don-sources"></p>
      </details></article>
      <article class="panel scalp-controls don-controls"><div class="scalp-selects">
        <label>PERÍODO DO REPLAY<select id="don-period"></select></label>
        <label>CANAL EXIBIDO<select id="don-variant"></select></label>
        <label>CUSTOS<select id="don-cost"><option value="base">Base</option><option value="stress">Estresse · custos dobrados</option></select></label>
      </div><p class="micro">R$300 por carteira · mudar a seleção reinicia o replay. Preço e sinais de 1h; não é um teste de scalping.</p>
      <div class="replay-actions"><button class="button primary" id="don-play">▶ Reproduzir eventos</button><button class="button secondary" id="don-next">Próxima atividade →</button><button class="button secondary" id="don-hour">+1 hora</button><button class="button subtle" id="don-reset">Reiniciar</button><button class="button subtle" id="don-end">Ver período completo →</button></div>
      <p class="micro">1 evento por segundo; pula horas sem atividade e pausa ao trocar de aba. Entrada na abertura seguinte é revelada quando a hora de execução fecha.</p>
      <input class="scrubber" id="don-scrub" type="range" step="3600000" aria-label="Relógio do replay Donchian">
      <p class="scalp-clock" id="don-clock"></p><p class="context-decision" id="don-status" role="status"></p>
      </article>
      <div class="metrics"><article class="metric"><span>PATRIMÔNIO · CANAL SELECIONADO</span><strong id="don-equity"></strong><small id="don-net"></small></article><article class="metric"><span>CONTROLE FIXO · MESMO RELÓGIO</span><strong id="don-control"></strong><small id="don-difference"></small></article><article class="metric"><span>OPERAÇÕES ENCERRADAS</span><strong id="don-count"></strong><small id="don-count-note"></small></article><article class="metric"><span>QUEDA DESDE O PICO</span><strong id="don-dd"></strong><small>Verificada em fechamentos1h</small></article></div>
      <article class="panel"><div class="panel-header"><div><h2>ETHUSDT · canal e decisões</h2><p id="don-chart-note"></p></div><button id="don-export-replay" class="button subtle">Exportar replay ↓</button></div>
        <div id="don-chart" aria-label="Preço e canal Donchian de candles anteriores"></div>
        <div class="replay-bot-body"><p id="don-position"></p><div class="context-cards scalp-cards">
          <article><span>JANELA DO CANAL</span><strong id="don-window"></strong><small>Definida antes do candle de sinal</small></article>
          <article><span>CANAL ANTERIOR · USDT</span><strong id="don-channel"></strong><small>Máxima / mínima, sem candle atual</small></article>
          <article><span>VOLUME RELATIVO</span><strong id="don-volume"></strong><small>Gatilho exige&gt;1,2×</small></article>
        </div><p class="context-decision" id="don-signal"></p><p id="don-counters"></p><ol id="don-events" class="local-events scalp-events"></ol></div>
      </article>
      <article class="panel don-study"><div class="panel-header"><div><h2>Duas carteiras até o relógio atual</h2><p>Fixo em verde · adaptativo em violeta. Cada uma aplica seus próprios limites.</p></div></div><div id="don-equity-chart" aria-label="Patrimônio do controle e da variante até o relógio do replay"></div></article>
      <article class="panel don-study"><div class="panel-header"><div><h2>Operações do canal selecionado</h2><p id="don-cost-note"></p></div></div>
        <div class="table-scroll"><table><thead><tr><th>ENTRADA</th><th>SAÍDA</th><th>LADO</th><th>HORAS</th><th>MOTIVO</th><th>LÍQUIDO</th></tr></thead><tbody id="don-trades"></tbody></table></div>
      </article>
      <article class="panel prose don-study"><h2>O que o teste permite concluir</h2><p id="don-selected-verdict"></p><p>As regras foram registradas antes desta rodada, mas os preços já eram conhecidos. Não ajustamos a fórmula após consultar os resultados. Ainda é necessária observação futura para avaliar se qualquer vantagem persiste. A gestão por IA é uma hipótese separada.</p></article>
    </div>`;
  $('#don-ml-open').onclick=()=>document.querySelector('[data-view="ml"]').click();
  const def = () => p.periods.find(x => x.id === period);
  const compute = (v, t, end = false) => simulateDonchian(markets.get(def().source), {protocol: p, variant: v, costCase,
    start: Date.parse(def().start), until: t, prepared: preparations.get(def().source), closeAtEnd: end});
  function full() {
    const key = [period, variant, costCase].join('/');
    if (!cache.has(key)) cache.set(key, compute(variant, Date.parse(def().end), true));
    return cache.get(key);
  }
  function pause() { clearInterval(timer); timer = null; $('#don-play').textContent = '▶ Reproduzir eventos'; }
  function reset() { pause(); cursor = Date.parse(def().start) + HOUR; render(); }
  function next() {
    const end = Date.parse(def().end);
    cursor = donchianActivity(full()).find(e => e.knownAt > cursor && e.knownAt <= end)?.knownAt ?? end;
    render(); if (cursor === end || report.halted) pause();
  }
  const find = (period, variant, cost = 'base') => study.scenarios.find(s => s.period === period && s.variant === variant && s.costCase === cost);
  function tables() {
    $('#don-scenario-count').textContent='Todos os '+study.scenarios.length+' cenários são exibidos.';
    $('#don-history').textContent='Banco histórico: '+new Date(study.history.firstOpen).toLocaleDateString('pt-BR',{timeZone:'UTC'})+' até '+new Date(study.history.until-1).toLocaleDateString('pt-BR',{timeZone:'UTC'})+' UTC · '+study.history.candles.toLocaleString('pt-BR')+' candles de 1h · '+p.periods.length+' blocos. Janeiro 2020 é aquecimento; os testes começam em fevereiro. Os quatro blocos antigos preservam seu arquivo e aquecimento originais.';
    const improved = p.periods.filter(x => find(x.id, 'adaptive').pnlUSDT > find(x.id, 'fixed').pnlUSDT).length;
    const stressLost = p.periods.filter(x => find(x.id, 'adaptive', 'stress').pnlUSDT < 0).length;
    $('#don-verdict').textContent = 'Adaptativo superou o fixo em ' + improved + '/' + p.periods.length + ' blocos no custo base. Com custos dobrados, perdeu em ' + stressLost + '/' + p.periods.length + '. A melhora depende do período e dos custos.';
    $('#don-comparison').innerHTML = p.periods.map(x => '<tr><td>' + x.label + '</td>' + ['base', 'stress'].map(c => ['fixed', 'adaptive'].map(v => {
      const s = find(x.id, v, c);
      return '<td class="' + (s.pnlUSDT < 0 ? 'negative' : 'positive') + '">' + money(s.pnlUSDT * p.fx) + '<small>' + pct(s.returnPct) + ' · ' + s.count + ' operações<br>DD ' + num(s.maxDD * 100) + '%' + (s.halted ? s.liquidations ? ' · pausa por liquidação estimada' : ' · pausa global' : '') + '</small></td>';
    }).join('')).join('') + '</tr>').join('');
    $('#don-registration').textContent = 'Protocolo ' + p.version + ' · registrado ' + dt(Date.parse(p.registeredAt)) + ' · SHA256 ' + study.registration.protocolSHA256.slice(0, 16) + '. Controle reproduz integralmente as operações do estudo anterior. Sem alteração do bot prospectivo.';
    for (const s of p.sources) {
      const a = document.createElement('a'); a.href = s.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = s.title + ' ↗ '; $('#don-sources').append(a);
    }
  }
  function charts() {
    const L = window.LightweightCharts;
    chart = L.createChart($('#don-chart'), chartOptions());
    candles = chart.addSeries(L.CandlestickSeries, {upColor:'#5fd2b0', downColor:'#db7d86', borderVisible:false, wickUpColor:'#5fd2b0', wickDownColor:'#db7d86', priceLineVisible:false});
    const opts = {lineWidth:1, priceLineVisible:false, lastValueVisible:false};
    upper = chart.addSeries(L.LineSeries, {...opts, color:'#f4b36a'});
    lower = chart.addSeries(L.LineSeries, {...opts, color:'#a395df'});
    markers = L.createSeriesMarkers(candles, []);
    equityChart = L.createChart($('#don-equity-chart'), chartOptions());
    fixedLine = equityChart.addSeries(L.LineSeries, {...opts, color:'#5fd2b0'});
    adaptiveLine = equityChart.addSeries(L.LineSeries, {...opts, color:'#a395df'});
  }
  function render() {
    if (!ready) return;
    const end = Date.parse(def().end), complete = cursor === end;
    control = compute('fixed', cursor, complete);
    const adaptive = compute('adaptive', cursor, complete);
    report = variant === 'fixed' ? control : adaptive;
    const bars = preparations.get(def().source)[variant].filter(b => b.at <= cursor), b = bars.at(-1), visible = bars.slice(-120), first = visible[0]?.at ?? cursor;
    $('#don-clock').textContent = dt(cursor) + ' · ' + def().label + ' · São Paulo · ' + (complete ? 'fim do período' : 'futuro oculto no replay');
    $('#don-scrub').min = Date.parse(def().start) + HOUR; $('#don-scrub').max = end; $('#don-scrub').value = cursor;
    $('#don-status').textContent = report.halted ? 'Entradas pausadas desde ' + dt(report.haltAt) + ': ' + (report.events.find(e=>e.kind==='halt')?.reason ?? 'limite de risco') + '. Nenhuma nova entrada neste bloco.'
      : complete ? 'Período concluído; posições remanescentes foram encerradas para reconciliar o resultado.'
      : report.blocked ? 'Limite diário atingido. Entradas pausadas até o próximo diaUTC.'
      : report.position ? 'Posição aberta: acompanhando stop, alvo, sinal contrário e máximo 24h. Sinais no mesmo sentido não aumentam a exposição.'
      : report.pending ? 'Sinal confirmado. A próxima hora completa revelará a avaliação de entrada, sujeita a risco e intervalo 4h.'
      : 'Aguardando rompimento e volume; entradas também respeitam tamanho mínimo e intervalo 4h.';
    for (const id of ['don-next','don-hour','don-end']) $('#' + id).disabled = complete;
    $('#don-play').disabled = complete || report.halted;
    $('#don-equity').textContent = money(report.final * p.fx); $('#don-net').textContent = money(report.pnl * p.fx) + ' · ' + pct(report.returnPct);
    $('#don-control').textContent = money(control.final * p.fx); $('#don-difference').textContent = 'Diferença adaptativo − fixo: ' + money((adaptive.pnl - control.pnl) * p.fx);
    $('#don-count').textContent = report.trades.length; $('#don-count-note').textContent = report.position ? '1 posição aberta' : 'Sem posição aberta'; $('#don-dd').textContent = num(report.maxDD * 100) + '%';
    candles.setData(visible.map(x => ({time:x.at / 1000, open:x.open, high:x.high, low:x.low, close:x.close})));
    upper.setData(visible.filter(x => x.upper !== null).map(x => ({time:x.at / 1000, value:x.upper})));
    lower.setData(visible.filter(x => x.lower !== null).map(x => ({time:x.at / 1000, value:x.lower})));
    markers.setMarkers(donchianActivity(report).filter(e => ['entry','exit'].includes(e.kind) && e.knownAt >= first && e.knownAt <= cursor).map(e => ({time:e.knownAt / 1000, position:e.kind === 'entry' ? (e.side === 1 ? 'belowBar' : 'aboveBar') : (e.side === 1 ? 'aboveBar' : 'belowBar'), color:e.kind === 'entry' ? '#f4b36a' : '#a0afc1', shape:e.kind === 'entry' ? (e.side === 1 ? 'arrowUp' : 'arrowDown') : 'circle', text:e.kind === 'entry' ? 'Entrada' : 'Saída'})));
    chart.timeScale().fitContent();
    const curve = r => [{time:r.start / 1000, value:r.initial * p.fx}, ...r.equity.filter((x, i) => i % 6 === 0 || i === r.equity.length - 1).map(x => ({time:x.time / 1000, value:x.value * p.fx}))];
    fixedLine.setData(curve(control)); adaptiveLine.setData(curve(adaptive)); equityChart.timeScale().fitContent();
    $('#don-chart-note').textContent = 'Últimas 120 horas conhecidas · ' + p.variants.find(x => x.id === variant).name + ' · limite superior em âmbar, inferior em violeta';
    $('#don-window').textContent = b?.ready ? b.lookback + ' horas' : 'Aquecendo';
    $('#don-channel').textContent = b?.upper != null ? num(b.upper) + ' / ' + num(b.lower) : '—'; $('#don-volume').textContent = b?.rvol != null ? num(b.rvol) + '×' : '—';
    const position = report.position;
    $('#don-position').textContent = position ? (position.side === 1 ? 'LONG' : 'SHORT') + ' · ' + num(position.qty, 3) + ' ETH · entrada ' + num(position.entry) + ' · stop ' + num(position.stop) + ' · alvo ' + num(position.target) + ' USDT' : 'Sem posição aberta';
    const sig = report.signals.at(-1), entry = sig && report.events.find(e => e.at === sig.at && ['entry','rejected'].includes(e.kind));
    $('#don-signal').textContent = sig ? 'Último sinal ' + (sig.side === 1 ? 'LONG' : 'SHORT') + ' · ' + dt(sig.at) + ' · janela ' + sig.lookback + 'h · RVOL ' + num(sig.rvol) + '×. ' + (entry?.kind === 'entry' ? 'Entrada executada na simulação.' : entry?.reason ?? (report.halted ? 'Pausa de risco impede novas entradas.' : sig.at === cursor && position?.side === sig.side ? 'Posição no mesmo sentido já aberta; sem aumento de exposição.' : sig.at === cursor ? 'Aguardando próxima hora completa para avaliar entrada.' : 'Sem nova entrada: posição, pausa ou intervalo entre operações.')) : 'Nenhum rompimento com volume aprovado neste bloco até este relógio.';
    $('#don-counters').textContent = report.equity.length + ' horas avaliadas · ' + report.signals.length + ' sinais · ' + report.events.filter(e => e.kind === 'entry').length + ' entradas · ' + report.rejected + ' rejeições';
    $('#don-events').replaceChildren();
    for (const e of donchianActivity(report).filter(e => e.knownAt <= cursor).slice(-8).reverse()) {
      const li = document.createElement('li'); li.textContent = dt(e.knownAt) + ' · ' + (e.kind === 'signal' ? 'Sinal ' + (e.side === 1 ? 'LONG' : 'SHORT') + ' · canal ' + e.lookback + 'h' : e.kind === 'entry' ? 'Entrada simulada a ' + num(e.price) : e.reason); $('#don-events').append(li);
    }
    $('#don-trades').innerHTML = report.trades.length ? report.trades.slice(-50).reverse().map(t => '<tr><td>' + dt(t.entryAt) + '</td><td>' + dt(t.exitAt) + '</td><td>' + (t.side === 1 ? 'LONG' : 'SHORT') + '</td><td>' + num((t.exitAt - t.entryAt) / HOUR, 0) + '</td><td>' + t.reason + '</td><td class="' + (t.net < 0 ? 'negative' : 'positive') + '">' + money(t.net * p.fx) + '</td></tr>').join('') : '<tr><td colspan="6">Nenhuma operação encerrada neste relógio.</td></tr>';
    $('#don-cost-note').textContent = 'Até 50 operações recentes · taxas ' + money(report.fees * p.fx) + ' · slippage ' + money(report.trades.reduce((s,t) => s + t.slippageCost, 0) * p.fx) + ' (encerradas) · funding líquido ' + money(report.fundingNet * p.fx);
    const a = study.audits.find(x => x.period === period && x.variant === variant), base = find(period, variant), stress = find(period, variant, 'stress');
    $('#don-selected-verdict').textContent = def().label + ' · ' + p.variants.find(x => x.id === variant).name + ': resultado final base ' + money(base.pnlUSDT * p.fx) + '; custos 2x nas mesmas operações ' + money(a.stressPnL * p.fx) + '; carteira recalculada com custos 2x ' + money(stress.pnlUSDT * p.fx) + '. A auditoria com operações fixas é sensibilidade contábil, não outra carteira executável.';
    try { localStorage.setItem('tl-donchian-v1', JSON.stringify({period, variant, costCase, cursor})); } catch {}
  }
  async function load() {
    if (ready) return; if (loading) return loading;
    loading = (async () => {
      try {
        $('#don-loading').textContent = 'Carregando histórico de 2020–2026 e comparação ampliada…';
        const response = await fetch('./data/donchian-history-results.json');
        if (!response.ok) throw Error('Estudo local indisponível');
        study = await response.json(); p = study.protocol;
        const files=[...new Set(p.periods.map(x=>x.source))];
        markets=new Map(await Promise.all(files.map(async file=>{const r=await fetch('./'+file.replace(/^web\//,''));if(!r.ok)throw Error('Histórico local indisponível');return[file,await r.json()];})));
        preparations=new Map([...markets].map(([file,data])=>[file,prepareDonchian(data.candles,p)]));
        for (const x of p.periods) $('#don-period').add(new Option(x.label, x.id));
        for (const x of p.variants) $('#don-variant').add(new Option(x.name, x.id));
        try {
          const saved = JSON.parse(localStorage.getItem('tl-donchian-v1'));
          if (saved && p.periods.some(x => x.id === saved.period) && p.variants.some(x => x.id === saved.variant) && p.costCases.some(x => x.id === saved.costCase)) ({period, variant, costCase, cursor} = saved);
        } catch {}
        const start = Date.parse(def().start), end = Date.parse(def().end);
        if (!Number.isFinite(cursor) || cursor < start + HOUR || cursor > end || cursor % HOUR !== 0) cursor = start + HOUR;
        $('#don-period').value = period; $('#don-variant').value = variant; $('#don-cost').value = costCase;
        $('#don-content').hidden = false; charts(); ready = true; tables(); render();
        $('#don-loading').textContent = 'Estudo concluído. Replay começa pausado; nenhuma ordem é enviada.';
      } catch (e) { $('#don-loading').textContent = 'Falha ao iniciar: ' + e.message; loading = null; }
    })(); return loading;
  }
  $('#don-period').onchange = e => { period = e.target.value; reset(); };
  $('#don-variant').onchange = e => { variant = e.target.value; reset(); };
  $('#don-cost').onchange = e => { costCase = e.target.value; reset(); };
  $('#don-reset').onclick = reset; $('#don-hour').onclick = () => { pause(); cursor = Math.min(cursor + HOUR, Date.parse(def().end)); render(); };
  $('#don-next').onclick = () => { pause(); next(); }; $('#don-end').onclick = () => { pause(); cursor = Date.parse(def().end); render(); };
  $('#don-scrub').oninput = e => { pause(); cursor = Number(e.target.value); render(); };
  $('#don-play').onclick = () => { if (timer) { pause(); return; } $('#don-play').textContent = 'Ⅱ Pausar'; timer = setInterval(next, 1000); };
  $('#don-export-history').onclick = () => download('trend-lab-eth-historico-2020-2026.json',JSON.stringify(markets.get(p.source)),'application/json');
  $('#don-export-study').onclick = () => download('trend-lab-donchian-historico.json', JSON.stringify(study, null, 2), 'application/json');
  $('#don-export-replay').onclick = () => download('trend-lab-donchian-replay.json', JSON.stringify({asOf:new Date(cursor).toISOString(), period, variant, costCase, report, control}, null, 2), 'application/json');
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  window.addEventListener('trend-view-change', e => { active = e.detail.view === 'donchian'; if (!active) pause(); });
  return {async show() { active = true; await load(); if (active && ready) render(); }, pause};
}
