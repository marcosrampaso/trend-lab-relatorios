import {aggregateHours, frameAt, trendFrames} from './scalping-context.js';
import {predictTree} from './tree-ml.js';

const HOUR=3600000;
export function scalpTrendFrames(hourly, rule) {
  return Object.fromEntries([[1,'hourly'],[4,'fourHourly']].map(([hours,key])=>{
    const rows=aggregateHours(hourly,hours), trends=trendFrames(hourly,hours,rule);
    let atr,seed=0,prev;
    return [key,trends.map((b,i)=>{
      const r=rows[i],tr=Math.max(r[2]-r[3],prev===undefined?0:Math.abs(r[2]-prev),prev===undefined?0:Math.abs(r[3]-prev));
      if(i<14){seed+=tr;if(i===13)atr=seed/14;}else atr=(atr*13+tr)/14;
      prev=r[4]; return {...b,atr:atr??null};
    })];
  }));
}

export function scalpFeatures(bar,side,frames,strategyProtocol) {
  const h=frameAt(frames.hourly,bar.at),f=frameAt(frames.fourHourly,bar.at);
  if(!bar.ready||!(bar.atr>0)||!(bar.rvol>0)||bar.rsi==null||bar.vwap==null||bar.deltaPct==null||h?.side==null||f?.side==null||!(h.atr>0)||!(f.atr>0))return null;
  const cost=strategyProtocol.costCases.find(c=>c.id==='stress');
  const x=[side,side*(bar.rsi-50)/50,bar.atr/bar.close,Math.log(bar.rvol),
    side*(bar.close-bar.vwap)/bar.atr,side*(bar.fast-bar.slow)/bar.atr,side*h.side,side*f.side,
    side*(h.fast-h.slow)/h.atr,side*(f.fast-f.slow)/f.atr,
    2*bar.close*(cost.fee+cost.slippage)/(strategyProtocol.stopATR*bar.atr),side*bar.deltaPct];
  return x.every(Number.isFinite)?{at:bar.at,side,x,hourlyAt:h.at,fourHourlyAt:f.at}:null;
}

export function availableScalpSamples(samples,start,end) {
  return samples.filter(s=>s.at>=start&&s.at<end&&s.labelAvailableAt<end);
}

export function scalpEntryFilter(bundle,features,start) {
  if(!bundle)return null;
  if(bundle.availableAt>start||bundle.informationCutoff>start)throw Error('Árvore ainda não disponível no início da carteira');
  if(bundle.threshold===0)return null;
  return sig=>{
    const row=features.get(sig.at);
    if(!row)return 'Árvore: contexto indisponível';
    return predictTree(bundle.model,row.x).probability>=bundle.threshold?null:'Árvore vetou nova entrada';
  };
}

export function monthAt(month,offset=0) {
  const [year,m]=month.slice(0,7).split('-').map(Number);
  return Date.UTC(year,m-1+offset,1);
}
export function monthsBetween(start,end) {
  const out=[];
  for(let at=Date.parse(start);at<Date.parse(end);at=monthAt(new Date(at).toISOString(),1))out.push(new Date(at).toISOString().slice(0,7));
  return out;
}

export function pairedMonthlyInterval(values,{replicates=5000,blockMonths=3,seed=20261018,comparisons=6}={}) {
  if(values.length<blockMonths)return null;
  let state=seed>>>0;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  const means=[];
  for(let i=0;i<replicates;i++){
    const draw=[];
    while(draw.length<values.length){const start=Math.floor(random()*(values.length-blockMonths+1));for(let j=0;j<blockMonths&&draw.length<values.length;j++)draw.push(values[start+j]);}
    means.push(draw.reduce((n,v)=>n+v,0)/draw.length);
  }
  means.sort((a,b)=>a-b);const alpha=.05/comparisons;
  return {months:values.length,meanUSDT:values.reduce((n,v)=>n+v,0)/values.length,lowerUSDT:means[Math.floor(replicates*alpha/2)],upperUSDT:means[Math.min(replicates-1,Math.ceil(replicates*(1-alpha/2)))],confidence:1-alpha,blockMonths,replicates,comparisons};
}
