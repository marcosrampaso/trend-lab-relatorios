import fs from 'node:fs';
import {ROOT,read,hash,atomic} from './multiasset-io.mjs';
import {Market} from './exit-lab-core.mjs';
import {ExitWallet} from './exit-lab-wallet.mjs';
import {simpleAction,mean} from './entry-audit-core.mjs';
import {cdiReference} from './cdi-reference-core.mjs';
import {SPECIALISTS,entryChoice} from './specialist-core.mjs';
const base=ROOT+'/'+SPECIALISTS,p=read(base+'/protocol.json'),market=new Market();
if(fs.existsSync(base+'/result.json'))throw Error('Specialist results already frozen');
const rates=read(p.origin+'/rates.json'),systems=['genetic-151','ppo-101','ppo-202'],results={};
for(const system of systems){
  const [family,seed]=system.split('-'),forecasts=Object.fromEntries([1,-1].map(side=>{
    const folder=base+'/models/'+family+'-'+side+'-'+seed,manifest=read(folder+'/complete.json');
    for(const[f,h]of Object.entries(manifest.artifacts))if(hash(ROOT+'/'+f)!==h)throw Error('Changed expert artifact');
    return[side,new Map(read(folder+'/predictions.json').predictions.map(r=>[r.at,r.eligible?r.netR:0]))];
  }));
  for(const mode of['long','short','combined']){
    const key=system+'-'+mode,wallets=[];
    for(const m of p.months.filter(m=>m.split==='evaluation')){
      const packet=read(base+'/labels/'+m.month+'.json'),entries=[];
      for(const f of packet.rows){
        const long=forecasts[1].get(f.at),short=forecasts[-1].get(f.at);
        const side=entryChoice(long,short,mode,p.minimumExpectedNetR);
        if(side)entries.push({atr:f.atr,trade:{entryAt:f.at,side,leverage:p.engine.leverage}});
      }
      const wallet=new ExitWallet(p.engine,market);let r=wallet.resetWallet({month:m,entries},true);
      while(!r.done)r=wallet.step(simpleAction('ladder_lock',wallet));
      const summary=r.summary,cdi=cdiReference(rates,m.start,m.end,p.engine.capitalBRL);
      if(!cdi.comparable||Math.abs(summary.grossBRL-summary.feesBRL+summary.fundingBRL-summary.pnlBRL)>1e-6)
        throw Error('Specialist wallet/CDI reconciliation');
      wallets.push({...summary,cdi});
      atomic(base+'/evaluation-status.json',{phase:'evaluating',system,mode,month:m.month});
    }
    results[key]={system,mode,wallets,meanMonthlyBRL:mean(wallets.map(w=>w.pnlBRL)),
      aboveCDI:wallets.filter(w=>w.pnlBRL>w.cdi.pnlBRL).length,
      losingMonths:wallets.filter(w=>w.pnlBRL<0).length,zeroTradeMonths:wallets.filter(w=>w.count===0).length,
      count:wallets.reduce((s,w)=>s+w.count,0),meanDD:mean(wallets.map(w=>w.maxDD))};
  }
}
const ppoMean=Object.fromEntries(['long','short','combined'].map(mode=>[mode,
  mean([101,202].map(seed=>results['ppo-'+seed+'-'+mode].meanMonthlyBRL))]));
const result={app:'trend-lab-specialists',protocol:p,completedAt:Date.now(),results,ppoMean,
  modelManifest:Object.fromEntries(p.jobs.map(j=>[j.key,read(base+'/models/'+j.key+'/complete.json')])),
  datasetRegistration:read(base+'/dataset-registration.json'),approved:false,realOrders:false,
  independentValidation:false,notOriginalFinRLEnvironment:true};
fs.writeFileSync(base+'/result.json',JSON.stringify(result),{flag:'wx',mode:0o444});
atomic(ROOT+'/web/data/specialists.json',result);
console.log(JSON.stringify({complete:true,ppoMean,results:Object.fromEntries(Object.entries(results).map(([k,v])=>[k,{meanMonthlyBRL:v.meanMonthlyBRL,count:v.count}]))}));
