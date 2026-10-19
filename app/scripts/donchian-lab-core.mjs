import {volatilityVeto} from '../web/filters.js';
import {compactCurve} from './cdi-scenarios.mjs';
export const gateModes=['per-cost','fixed-base','fixed-stress'];
export function lockedCost(mode,cost,cases){
 if(!gateModes.includes(mode))throw Error('Unknown Donchian gate');
 const result=mode==='per-cost'?cost:cases.find(c=>c.id===(mode==='fixed-base'?'base':'stress'));
 if(!result)throw Error('Missing gate cost assumption');return result;
}
export function donchianExecution(raw,{start,end,strategy,cost,gate,delayMinutes=2}){
 const assumed=lockedCost(gate,cost,strategy.costCases);
 return raw.filter(s=>s.signalAt+delayMinutes*60000>=start&&s.signalAt+delayMinutes*60000<end).map(s=>{
  if(!Number.isFinite(s.signalAt)||![-1,1].includes(s.side)||!(s.price>0&&s.atr>0))throw Error('Invalid Donchian signal');
  return {at:s.signalAt+delayMinutes*60000,knownAt:s.signalAt,family:'cross',side:s.side,atr:s.atr,holdMinutes:strategy.maxHoldMinutes,entryAllowed:!volatilityVeto(s,{...strategy,...assumed},4),context:{gate,gateCost:assumed.id,sourceSignalAt:s.signalAt}};
 });
}
export function completeBlocks(months,cutoff){
 const good=months.filter(m=>m.complete&&m.end<=cutoff).sort((a,b)=>a.start-b.start),blocks=[];
 for(const m of good){const prior=blocks.at(-1);if(prior&&prior.end===m.start&&prior.year===m.month.slice(0,4)){prior.end=m.end;prior.months.push(m.month);}else blocks.push({id:m.month,year:m.month.slice(0,4),start:m.start,end:m.end,months:[m.month]});}return blocks;
}
export function researchSummary(r,fx,start,end){
 if(r.position||Math.abs(r.trades.reduce((n,t)=>n+t.net,0)-r.pnl)>1e-8)throw Error('Donchian cash reconciliation failed');
 if(r.trades.some(t=>t.entryAt<start||t.exitAt>end||t.exitAt-t.entryAt>1440*60000))throw Error('Donchian execution window/holding failed');
 const wins=r.trades.filter(t=>t.net>0),losses=r.trades.filter(t=>t.net<0),gain=wins.reduce((n,t)=>n+t.net,0),loss=-losses.reduce((n,t)=>n+t.net,0),gross=r.trades.reduce((n,t)=>n+t.gross,0);
 if(Math.abs(gross-r.fees+r.fundingNet-r.pnl)>1e-8)throw Error('Donchian fees/funding reconciliation failed');
 return {initialBRL:r.initial*fx,capitalBRL:r.initial*fx,finalBRL:r.final*fx,pnlBRL:r.pnl*fx,count:r.trades.length,maxDD:r.maxDD,halted:r.halted,haltAt:r.haltAt,feesBRL:r.fees*fx,fundingBRL:r.fundingNet*fx,grossBRL:gross*fx,slippageBRL:r.trades.reduce((n,t)=>n+t.slippageCost,0)*fx,winRate:r.trades.length?wins.length/r.trades.length:null,profitFactor:loss?gain/loss:null,avgHoldHours:r.trades.length?r.trades.reduce((n,t)=>n+(t.exitAt-t.entryAt)/3600000,0)/r.trades.length:null,curve:compactCurve(r.equity,r.initial*fx,fx,start,end),trades:r.trades};
}
