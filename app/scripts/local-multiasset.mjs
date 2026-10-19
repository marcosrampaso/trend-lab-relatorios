import fs from 'node:fs';import path from 'node:path';import {spawn} from 'node:child_process';
import {ROOT,BASE,read,hash,atomic,infer,inventories,json,alive} from './multiasset-io.mjs';
import {latestG151Signals,freezeMultiBatch,evaluateMultiArm} from './multiasset-core.mjs';import {digest,validateCandles} from './news-filter-core.mjs';import {MINUTE,FIVE} from '../web/scalping.js';
const state=path.join(BASE,'forward'),regFile=path.join(state,'registration.json'),publicFile=path.join(ROOT,'web/data/multiasset-forward.json'),lock=path.join(state,'runner.lock'),action=process.argv[2]??'status';
const sources=['multiasset-sentiment-protocol.json','scripts/local-multiasset.mjs','scripts/multiasset-core.mjs','scripts/multiasset-io.mjs','scripts/multiasset-inference.py','scripts/local-sentiment.py','scripts/news-filter-core.mjs','scripts/g151-news-core.mjs','web/scalping.js','web/scalp-tree.js','web/scalping-context.js','web/tree-ml.js','web/adaptive-policy.js','web/research-adaptive-funding.js','web/research-funding-buckets.js','web/engine.js','web/strategies.js','scalping-protocol.json','scalping-context-protocol.json','work/local-sentiment/model-manifest.json','work/multiasset-v1/btc-models.json'];
const file=(s,k)=>path.join(state,s+'-'+k+'.json'),batchDir=id=>path.join(state,'decisions',id);
function publish(status,extra={}){const prior=fs.existsSync(publicFile)?read(publicFile):{};atomic(publicFile,{...prior,app:'trend-lab-multiasset',status,updatedAt:Date.now(),...extra});}
function frozen(reg){if(digest(reg.protocol)!==reg.protocolSHA256)throw Error('Protocol changed');for(const[f,h]of Object.entries(reg.sourceHashes))if(hash(path.join(ROOT,f))!==h)throw Error('Source changed '+f);}
async function register(){
 const s=await json('http://127.0.0.1:4173/api/local/status');if(s.app!=='trend-lab-local'||s.paused)throw Error('Local server inactive/paused');
 const sentiment=read(path.join(ROOT,'web/data/local-sentiment.json'));if(!['collecting','degraded'].includes(sentiment.status)||Date.now()-sentiment.updatedAt>10*MINUTE)throw Error('Sentiment not ready');
 const definition=read(path.join(ROOT,'multiasset-sentiment-protocol.json')),i=inventories(),exchange=await json('https://fapi.binance.com/fapi/v1/exchangeInfo'),filters=Object.fromEntries(exchange.symbols.filter(s=>definition.symbols.includes(s.symbol)).map(s=>[s.symbol,s.filters]));if(Object.keys(filters).length!==2)throw Error('Missing asset filters');
 const at=Date.now(),start=(Math.floor(at/FIVE)+2)*FIVE+MINUTE,end=start+definition.durationDays*86400000;
 const arms=[{id:'eth-g151',symbol:'ETHUSDT',label:'ETH · G151 preservado',models:i.original},{id:'btc-transfer',symbol:'BTCUSDT',label:'BTC · pesos ETH transferidos',models:i.original},{id:'btc-trained',symbol:'BTCUSDT',label:'BTC · floresta treinada no BTC',models:i.btc}].map(a=>({...a,filters:filters[a.symbol]}));
 const strategy={...read(path.join(ROOT,'scalping-protocol.json')),capitalBRL:definition.capitalBRL},p={...definition,id:'multiasset-'+at,start,end,genome:i.genome,strategy,trend:read(path.join(ROOT,'scalping-context-protocol.json')).trend,arms,exchangeFiltersAsOf:at,btcTrainingCompletedAt:i.trainedAt};
 if(i.trainedAt>=start||arms.some(a=>Object.values(a.models).flat().some(m=>m.trainEnd>=at)))throw Error('Model not available before forward run');
 const tracked=[...sources,...arms.flatMap(a=>Object.values(a.models).flat().map(m=>m.path))],reg={registeredAt:at,protocol:p,protocolSHA256:digest(p),sourceHashes:Object.fromEntries([...new Set(tracked)].map(f=>[f,hash(path.join(ROOT,f))]))};
 fs.mkdirSync(state,{recursive:true});fs.writeFileSync(regFile,JSON.stringify(reg),{flag:'wx'});for(const symbol of p.symbols)atomic(file(symbol,'market'),{five:[],hourly:[],candles:[],marks:[],funding:[]});for(const a of arms)fs.mkdirSync(batchDir(a.id),{recursive:true});publish('waiting',{registration:reg,realOrders:false});return reg;
}
function merge(a,b){const m=new Map(a.map(r=>[r[0],r]));for(const r of b){if(m.has(r[0])&&digest(m.get(r[0]))!==digest(r))throw Error('Revised closed candle');m.set(r[0],r);}return [...m.values()].sort((a,b)=>a[0]-b[0]);}
async function candles(symbol,kind,interval,start,end){
 const step=interval==='1m'?MINUTE:interval==='5m'?FIVE:60*MINUTE,out=[];
 for(let cursor=start;cursor<end;){const rows=await json(`https://fapi.binance.com/fapi/v1/${kind}?symbol=${symbol}&interval=${interval}&startTime=${cursor}&endTime=${end-1}&limit=1500`);if(!Array.isArray(rows)||!rows.length)throw Error('Missing public candles');const a=rows.filter(r=>Number(r[0])>=cursor&&Number(r[0])<end).map(r=>[Number(r[0]),...r.slice(1,6).map(Number),...(interval==='5m'?[Number(r[7]),Number(r[9])]:[])]);if(!a.length)throw Error('Nonadvancing candle request');out.push(...a);cursor=a.at(-1)[0]+step;}
 validateCandles(out,start,end,step);return out;
}
async function tick(){
 const reg=read(regFile),p=reg.protocol;frozen(reg);const s=await json('http://127.0.0.1:4173/api/local/status');if(s.app!=='trend-lab-local')throw Error('Wrong local server');if(s.paused){publish('paused',{lastError:null});return;}
 if(Math.abs(Date.now()-s.serverTime)>120000)throw Error('Clock divergence');
 const sentimentFile=path.join(ROOT,'web/data/local-sentiment.json'),sentiment=fs.existsSync(sentimentFile)?read(sentimentFile):{articles:[],status:'unavailable'};const results=[];
 for(const symbol of p.symbols){
  const market=read(file(symbol,'market')),now=Date.now(),signalAt=Math.floor(now/FIVE)*FIVE,hourEnd=Math.floor(now/(60*MINUTE))*60*MINUTE;
  const firstHour=market.hourly.at(-1)?.[0]+60*MINUTE||hourEnd-1000*60*MINUTE,firstFive=market.five.at(-1)?.[0]+FIVE||Math.floor(reg.registeredAt/86400000)*86400000-3*86400000;
  if(firstHour<hourEnd)market.hourly=merge(market.hourly,await candles(symbol,'klines','1h',firstHour,hourEnd));
  if(firstFive<signalAt)market.five=merge(market.five,await candles(symbol,'klines','5m',firstFive,signalAt));
  const raw=latestG151Signals(market.five,market.hourly,signalAt,p.strategy,p.trend);
  for(const arm of p.arms.filter(a=>a.symbol===symbol)){
   const target=path.join(batchDir(arm.id),signalAt+'.json');
   if(signalAt>=reg.registeredAt&&signalAt+MINUTE>=p.start&&signalAt+MINUTE<p.end&&Date.now()<signalAt+MINUTE&&!fs.existsSync(target)){
    const rows=raw.signals.filter(s=>s.feature&&['cross','bands'].includes(s.family)).map(s=>({id:s.family+'/'+signalAt,family:s.family,x:s.feature.x})),scores=await infer(arm.models,p.forest.params,rows),b=freezeMultiBatch(raw,scores,sentiment.articles??[],Date.now(),reg,arm);if(b)fs.writeFileSync(target,JSON.stringify(b),{flag:'wx'});
   }
  }
  const until=Math.max(p.start,Math.min(Math.floor(Date.now()/MINUTE)*MINUTE,p.end)),next=market.candles.at(-1)?.[0]+MINUTE||p.start;
  if(next<until){
   const [trade,marks,funding]=await Promise.all([candles(symbol,'klines','1m',next,until),candles(symbol,'markPriceKlines','1m',next,until),json(`https://fapi.binance.com/fapi/v1/fundingRate?symbol=${symbol}&startTime=${next}&endTime=${until-1}&limit=1000`)]);
   if(!Array.isArray(funding))throw Error('Invalid funding');const rates=funding.map(f=>[Number(f.fundingTime),Number(f.fundingRate)]);if(rates.some(r=>!r.every(Number.isFinite)||r[0]<next||r[0]>=until))throw Error('Funding timestamps invalid');market.candles=merge(market.candles,trade);market.marks=merge(market.marks,marks);market.funding=merge(market.funding,rates);
  }
  atomic(file(symbol,'market'),market);
  for(const arm of p.arms.filter(a=>a.symbol===symbol)){const batches=fs.readdirSync(batchDir(arm.id)).filter(n=>n.endsWith('.json')).map(n=>read(path.join(batchDir(arm.id),n))).sort((a,b)=>a.signalAt-b.signalAt);results.push(evaluateMultiArm(reg,batches,market,until,arm));}
 }
 publish(Date.now()>=p.end?'complete':'collecting',{registration:reg,arms:results,sentiment:{status:sentiment.status,updatedAt:sentiment.updatedAt,articles:sentiment.articles?.length??0},lastSuccessAt:Date.now(),lastError:null,realOrders:false});
}
let busy=false;async function safeTick(){if(busy)return;busy=true;try{await tick();}catch(e){publish('error',{lastError:e.message});console.error(new Date().toISOString(),e.message);}finally{busy=false;}}
if(action==='start'){
 if(!fs.existsSync(regFile))await register();frozen(read(regFile));const pid=fs.existsSync(lock)?Number(fs.readFileSync(lock)):null;
 if(alive(pid))console.log(JSON.stringify({running:true,pid}));else{const fd=fs.openSync(path.join(state,'runner.log'),'a'),c=spawn(process.execPath,[import.meta.filename,'run'],{cwd:ROOT,detached:true,stdio:['ignore',fd,fd]});fs.closeSync(fd);c.unref();console.log(JSON.stringify({started:true,pid:c.pid,start:new Date(read(regFile).protocol.start).toISOString()}));}
}else if(action==='run'){
 const pid=fs.existsSync(lock)?Number(fs.readFileSync(lock)):null;if(alive(pid))throw Error('Already running');fs.writeFileSync(lock,String(process.pid));const cleanup=()=>{if(fs.existsSync(lock)&&Number(fs.readFileSync(lock))===process.pid)fs.unlinkSync(lock);};process.on('exit',cleanup);for(const sig of ['SIGTERM','SIGINT'])process.on(sig,()=>process.exit(0));await safeTick();const timer=setInterval(async()=>{await safeTick();if(read(publicFile).status==='complete'){clearInterval(timer);process.exit(0);}},15000);
}else if(action==='status'){const d=fs.existsSync(publicFile)?read(publicFile):{};console.log(JSON.stringify({registered:fs.existsSync(regFile),running:alive(fs.existsSync(lock)?Number(fs.readFileSync(lock)):null),status:d.status,updatedAt:d.updatedAt,lastError:d.lastError,start:d.registration?.protocol.start,arms:d.arms?.map(a=>({id:a.id,coverage:a.coverage,scenarios:a.scenarios.map(({trades,equity,position,...s})=>s)}))}));}
else if(action==='stop'){const pid=fs.existsSync(lock)?Number(fs.readFileSync(lock)):null;if(alive(pid))process.kill(pid,'SIGTERM');publish('stopped');}
else if(action==='tick')await tick();else throw Error('Use start/status/stop/tick');
