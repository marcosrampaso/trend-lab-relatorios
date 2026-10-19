import fs from'node:fs';import path from'node:path';import{createHash}from'node:crypto';import{fileURLToPath}from'node:url';
import{execFileSync}from'node:child_process';
import{read,hash,verifyScalpInputs,scalpDataSource}from'./scalp-tree-data.mjs';import{atomic,summarize}from'./extended-ml-utils.mjs';
import{averagePredictions}from'./local-ml-evaluation.mjs';import{monthAt}from'../web/scalp-tree.js';import{simulateAdaptive}from'../web/adaptive-engine.js';import{routedSignals}from'../web/adaptive-policy.js';import{dailyEquity,monthlyEquity,cdiWindow}from'../web/compound-math.js';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));process.chdir(root);const watch=process.argv.includes('--watch');let stopped=false;process.on('SIGTERM',()=>{stopped=true;});process.on('SIGINT',()=>{stopped=true;});
const statusFile='web/data/compound-benchmark-status.json';function status(extra){atomic(statusFile,{pid:process.pid,updatedAt:new Date().toISOString(),...extra});}
function ensureLeverage(reference){
 const file='web/data/leverage-study-results.json',saved=fs.existsSync(file)?read(file):null;
 if(saved?.runId===reference.runId&&saved.genomeId===reference.genomeId&&saved.sources?.['web/data/compound-benchmark-results.json']===hash('web/data/compound-benchmark-results.json'))return;
 console.log(execFileSync(process.execPath,['scripts/analyze-leverage.mjs'],{cwd:root,encoding:'utf8'}).trim());
}
function evaluate(){
 const campaign=read('web/data/adaptive-evolution-status.json'),run=path.join('work/local-ml/runs',campaign.runId),report=read(path.join(run,'report.json'));if(!report.winner)return;
 const p=read('compound-benchmark-protocol.json'),registration=read(path.join(run,'registration.json')),g=report.winner.genome;
 for(const f of ['web/adaptive-engine.js','web/adaptive-policy.js','scripts/adaptive-genetic.py','scripts/local-ml-evaluation.mjs','scalping-protocol.json','data/scalp-tree/features.json'])if(hash(f)!==registration.fingerprint[f])throw Error('Fonte da campanha alterada: '+f);
 const sourceFiles=['compound-benchmark-protocol.json','scripts/compound-benchmark.mjs','web/compound-math.js',path.join(run,'registration.json')];for(const f of ['data/cdi/daily.json','data/cdi/monthly.json','data/cdi/sources.json'])if(fs.existsSync(f))sourceFiles.push(f);
 const sources=Object.fromEntries(sourceFiles.map(f=>[f,hash(f)])),key=createHash('sha256').update(JSON.stringify({run:campaign.runId,genome:g.id,sources})).digest('hex'),folder=path.join('work/compound-benchmark',campaign.runId),target=path.join(folder,key+'.json');
 if(fs.existsSync(target)){const saved=read(target);atomic('web/data/compound-benchmark-results.json',saved);ensureLeverage(saved);status({state:'watching',runId:campaign.runId,genomeId:g.id,evaluatedAt:saved.generatedAt,capitalBRL:p.capitalBRL});return;}
 status({state:'evaluating',runId:campaign.runId,genomeId:g.id,capitalBRL:p.capitalBRL});
 const input=read('data/scalp-tree/features.json'),featureMaps=Object.fromEntries(registration.protocol.families.map(f=>[f,new Map(input.features[f].map(r=>[r.at,r]))])),source=scalpDataSource(read('web/data/eth-donchian-history.json'),verifyScalpInputs()),strategy={...read('scalping-protocol.json'),capitalBRL:p.capitalBRL},modelCache=read(path.join(run,'model-cache.json'));
 const cdiReady=['daily','monthly','sources'].every(f=>fs.existsSync('data/cdi/'+f+'.json')),daily=cdiReady?read('data/cdi/daily.json'):[],monthly=cdiReady?read('data/cdi/monthly.json'):[],cdiSources=cdiReady?read('data/cdi/sources.json'):null,blocks=[];
 if(cdiSources)for(const source of cdiSources.sources)if(hash(source.normalizedFile)!==source.normalizedSHA256||hash(source.rawFile)!==source.rawSHA256)throw Error('Fonte CDI alterada');
 const keyScript="import importlib.util,json,sys; s=importlib.util.spec_from_file_location('benchmark_genetic_helpers','scripts/adaptive-genetic.py'); m=importlib.util.module_from_spec(s); s.loader.exec_module(m); g=json.load(sys.stdin); print(json.dumps({a['family']+'/'+str(a['hold']):m.model_key(g,a['family'],a['hold']) for a in g['routes'].values() if a['family']}))";
 const modelKeys=JSON.parse(execFileSync(path.join(root,'.venv-ml/bin/python'),['-c',keyScript],{input:JSON.stringify(g),encoding:'utf8'}));
 for(const fold of registration.protocol.validationFolds){
  const start=monthAt(fold,-3),end=monthAt(fold),predictions=new Map();
  for(const arm of Object.values(g.routes)){
   const armId=arm.family+'/'+arm.hold;if(!arm.family||arm.threshold===0||predictions.has(armId))continue;
   const cached=modelCache[modelKeys[armId]];if(!cached)throw Error('Modelo do campeão não encontrado: '+armId);
   const files=cached.filter(file=>{if(!path.resolve(file).startsWith(path.resolve(run)+path.sep))throw Error('Predição externa');return true;}),rows=files.map(file=>{sources[file]=hash(file);const r=read(file);return{...r,test:[]};}).filter(r=>r.fold===fold);
   const expected=registration.protocol.repeatAlgorithms.includes(g.algorithm)?registration.protocol.seeds.length:1;if(rows.length!==expected||rows.some(r=>r.skipped))throw Error('Réplicas indisponíveis');const [prediction]=averagePredictions(rows);if(prediction.trainEnd!==monthAt(fold,-3)||prediction.validationEnd!==monthAt(fold))throw Error('Fronteira de informação inválida');predictions.set(armId,new Map(prediction.validation));
  }
  const data=source.window(start,end),signals=routedSignals(input.signals,featureMaps,g,predictions,{start,end}),block={fold,start,end,initialBRL:p.capitalBRL,cdi:cdiReady?cdiWindow(daily,monthly,start,end,p.capitalBRL):{available:false,reason:'Fonte oficial de CDI indisponível nesta coleta; não foi estimada uma taxa.',curve:[]}};
  for(const cost of strategy.costCases){
   const r=simulateAdaptive(data,{start,until:end,protocol:strategy,cost,signals,closeAtEnd:true});if(r.trades.some(t=>t.exitAt-t.entryAt>t.holdMinutes*60000))throw Error('Duração excedida');const s=summarize(r,1440),reset=report.winner.metrics.find(m=>m.fold===fold)?.months?.reduce((n,m)=>n+m[cost.id].pnlUSDT,0);
   block[cost.id]={...s,finalBRL:r.final*p.fx,profitBRL:r.pnl*p.fx,returnPct:r.returnPct,curve:dailyEquity(r.equity,start,r.initial,p.fx),months:monthlyEquity(r.equity,start,end,r.initial,p.fx),trades:r.trades.map(({context,...t})=>t),monthlyResetProfitBRL:Number.isFinite(reset)?reset*p.fx:null,excessCDIPoints:block.cdi.available?(r.returnPct-block.cdi.returnPct)*100:null,excessCDIBRL:block.cdi.available?r.final*p.fx-block.cdi.finalBRL:null};
  }blocks.push(block);
 }
 const result={version:p.version,runId:campaign.runId,genomeId:g.id,genome:g,generation:report.generation,generatedAt:new Date().toISOString(),capitalBRL:p.capitalBRL,fx:p.fx,risk:p.risk,blocks,cdiSources,sources,usedForSelection:false,consultedFinalTest:false,realOrders:false,caveat:'Três blocos independentes de validação já conhecida, cada um composto por três meses contínuos. Não são uma carteira de nove meses consecutivos nem teste prospectivo. Câmbio fixo hipotético; antes de impostos.'};atomic(target,result);atomic('web/data/compound-benchmark-results.json',result);ensureLeverage(result);status({state:'watching',runId:campaign.runId,genomeId:g.id,evaluatedAt:result.generatedAt,capitalBRL:p.capitalBRL});console.log(JSON.stringify({runId:campaign.runId,genomeId:g.id,cdiAvailable:blocks.every(b=>b.cdi.available),blocks:blocks.map(b=>({fold:b.fold,stressBRL:b.stress.profitBRL,cdiBRL:b.cdi.profitBRL??null}))}));
}
do{
 try{evaluate();}catch(e){status({state:'failed',reason:e.message});console.error(e.stack);if(!watch)process.exitCode=1;}
 const campaign=read('web/data/adaptive-evolution-status.json');if(!watch||['completed','stopped','time_limit','disk_limit','failed'].includes(campaign.state))break;
 await new Promise(resolve=>{const timer=setTimeout(resolve,60000);const wake=()=>{clearTimeout(timer);process.off('SIGTERM',wake);process.off('SIGINT',wake);resolve();};process.once('SIGTERM',wake);process.once('SIGINT',wake);setTimeout(()=>{process.off('SIGTERM',wake);process.off('SIGINT',wake);},60100).unref();});
}while(!stopped);
