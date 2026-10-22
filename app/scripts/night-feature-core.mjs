import{scalpingIndicators}from'../web/scalping.js';import{scalpTrendFrames}from'../web/scalp-tree.js';import{frameAt}from'../web/scalping-context.js';
const clip=(v,a=-10,b=10)=>Math.max(a,Math.min(b,v));
export function liveFeature(five,hourly,now){
 const closed=five.filter(r=>r[0]+300000<=now),hours=hourly.filter(r=>r[0]+3600000<=now),frames=scalpTrendFrames(hours,{fast:20,slow:50,minimumBars:150}),bars=scalpingIndicators(closed),i=bars.length-1,b=bars[i];if(!b?.ready)throw Error('Indicator warmup unavailable');const h=frameAt(frames.hourly,b.at),f=frameAt(frames.fourHourly,b.at);if(!h||!f||h.at>b.at||f.at>b.at||!(h.atr>0&&f.atr>0))throw Error('Long-term trend warmup unavailable');
 const x=[(b.rsi-50)/50,clip(b.atr/b.close,0,.1)*10,clip(Math.log(Math.max(b.rvol??0,1e-8)),-5,5)/5,b.vwap==null?0:clip((b.close-b.vwap)/b.atr)/10,clip((b.fast-b.slow)/b.atr)/10,clip(b.histogram/b.atr,-5,5)/5,b.deltaPct??0,h.side,f.side,clip((h.fast-h.slow)/h.atr)/10,clip((f.fast-f.slow)/f.atr)/10,clip(b.close/bars[i-1].close-1,-.1,.1)*10,b.volume>0?1:0,b.vwap==null?0:1,Number.isFinite(b.rvol)?1:0];const r=closed.at(-1),[_,o,hi,lo,cl]=r;x.push(clip((cl-o)/b.atr),clip((hi-Math.max(o,cl))/b.atr),clip((Math.min(o,cl)-lo)/b.atr),clip((hi-lo)/b.atr));if(x.length!==19||!x.every(Number.isFinite)||b.at>now)throw Error('Invalid/future live feature');return{at:b.at,knownAt:now,close:b.close,atr:b.atr,x};
}
export function scheduledEntryTime(recordedAt){return(Math.floor(recordedAt/60000)+1)*60000;}
export function chooseSide(long,short){if(!Number.isFinite(long)||!Number.isFinite(short))throw Error('Invalid score');return Math.max(long,short)>.1&&Math.abs(long-short)>1e-8?(long>short?1:-1):0;}

export function normalizeKline(r){return [r[0],r[1],r[2],r[3],r[4],r[5],r[7],r[9]].map(Number);}
