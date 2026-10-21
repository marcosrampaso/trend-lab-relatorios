import fs from 'node:fs';
import {ROOT,read,hash,atomic} from './multiasset-io.mjs';
import {RANDOM_RUN} from './entry-random-core.mjs';
const base=ROOT+'/'+RANDOM_RUN,source='work/pepe-entry-cost-v1';
if(fs.existsSync(base+'/registration.json'))throw Error('Already registered');
if(read(source+'/status.json').phase!=='complete')throw Error('Cost study incomplete');
const old=read(source+'/registration.json'),r=read(source+'/result.json');
const inputHashes={...old.inputHashes,...old.sourceHashes};
for(const f of['protocol.json','registration.json','result.json'])inputHashes[source+'/'+f]=hash(ROOT+'/'+source+'/'+f);
for(const[f,h]of Object.entries(inputHashes))if(hash(ROOT+'/'+f)!==h)throw Error('Previous input changed: '+f);
const months=r.summary.development.rows.map(w=>({month:w.month,signals:w.signals,accepted:w.accepted,
  sourcePath:'work/pepe-exits-v1/sources/'+w.month+'.json'}));
const protocol={version:'pepe-entry-random-v1',registeredAt:Date.now(),source,origin:'work/pepe-exits-v1',
  question:'Does the frozen ATR/cost gate select better entries than pseudorandom thinning with exactly the same accepted-signal count in each already-consumed development month?',
  months,seeds:Array.from({length:200},(_,i)=>10001+i),workers:3,
  selection:'Rank source IDs by SHA256 of version NUL seed NUL month NUL ID, ascending hexadecimal; ties by ID. Select first K without replacement, preserving original execution order. K is the frozen cost-gate acceptance count for that month. No price, feature, side, outcome or new optimization in random assignment.',
  conditioning:'Retrospective conditional comparison: K uses the full month count already observed for the frozen gate. The random assignment is not an online deployable trading policy. Match accepted signals, NOT actual fills, holding duration, side, volatility, notional or turnover. Report actual fills, own-cash limits, fees and holding exposure separately. Do not reject/resample less-active or losing seeds.',
  fixed:'Same original G91 signal schedule, ladder_lock exit with first5m opportunity,25/50/25 ladder at net10/20/40% original-margin equivalents, stress fee/slippage/ticks, actual modeled funding,1% risk,3% daily/10% global limits, source10x/15x, own monthly R$1000 wallet,fx5BRL/USDT. No new training, leverage/risk change or holding cap.',
  calendar:'Five source development months Apr,May,Jun,Jul,Sep2024 only. Cash stays idle when K=0; include that month in every replicate and every mean. Each month starts independently; never compound monthly restarts. Source policy/histories already trained/selected/inspected. No2025 orSeptember2026 read.200 repeats are NOT200 independent market histories.',
  primary:'For each of ALL200 seeds compute equally weighted mean net BRL of ALL5 monthly wallets. Compare frozen gate mean to random distribution; report mean/median/q2.5/q97.5/min/max, reference percentile with half ties, count/fraction random >= gate (1e-8 tolerance), plus-one Monte Carlo upper-tail fraction. This is descriptive conditional Monte Carlo, not a formal exchangeability p-value or independent significance test.',
  secondary:'Per-month random distributions and exact K, actual trade counts, cost/exposure distribution, cash0 and CDI with identical calendars. Show every seed. Unique monthly subsets reported; duplicates remain in sampling distribution. Replay control and gate once per month and require exact PNL/count/curve parity before random runs.',
  interpretation:'Above97.5th percentile is labeled unusual only within this conditional simulation. Otherwise no unusual selection advantage demonstrated. Neither outcome promotes a filter: it failed prior profitability/sample criteria, and all histories are consumed. No post-result new threshold, best-seed selection, model retraining, deployment or live orders.',
  preservation:'Each completed month file immutable with registration hash. Resume only from those exact registered200-seed month files, never overwrite a completed result. Validate all old source/data hashes before and after. Exact duplicate accepted-ID subsets reuse the same deterministic wallet simulation; all200 draws remain in distribution. Count unique simulations and cache reuse explicitly. No seed is dropped.',
  independentValidation:false,automaticPromotion:false,realOrders:false};
const sources=['scripts/entry-random-core.mjs','scripts/prepare-entry-random.mjs',
  'scripts/entry-random-month.mjs','scripts/run-entry-random.mjs','tests/entry-random.test.mjs'];
fs.mkdirSync(base+'/months',{recursive:true});
fs.writeFileSync(base+'/protocol.json',JSON.stringify(protocol),{flag:'wx',mode:0o444});
fs.writeFileSync(base+'/registration.json',JSON.stringify({registeredAt:Date.now(),
  protocolSHA256:hash(base+'/protocol.json'),inputHashes,
  sourceHashes:Object.fromEntries(sources.map(f=>[f,hash(ROOT+'/'+f)]))}),{flag:'wx',mode:0o444});
atomic(base+'/status.json',{phase:'registered',completedWallets:0,totalWallets:months.length*protocol.seeds.length,realOrders:false});
console.log(JSON.stringify({registered:true,months,replicates:200,randomWallets:1000}));
