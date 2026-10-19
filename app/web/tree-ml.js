import {HOUR,simulate} from './engine.js';
import {intradayBars} from './strategies.js';
import {contextIndicators} from './decision-context.js';
import {prepareML,predictML} from './ml.js';

export function fitTree(samples,protocol) {
  const cfg=protocol.tree,size=protocol.features.length;
  if(samples.length<protocol.learner.minimumSamples||!samples.every(s=>s.x.length===size&&s.x.every(Number.isFinite)&&[0,1].includes(s.y)))throw Error('Amostra inválida para árvore');
  const impurity=(positive,n)=>n?2*(positive/n)*(1-positive/n):0;
  function build(rows,depth){
    const n=rows.length,positive=rows.reduce((s,r)=>s+r.y,0);
    const node={count:n,positive,probability:(positive+cfg.laplace)/(n+2*cfg.laplace)};
    if(depth>=cfg.maxDepth||n<2*cfg.minLeaf||positive===0||positive===n)return node;
    let best=null;
    for(let feature=0;feature<size;feature++){
      const sorted=rows.slice().sort((a,b)=>a.x[feature]-b.x[feature]);
      const positions=new Set(Array.from({length:cfg.thresholdCandidatesPerFeature},(_,i)=>Math.floor((i+1)*n/(cfg.thresholdCandidatesPerFeature+1))));
      let leftPositive=0;
      for(let i=1;i<n;i++){
        leftPositive+=sorted[i-1].y;
        if(!positions.has(i)||i<cfg.minLeaf||n-i<cfg.minLeaf||sorted[i-1].x[feature]===sorted[i].x[feature])continue;
        const gain=impurity(positive,n)-(i*impurity(leftPositive,i)+(n-i)*impurity(positive-leftPositive,n-i))/n;
        const threshold=(sorted[i-1].x[feature]+sorted[i].x[feature])/2;
        if(gain>=cfg.minimumGain&&(!best||gain>best.gain+1e-14))best={feature,threshold,gain};
      }
    }
    if(!best)return node;
    const left=rows.filter(s=>s.x[best.feature]<=best.threshold),right=rows.filter(s=>s.x[best.feature]>best.threshold);
    return {...node,...best,left:build(left,depth+1),right:build(right,depth+1)};
  }
  return {kind:cfg.kind,features:protocol.features,root:build(samples,0),trainRate:samples.reduce((s,r)=>s+r.y,0)/samples.length};
}

export function predictTree(model,x){
  if(x.length!==model.features.length||!x.every(Number.isFinite))throw Error('Features inválidas');
  let node=model.root;const path=[];
  while(node.left){const left=x[node.feature]<=node.threshold;path.push({feature:model.features[node.feature],value:x[node.feature],threshold:node.threshold,left});node=left?node.left:node.right;}
  return {probability:node.probability,path,leafCount:node.count,leafPositive:node.positive};
}
export function predictStrategy(model,x){return model.kind==='decision-tree-gini'?predictTree(model,x):predictML(model,x);}

export function strategyMetrics(samples,model,threshold){
  if(!samples.length)return{count:0};let brier=0,constantBrier=0,accepted=0,positive=0;
  for(const s of samples){const probability=predictStrategy(model,s.x).probability;brier+=(probability-s.y)**2;constantBrier+=(model.trainRate-s.y)**2;if(probability>=threshold)accepted++;positive+=s.y;}
  return{count:samples.length,brier:brier/samples.length,constantBrier:constantBrier/samples.length,coverage:accepted/samples.length,positiveRate:positive/samples.length};
}

export function prepareFamily(data,protocol,strategyProtocol,family,until=Infinity){
  if(family.id==='donchian')return prepareML(data,protocol,strategyProtocol,until);
  const bars=intradayBars(data.candles,until,family.engine),contexts=contextIndicators(data.candles,until),features=new Map();
  for(let i=24;i<bars.length;i++){
    const b=bars[i],side=b.cross,c=contexts[i];if(!b.ready||!side||!(b.atr>0)||c.rsi===null||c.adx===null||c.vwap===null)continue;
    const prior=bars.slice(i-20,i),upper=Math.max(...prior.map(b=>b.high)),lower=Math.min(...prior.map(b=>b.low));
    const avg=prior.reduce((n,b)=>n+b.volume,0)/20,rvol=avg>0?b.volume/avg:null;if(!(rvol>0))continue;
    const x=[side,side*Math.log(b.close/bars[i-1].close),side*Math.log(b.close/bars[i-6].close),side*Math.log(b.close/bars[i-24].close),
      b.atr/b.close,Math.log(rvol),side*(b.fast-b.slow)/b.atr,side*(c.rsi-50)/50,c.adx/100,side*(b.close-c.vwap)/b.atr,
      (upper-lower)/b.atr,(side===1?b.close-upper:lower-b.close)/b.atr];
    if(!x.every(Number.isFinite))throw Error('Features inválidas');
    features.set(b.at,{at:b.at,side,x,lookback:20,price:b.close,atr:b.atr});
  }
  return {bars,features};
}

export function simulateFamily(data,{protocol,strategyProtocol,family,prepared=null,model=null,threshold=0,start,until,costCase='base',closeAtEnd=false}={}){
  if(model&&(model.availableAt>start||model.informationCutoff>start))throw Error('Modelo posterior ao início');
  prepared??=prepareFamily(data,protocol,strategyProtocol,family,until);
  const signals=prepared.bars.filter(b=>b.ready&&b.cross&&b.at>start&&b.at<=until)
    .map(b=>({at:b.at,side:b.cross,price:b.close,atr:b.atr,fast:b.fast,slow:b.slow,...(family.engine==='reversion'?{mean:b.mean}:{})}));
  const scores=new Map(model?signals.map(s=>{const feature=prepared.features.get(s.at);return[s.at,feature?predictStrategy(model,feature.x).probability:null];}):[]);
  const cost=strategyProtocol.costCases.find(x=>x.id===costCase);if(!cost)throw Error('Custo inválido');
  const r=simulate(data,{start,until,strategy:family.engine,maxHoldHours:family.maxHoldHours,stopATR:family.stopATR,
    targetR:family.targetR,cooldownHours:family.cooldownHours,registeredSignals:new Map(signals.map(s=>[s.at,s])),
    config:{capitalBRL:strategyProtocol.capitalBRL,fx:strategyProtocol.fx,risk:strategyProtocol.risk,leverage:strategyProtocol.leverage,
      fee:cost.fee,slippage:cost.slippage,dailyLimit:strategyProtocol.dailyLimit,totalLimit:strategyProtocol.totalLimit},
    entryFilter:model&&threshold>0?({signal})=>{const p=scores.get(signal.at);return p!==null&&p>=threshold?null:'Modelo vetou nova entrada';}:null,closeAtEnd});
  r.signals=signals;r.scores=scores;return r;
}
