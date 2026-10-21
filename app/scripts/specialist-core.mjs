import {createResearchAccount,originalMarginROI} from './exit-lab-engine.mjs';
import {exitMask} from './exit-lab-core.mjs';
export const SPECIALISTS='work/pepe-specialists-v1';
export function featureInput(f,t){
  if(!f||f.at!==t||f.knownAt>t||!Number.isFinite(f.knownAt)||!(f.atr>0)||!(f.close>0)
    ||f.x.length!==19||!f.x.every(Number.isFinite))throw Error('Invalid/future specialist feature');
  return f.x.slice();
}
export function candleFeatures(f,candles){
  if(candles.length!==5||candles.some((r,i)=>r[0]!==f.at-300000+i*60000))
    throw Error('Unclosed/missing candle context');
  const open=candles[0][1],close=candles[4][4],high=Math.max(...candles.map(r=>r[2])),low=Math.min(...candles.map(r=>r[3]));
  if(Math.abs(close-f.close)>1e-10||!(f.atr>0)||f.x.length!==15)throw Error('Feature/candle mismatch');
  const clip=v=>Math.max(-10,Math.min(10,v));
  return{...f,x:[...f.x,clip((close-open)/f.atr),clip((high-Math.max(open,close))/f.atr),
    clip((Math.min(open,close)-low)/f.atr),clip((high-low)/f.atr)]};
}
export function entryChoice(longValue,shortValue,mode='combined',threshold=.1){
  if(![longValue,shortValue,threshold].every(Number.isFinite))throw Error('Nonfinite specialist value');
  if(!['long','short','combined'].includes(mode))throw Error('Unknown specialist mode');
  if(mode==='long')return longValue>threshold?1:0;
  if(mode==='short')return shortValue>threshold?-1:0;
  if(Math.max(longValue,shortValue)<=threshold||Math.abs(longValue-shortValue)<1e-8)return 0;
  return longValue>shortValue?1:-1;
}
// Same fixed exit policy for labels and continuous wallets. Decisions execute next open.
export function fixedExitAction(s,p,cost,filters){
  const pos=s.position;if(!pos)return 0;
  const stage=pos.ladderStage??0,target=p.profitLadder[stage];
  if(target&&originalMarginROI(pos,s.lastClose,cost)>=target.roi)return 7+stage;
  return exitMask(s,p,cost,filters)[3]?6:0;
}
export function candidateOutcome(f,side,end,p,market,contexts){
  featureInput(f,f.at);const start=f.at,cost=p.costCases.find(c=>c.id==='stress');
  const account=createResearchAccount({start,until:end,protocol:p,cost,filters:market.filters,
    agentMode:true,stopContext:contexts,startingState:{cash:p.capitalBRL/p.fx,initial:p.capitalBRL/p.fx,
      day:new Date(start).toISOString().slice(0,10),dayStart:p.capitalBRL/p.fx,lastClose:f.close,position:null}});
  account.queueEntry(side,f.atr,start,p.leverage);
  let at=Math.min(start+300000,end);market.consume(account,start,at);
  while(account.state().position&&at<end){
    account.queueAction(fixedExitAction(account.state(),p,cost,market.filters),at);
    const until=Math.min(at+300000,end);market.consume(account,at,until);at=until;
  }
  const result=account.finish({allowEarly:true}),trade=result.trades[0];
  if(result.trades.length>1||Math.abs(result.pnl-(trade?.net??0))>1e-7)throw Error('Candidate reconciliation');
  return{netR:result.pnl/(p.capitalBRL/p.fx*p.risk),netBRL:result.pnl*p.fx,
    exitAt:trade?.exitAt??at,reason:trade?.reason??'Entrada não preenchida',
    filled:!!trade,boundary:trade?.reason==='Fim do recorte (avaliação)',
    feesBRL:result.fees*p.fx,fundingBRL:result.fundingNet*p.fx};
}
