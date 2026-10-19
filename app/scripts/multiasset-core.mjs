import {digest} from './news-filter-core.mjs';
import {latestG151Signals} from './g151-news-core.mjs';
import {regimeFor} from '../web/adaptive-policy.js';
import {simulateAdaptive} from '../web/research-adaptive-funding.js';
import {prepareScalping,MINUTE,FIVE} from '../web/scalping.js';
import {scalpTrendFrames,scalpFeatures} from '../web/scalp-tree.js';

export function aggregateRows(rows,step){
 const groups=new Map();for(const r of rows){const t=Math.floor(r[0]/step)*step;if(!groups.has(t))groups.set(t,[]);groups.get(t).push(r);}
 return [...groups].filter(([t,a])=>a.length===step/MINUTE&&a.every((r,i)=>r[0]===t+i*MINUTE)).map(([t,a])=>[t,a[0][1],Math.max(...a.map(r=>r[2])),Math.min(...a.map(r=>r[3])),a.at(-1)[4],a.reduce((n,r)=>n+r[5],0),a.reduce((n,r)=>n+r[6],0),a.reduce((n,r)=>n+r[7],0)]);
}
export function historicalSignals(candles,strategy,trend){
 const five=aggregateRows(candles,FIVE),hourly=aggregateRows(candles,60*MINUTE),prepared=prepareScalping({five},strategy),frames=scalpTrendFrames(hourly,trend);
 return Object.entries(prepared.signals).flatMap(([family,rows])=>rows.map(s=>({family,signalAt:s.at,side:s.side,price:s.price,atr:s.atr,target:s.target,feature:scalpFeatures(s.context,s.side,frames,strategy)}))).sort((a,b)=>a.signalAt-b.signalAt||a.family.localeCompare(b.family));
}
export function sentimentAt(articles,{symbol,observedAt,entryAt,side,policy}){
 const unique=new Map();for(const a of articles){
  if(!a.id||a.revision!==policy.revision||a.language!=='en'||!a.assets?.includes(symbol)||!a.url?.startsWith('https://'))continue;
  const times=[a.publishedAt,a.firstSeenAt,a.classifiedAt];if(!times.every(Number.isFinite)||times.some(t=>t>observedAt)||a.publishedAt>a.firstSeenAt||a.firstSeenAt>a.classifiedAt||entryAt>=a.publishedAt+policy.ttlMinutes*MINUTE)continue;
  const s=a.scores;if(!s||!['positive','negative','neutral'].every(k=>Number.isFinite(s[k])&&s[k]>=0&&s[k]<=1)||Math.abs(s.positive+s.negative+s.neutral-1)>1e-4)continue;
  if(!unique.has(a.id))unique.set(a.id,a);
 }
 const recent=[...unique.values()],directional=recent.filter(a=>Math.max(a.scores.positive,a.scores.negative)>=policy.minimumDirectionalConfidence),publishers=new Set(directional.map(a=>a.publisher)),eligible=directional.length>=policy.minimumArticles&&publishers.size>=policy.minimumPublishers,mean=directional.length?directional.reduce((n,a)=>n+a.scores.positive-a.scores.negative,0)/directional.length:null;
 const bias=eligible&&Math.abs(mean)>=policy.minimumAbsoluteMean?(mean>0?'positive':'negative'):'uncertain',veto=side===1&&bias==='negative'||side===-1&&bias==='positive';
 return {covered:recent.length>0,directionalCovered:eligible&&bias!=='uncertain',bias,mean,veto,reason:!recent.length?'Sem manchete válida para o ativo':!eligible?'Amostra/confiança/fontes insuficientes':bias==='uncertain'?'Sentimento neutro ou conflitante':veto?'Sentimento contrário: veta somente nova entrada':'Sentimento compatível',articles:recent.map(a=>({id:a.id,title:a.title,url:a.url,publisher:a.publisher,publishedAt:a.publishedAt,firstSeenAt:a.firstSeenAt,classifiedAt:a.classifiedAt,scores:structuredClone(a.scores)})),revision:policy.revision};
}
export function routeRow(s,score,genome){
 if(score!=null&&(!Number.isFinite(score)||score<0||score>1))throw Error('Invalid forest score');
 const regime=regimeFor(s.feature,genome),arm=regime?genome.routes[regime]:null,active=arm?.family===s.family;
 if(active&&s.feature&&arm.threshold>0&&!Number.isFinite(score))throw Error('Active model prediction missing');
 return {...s,regime,score:score??null,holdMinutes:active?arm.hold:30,modelAllowed:Boolean(active&&(arm.threshold===0||score>=arm.threshold))};
}
export function freezeMultiBatch(raw,scores,articles,observedAt,registration,arm){
 const p=registration.protocol,signalAt=raw.context.at,entryAt=signalAt+MINUTE;
 if(signalAt<registration.registeredAt||entryAt<p.start||entryAt>=p.end||observedAt<signalAt||observedAt>=entryAt)return null;
 const rows=raw.signals.map(s=>({...routeRow(s,scores.find(x=>x.id===s.family+'/'+signalAt)?.score,p.genome),sentiment:sentimentAt(articles,{symbol:arm.symbol,observedAt,entryAt,side:s.side,policy:p.sentiment})}));
 const b={arm:arm.id,symbol:arm.symbol,signalAt,entryAt,observedAt,context:raw.context,rows,protocolSHA256:registration.protocolSHA256};return {...b,payloadSHA256:digest(b)};
}
export function multiExecutionSignals(batches,registration,arm,withSentiment=false){
 const seen=new Set(),out=[];
 for(const b of batches){const {payloadSHA256,...payload}=b;
  if(b.arm!==arm.id||b.symbol!==arm.symbol||digest(payload)!==payloadSHA256||b.protocolSHA256!==registration.protocolSHA256||seen.has(b.signalAt))throw Error('Invalid or duplicate decision');seen.add(b.signalAt);
  if(b.signalAt<registration.registeredAt||b.observedAt<b.signalAt||b.observedAt>=b.entryAt||b.entryAt!==b.signalAt+MINUTE)throw Error('Noncausal decision');
  for(const s of b.rows){if(s.feature&&(s.feature.at!==b.signalAt||s.feature.hourlyAt>b.signalAt||s.feature.fourHourlyAt>b.signalAt))throw Error('Future feature');
   out.push({at:b.entryAt,knownAt:b.observedAt,family:s.family,side:s.side,atr:s.atr,target:s.target,holdMinutes:s.holdMinutes,regime:s.regime,entryAllowed:s.modelAllowed&&!(withSentiment&&s.sentiment.veto),context:{score:s.score,sentiment:s.sentiment.bias,newsVeto:withSentiment&&s.modelAllowed&&s.sentiment.veto}});
  }
 }return out.sort((a,b)=>a.at-b.at||a.family.localeCompare(b.family));
}
export function summarizeMulti(r,fx){return {pnlBRL:r.pnl*fx,finalBRL:r.final*fx,initialBRL:r.initial*fx,count:r.trades.length,maxDD:r.maxDD,halted:r.halted,feesBRL:r.fees*fx,fundingBRL:r.fundingNet*fx,position:r.position,trades:r.trades,equity:r.equity.filter((_,i)=>i%15===0||i===r.equity.length-1).map(e=>({at:e.time,brl:e.value*fx})),rejected:r.rejected,skipped:r.skipped};}
export function evaluateMultiArm(reg,batches,market,until,arm){
 const p=reg.protocol,asOf=Math.max(p.start,Math.min(until,p.end)),scenarios=[];
 for(const variant of ['control','local-sentiment'])for(const cost of p.strategy.costCases){
  const signals=multiExecutionSignals(batches,reg,arm,variant==='local-sentiment'),r=simulateAdaptive({...market,filters:arm.filters},{start:p.start,until:asOf,protocol:p.strategy,cost,signals,closeAtEnd:asOf===p.end});
  scenarios.push({arm:arm.id,symbol:arm.symbol,variant,cost:cost.id,...summarizeMulti(r,p.strategy.fx),vetoedSignals:signals.filter(s=>s.context.newsVeto).length});
 }
 const elapsed=batches.filter(b=>b.entryAt+MINUTE<=asOf),rows=elapsed.flatMap(b=>b.rows),allowed=rows.filter(s=>s.modelAllowed),expectedSlots=Math.max(0,Math.floor((asOf-p.start-MINUTE)/FIVE)+1);
 return {id:arm.id,symbol:arm.symbol,label:arm.label,scenarios,coverage:{registered:elapsed.length,expectedSlots,missedSlots:Math.max(0,expectedSlots-elapsed.length),signals:rows.length,modelAllowed:allowed.length,covered:allowed.filter(s=>s.sentiment.covered).length,directionalCovered:allowed.filter(s=>s.sentiment.directionalCovered).length,vetoed:allowed.filter(s=>s.sentiment.veto).length},decisions:batches.slice(-40),latestContext:batches.at(-1)?.context??null};
}
export {latestG151Signals};
