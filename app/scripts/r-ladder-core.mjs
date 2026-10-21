import assert from 'node:assert/strict';
import {createResearchAccount,originalMarginROI}from'./r-ladder-engine.mjs';
import {exitMask}from'./exit-lab-core.mjs';
import {researchSummary}from'./donchian-research-summary-v4.mjs';
export const STUDY='work/pepe-r-ladder-v1';
export const mean=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:null;
export function armProtocol(engine,arm){
 if(!['margin','priceRisk'].includes(arm))throw Error('Unknown ladder arm');
 return {...engine,ladderBasis:arm,profitLadder:arm==='priceRisk'?[{roi:1,fraction:.25},{roi:2,fraction:.5},{roi:3,fraction:.25}]:engine.profitLadder};
}
export function exitAction(s,p,cost,filters){
 const pos=s.position;if(!pos)return 0;const stage=pos.ladderStage??0,target=p.profitLadder[stage];
 if(target&&originalMarginROI(pos,s.lastClose,{...p,...cost})>=target.roi)return 7+stage;
 return exitMask(s,p,cost,filters)[3]?6:0;
}
const identity=t=>t?Object.fromEntries(['entryAt','side','entry','entryReference','initialQty','initialStop','initialMargin','initialNotional','initialEntryFee','initialRisk'].map(k=>[k,t[k]])):null;
export function singlePosition(f,side,end,p,market,contexts){
 const initial=p.capitalBRL/p.fx,cost=p.costCases.find(c=>c.id==='stress');
 const a=createResearchAccount({start:f.at,until:end,protocol:p,cost,filters:market.filters,agentMode:true,stopContext:contexts,
  startingState:{cash:initial,initial,day:new Date(f.at).toISOString().slice(0,10),dayStart:initial,lastClose:f.close,position:null}});
 a.queueEntry(side,f.atr,f.at,p.leverage);let at=Math.min(f.at+300000,end);market.consume(a,f.at,at);
 while(a.state().position&&at<end){a.queueAction(exitAction(a.state(),p,cost,market.filters),at);const until=Math.min(at+300000,end);market.consume(a,at,until);at=until;}
 const r=a.finish({allowEarly:true}),t=r.trades[0];assert.ok(r.trades.length<=1);assert.ok(Math.abs(r.pnl-(t?.net??0))<1e-7);
 return{at:f.at,side,filled:!!t,identity:identity(t),netR:r.pnl/(initial*p.risk),netBRL:r.pnl*p.fx,
  exitAt:t?.exitAt??at,reason:t?.reason??'Entrada não preenchida',boundary:t?.reason==='Fim do recorte (avaliação)',
  feesBRL:r.fees*p.fx,fundingBRL:r.fundingNet*p.fx,grossBRL:(t?.gross??0)*p.fx,slippageBRL:(t?.slippageCost??0)*p.fx,
  partials:r.partialExits,stopMoves:r.stopMoves,holdMinutes:t?(t.exitAt-f.at)/60000:null,
  rejection:r.events.find(e=>e.kind==='rejected'||e.kind==='skipped')?.reason??null};
}
export function pairedPosition(f,side,end,engine,market,contexts){
 const margin=singlePosition(f,side,end,armProtocol(engine,'margin'),market,contexts),priceRisk=singlePosition(f,side,end,armProtocol(engine,'priceRisk'),market,contexts);
 assert.deepEqual(priceRisk.identity,margin.identity,'Paired entry fill changed');
 return{at:f.at,side,margin,priceRisk,deltaR:priceRisk.netR-margin.netR,deltaBRL:priceRisk.netBRL-margin.netBRL};
}
export function monthlyWallet(month,entries,p,market){
 const signals=new Map(entries.map(e=>[e.trade.entryAt,e])),cost=p.costCases.find(c=>c.id==='stress');let overlapSkips=0,riskSkips=0;
 const account=createResearchAccount({start:month.start,until:month.end,protocol:p,cost,filters:market.filters,agentMode:true,stopContext:market.contexts(month.start,month.end)});
 for(let at=month.start;at<month.end;at+=300000){const s=account.state(),signal=signals.get(at);
  if(s.position){if(signal)overlapSkips++;account.queueAction(exitAction(s,p,cost,market.filters),at);}
  else if(signal){if(s.halted||s.blocked)riskSkips++;else account.queueEntry(signal.trade.side,signal.atr,at,signal.trade.leverage);}
  market.consume(account,at,Math.min(at+300000,month.end));
 }
 const r=account.finish();return{month:month.month,stage:month.stage,...researchSummary(r,p.fx,month.start,month.end),sourceEntryCount:entries.length,
  overlapSkips,riskSkips,rejected:r.rejected,skipped:r.skipped,partialExits:r.partialExits,partialRejected:r.partialRejected,realOrders:false};
}
export function summarizePairs(rows){
 const armSummary=arm=>{const a=rows.map(r=>r[arm]),filled=a.filter(r=>r.filled),wins=filled.filter(r=>r.netR>0),loss=filled.filter(r=>r.netR<0);
  return{count:a.length,filled:filled.length,positive:wins.length,positiveRate:filled.length?wins.length/filled.length:null,meanNetR:mean(a.map(r=>r.netR)),
   meanWinR:mean(wins.map(r=>r.netR)),meanLossR:mean(loss.map(r=>r.netR)),meanFeesBRL:mean(a.map(r=>r.feesBRL)),meanSlippageBRL:mean(a.map(r=>r.slippageBRL)),
   boundaries:a.filter(r=>r.boundary).length,meanHoldMinutes:mean(filled.map(r=>r.holdMinutes)),meanWithoutBoundaryR:mean(a.filter(r=>!r.boundary).map(r=>r.netR))};};
 return{count:rows.length,margin:armSummary('margin'),priceRisk:armSummary('priceRisk'),meanDeltaR:mean(rows.map(r=>r.deltaR)),
  better:rows.filter(r=>r.deltaR>1e-9).length,worse:rows.filter(r=>r.deltaR<-1e-9).length,equal:rows.filter(r=>Math.abs(r.deltaR)<=1e-9).length};
}
