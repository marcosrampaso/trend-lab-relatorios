import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {MINUTE,FIVE} from '../web/scalping.js';
import {digest,validateCandles} from './news-filter-core.mjs';
import {latestG151Signals,freezeG151Batch,evaluateG151} from './g151-news-core.mjs';

const root=path.resolve(import.meta.dirname,'..'),state=path.join(root,'work/g151-news-v1'),archive='champions/g151-c6cb2a8370cd058b0be0',origin='http://127.0.0.1:4173',publicFile=path.join(root,'web/data/g151-news-filter-v1.json'),activeFile=path.join(state,'active.json'),action=process.argv[2]??'status';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8')),readRoot=f=>read(path.join(root,f)),hash=f=>createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex');
function atomic(file,data){fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=file+'.'+process.pid+'.tmp';fs.writeFileSync(tmp,JSON.stringify(data));fs.renameSync(tmp,file);}
function alive(pid){try{if(!Number.isInteger(pid)||pid<=0)return false;process.kill(pid,0);return true;}catch{return false;}}
async function json(url){const r=await fetch(url,{signal:AbortSignal.timeout(20000),redirect:'error'});if(!r.ok)throw Error('HTTP '+r.status+' · '+url);return r.json();}
function files(){const a=read(activeFile),dir=path.join(state,a.id);return {dir,registration:read(path.join(dir,'registration.json')),batches:path.join(dir,'decisions'),market:path.join(dir,'market.json')};}
function publish(reg,status,fields={}){const prior=fs.existsSync(publicFile)?read(publicFile):{};atomic(publicFile,{...(prior.runId===reg.protocol.id?prior:{}),app:'trend-lab-g151-news',runId:reg.protocol.id,updatedAt:Date.now(),status,registration:reg,...fields});}
const implementation=['scripts/local-g151-news.mjs','scripts/g151-news-core.mjs','scripts/g151-inference.py','scripts/news-filter-core.mjs','web/engine.js','web/scalping.js','web/scalp-tree.js','web/scalping-context.js','web/tree-ml.js','web/adaptive-policy.js','web/research-adaptive-funding.js','web/research-funding-buckets.js','scalping-protocol.json','scalping-context-protocol.json'];
function frozen(reg){if(digest(reg.protocol)!==reg.protocolSHA256)throw Error('Protocolo G151 alterado');for(const [f,h]of Object.entries(reg.sourceHashes))if(hash(f)!==h)throw Error('Fonte G151 alterada: '+f);}

function modelInventory(){
 const manifest=readRoot(archive+'/manifest.json'),winner=readRoot(archive+'/winner.json');
 if(hash(archive+'/winner.json')!==manifest['winner.json'])throw Error('Campeão preservado divergiu');
 const list=fs.readdirSync(path.join(root,archive,'predictions')).filter(f=>f.endsWith('.json')).map(f=>({prediction:'predictions/'+f,data:readRoot(archive+'/predictions/'+f)}));
 const folds=[...new Set(list.map(x=>x.data.fold))].sort(),fold=folds.at(-1),models={};
 for(const family of ['cross','bands']){
  const candidates=list.filter(x=>x.data.family===family&&x.data.fold===fold).sort((a,b)=>a.data.seed-b.data.seed);
  if(candidates.length!==5)throw Error('Esperadas cinco sementes preservadas de '+family);
  models[family]=candidates.map(({prediction,data:d})=>{
   const model='models/'+path.basename(d.artifact);
   if(hash(archive+'/'+model)!==manifest[model]||hash(archive+'/'+prediction)!==manifest[prediction]||d.maxTrainLabelAvailableAt>=d.trainEnd||JSON.stringify(d.config.params)!==JSON.stringify(winner.winner.genome.params))throw Error('Modelo incompatível com G151');
   return {model,sha256:manifest[model],prediction,predictionSHA256:manifest[prediction],seed:d.seed,fold,trainStart:d.trainStart,trainEnd:d.trainEnd,maxTrainLabelAvailableAt:d.maxTrainLabelAvailableAt};
  });
 }
 return {genome:winner.winner.genome,models,fold};
}
function predict(models,params,rows){
 if(!rows.length)return Promise.resolve([]);
 return new Promise((resolve,reject)=>{
  const child=spawn(path.join(root,'.venv-ml/bin/python'),[path.join(root,'scripts/g151-inference.py')],{cwd:root,stdio:['pipe','pipe','pipe']});let stdout='',stderr='';const timer=setTimeout(()=>{child.kill('SIGTERM');reject(Error('Inferência G151 excedeu30s'));},30000);
  child.stdout.on('data',b=>{stdout+=b;});child.stderr.on('data',b=>{stderr=(stderr+b).slice(-3000);});child.on('error',e=>{clearTimeout(timer);reject(e);});child.on('close',code=>{clearTimeout(timer);if(code!==0)return reject(Error('Inferência G151: '+stderr));try{resolve(JSON.parse(stdout).scores);}catch(e){reject(e);}});
  child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify({models,params,rows}));
 });
}

async function verifyModels(inventory){
 const source=readRoot(archive+'/sources/data/scalp-tree/features.json'),rows=[],expected=new Map();
 for(const family of ['cross','bands']){
  const models=inventory.models[family],preds=models.map(m=>readRoot(archive+'/'+m.prediction)),features=new Map(source.features[family].map(r=>[r.at,r]));
  for(let i=0;i<Math.min(10,preds[0].test.length);i++){
   const at=preds[0].test[i][0],feature=features.get(at),id=family+'/'+at;if(!feature)throw Error('Amostra de paridade ausente');
   if(preds.some(p=>p.test[i][0]!==at))throw Error('Sementes desalinhadas');
   rows.push({id,family,x:feature.x});expected.set(id,preds.reduce((n,p)=>n+p.test[i][1],0)/5);
  }
 }
 const scores=await predict(inventory.models,inventory.genome.params,rows),errors=scores.map(s=>Math.abs(s.score-expected.get(s.id)));
 if(scores.length!==rows.length||errors.some(e=>!Number.isFinite(e)||e>1e-12))throw Error('Inferência não reproduz predições preservadas');
 return {checkedAt:Date.now(),rows:rows.length,models:10,maxAbsoluteError:Math.max(...errors),tolerance:1e-12,passed:true,trained:false,scope:'Paridade da inferência em20vetores históricos preservados; não é novo backtest de rentabilidade.'};
}
async function register(){
 const s=await json(origin+'/api/local/status');if(s.app!=='trend-lab-local')throw Error('Servidor diferente do Trend Lab');
 const source=await json(origin+'/api/forward');if(!source.run?.filters)throw Error('Filtros da corretora indisponíveis');
 const inventory=modelInventory(),parity=await verifyModels(inventory),at=Date.now(),firstSignalAt=(Math.floor(at/FIVE)+1)*FIVE,start=firstSignalAt+MINUTE,end=start+30*86400000;
 if(Object.values(inventory.models).flat().some(m=>m.trainEnd>=at))throw Error('Modelo treinado com informação futura');
 const strategy={...readRoot('scalping-protocol.json'),capitalBRL:1000},trend=readRoot('scalping-context-protocol.json').trend;
 const protocol={id:'g151-news-'+new Date(at).toISOString().replace(/[-:.]/g,''),strategyKind:'g151',version:1,genome:inventory.genome,models:inventory.models,modelFold:inventory.fold,firstSignalAt,start,end,signal:'G1515m',sourceStrategy:'G151 preservado · Random Forest de cinco sementes por família · sinais5m e contexto1h/4h',config:{capitalBRL:1000,fx:strategy.fx,risk:strategy.risk,leverage:strategy.leverage},strategy,trend,costCases:strategy.costCases,exchangeFilters:source.run.filters,exchangeFiltersAsOf:source.run.filtersAsOf,stopATR:strategy.stopATR,targetR:strategy.targetR,maxHoldHours:4,collection:{pollSeconds:15,executionMinutes:1,entryDelayMinutes:1,warmupFiveDays:3,fillMissedDecisions:false},rules:['Duas carteiras G151 com R$1.000 cada; capital e patrimônio separados do experimento de rompimento.','Pesos, rotas e limiares do campeão preservados. Modelo do fold2026-09, treinado até01jun2026; nenhum retreino nesta rodada.','Primeira observação do fechamento5m deve ocorrer antes da abertura do minuto seguinte. Atraso maior vira lacuna; não registrar sinal perdido.','Entrada no próximo minuto permite congelar inferência e notícia antes do preço de entrada. Adaptação prospectiva explícita, não reprodução exata dos fills históricos.','Família, prazo120/240min, alvos e stops herdados; Bollinger mantém alvo na média conhecida. Regras de funding usam o motor corrigido já existente.','Notícias vetam somente entrada; sinais contrários continuam encerrando posição nas duas carteiras.','Risco alto ou viés contrário pode vetar. Ausente, inválida ou expirada: não veta, sem cobertura. ScoreRF não é probabilidade calibrada de lucro.','Contexto1h/4h utiliza somente horas encerradas; aquecimento inicial das últimas1000h disponíveis, e5m dos últimos3dias completos mais o dia atual.','Rodada independente de30dias, sem ordens reais, API paga ou promoção automática.'],review:{minimumElapsedDays:30,minimumClosedTradesPerPortfolio:50,minimumDirectionalNewsSignals:20,automaticPromotion:false}};
 const tracked=[...implementation,archive+'/winner.json',archive+'/manifest.json',...Object.values(inventory.models).flatMap(a=>a.flatMap(m=>[archive+'/'+m.model,archive+'/'+m.prediction]))];
 const reg={registeredAt:at,protocol,protocolSHA256:digest(protocol),sourceHashes:Object.fromEntries(tracked.map(f=>[f,hash(f)])),modelVerification:parity};
 const dir=path.join(state,protocol.id);fs.mkdirSync(path.join(dir,'decisions'),{recursive:true});fs.writeFileSync(path.join(dir,'registration.json'),JSON.stringify(reg),{flag:'wx'});atomic(activeFile,{id:protocol.id});atomic(path.join(dir,'market.json'),{five:[],hourly:[],candles:[],marks:[],funding:[]});
 atomic(path.join(root,'web/data/g151-model-verification.json'),parity);publish(reg,s.paused?'paused':'waiting',{conclusion:'G151 registrado. Aguardando novos fechamentos5m, sem preencher decisões antigas.',realOrders:false,trainedBERT:false});return reg;
}
function merge(existing,rows){const map=new Map(existing.map(r=>[r[0],r]));for(const r of rows){if(map.has(r[0])&&digest(map.get(r[0]))!==digest(r))throw Error('Candle fechado revisado: '+r[0]);map.set(r[0],r);}return [...map.values()].sort((a,b)=>a[0]-b[0]);}
async function candles(kind,interval,start,end){
 const step=interval==='5m'?FIVE:MINUTE,out=[];
 for(let cursor=start;cursor<end;){const a=await json(`https://fapi.binance.com/fapi/v1/${kind}?symbol=ETHUSDT&interval=${interval}&startTime=${cursor}&endTime=${end-1}&limit=1500`);if(!Array.isArray(a)||!a.length)throw Error('Fonte sem candles '+interval);const rows=a.filter(r=>Number(r[0])>=cursor&&Number(r[0])<end).map(r=>[Number(r[0]),...r.slice(1,6).map(Number),...(interval==='5m'?[Number(r[7]),Number(r[9])]:[])]);if(!rows.length)throw Error('Paginação sem avanço');out.push(...rows);cursor=rows.at(-1)[0]+step;}
 validateCandles(out,start,end,step);return out;
}
async function tick(){
 const f=files(),reg=f.registration,p=reg.protocol;frozen(reg);
 const status=await json(origin+'/api/local/status');if(status.app!=='trend-lab-local')throw Error('Servidor local inválido');if(status.paused){publish(reg,'paused',{lastError:null});return;}
 const market=read(f.market),hourly=await json(origin+'/api/local/market'),clock=Date.now(),signalAt=Math.floor(clock/FIVE)*FIVE;
 if(Math.abs(clock-status.serverTime)>120000)throw Error('Relógios divergentes');
 market.hourly=merge(market.hourly,hourly.filter(r=>Number(r[0])+3600000<=clock).map(r=>[Number(r[0]),...r.slice(1,6).map(Number)]));
 const nextFive=market.five.length?market.five.at(-1)[0]+FIVE:Math.floor(reg.registeredAt/86400000)*86400000-3*86400000;
 if(nextFive<signalAt)market.five=merge(market.five,await candles('klines','5m',nextFive,signalAt));
 const batchFile=path.join(f.batches,signalAt+'.json');
 if(signalAt>=p.firstSignalAt&&signalAt+MINUTE<p.end&&Date.now()<signalAt+MINUTE&&!fs.existsSync(batchFile)){
  const raw=latestG151Signals(market.five,market.hourly,signalAt,p.strategy,p.trend);
  const rows=raw.signals.filter(s=>s.feature&&['cross','bands'].includes(s.family)).map(s=>({id:s.family+'/'+signalAt,family:s.family,x:s.feature.x}));
  const [scores,news]=await Promise.all([predict(p.models,p.genome.params,rows),json(origin+'/api/news')]);
  const batch=freezeG151Batch(raw,scores,news.updates??[],Date.now(),reg);
  if(batch)fs.writeFileSync(batchFile,JSON.stringify(batch),{flag:'wx'});
 }
 const until=Math.max(p.start,Math.min(Math.floor(Date.now()/MINUTE)*MINUTE,p.end)),next=market.candles.length?market.candles.at(-1)[0]+MINUTE:p.start;
 if(next<until){
  const [trade,marks,funds]=await Promise.all([candles('klines','1m',next,until),candles('markPriceKlines','1m',next,until),json(`https://fapi.binance.com/fapi/v1/fundingRate?symbol=ETHUSDT&startTime=${next}&endTime=${until-1}&limit=1000`)]);
  if(!Array.isArray(funds))throw Error('Funding ausente');const rates=funds.map(f=>[Number(f.fundingTime),Number(f.fundingRate)]);if(rates.some(r=>!r.every(Number.isFinite)||r[0]<next||r[0]>=until))throw Error('Funding inválido');
  market.candles=merge(market.candles,trade);market.marks=merge(market.marks,marks);market.funding=merge(market.funding,rates);
 }
 const batches=fs.readdirSync(f.batches).filter(f=>f.endsWith('.json')).map(n=>read(path.join(f.batches,n))).sort((a,b)=>a.signalAt-b.signalAt),result=evaluateG151(reg,batches,market,until);
 atomic(f.market,market);publish(reg,result.complete?'complete':'collecting',{...result,lastSuccessAt:Date.now(),lastError:null,modelInferenceOnly:true});atomic(path.join(f.dir,'latest.json'),read(publicFile));
}
let busy=false;async function safeTick(){if(busy)return;busy=true;try{await tick();}catch(e){const f=files();publish(f.registration,'error',{lastError:e.message});console.error(new Date().toISOString(),e.message);}finally{busy=false;}}
if(action==='run'){
 const {dir}=files(),lock=path.join(dir,'runner.lock');if(fs.existsSync(lock)){const pid=Number(fs.readFileSync(lock));if(alive(pid))throw Error('G151 já está ativo');fs.unlinkSync(lock);}fs.writeFileSync(lock,String(process.pid),{flag:'wx'});
 let timer;const cleanup=()=>{clearInterval(timer);if(fs.existsSync(lock)&&Number(fs.readFileSync(lock))===process.pid)fs.unlinkSync(lock);};process.on('exit',cleanup);for(const s of ['SIGINT','SIGTERM'])process.on(s,()=>{cleanup();process.exit(0);});
 await safeTick();timer=setInterval(async()=>{await safeTick();if(read(publicFile).status==='complete'){cleanup();process.exit(0);}},15000);
}else if(action==='start'){
 if(!fs.existsSync(activeFile))await register();const {dir,registration}=files(),lock=path.join(dir,'runner.lock'),pid=fs.existsSync(lock)?Number(fs.readFileSync(lock)):null;frozen(registration);
 if(alive(pid))console.log(JSON.stringify({running:true,pid}));else{const fd=fs.openSync(path.join(dir,'runner.log'),'a'),child=spawn(process.execPath,[import.meta.filename,'run'],{cwd:root,detached:true,stdio:['ignore',fd,fd]});fs.closeSync(fd);child.unref();console.log(JSON.stringify({started:true,pid:child.pid,run:registration.protocol.id,start:new Date(registration.protocol.start).toISOString(),modelVerification:registration.modelVerification}));}
}else if(action==='status'){
 if(!fs.existsSync(activeFile))console.log(JSON.stringify({registered:false}));else{const {dir}=files(),lock=path.join(dir,'runner.lock'),pid=fs.existsSync(lock)?Number(fs.readFileSync(lock)):null,r=read(publicFile);console.log(JSON.stringify({registered:true,running:alive(pid),pid,status:r.status,updatedAt:r.updatedAt,lastError:r.lastError,coverage:r.coverage,latestContext:r.latestContext,models:r.registration.modelVerification,scenarios:r.scenarios?.map(s=>({variant:s.variant,cost:s.cost,count:s.count,pnlBRL:s.pnlBRL}))}));}
}else if(action==='verify-models'){console.log(JSON.stringify(await verifyModels(modelInventory())));}
else if(action==='stop'){if(fs.existsSync(activeFile)){const {dir,registration}=files(),lock=path.join(dir,'runner.lock'),pid=fs.existsSync(lock)?Number(fs.readFileSync(lock)):null;if(alive(pid))process.kill(pid,'SIGTERM');publish(registration,'stopped');}console.log(JSON.stringify({stopped:true,preserved:true}));}
else if(action==='tick'){await tick();console.log('G151 atualizado');}
else throw Error('Use start/status/stop/tick/verify-models');
