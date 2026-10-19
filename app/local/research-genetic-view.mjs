import {rank} from '../scripts/genetic-validation-v6-core.mjs';

// Presentation only: read the recorded insertion order and the same ranking.
// No candidate evaluation, mutation, promotion, or training writes occur here.
export function searchView(search){
 const candidates=search.candidates??[],history=(search.history??[]).map(h=>{
  const leader=candidates.slice(0,h.uniqueCandidates).sort(rank)[0];
  return {...h,leaderId:leader?.genome.id??null,baseMeanMonthlyBRL:leader?leader.metrics.baseBRL/12:null,stressMeanMonthlyBRL:leader?leader.metrics.stressBRL/12:null,leaderEligible:leader?.metrics.eligible??false};
 });
 const ranking=[...candidates].sort(rank),leader=ranking[0];
 return {fold:search.fold,history,candidateCount:candidates.length,eligible:candidates.filter(c=>c.metrics.eligible).length,
  leader:leader?{genome:leader.genome,metrics:leader.metrics,blocks:leader.blocks.map(block=>({start:block.start,end:block.end,cdi:block.cdi,base:portfolioView(block.base),stress:portfolioView(block.stress)}))}:null,
  ranking:ranking.slice(0,6).map(c=>({genome:c.genome,metrics:c.metrics}))};
}
export function portfolioView(value){
 return {pnlBRL:value.pnlBRL,count:value.count,maxDD:value.maxDD,halted:value.halted,winRate:value.winRate,feesBRL:(value.feesUSDT??0)*5,fundingBRL:(value.fundingUSDT??0)*5,curve:value.curve??[],
  trades:(value.trades??[]).map(t=>({entryAt:t.entryAt,exitAt:t.exitAt,side:t.side,family:t.family,reason:t.reason,netBRL:t.net*5}))};
}
