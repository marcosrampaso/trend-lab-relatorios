// Counterfactual accounting: fixed reference fills, times, quantities and funding.
// Does not recompute trade selection, stops, margin, liquidation or risk limits.
export function repriceTrades(trades,{fee,slippage}){
 if(!Number.isFinite(fee)||!Number.isFinite(slippage)||fee<0||slippage<0||fee>=1||slippage>=1)throw Error('Custo inválido');
 return trades.map(t=>{
  if(![1,-1].includes(t.side)||![t.qty,t.entryReference,t.exitReference].every(v=>Number.isFinite(v)&&v>0)||!Number.isFinite(t.funding))throw Error('Trade inválido para auditoria');
  const entry=t.entryReference*(1+t.side*slippage),exit=t.exitReference*(1-t.side*slippage),fees=t.qty*(entry+exit)*fee,slippageCost=t.qty*(Math.abs(entry-t.entryReference)+Math.abs(exit-t.exitReference)),pricePnL=t.side*t.qty*(t.exitReference-t.entryReference),net=pricePnL-slippageCost-fees+t.funding;
  return {entryAt:t.entryAt,exitAt:t.exitAt,side:t.side,qty:t.qty,entryReference:t.entryReference,exitReference:t.exitReference,funding:t.funding,entry,exit,fees,slippageCost,pricePnL,net};
 });
}
export function fixedCostAudit(trades,base,stress){
 const original=repriceTrades(trades,base),repriced=repriceTrades(trades,stress),sum=(a,k)=>a.reduce((n,t)=>n+t[k],0);
 const baseline=sum(original,'net'),stressed=sum(repriced,'net');
 if(Math.abs(baseline-trades.reduce((n,t)=>n+t.net,0))>1e-8)throw Error('Custo base não reconciliado');
 return {count:trades.length,basePnL:baseline,stressPnL:stressed,extraCost:baseline-stressed,baseFees:sum(original,'fees'),stressFees:sum(repriced,'fees'),baseSlippage:sum(original,'slippageCost'),stressSlippage:sum(repriced,'slippageCost'),funding:sum(original,'funding')};
}
