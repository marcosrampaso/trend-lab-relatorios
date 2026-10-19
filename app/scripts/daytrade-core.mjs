import {intradayBars} from '../web/strategies.js';import {prepareDonchian} from '../web/donchian.js';import {simulateAdaptive} from '../web/research-adaptive-funding.js';
import {sentimentAt,summarizeMulti} from './multiasset-core.mjs';import {btcBiasAt} from './btc-context-core.mjs';import {volatilityVeto} from '../web/filters.js';import {digest,validateCandles} from './news-filter-core.mjs';
export const HOUR=3600000,MINUTE=60000;
export function daytradeSignals(hourly,donchian,until=Infinity){
 const closed=hourly.filter(r=>r[0]+HOUR<=until),d=prepareDonchian(closed,donchian,until),trend=intradayBars(closed,until,'trend1h');
 const pack=bars=>bars.filter(b=>b.ready&&b.cross).map(b=>({signalAt:b.at,side:b.cross,price:b.close,atr:b.atr,lookback:b.lookback??null,rvol:b.rvol??null}));
 return {'trend1h':pack(trend),'donchian-fixed':pack(d.fixed),'donchian-adaptive':pack(d.adaptive)};
}
export function distinctHeadlines(rows){
 const urls=new Set(),titles=new Set(),out=[];
 for(const r of [...rows].sort((a,b)=>a.firstSeenAt-b.firstSeenAt||a.classifiedAt-b.classifiedAt||String(a.id).localeCompare(String(b.id)))){
  let url;try{const u=new URL(r.url);if(u.protocol!=='https:')continue;u.hash='';u.search='';url=u.origin+u.pathname.replace(/\/$/,'');}catch{continue;}
  const title=String(r.title??'').toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu,' ').trim();if(!title||urls.has(url)||titles.has(title))continue;urls.add(url);titles.add(title);out.push(r);
 }return out;
}
export function dayBtcAt(frames,at,side,symbol,policy){
 const b=btcBiasAt(frames,at,side,policy);if(symbol==='ETHUSDT')return b;
 const c=b.context,ready=!!c&&at-c.at<HOUR&&c.btcTrend1h!=null&&c.btcTrend4h!=null,veto=ready&&!!side&&c.btcTrend1h===-side&&c.btcTrend4h===-side;
 return {...b,ready,coupled:null,veto,reason:!ready?'BTC próprio: contexto indisponível':veto?'BTC próprio:1h/4h contra a entrada':'BTC próprio: sem oposição conjunta1h/4h'};
}
export function freezeDayBatch({symbol,signalAt,signals,articles,btcFrames,observedAt,registration}){
 const p=registration.protocol,entryAt=signalAt+p.entryDelayMinutes*MINUTE;if(signalAt<registration.registeredAt||entryAt<p.start||entryAt>=p.end||observedAt<signalAt+p.closedHourBufferSeconds*1000||observedAt>=entryAt)return null;
 const rows=p.strategies.map(def=>{const s=signals[def.id]?.find(s=>s.signalAt===signalAt)??{signalAt,side:0,price:null,atr:null};return {...s,strategy:def.id,sentiment:sentimentAt(distinctHeadlines(articles),{symbol,observedAt,entryAt,side:s.side,policy:p.sentiment}),btc:dayBtcAt(btcFrames,signalAt,s.side,symbol,p.btcPolicy)};});
 const b={symbol,signalAt,entryAt,observedAt,rows,protocolSHA256:registration.protocolSHA256};return {...b,payloadSHA256:digest(b)};
}
export function dayExecutionSignals(batches,reg,arm,variant,cost){
 const p=reg.protocol,seen=new Set(),out=[];
 if(!p.variants.includes(variant))throw Error('Unknown daytrade variant');
 for(const b of batches){const {payloadSHA256,...payload}=b;if(b.symbol!==arm.symbol||digest(payload)!==payloadSHA256||b.protocolSHA256!==reg.protocolSHA256||seen.has(b.signalAt))throw Error('Daytrade decision integrity mismatch');seen.add(b.signalAt);
  if(b.signalAt<reg.registeredAt||b.observedAt<b.signalAt+p.closedHourBufferSeconds*1000||b.observedAt>=b.entryAt||b.entryAt!==b.signalAt+p.entryDelayMinutes*MINUTE)throw Error('Noncausal daytrade decision');
  const s=b.rows.find(r=>r.strategy===arm.strategy);if(!s||s.signalAt!==b.signalAt)throw Error('Missing strategy decision');if(!s.side)continue;
  if(![-1,1].includes(s.side)||!(s.atr>0)||!(s.price>0)||s.btc.context?.at>b.signalAt||s.btc.context?.btcTrend4hAt>b.signalAt)throw Error('Invalid/future daytrade context');
  const costVeto=volatilityVeto(s,{...p.strategy,...cost},p.minimumCostRatio),sentimentVeto=['sentiment','combined'].includes(variant)&&s.sentiment.veto,btcVeto=['btc-context','combined'].includes(variant)&&s.btc.veto;
  out.push({at:b.entryAt,knownAt:b.observedAt,family:'cross',side:s.side,atr:s.atr,holdMinutes:p.maxHoldMinutes,entryAllowed:!costVeto&&!sentimentVeto&&!btcVeto,context:{strategy:arm.strategy,costVeto:!!costVeto,sentimentVeto,btcVeto,sourceSignalAt:b.signalAt}});
 }return out.sort((a,b)=>a.at-b.at);
}
export function daySummary(r,fx){
 const s=summarizeMulti(r,fx);return {...s,grossBRL:r.trades.reduce((n,t)=>n+t.gross,0)*fx,slippageBRL:r.trades.reduce((n,t)=>n+t.slippageCost,0)*fx,avgHoldHours:r.trades.length?r.trades.reduce((n,t)=>n+(t.exitAt-t.entryAt)/HOUR,0)/r.trades.length:null,maxHoldHours:r.trades.length?Math.max(...r.trades.map(t=>(t.exitAt-t.entryAt)/HOUR)):null};
}
export function evaluateDayArm(reg,batches,market,until,arm){
 const p=reg.protocol,asOf=Math.max(p.start,Math.min(until,p.end)),data={...market,filters:arm.filters,candles:market.candles.filter(r=>r[0]>=p.start&&r[0]+MINUTE<=asOf),marks:market.marks.filter(r=>r[0]>=p.start&&r[0]+MINUTE<=asOf)};
 validateCandles(data.candles,p.start,asOf,MINUTE);validateCandles(data.marks,p.start,asOf,MINUTE);const scenarios=[];
 for(const variant of p.variants)for(const cost of p.strategy.costCases){const signals=dayExecutionSignals(batches,reg,arm,variant,cost),r=simulateAdaptive(data,{start:p.start,until:asOf,protocol:p.strategy,cost,signals,closeAtEnd:asOf===p.end});scenarios.push({variant,cost:cost.id,...daySummary(r,p.strategy.fx),vetoedSignals:signals.filter(s=>s.context.btcVeto||s.context.sentimentVeto||s.context.costVeto).length});}
 const elapsed=batches.filter(b=>b.entryAt+MINUTE<=asOf),rows=elapsed.flatMap(b=>b.rows.filter(s=>s.strategy===arm.strategy&&s.side)),expectedSlots=Math.max(0,Math.floor((asOf-p.start-MINUTE)/HOUR)+1);
 return {...arm,scenarios,coverage:{registered:elapsed.length,expectedSlots,missedSlots:Math.max(0,expectedSlots-elapsed.length),directional:rows.length,newsCovered:rows.filter(s=>s.sentiment.covered).length,directionalNews:rows.filter(s=>s.sentiment.directionalCovered).length},decisions:batches.slice(-30).map(b=>({signalAt:b.signalAt,entryAt:b.entryAt,observedAt:b.observedAt,row:b.rows.find(r=>r.strategy===arm.strategy)}))};
}
