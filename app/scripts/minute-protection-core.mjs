// Scheduling intervention only: unchanged engine, entry grid, targets and risk.
import {Market,exitMask} from './exit-lab-core.mjs';
export const STUDY='work/pepe-minute-protection-v1';
export const mean=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:null;
export function minuteProtectionAction(state,at,p,cost,filters){
 if(at%60000!==0)throw Error('Non-minute decision');
 if(at%300000===0||!state.position)return null;
 if(state.at!==at)throw Error('Noncausal protection decision');
 return exitMask(state,p,cost,filters)[3]?6:null;
}
export class MinuteProtectionMarket extends Market{
 constructor(p,enabled=false){super();this.p=p;this.enabled=enabled;this.cost=p.costCases.find(c=>c.id==='stress');this.requests=0;}
 consume(account,from,to){
  // Both arms use identical one-minute streaming. The control must reproduce
  // the old five-minute chunks exactly, including funding boundary handling.
  for(let at=from;at<to;at+=60000){
   if(this.enabled){const action=minuteProtectionAction(account.state(),at,this.p,this.cost,this.filters);if(action!==null){account.queueAction(action,at);this.requests++;}}
   super.consume(account,at,Math.min(at+60000,to));
  }
 }
}
export function summarize(rows){
 const stats=arm=>{const a=rows.map(r=>r[arm]),filled=a.filter(v=>v.filled),win=filled.filter(v=>v.netR>0),loss=filled.filter(v=>v.netR<0);return{count:a.length,filled:filled.length,meanNetR:mean(a.map(v=>v.netR)),positiveRate:filled.length?win.length/filled.length:null,meanWinR:mean(win.map(v=>v.netR)),meanLossR:mean(loss.map(v=>v.netR)),meanCostsBRL:mean(a.map(v=>v.feesBRL+v.slippageBRL)),boundaries:a.filter(v=>v.boundary).length,meanWithoutBoundaryR:mean(a.filter(v=>!v.boundary).map(v=>v.netR))};};
 return{count:rows.length,current:stats('current'),minute:stats('minute'),meanDeltaR:mean(rows.map(r=>r.deltaR)),better:rows.filter(r=>r.deltaR>1e-9).length,worse:rows.filter(r=>r.deltaR< -1e-9).length,equal:rows.filter(r=>Math.abs(r.deltaR)<=1e-9).length,lossToProfit:rows.filter(r=>r.current.netR<0&&r.minute.netR>0).length,profitToLoss:rows.filter(r=>r.current.netR>0&&r.minute.netR<0).length};
}
