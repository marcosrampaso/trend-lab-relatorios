import {simulate, HOUR} from './engine.js';
import {prepareDonchian} from './donchian.js';
import {contextIndicators} from './decision-context.js';

export const sigmoid = x => x >= 0 ? 1 / (1 + Math.exp(-x)) : Math.exp(x) / (1 + Math.exp(x));

export function prepareML(data, protocol, strategyProtocol, until = Infinity) {
  const bars = prepareDonchian(data.candles, strategyProtocol, until)[protocol.signalVariant];
  const contexts = contextIndicators(data.candles, until);
  const features = new Map();
  for (let i = 24; i < bars.length; i++) {
    const b = bars[i], c = contexts[i], side = b.cross;
    if (!b.ready || !side || !(b.atr > 0) || c.rsi === null || c.adx === null || c.vwap === null) continue;
    const x = [side, side * Math.log(b.close / bars[i-1].close), side * Math.log(b.close / bars[i-6].close),
      side * Math.log(b.close / bars[i-24].close), b.atr / b.close, Math.log(b.rvol),
      side * (b.fast-b.slow) / b.atr, side * (c.rsi-50) / 50, c.adx / 100,
      side * (b.close-c.vwap) / b.atr, (b.upper-b.lower) / b.atr,
      (side === 1 ? b.close-b.upper : b.lower-b.close) / b.atr];
    if (x.length !== protocol.features.length || !x.every(Number.isFinite)) throw Error('Feature inválida');
    features.set(b.at, {at:b.at, side, x, lookback:b.lookback, price:b.close, atr:b.atr});
  }
  return {bars, features};
}

export function temporalSamples(samples, split) {
  const start = Date.parse(split.start), end = Date.parse(split.end);
  return samples.filter(s => s.at >= start && s.at < end && s.labelAvailableAt < end);
}

export function standardize(x, model) {
  if (x.length !== model.mean.length || !x.every(Number.isFinite)) throw Error('Features incompatíveis');
  return x.map((v,i) => Math.max(-model.clipZ, Math.min(model.clipZ,(v-model.mean[i])/model.scale[i])));
}

// Mean binary cross entropy + lambda/2 * ||weights||². Intercept unpenalized.
export function logisticObjective(rows, weights, intercept, lambda) {
  let loss = 0, bias = 0; const gradient = weights.map(w => lambda*w);
  for (const {x,y} of rows) {
    const z = x.reduce((sum,v,i) => sum+v*weights[i],intercept), prediction = sigmoid(z);
    loss += Math.max(z,0)-z*y+Math.log1p(Math.exp(-Math.abs(z)));
    const error = (prediction-y)/rows.length;
    bias += error; for (let i=0;i<x.length;i++) gradient[i] += error*x[i];
  }
  return {loss:loss/rows.length+lambda/2*weights.reduce((s,w)=>s+w*w,0),gradient,bias};
}

export function fitLogistic(samples, protocol) {
  const cfg = protocol.learner, n = samples.length, size = protocol.features.length;
  const positives = samples.reduce((s,r)=>s+r.y,0);
  if (n < cfg.minimumSamples || Math.min(positives,n-positives) < cfg.minimumClassSamples) throw Error('Amostra de treino insuficiente');
  if (!samples.every(s=>s.x.length===size&&s.x.every(Number.isFinite)&&[0,1].includes(s.y))) throw Error('Amostra inválida');
  const mean = Array(size).fill(0), scale = Array(size).fill(0);
  for (const s of samples) for (let i=0;i<size;i++) mean[i] += s.x[i]/n;
  for (const s of samples) for (let i=0;i<size;i++) scale[i] += (s.x[i]-mean[i])**2/n;
  for (let i=0;i<size;i++) scale[i] = Math.sqrt(scale[i]) || 1;
  const model = {kind:cfg.kind,features:protocol.features,mean,scale,clipZ:cfg.clipZ,
    weights:Array(size).fill(0),intercept:Math.log(positives/(n-positives)),trainRate:positives/n};
  const rows = samples.map(s=>({x:standardize(s.x,model),y:s.y}));
  model.initialLoss = logisticObjective(rows,model.weights,model.intercept,cfg.lambda).loss;
  for (let iteration=0;iteration<cfg.steps;iteration++) {
    const {gradient,bias} = logisticObjective(rows,model.weights,model.intercept,cfg.lambda);
    for (let i=0;i<size;i++) model.weights[i] -= cfg.learningRate*gradient[i];
    model.intercept -= cfg.learningRate*bias;
  }
  model.finalLoss = logisticObjective(rows,model.weights,model.intercept,cfg.lambda).loss;
  if (![...model.weights,model.intercept,model.finalLoss].every(Number.isFinite)) throw Error('Treino divergente');
  return model;
}

export function predictML(model, x) {
  const z = standardize(x,model), contributions = z.map((value,i)=>({feature:model.features[i],raw:x[i],z:value,contribution:value*model.weights[i]}));
  const logit = contributions.reduce((s,c)=>s+c.contribution,model.intercept);
  return {probability:sigmoid(logit),logit,contributions};
}

export function classificationMetrics(samples, model) {
  if (!samples.length) return {count:0};
  let loss=0,brier=0,constantLoss=0,constantBrier=0,positives=0,accepted=0,acceptedPositive=0;
  const clamp=p=>Math.max(1e-12,Math.min(1-1e-12,p));
  for (const s of samples) {
    const p=clamp(predictML(model,s.x).probability), c=clamp(model.trainRate);
    positives+=s.y;loss-=s.y*Math.log(p)+(1-s.y)*Math.log(1-p);brier+=(p-s.y)**2;
    constantLoss-=s.y*Math.log(c)+(1-s.y)*Math.log(1-c);constantBrier+=(c-s.y)**2;
    if(p>=model.threshold){accepted++;acceptedPositive+=s.y;}
  }
  const n=samples.length;
  return {count:n,positiveRate:positives/n,logLoss:loss/n,brier:brier/n,constantLogLoss:constantLoss/n,
    constantBrier:constantBrier/n,accepted,coverage:accepted/n,acceptedPositiveRate:accepted?acceptedPositive/accepted:null};
}

export function simulateML(data,{protocol,strategyProtocol,prepared=null,model=null,mode='control',start,until,costCase='base',closeAtEnd=false}={}) {
  if (!['control','ml'].includes(mode)) throw Error('Modo inválido');
  const cost = strategyProtocol.costCases.find(x=>x.id===costCase);
  if (!cost) throw Error('Custos inválidos');
  if (mode==='ml' && (!model || start<model.availableAt || model.informationCutoff>start)) throw Error('Modelo indisponível no início do período');
  prepared ??= prepareML(data,protocol,strategyProtocol,until);
  const signals=prepared.bars.filter(b=>b.ready&&b.cross&&b.at>start&&b.at<=until)
    .map(b=>({at:b.at,side:b.cross,price:b.close,atr:b.atr,fast:b.fast,slow:b.slow}));
  const predictions = mode==='ml' ? signals.map(s=>{
    const feature=prepared.features.get(s.at);if(!feature)return{at:s.at,side:s.side,probability:null,accept:false};
    const probability=predictML(model,feature.x).probability;
    return{at:s.at,side:s.side,probability,accept:probability>=model.threshold};
  }) : [];
  const byAt=new Map(predictions.map(s=>[s.at,s]));
  const r=simulate(data,{start,until,strategy:'breakout',maxHoldHours:strategyProtocol.maxHoldHours,
    stopATR:strategyProtocol.stopATR,targetR:strategyProtocol.targetR,cooldownHours:strategyProtocol.cooldownHours,
    config:{capitalBRL:strategyProtocol.capitalBRL,fx:strategyProtocol.fx,risk:strategyProtocol.risk,
      leverage:strategyProtocol.leverage,dailyLimit:strategyProtocol.dailyLimit,totalLimit:strategyProtocol.totalLimit,
      fee:cost.fee,slippage:cost.slippage},registeredSignals:new Map(signals.map(s=>[s.at,s])),
    entryFilter:mode==='control'?null:({signal})=>{
      const score=byAt.get(signal.at);
      return score?.accept?null:score?.probability==null?'Features indisponíveis para o modelo'
        :'Score '+(score.probability*100).toFixed(1)+'% abaixo do limiar '+(model.threshold*100).toFixed(1)+'%';
    },closeAtEnd});
  r.signals=signals;r.predictions=predictions;r.pending=signals.at(-1)?.at===until?signals.at(-1):null;
  return r;
}
