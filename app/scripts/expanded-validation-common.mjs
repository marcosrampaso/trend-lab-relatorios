import {monthAt} from '../web/scalp-tree.js';
export const RUN='work/expanded-validation/g151-fixed-v1';
export const SOURCE='work/local-ml/runs/search-v4-20261019T005751Z';
export const FAMILIES=['cross','vwap','bands'];
export const ARMS=[{family:'cross',hold:120},{family:'bands',hold:240}];
export const month=(value,offset=0)=>new Date(monthAt(value,offset)).toISOString().slice(0,7);
export function planHistory(items,{reserved='2026-09',warmupMonths=1,trainMonths=9}={}){
 const segments=[];
 for(const m of items.map(x=>typeof x==='string'?x:x.month).sort()){
  if(m>=reserved)continue;
  if(!segments.length||month(segments.at(-1).months.at(-1),1)!==m)segments.push({months:[]});
  segments.at(-1).months.push(m);
 }
 const blocks=[];
 for(const [segment,s] of segments.entries()){
  s.warmup=s.months.slice(0,warmupMonths);s.trainingOnly=s.months.slice(warmupMonths,warmupMonths+trainMonths);
  s.test=s.months.slice(warmupMonths+trainMonths);
  for(let i=0;i<s.test.length;i+=3){const months=s.test.slice(i,i+3),first=months[0];blocks.push({id:first,segment,months,trainStart:month(first,-trainMonths),trainEnd:first,end:month(months.at(-1),1)});}
 }
 return {segments,blocks,testMonths:blocks.flatMap(b=>b.months),reserved};
}
export function tradeStats(trades,fx=5){
 const sum=(f)=>trades.reduce((n,t)=>n+f(t),0),net=sum(t=>t.net)*fx,wins=trades.filter(t=>t.net>0),losses=trades.filter(t=>t.net<0);
 const best=trades.map(t=>t.net*fx).sort((a,b)=>b-a);
 return {count:trades.length,wins:wins.length,losses:losses.length,netBRL:net,feesBRL:sum(t=>t.entryFee+t.exitFee)*fx,slippageBRL:sum(t=>t.slippageCost)*fx,fundingBRL:sum(t=>t.funding)*fx,grossAfterSlippageBRL:sum(t=>t.gross)*fx,expectancyBRL:trades.length?net/trades.length:null,winRate:trades.length?wins.length/trades.length:null,profitFactor:losses.length?sum.call(null,t=>Math.max(0,t.net))/-sum(t=>Math.min(0,t.net)):null,withoutTop3BRL:net-best.slice(0,3).reduce((n,v)=>n+v,0),averageMinutes:trades.length?sum(t=>(t.exitAt-t.entryAt)/60000)/trades.length:null};
}
export function grouped(trades,key){return [...new Set(trades.map(t=>t[key]))].map(value=>({value,...tradeStats(trades.filter(t=>t[key]===value))}));}
export function auditTrades(result){
 if(result.position||Math.abs(result.trades.reduce((n,t)=>n+t.net,0)-result.pnl)>1e-8)throw Error('Caixa não reconciliado');
 if(result.trades.some(t=>t.exitAt-t.entryAt>t.holdMinutes*60000))throw Error('Duração inválida');
}
