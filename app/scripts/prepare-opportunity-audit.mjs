import fs from 'node:fs';import assert from 'node:assert/strict';
import{ROOT,read,hash}from'./multiasset-io.mjs';import{OPPORTUNITY}from'./specialist-opportunity-core.mjs';
const out=ROOT+'/'+OPPORTUNITY,origin='work/pepe-specialists-v1',old=read(origin+'/protocol.json');
if(fs.existsSync(out+'/registration.json'))throw Error('Already registered');
const reg=read(origin+'/registration.json'),inputs={...reg.inputHashes,...reg.sourceHashes};
for(const[f,h]of Object.entries(inputs))assert.equal(hash(f),h,f);
const add=f=>inputs[f]=hash(f);for(const f of[origin+'/registration.json',origin+'/protocol.json',origin+'/result.json',origin+'/dataset-registration.json'])add(f);
for(const[f,h]of Object.entries(read(origin+'/dataset-registration.json').files)){assert.equal(hash(f),h,f);add(f);}
for(const j of old.jobs){const base=origin+'/models/'+j.key;add(base+'/complete.json');for(const[f,h]of Object.entries(read(base+'/complete.json').artifacts)){assert.equal(hash(f),h,f);add(f);}}
const index=read('data/pepe-finrl-v1/features/index.json');add('data/pepe-finrl-v1/features/index.json');add('data/pepe-finrl-v1/exchange.json');
for(const m of index.months.filter(x=>old.months.some(y=>y.month===x.month))){assert.equal(hash(m.path),m.sha256);assert.equal(hash(m.rawPath),m.rawSHA256);add(m.path);add(m.rawPath);}
add(old.origin+'/rates.json');
const p={version:'pepe-opportunity-v1',registeredAt:Date.now(),origin,engine:old.engine,
 months:old.months.filter(m=>m.split==='evaluation'),jobs:old.jobs,threshold:old.minimumExpectedNetR,
 question:'Distinguish absence of profitable fixed-exit opportunities, infeasible execution, policy rejection and calibration veto. Diagnostic only, no model training, threshold optimization or automatic promotion.',
 opportunities:'Same fixed 30-minute grid and closed19 inputs as frozen specialists. Both sides evaluated independently with fresh R$1000 accounts and unchanged fixed ladder_lock exits, stress fees/slippage/ticks/funding/limits15x/risk1%. Counterfactual labels can overlap; means/rates are diagnostics, never compounded portfolio PNL.',
 knownFeasibility:'Static order-size, tick, stop and liquidation check at LAST KNOWN CLOSE, originalcapital. No next open, candle extrema or future outcomes enter this estimate. Report confusion against actual first-minute fill. Does not predict gaps, next-minute volume, mark intrabar path or changing wallet balance.',
 costAttribution:'Reference-price gross = modeled-fill gross + adverse slippage/ticks on same archived path. Net = reference gross - slippage - fees + funding. This is accounting attribution, NOT a zero-cost strategy rerun; costs affect the path and decisions.',
 groups:{trend:['aligned','opposed','mixed'],friction:['upTo025R','025to05R','above05R','unavailable'],volume:['below1','1to2','atLeast2']},
 grouping:'Predeclared one-dimensional buckets from closed features only. Report both directions, per-month results and support. No grid search, winner selection, interaction mining or IID significance claim. Friction buckets use price-risk R, not original risk-budget R of the label.',
 controls:['cash','all_long','all_short','aligned_trend'],
 controlsDefinition:'Same monthly actual continuous wallet and every30m grid. all_long buys,all_short sells; aligned_trend enters the common nonzero direction when closed1h and4h agree; cash holds. Same exits, overlap, cooldown, fees, leverage, daily/global stops. No feasibility gate applied to any strategy; diagnostic estimate not deployed. Report all fixed controls, not choose a winner.',
 calibration:'Read frozen scalers/models/calibrators only. No fitting. Reconstruct exact March maturity/embargo and compare raw score support, clipping and expected-netR bins<=0,(0,.1],(.1,.25],>.25. Compare calibrated prediction against counterfactual outcome by month. Unsupported small bins flagged (<50 March rows). No global calibration metric is a profitability claim.',
 boundaries:'Keep month-end settlements and report means with/without boundary outcomes. Five previously consumed months, not an independent holdout. No sum of opportunity PNL as investment return.',
 parity:'New diagnostic candidate wrapper must match frozen candidateOutcome exactly; deterministic30 cases checked against archived train/calibration labels. All registered inputs checked before/after.',
 realOrders:false,retrain:false,independentValidation:false,automaticPromotion:false};
fs.mkdirSync(out+'/months',{recursive:true});fs.writeFileSync(out+'/protocol.json',JSON.stringify(p,null,2),{flag:'wx',mode:0o444});
const sources=['scripts/specialist-opportunity-core.mjs','scripts/prepare-opportunity-audit.mjs','scripts/run-opportunity-audit.mjs','scripts/audit-specialist-calibration.py','tests/specialist-opportunity.test.mjs'];
fs.writeFileSync(out+'/registration.json',JSON.stringify({registeredAt:Date.now(),protocolSHA256:hash(out+'/protocol.json'),inputs,sourceHashes:Object.fromEntries(sources.map(f=>[f,hash(f)]))},null,2),{flag:'wx',mode:0o444});
console.log('Registered opportunity audit',p.months.map(m=>m.month));
