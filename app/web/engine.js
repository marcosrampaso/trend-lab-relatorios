import {intradayBars} from './strategies.js';
export const HOUR = 3600000;
export const DEFAULTS = Object.freeze({capitalBRL:300,fx:5,leverage:10,risk:0.01,fee:0.0005,slippage:0.0002,fundingReserve:0.0003,maintenance:0.005,dailyLimit:0.03,totalLimit:0.1,fast:16,slow:64,atrPeriod:14,atrMult:2});

export function aggregate4h(rows, until=Infinity) {
  const groups=new Map();
  for(const r of rows){if(r[0]+HOUR>until)continue;const t=Math.floor(r[0]/(4*HOUR))*4*HOUR;if(!groups.has(t))groups.set(t,[]);groups.get(t).push(r);}
  return [...groups].filter(([t,a])=>a.length===4&&a.every((r,i)=>r[0]===t+i*HOUR)).map(([t,a])=>({time:t,at:t+4*HOUR,open:a[0][1],high:Math.max(...a.map(r=>r[2])),low:Math.min(...a.map(r=>r[3])),close:a[3][4]}));
}

export function indicators(rows,until=Infinity,cfg=DEFAULTS){
  let fast,slow,atr,previous;const result=[];let trSum=0;
  for(const [i,b] of aggregate4h(rows,until).entries()){
    const tr=Math.max(b.high-b.low,previous===undefined?0:Math.abs(b.high-previous),previous===undefined?0:Math.abs(b.low-previous));
    fast=fast===undefined?b.close:fast+(2/(cfg.fast+1))*(b.close-fast);
    slow=slow===undefined?b.close:slow+(2/(cfg.slow+1))*(b.close-slow);
    if(i<cfg.atrPeriod){trSum+=tr;if(i===cfg.atrPeriod-1)atr=trSum/cfg.atrPeriod;}else atr=(atr*(cfg.atrPeriod-1)+tr)/cfg.atrPeriod;
    const side=fast>slow?1:fast<slow?-1:0;const prev=result.at(-1);
    result.push({...b,fast,slow,atr,side,ready:i>=cfg.slow-1&&atr>0,cross:prev&&i>=cfg.slow-1&&side!==prev.side?side:0});previous=b.close;
  }return result;
}

export function snapshot(rows,until,cfg=DEFAULTS){
  const visible=rows.filter(r=>r[0]+HOUR<=until);const indicator=indicators(visible,until,cfg).at(-1);
  return {at:until,last:visible.at(-1)?.[4]??null,indicator,visible};
}

export function makeProbe(rows,until,cfg=DEFAULTS){const s=snapshot(rows,until,cfg);if(!s.indicator?.ready||s.last==null)throw Error('Histórico insuficiente');return {at:until,target:until+3*HOUR,price:s.last,side:s.indicator.side,fast:s.indicator.fast,slow:s.indicator.slow};}
export function evaluateProbe(probe,rows,until){
  if(until<probe.target)return {status:'pending'};
  const r=rows.find(r=>r[0]+HOUR===probe.target);if(!r)return {status:'unavailable'};
  const movement=(r[4]/probe.price-1);return {status:'resolved',price:r[4],movement,directional:movement*probe.side,correct:movement*probe.side>0};
}

export function exchangeRules(filters=[]){
  const lot=filters.find(f=>f.filterType==='LOT_SIZE');const n=filters.find(f=>f.filterType==='MIN_NOTIONAL');
  return {step:Number(lot?.stepSize??0.001),minQty:Number(lot?.minQty??0.001),minNotional:Number(n?.notional??n?.minNotional??20)};
}

export function sizePosition(equity,entry,stop,cfg,rules){
  const denominator=Math.abs(entry-stop)+entry*(2*cfg.fee+2*cfg.slippage+cfg.fundingReserve);
  const raw=Math.min(equity*cfg.risk/denominator,equity*cfg.leverage*0.8/entry);
  const qty=Math.floor((raw+1e-12)/rules.step)*rules.step;
  if(!Number.isFinite(qty)||qty<rules.minQty||qty*entry<rules.minNotional)return null;
  return {qty,notional:qty*entry,margin:qty*entry/cfg.leverage,plannedRisk:qty*denominator};
}

export function simulate(data,{until,start=Date.UTC(2025,3,1),config={},closeAtEnd=false,strategy='baseline',maxHoldHours=null,stopATR=2,targetR=null,cooldownHours=0,execution=null,entryFilter=null,entryDelayHours=0,registeredSignals=null}={}){
  const cfg={...DEFAULTS,...config};until??=data.candles.at(-1)[0]+HOUR;
  if(!(cfg.fx>0&&cfg.capitalBRL>0&&cfg.risk>0&&cfg.risk<=0.1&&cfg.leverage>=1&&cfg.leverage<=10))throw Error('Parâmetros inválidos');
  if(maxHoldHours!==null&&(!(maxHoldHours>0)||maxHoldHours>24))throw Error('Duração máxima inválida');
  const signalRows=data.candles.filter(r=>r[0]+HOUR<=until);const step=execution?.intervalMs??HOUR;
  if(![HOUR,HOUR/4].includes(step)||entryDelayHours<0||entryDelayHours>1)throw Error('Resolução ou atraso inválido');
  const rows=execution?execution.candles.filter(r=>r[0]+step<=until):signalRows;const ind=['baseline','control24'].includes(strategy)?indicators(signalRows,until,cfg):intradayBars(signalRows,until,strategy), byAt=new Map(ind.map(r=>[r.at,r]));
  const marks=new Map((execution?.marks??data.marks??[]).filter(r=>r[0]+step<=until).map(r=>[r[0],r]));
  const funds=new Map();for(const [t,rate] of data.funding??[]){const hour=Math.floor(t/step)*step;if(t<until){if(!funds.has(hour))funds.set(hour,[]);funds.get(hour).push({time:t,rate});}}
  const rules=exchangeRules(data.filters),initial=cfg.capitalBRL/cfg.fx;
  let cash=initial,pos=null,pending=null,fees=0,fundingNet=0,peak=initial,maxDD=0,halted=false,day='',dayStart=initial,blocked=false;
  const trades=[],signals=[],equity=[],events=[];let lastExit=-Infinity;
  const close=(raw,time,reason)=>{
    const p=pos;if(!p)return;const exit=raw*(1-p.side*cfg.slippage),fee=p.qty*exit*cfg.fee,gross=p.side*p.qty*(exit-p.entry);
    cash+=gross-fee;fees+=fee;
    const net=gross-p.entryFee-fee+p.funding;
    const slippageCost=p.qty*(Math.abs(p.entry-p.entryReference)+Math.abs(exit-raw));
    trades.push({...p,exit,exitReference:raw,exitAt:time,reason,gross,exitFee:fee,net,slippageCost});events.push({at:time,kind:'exit',reason,side:p.side,price:exit});pos=null;lastExit=time;
  };
  const liquidation=()=>{if(!pos)return null;const margin=pos.margin+pos.funding-pos.entryFee;return pos.side===1?(pos.qty*pos.entry-margin)/(pos.qty*(1-cfg.maintenance)):(pos.qty*pos.entry+margin)/(pos.qty*(1+cfg.maintenance));};
  for(const r of rows){
    const [t,o,h,l,c]=r;if(t<start)continue;
    if(execution&&!marks.has(t))throw Error('Mark price intrabar ausente');
    const mark=marks.get(t)??r;
    if(registeredSignals){const recorded=registeredSignals.get(t-entryDelayHours*HOUR);if(recorded?.side){pending=recorded;signals.push(recorded);}}
    const dayKey=new Date(t).toISOString().slice(0,10);
    if(dayKey!==day){day=dayKey;dayStart=cash+(pos?pos.side*pos.qty*(o-pos.entry):0);blocked=false;}
    // Funding at the opening boundary belongs to a position held before that boundary.
    for(const f of funds.get(t)??[]){if(pos){const amount=-pos.side*pos.qty*mark[1]*f.rate;cash+=amount;fundingNet+=amount;pos.funding+=amount;}}
    if(pos&&maxHoldHours!==null&&t-pos.entryAt>=maxHoldHours*HOUR)close(o,t,'Limite de '+maxHoldHours+'h');
    if(pending&&pending.at+entryDelayHours*HOUR<=t){
      const sig=pending;pending=null;
      if(pos&&pos.side!==sig.side)close(o,t,'Cruzamento contrário');
      if(!pos&&!halted&&!blocked&&t-lastExit>=cooldownHours*HOUR){
        const veto=entryFilter?.({signal:sig,time:t,config:cfg});
        if(veto){events.push({at:t,kind:'filtered',reason:String(veto),signalAt:sig.at});}
        else {const entry=o*(1+sig.side*cfg.slippage),stop=entry-sig.side*(strategy==='baseline'?cfg.atrMult:stopATR)*sig.atr;
        const target=strategy==='reversion'?sig.mean:targetR!==null?entry+sig.side*targetR*Math.abs(entry-stop):null;
        const invalidTarget=target!==null&&(target-entry)*sig.side<=0;
        const sized=invalidTarget?null:sizePosition(cash,entry,stop,cfg,rules);
        if(sized){const entryFee=sized.qty*entry*cfg.fee;cash-=entryFee;fees+=entryFee;
          pos={...sized,side:sig.side,entry,entryReference:o,entryAt:t,signalAt:sig.at,stop,entryFee,funding:0};
          if(target!==null)pos.target=target;
          const lp=liquidation();const invalid=sig.side===1?stop<=lp:stop>=lp;
          if(invalid){cash+=entryFee;fees-=entryFee;pos=null;events.push({at:t,kind:'rejected',reason:'Stop além da liquidação estimada'});}else events.push({at:t,kind:'entry',side:sig.side,price:entry});
        }else events.push({at:t,kind:'rejected',reason:invalidTarget?'Alvo já ultrapassado na abertura':'Mínimo da corretora excede orçamento de risco'});
        }
      }
    }
    if(pos){
      const lp=liquidation();const liqHit=pos.side===1?mark[3]<=lp:mark[2]>=lp;
      const stopHit=pos.side===1?l<=pos.stop:h>=pos.stop;
      if(liqHit){close(pos.side===1?Math.min(o,lp):Math.max(o,lp),t+step,'Liquidação estimada');events.push({at:t+step,kind:'halt',reason:'Liquidação estimada'});halted=true;}
      else if(stopHit)close(pos.side===1?Math.min(o,pos.stop):Math.max(o,pos.stop),t+step,'Stop');
      else if(pos.target!==undefined&&(pos.side===1?h>=pos.target:l<=pos.target))close(pos.target,t+step,'Alvo');
    }
    const value=cash+(pos?pos.side*pos.qty*(mark[4]-pos.entry):0);
    if(value<=initial*(1-cfg.totalLimit)){if(!halted)events.push({at:t+step,kind:'halt',reason:'Limite global'});if(pos)close(c,t+step,'Limite global');halted=true;}
    if(value<=dayStart*(1-cfg.dailyLimit)){if(pos)close(c,t+step,'Limite diário');blocked=true;}
    const balance=cash+(pos?pos.side*pos.qty*(mark[4]-pos.entry):0);peak=Math.max(peak,balance);maxDD=Math.max(maxDD,(peak-balance)/peak);
    equity.push({time:t+step,value:balance});
    const b=byAt.get(t+step);
    if(b?.ready){
      if(b.cross&&!registeredSignals){const s={at:b.at,side:b.cross,price:c,atr:b.atr,fast:b.fast,slow:b.slow};if(strategy==='reversion')s.mean=b.mean;signals.push(s);pending=s;}
      if(pos&&['baseline','control24'].includes(strategy)){const next=b.close-pos.side*cfg.atrMult*b.atr;pos.stop=pos.side===1?Math.max(pos.stop,next):Math.min(pos.stop,next);}
    }
  }
  if(closeAtEnd&&pos&&equity.length){const last=rows.at(-1);close(last[4],last[0]+step,'Encerramento do teste');equity.at(-1).value=cash;maxDD=Math.max(maxDD,(peak-cash)/peak);}
  const final=equity.at(-1)?.value??initial;
  return {initial,final,cash,position:pos,trades,signals,events,equity,fees,fundingNet,maxDD,halted,blocked,config:cfg,rules,until,start,pending,
    haltAt:events.find(e=>e.kind==='halt')?.at??null,pnl:final-initial,returnPct:final/initial-1,rejected:events.filter(e=>e.kind==='rejected').length,liquidations:trades.filter(t=>t.reason==='Liquidação estimada').length};
}
