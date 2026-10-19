import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
import {historicalSignals} from './multiasset-core.mjs';import {simulateAdaptive} from '../web/research-adaptive-funding.js';import {MINUTE} from '../web/scalping.js';
const root=path.resolve(import.meta.dirname,'..'),base=path.join(root,'work/multiasset-v1'),read=f=>JSON.parse(fs.readFileSync(path.join(root,f))),sha=f=>createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex');
const p=read('multiasset-sentiment-protocol.json'),h=p.history,strategy={...read('scalping-protocol.json'),capitalBRL:p.capitalBRL},trend=read('scalping-context-protocol.json').trend,manifest=read('work/multiasset-v1/history/manifest.json'),exchange=read('work/multiasset-v1/history/exchange.json');
fs.mkdirSync(base,{recursive:true});const save=(name,d)=>fs.writeFileSync(path.join(base,name),JSON.stringify(d));
const trainStart=Date.parse(h.trainStart),trainEnd=Date.parse(h.trainEnd),testStart=Date.parse(h.testStart),testEnd=Date.parse(h.testEnd);
const tracked=['multiasset-sentiment-protocol.json','scripts/build-btc-comparison.mjs','scripts/train-btc-comparison.py','scripts/multiasset-core.mjs','web/research-adaptive-funding.js','web/scalping.js','web/scalp-tree.js','web/scalping-context.js','web/engine.js','work/multiasset-v1/history/manifest.json','work/multiasset-v1/history/exchange.json'];
const hashes=Object.fromEntries(tracked.map(f=>[f,sha(f)])),record={registeredAt:Date.now(),protocol:p,sourceHashes:hashes},registration=path.join(base,'training-registration.json');
if(fs.existsSync(registration)){if(JSON.stringify(JSON.parse(fs.readFileSync(registration)).sourceHashes)!==JSON.stringify(hashes))throw Error('Preparation source changed');}else fs.writeFileSync(registration,JSON.stringify(record),{flag:'wx'});
const btc={candles:[],marks:[],funding:[],filters:exchange.filters.BTCUSDT};
for(const m of manifest.months){if(sha(m.path)!==m.sha256)throw Error('BTC shard changed');const d=read(m.path);for(const key of ['candles','marks','funding'])btc[key].push(...d[key]);}
const all=historicalSignals(btc.candles,strategy,trend),groups={cross:[],bands:[]},index=new Map(btc.candles.map((r,i)=>[r[0],i]));
for(const family of ['cross','bands']){
 const hold=p.forest.families[family],same=all.filter(s=>s.family===family);let excluded=0;
 for(let k=0;k<same.length;k++){
  const s=same[k],at=s.signalAt+MINUTE,available=s.signalAt+h.labelMaturityMinutes*MINUTE;
  if(s.signalAt<trainStart||available>=trainEnd||!s.feature)continue;
  const offset=index.get(at);if(offset===undefined){excluded++;continue;}
  const signals=same.slice(k).filter(v=>v.signalAt+MINUTE<=at+hold*MINUTE).map((v,i)=>({at:v.signalAt+MINUTE,knownAt:v.signalAt,family,side:v.side,atr:v.atr,target:v.target,holdMinutes:hold,entryAllowed:i===0}));
  const until=at+(hold+1)*MINUTE,data={candles:btc.candles.slice(offset,offset+hold+1),marks:btc.marks.slice(offset,offset+hold+1),funding:btc.funding.filter(r=>r[0]>=at&&r[0]<until),filters:btc.filters};
  const r=simulateAdaptive(data,{start:at,until,protocol:strategy,cost:strategy.costCases.find(c=>c.id==='stress'),signals,closeAtEnd:true}),t=r.trades.find(t=>t.entryAt===at);
  if(t)groups[family].push({...s.feature,y:t.net>0?1:0,labelAvailableAt:available,netUSDT:t.net,exitAt:t.exitAt});else excluded++;
 }
 console.log(JSON.stringify({family,labels:groups[family].length,excluded}),{flush:true});
}
save('btc-training.json',{groups,trainStart,trainEnd,params:p.forest.params,seeds:p.forest.seeds,sourceHashes:hashes});
save('btc-test-features.json',{signals:all.filter(s=>s.signalAt>=testStart&&s.signalAt+MINUTE<testEnd)});
save('btc-test-market.json',{...btc,candles:btc.candles.filter(r=>r[0]>=testStart),marks:btc.marks.filter(r=>r[0]>=testStart),funding:btc.funding.filter(r=>r[0]>=testStart)});
// ETH uses the already-installed, checksummed monthly shards. No existing files are changed.
const ethManifest=read('data/scalp-tree/manifest.json'),eth={candles:[],marks:[],funding:[],filters:exchange.filters.ETHUSDT},ethInputs={};
for(const item of ethManifest.months.filter(m=>m.month>=h.warmupStart.slice(0,7)&&m.month<h.testEnd.slice(0,7))){if(sha(item.path)!==item.sha256)throw Error('ETH shard changed');const d=read(item.path);eth.candles.push(...d.candles);eth.marks.push(...d.marks);ethInputs[item.path]=item.sha256;}
const history=read('web/data/eth-donchian-history.json');eth.funding=history.funding.filter(r=>r[0]>=testStart&&r[0]<testEnd);ethInputs['web/data/eth-donchian-history.json']=sha('web/data/eth-donchian-history.json');
const ethSignals=historicalSignals(eth.candles,strategy,trend);save('eth-test-features.json',{signals:ethSignals.filter(s=>s.signalAt>=testStart&&s.signalAt+MINUTE<testEnd),sourceHashes:ethInputs});
save('eth-test-market.json',{...eth,candles:eth.candles.filter(r=>r[0]>=testStart),marks:eth.marks.filter(r=>r[0]>=testStart)});
save('prepared.json',{at:Date.now(),samples:Object.fromEntries(Object.entries(groups).map(([f,a])=>[f,a.length])),testStart,testEnd,strategy,trend,files:Object.fromEntries(['btc-training.json','btc-test-features.json','btc-test-market.json','eth-test-features.json','eth-test-market.json'].map(f=>[f,sha('work/multiasset-v1/'+f)]))});console.log('Prepared BTC training and paired historical comparison');
