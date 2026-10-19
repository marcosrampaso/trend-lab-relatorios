import {compactCurve} from './cdi-scenarios.mjs';
export function researchSummary(r,fx,start,end){
 if(r.position||Math.abs(r.trades.reduce((n,t)=>n+t.net,0)-r.pnl)>1e-8)throw Error('Donchian cash reconciliation failed');
 if(r.trades.some(t=>t.entryAt<start||t.exitAt>end))throw Error('Donchian execution window/holding failed');
 const wins=r.trades.filter(t=>t.net>0),losses=r.trades.filter(t=>t.net<0),gain=wins.reduce((n,t)=>n+t.net,0),loss=-losses.reduce((n,t)=>n+t.net,0),gross=r.trades.reduce((n,t)=>n+t.gross,0);
 if(Math.abs(gross-r.fees+r.fundingNet-r.pnl)>1e-8)throw Error('Donchian fees/funding reconciliation failed');
 return {initialBRL:r.initial*fx,capitalBRL:r.initial*fx,finalBRL:r.final*fx,pnlBRL:r.pnl*fx,count:r.trades.length,maxDD:r.maxDD,halted:r.halted,haltAt:r.haltAt,feesBRL:r.fees*fx,fundingBRL:r.fundingNet*fx,grossBRL:gross*fx,slippageBRL:r.trades.reduce((n,t)=>n+t.slippageCost,0)*fx,winRate:r.trades.length?wins.length/r.trades.length:null,profitFactor:loss?gain/loss:null,maxHoldHours:Math.max(0,...r.trades.map(t=>(t.exitAt-t.entryAt)/3600000)),boundaryExits:r.boundaryExits,stopMoves:r.stopMoves,protectedPositions:r.protectedPositions,avgHoldHours:r.trades.length?r.trades.reduce((n,t)=>n+(t.exitAt-t.entryAt)/3600000,0)/r.trades.length:null,curve:compactCurve(r.equity,r.initial*fx,fx,start,end),trades:r.trades};
}
