import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {DEFAULTS,HOUR} from '../web/engine.js';
import {digest,enrollDecision,evaluateExperiment,validateCandles,QUARTER} from './news-filter-core.mjs';

const root=path.resolve(import.meta.dirname,'..'),state=path.join(root,'work/news-filter-v1'),publicFile=path.join(root,'web/data/news-filter-v1.json'),origin='http://127.0.0.1:4173';
const action=process.argv[2]??'status',activeFile=path.join(state,'active.json');
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
function atomic(file,value){fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=file+'.'+process.pid+'.tmp';fs.writeFileSync(tmp,JSON.stringify(value,null,2));fs.renameSync(tmp,file);}
function alive(pid){if(!Number.isInteger(pid)||pid<=0)return false;try{process.kill(pid,0);return true;}catch{return false;}}
async function getJSON(url){const r=await fetch(url,{signal:AbortSignal.timeout(20000),redirect:'error'});if(!r.ok)throw Error('HTTP '+r.status+' · '+url);return r.json();}
const tracked=['web/engine.js','web/strategies.js','web/filters.js','worker/forward.js','web/market-collector.js','web/data/forward-protocol.json','scripts/news-filter-core.mjs','scripts/local-news-experiment.mjs'];
const fileHash=f=>createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex');
function assertFrozen(reg){if(digest(reg.protocol)!==reg.protocolSHA256)throw Error('Protocolo alterado após registro');for(const [f,h]of Object.entries(reg.sourceHashes))if(fileHash(f)!==h)throw Error('Fonte congelada mudou: '+f);}
function files(){const a=read(activeFile),dir=path.join(state,a.id);return {dir,registration:read(path.join(dir,'registration.json')),decisions:path.join(dir,'decisions'),market:path.join(dir,'market.json')};}
function publish(reg,status,fields={}){const prior=fs.existsSync(publicFile)?read(publicFile):{};atomic(publicFile,{...(prior.runId===reg.protocol.id?prior:{}),app:'trend-lab-news-filter',runId:reg.protocol.id,updatedAt:Date.now(),status,registration:reg,...fields});}

async function register(){
 const [s,f]=await Promise.all([getJSON(origin+'/api/local/status'),getJSON(origin+'/api/forward')]);
 if(s.app!=='trend-lab-local'||!f.run)throw Error('Trend Lab local indisponível ou sem rodada de origem');
 const at=Date.now(),p=f.run.protocol,start=(Math.floor(at/HOUR)+2)*HOUR,end=f.run.end;
 if(start>=end)throw Error('Rodada de origem encerrada; requer novo protocolo');
 const filesHash=Object.fromEntries(tracked.map(f=>[f,fileHash(f)]));
 const combined=createHash('sha256');for(const f of tracked.slice(0,5))combined.update(fs.readFileSync(path.join(root,f)));
 if(combined.digest('hex')!==f.run.engineSHA256)throw Error('Motor de origem não corresponde ao congelado');
 const id='cbits-filter-'+new Date(at).toISOString().replace(/[-:.]/g,'');
 const protocol={id,version:1,sourceRunId:f.run.id,sourceProtocolSHA256:f.run.freeze.protocolSHA256,sourceEngineSHA256:f.run.engineSHA256,sourceStrategy:'Rompimento20h + volume; sinal1h e execução15min. Não é o campeão G151.',start,end,capitalNote:'R$1.000 simulados em cada carteira, sem aporte real; demais regras herdadas do controle operacional.',signal:p.signal,stopATR:p.stopATR,targetR:p.targetR,maxHoldHours:p.maxHoldHours,cooldownHours:p.cooldownHours,minStopToRoundTripCost:p.minStopToRoundTripCost,costCases:p.costCases,exchangeFilters:f.run.filters,exchangeFiltersAsOf:f.run.filtersAsOf,config:{...DEFAULTS,capitalBRL:1000,fx:p.fx,risk:p.risk,leverage:p.leverage},variants:['control','news-filter'],newsPolicy:'Uma análise qualitativa por sinal, congelada na primeira observação antes da entrada. Vetar risco high ou bias negativo para long/positivo para short. Sem data verificável, unknown, ausência, expiração ou fontes futuras: não vetar e marcar sem cobertura. Mixed/uncertain não fazem veto direcional. Nenhuma probabilidade de lucro.',collection:{pollSeconds:30,marketResolutionMinutes:15,fillMissedDecisions:false,analysisAtEntryMayBeUpdated:false,usesPaidAI:false},review:{minimumClosedTradesPerPortfolio:50,minimumDirectionalNewsSignals:20,minimumElapsedDays:30,maximumDrawdown:0.1,automaticPromotion:false,note:'A rodada termina junto com a origem; se durar menos de30dias ou faltar amostra, permanece inconclusiva. Extensão exige outro registro.'},limitations:['Filtro qualitativo inspirado na hipótese do CBITS; sem treino BERT, sem replicar o percentual publicado.','Notícias atuais nunca são aplicadas a sinais antigos; coleta existente pode produzir pouca cobertura.','Comparação no controle operacional, sem alterar campeãoG151, V6 ou rodada anterior.','Funding e liquidação seguem o motor existente; FX fixo5; custos modelados.','Diferença entre carteiras não comprova causalidade macroeconômica nem rentabilidade futura.']};
 const reg={registeredAt:at,protocol,protocolSHA256:digest(protocol),sourceHashes:filesHash};
 const dir=path.join(state,id);fs.mkdirSync(path.join(dir,'decisions'),{recursive:true});fs.writeFileSync(path.join(dir,'registration.json'),JSON.stringify(reg,null,2),{flag:'wx'});atomic(activeFile,{id});
 atomic(path.join(dir,'market.json'),{hourly:[],candles:[],marks:[],funding:[]});publish(reg,s.paused?'paused':'waiting',{conclusion:'Registro concluído antes da primeira entrada. Aguardando novos sinais e resultados.',realOrders:false,trainedBERT:false});return reg;
}

function merge(existing,newRows){const out=new Map(existing.map(r=>[r[0],r]));for(const r of newRows){const old=out.get(r[0]);if(old&&JSON.stringify(old)!==JSON.stringify(r))throw Error('Dado fechado revisado pela fonte: '+r[0]);out.set(r[0],r);}return [...out.values()].sort((a,b)=>a[0]-b[0]);}
async function klines(kind,start,end){const result=[];for(let cursor=start;cursor<end;){const a=await getJSON(`https://fapi.binance.com/fapi/v1/${kind}?symbol=ETHUSDT&interval=15m&startTime=${cursor}&endTime=${end-1}&limit=1000`);if(!Array.isArray(a)||!a.length)throw Error('Fonte pública sem dados de execução');const rows=a.map(r=>[Number(r[0]),...r.slice(1,kind==='klines'?6:5).map(Number)]).filter(r=>r[0]>=cursor&&r[0]<end);if(!rows.length)throw Error('Paginação sem avanço');result.push(...rows);const next=rows.at(-1)[0]+QUARTER;if(next<=cursor)throw Error('Paginação sem avanço');cursor=next;}validateCandles(result,start,end);return result;}

export async function tick(){
 const f=files(),reg=f.registration,p=reg.protocol;assertFrozen(reg);
 const s=await getJSON(origin+'/api/local/status');if(s.app!=='trend-lab-local')throw Error('Servidor diferente do Trend Lab');
 if(s.paused){publish(reg,'paused',{lastError:null});return;}
 const [source,news,hourly]=await Promise.all([getJSON(origin+'/api/forward'),getJSON(origin+'/api/news'),getJSON(origin+'/api/local/market')]);
 const observedAt=Date.now();if(Math.abs(observedAt-s.serverTime)>120000)throw Error('Relógios do coletor e experimento divergem');
 if(source.run?.id!==p.sourceRunId)throw Error('Rodada de origem mudou; registrar outro experimento');
 for(const d of source.decisions??[]){
  if(fs.existsSync(path.join(f.decisions,String(d.signalAt)+'.json')))continue;
  const enrolled=enrollDecision(d,news.updates??[],observedAt,reg);if(enrolled)fs.writeFileSync(path.join(f.decisions,enrolled.id+'.json'),JSON.stringify(enrolled,null,2),{flag:'wx'});
 }
 const decisions=fs.readdirSync(f.decisions).filter(n=>n.endsWith('.json')).map(n=>read(path.join(f.decisions,n))).sort((a,b)=>a.signalAt-b.signalAt);
 const market=read(f.market),until=Math.max(p.start,Math.min(Math.floor(observedAt/QUARTER)*QUARTER,p.end));
 const closed=hourly.filter(r=>Number(r[0])+HOUR<=until&&Number(r[6])<observedAt&&Number(r[0])>=p.start-300*HOUR).map(r=>[Number(r[0]),...r.slice(1,6).map(Number)]);
 if(closed.some(r=>r.slice(1).some(v=>!Number.isFinite(v))))throw Error('Histórico horário inválido');
 market.hourly=merge(market.hourly,closed);
 const next=market.candles.length?market.candles.at(-1)[0]+QUARTER:p.start;
 if(next<until){
  const [candles,marks,funding]=await Promise.all([klines('klines',next,until),klines('markPriceKlines',next,until),getJSON(`https://fapi.binance.com/fapi/v1/fundingRate?symbol=ETHUSDT&startTime=${next}&endTime=${until-1}&limit=1000`)]);
  if(!Array.isArray(funding))throw Error('Funding indisponível');
  const fundingRows=funding.map(x=>[Number(x.fundingTime),Number(x.fundingRate)]);if(fundingRows.some(r=>!r.every(Number.isFinite)||r[0]<next||r[0]>=until))throw Error('Funding inválido');
  market.candles=merge(market.candles,candles);market.marks=merge(market.marks,marks);market.funding=merge(market.funding,fundingRows);
 }
 const result=evaluateExperiment(reg,decisions,market,until);atomic(f.market,market);
 // Dynamic diagnostics remain non-promotional, including when sample gates are met.
 const review={days:result.asOf?Math.max(0,(result.asOf-p.start)/(24*HOUR)):0,minimumTrades:Math.min(...result.scenarios.map(x=>x.count)),newsSignals:result.coverage.covered,eligibleForManualReview:false};
 review.eligibleForManualReview=result.complete&&review.days>=p.review.minimumElapsedDays&&review.minimumTrades>=p.review.minimumClosedTradesPerPortfolio&&review.newsSignals>=p.review.minimumDirectionalNewsSignals;
 publish(reg,result.complete?'complete':'collecting',{...result,review,lastError:null,lastSuccessAt:observedAt,decisions:decisions.slice(-100),dataSHA256:digest(market)});
 atomic(path.join(f.dir,'latest.json'),read(publicFile));
}

let busy=false;
async function safeTick(){if(busy)return;busy=true;try{await tick();}catch(e){const f=files();publish(f.registration,'error',{lastError:e.message});console.error(new Date().toISOString(),e.message);}finally{busy=false;}}
if(action==='run'){
 if(!fs.existsSync(activeFile))throw Error('Experimento não registrado');
 const {dir}=files(),lock=path.join(dir,'runner.lock');
 try{fs.writeFileSync(lock,String(process.pid),{flag:'wx'});}catch{const pid=Number(fs.readFileSync(lock));if(alive(pid))throw Error('Já existe um coletor ativo');fs.unlinkSync(lock);fs.writeFileSync(lock,String(process.pid),{flag:'wx'});}
 let timer;const cleanup=()=>{clearInterval(timer);if(fs.existsSync(lock)&&Number(fs.readFileSync(lock))===process.pid)fs.unlinkSync(lock);};process.on('exit',cleanup);for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{cleanup();process.exit(0);});
 await safeTick();timer=setInterval(async()=>{await safeTick();if(read(publicFile).status==='complete'){cleanup();process.exit(0);}},30000);
}else if(action==='start'){
 if(!fs.existsSync(activeFile))await register();
 const {dir,registration}=files(),lock=path.join(dir,'runner.lock'),pid=fs.existsSync(lock)?Number(fs.readFileSync(lock)):null;
 assertFrozen(registration);
 if(alive(pid)){console.log(JSON.stringify({running:true,pid,url:origin+'/pesquisa-genetica/experimento-noticias.html'}));}
 else{
  const fd=fs.openSync(path.join(dir,'runner.log'),'a'),child=spawn(process.execPath,[import.meta.filename,'run'],{cwd:root,detached:true,stdio:['ignore',fd,fd]});fs.closeSync(fd);child.unref();
  console.log(JSON.stringify({started:true,pid:child.pid,run:registration.protocol.id,start:new Date(registration.protocol.start).toISOString(),url:origin+'/pesquisa-genetica/experimento-noticias.html'}));
 }
}else if(action==='tick'){await tick();console.log(JSON.stringify({updated:true}));}
else if(action==='status'){
 if(!fs.existsSync(activeFile)){console.log(JSON.stringify({registered:false}));}
 else{const {dir,registration}=files(),lock=path.join(dir,'runner.lock'),pid=fs.existsSync(lock)?Number(fs.readFileSync(lock)):null;const report=fs.existsSync(publicFile)?read(publicFile):null;console.log(JSON.stringify({registered:true,running:alive(pid),pid,run:registration.protocol.id,status:report?.status,updatedAt:report?.updatedAt,lastSuccessAt:report?.lastSuccessAt,lastError:report?.lastError,coverage:report?.coverage,scenarios:report?.scenarios?.map(s=>({variant:s.variant,cost:s.cost,trades:s.count,pnlBRL:s.pnlBRL})),url:origin+'/pesquisa-genetica/experimento-noticias.html'}));}
}else if(action==='stop'){
 if(fs.existsSync(activeFile)){const {dir,registration}=files(),lock=path.join(dir,'runner.lock'),pid=fs.existsSync(lock)?Number(fs.readFileSync(lock)):null;if(alive(pid))process.kill(pid,'SIGTERM');publish(registration,'stopped',{lastError:null});}console.log(JSON.stringify({stopped:true,preserved:true}));
}else throw Error('Use start, status, stop, tick ou run');
