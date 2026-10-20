import {exchangeRules,sizePosition} from '../web/engine.js';
import {remainingBreakeven} from './pepe-mask-engine.mjs';
// Only observed state and closed-bar inputs. The next opening price/volume is never read.
export function validActionMask(s,f,p,cost,filters,at){
 const mask=Array(10).fill(false);mask[0]=true;
 if(s.halted||!(s.cash>0))return mask;
 const pos=s.position,price=s.lastClose??f.close,rules=exchangeRules(filters);
 if(!pos){
  const sameDay=s.day===new Date(at).toISOString().slice(0,10);
  if(s.blocked&&sameDay||s.lastExit!==null&&s.lastExit!==undefined&&at-s.lastExit<p.cooldownMinutes*60000)return mask;
  for(const action of[1,2,8,9]){
   const side=[1,8].includes(action)?1:-1,leverage=action>=8?15:10,tick=Number(filters.find(f=>f.filterType==='PRICE_FILTER')?.tickSize??0),round=(v,d)=>tick>0?(d>0?Math.ceil(v/tick-1e-8):Math.floor(v/tick+1e-8))*tick:v;
   const entry=round(price*(1+side*cost.slippage),side),stop=round(entry-side*p.stopATR*f.atr,-side),cfg={...p,...cost,leverage};
   const sized=sizePosition(s.cash,entry,stop,cfg,rules);if(!sized)continue;
   const fee=sized.qty*entry*cost.fee,margin=sized.margin;
   const lp=side===1?(sized.qty*entry-margin+fee)/(sized.qty*(1-p.maintenance)):(sized.qty*entry+margin-fee)/(sized.qty*(1+p.maintenance));
   if(side===1?stop>lp:stop<lp)mask[action]=true;
  }
  return mask;
 }
 mask[3]=true;
 const qty=Math.floor((pos.initialQty*.5+1e-12)/rules.step)*rules.step,remaining=pos.qty-qty,exit=price*(1-pos.side*cost.slippage);
 mask[4]=!pos.firstTaken&&qty>=rules.minQty&&remaining+1e-12>=rules.minQty&&Math.min(qty,remaining)*exit+1e-10>=rules.minNotional;
 const be=remainingBreakeven(pos,{...p,...cost});
 if((price-be)*pos.side>0){
  mask[5]=pos.agentProtection==='off'&&(be-pos.stop)*pos.side>1e-10;
  mask[6]=!(pos.agentProtection==='trail'&&pos.agentTrailATR===1);
  mask[7]=!(pos.agentProtection==='trail'&&pos.agentTrailATR===2);
 }
 return mask;
}
