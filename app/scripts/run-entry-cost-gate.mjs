import fs from 'node:fs';
import {ROOT, read, hash, atomic} from './multiasset-io.mjs';
import {Market} from './exit-lab-core.mjs';
import {ExitWallet} from './exit-lab-wallet.mjs';
import {simpleAction, mean, median} from './entry-audit-core.mjs';
import {cdiReference} from './cdi-reference-core.mjs';
import {COST_GATE_RUN, partitionSignals} from './entry-cost-gate-core.mjs';

const base=ROOT+'/'+COST_GATE_RUN, protocol=read(base+'/protocol.json');
const registration=read(base+'/registration.json'), origin=protocol.origin;
if(fs.existsSync(base+'/result.json')) throw Error('Results already frozen');
function verify(){
  if(hash(base+'/protocol.json')!==registration.protocolSHA256) throw Error('Protocol changed');
  for(const[f,h]of Object.entries({...registration.inputHashes,...registration.sourceHashes}))
    if(hash(ROOT+'/'+f)!==h) throw Error('Registered input changed: '+f);
}
verify();
const p=read(origin+'/protocol.json'), index=read(origin+'/dataset-index.json');
const prior=read('work/pepe-entry-audit-v1/result.json'), market=new Market();
const rates=read(origin+'/rates.json'), paths=[...new Set(index.entries.map(e=>e.path))];
const arms={control:[],cost_gate:[]}, decisions=[], startedAt=Date.now();let parity=0;
try{
  for(const path of paths){
    const packet=read(path), partition=partitionSignals(packet,market,p,protocol.multiple);
    decisions.push(...partition.decisions);
    const cdi=cdiReference(rates,packet.month.start,packet.month.end,p.capitalBRL);
    if(!cdi.comparable) throw Error('Missing CDI coverage');
    for(const arm of protocol.arms){
      const selected=arm==='control'?packet:partition.filtered, wallet=new ExitWallet(p,market);
      let r=wallet.resetWallet(selected,true);
      while(!r.done) r=wallet.step(simpleAction(protocol.exitRule,wallet));
      const result={...r.summary,cdi,totalSourceSignals:packet.entries.length,
        gateRejected:packet.entries.length-selected.entries.length};
      if(Math.abs(result.grossBRL-result.feesBRL+result.fundingBRL-result.pnlBRL)>1e-6)
        throw Error('Wallet accounting mismatch');
      if(arm==='control'){
        const old=prior.rules.ladder_lock.wallets.find(w=>w.month===result.month);
        if(!old||Math.abs(old.pnlBRL-result.pnlBRL)>1e-6||old.count!==result.count
          ||JSON.stringify(old.curve)!==JSON.stringify(result.curve)) throw Error('Control parity failed');
        parity++;
      }
      arms[arm].push(result);
    }
    atomic(base+'/status.json',{phase:'running',completed:parity,total:15,month:packet.month.month,updatedAt:Date.now(),realOrders:false});
    console.log(JSON.stringify({month:packet.month.month,signals:packet.entries.length,accepted:partition.filtered.entries.length,completed:parity}));
  }
  if(parity!==15||decisions.length!==320) throw Error('Incomplete calendar');
  const summary={};
  for(const split of['train','development']){
    const all=decisions.filter(d=>d.split===split), rows=arms.control.filter(w=>w.split===split).map(c=>{
      const g=arms.cost_gate.find(w=>w.month===c.month);return{month:c.month,controlBRL:c.pnlBRL,
        gateBRL:g.pnlBRL,deltaBRL:g.pnlBRL-c.pnlBRL,cdiBRL:c.cdi.pnlBRL,signals:c.totalSourceSignals,
        accepted:g.sourceEntryCount,controlTrades:c.count,gateTrades:g.count};
    });
    summary[split]={signals:all.length,accepted:all.filter(d=>d.allowed).length,
      rejected:all.filter(d=>!d.allowed).length,months:rows.length,rows,
      meanPairedDeltaBRL:mean(rows.map(w=>w.deltaBRL)),medianPairedDeltaBRL:median(rows.map(w=>w.deltaBRL)),
      arms:Object.fromEntries(protocol.arms.map(arm=>{
        const w=arms[arm].filter(w=>w.split===split);return[arm,{
          meanMonthlyBRL:mean(w.map(w=>w.pnlBRL)),medianMonthlyBRL:median(w.map(w=>w.pnlBRL)),
          meanDD:mean(w.map(w=>w.maxDD)),aboveCDI:w.filter(w=>w.pnlBRL>w.cdi.pnlBRL).length,
          losingMonths:w.filter(w=>w.pnlBRL<0).length,zeroTradeMonths:w.filter(w=>w.count===0).length,
          trades:w.reduce((s,w)=>s+w.count,0),feesBRL:w.reduce((s,w)=>s+w.feesBRL,0),
          grossBRL:w.reduce((s,w)=>s+w.grossBRL,0),fundingBRL:w.reduce((s,w)=>s+w.fundingBRL,0),
          gateRejected:w.reduce((s,w)=>s+w.gateRejected,0),riskSkips:w.reduce((s,w)=>s+w.riskSkips,0),
          overlapSkips:w.reduce((s,w)=>s+w.overlapSkips,0)}];
      })),meanCDIBRL:mean(rows.map(w=>w.cdiBRL))};
  }
  const d=summary.development,g=d.arms.cost_gate,a=protocol.advancement;
  const criteria={meanMonthlyPositive:g.meanMonthlyBRL>0,meanPairedDeltaPositive:d.meanPairedDeltaBRL>0,
    medianPairedDeltaPositive:d.medianPairedDeltaBRL>0,
    sufficientCDIMonths:g.aboveCDI>=a.minimumCDIBeatingDevelopmentMonths,
    sufficientTrades:g.trades>=a.minimumDevelopmentTrades};
  verify();
  const result={app:'trend-lab-entry-cost-gate',protocol,startedAt,completedAt:Date.now(),
    registrationSHA256:hash(base+'/registration.json'),controlParityWallets:parity,
    decisions,arms,summary,criteria,mayRegisterProspective:Object.values(criteria).every(Boolean),
    approved:false,automaticPromotion:false,noNewTraining:true,independentValidation:false,realOrders:false};
  fs.writeFileSync(base+'/result.json',JSON.stringify(result),{flag:'wx',mode:0o444});
  atomic(ROOT+'/web/data/entry-cost-gate.json',result);
  atomic(base+'/status.json',{phase:'complete',completed:15,total:15,completedAt:result.completedAt,realOrders:false});
  console.log(JSON.stringify({completed:true,development:d,criteria}));
}catch(e){atomic(base+'/status.json',{phase:'error',completed:parity,error:e.message,updatedAt:Date.now(),realOrders:false});throw e;}
