import{DEFAULTS,exchangeRules,sizePosition}from'./engine.js';
export const MINUTE=60000,FIVE=5*MINUTE;
export function aggregateFive(rows,until=Infinity){
 const out=[];for(let i=0;i<rows.length;i+=5){const a=rows.slice(i,i+5);if(a.length<5||a[0][0]+FIVE>until)break;if(a[0][0]%FIVE||a.some((r,j)=>r[0]!==a[0][0]+j*MINUTE))throw Error('Lacuna nos candles1m');out.push([a[0][0],a[0][1],Math.max(...a.map(r=>r[2])),Math.min(...a.map(r=>r[3])),a[4][4],a.reduce((n,r)=>n+r[5],0),a.reduce((n,r)=>n+r[6],0),a.reduce((n,r)=>n+r[7],0)]);}return out;
}
export function scalpingIndicators(rows,until=Infinity){
 const out=[],closes=[],volumes=[];let fast,slow,e12,e26,macdSignal,prev,atr,trSeed=0,gainSum=0,lossSum=0,ag=null,al=null,day='',base=0,quote=0,sessionBars=0;
 for(let i=0;i<rows.length;i++){
  const[time,open,high,low,close,volume,q,buy]=rows[i],at=time+FIVE;if(at>until)break;
  fast=fast===undefined?close:fast+2/10*(close-fast);slow=slow===undefined?close:slow+2/22*(close-slow);e12=e12===undefined?close:e12+2/13*(close-e12);e26=e26===undefined?close:e26+2/27*(close-e26);const macd=e12-e26;macdSignal=macdSignal===undefined?macd:macdSignal+2/10*(macd-macdSignal);
  const tr=Math.max(high-low,prev===undefined?0:Math.abs(high-prev),prev===undefined?0:Math.abs(low-prev));if(i<14){trSeed+=tr;if(i===13)atr=trSeed/14;}else atr=(atr*13+tr)/14;
  if(prev!==undefined){const change=close-prev,g=Math.max(change,0),l=Math.max(-change,0);if(i<=14){gainSum+=g;lossSum+=l;if(i===14){ag=gainSum/14;al=lossSum/14;}}else{ag=(ag*13+g)/14;al=(al*13+l)/14;}}
  const rsi=ag===null?null:ag===0&&al===0?50:al===0?100:100-100/(1+ag/al),average=volumes.length===20?volumes.reduce((s,v)=>s+v,0)/20:null,rvol=average>0?volume/average:null;
  closes.push(close);if(closes.length>20)closes.shift();const mean=closes.reduce((s,v)=>s+v,0)/closes.length,std=Math.sqrt(closes.reduce((s,v)=>s+(v-mean)**2,0)/closes.length);
  const nextDay=new Date(time).toISOString().slice(0,10);if(nextDay!==day){day=nextDay;base=0;quote=0;sessionBars=0;}base+=volume;quote+=q;sessionBars++;
  out.push({time,at,open,high,low,close,volume,rvol,fast,slow,side:fast>slow?1:fast<slow?-1:0,atr,rsi,macd,macdSignal,histogram:macd-macdSignal,mean,upper:mean+2*std,lower:mean-2*std,vwap:base>0?quote/base:null,day,sessionBars,delta:2*buy-volume,deltaPct:volume>0?(2*buy-volume)/volume:null,ready:i>=63&&atr>0});
  volumes.push(volume);if(volumes.length>20)volumes.shift();prev=close;
 }return out;
}
export function scalpSignal(kind,b,previous,protocol){
 if(!['cross','vwap','bands'].includes(kind))throw Error('Hipótese de scalping inválida');if(!b?.ready||!previous)return null;let side=0,target=null;
 if(kind==='cross'&&b.side&&previous.side&&b.side!==previous.side)side=b.side;
 if(kind==='vwap'&&b.day===previous.day&&new Date(b.at).toISOString().slice(0,10)===b.day&&b.sessionBars>=4&&b.vwap!=null&&previous.vwap!=null&&b.rvol>=protocol.rvol.min){if(b.side===1&&previous.close>previous.vwap&&b.low<=previous.vwap&&b.close>b.vwap)side=1;if(b.side===-1&&previous.close<previous.vwap&&b.high>=previous.vwap&&b.close<b.vwap)side=-1;}
 if(kind==='bands'&&b.close>=b.lower&&b.close<=b.upper){if(previous.close<previous.lower&&previous.rsi!=null&&previous.rsi<=30&&b.rsi>30)side=1;else if(previous.close>previous.upper&&previous.rsi>=70&&b.rsi<70)side=-1;if(side)target=b.mean;}
 return side?{at:b.at,side,price:b.close,atr:b.atr,target,context:b}:null;
}
export function prepareScalping(data,protocol){const bars=scalpingIndicators(data.five??aggregateFive(data.candles));const signals=Object.fromEntries(protocol.strategies.map(s=>[s.id,bars.map((b,i)=>scalpSignal(s.id,b,bars[i-1],protocol)).filter(Boolean)]));return{bars,signals};}
export function simulateScalping(data,{strategy='cross',start,until,protocol,cost=protocol.costCases[0],prepared=null,closeAtEnd=false}={}){
 if(!protocol||!Number.isFinite(start)||!Number.isFinite(until)||until<start)throw Error('Janela de scalping inválida');if(!protocol.strategies.some(s=>s.id===strategy))throw Error('Estratégia inválida');
 const cfg={...DEFAULTS,capitalBRL:protocol.capitalBRL,fx:protocol.fx,risk:protocol.risk,leverage:protocol.leverage,dailyLimit:protocol.dailyLimit,totalLimit:protocol.totalLimit,fee:cost.fee,slippage:cost.slippage,maintenance:protocol.maintenance,fundingReserve:protocol.fundingReserve};if(!(cfg.risk>0&&cfg.risk<=.1&&cfg.leverage>=1&&cfg.leverage<=10))throw Error('Risco inválido');
 const research=prepared??prepareScalping(data,protocol),signals=research.signals[strategy].filter(s=>s.at>=start&&s.at<=until),registry=new Map(signals.map(s=>[s.at,s])),marks=new Map(data.marks.filter(r=>r[0]>=start&&r[0]+MINUTE<=until).map(r=>[r[0],r])),funding=new Map((data.funding??[]).filter(f=>f[0]>=start&&f[0]<until).map(f=>[f[0],f[1]])),rules=exchangeRules(data.filters),initial=cfg.capitalBRL/cfg.fx;
 let cash=initial,pos=null,fees=0,fundingNet=0,peak=initial,maxDD=0,halted=false,blocked=false,day='',dayStart=initial,lastExit=-Infinity,lastRow=null;const trades=[],events=[],equity=[];
 function close(raw,at,reason){if(!pos)return;const exit=raw*(1-pos.side*cfg.slippage),exitFee=pos.qty*exit*cfg.fee,gross=pos.side*pos.qty*(exit-pos.entry);cash+=gross-exitFee;fees+=exitFee;trades.push({...pos,exit,exitReference:raw,exitAt:at,exitFee,gross,reason,net:gross-pos.entryFee-exitFee+pos.funding,slippageCost:pos.qty*(Math.abs(pos.entry-pos.entryReference)+Math.abs(exit-raw))});events.push({at,kind:'exit',reason,side:pos.side,price:exit,knownAt:['Stop','Alvo','Liquidação estimada','Limite global','Limite diário','Encerramento do teste'].includes(reason)?at:at+MINUTE});pos=null;lastExit=at;}
 const liquidation=()=>{const m=pos.margin+pos.funding-pos.entryFee;return pos.side===1?(pos.qty*pos.entry-m)/(pos.qty*(1-cfg.maintenance)):(pos.qty*pos.entry+m)/(pos.qty*(1+cfg.maintenance));};
 for(const r of data.candles){const[t,o,h,l,c]=r;if(t<start)continue;if(t+MINUTE>until)break;const mark=marks.get(t);if(!mark)throw Error('Mark price1m ausente');lastRow=r;
  const key=new Date(t).toISOString().slice(0,10);if(key!==day){day=key;dayStart=cash+(pos?pos.side*pos.qty*(mark[1]-pos.entry):0);blocked=false;}
  if(pos&&funding.has(t)){const amount=-pos.side*pos.qty*mark[1]*funding.get(t);cash+=amount;fundingNet+=amount;pos.funding+=amount;}
  if(pos&&t-pos.entryAt>=protocol.maxHoldMinutes*MINUTE)close(o,t,'Limite de '+protocol.maxHoldMinutes+'min');
  const sig=registry.get(t);
  if(sig){if(pos&&pos.side!==sig.side)close(o,t,'Sinal contrário');let why=pos?'Posição já aberta':halted?'Limite global ativo':blocked?'Limite diário ativo':t-lastExit<protocol.cooldownMinutes*MINUTE?'Intervalo após saída':null;
   if(why)events.push({at:t,knownAt:t+MINUTE,kind:'skipped',reason:why});else{
    const entry=o*(1+sig.side*cfg.slippage),stop=entry-sig.side*protocol.stopATR*sig.atr,target=sig.target??entry+sig.side*protocol.targetR*Math.abs(entry-stop),invalid=(target-entry)*sig.side<=0,sized=invalid?null:sizePosition(cash,entry,stop,cfg,rules);
    if(!sized)events.push({at:t,knownAt:t+MINUTE,kind:'rejected',reason:invalid?'Alvo já ultrapassado na abertura':'Mínimo da corretora excede orçamento de risco'});else{
     const entryFee=sized.qty*entry*cfg.fee;pos={...sized,side:sig.side,signalAt:sig.at,entryAt:t,entry,entryReference:o,stop,target,entryFee,funding:0,context:sig.context};cash-=entryFee;fees+=entryFee;const lp=liquidation();if(sig.side===1?stop<=lp:stop>=lp){cash+=entryFee;fees-=entryFee;pos=null;events.push({at:t,knownAt:t+MINUTE,kind:'rejected',reason:'Stop além da liquidação estimada'});}else events.push({at:t,knownAt:t+MINUTE,kind:'entry',side:sig.side,price:entry});
    }
   }
  }
  if(pos){const lp=liquidation(),liq=pos.side===1?mark[3]<=lp:mark[2]>=lp,stop=pos.side===1?l<=pos.stop:h>=pos.stop,target=pos.side===1?h>=pos.target:l<=pos.target;
   if(liq){close(pos.side===1?Math.min(o,lp):Math.max(o,lp),t+MINUTE,'Liquidação estimada');halted=true;}else if(stop)close(pos.side===1?Math.min(o,pos.stop):Math.max(o,pos.stop),t+MINUTE,'Stop');else if(target)close(pos.target,t+MINUTE,'Alvo');
  }
  const value=cash+(pos?pos.side*pos.qty*(mark[4]-pos.entry):0);if(value<=initial*(1-cfg.totalLimit)){if(pos)close(c,t+MINUTE,'Limite global');if(!halted)events.push({at:t+MINUTE,knownAt:t+MINUTE,kind:'halt',reason:'Limite global'});halted=true;}if(value<=dayStart*(1-cfg.dailyLimit)){if(pos)close(c,t+MINUTE,'Limite diário');blocked=true;}
  const balance=cash+(pos?pos.side*pos.qty*(mark[4]-pos.entry):0);peak=Math.max(peak,balance);maxDD=Math.max(maxDD,(peak-balance)/peak);equity.push({time:t+MINUTE,value:balance});
 }
 if(closeAtEnd&&pos&&lastRow){close(lastRow[4],lastRow[0]+MINUTE,'Encerramento do teste');equity.at(-1).value=cash;maxDD=Math.max(maxDD,(peak-cash)/peak);}
 const final=equity.at(-1)?.value??initial;return{initial,final,pnl:final-initial,returnPct:final/initial-1,cash,position:pos,trades,signals,events,equity,fees,fundingNet,maxDD,halted,blocked,cfg,until,start,rejected:events.filter(e=>e.kind==='rejected').length,skipped:events.filter(e=>e.kind==='skipped').length,haltAt:events.find(e=>e.kind==='halt')?.at??trades.find(t=>t.reason==='Liquidação estimada')?.exitAt??null};
}
