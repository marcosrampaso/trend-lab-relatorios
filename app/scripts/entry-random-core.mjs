import {createHash} from 'node:crypto';

export const RANDOM_RUN='work/pepe-entry-random-v1';
export const mean=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:null;

// Hash ranking gives a deterministic pseudorandom subset without reading outcomes.
export function randomSubset(entries,count,seed,month){
  if(!Number.isInteger(count)||count<0||count>entries.length||!Number.isInteger(seed))
    throw Error('Invalid matched sample size/seed');
  if(new Set(entries.map(e=>e.id)).size!==entries.length)throw Error('Duplicate signal ID');
  const ranked=entries.map(e=>({id:e.id,key:createHash('sha256')
    .update(`pepe-entry-random-v1\0${seed}\0${month}\0${e.id}`).digest('hex')}))
    .sort((a,b)=>a.key.localeCompare(b.key)||a.id.localeCompare(b.id));
  const ids=new Set(ranked.slice(0,count).map(e=>e.id));
  return entries.filter(e=>ids.has(e.id));
}

export function quantile(values,q){
  if(!values.length||!(q>=0&&q<=1)||!values.every(Number.isFinite))throw Error('Invalid distribution');
  const a=values.slice().sort((a,b)=>a-b),at=(a.length-1)*q,lo=Math.floor(at),hi=Math.ceil(at);
  return a[lo]+(a[hi]-a[lo])*(at-lo);
}

export function compareRandom(values,reference){
  if(!Number.isFinite(reference))throw Error('Invalid reference');
  const eps=1e-8,lower=values.filter(v=>v<reference-eps).length;
  const tied=values.filter(v=>Math.abs(v-reference)<=eps).length;
  const atLeast=values.length-lower;
  return{replicates:values.length,referenceBRL:reference,meanBRL:mean(values),
    minimumBRL:quantile(values,0),q025BRL:quantile(values,.025),q25BRL:quantile(values,.25),
    medianBRL:quantile(values,.5),q75BRL:quantile(values,.75),q975BRL:quantile(values,.975),
    maximumBRL:quantile(values,1),randomStrictlyBelow:lower,ties:tied,randomAtLeastAsGood:atLeast,
    randomAtLeastAsGoodFraction:atLeast/values.length,
    monteCarloUpperTailWithPlusOne:(atLeast+1)/(values.length+1),
    referencePercentile:100*(lower+.5*tied)/values.length,
    referenceAboveCentralEnvelope:reference>quantile(values,.975)+eps,
    envelopeIsConfidenceInterval:false,formalPValue:false};
}

export function summarizeReplicate(wallets,months){
  if(wallets.length!==months.length||months.some(m=>wallets.filter(w=>w.month===m).length!==1))
    throw Error('Missing/duplicate calendar month');
  return{meanMonthlyBRL:mean(wallets.map(w=>w.pnlBRL)),meanDD:mean(wallets.map(w=>w.maxDD)),
    aboveCDI:wallets.filter(w=>w.pnlBRL>w.cdi.pnlBRL).length,
    losingMonths:wallets.filter(w=>w.pnlBRL<0).length,zeroTradeMonths:wallets.filter(w=>w.count===0).length,
    trades:wallets.reduce((s,w)=>s+w.count,0),feesBRL:wallets.reduce((s,w)=>s+w.feesBRL,0),
    grossBRL:wallets.reduce((s,w)=>s+w.grossBRL,0),fundingBRL:wallets.reduce((s,w)=>s+w.fundingBRL,0),
    riskSkips:wallets.reduce((s,w)=>s+w.riskSkips,0),overlapSkips:wallets.reduce((s,w)=>s+w.overlapSkips,0),
    exposureHours:wallets.reduce((s,w)=>s+(w.avgHoldHours??0)*w.count,0)};
}
