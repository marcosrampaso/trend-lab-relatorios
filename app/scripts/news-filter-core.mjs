import {createHash} from 'node:crypto';
import {simulate,HOUR} from '../web/engine.js';
import {volatilityVeto} from '../web/filters.js';

export const QUARTER=HOUR/4;
export const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const time=v=>typeof v==='number'?v:Date.parse(v);

// This is a qualitative, pre-registered filter, not a fitted BERT predictor.
export function assessNews(updates,{observedAt,entryAt,side}){
 const selected=updates.filter(n=>{
  const available=time(n.availableAt),recorded=time(n.recordedAt),assessed=time(n.assessedAt),expires=time(n.validUntil);
  return n.id&&[available,recorded,assessed,expires].every(Number.isFinite)&&available<=observedAt&&recorded<=observedAt&&assessed<=observedAt&&observedAt<expires;
 }).sort((a,b)=>time(b.availableAt)-time(a.availableAt)||String(a.id).localeCompare(String(b.id)))[0];
 const empty=reason=>({covered:false,directionalCovered:false,veto:false,reason,assessment:selected??null});
 if(!selected)return empty('Sem análise disponível no momento do registro');
 if(entryAt>=time(selected.validUntil))return empty('Análise expira antes da entrada');
 if(!['low','medium','high'].includes(selected.risk)||!['positive','negative','mixed','uncertain'].includes(selected.bias))return empty('Análise sem classificação utilizável');
 const sources=selected.sources??[];
 const safe=s=>{try{const u=new URL(s.url);return u.protocol==='https:'&&!u.username&&!u.password;}catch{return false;}};
 if(!sources.length||sources.some(s=>!safe(s)||s.publishedAt!=null&&(!Number.isFinite(time(s.publishedAt))||time(s.publishedAt)>observedAt))||!sources.some(s=>s.publishedAt!=null&&Number.isFinite(time(s.publishedAt))&&time(s.publishedAt)<=observedAt))return empty('Fontes sem data verificável ou com disponibilidade inválida');
 const directionalCovered=['positive','negative'].includes(selected.bias),opposed=side===1&&selected.bias==='negative'||side===-1&&selected.bias==='positive';
 const veto=!!side&&(selected.risk==='high'||opposed);
 return {covered:true,directionalCovered,veto,reason:!side?'Sinal neutro':selected.risk==='high'?'Risco alto conhecido antes da entrada':opposed?'Viés da notícia contrário ao sinal':directionalCovered?'Viés compatível com o sinal':'Viés misto/incerto: sem veto direcional',assessment:selected};
}

export function enrollDecision(source,updates,observedAt,registration){
 const {protocol:p}=registration,entryAt=source.entryAt,signalAt=source.signalAt;
 if(source.runId!==p.sourceRunId)throw Error('Rodada de origem mudou');
 if(source.protocolSHA256!==p.sourceProtocolSHA256||source.engineSHA256!==p.sourceEngineSHA256)throw Error('Protocolo de origem mudou');
 if(![source.recordedAt,signalAt,entryAt,observedAt].every(Number.isFinite)||source.recordedAt>observedAt||source.recordedAt<registration.registeredAt||source.recordedAt>=entryAt||observedAt>=entryAt||signalAt>observedAt||entryAt!==signalAt+HOUR||entryAt<p.start||entryAt>=p.end)return null;
 const sig=source.signal;
 if(!sig||sig.at!==signalAt||![-1,0,1].includes(sig.side)||!(sig.price>0)||!(sig.atr>0)||![sig.price,sig.atr].every(Number.isFinite))throw Error('Sinal inválido');
 const news=assessNews(updates,{observedAt,entryAt,side:sig.side});
 const decision={id:String(signalAt),sourceId:source.id,sourceRunId:source.runId,sourceRecordedAt:source.recordedAt,observedAt,signalAt,entryAt,signal:structuredClone(sig),news:structuredClone(news),protocolSHA256:registration.protocolSHA256};
 return {...decision,payloadSHA256:digest(decision)};
}

export function validateCandles(rows,start,end,step=QUARTER){
 if(rows.length!==(end-start)/step)throw Error('Cobertura de candles incompleta');
 for(let i=0;i<rows.length;i++){
  const r=rows[i];if(r[0]!==start+i*step||r.length<5||r.slice(1).some(v=>!Number.isFinite(v)||v<0)||r.slice(1,5).some(v=>v<=0)||r[2]<Math.max(r[1],r[3],r[4])||r[3]>Math.min(r[1],r[2],r[4]))throw Error('Candle inválido ou lacuna');
 }
}

export function evaluateExperiment(registration,decisions,market,until){
 const p=registration.protocol,asOf=Math.max(p.start,Math.min(until,p.end));
 const rows=market.candles.filter(r=>r[0]>=p.start&&r[0]+QUARTER<=asOf),marks=market.marks.filter(r=>r[0]>=p.start&&r[0]+QUARTER<=asOf);
 validateCandles(rows,p.start,asOf);validateCandles(marks,p.start,asOf);
 const registry=new Map(),lookup=new Map();
 for(const d of decisions){
  const {payloadSHA256,...payload}=d;if(digest(payload)!==payloadSHA256)throw Error('Integridade da decisão divergiu');
  if(d.protocolSHA256!==registration.protocolSHA256||d.observedAt>=d.entryAt||d.sourceRecordedAt<registration.registeredAt)throw Error('Decisão não é prospectiva ou protocolo divergiu');
  if(registry.has(d.signalAt))throw Error('Sinal duplicado');
  registry.set(d.signalAt,d.signal);lookup.set(d.signalAt,d);
 }
 const scenarios=[];
 for(const variant of ['control','news-filter'])for(const cost of p.costCases){
  const r=simulate({candles:market.hourly,filters:p.exchangeFilters,funding:market.funding},{start:p.start,until:asOf,strategy:p.signal,entryDelayHours:1,registeredSignals:registry,execution:{candles:rows,marks,intervalMs:QUARTER},maxHoldHours:p.maxHoldHours,stopATR:p.stopATR,targetR:p.targetR,cooldownHours:p.cooldownHours,config:{...p.config,fee:cost.fee,slippage:cost.slippage},closeAtEnd:asOf===p.end,entryFilter:({signal,config})=>volatilityVeto(signal,config,p.minStopToRoundTripCost)||(variant==='news-filter'&&lookup.get(signal.at)?.news.veto?'Notícia: '+lookup.get(signal.at).news.reason:null)});
  scenarios.push({variant,cost:cost.id,initial:r.initial,final:r.final,pnlBRL:r.pnl*p.config.fx,returnPct:r.returnPct,maxDD:r.maxDD,count:r.trades.length,wins:r.trades.filter(t=>t.net>0).length,expectancyBRL:r.trades.length?r.trades.reduce((n,t)=>n+t.net,0)*p.config.fx/r.trades.length:null,feesBRL:r.fees*p.config.fx,fundingBRL:r.fundingNet*p.config.fx,position:r.position,halted:r.halted,newsVetoes:r.events.filter(e=>e.kind==='filtered'&&e.reason.startsWith('Notícia:')).length,events:r.events,trades:r.trades,equity:r.equity.map(x=>({at:x.time,brl:x.value*p.config.fx}))});
 }
 const elapsed=decisions.filter(d=>d.entryAt+QUARTER<=asOf),directional=elapsed.filter(d=>d.signal.side),expectedHours=Math.max(0,Math.min((p.end-p.start)/HOUR,Math.floor((asOf-p.start-QUARTER)/HOUR)+1));
 const coverage={registered:elapsed.length,expectedHours,missedHours:Math.max(0,expectedHours-elapsed.length),directional:directional.length,covered:directional.filter(d=>d.news.covered).length,directionalCovered:directional.filter(d=>d.news.directionalCovered).length,registeredVetoes:directional.filter(d=>d.news.veto).length};
 const deltas=p.costCases.map(c=>({cost:c.id,pnlBRL:scenarios.find(s=>s.cost===c.id&&s.variant==='news-filter').pnlBRL-scenarios.find(s=>s.cost===c.id&&s.variant==='control').pnlBRL}));
 return {asOf:rows.length?asOf:null,complete:asOf===p.end,coverage,scenarios,deltas,conclusion:'Inconclusivo: experimento prospectivo. Nenhuma vantagem demonstrada nesta fase.',realOrders:false,trainedBERT:false};
}
