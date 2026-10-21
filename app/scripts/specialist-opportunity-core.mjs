// Separate diagnostic only. Never modifies registered models or trading engines.
import {exchangeRules,sizePosition} from '../web/engine.js';
import {createResearchAccount,remainingBreakeven} from './exit-lab-engine.mjs';
import {exitFill} from './entry-audit-core.mjs';
import {liquidationValue} from './exit-lab-core.mjs';
import {featureInput,fixedExitAction} from './specialist-core.mjs';
export const OPPORTUNITY='work/pepe-opportunity-v1';
export const mean=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:null;
export const median=a=>{const s=a.slice().sort((a,b)=>a-b);return s.length?(s[Math.floor((s.length-1)/2)]+s[Math.floor(s.length/2)])/2:null;};
export function knownFeasibility(f,side,p,filters){
 featureInput(f,f.at);if(![1,-1].includes(side))throw Error('Invalid direction');
 const c=p.costCases.find(c=>c.id==='stress'),tick=Number(filters.find(f=>f.filterType==='PRICE_FILTER')?.tickSize??0);
 const round=(v,d)=>p.enforceTicks&&tick>0?(d>0?Math.ceil(v/tick-1e-8):Math.floor(v/tick+1e-8))*tick:v;
 const entry=round(f.close*(1+side*c.slippage),side),stop=round(entry-side*p.stopATR*f.atr,-side);
 const cfg={...p,...c},size=sizePosition(p.capitalBRL/p.fx,entry,stop,cfg,exchangeRules(filters));
 if(!size)return{feasible:false,reason:'Mínimo da corretora excede orçamento de risco',at:f.at};
 const entryFee=size.qty*entry*c.fee,marginNet=size.margin-entryFee;
 const liquidation=side===1?(size.qty*entry-marginNet)/(size.qty*(1-p.maintenance)):(size.qty*entry+marginNet)/(size.qty*(1+p.maintenance));
 const flatExit=exitFill(f.close,side,c,filters,p.enforceTicks),flatNet=size.qty*side*(flatExit-entry)-entryFee-size.qty*flatExit*c.fee;
 const risk=size.qty*Math.abs(entry-stop),be=remainingBreakeven({side,qty:size.qty,entry,entryFee,funding:0},cfg);
 const valid=side===1?stop>liquidation:stop<liquidation;
 return{at:f.at,feasible:valid,reason:valid?null:'Stop além da liquidação estimada',entry,stop,liquidation,qty:size.qty,
  bufferPct:side*(stop-liquidation)/entry,flatCostPriceR:-flatNet/risk,flatCostBRL:-flatNet*p.fx,breakEvenMovePct:side*(be/f.close-1)};
}
export function opportunityGroups(f,side,known){
 const h=f.x[7],l=f.x[8],rvol=Math.exp(f.x[2]*5);
 return{trend:h===side&&l===side?'aligned':h===-side&&l===-side?'opposed':'mixed',
  friction:known.flatCostPriceR==null?'unavailable':known.flatCostPriceR<=.25?'upTo025R':known.flatCostPriceR<=.5?'025to05R':'above05R',
  volume:rvol<1?'below1':rvol<2?'1to2':'atLeast2'};
}
export function inspectOpportunity(f,side,end,p,market,contexts){
 featureInput(f,f.at);const start=f.at,cost=p.costCases.find(c=>c.id==='stress'),initial=p.capitalBRL/p.fx,risk=initial*p.risk;
 const account=createResearchAccount({start,until:end,protocol:p,cost,filters:market.filters,agentMode:true,stopContext:contexts,
  startingState:{cash:initial,initial,day:new Date(start).toISOString().slice(0,10),dayStart:initial,lastClose:f.close,position:null}});
 account.queueEntry(side,f.atr,start,p.leverage);let at=Math.min(start+300000,end);market.consume(account,start,at);
 let peak=null,positiveDecisions=0;
 while(account.state().position&&at<end){
  const s=account.state(),netR=(liquidationValue(s,cost,market.filters)-initial)/risk;peak=peak===null?netR:Math.max(peak,netR);if(netR>0)positiveDecisions++;
  account.queueAction(fixedExitAction(s,p,cost,market.filters),at);const until=Math.min(at+300000,end);market.consume(account,at,until);at=until;
 }
 const r=account.finish({allowEarly:true}),t=r.trades[0];
 if(r.trades.length>1||Math.abs(r.pnl-(t?.net??0))>1e-7)throw Error('Opportunity reconciliation');
 const fx=p.fx,gross=(t?.gross??0)*fx,slippage=(t?.slippageCost??0)*fx,net=r.pnl*fx,fees=r.fees*fx,funding=r.fundingNet*fx;
 if(Math.abs(gross-fees+funding-net)>1e-7)throw Error('Opportunity cost reconciliation');
 const noFill=r.events.find(e=>['rejected','skipped'].includes(e.kind))?.reason??'Entrada não preenchida';
 return{at:f.at,side,netR:r.pnl/risk,netBRL:net,exitAt:t?.exitAt??at,reason:t?.reason??'Entrada não preenchida',filled:!!t,
  boundary:t?.reason==='Fim do recorte (avaliação)',feesBRL:fees,fundingBRL:funding,grossBRL:gross,slippageBRL:slippage,
  referenceGrossBRL:gross+slippage,costErasedPositive:!!t&&gross+slippage>0&&net<=0,unfilledReason:t?null:noFill,
  positiveAtDecision:positiveDecisions>0,peakNetRAtDecision:peak,holdMinutes:t?(t.exitAt-start)/60000:null,
  liquidation:!!t&&t.reason==='Liquidação estimada'};
}
export function summarizeOpportunities(rows){
 const filled=rows.filter(r=>r.filled),notBoundary=rows.filter(r=>!r.boundary);
 const positives=filled.filter(r=>r.netR>0),negatives=filled.filter(r=>r.netR<0);
 return{count:rows.length,filled:filled.length,unfilled:rows.length-filled.length,positive:positives.length,
  positiveRateFilled:filled.length?positives.length/filled.length:null,meanNetR:mean(rows.map(r=>r.netR)),meanNetRFilled:mean(filled.map(r=>r.netR)),
  medianNetRFilled:median(filled.map(r=>r.netR)),meanWinR:mean(positives.map(r=>r.netR)),meanLossR:mean(negatives.map(r=>r.netR)),
  meanGrossBRL:mean(filled.map(r=>r.grossBRL)),meanReferenceGrossBRL:mean(filled.map(r=>r.referenceGrossBRL)),
  meanFeesBRL:mean(filled.map(r=>r.feesBRL)),meanSlippageBRL:mean(filled.map(r=>r.slippageBRL)),meanFundingBRL:mean(filled.map(r=>r.fundingBRL)),
  meanNetBRLFilled:mean(filled.map(r=>r.netBRL)),costErasedPositive:filled.filter(r=>r.costErasedPositive).length,
  negativeBeforeCosts:filled.filter(r=>r.referenceGrossBRL<=0&&r.netBRL<0).length,
  positiveAtDecision:filled.filter(r=>r.positiveAtDecision).length,boundaries:rows.filter(r=>r.boundary).length,
  liquidations:filled.filter(r=>r.liquidation).length,meanNetRWithoutBoundary:mean(notBoundary.map(r=>r.netR)),
  unfilledReasons:Object.fromEntries([...new Set(rows.filter(r=>!r.filled).map(r=>r.unfilledReason))].map(k=>[k,rows.filter(r=>!r.filled&&r.unfilledReason===k).length]))};
}
