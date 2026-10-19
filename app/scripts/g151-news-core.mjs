import {prepareScalping,FIVE,MINUTE} from '../web/scalping.js';
import {scalpFeatures,scalpTrendFrames} from '../web/scalp-tree.js';
import {regimeFor} from '../web/adaptive-policy.js';
import {simulateAdaptive} from '../web/research-adaptive-funding.js';
import {assessNews,digest,validateCandles} from './news-filter-core.mjs';

export function latestG151Signals(five,hourly,signalAt,strategy,trend){
 const closedFive=five.filter(r=>r[0]+FIVE<=signalAt),closedHourly=hourly.filter(r=>r[0]+3600000<=signalAt);
 if(!closedFive.length||closedFive.at(-1)[0]+FIVE!==signalAt)throw Error('Último candle5m fechado indisponível');
 const prepared=prepareScalping({five:closedFive},strategy),frames=scalpTrendFrames(closedHourly,trend);
 const signals=Object.entries(prepared.signals).flatMap(([family,rows])=>rows.filter(s=>s.at===signalAt).map(s=>({family,signalAt:s.at,side:s.side,price:s.price,atr:s.atr,target:s.target,feature:scalpFeatures(s.context,s.side,frames,strategy)})));
 const bar=prepared.bars.at(-1);
 return {signals,context:{at:signalAt,close:bar.close,rsi:bar.rsi,atr:bar.atr,rvol:bar.rvol,ready:bar.ready}};
}

export function freezeG151Batch(raw,scores,updates,observedAt,registration){
 const p=registration.protocol,signalAt=raw.context.at,entryAt=signalAt+MINUTE;
 if(signalAt<p.firstSignalAt||entryAt<p.start||entryAt>=p.end||observedAt<signalAt||observedAt>=entryAt||signalAt<registration.registeredAt)return null;
 const rows=raw.signals.map((s,i)=>{
  const regime=regimeFor(s.feature,p.genome),route=regime?p.genome.routes[regime]:null,score=scores.find(v=>v.id===s.family+'/'+signalAt)?.score??null;
  if(score!=null&&(!Number.isFinite(score)||score<0||score>1))throw Error('Score G151 inválido');
  const active=!!route&&route.family===s.family;
  if(active&&s.feature&&route.threshold>0&&score==null)throw Error('Modelo ativo sem predição');
  const allowed=!!(active&&(route.threshold===0||score>=route.threshold&&score!=null));
  const news=assessNews(updates,{observedAt,entryAt,side:s.side});
  return {...s,id:s.family+'/'+signalAt,entryAt,observedAt,regime,score,threshold:active?route.threshold:null,modelAllowed:allowed,modelReason:!regime?'Contexto1h/4h indisponível':!active?'Família não escolhida para o regime':!allowed?'Score abaixo do limiar':'G151 liberou entrada',holdMinutes:active?route.hold:30,news:structuredClone(news)};
 });
 const batch={id:String(signalAt),signalAt,entryAt,observedAt,context:raw.context,rows,protocolSHA256:registration.protocolSHA256};
 return {...batch,payloadSHA256:digest(batch)};
}

export function executionSignals(batches,registration,withNews=false){
 const out=[],seen=new Set();
 for(const batch of batches){
  if(seen.has(batch.signalAt))throw Error('Fechamento G151 duplicado');seen.add(batch.signalAt);
  const {payloadSHA256,...payload}=batch;
  if(digest(payload)!==payloadSHA256||batch.protocolSHA256!==registration.protocolSHA256)throw Error('Integridade do sinal G151 divergiu');
  if(batch.observedAt>=batch.entryAt||batch.signalAt<registration.registeredAt||batch.entryAt!==batch.signalAt+MINUTE)throw Error('Sinal G151 não prospectivo');
  for(const s of batch.rows){
   if(s.feature&&(s.feature.at!==batch.signalAt||s.feature.hourlyAt>batch.signalAt||s.feature.fourHourlyAt>batch.signalAt))throw Error('Feature futura');
   out.push({at:batch.entryAt,knownAt:batch.observedAt,family:s.family,side:s.side,atr:s.atr,target:s.target,price:s.price,holdMinutes:s.holdMinutes,regime:s.regime,entryAllowed:s.modelAllowed&&!(withNews&&s.news.veto),sourceSignalAt:batch.signalAt,context:{score:s.score,modelReason:s.modelReason,newsVeto:withNews&&s.modelAllowed&&s.news.veto}});
  }
 }
 return out.sort((a,b)=>a.at-b.at||a.family.localeCompare(b.family));
}

export function evaluateG151(registration,batches,market,until){
 const p=registration.protocol,asOf=Math.max(p.start,Math.min(until,p.end)),candles=market.candles.filter(r=>r[0]>=p.start&&r[0]+MINUTE<=asOf),marks=market.marks.filter(r=>r[0]>=p.start&&r[0]+MINUTE<=asOf);
 validateCandles(candles,p.start,asOf,MINUTE);validateCandles(marks,p.start,asOf,MINUTE);
 const scenarios=[];
 for(const variant of ['control','news-filter'])for(const cost of p.costCases){
  const signals=executionSignals(batches,registration,variant==='news-filter');
  const r=simulateAdaptive({candles,marks,funding:market.funding,filters:p.exchangeFilters},{start:p.start,until:asOf,protocol:p.strategy,cost,signals,closeAtEnd:asOf===p.end});
  const vetoed=signals.filter(s=>s.context.newsVeto).length;
  scenarios.push({variant,cost:cost.id,initial:r.initial,final:r.final,pnlBRL:r.pnl*p.config.fx,returnPct:r.returnPct,maxDD:r.maxDD,count:r.trades.length,feesBRL:r.fees*p.config.fx,fundingBRL:r.fundingNet*p.config.fx,position:r.position,halted:r.halted,newsVetoes:vetoed,newsVetoesMeaning:'Sinais liberados pelo G151 vetados por notícias; não necessariamente entradas que ocorreriam com posição/cooldown.',trades:r.trades,equity:r.equity.filter((_,i)=>i%5===0||i===r.equity.length-1).map(e=>({at:e.time,brl:e.value*p.config.fx}))});
 }
 const elapsed=batches.filter(b=>b.entryAt+MINUTE<=asOf),rows=elapsed.flatMap(b=>b.rows),allowed=rows.filter(r=>r.modelAllowed),expectedSlots=Math.max(0,Math.floor((asOf-p.start-MINUTE)/FIVE)+1);
 const coverage={registered:elapsed.length,expectedSlots,missedHours:0,missedSlots:Math.max(0,expectedSlots-elapsed.length),directional:rows.length,modelAllowed:allowed.length,modelBlocked:rows.length-allowed.length,covered:allowed.filter(r=>r.news.covered).length,directionalCovered:allowed.filter(r=>r.news.directionalCovered).length,registeredVetoes:allowed.filter(r=>r.news.veto).length};
 const decisions=batches.slice(-100).flatMap(b=>b.rows.length?b.rows.map(s=>({...s,signal:{side:s.side},signalAt:b.signalAt})): [{signalAt:b.signalAt,entryAt:b.entryAt,observedAt:b.observedAt,signal:{side:0},news:{reason:'Sem gatilho técnico neste fechamento5m',assessment:null,veto:false},modelReason:'Sem gatilho'}]);
 return {asOf:candles.length?asOf:null,complete:asOf===p.end,coverage,scenarios,decisions:decisions.slice(-100),latestContext:batches.at(-1)?.context??null,deltas:p.costCases.map(c=>({cost:c.id,pnlBRL:scenarios.find(s=>s.variant==='news-filter'&&s.cost===c.id).pnlBRL-scenarios.find(s=>s.variant==='control'&&s.cost===c.id).pnlBRL})),conclusion:'Inconclusivo: G151 em acompanhamento prospectivo, sem garantia ou promoção automática.',realOrders:false,trainedBERT:false};
}
