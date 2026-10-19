export function intradayBars(rows,until,kind){
 const bars=[];let fast,slow,atr,prev,priorSide=0;const closes=[];
 for(let i=0;i<rows.length;i++){
  const r=rows[i],at=r[0]+3600000;if(at>until)break;const [time,open,high,low,close,volume]=r;
  const tr=Math.max(high-low,prev===undefined?0:Math.abs(high-prev),prev===undefined?0:Math.abs(low-prev));
  fast=fast===undefined?close:fast+(2/10)*(close-fast);slow=slow===undefined?close:slow+(2/22)*(close-slow);
  atr=atr===undefined?tr:(atr*13+tr)/14;closes.push(close);
  const tail=closes.slice(-20),mean=tail.reduce((s,v)=>s+v,0)/tail.length,std=Math.sqrt(tail.reduce((s,v)=>s+(v-mean)**2,0)/tail.length);
  let side=0,signal=0;const ready=i>=63;
  if(kind==='trend1h'){side=fast>slow?1:-1;if(ready&&priorSide&&side!==priorSide)signal=side;priorSide=side;}
  if(kind==='breakout'&&ready){const prior=rows.slice(i-20,i),avg=prior.reduce((s,b)=>s+b[5],0)/20;if(volume>avg*1.2){if(close>Math.max(...prior.map(b=>b[2])))signal=1;if(close<Math.min(...prior.map(b=>b[3])))signal=-1;}side=signal;}
  if(kind==='reversion'&&ready){const b=bars.at(-1);if(b.close<b.lower&&close>=mean-2*std&&close<=mean+2*std)signal=1;else if(b.close>b.upper&&close<=mean+2*std&&close>=mean-2*std)signal=-1;side=signal;}
  bars.push({time,at,open,high,low,close,volume,fast,slow,atr,ready,side,cross:signal,mean,lower:mean-2*std,upper:mean+2*std});prev=close;
 }return bars;
}
