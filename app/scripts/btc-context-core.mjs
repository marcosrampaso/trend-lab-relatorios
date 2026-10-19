import {trendFrames,frameAt} from '../web/scalping-context.js';
export function correlation(x,y){
 if(x.length!==y.length||x.length<2)return null;const mx=x.reduce((n,v)=>n+v,0)/x.length,my=y.reduce((n,v)=>n+v,0)/y.length;let xx=0,yy=0,xy=0;
 for(let i=0;i<x.length;i++){xx+=(x[i]-mx)**2;yy+=(y[i]-my)**2;xy+=(x[i]-mx)*(y[i]-my);}return xx>0&&yy>0?{correlation:Math.max(-1,Math.min(1,xy/Math.sqrt(xx*yy))),beta:xy/xx}:null;
}
export function btcContextFrames(btc,eth,policy){
 const hour=3600000,byEth=new Map(eth.map(r=>[r[0],r])),one=trendFrames(btc,1,policy.ema),four=trendFrames(btc,4,policy.ema),out=[];
 for(let i=policy.correlationHours;i<btc.length;i++){
  const at=btc[i][0]+hour,segment=btc.slice(i-policy.correlationHours,i+1),ethSegment=segment.map(r=>byEth.get(r[0]));
  if(segment.some((r,j)=>j&&r[0]!==segment[j-1][0]+hour)||ethSegment.some(r=>!r))continue;
  const bx=segment.slice(1).map((r,j)=>Math.log(r[4]/segment[j][4])),ey=ethSegment.slice(1).map((r,j)=>Math.log(r[4]/ethSegment[j][4])),pair=correlation(bx,ey),h=frameAt(one,at),f=frameAt(four,at),last=ethSegment.at(-1)[4],prev=ethSegment.at(-25)[4],btcReturn24h=btc[i][4]/btc[i-24][4]-1;
  out.push({at,btcPrice:btc[i][4],btcReturn1h:btc[i][4]/btc[i-1][4]-1,btcReturn4h:btc[i][4]/btc[i-4][4]-1,btcReturn24h,btcTrend1h:h?.side??null,btcTrend4h:f?.side??null,btcTrend4hAt:f?.at??null,correlation72h:pair?.correlation??null,beta72h:pair?.beta??null,relativeStrength24h:(last/prev)/(1+btcReturn24h)-1,btcLeads1hCorrelation:correlation(bx.slice(0,-1),ey.slice(1))?.correlation??null,ethLeads1hCorrelation:correlation(ey.slice(0,-1),bx.slice(1))?.correlation??null,samples:bx.length});
 }return out;
}
export function btcBiasAt(frames,signalAt,side,policy){
 const context=frameAt(frames,signalAt),ready=!!context&&signalAt-context.at<3600000&&context.btcTrend1h!=null&&context.btcTrend4h!=null&&Number.isFinite(context.correlation72h),coupled=ready&&context.correlation72h>=policy.minimumCorrelation,against=ready&&context.btcTrend1h===-side&&context.btcTrend4h===-side,veto=!!side&&coupled&&against;
 return {context,ready,coupled,veto,reason:!ready?'Contexto BTC ausente, antigo ou em aquecimento':!coupled?'Correlação insuficiente: sem veto':veto?'BTC1h/4h contra o sinal de ETH com correlação alta':'Sem oposição conjunta de BTC1h/4h'};
}
