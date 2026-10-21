import{read,hash,atomic}from'./multiasset-io.mjs';import{RUN,Market,ExitEpisode}from'./exit-lab-core.mjs';import{ExitWallet}from'./exit-lab-wallet.mjs';import{cdiReference}from'./cdi-reference-core.mjs';import fs from'node:fs';
const p=read(RUN+'/protocol.json'),index=read(RUN+'/dataset-index.json'),market=new Market(),rates=read(RUN+'/rates.json'),reg=read(RUN+'/dataset-registration.json'),result={app:'trend-lab-exit-controls',startedAt:Date.now(),rules:{},notAPortfolio:true,realOrders:false};
const paths=[...new Set(index.entries.map(e=>e.path))];let completed=0;
for(const name of p.baselines){
 const positions=[],wallets=[];for(const path of paths){if(hash(path)!==reg.packetHashes[path])throw Error('Changed entry packet');const packet=read(path);
  for(const e of packet.entries){const episode=new ExitEpisode(p,market);let r=episode.reset(e,'liquidation',name.startsWith('ladder'));while(!r.done)r=episode.step(episode.scriptedAction(name));if(name==='wait'&&Math.abs(r.summary.deltaBRL)>1e-6)throw Error('Frozen entry parity failed: '+e.id+' delta='+r.summary.deltaBRL);positions.push(r.summary);}
  const wallet=new ExitWallet(p,market);let r=wallet.resetWallet(packet,name.startsWith('ladder'));while(!r.done)r=wallet.step(wallet.scriptedAction(name));const baseline=packet.sourceSummary;
  if(name==='wait'&&(Math.abs(r.summary.pnlBRL-baseline.pnlBRL)>1e-6||r.summary.count!==baseline.count))throw Error('Monthly source parity failed '+packet.month.month+' '+r.summary.pnlBRL+' vs '+baseline.pnlBRL);
  const cdi=cdiReference(rates,packet.month.start,packet.month.end,p.capitalBRL);if(!cdi.comparable)throw Error('Unverified CDI');wallets.push({...r.summary,cdi});
  atomic(RUN+'/controls-progress.json',{rule:name,completed:++completed,total:paths.length*p.baselines.length,updatedAt:Date.now()});
 }
 result.rules[name]={positions,wallets};atomic(RUN+'/controls-draft.json',result);
}
result.completedAt=Date.now();result.parityPassed=true;const file=RUN+'/controls.json';if(fs.existsSync(file))throw Error('Controls already frozen');fs.writeFileSync(file,JSON.stringify(result),{flag:'wx',mode:0o444});atomic('web/data/exit-controls.json',result);console.log(JSON.stringify({parityPassed:true,rules:Object.keys(result.rules),positions:result.rules.wait.positions.length}));
