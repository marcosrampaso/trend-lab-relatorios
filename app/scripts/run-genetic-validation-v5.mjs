import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {read,hash,scalpDataSource} from './scalp-tree-data.mjs';import {atomic,summarize} from './extended-ml-utils.mjs';
import {buildFolds,fullHistoryPlan,assertWindow,identify,validateGenome,assess,rank,choose,random,mutate,ym,months,canonical} from './genetic-validation-v5-core.mjs';
import {monthAt} from '../web/scalp-tree.js';import {simulateAdaptive} from '../web/research-allocation-v5.js';import {routedSignals} from '../web/adaptive-policy.js';
import {cdiWindow,dailyEquity} from '../web/compound-math.js';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));process.chdir(root);
const RUN='work/genetic-validation-v5/pilot-20261019-v1',PFILE='genetic-validation-v5-protocol.json',p=read(PFILE),S=p.sourceEvaluation,sourceRegistration=read(S+'/registration.json'),baseline=identify({...sourceRegistration.genome,risk:.01,leverage:10});
const coverage=fullHistoryPlan(sourceRegistration.plan.testMonths),foldPlan=coverage.folds,registrationFile=RUN+'/registration.json';
const fileList=[PFILE,'scripts/run-genetic-validation-v5.mjs','scripts/genetic-validation-v5-core.mjs','web/research-allocation-v5.js','web/research-funding-buckets.js','web/adaptive-policy.js','web/engine.js','web/scalping.js','web/scalp-tree.js','web/compound-math.js','scripts/extended-ml-utils.mjs','scripts/scalp-tree-data.mjs','scalping-protocol.json',S+'/registration.json','data/scalp-tree-extended/manifest.json','web/data/eth-donchian-history.json','data/cdi/extended/daily.json','data/cdi/extended/monthly.json',...read('data/scalp-tree-extended/manifest.json').months.map(m=>m.path),...fs.readdirSync(S+'/predictions').filter(f=>f.endsWith('.json')).map(f=>S+'/predictions/'+f),...fs.readdirSync(S+'/months').filter(f=>f.endsWith('.json')).map(f=>S+'/months/'+f)];
const sourceHashes=Object.fromEntries(fileList.map(f=>[f,hash(f)]));
if(!fs.existsSync(registrationFile)){
 const prior=read('work/local-ml/runs/'+p.parentRun+'/registration.json'),now=Date.now();
 atomic(registrationFile,{registeredAt:new Date(now).toISOString(),deadlineAt:new Date(Math.min(now+p.maximumHours*3600000,Date.parse(prior.deadlineAt))).toISOString(),protocol:p,folds:foldPlan,coverage,baseline,originGenomeId:sourceRegistration.genome.id,sourceHashes,predictorInherited:true,historyAlreadyExamined:true,independentHoldout:false,newMLFits:0,realOrders:false});
}
const registration=read(registrationFile),registrationSHA256=hash(registrationFile);
if(canonical(registration.sourceHashes)!==canonical(sourceHashes))throw Error('Registro divergiu; preservar o piloto anterior');
if(process.argv.includes('--register-only')){console.log(JSON.stringify({registered:registrationFile,folds:foldPlan.length,maximumDistinctCandidates:p.maximumDistinctCandidatesPerFold*foldPlan.length}));process.exit(0);}
const strategy={...read('scalping-protocol.json'),capitalBRL:p.capitalBRL},manifest=read('data/scalp-tree-extended/manifest.json'),source=scalpDataSource(read('web/data/eth-donchian-history.json'),manifest),daily=read('data/cdi/extended/daily.json'),monthly=read('data/cdi/extended/monthly.json');
const models=new Map(),monthModel=new Map();for(const b of sourceRegistration.plan.blocks)for(const m of b.months)monthModel.set(m,b.id);
const windows=new Map(),results=[];let stopped=false,caseCount=0;process.on('SIGTERM',()=>{stopped=true;});process.on('SIGINT',()=>{stopped=true;});
function limit(){const disk=fs.statfsSync(root);if(stopped)throw Error('interrompido');if(Date.now()>=Date.parse(registration.deadlineAt))throw Error('prazo encerrado');if(disk.bavail*disk.bsize<p.minimumFreeDiskGB*1024**3)throw Error('limite de disco');}
function status(stage,extra={}){atomic(RUN+'/status.json',{...(fs.existsSync(RUN+'/status.json')?read(RUN+'/status.json'):{}),stage,updatedAt:new Date().toISOString(),pid:process.pid,workers:1,newMLFits:0,caseCount,...extra});}
function prediction(month,family){
 const block=monthModel.get(month),key=block+'/'+family;
 if(!models.has(key)){
  const r=read(S+'/predictions/'+block+'-'+family+'.json');
  if(r.registrationSHA256!==hash(S+'/registration.json')||r.trainEnd!==monthAt(block)||r.maxTrainLabelAvailableAt>=r.trainEnd||r.seeds.length!==5||canonical(r.modelParams)!==canonical(baseline.params))throw Error('Modelo herdado sem corte causal');
  models.set(key,{...r,scores:new Map(r.predictions)});
 }
 const model=models.get(key);if(model.trainEnd>monthAt(month))throw Error('Modelo futuro');return model;
}
function dataFor(start,end){
 const key=start+'/'+end;if(windows.has(key))return windows.get(key);
 const parts=months(start,end).map(m=>read(S+'/months/'+m+'.json')),features={},signals={},predictions=new Map();
 for(const f of ['cross','vwap','bands']){features[f]=new Map(parts.flatMap(m=>m.features[f]).map(r=>[r.at,r]));signals[f]=parts.flatMap(m=>m.signals[f]);}
 for(const f of ['cross','bands']){
  const pairs=[];for(const m of months(start,end)){const model=prediction(m,f);for(const row of parts.find(x=>x.month===m).features[f]){const v=model.scores.get(row.at);if(!Number.isFinite(v)||v<0||v>1||row.hourlyAt>row.at||row.fourHourlyAt>row.at)throw Error('Score/feature inválido');pairs.push([row.at,v]);}}
  predictions.set(f+'/'+(f==='cross'?120:240),new Map(pairs));
 }
 const a=monthAt(start),b=monthAt(end),cdi=cdiWindow(daily,monthly,a,b,p.capitalBRL);if(!cdi.available)throw Error('CDI incompleto');delete cdi.curve;
 const result={a,b,cdi,data:source.window(a,b),features,signals,predictions};windows.set(key,result);if(windows.size>5)windows.delete(windows.keys().next().value);return result;
}
function evaluate(g,fold,phase,start,end,frozen=null){
 assertWindow(fold,phase,start,end,frozen);validateGenome(g,baseline);
 if(phase==='outer'&&(!fs.existsSync(RUN+'/frozen/'+fold.id+'.json')||hash(RUN+'/frozen/'+fold.id+'.json')!==frozen.frozenSHA256||![frozen.genome.id,baseline.id,'cash'].includes(g.id)))throw Error('Escolha externa não foi congelada');
 const target=RUN+'/cache/'+g.id+'-'+start+'-'+end+'.json';
 if(fs.existsSync(target)){const saved=read(target);if(saved.registrationSHA256!==registrationSHA256)throw Error('Cache incompatível');return saved.result;}
 limit();const w=dataFor(start,end),signals=g.id==='cash'?[]:routedSignals(w.signals,w.features,g,w.predictions,{start:w.a,end:w.b}),result={start,end,cdi:w.cdi};
 for(const cost of strategy.costCases){
  const sim=simulateAdaptive(w.data,{start:w.a,until:w.b,protocol:{...strategy,risk:g.risk??.01,leverage:g.leverage??10},cost,signals,closeAtEnd:true});const summary=summarize(sim,1440);
  if(sim.trades.some(t=>t.exitAt-t.entryAt>t.holdMinutes*60000))throw Error('Prazo inválido');
  result[cost.id]={...summary,pnlBRL:sim.pnl*5,risk:g.risk??.01,leverage:g.leverage??10,maximumPlannedRiskBRL:Math.max(0,...sim.trades.map(t=>t.plannedRisk*5)),averageMarginBRL:sim.trades.length?sim.trades.reduce((n,t)=>n+t.margin*5,0)/sim.trades.length:0,liquidations:sim.trades.filter(t=>t.reason==='Liquidação estimada').length,curve:dailyEquity(sim.equity,w.a,200,5),trades:sim.trades.map(({context,...t})=>t)};caseCount++;
 }
 atomic(target,{registrationSHA256,genomeId:g.id,result});return result;
}
function publish(){
 const outer=results.filter(r=>r.outer),sum=(which,k)=>outer.reduce((s,r)=>s+r.outer[which][k].pnlBRL,0),count=(which,k)=>outer.reduce((s,r)=>s+r.outer[which][k].count,0),beats=outer.filter(r=>r.outer.selected.stress.pnlBRL>r.outer.selected.cdi.profitBRL).length;
 const summary={foldsCompleted:outer.length,totalFolds:foldPlan.length,monthsEvaluated:outer.reduce((n,r)=>n+r.fold.outerMonths.length,0),selectedBaseBRL:sum('selected','base'),selectedStressBRL:sum('selected','stress'),fixedChampionStressBRL:sum('baseline','stress'),selectedTrades:count('selected','stress'),cdiBRL:outer.reduce((s,r)=>s+r.outer.selected.cdi.profitBRL,0),blocksAboveCDI:beats,cashFallbacks:outer.filter(r=>r.frozen.genome.id==='cash').length,totalCandidateEvaluations:results.reduce((n,r)=>n+r.candidates.length,0)};
 const retrospectiveGates=outer.length===foldPlan.length&&summary.selectedStressBRL>0&&summary.selectedBaseBRL>0&&summary.selectedTrades>=p.finalCriteria.minimumTrades&&beats>=Math.ceil(foldPlan.length*p.finalCriteria.minimumFractionAboveCDI);
 const report={updatedAt:new Date().toISOString(),stage:read(RUN+'/status.json').stage,registrationSHA256,protocol:p,coverage,folds:results,summary,retrospectiveGates,independentHoldout:false,predictorInherited:true,historyAlreadyExamined:true,realOrders:false,promoted:false,newMLFits:0};
 atomic(RUN+'/report.json',report);atomic('web/data/genetic-validation-v5.json',report);
}
try{
 status('running',{foldsTotal:foldPlan.length});publish();
 for(const [index,fold] of foldPlan.entries()){
  limit();windows.clear();const completed=RUN+'/folds/'+fold.id+'.json';
  if(fs.existsSync(completed)){const r=read(completed);if(r.registrationSHA256!==registrationSHA256)throw Error('Janela incompatível');results.push(r);publish();continue;}
  const rng=random(p.seed+index),seen=new Map(),history=[];let population=[baseline,...p.initialProfiles.map(([risk,leverage])=>identify({...baseline,risk,leverage}))],stagnation=0,previous=null;
  while(population.length<p.populationSize){const g=mutate(baseline,rng);if(!population.some(q=>q.id===g.id))population.push(g);}
  for(let generation=0;generation<p.maxGenerations;generation++){
   for(const genome of population){if(seen.has(genome.id))continue;
    if(seen.size>=p.maximumDistinctCandidatesPerFold)throw Error('Orçamento de hipóteses excedido');
    const blocks=fold.innerBlocks.map(b=>evaluate(genome,fold,'inner',b.start,b.end)),metrics=assess(blocks,p.criteria);seen.set(genome.id,{genome,metrics,blocks});await new Promise(resolve=>setImmediate(resolve));
    status('selecting',{fold:fold.id,generation,candidatesThisFold:seen.size,candidatesCompleted:results.reduce((n,r)=>n+r.candidates.length,0)+seen.size});
   }
   const ranking=[...seen.values()].sort(rank),top=ranking[0],score=top.metrics.worstQuarterExcessBRL;
   history.push({generation,uniqueCandidates:seen.size,bestInnerWorstQuarterExcessBRL:score,eligible:ranking.filter(c=>c.metrics.eligible).length});
   stagnation=previous!==null&&score<=previous+.05?stagnation+1:0;previous=score;
   atomic(RUN+'/search/'+fold.id+'.json',{fold,generation,history,candidates:[...seen.values()],usedOuterResults:false});
   if(generation===p.maxGenerations-1||stagnation>=p.stopAfterStagnantGenerations)break;
   population=ranking.slice(0,p.eliteCount).map(c=>c.genome);let attempts=0;
   while(population.length<p.populationSize){if(attempts++>10000)throw Error('Não foi possível gerar variantes inéditas');const g=mutate(ranking[Math.floor(rng()*Math.min(4,ranking.length))].genome,rng);if(!seen.has(g.id)&&!population.some(q=>q.id===g.id))population.push(g);}
  }
  const candidates=[...seen.values()],winner=choose(candidates),frozenFile=RUN+'/frozen/'+fold.id+'.json',frozen={fold:fold.id,createdAt:new Date().toISOString(),registrationSHA256,genome:winner?.genome??{id:'cash'},reason:winner?'Aprovado somente nos critérios internos':'Nenhum candidato elegível nos critérios internos; não operar',metrics:winner?.metrics??null,selectionWindow:{start:fold.innerStart,end:fold.innerEnd},gapMonth:fold.gapMonth,attempts:seen.size,searchSHA256:hash(RUN+'/search/'+fold.id+'.json'),usedOuterResults:false};
  if(fs.existsSync(frozenFile)){const old=read(frozenFile);if(old.registrationSHA256!==registrationSHA256||canonical(old.genome)!==canonical(frozen.genome))throw Error('Escolha anterior divergiu');Object.assign(frozen,old);}else atomic(frozenFile,frozen);
  frozen.frozenSHA256=hash(frozenFile);status('evaluating_outer',{fold:fold.id,frozenWinner:frozen.genome.id});
  const outer={selected:evaluate(frozen.genome,fold,'outer',fold.outerStart,fold.outerEnd,frozen),baseline:evaluate(baseline,fold,'outer',fold.outerStart,fold.outerEnd,frozen),cash:evaluate({id:'cash'},fold,'outer',fold.outerStart,fold.outerEnd,frozen)};
  const result={fold,registrationSHA256,candidates,history,frozen,outer};atomic(completed,result);results.push(result);publish();
  console.log(JSON.stringify({fold:fold.id,candidates:seen.size,winner:frozen.genome.id,outerStressBRL:outer.selected.stress.pnlBRL,cdiBRL:outer.selected.cdi.profitBRL}));
 }
 status('complete',{finishedAt:new Date().toISOString()});publish();
}catch(error){status('failed',{reason:error.message});publish();throw error;}
