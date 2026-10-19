const HOUR=3600000,N=14;
// One forward pass. The current volume is never part of its reference mean.
export function contextIndicators(rows,until=Infinity){
 const out=[],volumes=[];let volumeSum=0,prev=null,gainSum=0,lossSum=0,avgGain=null,avgLoss=null,trSeed=0,atr=null,dmTR=0,dmPlus=0,dmMinus=0,dxSeed=0,dxCount=0,adx=null,day=null,pv=0,dayVolume=0;
 for(let i=0;i<rows.length;i++){
  const r=rows[i],[time,open,high,low,close,volume]=r,at=time+HOUR;if(at>until)break;
  const tr=Math.max(high-low,prev?Math.abs(high-prev[4]):0,prev?Math.abs(low-prev[4]):0);
  if(i<N){trSeed+=tr;if(i===N-1)atr=trSeed/N;}else atr=(atr*(N-1)+tr)/N;
  let plusDI=null,minusDI=null;
  if(prev){
   const change=close-prev[4],gain=Math.max(change,0),loss=Math.max(-change,0);
   if(i<=N){gainSum+=gain;lossSum+=loss;if(i===N){avgGain=gainSum/N;avgLoss=lossSum/N;}}else{avgGain=(avgGain*(N-1)+gain)/N;avgLoss=(avgLoss*(N-1)+loss)/N;}
   const up=high-prev[2],down=prev[3]-low,plus=up>down&&up>0?up:0,minus=down>up&&down>0?down:0;
   if(i<=N){dmTR+=tr;dmPlus+=plus;dmMinus+=minus;}else{dmTR=dmTR-dmTR/N+tr;dmPlus=dmPlus-dmPlus/N+plus;dmMinus=dmMinus-dmMinus/N+minus;}
   if(i>=N){plusDI=dmTR>0?100*dmPlus/dmTR:0;minusDI=dmTR>0?100*dmMinus/dmTR:0;const dx=plusDI+minusDI>0?100*Math.abs(plusDI-minusDI)/(plusDI+minusDI):0;if(dxCount<N){dxSeed+=dx;dxCount++;if(dxCount===N)adx=dxSeed/N;}else adx=(adx*(N-1)+dx)/N;}
  }
  const rsi=avgGain===null?null:avgGain===0&&avgLoss===0?50:avgLoss===0?100:100-100/(1+avgGain/avgLoss);
  const volumeMean=volumes.length===20?volumeSum/20:null,rvol=volumeMean>0?volume/volumeMean:null;
  const nextDay=new Date(time).toISOString().slice(0,10);if(nextDay!==day){day=nextDay;pv=0;dayVolume=0;}pv+=(high+low+close)/3*volume;dayVolume+=volume;
  out.push({at,close,volume,volumeMean,rvol,rsi,atr,atrPct:atr===null?null:atr/close,vwap:dayVolume>0?pv/dayVolume:null,vwapDay:day,adx,plusDI,minusDI});
  volumes.push(volume);volumeSum+=volume;if(volumes.length>20)volumeSum-=volumes.shift();prev=r;
 }
 return out;
}
export function contextChecks(context,side,mode,protocol){
 if(!['observe','volume','rsi','combined'].includes(mode))throw Error('Filtro de contexto inválido');
 if(mode==='observe')return [];
 const checks=[];
 if(mode==='volume'||mode==='combined')checks.push({id:'volume',pass:context?.rvol!=null&&context.rvol>=protocol.rvolMin,reason:context?.rvol==null?'Volume relativo indisponível':'Volume relativo abaixo de '+protocol.rvolMin+'×'});
 if(mode==='rsi'||mode==='combined'){const range=side===1?protocol.longRSI:protocol.shortRSI;checks.push({id:'rsi',pass:[1,-1].includes(side)&&context?.rsi!=null&&context.rsi>=range[0]&&context.rsi<=range[1],reason:context?.rsi==null?'RSI indisponível':'RSI fora de '+range[0]+'–'+range[1]+' para '+(side===1?'LONG':'SHORT')});}
 return checks;
}
export function createContextFilter(contexts,mode,protocol){
 const byAt=new Map(contexts.map(c=>[c.at,c]));
 return {at:at=>byAt.get(at)??null,veto(signal){return contextChecks(byAt.get(signal.at),signal.side,mode,protocol).filter(c=>!c.pass).map(c=>c.reason).join('; ')||null;}};
}
