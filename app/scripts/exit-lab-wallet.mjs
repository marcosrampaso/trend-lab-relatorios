import{ExitEpisode,exitMask}from'./exit-lab-core.mjs';
import{createResearchAccount,originalMarginROI}from'./exit-lab-engine.mjs';
import{researchSummary}from'./donchian-research-summary-v4.mjs';
// Same frozen signals, but one continuous simulated wallet per month.
export class ExitWallet extends ExitEpisode{
 resetWallet(packet,ladder=true){
  this.summary=null;this.entry=null;this.month=packet.month;this.start=this.at=packet.month.start;this.end=packet.month.end;this.ladder=ladder;this.arm='liquidation';this.signals=new Map(packet.entries.map(e=>[e.trade.entryAt,e]));this.actions=Array(6).fill(0);this.available=Array(6).fill(0);this.automaticPartials=0;this.sourceEntryCount=packet.entries.length;this.overlapSkips=0;this.riskSkips=0;this.initial=this.p.capitalBRL/this.p.fx;this.risk=this.initial*this.p.risk;
  this.account=createResearchAccount({start:this.at,until:this.end,protocol:this.p,cost:this.cost,filters:this.market.filters,agentMode:true,stopContext:this.market.contexts(this.at,this.end)});this.done=false;this.advanceFlat();return this.response();
 }
 advanceFlat(){
  while(!this.account.state().position&&this.at<this.end){
   const s=this.account.state(),entry=this.signals.get(this.at);
   if(entry){if(s.halted||s.blocked)this.riskSkips++;else{this.initial=s.cash;this.account.queueEntry(entry.trade.side,entry.atr,this.at,entry.trade.leverage);}}
   const until=Math.min(this.at+300000,this.end);this.market.consume(this.account,this.at,until);this.at=until;const pos=this.account.state().position;if(pos)this.risk=pos.initialQty*Math.abs(pos.entry-pos.initialStop);
  }
  if(this.at===this.end){this.done=true;this.finish();}
 }
 step(action){
  if(this.done)throw Error('Wallet closed');const s=this.account.state(),mask=exitMask(s,this.p,this.cost,this.market.filters);if(!Number.isInteger(action)||!mask[action])throw Error('Invalid wallet action');mask.forEach((v,i)=>this.available[i]+=Number(v));this.actions[action]++;
  if(this.signals.has(this.at))this.overlapSkips++;
  const stage=s.position.ladderStage??0,target=this.p.profitLadder[stage],automatic=this.ladder&&target&&originalMarginROI(s.position,s.lastClose,this.cost)>=target.roi;
  this.account.queueAction(automatic?7+stage:[0,1,3,6,5,4][action],this.at);if(automatic)this.automaticPartials++;
  const until=Math.min(this.at+300000,this.end);this.market.consume(this.account,this.at,until);this.at=until;this.advanceFlat();return{...this.response(),reward:0,terminated:this.done,truncated:false};
 }
 finish(){
  const r=this.account.finish();this.summary={month:this.month.month,split:this.month.split,...researchSummary(r,this.p.fx,this.start,this.end),actions:this.actions,available:this.available,automaticPartialRequests:this.automaticPartials,automaticApplied:r.decisions.filter(d=>d.applied&&d.action>=7).length,learnedApplied:r.decisions.filter(d=>d.applied&&[1,3,4,5,6].includes(d.action)).length,learnedProtectionApplied:r.decisions.filter(d=>d.applied&&[3,4,5,6].includes(d.action)).length,partialExits:r.partialExits,partialRejected:r.partialRejected,sourceEntryCount:this.sourceEntryCount,overlapSkips:this.overlapSkips,riskSkips:this.riskSkips,rejected:r.rejected,skipped:r.skipped,independentMonthlyWallet:true,realOrders:false};
 }
}
