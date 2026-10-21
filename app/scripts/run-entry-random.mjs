import fs from 'node:fs';
import {spawn} from 'node:child_process';
import {ROOT,read,hash,atomic} from './multiasset-io.mjs';
import {RANDOM_RUN,compareRandom,summarizeReplicate,mean,quantile} from './entry-random-core.mjs';
const base=ROOT+'/'+RANDOM_RUN,p=read(base+'/protocol.json'),reg=read(base+'/registration.json');
if(fs.existsSync(base+'/result.json'))throw Error('Results already frozen');
function verify(){
  if(hash(base+'/protocol.json')!==reg.protocolSHA256)throw Error('Changed protocol');
  for(const[f,h]of Object.entries({...reg.inputHashes,...reg.sourceHashes}))
    if(hash(ROOT+'/'+f)!==h)throw Error('Registered input changed: '+f);
}
verify();const registrationSHA256=hash(base+'/registration.json'),startedAt=Date.now();
const progress=Object.fromEntries(p.months.map(m=>[m.month,0])),children=new Set();
function status(phase,error){
  const s={phase,startedAt,updatedAt:Date.now(),completedWallets:Object.values(progress).reduce((s,n)=>s+n,0),
    totalWallets:p.months.length*p.seeds.length,months:progress,activeWorkers:children.size,error,realOrders:false};
  atomic(base+'/status.json',s);atomic(ROOT+'/web/data/entry-random-status.json',s);
}
function validatePart(m){
  const r=read(base+'/months/'+m.month+'.json');
  if(r.registrationSHA256!==registrationSHA256||r.replicates.length!==p.seeds.length
    ||r.sourceSHA256!==reg.inputHashes[m.sourcePath]
    ||r.replicates.some((r,i)=>r.seed!==p.seeds[i]||r.acceptedIDs.length!==m.accepted))throw Error('Wrong completed month');
  progress[m.month]=p.seeds.length;return r;
}
async function runMonth(m){
  if(fs.existsSync(base+'/months/'+m.month+'.json')){validatePart(m);status('running');return;}
  await new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,[ROOT+'/scripts/entry-random-month.mjs',m.month],{cwd:ROOT,stdio:['ignore','pipe','pipe']});
    children.add(child);status('running');let buffer='',stderr='';
    child.stdout.on('data',b=>{
      buffer+=b;const lines=buffer.split('\n');buffer=lines.pop();
      for(const line of lines)if(line){console.log(line);const v=JSON.parse(line);progress[m.month]=v.completed;status('running');}
    });
    child.stderr.on('data',b=>stderr=(stderr+b).slice(-5000));
    child.on('error',reject);child.on('close',code=>{
      children.delete(child);if(code)return reject(Error(m.month+': '+stderr));
      try{validatePart(m);status('running');resolve();}catch(e){reject(e);}
    });
  });
}
try{
  let next=0;await Promise.all(Array.from({length:p.workers},async()=>{
    while(next<p.months.length)await runMonth(p.months[next++]);
  }));
  const parts=p.months.map(validatePart),months=p.months.map(m=>m.month);
  const controls=Object.fromEntries(['control','cost_gate'].map(arm=>[arm,parts.map(m=>m.controls[arm])]));
  const controlSummary=Object.fromEntries(Object.entries(controls).map(([arm,w])=>[arm,summarizeReplicate(w,months)]));
  const replicates=p.seeds.map(seed=>{
    const wallets=parts.map(m=>m.replicates.find(r=>r.seed===seed).wallet);
    return{seed,...summarizeReplicate(wallets,months),months:wallets.map(w=>({
      month:w.month,pnlBRL:w.pnlBRL,count:w.count,feesBRL:w.feesBRL,maxDD:w.maxDD,
      sourceEntryCount:w.sourceEntryCount,riskSkips:w.riskSkips,overlapSkips:w.overlapSkips,
      exposureHours:(w.avgHoldHours??0)*w.count,aboveCDI:w.pnlBRL>w.cdi.pnlBRL}))};
  });
  const reference=controlSummary.cost_gate.meanMonthlyBRL;
  const comparison=compareRandom(replicates.map(r=>r.meanMonthlyBRL),reference);
  const monthly=parts.map(m=>{
    const spec=p.months.find(s=>s.month===m.month),values=m.replicates.map(r=>r.wallet.pnlBRL);
    return{month:m.month,signals:spec.signals,accepted:spec.accepted,
      ...compareRandom(values,m.controls.cost_gate.pnlBRL),
      controlBRL:m.controls.control.pnlBRL,cdiBRL:m.controls.control.cdi.pnlBRL,
      uniqueSubsets:new Set(m.replicates.map(r=>r.acceptedIDs.slice().sort().join('|'))).size};
  });
  const diagnostics=Object.fromEntries(['trades','exposureHours','feesBRL','meanDD'].map(k=>{
    const v=replicates.map(r=>r[k]);return[k,{min:quantile(v,0),median:quantile(v,.5),max:quantile(v,1),gate:controlSummary.cost_gate[k]}];
  }));
  verify();
  const result={app:'trend-lab-entry-random',protocol:p,registrationSHA256,startedAt,completedAt:Date.now(),
    parityWallets:parts.length*2,randomWallets:parts.length*p.seeds.length,
    uniqueWalletSimulations:parts.reduce((n,m)=>n+m.uniqueSimulations,0),
    controlSummary,comparison,monthly,diagnostics,replicates,meanCDIBRL:mean(controls.control.map(w=>w.cdi.pnlBRL)),
    cashBRL:0,approved:false,independentValidation:false,noNewTraining:true,realOrders:false,
    partHashes:Object.fromEntries(p.months.map(m=>[m.month,hash(base+'/months/'+m.month+'.json')]))};
  fs.writeFileSync(base+'/result.json',JSON.stringify(result),{flag:'wx',mode:0o444});
  atomic(ROOT+'/web/data/entry-random.json',result);status('complete');
  console.log(JSON.stringify({complete:true,comparison,diagnostics}));
}catch(e){for(const child of children)child.kill('SIGTERM');status('error',e.message);throw e;}
