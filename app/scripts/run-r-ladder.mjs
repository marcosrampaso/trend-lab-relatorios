import fs from'node:fs';import assert from'node:assert/strict';import{execFileSync}from'node:child_process';
import{ROOT,read,hash,atomic}from'./multiasset-io.mjs';import{Market}from'./exit-lab-core.mjs';import{candleFeatures,entryChoice}from'./specialist-core.mjs';
import{cdiReference}from'./cdi-reference-core.mjs';import{STUDY,armProtocol,pairedPosition,monthlyWallet,summarizePairs,mean}from'./r-ladder-core.mjs';
const base=ROOT+'/'+STUDY,p=read(base+'/protocol.json'),reg=read(base+'/registration.json'),market=new Market(),inputs={...reg.inputs,...reg.sourceHashes};
function verify(){assert.equal(hash(base+'/protocol.json'),reg.protocolSHA256);for(const[f,h]of Object.entries(inputs))assert.equal(hash(f),h,f);}
verify();if(fs.existsSync(base+'/result.json'))throw Error('R ladder already completed');
const status=value=>{const s={...value,updatedAt:Date.now(),train:false,realOrders:false};atomic(base+'/status.json',s);atomic(ROOT+'/web/data/r-ladder-status.json',s);};
const grids={};
for(const m of p.months){const file=base+'/grids/'+m.month+'.json';
 if(!fs.existsSync(file)){let rows;if(m.stage==='pairedDiagnostic')rows=read(p.origin+'/labels/'+m.month+'.json').rows.map(r=>({...r,knownAt:r.at}));
  else{const raw=market.packet(m.start);rows=raw.features.filter(r=>r.at>=m.start+300000&&r.at<m.end&&r.at%(p.candidateMinutes*60000)===0).map(r=>{const i=(r.at-raw.start)/60000,f=candleFeatures(r,raw.candles.slice(i-5,i));return{at:f.at,knownAt:f.at,x:f.x,atr:f.atr,close:f.close};});}
  fs.writeFileSync(file,JSON.stringify({month:m.month,rows,registrationSHA256:hash(base+'/registration.json')}),{flag:'wx',mode:0o444});
 }
 const grid=read(file);assert.equal(grid.registrationSHA256,hash(base+'/registration.json'));grids[m.month]=grid.rows;
}
status({phase:'frozenInference'});
const ready=p.jobs.every(j=>fs.existsSync(base+'/predictions/'+j.key+'.json'));
if(!ready)console.log(execFileSync(ROOT+'/.venv-rl/bin/python',[ROOT+'/scripts/r-ladder-inference.py'],{cwd:ROOT,encoding:'utf8',timeout:120000}));
const predictions=Object.fromEntries(p.jobs.map(j=>[j.key,new Map(read(base+'/predictions/'+j.key+'.json').predictions.map(r=>[r.at,r]))]));
const entrySets={};
for(const key of ['genetic-151','ppo-101','ppo-202','aligned_trend']){entrySets[key]={};for(const m of p.months){
 const[family,seed]=key.split('-');entrySets[key][m.month]=grids[m.month].flatMap(f=>{let side=0;
  if(key==='aligned_trend')side=f.x[7]===f.x[8]?f.x[7]:0;
  else{const l=predictions[family+'-1-'+seed].get(f.at),s=predictions[family+'--1-'+seed].get(f.at);side=entryChoice(l.eligible?l.netR:0,s.eligible?s.netR:0,'combined',p.threshold);}
  return side?[{atr:f.atr,trade:{entryAt:f.at,side,leverage:p.engine.leverage}}]:[];
 });
}}
const signalFile=base+'/signals.json';if(!fs.existsSync(signalFile))fs.writeFileSync(signalFile,JSON.stringify(entrySets),{flag:'wx',mode:0o444});else assert.deepEqual(read(signalFile),entrySets);
const signalsSHA=hash(signalFile),outputHashes={},all=[];let completed=0,parity=0,total=Object.values(grids).reduce((s,g)=>s+g.length*2,0);
for(const m of p.months){const file=base+'/pairs/'+m.month+'.json';if(fs.existsSync(file)){const v=read(file);assert.equal(v.signalsSHA256,signalsSHA);all.push(...v.rows);completed+=v.rows.length;parity+=v.oldParity;outputHashes['pairs/'+m.month+'.json']=hash(file);continue;}
 const contexts=market.contexts(m.start,m.end),old=m.stage==='pairedDiagnostic'?new Map(read('work/pepe-opportunity-v1/months/'+m.month+'.json').rows.map(r=>[r.at+':'+r.side,r])):null,rows=[];let oldParity=0;
 for(const f of grids[m.month])for(const side of[1,-1]){const pair=pairedPosition(f,side,m.end,p.engine,market,contexts);
  if(old){const reference=old.get(f.at+':'+side);for(const k of['netR','netBRL','exitAt','reason','filled','boundary','feesBRL','fundingBRL','grossBRL','slippageBRL'])assert.deepEqual(pair.margin[k],reference[k],k+' '+m.month+' '+f.at);oldParity++;parity++;}
  rows.push({...pair,month:m.month,stage:m.stage});completed++;
  if(rows.length%400===0){status({phase:'pairedExits',month:m.month,completed,total,parity});console.log(m.month,rows.length);}
 }
 fs.writeFileSync(file,JSON.stringify({month:m.month,rows,oldParity,signalsSHA256:signalsSHA}),{flag:'wx',mode:0o444});outputHashes['pairs/'+m.month+'.json']=hash(file);all.push(...rows);
}
const source=read(p.origin+'/result.json'),opportunity=read('work/pepe-opportunity-v1/result.json'),rates=read('work/pepe-exits-v1/rates.json'),wallets={};let walletParity=0;
for(const [key,months]of Object.entries(entrySets)){wallets[key]={};for(const arm of p.arms){const pp=armProtocol(p.engine,arm),values=[];
 for(const m of p.months){const r=monthlyWallet(m,months[m.month],pp,market),cdi=cdiReference(rates,m.start,m.end,p.engine.capitalBRL);assert.ok(cdi.comparable);
  if(arm==='margin'&&m.stage==='pairedDiagnostic'){const old=key==='aligned_trend'?opportunity.controls.aligned_trend.wallets.find(w=>w.month===m.month):source.results[key+'-combined'].wallets.find(w=>w.month===m.month);
   for(const[k,v]of Object.entries(r))if(!['stage','realOrders'].includes(k))assert.deepEqual(v,old[k],key+' '+m.month+' '+k);walletParity++;
  }
  values.push({...r,cdi});status({phase:'wallets',key,arm,month:m.month,completed,total,parity,walletParity});
 }
 wallets[key][arm]={wallets:values,stages:Object.fromEntries(['pairedDiagnostic','temporalReplay'].map(stage=>{const rows=values.filter(w=>w.stage===stage);return[stage,{months:rows.length,count:rows.reduce((s,w)=>s+w.count,0),meanMonthlyBRL:mean(rows.map(w=>w.pnlBRL)),aboveCDI:rows.filter(w=>w.pnlBRL>w.cdi.pnlBRL).length,haltedMonths:rows.filter(w=>w.halted).length}];}))};
}}
const stages=Object.fromEntries(['pairedDiagnostic','temporalReplay'].map(stage=>[stage,{sides:Object.fromEntries([1,-1].map(side=>[side,summarizePairs(all.filter(r=>r.stage===stage&&r.side===side))])),
 months:p.months.filter(m=>m.stage===stage).map(m=>({month:m.month,sides:Object.fromEntries([1,-1].map(side=>[side,summarizePairs(all.filter(r=>r.month===m.month&&r.side===side))]))}))}]));
const modelPairs={};for(const key of Object.keys(entrySets)){const allowed=new Set(Object.values(entrySets[key]).flat().map(e=>e.trade.entryAt+':'+e.trade.side));modelPairs[key]=Object.fromEntries(['pairedDiagnostic','temporalReplay'].map(stage=>[stage,summarizePairs(all.filter(r=>r.stage===stage&&allowed.has(r.at+':'+r.side)))]));}
verify();assert.equal(hash(signalFile),signalsSHA);
const result={version:p.version,completedAt:Date.now(),protocol:p,totalPairs:all.length,parity,walletParity,stages,wallets,modelPairs,
 integrity:{unchangedInputs:Object.keys(inputs).length,passed:true,signalsSHA256:signalsSHA,pairHashes:outputHashes},train:false,realOrders:false,independentValidation:false,automaticPromotion:false};
fs.writeFileSync(base+'/result.json',JSON.stringify(result),{flag:'wx',mode:0o444});atomic(ROOT+'/web/data/r-ladder.json',result);status({phase:'complete',completed,total,parity,walletParity});
console.log(JSON.stringify({complete:true,total,parity,walletParity,stages}));
