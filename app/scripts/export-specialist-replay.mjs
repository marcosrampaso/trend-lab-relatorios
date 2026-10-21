// Read-only reconstruction: models, signals, rules and ledgers must remain identical.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {ROOT,read,hash} from './multiasset-io.mjs';
import {Market} from './exit-lab-core.mjs';
import {ExitWallet} from './exit-lab-wallet.mjs';
import {simpleAction} from './entry-audit-core.mjs';
import {entryChoice} from './specialist-core.mjs';
const base='work/pepe-specialists-v1',out='work/pepe-specialist-replay-v1',pub='web/data/specialist-replay';
fs.mkdirSync(ROOT+'/'+out,{recursive:true});fs.mkdirSync(ROOT+'/'+pub,{recursive:true});
const result=read(base+'/result.json'),p=result.protocol,market=new Market(),inputs={};
function pin(f){const h=hash(f);if(inputs[f]&&inputs[f]!==h)throw Error('Changed input '+f);inputs[f]=h;}
pin(base+'/result.json');pin(base+'/protocol.json');
const registration=read(base+'/registration.json');
for(const [f,h] of Object.entries(registration.inputHashes)){assert.equal(hash(f),h,'Registered source changed: '+f);pin(f);}
const predictions={};
for(const j of p.jobs){const folder=base+'/models/'+j.key,manifest=read(folder+'/complete.json');pin(folder+'/complete.json');
 for(const[f,h]of Object.entries(manifest.artifacts)){assert.equal(hash(f),h);pin(f);}
 predictions[j.key]=new Map(read(folder+'/predictions.json').predictions.map(r=>[r.at,r]));
}
const audit={version:'specialist-replay-v1',createdAt:Date.now(),threshold:p.minimumExpectedNetR,fx:p.engine.fx,
 realOrders:false,retrained:false,parityWallets:0,months:[],experts:{},arms:{},sourceResultSHA256:inputs[base+'/result.json']};
for(const j of p.jobs){const rows=[...predictions[j.key].values()];audit.experts[j.key]={...j,total:rows.length,
 policyEligible:rows.filter(r=>r.eligible).length,calibrationVeto:rows.filter(r=>r.eligible&&r.netR<=audit.threshold).length,
 accepted:rows.filter(r=>r.eligible&&r.netR>audit.threshold).length,metrics:read(base+'/models/'+j.key+'/metrics.json')};}
for(const [key,arm] of Object.entries(result.results))audit.arms[key]={system:arm.system,mode:arm.mode,meanMonthlyBRL:arm.meanMonthlyBRL,months:{}};
for(const m of p.months.filter(m=>m.split==='evaluation')){
 const labelFile=base+'/labels/'+m.month+'.json';pin(labelFile);const grid=read(labelFile).rows;
 const raw=market.packet(m.start);const rawFile=market.index.months.find(x=>x.month===m.month).rawPath;pin(rawFile);
 const candles=raw.candles.map(r=>r.slice(0,6));assert.equal(candles.length,(m.end-m.start)/60000);
 fs.writeFileSync(ROOT+'/'+pub+'/'+m.month+'.json',JSON.stringify({month:m.month,start:m.start,end:m.end,candles}));
 audit.months.push({...m,candles:pub.replace('web','')+'/'+m.month+'.json',rows:candles.length});
 const forecasts=grid.map(f=>({at:f.at,experts:Object.fromEntries(p.jobs.map(j=>[j.key,predictions[j.key].get(f.at)]))}));
 // One compact forecast packet per month; no model inference or parameter search.
 fs.writeFileSync(ROOT+'/'+pub+'/'+m.month+'-decisions.json',JSON.stringify(forecasts));
 for(const [key,arm] of Object.entries(result.results)){
  const [family,seed]=arm.system.split('-'),longKey=family+'-1-'+seed,shortKey=family+'--1-'+seed;
  const entries=grid.flatMap(f=>{const l=predictions[longKey].get(f.at),s=predictions[shortKey].get(f.at);
   const side=entryChoice(l.eligible?l.netR:0,s.eligible?s.netR:0,arm.mode,audit.threshold);
   return side?[{atr:f.atr,trade:{entryAt:f.at,side,leverage:p.engine.leverage}}]:[];});
  const expected=arm.wallets.find(w=>w.month===m.month);let events=[];
  // Replay the unchanged execution to retrieve rejection reasons not present in the old summary.
  const wallet=new ExitWallet(p.engine,market);let r=wallet.resetWallet({month:m,entries},true);
  while(!r.done)r=wallet.step(simpleAction('ladder_lock',wallet));
  const {cdi,...old}=expected;assert.deepEqual(r.summary,old,'Ledger parity '+key+' '+m.month);
  events=wallet.account.finish().events.map(e=>{
   const tradeIndex=expected.trades.findIndex(t=>t.entryAt<=e.at&&t.exitAt>=e.at);
   const t=expected.trades[tradeIndex],leg=t?.legs?.find(l=>l.exitAt===e.at&&l.exit===e.price);
   return{...e,tradeIndex:tradeIndex<0?null:tradeIndex,...(leg?{leg}:{}),
    ...(e.kind==='entry'&&t?{initialQty:t.initialQty,initialStop:t.initialStop,entryFeeBRL:t.entryFee*p.engine.fx}:{})};});
  const sideCounts=sideKey=>{const rows=forecasts.map(f=>f.experts[sideKey]);return{total:rows.length,policyEligible:rows.filter(r=>r.eligible).length,calibrationVeto:rows.filter(r=>r.eligible&&r.netR<=audit.threshold).length,accepted:rows.filter(r=>r.eligible&&r.netR>audit.threshold).length};};
  audit.arms[key].months[m.month]={...expected,events,long:sideCounts(longKey),short:sideCounts(shortKey),
   rejectedReasons:events.filter(e=>e.kind==='rejected'||e.kind==='skipped').map(e=>({at:e.at,knownAt:e.knownAt,reason:e.reason}))};
  audit.parityWallets++;console.log(key,m.month,'parity',events.length,'events');
 }
}
for(const[f,h]of Object.entries(inputs))assert.equal(hash(f),h,'Input changed during replay '+f);
const manifest={...audit,inputs,notes:['All 45 ledgers reproduced exactly, including trades, costs, skips, curves and stops.',
 'No models retrained; no signals added; no risk or rules changed. Forecasts copied from immutable predictions.',
 'Each candle is revealed only after its one-minute close. Events use archived knownAt.',
 'Monthly wallets reset by original protocol; no compounded return inferred. All evaluation periods were previously consumed.']};
fs.writeFileSync(ROOT+'/'+out+'/audit.json',JSON.stringify(manifest,null,2));
fs.writeFileSync(ROOT+'/'+pub+'/index.json',JSON.stringify(audit));
console.log(JSON.stringify({parityWallets:audit.parityWallets,experts:audit.experts}));
