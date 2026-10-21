import fs from 'node:fs';import assert from 'node:assert/strict';
import {ROOT,read,hash} from './multiasset-io.mjs';import {STUDY} from './minute-protection-core.mjs';
const parent='work/pepe-protection-gate-v1',prior=read(parent+'/registration.json'),old=read(parent+'/protocol.json'),out=ROOT+'/'+STUDY;
if(fs.existsSync(out+'/registration.json'))throw Error('Already registered');
const inputs={...prior.inputs,...prior.sourceHashes};for(const[f,h]of Object.entries(inputs))assert.equal(hash(f),h,f);
for(const f of['protocol.json','registration.json','result.json'])inputs[parent+'/'+f]=hash(parent+'/'+f);
for(const m of old.months)inputs[parent+'/pairs/'+m.month+'.json']=hash(parent+'/pairs/'+m.month+'.json');
inputs['work/pepe-exits-v1/rates.json']=hash('work/pepe-exits-v1/rates.json');
const p={version:'pepe-minute-protection-v1',registeredAt:Date.now(),parent,signalsParent:old.parent,months:old.months,engine:{...old.engine,protectionGate:'current'},arms:['current','minute'],
 hypothesis:'Does checking the unchanged 0.25 price-riskR lock each closed minute preserve net gains compared with five-minute activation? A one-minute positive peak is not an executable oracle exit and does not establish entry skill.',
 intervention:'Only additional lock-activation decisions at closed-minute boundaries between original five-minute decisions. Same exitMask lock condition and action6. No partial or discretionary-close decisions added. Original five-minute entry/ladder/lock controller retained; active initial and raised stops are already checked every minute in BOTH arms.',
 execution:'Read only account state from completed candle. Request applies at next candle opening, with unchanged opening stop/liquidation priority, adverse slippage, fees, ticks, funding and zero-volume checks. No high/low or future price used to select a decision. No hindsight peak-price execution.',
 unchanged:'Signals, weights, calibration, threshold, stop1.5ATR, lock0.25 priceR, original margin ladder10/20/40% with25/50/25 quantity,15x,risk1%,daily3%/global10%,monthly boundary, no holding time cap. No retraining or new tuning.',
 paired:'All23,408 previously recorded opportunities, both sides and eight months. Same isolated initialR$1000 and paired fill identity. RiskR denominatorR$10. Include unfilled0; report by side/month, wins lost and losses recovered. Overlapping opportunities cannot be summed as portfolio PNL.',
 wallets:'64 monthly continuous wallets: four frozen proposal lists x two arms x eight months. Own balance, quantity, overlap and risk skips after intervention; monthly resets do not compound. Include cash months, both PPO seeds and same-calendar gross CDI.',
 parity:'All23,408 controls must reproduce previous full opportunity outcome fields and all32 current monthly wallet ledgers exactly, despite one-minute streaming. Ancestor hashes verified before/after. Only non-five-minute lock actions may be added.',
 limitation:'All eight calendars have already been examined. Exploratory only, with no independent validation, automatic promotion or real orders. Four genetic buys motivated hypothesis; broader opportunity and source reporting prevents selecting only those four.',
 train:false,realOrders:false,automaticPromotion:false,independentValidation:false};
fs.mkdirSync(out+'/pairs',{recursive:true});fs.writeFileSync(out+'/protocol.json',JSON.stringify(p,null,2),{flag:'wx',mode:0o444});
const files=['scripts/minute-protection-core.mjs','scripts/prepare-minute-protection.mjs','scripts/run-minute-protection.mjs','tests/minute-protection.test.mjs'];
fs.writeFileSync(out+'/registration.json',JSON.stringify({registeredAt:Date.now(),protocolSHA256:hash(out+'/protocol.json'),inputs,sourceHashes:Object.fromEntries(files.map(f=>[f,hash(f)]))},null,2),{flag:'wx',mode:0o444});
console.log(JSON.stringify({registered:true,study:STUDY}));
