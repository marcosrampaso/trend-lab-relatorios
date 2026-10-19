import {prepareDonchian} from '../web/donchian.js';
import {trendFrames,frameAt} from '../web/scalping-context.js';
import {volatilityVeto} from '../web/filters.js';
export const UPGRADE_VARIANTS=[
 {id:'control',name:'Original',retest:false,trend:false,stopATR:1.5,targetR:2},
 {id:'trend',name:'Tendência 1h/4h',retest:false,trend:true,stopATR:1.5,targetR:2},
 {id:'retest',name:'Reteste',retest:true,trend:false,stopATR:1.5,targetR:2},
 {id:'retest-trend',name:'Reteste + tendência',retest:true,trend:true,stopATR:1.5,targetR:2},
 {id:'exit-only',name:'Original + stop 2ATR/alvo 3ATR',retest:false,trend:false,stopATR:2,targetR:1.5},
 {id:'retest-trend-wide',name:'Reteste + tendência + stop 2ATR',retest:true,trend:true,stopATR:2,targetR:1.5},
 {id:'retest-trend-near',name:'Reteste + tendência + alvo 1,5R',retest:true,trend:true,stopATR:1.5,targetR:1.5}
];
export const UPGRADE_RULES={trend:{fast:20,slow:50,minimumBars:50},retest:{maxHours:3,toleranceATR:.15,confirmationATR:.05,invalidationATR:.5},delayMinutes:2,gate:'fixed-stress',gateMinimum:4,gateStopATR:1.5};
export function routeUpgrade(bars,frames,variant,rules=UPGRADE_RULES){
 let pending=null;const out=new Map(),counts={breakouts:0,retests:0,expired:0,invalidated:0,trendVetoes:0};
 function emit(b,side,candidate,origin,kind){const h=frameAt(frames.hourly,b.at),f=frameAt(frames.fourHourly,b.at),trendAllowed=!variant.trend||h?.side===side&&f?.side===side;if(candidate&&!trendAllowed)counts.trendVetoes++;
  const row={signalAt:b.at,side,price:b.close,atr:b.atr,entryCandidate:candidate&&trendAllowed,originAt:origin.at,level:side===1?origin.upper:origin.lower,kind,trend1h:h?.side??null,trend4h:f?.side??null,trend4hAt:f?.at??null},key=b.at+'/'+side,prior=out.get(key);if(!prior||row.entryCandidate)out.set(key,row);
 }
 for(const b of bars){
  if(pending&&(b.at>pending.at+rules.retest.maxHours*3600000)){pending=null;counts.expired++;}
  if(pending&&((pending.cross===1&&b.close<pending.upper-rules.retest.invalidationATR*pending.atr)||(pending.cross===-1&&b.close>pending.lower+rules.retest.invalidationATR*pending.atr))){pending=null;counts.invalidated++;}
  if(pending&&b.cross&&b.cross!==pending.cross){pending=null;counts.invalidated++;}
  if(variant.retest&&pending&&b.at>pending.at){const side=pending.cross,level=side===1?pending.upper:pending.lower,tol=rules.retest.toleranceATR*pending.atr,confirm=rules.retest.confirmationATR*pending.atr,touch=b.low<=level+tol&&b.high>=level-tol,held=side===1?b.close>=level+confirm:b.close<=level-confirm;
   if(touch&&held){emit(b,side,true,pending,'retest');counts.retests++;pending=null;}
  }
  if(b.ready&&b.cross){counts.breakouts++;if(!variant.retest)emit(b,b.cross,true,b,'breakout');else{emit(b,b.cross,false,b,'exit-only');if(!pending)pending=b;}}
 }
 return {rows:[...out.values()].sort((a,b)=>a.signalAt-b.signalAt||a.side-b.side),counts};
}
export function upgradePrepared(hourly,donchian,until=Infinity){const closed=hourly.filter(r=>r[0]+3600000<=until);return {bars:prepareDonchian(closed,donchian,until).adaptive,frames:{hourly:trendFrames(closed,1,UPGRADE_RULES.trend),fourHourly:trendFrames(closed,4,UPGRADE_RULES.trend)}};}
export function upgradeSignals(hourly,donchian,until=Infinity){
 const {bars,frames}=upgradePrepared(hourly,donchian,until);
 return Object.fromEntries(UPGRADE_VARIANTS.map(v=>[v.id,routeUpgrade(bars,frames,v)]));
}
export function upgradeExecution(rows,{start,end,strategy,rules=UPGRADE_RULES}){
 const cost=strategy.costCases.find(c=>c.id==='stress');if(!cost)throw Error('Missing fixed cost assumption');
 return rows.filter(s=>s.signalAt+rules.delayMinutes*60000>=start&&s.signalAt+rules.delayMinutes*60000<end).map(s=>{
  if(![-1,1].includes(s.side)||!(s.atr>0&&s.price>0)||s.originAt>s.signalAt||s.trend4hAt>s.signalAt)throw Error('Invalid or future upgrade signal');
  const costVeto=!!volatilityVeto(s,{...strategy,...cost},rules.gateMinimum);
  return {at:s.signalAt+rules.delayMinutes*60000,knownAt:s.signalAt,family:'cross',side:s.side,atr:s.atr,holdMinutes:strategy.maxHoldMinutes??1440,entryAllowed:s.entryCandidate&&!costVeto,context:{originAt:s.originAt,level:s.level,kind:s.kind,trend1h:s.trend1h,trend4h:s.trend4h,trend4hAt:s.trend4hAt,costVeto}};
 });
}
export function upgradeWindows(months,cutoff){const out=[];for(const m of months.filter(m=>m.complete&&m.end<=cutoff).sort((a,b)=>a.start-b.start)){const quarter=m.month.slice(0,4)+'Q'+(Math.floor((Number(m.month.slice(5))-1)/3)+1),last=out.at(-1);if(last&&last.quarter===quarter&&last.end===m.start){last.end=m.end;last.months.push(m.month);}else out.push({id:m.month,quarter,start:m.start,end:m.end,months:[m.month],role:m.month<'2024-01'?'development':'evaluation'});}return out;}
export function summarizeUpgradeWindows(rows,variants=UPGRADE_VARIANTS){
 return variants.map(v=>{const summary={id:v.id,name:v.name};for(const role of ['development','evaluation']){const a=rows.filter(r=>r.variant===v.id&&r.role===role&&r.cost==='stress'),months=a.reduce((n,r)=>n+r.months,0);summary[role]={windows:a.length,months,trades:a.reduce((n,r)=>n+r.count,0),meanMonthlyBRL:months?a.reduce((n,r)=>n+r.pnlBRL,0)/months:null,positiveWindows:a.filter(r=>r.pnlBRL>0).length,beatCDIWindows:a.filter(r=>r.excessCDIBRL>0).length,meanMonthlyExcessCDIBRL:months?a.reduce((n,r)=>n+(r.excessCDIBRL??0),0)/months:null,maxDD:Math.max(0,...a.map(r=>r.maxDD)),haltedWindows:a.filter(r=>r.halted).length};}return summary;});
}
export function chooseDevelopment(rows){
 // This function never reads evaluation observations.
 const summaries=summarizeUpgradeWindows(rows.filter(r=>r.role==='development')),control=summaries.find(r=>r.id==='control').development;
 const candidates=summaries.filter(s=>s.id!=='control'&&s.development.trades>=30&&s.development.meanMonthlyBRL>0&&s.development.meanMonthlyBRL>control.meanMonthlyBRL&&s.development.positiveWindows>=Math.ceil(s.development.windows/2)&&s.development.maxDD<=.15&&s.development.haltedWindows<=control.haltedWindows).sort((a,b)=>b.development.meanMonthlyBRL-a.development.meanMonthlyBRL||a.id.localeCompare(b.id));
 return {selected:candidates[0]?.id??null,eligible:candidates.map(c=>c.id),criterion:'Development only: >=30 trades, positive mean monthly PnL and improvement over control, >=half positive windows, DD<=15%, no more halted windows than control; rank by mean monthly stress PnL, deterministic id tie break.'};
}
