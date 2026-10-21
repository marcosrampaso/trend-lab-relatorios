import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {ROOT,read,hash,atomic} from './multiasset-io.mjs';
import {SPECIALISTS} from './specialist-core.mjs';
const base=ROOT+'/'+SPECIALISTS;
if(fs.existsSync(base+'/registration.json'))throw Error('Specialist pilot already registered');
const prior=read('work/pepe-entry-random-v1/registration.json');
const inputHashes={...prior.inputHashes,...prior.sourceHashes};
for(const f of['work/pepe-entry-random-v1/result.json','work/pepe-entry-random-v1/registration.json',
  'work/pepe-entry-random-v1/protocol.json'])inputHashes[f]=hash(ROOT+'/'+f);
for(const[f,h]of Object.entries(inputHashes))if(hash(ROOT+'/'+f)!==h)throw Error('Old research changed: '+f);
const dependencies=JSON.parse(execFileSync(ROOT+'/.venv-rl/bin/python',['-c',
  'import importlib,json,pathlib; names=["torch","stable_baselines3.ppo.ppo","gymnasium","sklearn.isotonic","sklearn.preprocessing._data","numpy","joblib"]; print(json.dumps({n:str(pathlib.Path(importlib.import_module(n).__file__).resolve()) for n in names}))'],{encoding:'utf8'}));
for(const file of Object.values(dependencies)){
  if(!file.startsWith(ROOT+'/'))throw Error('Unregistered external Python runtime');
  inputHashes[file.slice(ROOT.length+1)]=hash(file);
}
const source=read('work/pepe-exits-v1/protocol.json'),sourceMonths=source.months;
if(!sourceMonths||sourceMonths.length!==15)throw Error('Wrong source calendar');
const stamp=m=>Date.parse(m+'-01T00:00:00Z');
const months=sourceMonths.map(m=>({...m,split:m.month<'2024-01'?'train':m.month<'2024-03'?'selection':m.month==='2024-03'?'calibration':'evaluation'}));
const jobs=[];for(const side of[1,-1])for(const[family,seed]of[['genetic',151],['ppo',101],['ppo',202]])jobs.push({side,family,seed,key:family+'-'+side+'-'+seed});
const p={version:'pepe-specialists-v1',registeredAt:Date.now(),origin:'work/pepe-exits-v1',months,jobs,
  engine:{...source,leverage:15,allowedLeverages:[15]},candidateMinutes:30,featureCount:19,
  features:'Original15 closed-bar RSI,ATR,volume,VWAP,EMA,MACD,delta,1h/4h trend and availability inputs plus signed body,upper wick,lower wick,range of last CLOSED5m candle in ATR units,clipped[-10,10]. First candidate at month start skipped when prior5m raw context not in packet. No next open/outcome as feature.',
  stageEnds:{train:stamp('2024-01'),selection:stamp('2024-03'),calibration:stamp('2024-04')},embargoMinutes:30,
  chronologicalStages:'Train Jun-Dec2023; select genetic training champions Jan-Feb2024; calibrate expected net R Mar2024; retrospectively evaluate Apr,May,Jun,Jul,Sep2024. Purge label outcomes not matured by stage-end minus30min. Both directions of a timestamp stay in one stage. None is a fresh independent final test; histories already consumed.',
  target:'Net USDT PNL divided by original R$1000/fx *1% risk, after fixed ladder_lock exit, all modeled fees/slippage/ticks/funding and stops/guards. Independent counterfactual positions on every30min buy/sell opportunity, not G91 entries. Labels may overlap and sums are NOT portfolio profits. Month-end settlement is explicit study boundary, not a chosen holding-time cap. Include unfilled candidate outcomes as0 with status. Data boundaries retained/reported.',
  genetic:{population:48,generations:20,seed:151,elites:4,parents:12,immigrants:8,mutationSD:.2,mutationChance:.35},
  geneticFitness:'Mean of per-month independent-opportunity netR means with rejected opportunities as0, minus0.25 standard deviation across train months. Not portfolio wealth/drawdown. Evolve train only, archive one champion every generation, then select among20 champions plus cash on Jan-Feb score. No evaluation month selects a genome.',
  ppo:{seeds:[101,202],steps:32768,actions:['cash','accept_side'],network:[32,32],nSteps:256,batch:64,epochs:5,gamma:0},
  ppoFormulation:'Stable-Baselines3 PPO in a NEW one-step contextual bandit: randomly sample only matured training opportunities; accept rewards0.1*netR from fixed-exit outcome; cash0. This is reinforcement learning for entry acceptance, NOT the old full-position FinRL environment, no FinRL DRLAgent factory, no exit learning. Two final seeds per side, no checkpoint/seed cherry-pick. New models; G91 tensors not transferred to incompatible specialist heads.',
  calibration:'StandardScaler fitted only train. IsotonicRegression maps each final policy score to expected netR using ONLY March matured labels. No classification-accuracy target, calibration refit on evaluation, threshold search or live updating.',
  minimumExpectedNetR:.1,minimumRowsPerSide:200,
  controller:'For each family/seed evaluate long-only,short-only,and combined. Side must first be accepted by its policy: genetic raw score>0 or PPO accept probability>.5. Then accept only if calibrated expected netR strictly>.1R. Rejected side is unavailable regardless of calibration; cash genetic champion cannot be turned into an active strategy by a positive constant calibrator. Combined picks greater eligible forecast, exact ties cash. Both directions may be negative; cash permitted. No old ATR/cost gate added. Forecasts known from feature before actual fill, fixed15x/risk1% in all arms.',
  financial:'Nine arms = genetic and two fixed PPO seeds x three modes. One actual continuous R$1000 wallet per evaluation month, own sizing/overlap/limits; CDI on same calendars including zero trades. Monthly resets never compounded. Report all9; aggregate both PPO seeds equally, no best-seed deployment. All engine risk,stops,ladder,costs unchanged apart from new entry proposals.',
  slippage:'Existing conservative stress execution model remains fixed. OHLC candles cannot identify real order-size/latency slippage; no claim to train a true execution-slippage predictor without order-book/trade/fill data.',
  workers:3,termination:'Finite pilot:48x20 genetic per side plus4 PPO jobs x32768steps; no endless genetic search or automatic promotion. Keep final weights immutable. A partial uncompleted model directory is not automatically overwritten; manual checkpoint recovery requires a new operational plan.',
  decision:'Exploratory results only, no automatic promotion even if profitable. All prior calendars consumed. Before future independent claims, freeze candidate and register prospective paper period. No real orders, paid AI or changes to old studies.',
  realOrders:false,independentValidation:false,automaticPromotion:false};
const files=['scripts/specialist-core.mjs','scripts/specialist-label-month.mjs','scripts/train-specialist.py',
  'scripts/evaluate-specialists.mjs','scripts/run-specialists.mjs','scripts/prepare-specialists.mjs','tests/specialist.test.mjs'];
for(const d of['labels','models'])fs.mkdirSync(base+'/'+d,{recursive:true});
fs.writeFileSync(base+'/protocol.json',JSON.stringify(p),{flag:'wx',mode:0o444});
fs.writeFileSync(base+'/registration.json',JSON.stringify({registeredAt:Date.now(),protocolSHA256:hash(base+'/protocol.json'),inputHashes,
  sourceHashes:Object.fromEntries(files.map(f=>[f,hash(ROOT+'/'+f)]))}),{flag:'wx',mode:0o444});
atomic(base+'/status.json',{phase:'registered',realOrders:false});console.log(JSON.stringify({registered:true,jobs:jobs.length,months:months.length}));
