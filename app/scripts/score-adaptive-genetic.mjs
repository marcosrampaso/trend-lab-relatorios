import path from'node:path';
import{read,verifyScalpInputs,scalpDataSource}from'./scalp-tree-data.mjs';
import{monthAt}from'../web/scalp-tree.js';import{simulateAdaptive}from'../web/adaptive-engine.js';import{routedSignals}from'../web/adaptive-policy.js';
import{averagePredictions}from'./local-ml-evaluation.mjs';import{atomic,summarize}from'./extended-ml-utils.mjs';
const run=path.resolve(process.argv[2]??''),request=read(process.argv[3]);if(!run.startsWith(path.resolve('work/local-ml/runs')+path.sep))throw Error('Diretório inválido');
const p=read(path.join(run,'registration.json')).protocol,strategy={...read('scalping-protocol.json'),capitalBRL:p.capitalBRL},input=read('data/scalp-tree/features.json'),featureMaps=Object.fromEntries(p.families.map(f=>[f,new Map(input.features[f].map(r=>[r.at,r]))])),source=scalpDataSource(read('web/data/eth-donchian-history.json'),verifyScalpInputs());
const months=new Map();function dataFor(month){if(!months.has(month)){const a=monthAt(month),b=monthAt(month,1);months.set(month,{a,b,data:source.window(a,b)});}return months.get(month);}
function predictFor(g,fold,final){
 const predictions=new Map();
 for(const arm of Object.values(g.routes)){
  if(!arm.family||arm.threshold===0||predictions.has(arm.family+'/'+arm.hold))continue;
  const files=g.predictionFiles[arm.family+'/'+arm.hold]??[],replicas=files.filter(f=>{if(!path.resolve(f).startsWith(run+path.sep))throw Error('Predição externa');return true;}).map(read).filter(r=>r.fold===fold);
  if(!replicas.length||replicas.some(r=>r.skipped))return null;
  const expected=p.repeatAlgorithms.includes(g.algorithm)?p.seeds.length:1;
  if(replicas.length!==expected)throw Error('Sementes incompletas');
  const [prediction]=averagePredictions(replicas);if(prediction.validationEnd!==monthAt(fold)||prediction.trainEnd!==monthAt(fold,-3))throw Error('Modelo futuro');
  predictions.set(arm.family+'/'+arm.hold,new Map(final?prediction.test:prediction.validation));
 }return predictions;
}
function evaluate(g,fold,final=false){
 const predictions=predictFor(g,fold,final);if(!predictions)return null;
 const rows=[];for(const month of final?[fold]:[-3,-2,-1].map(i=>new Date(monthAt(fold,i)).toISOString().slice(0,7))){
  const{a,b,data}=dataFor(month),signals=routedSignals(input.signals,featureMaps,g,predictions,{start:a,end:b,final});const row={month,decisions:signals.filter(s=>s.entryAllowed).length,regimeDecisions:Object.fromEntries(['trend','range','volatile'].map(k=>[k,signals.filter(s=>s.entryAllowed&&s.regime===k).length]))};
  for(const cost of strategy.costCases){const result=simulateAdaptive(data,{start:a,until:b,protocol:strategy,cost,signals,closeAtEnd:true});row[cost.id]={...summarize(result,1440),trades:final?result.trades.map(({context,...t})=>t):undefined};if(result.trades.some(t=>t.exitAt-t.entryAt>t.holdMinutes*60000))throw Error('Prazo da posição excedido');}
  rows.push(row);
 }return rows;
}
if(request.final){
 const frozen=read(path.join(run,'winner-frozen.json'));if(request.genomes.length!==1||frozen.winner.genome.id!==request.genomes[0].id)throw Error('Vencedor não congelado');
 const rows=evaluate(request.genomes[0],p.finalTestFold,true);atomic(request.output,{month:p.finalTestFold,rows,usedForSelection:false,realOrders:false,capitalBRL:p.capitalBRL,caveat:'Mês já conhecido; teste consultado após congelar vencedor.'});
}else{
 const candidates=[];for(const item of request.genomes){
  const{predictionFiles,...genome}=item;let eligible=true;const metrics=[];
  for(const fold of p.validationFolds){const rows=evaluate(item,fold);if(!rows){eligible=false;metrics.push({fold,reason:'Modelo indisponível'});continue;}
   const sum=cost=>rows.reduce((n,r)=>n+r[cost].pnlUSDT,0),count=cost=>rows.reduce((n,r)=>n+r[cost].count,0),maxDD=Math.max(...rows.flatMap(r=>[r.base.maxDD,r.stress.maxDD]));
   const accepted=Math.min(count('base'),count('stress'))>=p.minimumFoldTradesBothCosts&&maxDD<=p.maximumValidationDrawdown;
   eligible&&=accepted;metrics.push({fold,eligible:accepted,baseSumUSDT:sum('base'),stressSumUSDT:sum('stress'),baseCount:count('base'),stressCount:count('stress'),maxDD,months:rows});
  }
  const values=metrics.filter(m=>m.months),baseSum=values.reduce((n,m)=>n+m.baseSumUSDT,0),stressSum=values.reduce((n,m)=>n+m.stressSumUSDT,0),totalTrades=Math.min(...['baseCount','stressCount'].map(k=>values.reduce((n,m)=>n+m[k],0)));
  eligible&&=totalTrades>=p.minimumTotalTradesBothCosts;
  const mean=Math.min(baseSum,stressSum)/(p.validationFolds.length*3),positiveMonths=values.flatMap(m=>m.months).filter(m=>Math.min(m.base.pnlUSDT,m.stress.pnlUSDT)>0).length,maxDD=Math.max(0,...values.map(m=>m.maxDD));
  candidates.push({genome,eligible,fitnessUSDT:eligible?mean:null,diagnosticMeanUSDT:mean,validationBaseSumUSDT:baseSum,validationStressSumUSDT:stressSum,positiveMonths,maxDD,totalTrades,metrics,source:'validation_only',profitableValidation:eligible&&mean>0});
 }atomic(request.output,{generation:request.generation,candidates,usedTestForSelection:false,capitalBRL:p.capitalBRL});
}
