// Separate R-ladder experiment. Frozen original engine remains unchanged.
// Isolated exit-management study; original V3/V4 engine stays frozen.
import {fundingBuckets} from '../web/research-funding-buckets.js';
// FinRL futures research fork: decisions based on closed bars execute next minute.
// The original G151 engines are preserved. Risk/accounting remain fixed.
import {DEFAULTS,exchangeRules,sizePosition} from '../web/engine.js';
import {MINUTE} from '../web/scalping.js';
export function createResearchAccount({start,until,protocol,cost=protocol.costCases[0],signals=[],stopContext=[],filters,markFallback=false,globalLossStop=true,continueAfterLiquidation=false,agentMode=false,startingState=null}={}){
 if(!protocol||!Number.isFinite(start)||!Number.isFinite(until)||until<start)throw Error('Janela de scalping inválida');
 if(!['margin','priceRisk'].includes(protocol.ladderBasis??'margin'))throw Error('Invalid ladder basis');
 const cfg={...DEFAULTS,ladderBasis:protocol.ladderBasis??'margin',capitalBRL:protocol.capitalBRL,fx:protocol.fx,risk:protocol.risk,leverage:protocol.leverage,dailyLimit:protocol.dailyLimit,totalLimit:protocol.totalLimit,fee:cost.fee,slippage:cost.slippage,maintenance:protocol.maintenance,fundingReserve:protocol.fundingReserve};if(!(cfg.risk>0&&cfg.risk<=.1&&cfg.leverage>=1&&cfg.leverage<=20))throw Error('Risco inválido');
 const split=protocol.exitMode==='split',fraction=protocol.partialFraction??.5;if(protocol.exitMode&&!['single','split'].includes(protocol.exitMode))throw Error('Invalid exit mode');if(split&&(!(fraction>0&&fraction<1)||!(protocol.firstTargetFraction>0&&protocol.firstTargetFraction<=1)))throw Error('Invalid partial targets');
 const protection=protocol.protectMode??'off';if(!['off','breakeven','lock','trail'].includes(protection))throw Error('Invalid protection mode');if(protection==='lock'&&!(protocol.lockR>=0))throw Error('Invalid lockR');if(protection==='trail'&&!(protocol.trailATR>0))throw Error('Invalid trailATR');const contexts=stopContext.filter(r=>r.at<=until).sort((a,b)=>a.at-b.at);for(const r of contexts)if(!(r.atr>0)||!Number.isFinite(r.at)||!Number.isFinite(r.knownAt)||r.knownAt>r.at)throw Error('Future/invalid stop context');let contextIndex=0,knownATR=null;
 const registry=new Map();for(const s of signals.filter(s=>s.at>=start&&s.at<=until)){if(!['cross','vwap','bands'].includes(s.family)||!(s.holdMinutes===null||[30,60,120,240,720,1440].includes(s.holdMinutes))||s.knownAt>s.at)throw Error('Sinal adaptativo inválido');if(!registry.has(s.at))registry.set(s.at,[]);registry.get(s.at).push(s);}const rules=exchangeRules(filters),tick=Number(filters?.find(f=>f.filterType==='PRICE_FILTER')?.tickSize??0),baseInitial=cfg.capitalBRL/cfg.fx,initial=startingState?.cash??baseInitial,riskInitial=startingState?.initial??baseInitial;
 if(startingState&&(!(initial>0)||!(riskInitial>0)||startingState.position))throw Error('Invalid entry snapshot');
 let cash=initial,pos=null,fees=0,fundingNet=0,peak=initial,maxDD=0,halted=false,blocked=false,day=startingState?.day??'',dayStart=startingState?.dayStart??initial,lastExit=startingState?.lastExit??-Infinity,lastRow=startingState?.lastClose==null?null:[start-MINUTE,...Array(4).fill(startingState.lastClose),1],lastMark=startingState?.lastClose??null;const trades=[],events=[],equity=[],decisions=[];let pendingAction=null,canExecute=true,untradableMinutes=0;let bankrupt=false,bankruptAt=null;let next=start,proxyMinutes=0,proxyExposureMinutes=0,proxyEntries=0;const proxyRanges=[];
 function roundPrice(price,direction){if(!protocol.enforceTicks||!(tick>0))return price;return (direction>0?Math.ceil(price/tick-1e-8):Math.floor(price/tick+1e-8))*tick;}
 function fillPrice(raw,side,entry){return roundPrice(raw*(1+(entry?side:-side)*cfg.slippage),entry?side:-side);}
 function closeSingle(raw,at,reason){if(!pos)return;const exit=fillPrice(raw,pos.side,false),exitFee=pos.qty*exit*cfg.fee,gross=pos.side*pos.qty*(exit-pos.entry);cash+=gross-exitFee;fees+=exitFee;trades.push({...pos,exit,exitReference:raw,exitAt:at,exitFee,gross,reason,net:gross-pos.entryFee-exitFee+pos.funding,slippageCost:pos.qty*(Math.abs(pos.entry-pos.entryReference)+Math.abs(exit-raw))});events.push({at,kind:'exit',reason,side:pos.side,price:exit,knownAt:['Stop','Alvo','Liquidação estimada','Limite global','Limite diário','Encerramento do teste'].includes(reason)?at:at+MINUTE});pos=null;lastExit=at;}
 function fillPartial(raw,at,reason,quantity){
  const share=quantity/pos.qty,exit=fillPrice(raw,pos.side,false),exitFee=quantity*exit*cfg.fee,gross=pos.side*quantity*(exit-pos.entry),entryFee=pos.entryFee*share,funding=pos.funding*share;
  const leg={qty:quantity,exit,exitReference:raw,exitAt:at,reason,entryFee,funding,exitFee,gross,net:gross-entryFee-exitFee+funding,slippageCost:quantity*(Math.abs(pos.entry-pos.entryReference)+Math.abs(exit-raw))};
  cash+=gross-exitFee;fees+=exitFee;pos.legs.push(leg);pos.qty-=quantity;pos.margin*=1-share;pos.notional*=1-share;pos.plannedRisk*=1-share;pos.entryFee-=entryFee;pos.funding-=funding;
  events.push({at,knownAt:at,kind:pos.qty>1e-12?'partial-exit':'exit',reason,side:pos.side,price:exit,qty:quantity});
 }
 function close(raw,at,reason){
  if(!pos)return;if(!canExecute){pos.pendingExitReason??=reason;return;}if(!split){closeSingle(raw,at,reason);return;}
  fillPartial(raw,at,reason,pos.qty);const sum=k=>pos.legs.reduce((n,l)=>n+l[k],0),weighted=k=>pos.legs.reduce((n,l)=>n+l.qty*l[k],0)/pos.initialQty;
  trades.push({...pos,qty:pos.initialQty,margin:pos.initialMargin,notional:pos.initialNotional,plannedRisk:pos.initialRisk,entryFee:pos.initialEntryFee,funding:sum('funding'),exit:weighted('exit'),exitReference:weighted('exitReference'),exitAt:at,exitFee:sum('exitFee'),gross:sum('gross'),reason,net:sum('net'),slippageCost:sum('slippageCost')});pos=null;lastExit=at;
 }
 function takeFirst(at){
  const qty=Math.floor((pos.initialQty*fraction+1e-12)/rules.step)*rules.step,remaining=pos.qty-qty,price=pos.firstTarget*(1-pos.side*cfg.slippage);
  if(qty<rules.minQty||remaining+1e-12<rules.minQty||Math.min(qty,remaining)*price+1e-10<rules.minNotional){pos.partialDisabled=true;pos.target=pos.strategyTarget;events.push({at,knownAt:at,kind:'partial-rejected',reason:'Parcial não atende lote/notional mínimo; posição segue para saída final'});return;}
  fillPartial(pos.firstTarget,at,'Alvo parcial',qty);pos.firstTaken=true;
 }
 function protectAfterClose(c,at){
  if(!pos)return;const mode=agentMode?(pos.agentProtection??'off'):protection;if(mode==='off')return;
  const distance=Math.abs(pos.entry-pos.initialStop);
  if(canExecute&&!agentMode&&split&&!pos.firstTaken)return;
  if(!agentMode&&!split&&!pos.protectionActive&&(c-pos.entry)*pos.side<protocol.protectActivationR*distance)return;
  pos.protectionActive=true;
  // All inputs are known at this candle's close. The raised stop is first checked in the next candle.
  const be=remainingBreakeven(pos,cfg);let candidate=be;
  pos.favorableClose=pos.favorableClose===null?c:pos.side===1?Math.max(pos.favorableClose,c):Math.min(pos.favorableClose,c);
  if(mode==='lock')candidate+=pos.side*protocol.lockR*distance;
  if(mode==='trail'&&knownATR!==null){const trail=pos.favorableClose-pos.side*(agentMode?pos.agentTrailATR:protocol.trailATR)*knownATR;candidate=pos.side===1?Math.max(candidate,trail):Math.min(candidate,trail);}
  candidate=roundPrice(candidate,pos.side);
  if(!Number.isFinite(candidate)||candidate<=0)throw Error('Invalid dynamic stop');
  if((candidate-pos.stop)*pos.side>1e-10){const change={at,knownAt:at,effectiveAt:at,previous:pos.stop,stop:candidate,mode,atr:knownATR,close:c};pos.stop=candidate;pos.stopHistory.push(change);events.push({...change,kind:'stop-update'});}
 }
 const liquidation=()=>{const m=pos.margin+pos.funding-pos.entryFee;return pos.side===1?(pos.qty*pos.entry-m)/(pos.qty*(1-cfg.maintenance)):(pos.qty*pos.entry+m)/(pos.qty*(1+cfg.maintenance));};
 function consume(data){
 const from=data.candles[0]?.[0]??next,to=(data.candles.at(-1)?.[0]??(next-MINUTE))+MINUTE;
 if(from!==next||to>until)throw Error('Noncontiguous streaming market chunk');
 const marks=new Map(data.marks.map(r=>[r[0],r])),funding=fundingBuckets(data.funding,from,to);
 for(const r of data.candles){const[t,o,h,l,c]=r;canExecute=!protocol.requireVolume||r[5]>0;if(!canExecute)untradableMinutes++;while(contextIndex<contexts.length&&contexts[contextIndex].at<=t){knownATR=contexts[contextIndex++].atr;}if(t!==next)throw Error('Missing/duplicate streaming candle');next=t+MINUTE;let mark=marks.get(t),proxy=!mark;
  if(proxy){if(!markFallback)throw Error('Mark price1m ausente');mark=r;proxyMinutes++;if(pos)proxyExposureMinutes++;const previous=proxyRanges.at(-1);if(previous&&previous.end===t)previous.end=t+MINUTE;else proxyRanges.push({start:t,end:t+MINUTE});}lastMark=mark[4];
  const key=new Date(t).toISOString().slice(0,10);if(key!==day){day=key;dayStart=cash+(pos?pos.side*pos.qty*(mark[1]-pos.entry):0);blocked=false;}
  if(pos&&funding.before.has(t)){const amount=-pos.side*pos.qty*mark[1]*funding.before.get(t);cash+=amount;fundingNet+=amount;pos.funding+=amount;}
  if(pos?.pendingExitReason&&canExecute)close(o,t,pos.pendingExitReason);
  if(agentMode)applyAction(t,o,mark);
  if(pos&&!agentMode&&pos.holdMinutes!==null&&t-pos.entryAt>=pos.holdMinutes*MINUTE)close(o,t,'Limite de '+pos.holdMinutes+'min');
  const atSignals=registry.get(t)??[];
  if(pos&&atSignals.some(s=>s.family===pos.family&&s.side!==pos.side))close(o,t,'Sinal contrário');
  const sig=atSignals.find(s=>s.entryAllowed);
  if(atSignals.length&&!sig)events.push({at:t,knownAt:t+MINUTE,kind:'skipped',reason:'Roteador/modelo vetou nova entrada'});
  if(sig){let why=!canExecute?'Mercado sem negócios no minuto':pos?'Posição já aberta':bankrupt||cash<=0?'Carteira insolvente':halted?'Limite global ativo':blocked?'Limite diário ativo':t-lastExit<protocol.cooldownMinutes*MINUTE?'Intervalo após saída':null;
   if(why)events.push({at:t,knownAt:t+MINUTE,kind:'skipped',reason:why});else{
    const entry=fillPrice(o,sig.side,true),stop=roundPrice(entry-sig.side*protocol.stopATR*sig.atr,-sig.side),strategyTarget=sig.target??entry+sig.side*protocol.targetR*Math.abs(entry-stop),target=(protocol.runner||agentMode)?null:strategyTarget,firstTarget=entry+(protocol.firstTargetFraction??.5)*(strategyTarget-entry),invalid=(strategyTarget-entry)*sig.side<=0,sized=invalid?null:sizePosition(cash,entry,stop,{...cfg,leverage:sig.leverage??cfg.leverage},rules);
    if(!sized)events.push({at:t,knownAt:t+MINUTE,kind:'rejected',reason:invalid?'Alvo já ultrapassado na abertura':'Mínimo da corretora excede orçamento de risco'});else{
     const entryFee=sized.qty*entry*cfg.fee;pos={...sized,leverage:sig.leverage??cfg.leverage,family:sig.family,regime:sig.regime,holdMinutes:sig.holdMinutes,side:sig.side,signalAt:sig.at,entryAt:t,entry,entryReference:o,stop,initialStop:stop,stopHistory:[],favorableClose:null,protectionActive:false,strategyTarget,target,entryFee,funding:0,context:sig.context};if(split)Object.assign(pos,{initialQty:pos.qty,initialMargin:pos.margin,initialNotional:pos.notional,initialRisk:pos.plannedRisk,initialEntryFee:entryFee,firstTarget,firstTaken:false,partialDisabled:false,legs:[]});cash-=entryFee;fees+=entryFee;const lp=liquidation();if(sig.side===1?stop<=lp:stop>=lp){cash+=entryFee;fees-=entryFee;pos=null;events.push({at:t,knownAt:t+MINUTE,kind:'rejected',reason:'Stop além da liquidação estimada'});}else {if(proxy)proxyEntries++;events.push({at:t,knownAt:t+MINUTE,kind:'entry',side:sig.side,price:entry});}
    }
   }
  }
  if(pos&&funding.after.has(t)){const amount=-pos.side*pos.qty*mark[1]*funding.after.get(t);cash+=amount;fundingNet+=amount;pos.funding+=amount;}
  if(pos){const lp=liquidation(),liq=pos.side===1?mark[3]<=lp:mark[2]>=lp,stop=pos.side===1?l<=pos.stop:h>=pos.stop,target=pos.target!==null&&(pos.side===1?h>=pos.target:l<=pos.target);
   if(liq){close(pos.side===1?Math.min(o,lp):Math.max(o,lp),t+MINUTE,'Liquidação estimada');if(!continueAfterLiquidation)halted=true;}else if(stop)close(pos.side===1?Math.min(o,pos.stop):Math.max(o,pos.stop),t+MINUTE,pos.stopHistory.length?'Stop protegido':'Stop');else {if(canExecute&&!agentMode&&split&&!pos.firstTaken&&!pos.partialDisabled&&(pos.side===1?h>=pos.firstTarget:l<=pos.firstTarget))takeFirst(t+MINUTE);if(pos&&pos.target!==null&&(target||(pos.side===1?h>=pos.target:l<=pos.target)))close(pos.target,t+MINUTE,'Alvo');}
  }
  const value=cash+(pos?pos.side*pos.qty*(mark[4]-pos.entry):0);if(globalLossStop&&value<=riskInitial*(1-cfg.totalLimit)){if(pos)close(c,t+MINUTE,'Limite global');if(!halted)events.push({at:t+MINUTE,knownAt:t+MINUTE,kind:'halt',reason:'Limite global'});halted=true;}if(value<=dayStart*(1-cfg.dailyLimit)){if(pos)close(c,t+MINUTE,'Limite diário');blocked=true;}
  if(cash+(pos?pos.side*pos.qty*(mark[4]-pos.entry):0)<=0){if(pos)close(c,t+MINUTE,'Insolvência da carteira');if(!bankrupt){bankruptAt=t+MINUTE;events.push({at:bankruptAt,knownAt:bankruptAt,kind:'bankruptcy',reason:'Carteira insolvente'});}bankrupt=true;halted=true;}
  protectAfterClose(c,t+MINUTE);
  lastRow=r;
  const balance=cash+(pos?pos.side*pos.qty*(mark[4]-pos.entry):0);peak=Math.max(peak,balance);maxDD=Math.max(maxDD,(peak-balance)/peak);const point={time:t+MINUTE,value:balance};if(equity.length&&Math.floor((equity.at(-1).time-1)/86400000)===Math.floor(t/86400000))equity[equity.length-1]=point;else equity.push(point);
 }
 }
 function finish({closeAtEnd=true,allowEarly=false}={}){
 if(next!==until&&!(allowEarly&&!pos))throw Error('Streaming run not complete');
 if(closeAtEnd&&pos&&lastRow){if(!canExecute)throw Error('Cannot force-fill boundary in a zero-volume minute');close(lastRow[4],lastRow[0]+MINUTE,'Fim do recorte (avaliação)');equity.at(-1).value=cash;maxDD=Math.max(maxDD,(peak-cash)/peak);}
 const final=equity.at(-1)?.value??initial;return{initial,final,pnl:final-initial,returnPct:final/initial-1,cash,position:pos,trades,signals,events,equity,fees,fundingNet,maxDD,halted,blocked,cfg,until,start,proxyMinutes,proxyExposureMinutes,proxyEntries,proxyRanges,markFallback,globalLossStop,continueAfterLiquidation,agentMode,untradableMinutes,decisions,invalidAgentActions:decisions.filter(d=>!d.applied&&d.action!==0).length,exitMode:split?'split':'single',stopMoves:events.filter(e=>e.kind==='stop-update').length,protectedPositions:trades.filter(t=>t.stopHistory.length).length,boundaryExits:trades.filter(t=>t.reason==='Fim do recorte (avaliação)').length,partialExits:events.filter(e=>e.kind==='partial-exit').length,partialRejected:events.filter(e=>e.kind==='partial-rejected').length,exitExecutions:events.filter(e=>e.kind==='exit'||e.kind==='partial-exit').length,bankrupt,bankruptAt,liquidations:trades.filter(t=>t.reason==='Liquidação estimada').length,globalStopHits:events.filter(e=>e.kind==='halt'&&e.reason==='Limite global').length,insufficientCapitalRejections:events.filter(e=>e.kind==='rejected'&&e.reason==='Mínimo da corretora excede orçamento de risco').length,rejected:events.filter(e=>e.kind==='rejected').length,skipped:events.filter(e=>e.kind==='skipped').length,haltAt:events.find(e=>e.kind==='halt')?.at??trades.find(t=>t.reason==='Liquidação estimada')?.exitAt??null};
 }
 function state(){const close=lastRow?.[4]??null,mark=lastMark??close,balance=cash+(pos&&mark!==null?pos.side*pos.qty*(mark-pos.entry):0);return{at:next,initial:riskInitial,episodeInitial:initial,cash,balance,peak,maxDD,halted,blocked,dayStart,day,lastExit:Number.isFinite(lastExit)?lastExit:null,lastClose:close,position:pos?{leverage:pos.leverage,margin:pos.margin,liquidation:liquidation(),entryAt:pos.entryAt,side:pos.side,entry:pos.entry,qty:pos.qty,initialEntryFee:pos.initialEntryFee??pos.entryFee,initialMargin:pos.initialMargin??pos.margin,ladderStage:pos.ladderStage??0,initialQty:pos.initialQty??pos.qty,initialStop:pos.initialStop,stop:pos.stop,target:pos.strategyTarget,entryFee:pos.entryFee,funding:pos.funding,family:pos.family,regime:pos.regime,firstTaken:!!pos.firstTaken,agentProtection:pos.agentProtection??'off',agentTrailATR:pos.agentTrailATR??null,favorableClose:pos.favorableClose,protectionActive:pos.protectionActive??false}:null};}
 function queueAction(action,at){if(!agentMode||!Number.isInteger(action)||action<0||action>9||at!==next||pendingAction)throw Error('Invalid/noncausal agent action');pendingAction={action,knownAt:at,entryAt:pos?.entryAt??null};}
 function applyAction(at,open,mark){
  const command=pendingAction;pendingAction=null;if(!command)return;
  const decision={...command,effectiveAt:at,applied:false};decisions.push(decision);
  if(!pos||pos.entryAt!==command.entryAt){decision.reason='Sem a posição observada';return;}
  // Known funding belongs to the existing position. A breached opening stop or
  // liquidation takes priority over a discretionary command; gaps are never bypassed.
  const lp=liquidation();if(canExecute&&(pos.side===1?mark[1]<=lp:mark[1]>=lp)){close(open,at,'Liquidação estimada');halted=true;decision.reason='Liquidação na abertura';return;}
  if(canExecute&&(pos.side===1?open<=pos.stop:open>=pos.stop)){close(open,at,pos.stopHistory.length?'Stop protegido':'Stop');decision.reason='Gap atravessou o stop';return;}
  const action=command.action;if(!canExecute&&action!==0){decision.reason='Minuto sem negócios; ordem não executada';return;}
  if(action===0){decision.applied=true;return;}
  if(action===1){close(open,at,'Agente · encerrar');decision.applied=true;return;}
  if(action>=7){
   const stage=pos.ladderStage??0,step=protocol.profitLadder?.[stage];
   if(!step||action!==7+stage){decision.reason='Escada fora de sequência';return;}
   const equivalent=originalMarginROI(pos,open,cfg,fillPrice),qty=stage===2?pos.qty:Math.floor((pos.initialQty*step.fraction+1e-12)/rules.step)*rules.step,left=pos.qty-qty;
   if(equivalent+1e-10<step.roi){decision.reason='Abertura não atende alvo líquido; parcial não preenchida';return;}
   if(qty<rules.minQty||qty*fillPrice(open,pos.side,false)+1e-10<rules.minNotional||(stage<2&&(left+1e-12<rules.minQty||left*fillPrice(open,pos.side,false)+1e-10<rules.minNotional))){events.push({at,knownAt:at,kind:'partial-rejected',reason:'Escada · lote/notional mínimo'});decision.reason='Lote mínimo da escada';return;}
   if(stage===2){close(open,at,'Escada · alvo '+(cfg.ladderBasis==='priceRisk'?step.roi+'R de preço líquido equivalente':step.roi*100+'% líquido equivalente'));decision.applied=true;return;}
   fillPartial(open,at,'Escada · alvo '+(cfg.ladderBasis==='priceRisk'?step.roi+'R de preço líquido equivalente':step.roi*100+'% líquido equivalente'),qty);pos.firstTaken=true;pos.ladderStage=stage+1;
   if(stage===0&&protocol.protectAfterFirst){if((pos.agentProtection??'off')==='off')pos.agentProtection='breakeven';protectAfterClose(lastRow[4],at);}
   decision.applied=true;return;
  }

  if(action===2){
   if(pos.firstTaken){decision.reason='Parcial única já executada';return;}
   const qty=Math.floor((pos.initialQty*.5+1e-12)/rules.step)*rules.step,remaining=pos.qty-qty,price=open*(1-pos.side*cfg.slippage);
   if(qty<rules.minQty||remaining+1e-12<rules.minQty||Math.min(qty,remaining)*price+1e-10<rules.minNotional){events.push({at,knownAt:at,kind:'partial-rejected',reason:'Agente · parcial abaixo do mínimo'});decision.reason='Lote mínimo';return;}
   fillPartial(open,at,'Agente · parcial 50%',qty);pos.firstTaken=true;decision.applied=true;return;
  }
  const be=remainingBreakeven(pos,cfg),closeKnown=lastRow?.[4];
  const required=action===6?be+pos.side*protocol.lockR*Math.abs(pos.entry-pos.initialStop):be;
  if(closeKnown===undefined||(closeKnown-required)*pos.side<=0){decision.reason='Preço conhecido não cobre custos da proteção';return;}
  pos.agentProtection=action===6?'lock':action===3?'breakeven':'trail';if(action>=4&&action<=5)pos.agentTrailATR=action===4?2:1;
  protectAfterClose(closeKnown,at);decision.applied=true;
 }
 function queueEntry(side,atr,at,leverage=cfg.leverage){if(!(protocol.allowedLeverages??[cfg.leverage]).includes(leverage))throw Error('Unregistered leverage');if(!agentMode||pos||![1,-1].includes(side)||!(atr>0)||!Number.isFinite(atr)||at!==next||registry.has(at))throw Error('Invalid/noncausal agent entry');registry.set(at,[{at,knownAt:at,side,atr,leverage,entryAllowed:true,family:'agent',regime:'ppo',holdMinutes:null,context:{origin:'FinRL-PPO'}}]);}
 return {consume,finish,state,queueAction,queueEntry};
}

export function simulateResearch(data,options){const account=createResearchAccount({...options,filters:data.filters});account.consume(data);return account.finish({closeAtEnd:options.closeAtEnd??true});}

// Exit reference needed to break even on the REMAINING quantity after known entry fees/funding,
// adverse exit slippage and exit fee. It does not assume future funding or gap-free fills.
export function remainingBreakeven(pos,cfg){return (pos.side*pos.qty*pos.entry+pos.entryFee-pos.funding)/(pos.qty*(pos.side-cfg.fee)*(1-pos.side*cfg.slippage));}

export function originalMarginROI(pos,raw,cfg,fill=null){const exit=fill?fill(raw,pos.side,false):raw*(1-pos.side*cfg.slippage),quantity=pos.initialQty??pos.qty,margin=pos.initialMargin??pos.margin,initialFee=pos.initialEntryFee??pos.entryFee,funding=pos.funding*quantity/pos.qty,reference=cfg.ladderBasis==='priceRisk'?quantity*Math.abs(pos.entry-pos.initialStop):margin;if(!(reference>0))throw Error('Invalid ladder reference');return(pos.side*quantity*(exit-pos.entry)-initialFee-quantity*exit*cfg.fee+funding)/reference;}
