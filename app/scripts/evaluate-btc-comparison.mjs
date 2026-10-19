import fs from 'node:fs';import path from 'node:path';
import {ROOT,BASE,read,hash,atomic,infer,inventories} from './multiasset-io.mjs';
import {routeRow,summarizeMulti} from './multiasset-core.mjs';import {simulateAdaptive} from '../web/research-adaptive-funding.js';import {validateCandles} from './news-filter-core.mjs';import {MINUTE} from '../web/scalping.js';
const p=read(path.join(ROOT,'multiasset-sentiment-protocol.json')),prepared=read(path.join(BASE,'prepared.json')),models=inventories(),start=Date.parse(p.history.testStart),end=Date.parse(p.history.testEnd);
for(const[f,h]of Object.entries(prepared.files))if(hash(path.join(BASE,f))!==h)throw Error('Prepared input changed');
const registration={registeredAt:Date.now(),protocol:p,inputHashes:prepared.files,sourceHashes:Object.fromEntries(['scripts/evaluate-btc-comparison.mjs','scripts/multiasset-core.mjs','scripts/multiasset-io.mjs','scripts/multiasset-inference.py'].map(f=>[f,hash(path.join(ROOT,f))])),models};
const file=path.join(BASE,'historical-registration.json');if(fs.existsSync(file))throw Error('Historical run already registered; do not overwrite');atomic(file,registration);
const arms=[{id:'eth-g151',label:'ETH · pesos G151',symbol:'ETHUSDT',dataset:'eth',models:models.original},{id:'btc-transfer',label:'BTC · pesos ETH transferidos',symbol:'BTCUSDT',dataset:'btc',models:models.original},{id:'btc-trained',label:'BTC · floresta treinada no BTC',symbol:'BTCUSDT',dataset:'btc',models:models.btc}],results=[];
for(const arm of arms){
 const market=read(path.join(BASE,arm.dataset+'-test-market.json')),raw=read(path.join(BASE,arm.dataset+'-test-features.json')).signals;
 validateCandles(market.candles,start,end,MINUTE);validateCandles(market.marks,start,end,MINUTE);
 const rows=raw.filter(s=>s.feature&&['cross','bands'].includes(s.family)).map(s=>({id:s.family+'/'+s.signalAt,family:s.family,x:s.feature.x})),scores=await infer(arm.models,p.forest.params,rows),lookup=new Map(scores.map(r=>[r.id,r.score]));
 const signals=raw.map(s=>routeRow(s,lookup.get(s.family+'/'+s.signalAt),models.genome)).map(s=>({at:s.signalAt+MINUTE,knownAt:s.signalAt,family:s.family,side:s.side,atr:s.atr,target:s.target,holdMinutes:s.holdMinutes,regime:s.regime,entryAllowed:s.modelAllowed}));
 for(const cost of prepared.strategy.costCases){
  const r=simulateAdaptive(market,{start,until:end,protocol:prepared.strategy,cost,signals,closeAtEnd:true});results.push({arm:arm.id,label:arm.label,symbol:arm.symbol,cost:cost.id,...summarizeMulti(r,prepared.strategy.fx),signals:signals.length,modelAllowed:signals.filter(s=>s.entryAllowed).length});
 }
 console.log(JSON.stringify({arm:arm.id,results:results.filter(r=>r.arm===arm.id).map(({trades,equity,...r})=>r)}));
}
const result={status:'complete',generatedAt:Date.now(),start,end,registration,results,newsApplied:false,independentHoldout:false,conclusion:'Exploratório: mesmos4meses para os3braços. ETH já visto na pesquisa anterior. Sem sentimento histórico; nenhum vencedor promovido.',limitations:p.rules,realOrders:false};atomic(path.join(BASE,'historical-results.json'),result);atomic(path.join(ROOT,'web/data/multiasset-history.json'),result);
