import {fundingBuckets} from '../web/research-funding-buckets.js';
// Research-only policy fork. Monetary accounting stays matched to the frozen engine; explicit switches control global/after-liquidation stops. No real orders.
import {DEFAULTS,exchangeRules,sizePosition} from '../web/engine.js';
import {MINUTE} from '../web/scalping.js';
export function createResearchAccount({start,until,protocol,cost=protocol.costCases[0],signals=[],filters,markFallback=false,globalLossStop=true,continueAfterLiquidation=false}={}){
 if(!protocol||!Number.isFinite(start)||!Number.isFinite(until)||until<start)throw Error('Janela de scalping inválida');
 const cfg={...DEFAULTS,capitalBRL:protocol.capitalBRL,fx:protocol.fx,risk:protocol.risk,leverage:protocol.leverage,dailyLimit:protocol.dailyLimit,totalLimit:protocol.totalLimit,fee:cost.fee,slippage:cost.slippage,maintenance:protocol.maintenance,fundingReserve:protocol.fundingReserve};if(!(cfg.risk>0&&cfg.risk<=.1&&cfg.leverage>=1&&cfg.leverage<=10))throw Error('Risco inválido');
 const registry=new Map();for(const s of signals.filter(s=>s.at>=start&&s.at<=until)){if(!['cross','vwap','bands'].includes(s.family)||![30,60,120,240,720,1440].includes(s.holdMinutes)||s.knownAt>s.at)throw Error('Sinal adaptativo inválido');if(!registry.has(s.at))registry.set(s.at,[]);registry.get(s.at).push(s);}const rules=exchangeRules(filters),initial=cfg.capitalBRL/cfg.fx;
 let cash=initial,pos=null,fees=0,fundingNet=0,peak=initial,maxDD=0,halted=false,blocked=false,day='',dayStart=initial,lastExit=-Infinity,lastRow=null;const trades=[],events=[],equity=[];let bankrupt=false,bankruptAt=null;let next=start,proxyMinutes=0,proxyExposureMinutes=0,proxyEntries=0;const proxyRanges=[];
 function close(raw,at,reason){if(!pos)return;const exit=raw*(1-pos.side*cfg.slippage),exitFee=pos.qty*exit*cfg.fee,gross=pos.side*pos.qty*(exit-pos.entry);cash+=gross-exitFee;fees+=exitFee;trades.push({...pos,exit,exitReference:raw,exitAt:at,exitFee,gross,reason,net:gross-pos.entryFee-exitFee+pos.funding,slippageCost:pos.qty*(Math.abs(pos.entry-pos.entryReference)+Math.abs(exit-raw))});events.push({at,kind:'exit',reason,side:pos.side,price:exit,knownAt:['Stop','Alvo','Liquidação estimada','Limite global','Limite diário','Encerramento do teste'].includes(reason)?at:at+MINUTE});pos=null;lastExit=at;}
 const liquidation=()=>{const m=pos.margin+pos.funding-pos.entryFee;return pos.side===1?(pos.qty*pos.entry-m)/(pos.qty*(1-cfg.maintenance)):(pos.qty*pos.entry+m)/(pos.qty*(1+cfg.maintenance));};
 function consume(data){
 const from=data.candles[0]?.[0]??next,to=(data.candles.at(-1)?.[0]??(next-MINUTE))+MINUTE;
 if(from!==next||to>until)throw Error('Noncontiguous streaming market chunk');
 const marks=new Map(data.marks.map(r=>[r[0],r])),funding=fundingBuckets(data.funding,from,to);
 for(const r of data.candles){const[t,o,h,l,c]=r;if(t!==next)throw Error('Missing/duplicate streaming candle');next=t+MINUTE;let mark=marks.get(t),proxy=!mark;
  if(proxy){if(!markFallback)throw Error('Mark price1m ausente');mark=r;proxyMinutes++;if(pos)proxyExposureMinutes++;const previous=proxyRanges.at(-1);if(previous&&previous.end===t)previous.end=t+MINUTE;else proxyRanges.push({start:t,end:t+MINUTE});}lastRow=r;
  const key=new Date(t).toISOString().slice(0,10);if(key!==day){day=key;dayStart=cash+(pos?pos.side*pos.qty*(mark[1]-pos.entry):0);blocked=false;}
  if(pos&&funding.before.has(t)){const amount=-pos.side*pos.qty*mark[1]*funding.before.get(t);cash+=amount;fundingNet+=amount;pos.funding+=amount;}
  if(pos&&t-pos.entryAt>=pos.holdMinutes*MINUTE)close(o,t,'Limite de '+pos.holdMinutes+'min');
  const atSignals=registry.get(t)??[];
  if(pos&&atSignals.some(s=>s.family===pos.family&&s.side!==pos.side))close(o,t,'Sinal contrário');
  const sig=atSignals.find(s=>s.entryAllowed);
  if(atSignals.length&&!sig)events.push({at:t,knownAt:t+MINUTE,kind:'skipped',reason:'Roteador/modelo vetou nova entrada'});
  if(sig){let why=pos?'Posição já aberta':bankrupt||cash<=0?'Carteira insolvente':halted?'Limite global ativo':blocked?'Limite diário ativo':t-lastExit<protocol.cooldownMinutes*MINUTE?'Intervalo após saída':null;
   if(why)events.push({at:t,knownAt:t+MINUTE,kind:'skipped',reason:why});else{
    const entry=o*(1+sig.side*cfg.slippage),stop=entry-sig.side*protocol.stopATR*sig.atr,target=sig.target??entry+sig.side*protocol.targetR*Math.abs(entry-stop),invalid=(target-entry)*sig.side<=0,sized=invalid?null:sizePosition(cash,entry,stop,cfg,rules);
    if(!sized)events.push({at:t,knownAt:t+MINUTE,kind:'rejected',reason:invalid?'Alvo já ultrapassado na abertura':'Mínimo da corretora excede orçamento de risco'});else{
     const entryFee=sized.qty*entry*cfg.fee;pos={...sized,family:sig.family,regime:sig.regime,holdMinutes:sig.holdMinutes,side:sig.side,signalAt:sig.at,entryAt:t,entry,entryReference:o,stop,target,entryFee,funding:0,context:sig.context};cash-=entryFee;fees+=entryFee;const lp=liquidation();if(sig.side===1?stop<=lp:stop>=lp){cash+=entryFee;fees-=entryFee;pos=null;events.push({at:t,knownAt:t+MINUTE,kind:'rejected',reason:'Stop além da liquidação estimada'});}else {if(proxy)proxyEntries++;events.push({at:t,knownAt:t+MINUTE,kind:'entry',side:sig.side,price:entry});}
    }
   }
  }
  if(pos&&funding.after.has(t)){const amount=-pos.side*pos.qty*mark[1]*funding.after.get(t);cash+=amount;fundingNet+=amount;pos.funding+=amount;}
  if(pos){const lp=liquidation(),liq=pos.side===1?mark[3]<=lp:mark[2]>=lp,stop=pos.side===1?l<=pos.stop:h>=pos.stop,target=pos.side===1?h>=pos.target:l<=pos.target;
   if(liq){close(pos.side===1?Math.min(o,lp):Math.max(o,lp),t+MINUTE,'Liquidação estimada');if(!continueAfterLiquidation)halted=true;}else if(stop)close(pos.side===1?Math.min(o,pos.stop):Math.max(o,pos.stop),t+MINUTE,'Stop');else if(target)close(pos.target,t+MINUTE,'Alvo');
  }
  const value=cash+(pos?pos.side*pos.qty*(mark[4]-pos.entry):0);if(globalLossStop&&value<=initial*(1-cfg.totalLimit)){if(pos)close(c,t+MINUTE,'Limite global');if(!halted)events.push({at:t+MINUTE,knownAt:t+MINUTE,kind:'halt',reason:'Limite global'});halted=true;}if(value<=dayStart*(1-cfg.dailyLimit)){if(pos)close(c,t+MINUTE,'Limite diário');blocked=true;}
  if(cash+(pos?pos.side*pos.qty*(mark[4]-pos.entry):0)<=0){if(pos)close(c,t+MINUTE,'Insolvência da carteira');if(!bankrupt){bankruptAt=t+MINUTE;events.push({at:bankruptAt,knownAt:bankruptAt,kind:'bankruptcy',reason:'Carteira insolvente'});}bankrupt=true;halted=true;}
  const balance=cash+(pos?pos.side*pos.qty*(mark[4]-pos.entry):0);peak=Math.max(peak,balance);maxDD=Math.max(maxDD,(peak-balance)/peak);const point={time:t+MINUTE,value:balance};if(equity.length&&Math.floor((equity.at(-1).time-1)/86400000)===Math.floor(t/86400000))equity[equity.length-1]=point;else equity.push(point);
 }
 }
 function finish({closeAtEnd=true}={}){
 if(next!==until)throw Error('Streaming run not complete');
 if(closeAtEnd&&pos&&lastRow){close(lastRow[4],lastRow[0]+MINUTE,'Encerramento do teste');equity.at(-1).value=cash;maxDD=Math.max(maxDD,(peak-cash)/peak);}
 const final=equity.at(-1)?.value??initial;return{initial,final,pnl:final-initial,returnPct:final/initial-1,cash,position:pos,trades,signals,events,equity,fees,fundingNet,maxDD,halted,blocked,cfg,until,start,proxyMinutes,proxyExposureMinutes,proxyEntries,proxyRanges,markFallback,globalLossStop,continueAfterLiquidation,bankrupt,bankruptAt,liquidations:trades.filter(t=>t.reason==='Liquidação estimada').length,globalStopHits:events.filter(e=>e.kind==='halt'&&e.reason==='Limite global').length,insufficientCapitalRejections:events.filter(e=>e.kind==='rejected'&&e.reason==='Mínimo da corretora excede orçamento de risco').length,rejected:events.filter(e=>e.kind==='rejected').length,skipped:events.filter(e=>e.kind==='skipped').length,haltAt:events.find(e=>e.kind==='halt')?.at??trades.find(t=>t.reason==='Liquidação estimada')?.exitAt??null};
 }
 return {consume,finish};
}

export function simulateResearch(data,options){const account=createResearchAccount({...options,filters:data.filters});account.consume(data);return account.finish({closeAtEnd:options.closeAtEnd??true});}
