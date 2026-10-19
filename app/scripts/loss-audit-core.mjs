export const FX=5,M=60000;
const sum=(rows,fn)=>rows.reduce((n,t)=>n+fn(t),0);
export function attribution(trades){
 const referenceGross=sum(trades,t=>t.side*t.qty*(t.exitReference-t.entryReference))*FX,slippage=sum(trades,t=>t.slippageCost)*FX,fees=sum(trades,t=>t.entryFee+t.exitFee)*FX,funding=sum(trades,t=>t.funding)*FX,net=sum(trades,t=>t.net)*FX;
 if(Math.abs(referenceGross-slippage-fees+funding-net)>1e-7)throw Error('Decomposição de custos não reconciliada');
 const wins=trades.filter(t=>t.net>0),losses=trades.filter(t=>t.net<0),averageWin=wins.length?sum(wins,t=>t.net)*FX/wins.length:null,averageLoss=losses.length?-sum(losses,t=>t.net)*FX/losses.length:null;
 return {count:trades.length,wins:wins.length,losses:losses.length,winRate:trades.length?wins.length/trades.length:null,referenceGrossBRL:referenceGross,slippageBRL:slippage,feesBRL:fees,fundingBRL:funding,netBRL:net,expectancyBRL:trades.length?net/trades.length:null,averageWinBRL:averageWin,averageLossBRL:averageLoss,descriptiveBreakEvenWinRate:averageWin&&averageLoss?averageLoss/(averageWin+averageLoss):null,referenceProfitableButNetLoss:trades.filter(t=>t.side*(t.exitReference-t.entryReference)>0&&t.net<0).length};
}
export function potentialTargetNet(t,cost){
 const exit=t.target*(1-t.side*cost.slippage);return (t.side*t.qty*(exit-t.entry)-t.entryFee-t.qty*exit*cost.fee)*FX;
}
export function bucket(trades,key){return [...new Set(trades.map(key))].map(value=>({value,...attribution(trades.filter(t=>key(t)===value))}));}
export function modelVetoMinutes(result){return result.reasons?.['Roteador/modelo vetou nova entrada']??result.events?.filter(e=>e.reason==='Roteador/modelo vetou nova entrada').length??0;}
export function priceExcursions(t,candles){
 const risk=Math.abs(t.entry-t.stop),intrabar=['Stop','Alvo','Liquidação estimada','Limite diário','Limite global','Encerramento do teste'].includes(t.reason),exitBar=t.exitAt-(intrabar?M:0),complete=candles.filter(r=>r[0]>=t.entryAt&&r[0]<exitBar),held=candles.filter(r=>r[0]>=t.entryAt&&r[0]<t.exitAt),terminal=intrabar?candles.find(r=>r[0]===exitBar):null;
 const favorable=r=>t.side===1?r[2]-t.entryReference:t.entryReference-r[3],adverse=r=>t.side===1?t.entryReference-r[3]:r[2]-t.entryReference;
 const mfe=Math.max(0,...complete.map(favorable)),mae=Math.max(0,...complete.map(adverse));
 const target=r=>t.side===1?r[2]>=t.target:r[3]<=t.target,stop=r=>t.side===1?r[3]<=t.stop:r[2]>=t.stop;
 const deadline=t.entryAt+t.holdMinutes*M,after=candles.filter(r=>r[0]>=t.exitAt&&r[0]<deadline);
 return {mfeBeforeExitBarR:risk?mfe/risk:null,maeBeforeExitBarR:risk?mae/risk:null,heldMinutes:(t.exitAt-t.entryAt)/M,plannedMinutes:t.holdMinutes,
 ambiguousExitBar:Boolean(terminal&&stop(terminal)&&target(terminal)),entryMinuteExit:t.exitAt===t.entryAt+M,
 targetReachedAfterExit:after.some(target),postExitCoveredMinutes:after.length,postExitExpectedMinutes:Math.max(0,(deadline-t.exitAt)/M),postExitWorstAdverseR:risk?Math.max(0,...after.map(adverse))/risk:null,
 allHeldMinutes:held.length};
}
