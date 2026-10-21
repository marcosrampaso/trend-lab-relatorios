import fs from 'node:fs';import assert from 'node:assert/strict';
import {ROOT,read,hash,atomic} from './multiasset-io.mjs';import {cdiReference} from './cdi-reference-core.mjs';
import {singlePosition,monthlyWallet} from './protection-gate-core.mjs';
import {STUDY,MinuteProtectionMarket,summarize,mean} from './minute-protection-core.mjs';
const base=ROOT+'/'+STUDY,p=read(base+'/protocol.json'),reg=read(base+'/registration.json'),inputs={...reg.inputs,...reg.sourceHashes};
const verify=()=>{assert.equal(hash(base+'/protocol.json'),reg.protocolSHA256);for(const[f,h]of Object.entries(inputs))assert.equal(hash(f),h,f);};
verify();if(fs.existsSync(base+'/result.json'))throw Error('Already completed');
const old=read(p.parent+'/result.json'),signals=read(p.signalsParent+'/signals.json'),control=new MinuteProtectionMarket(p.engine),treatment=new MinuteProtectionMarket(p.engine,true),all=[],pairHashes={};let parity=0,walletParity=0;
const status=v=>{const s={...v,updatedAt:Date.now(),realOrders:false,train:false};atomic(base+'/status.json',s);atomic(ROOT+'/web/data/minute-protection-status.json',s);};
for(const m of p.months){
 const file=base+'/pairs/'+m.month+'.json';
 if(fs.existsSync(file)){const packet=read(file);assert.equal(packet.registrationSHA256,hash(base+'/registration.json'));all.push(...packet.rows);parity+=packet.rows.length;pairHashes[m.month]=hash(file);continue;}
 const parentRows=read(p.parent+'/pairs/'+m.month+'.json').rows,grid=new Map(read(p.signalsParent+'/grids/'+m.month+'.json').rows.map(r=>[r.at,r])),contexts=control.contexts(m.start,m.end),rows=[];
 for(const row of parentRows){const f=grid.get(row.at),a=singlePosition(f,row.side,m.end,p.engine,control,contexts),b=singlePosition(f,row.side,m.end,p.engine,treatment,contexts);
  assert.deepEqual(a,row.current,'Full opportunity control parity');assert.deepEqual(a.identity,b.identity,'Paired entry identity');
  rows.push({at:row.at,side:row.side,month:m.month,stage:m.stage,current:a,minute:b,deltaR:b.netR-a.netR,deltaBRL:b.netBRL-a.netBRL});parity++;
  if(rows.length%400===0){status({phase:'pairs',month:m.month,completed:parity,total:old.totalPairs});console.log(m.month,rows.length);}
 }
 fs.writeFileSync(file,JSON.stringify({month:m.month,registrationSHA256:hash(base+'/registration.json'),rows}),{flag:'wx',mode:0o444});pairHashes[m.month]=hash(file);all.push(...rows);
}
const rates=read('work/pepe-exits-v1/rates.json'),wallets={};
for(const[key,months]of Object.entries(signals)){wallets[key]={};for(const arm of p.arms){const values=[];for(const m of p.months){
 const w=monthlyWallet(m,months[m.month],p.engine,arm==='current'?control:treatment),cdi=cdiReference(rates,m.start,m.end,p.engine.capitalBRL);assert.ok(cdi.comparable);
 if(arm==='current'){const expected=old.wallets[key].current.wallets.find(v=>v.month===m.month);for(const[k,v]of Object.entries(w))assert.deepEqual(v,expected[k],'Monthly wallet parity '+key+' '+m.month+' '+k);walletParity++;}
 values.push({...w,cdi});status({phase:'wallets',key,arm,month:m.month,completed:parity,total:old.totalPairs,walletParity});
 }wallets[key][arm]={wallets:values,stages:Object.fromEntries(['pairedDiagnostic','temporalReplay'].map(stage=>{const a=values.filter(w=>w.stage===stage);return[stage,{months:a.length,count:a.reduce((n,w)=>n+w.count,0),meanMonthlyBRL:mean(a.map(w=>w.pnlBRL)),aboveCDI:a.filter(w=>w.pnlBRL>w.cdi.pnlBRL).length}];}))};}}
const stages=Object.fromEntries(['pairedDiagnostic','temporalReplay'].map(stage=>[stage,{sides:Object.fromEntries([1,-1].map(side=>[side,summarize(all.filter(r=>r.stage===stage&&r.side===side))])),months:p.months.filter(m=>m.stage===stage).map(m=>({month:m.month,sides:Object.fromEntries([1,-1].map(side=>[side,summarize(all.filter(r=>r.month===m.month&&r.side===side))]))}))}]));
const examples=[];for(const[key,months]of Object.entries(signals))if(key!=='aligned_trend'){const selected=new Set(Object.values(months).flat().map(e=>e.trade.entryAt+':'+e.trade.side));examples.push(...all.filter(r=>selected.has(r.at+':'+r.side)).map(r=>({key,...r})));}
verify();const result={version:p.version,completedAt:Date.now(),protocol:p,totalPairs:all.length,parity,walletParity,stages,wallets,examples,integrity:{passed:true,unchangedInputs:Object.keys(inputs).length,pairHashes},train:false,realOrders:false,automaticPromotion:false,independentValidation:false};
fs.writeFileSync(base+'/result.json',JSON.stringify(result),{flag:'wx',mode:0o444});atomic(ROOT+'/web/data/minute-protection.json',result);status({phase:'complete',completed:parity,total:old.totalPairs,walletParity});
console.log(JSON.stringify({complete:true,parity,walletParity,stages}));
