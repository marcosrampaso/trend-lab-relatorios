import {HOUR,simulate} from './engine.js';
import {makeDirectionFilter} from './direction-filter.js';
export const QUARTER=HOUR/4;
export function candidateSignal(kind,b,previous,prior,trend){
 if(!b.ready||!trend?.ready||trend.at>b.at||!(trend.atr>0))return null;
 let side=0,mean;
 if(kind==='range'){
  if(prior.length!==32||Math.abs(trend.fast-trend.slow)/trend.atr>0.5)return null;
  const lower=Math.min(...prior.map(r=>r[3])),upper=Math.max(...prior.map(r=>r[2]));
  const touchesLow=b.low<=lower,touchesHigh=b.high>=upper;
  if(touchesLow===touchesHigh||!(b.close>lower&&b.close<upper))return null;
  side=touchesLow?1:-1;mean=(lower+upper)/2;
 }
 if(kind==='vwap'){
  if(!previous||previous.day!==b.day||new Date(b.at).toISOString().slice(0,10)!==b.day||b.sessionBars<4||!(b.sessionVolume>0)||b.vwap===null||previous.vwap===null)return null;
  if(trend.side===1&&previous.close>previous.vwap&&b.low<=previous.vwap&&b.close>b.vwap)side=1;
  if(trend.side===-1&&previous.close<previous.vwap&&b.high>=previous.vwap&&b.close<b.vwap)side=-1;
 }
 if(!side)return null;
 return {at:b.at,side,price:b.close,atr:b.atr,mean,fast:trend.fast,slow:trend.slow,trendAt:trend.at,trendSide:trend.side,vwap:b.vwap,channel:kind==='range'?{lower:Math.min(...prior.map(r=>r[3])),upper:Math.max(...prior.map(r=>r[2]))}:null};
}
export function candidateIndicators(rows,until=Infinity){
 const bars=[];let previous,atr,trSum=0,day='',weighted=0,volume=0,sessionBars=0;
 for(let i=0;i<rows.length;i++){
  const [time,open,high,low,close,v]=rows[i],at=time+QUARTER;if(at>until)break;
  const tr=Math.max(high-low,previous===undefined?0:Math.abs(high-previous),previous===undefined?0:Math.abs(low-previous));
  if(i<14){trSum+=tr;if(i===13)atr=trSum/14;}else atr=(atr*13+tr)/14;
  const key=new Date(time).toISOString().slice(0,10);if(key!==day){day=key;weighted=0;volume=0;sessionBars=0;}
  weighted+=(high+low+close)/3*v;volume+=v;sessionBars++;
  bars.push({time,at,open,high,low,close,volume:v,day,sessionBars,sessionVolume:volume,vwap:volume>0?weighted/volume:null,atr,ready:atr>0});previous=close;
 }return bars;
}
export function buildCandidateSignals(data,execution,kind,until=Infinity){
 if(!['range','vwap'].includes(kind))throw Error('Hipótese inválida');
 const direction=makeDirectionFilter(data.candles,until),bars=candidateIndicators(execution.candles,until),signals=[];
 for(let i=0;i<bars.length;i++){const b=bars[i],trend=direction.at(b.at),s=candidateSignal(kind,b,bars[i-1],execution.candles.slice(Math.max(0,i-32),i),trend);if(s)signals.push(s);}
 return signals;
}
export function simulateCandidate(data,execution,{kind,start,until,cost,signals}={}){
 if(!['range','vwap'].includes(kind))throw Error('Hipótese inválida');
 const computed=signals??buildCandidateSignals(data,execution,kind,until),registry=new Map(computed.filter(s=>s.at>=start&&s.at<until).map(s=>[s.at,s]));
 return simulate(data,{start,until,strategy:kind==='range'?'reversion':'breakout',maxHoldHours:kind==='range'?12:24,stopATR:1.5,targetR:kind==='vwap'?2:null,cooldownHours:4,entryDelayHours:0,registeredSignals:registry,execution:{candles:execution.candles,marks:execution.marks,intervalMs:QUARTER},config:{capitalBRL:300,fx:5,risk:0.01,leverage:10,fee:cost?.fee??0.0005,slippage:cost?.slippage??0.0002},closeAtEnd:true});
}
