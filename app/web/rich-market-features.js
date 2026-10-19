import{scalpingIndicators}from'./scalping.js';import{contextIndicators}from'./decision-context.js';
export const EXTRA_FEATURES=['ADX14 /100','DiferençaDI a favor /100','HistogramaMACD /ATR a favor','VariaçãoMACD15min /ATR a favor','LarguraBollinger /ATR','DistânciaSMA20 em desvios a favor','Retorno15min /ATR a favor','Retorno1h /ATR a favor','VariaçãoRSI15min a favor','VariaçãoATR1h','Delta taker agregado1h a favor','Corpo do candle /ATR a favor','Assimetria de sombras a favor','Volatilidade realizada1h','Basis mark/negócio /ATR a favor','Log volume3candles /média20 anterior','Seno da horaUTC','Cosseno da horaUTC'];
// The DMI calculation is interval-independent; its hourly output timestamp is unused here.
export function richContexts(five,markCloses=[]){
 const bars=scalpingIndicators(five),dmi=contextIndicators(five),out=[];
 for(let i=63;i<bars.length;i++){
  const b=bars[i],old=bars[i-12],p3=bars[i-3],d=dmi[i],window=bars.slice(i-11,i+1),returns=window.map((r,j)=>Math.log(r.close/bars[i-12+j].close)),mean=returns.reduce((n,v)=>n+v,0)/12,rv=Math.sqrt(returns.reduce((n,v)=>n+(v-mean)**2,0)/12),volume=window.reduce((n,r)=>n+r.volume,0),delta=window.reduce((n,r)=>n+r.delta,0),three=bars.slice(i-2,i+1).reduce((n,r)=>n+r.volume,0)/3,prevMean=bars.slice(i-20,i).reduce((n,r)=>n+r.volume,0)/20,width=b.upper-b.lower,std=width/4,range=b.high-b.low,mark=markCloses[i],hour=(b.at%86400000)/3600000;
  if(!(b.atr>0&&old.atr>0&&std>0&&prevMean>0&&three>0&&volume>0)||d.adx===null||d.plusDI===null||d.minusDI===null)continue;
  const extra=[d.adx/100,(d.plusDI-d.minusDI)/100,b.histogram/b.atr,(b.histogram-p3.histogram)/b.atr,width/b.atr,(b.close-b.mean)/std,(b.close-p3.close)/b.atr,(b.close-old.close)/b.atr,(b.rsi-p3.rsi)/100,b.atr/old.atr-1,delta/volume,(b.close-b.open)/b.atr,range?((Math.min(b.open,b.close)-b.low)-(b.high-Math.max(b.open,b.close)))/range:0,rv,(mark-b.close)/b.atr,Math.log(three/prevMean),Math.sin(2*Math.PI*hour/24),Math.cos(2*Math.PI*hour/24)];
  if(extra.every(Number.isFinite))out.push({at:b.at,close:b.close,atr:b.atr,fast:b.fast,slow:b.slow,side:b.side,histogram:b.histogram,adx:d.adx,rsi:b.rsi,extra});
 }return out;
}
export function enrichFeature(feature,context){
 if(!context||context.at!==feature.at||feature.x.length!==12||context.extra.length!==18||![-1,1].includes(feature.side))throw Error('Contexto enriquecido indisponível ou futuro');
 const directional=new Set([1,2,3,5,6,7,8,10,11,12,14]),x=[...feature.x,...context.extra.map((v,i)=>directional.has(i)?v*feature.side:v)];if(!x.every(Number.isFinite))throw Error('Entrada enriquecida inválida');return{...feature,x};
}
export function tightenStop(position,context,cfg,policy){
 if(!context||context.at<=position.entryAt||!policy.trail)return position.stop;
 const favorable=position.side*(context.close-position.entry),risk=Math.abs(position.entry-position.initialStop);
 if(!(risk>0)||favorable<policy.activationR*risk&&!position.trailActive)return position.stop;
 position.trailActive=true;position.bestClose=position.bestClose==null?context.close:position.side===1?Math.max(position.bestClose,context.close):Math.min(position.bestClose,context.close);
 const equilibrium=(position.side*position.entry+position.entryFee/position.qty-position.funding/position.qty)/((1-position.side*cfg.slippage)*(position.side-cfg.fee)),candidate=position.bestClose-position.side*policy.trailATR*context.atr;
 return position.side===1?Math.max(position.stop,candidate,equilibrium):Math.min(position.stop,candidate,equilibrium);
}
export function contextInvalidates(position,context){return Boolean(context&&context.at>position.entryAt&&context.side===-position.side&&position.side*(context.close-context.slow)<0);}
