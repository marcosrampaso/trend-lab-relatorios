import fs from'node:fs';import path from'node:path';
import{read,verifyScalpInputs,scalpDataSource}from'./scalp-tree-data.mjs';
import{monthAt}from'../web/scalp-tree.js';import{simulateScalpTree}from'../web/scalp-tree-engine.js';
import{averagePredictions}from'./local-ml-evaluation.mjs';import{atomic,summarize}from'./extended-ml-utils.mjs';
const run=path.resolve(process.argv[2]??''),request=read(process.argv[3]);if(!run.startsWith(path.resolve('work/local-ml/runs')+path.sep))throw Error('Diretório inválido');
const bp=read(path.join(request.baseRun,'registration.json')).protocol,p=read(path.join(run,'registration.json')).protocol,input=read('data/scalp-tree/features.json'),strategy=read('scalping-protocol.json'),source=scalpDataSource(read('web/data/eth-donchian-history.json'),verifyScalpInputs());
const months=new Map(),cache=new Map();
function dataFor(month){if(!months.has(month)){const a=monthAt(month),b=monthAt(month,1);months.set(month,{a,b,data:source.window(a,b)});}return months.get(month);}
function execute(genome,prediction,month,cost,hold=genome.hold,threshold=genome.threshold,final=false){
 const key=[genome.family,hold,month,cost,threshold===0?'control':genome.id,threshold,final].join('/');if(cache.has(key))return cache.get(key);
 const{a,b,data}=dataFor(month);if(prediction&&(final?prediction.validationEnd:prediction.trainEnd)>a)throw Error('Modelo futuro');
 const scores=threshold>0?new Map(final?prediction.test:prediction.validation):null;
 const r=simulateScalpTree(data,{strategy:genome.family,start:a,until:b,protocol:{...strategy,maxHoldMinutes:hold},cost:strategy.costCases.find(c=>c.id===cost),prepared:{signals:{[genome.family]:input.signals[genome.family].filter(s=>s.at>=a&&s.at<b)}},entryFilter:threshold===0?null:sig=>scores.has(sig.at)&&scores.get(sig.at)>=threshold?null:'Árvore/modelo vetou nova entrada',closeAtEnd:true});
 const out={...summarize(r,hold),trades:final?r.trades.map(({context,...t})=>t):undefined};cache.set(key,out);return out;
}
const candidates=[];
for(const g of request.genomes){
 const{predictionFiles,...genome}=g;
 for(const file of predictionFiles){const absolute=path.resolve(file);if(![run,request.baseRun].some(root=>absolute.startsWith(path.resolve(root)+path.sep)))throw Error('Predição fora da rodada');}
 const replicas=predictionFiles.map(read);
 if(request.final){
  const frozen=read(path.join(run,'winner-frozen.json'));if(frozen.winner.genome.id!==genome.id)throw Error('Vencedor não congelado');
  const rows=replicas.filter(r=>r.fold===request.finalTestFold&&!r.skipped),[prediction]=averagePredictions(rows);
  if(prediction.validationEnd!==monthAt(request.finalTestFold))throw Error('Corte final inválido');
  const result={genome,month:request.finalTestFold,base:execute(genome,prediction,request.finalTestFold,'base',genome.hold,genome.threshold,true),stress:execute(genome,prediction,request.finalTestFold,'stress',genome.hold,genome.threshold,true),controls:{base:execute(genome,null,request.finalTestFold,'base',30,0,true),stress:execute(genome,null,request.finalTestFold,'stress',30,0,true)},realOrders:false,usedForSelection:false,caveat:'Mês conhecido no projeto, consultado uma vez nesta genética após congelar o vencedor.'};atomic(path.join(run,'final-result.json'),result);process.exit(0);
 }
 let eligible=true,baseSum=0,stressSum=0;const metrics=[];
 for(const fold of request.folds){
  const rows=replicas.filter(r=>r.fold===fold);if(!rows.length||rows.some(r=>r.skipped)){eligible=false;metrics.push({fold,reason:'Modelo indisponível'});continue;}
  const[prediction]=averagePredictions(rows);if(prediction.validationEnd!==monthAt(fold)||prediction.trainEnd!==monthAt(fold,-3))throw Error('Fronteira inválida');
  const coverage=genome.threshold===0?1:prediction.validation.filter(([,s])=>s>=genome.threshold).length/prediction.validation.length;
  const values={};
  for(const cost of['base','stress']){
   const a=Array.from({length:3},(_,i)=>{const month=new Date(monthAt(fold,i-3)).toISOString().slice(0,7);return{own:execute(genome,prediction,month,cost),control:execute(genome,null,month,cost,30,0)};});
   values[cost]={pnlUSDT:a.reduce((n,r)=>n+r.own.pnlUSDT,0),count:a.reduce((n,r)=>n+r.own.count,0),maxDD:Math.max(...a.map(r=>r.own.maxDD)),controlDD:Math.max(...a.map(r=>r.control.maxDD))};
  }
  const accepted=genome.threshold===0||coverage>=bp.minimumValidationCoverage&&Math.min(values.base.count,values.stress.count)>=bp.minimumValidationTradesBothCosts&&['base','stress'].every(c=>values[c].maxDD<=values[c].controlDD+bp.maxDrawdownDeterioration);
  eligible&&=accepted;baseSum+=values.base.pnlUSDT;stressSum+=values.stress.pnlUSDT;metrics.push({fold,coverage,eligible:accepted,...values});
 }
 candidates.push({genome,eligible,fitnessUSDT:eligible?Math.min(baseSum,stressSum)/(request.folds.length*3):null,validationBaseSumUSDT:baseSum,validationStressSumUSDT:stressSum,metrics,source:'validation_only'});
}
atomic(path.join(run,'scores-'+request.generation+'.json'),{generation:request.generation,candidates,usedTestForSelection:false});
