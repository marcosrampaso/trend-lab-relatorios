import fs from 'node:fs';
import {ROOT,read,hash} from './multiasset-io.mjs';
import {Market} from './exit-lab-core.mjs';
import {ExitWallet} from './exit-lab-wallet.mjs';
import {simpleAction} from './entry-audit-core.mjs';
import {RANDOM_RUN,randomSubset} from './entry-random-core.mjs';
const base=ROOT+'/'+RANDOM_RUN,protocol=read(base+'/protocol.json'),month=protocol.months.find(m=>m.month===process.argv[2]);
if(!month)throw Error('Unregistered month');
const out=base+'/months/'+month.month+'.json',registrationSHA256=hash(base+'/registration.json');
if(fs.existsSync(out))throw Error('Month already frozen');
const reg=read(base+'/registration.json');
if(hash(base+'/protocol.json')!==reg.protocolSHA256)throw Error('Changed protocol');
for(const[f,h]of Object.entries(reg.sourceHashes))if(hash(ROOT+'/'+f)!==h)throw Error('Changed source');
if(hash(ROOT+'/'+month.sourcePath)!==reg.inputHashes[month.sourcePath])throw Error('Changed source packet');
const packet=read(month.sourcePath),prior=read(protocol.source+'/result.json');
const p=read(protocol.origin+'/protocol.json'),market=new Market();
const gateIDs=new Set(prior.decisions.filter(d=>d.month===month.month&&d.allowed).map(d=>d.id));
if(packet.entries.length!==month.signals||gateIDs.size!==month.accepted)throw Error('Wrong matched counts');
const cdi=prior.arms.control.find(w=>w.month===month.month).cdi;
let uniqueSimulations=0;
function simulate(entries){
  uniqueSimulations++;
  const wallet=new ExitWallet(p,market);let r=wallet.resetWallet({...packet,entries},true);
  while(!r.done)r=wallet.step(simpleAction('ladder_lock',wallet));
  const w={...r.summary,cdi};
  if(Math.abs(w.grossBRL-w.feesBRL+w.fundingBRL-w.pnlBRL)>1e-6)throw Error('Wallet accounting');
  return w;
}
const controls={};
for(const arm of['control','cost_gate']){
  const w=simulate(packet.entries.filter(e=>arm==='control'||gateIDs.has(e.id)));
  const old=prior.arms[arm].find(w=>w.month===month.month);
  if(Math.abs(w.pnlBRL-old.pnlBRL)>1e-6||w.count!==old.count||JSON.stringify(w.curve)!==JSON.stringify(old.curve))
    throw Error('Prior wallet parity failed');
  controls[arm]=w;
}
const replicates=[],cache=new Map();
const subsetKey=entries=>entries.map(e=>e.id).sort().join('|');
cache.set(subsetKey(packet.entries.filter(e=>gateIDs.has(e.id))),controls.cost_gate);
cache.set(subsetKey(packet.entries),controls.control);
for(const seed of protocol.seeds){
  const selected=randomSubset(packet.entries,month.accepted,seed,month.month),key=subsetKey(selected);
  if(!cache.has(key))cache.set(key,simulate(selected));
  const w=cache.get(key);
  if(selected.length!==month.accepted||w.sourceEntryCount!==month.accepted)throw Error('Unmatched signal count');
  replicates.push({seed,acceptedIDs:selected.map(e=>e.id),wallet:w});
  if(replicates.length%20===0)console.log(JSON.stringify({month:month.month,completed:replicates.length}));
}
const result={month:month.month,registrationSHA256,sourceSHA256:hash(ROOT+'/'+month.sourcePath),
  controls,replicates,uniqueSimulations,completedAt:Date.now(),realOrders:false};
fs.writeFileSync(out,JSON.stringify(result),{flag:'wx',mode:0o444});
console.log(JSON.stringify({month:month.month,completed:replicates.length,frozen:true}));
