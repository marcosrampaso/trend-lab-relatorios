import fs from'node:fs';import assert from'node:assert/strict';import{ROOT,read,hash,atomic}from'./multiasset-io.mjs';import{Market}from'./exit-lab-core.mjs';import{cdiReference}from'./cdi-reference-core.mjs';
import{STUDY,armProtocol,pairedPosition,monthlyWallet,summarizePairs,mean}from'./protection-gate-core.mjs';
const base=ROOT+'/'+STUDY,p=read(base+'/protocol.json'),reg=read(base+'/registration.json'),inputs={...reg.inputs,...reg.sourceHashes};
function verify(){assert.equal(hash(base+'/protocol.json'),reg.protocolSHA256);for(const[f,h]of Object.entries(inputs))assert.equal(hash(f),h,f);}
verify();if(fs.existsSync(base+'/result.json'))throw Error('Protection study already completed');const market=new Market(),signals=read(p.parent+'/signals.json'),previous=read(p.parent+'/result.json');
const status=value=>{const v={...value,updatedAt:Date.now(),train:false,realOrders:false};atomic(base+'/status.json',v);atomic(ROOT+'/web/data/protection-gate-status.json',v);};
const total=previous.totalPairs,all=[],pairHashes={};let parity=0,completed=0,walletParity=0;
for(const m of p.months){const file=base+'/pairs/'+m.month+'.json',grid=read(p.parent+'/grids/'+m.month+'.json').rows;
 if(fs.existsSync(file)){const packet=read(file);assert.equal(packet.registrationSHA256,hash(base+'/registration.json'));all.push(...packet.rows);completed+=packet.rows.length;parity+=packet.rows.length;pairHashes[m.month]=hash(file);continue;}
 const parentRows=new Map(read(p.parent+'/pairs/'+m.month+'.json').rows.map(r=>[r.at+':'+r.side,r.margin])),contexts=market.contexts(m.start,m.end),rows=[];
 for(const f of grid)for(const side of[1,-1]){
  const pair=pairedPosition(f,side,m.end,p.engine,market,contexts),old=parentRows.get(f.at+':'+side);for(const[k,v]of Object.entries(old))assert.deepEqual(pair.current[k],v,'Current outcome parity '+k+' '+m.month);
  rows.push({...pair,month:m.month,stage:m.stage});parity++;completed++;
  if(rows.length%400===0){status({phase:'pairedProtection',month:m.month,completed,total,parity});console.log(m.month,rows.length);}
 }
 fs.writeFileSync(file,JSON.stringify({month:m.month,rows,registrationSHA256:hash(base+'/registration.json')}),{flag:'wx',mode:0o444});pairHashes[m.month]=hash(file);all.push(...rows);
}
const rates=read('work/pepe-exits-v1/rates.json'),wallets={};
for(const [key,months]of Object.entries(signals)){wallets[key]={};for(const arm of p.arms){const values=[];for(const m of p.months){
 const w=monthlyWallet(m,months[m.month],armProtocol(p.engine,arm),market),cdi=cdiReference(rates,m.start,m.end,p.engine.capitalBRL);assert.ok(cdi.comparable);
 if(arm==='current'){const old=previous.wallets[key].margin.wallets.find(w=>w.month===m.month);for(const[k,v]of Object.entries(w))assert.deepEqual(v,old[k],'Wallet parity '+key+' '+m.month+' '+k);walletParity++;}
 values.push({...w,cdi});status({phase:'wallets',key,arm,month:m.month,completed,total,parity,walletParity});
 }wallets[key][arm]={wallets:values,stages:Object.fromEntries(['pairedDiagnostic','temporalReplay'].map(stage=>{const rows=values.filter(w=>w.stage===stage);return[stage,{months:rows.length,count:rows.reduce((s,w)=>s+w.count,0),meanMonthlyBRL:mean(rows.map(w=>w.pnlBRL)),aboveCDI:rows.filter(w=>w.pnlBRL>w.cdi.pnlBRL).length,haltedMonths:rows.filter(w=>w.halted).length}];}))};}}
const stages=Object.fromEntries(['pairedDiagnostic','temporalReplay'].map(stage=>[stage,{sides:Object.fromEntries([1,-1].map(side=>[side,summarizePairs(all.filter(r=>r.stage===stage&&r.side===side))])),
 months:p.months.filter(m=>m.stage===stage).map(m=>({month:m.month,sides:Object.fromEntries([1,-1].map(side=>[side,summarizePairs(all.filter(r=>r.month===m.month&&r.side===side))]))}))}]));
const selected={},examples=[];
for(const [key,months]of Object.entries(signals)){const allowed=new Set(Object.values(months).flat().map(e=>e.trade.entryAt+':'+e.trade.side)),subset=all.filter(r=>allowed.has(r.at+':'+r.side));
 selected[key]=Object.fromEntries(['pairedDiagnostic','temporalReplay'].map(stage=>[stage,summarizePairs(subset.filter(r=>r.stage===stage))]));if(key!=='aligned_trend')examples.push(...subset.map(r=>({key,...r})));}
verify();const result={version:p.version,completedAt:Date.now(),protocol:p,totalPairs:all.length,parity,walletParity,stages,wallets,selected,examples,
 integrity:{passed:true,unchangedInputs:Object.keys(inputs).length,pairHashes},train:false,realOrders:false,independentValidation:false,automaticPromotion:false};
fs.writeFileSync(base+'/result.json',JSON.stringify(result),{flag:'wx',mode:0o444});atomic(ROOT+'/web/data/protection-gate.json',result);status({phase:'complete',completed,total,parity,walletParity});
console.log(JSON.stringify({complete:true,total,parity,walletParity,stages}));
