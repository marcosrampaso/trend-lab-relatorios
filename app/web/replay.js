// Navigation may inspect the historical timeline, but only advances the clock.
// Prices, decisions and balances are always recomputed using that new cutoff.
export const REPLAY_HOUR=3600000;
export function eventVisibleAt(e){
  if(['entry','rejected','filtered'].includes(e.kind))return e.at+REPLAY_HOUR;
  if(e.kind==='exit'&&['Cruzamento contrário','Encerramento do teste'].includes(e.reason))return e.at+REPLAY_HOUR;
  if(e.kind==='exit'&&e.reason?.startsWith('Limite de '))return e.at+REPLAY_HOUR;
  return e.at;
}
export function replayActivity(report){
  return [...report.signals.map(s=>({at:s.at,kind:'signal',side:s.side,visibleAt:s.at})),...report.events.map(e=>({...e,visibleAt:eventVisibleAt(e)}))].sort((a,b)=>a.visibleAt-b.visibleAt||a.at-b.at);
}
export function nextReplayTime(report,cursor,end){
  return replayActivity(report).find(e=>e.visibleAt>cursor&&e.visibleAt<=end)?.visibleAt??null;
}
export function replayStatus(r,cursor,end){
  if(r.halted)return 'Entradas pausadas pelo limite global de risco.';
  if(r.blocked)return 'Entradas pausadas pelo limite diário de risco.';
  if(r.position)return 'Posição simulada aberta; acompanhando stop e regras de saída.';
  if(r.pending)return cursor>=end?'Sinal confirmado no fim dos dados. Falta o candle seguinte para simular a execução.':'Sinal confirmado. A execução será revelada quando o candle seguinte estiver completo.';
  const last=r.events.at(-1);
  if(last?.kind==='rejected')return 'Última tentativa rejeitada: '+last.reason+'. Aguardando novo sinal.';
  return r.signals.length?'Sem posição. Aguardando novo cruzamento e respeitando eventuais pausas da estratégia.':'Bot avaliando candles fechados. Ainda não houve novo cruzamento neste período.';
}
