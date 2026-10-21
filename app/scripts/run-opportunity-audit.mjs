import fs from 'node:fs';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';
import{ROOT,read,hash,atomic}from'./multiasset-io.mjs';
import{Market}from'./exit-lab-core.mjs';import{ExitWallet}from'./exit-lab-wallet.mjs';
import{candleFeatures,candidateOutcome}from'./specialist-core.mjs';import{simpleAction}from'./entry-audit-core.mjs';import{cdiReference}from'./cdi-reference-core.mjs';
import{OPPORTUNITY,knownFeasibility,opportunityGroups,inspectOpportunity,summarizeOpportunities,mean}from'./specialist-opportunity-core.mjs';
const base=ROOT+'/'+OPPORTUNITY,p=read(base+'/protocol.json'),reg=read(base+'/registration.json'),market=new Market(),old=read(p.origin+'/protocol.json');
const inputs={...reg.inputs,...reg.sourceHashes};function verify(){assert.equal(hash(base+'/protocol.json'),reg.protocolSHA256);for(const[f,h]of Object.entries(inputs))assert.equal(hash(f),h,f);}
verify();if(fs.existsSync(base+'/result.json'))throw Error('Audit already complete');
const status=extra=>{const value={app:'trend-lab-opportunity',updatedAt:Date.now(),realOrders:false,...extra};atomic(base+'/status.json',value);atomic(ROOT+'/web/data/opportunity-status.json',value);};
let parity=0;
for(const month of ['2023-06','2023-12','2024-03']){
 const packet=read(p.origin+'/labels/'+month+'.json'),raw=market.packet(packet.start),contexts=market.contexts(packet.start,packet.end);
 const indices=[0,Math.floor(packet.rows.length*.2),Math.floor(packet.rows.length*.4),Math.floor(packet.rows.length*.6),packet.rows.length-2].map(i=>i-i%2);
 for(const i of indices)for(const target of packet.rows.slice(i,i+2)){
  const original=market.context(target.at),idx=(target.at-raw.start)/60000,f=candleFeatures(original,raw.candles.slice(idx-5,idx));
  const outcome=inspectOpportunity(f,target.side,packet.end,p.engine,market,contexts),reference=candidateOutcome(f,target.side,packet.end,p.engine,market,contexts);
  for(const[k,v]of Object.entries(reference)){assert.deepEqual(outcome[k],v,'Wrapper parity '+k);assert.deepEqual(outcome[k],target[k],'Archived label parity '+k);}
  parity++;
 }
}
status({phase:'counterfactuals',completed:0,total:14582,parity});
const monthly=[],all=[];let completed=0;
for(const m of p.months){
 const file=base+'/months/'+m.month+'.json',grid=read(p.origin+'/labels/'+m.month+'.json').rows,contexts=market.contexts(m.start,m.end);
 if(fs.existsSync(file)){
  const packet=read(file);assert.equal(packet.registrationSHA256,hash(base+'/registration.json'));all.push(...packet.rows);monthly.push(packet);completed+=packet.rows.length;continue;
 }
 const rows=[];
 for(const f0 of grid){const f={...f0,knownAt:f0.at};for(const side of[1,-1]){
  const known=knownFeasibility(f,side,p.engine,market.filters),outcome=inspectOpportunity(f,side,m.end,p.engine,market,contexts);
  rows.push({...outcome,month:m.month,known,groups:opportunityGroups(f,side,known)});completed++;
 }
 if(rows.length%400===0){status({phase:'counterfactuals',month:m.month,completed,total:14582,parity});console.log(m.month,rows.length);}
 }
 const packet={month:m.month,rows,registrationSHA256:hash(base+'/registration.json')};
 fs.writeFileSync(file,JSON.stringify(packet),{flag:'wx',mode:0o444});monthly.push(packet);all.push(...rows);status({phase:'counterfactuals',month:m.month,completed,total:14582,parity});
}
const rates=read(old.origin+'/rates.json'),controls={};
for(const control of p.controls){const wallets=[];
 for(const m of p.months){const grid=read(p.origin+'/labels/'+m.month+'.json').rows;
  const entries=grid.flatMap(f=>{const side=control==='all_long'?1:control==='all_short'?-1:control==='aligned_trend'&&f.x[7]===f.x[8]?f.x[7]:0;
   return side?[{atr:f.atr,trade:{entryAt:f.at,side,leverage:p.engine.leverage}}]:[];});
  const wallet=new ExitWallet(p.engine,market);let r=wallet.resetWallet({month:m,entries},true);while(!r.done)r=wallet.step(simpleAction('ladder_lock',wallet));
  const cdi=cdiReference(rates,m.start,m.end,p.engine.capitalBRL);if(!cdi.comparable)throw Error('Missing comparable CDI');wallets.push({...r.summary,cdi});
  status({phase:'controls',control,month:m.month,completed,total:14582,parity});
 }
 controls[control]={wallets,meanMonthlyBRL:mean(wallets.map(w=>w.pnlBRL)),aboveCDI:wallets.filter(w=>w.pnlBRL>w.cdi.pnlBRL).length,
  count:wallets.reduce((s,w)=>s+w.count,0),haltedMonths:wallets.filter(w=>w.halted).length};
}
status({phase:'calibration',completed,total:14582,parity});
if(!fs.existsSync(base+'/calibration.json'))console.log(execFileSync(ROOT+'/.venv-rl/bin/python',[ROOT+'/scripts/audit-specialist-calibration.py'],{cwd:ROOT,encoding:'utf8',timeout:120000}));
const sides=Object.fromEntries([1,-1].map(side=>[side,summarizeOpportunities(all.filter(r=>r.side===side))]));
const groups={};for(const[k,values]of Object.entries(p.groups))groups[k]=values.map(value=>({value,sides:Object.fromEntries([1,-1].map(side=>{
 const rows=all.filter(r=>r.side===side&&r.groups[k]===value);return[side,{...summarizeOpportunities(rows),byMonth:p.months.map(m=>({month:m.month,...summarizeOpportunities(rows.filter(r=>r.month===m.month))}))}];}))}));
const actual=(known,filled)=>all.filter(r=>r.known.feasible===known&&r.filled===filled).length;
const predictions=Object.fromEntries(p.jobs.map(j=>[j.key,new Map(read(p.origin+'/models/'+j.key+'/predictions.json').predictions.map(r=>[r.at,r]))]));
const accepted=[];for(const row of all)for(const j of p.jobs.filter(j=>j.side===row.side)){const prediction=predictions[j.key].get(row.at);if(prediction.eligible&&prediction.netR>p.threshold)accepted.push({key:j.key,...row,predictedNetR:prediction.netR});}
verify();const summary={version:p.version,completedAt:Date.now(),protocol:p,parity,independentValidation:false,realOrders:false,retrained:false,
 total:all.length,sides,months:p.months.map(m=>({month:m.month,sides:Object.fromEntries([1,-1].map(side=>[side,summarizeOpportunities(all.filter(r=>r.month===m.month&&r.side===side))]))})),groups,
 feasibility:{predictedPassFilled:actual(true,true),predictedPassUnfilled:actual(true,false),predictedFailFilled:actual(false,true),predictedFailUnfilled:actual(false,false)},
 controls,calibration:read(base+'/calibration.json'),accepted,integrity:{unchangedInputs:Object.keys(inputs).length,passed:true}};
fs.writeFileSync(base+'/result.json',JSON.stringify(summary),{flag:'wx',mode:0o444});atomic(ROOT+'/web/data/opportunities.json',summary);
status({phase:'complete',completed,total:all.length,parity});console.log(JSON.stringify({complete:true,total:all.length,sides,controls:Object.fromEntries(Object.entries(controls).map(([k,v])=>[k,{meanMonthlyBRL:v.meanMonthlyBRL,count:v.count,aboveCDI:v.aboveCDI}]))}));
