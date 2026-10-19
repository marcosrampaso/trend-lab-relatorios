import fs from 'node:fs';
import path from 'node:path';
import {read,hash,verifyScalpInputs,scalpDataSource} from './scalp-tree-data.mjs';
import {monthAt,pairedMonthlyInterval} from '../web/scalp-tree.js';
import {simulateScalpTree} from '../web/scalp-tree-engine.js';
import {summarizeScalp} from './train-scalp-tree.mjs';
import {averagePredictions,rankTrials,approvedTrial} from './local-ml-evaluation.mjs';

const run=path.resolve(process.argv[2]??'');
if(!run.startsWith(path.resolve('work/local-ml/runs')+path.sep))throw Error('Diretório de rodada inválido');
const registration=read(path.join(run,'registration.json')),p=registration.protocol;
const previous=path.join(run,'evaluation.json');
if(fs.existsSync(previous)){
  const result=read(previous);if(result.fingerprint!==hash(path.join(run,'registration.json')))throw Error('Avaliação incompatível');
  fs.writeFileSync('web/data/cpu-training-results.json',JSON.stringify(result));console.log('Avaliação concluída anterior preservada.');process.exit(0);
}
const manifest=verifyScalpInputs(),history=read('web/data/eth-donchian-history.json'),source=scalpDataSource(history,manifest);
const input=read('data/scalp-tree/features.json'),strategy={...read('scalping-protocol.json'),maxHoldMinutes:30};
const tasks=read(path.join(run,'tasks.json')).tasks;
const keys=[...new Set(tasks.map(t=>t.family+'/'+t.fold))];
const scenarios=[],selection=[],trials=[],stability=[];
function atomic(file,value){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file+'.tmp',JSON.stringify(value));fs.renameSync(file+'.tmp',file);}
for(const key of keys){
  const file=path.join(run,'evaluation',key.replace('/','-')+'.json');
  if(fs.existsSync(file)){const part=read(file);scenarios.push(...part.scenarios);selection.push(part.selection);trials.push(...part.trials);stability.push(...part.stability);continue;}
  const [family,fold]=key.split('/'),start=monthAt(fold),validationStart=monthAt(fold,-3),until=monthAt(fold,3);
  const data=source.window(validationStart,until),windowData=(a,b)=>({...data,candles:data.candles.filter(r=>r[0]>=a&&r[0]+60000<=b),marks:data.marks.filter(r=>r[0]>=a&&r[0]+60000<=b),funding:data.funding.filter(r=>r[0]>=a&&r[0]<b)});
  const valData=windowData(validationStart,start),monthlyData=Array.from({length:3},(_,i)=>windowData(monthAt(fold,i),monthAt(fold,i+1)));
  const signals=(a,b)=>({signals:{[family]:input.signals[family].filter(s=>s.at>=a&&s.at<b)}});
  const cache=new Map();
  const execute=(a,b,d,cost,prediction,threshold)=>{
    const id=[a,b,cost,threshold===0?'control':prediction.id,threshold].join('/');
    if(cache.has(id))return cache.get(id);
    const scores=threshold>0?new Map([...prediction.validation,...prediction.test]):null;
    if(prediction&&prediction.validationEnd>a)throw Error('Modelo ainda não disponível');
    const r=simulateScalpTree(d,{strategy:family,start:a,until:b,protocol:strategy,cost:strategy.costCases.find(c=>c.id===cost),prepared:signals(a,b),closeAtEnd:true,
      entryFilter:threshold===0?null:sig=>scores.has(sig.at)&&scores.get(sig.at)>=threshold?null:'Árvore/modelo vetou nova entrada'});
    const result={...summarizeScalp(r),trades:r.trades.map(({context,...t})=>t)};cache.set(id,result);return result;
  };
  const controls=Object.fromEntries(['base','stress'].map(c=>[c,execute(validationStart,start,valData,c,null,0)]));
  const foldTrials=[];
  const replicas=tasks.filter(t=>t.family===family&&t.fold===fold).map(t=>read(path.join(run,'predictions',t.id+'.json')));
  const predictions=averagePredictions(replicas);
  const partStability=predictions.map(r=>({family,fold,configId:r.config.id,seeds:r.replicas,meanValidationSeedRange:r.meanValidationSeedRange,warnings:replicas.filter(v=>v.config.id===r.config.id).flatMap(v=>v.warnings)}));
  for(const prediction of predictions){
    if(prediction.trainEnd>validationStart||prediction.maxTrainLabelAvailableAt>=prediction.trainEnd||prediction.validationEnd!==start)throw Error('Corte de informação incorreto');
    // The model was fitted before validation; its threshold is chosen only at its end.
    const validationPrediction={...prediction,validationEnd:prediction.trainEnd};
    for(const threshold of p.thresholds){
      const coverage=threshold===0?1:prediction.validation.filter(([,v])=>v>=threshold).length/prediction.validation.length;
      if(threshold>0&&coverage<p.minimumValidationCoverage){foldTrials.push({family,fold,configId:prediction.config.id,algorithm:prediction.config.algorithm,threshold,coverage,eligible:false,reason:'Pouca cobertura'});continue;}
      const b=execute(validationStart,start,valData,'base',validationPrediction,threshold),s=execute(validationStart,start,valData,'stress',validationPrediction,threshold);
      const eligible=threshold===0||Math.min(b.count,s.count)>=p.minimumValidationTradesBothCosts&&b.maxDD<=controls.base.maxDD+p.maxDrawdownDeterioration&&s.maxDD<=controls.stress.maxDD+p.maxDrawdownDeterioration;
      foldTrials.push({family,fold,configId:prediction.config.id,algorithm:prediction.config.algorithm,threshold,coverage,eligible,basePnL:b.pnlUSDT,stressPnL:s.pnlUSDT,baseCount:b.count,stressCount:s.count,baseDD:b.maxDD,stressDD:s.maxDD,robustUSDT:Math.min(b.pnlUSDT,s.pnlUSDT)});
    }
  }
  const ranked=rankTrials(foldTrials,p.configs),chosen=ranked[0];
  const approved=approvedTrial(chosen,controls);
  const chosenPerAlgorithm=[...new Set(predictions.map(t=>t.config.algorithm))].map(algorithm=>ranked.find(t=>t.algorithm===algorithm));
  const partScenarios=[];
  for(let i=0;i<3;i++){
    const a=monthAt(fold,i),b=monthAt(fold,i+1),month=new Date(a).toISOString().slice(0,7);
    const variants=[{algorithm:'no_filter',threshold:0,configId:null},...chosenPerAlgorithm.map(c=>({...c})),{...chosen,algorithm:'selected_by_validation'},{...chosen,algorithm:'cash_policy',cash:!approved}];
    for(const variant of variants)for(const costCase of ['base','stress']){
      const prediction=predictions.find(t=>t.config.id===variant.configId);
      const r=variant.cash?{pnlUSDT:0,finalUSDT:60,count:0,signals:0,vetoes:0,maxDD:0,halted:false,haltAt:null,feesUSDT:0,fundingUSDT:0,grossUSDT:0,slippageUSDT:0,winRate:null,expectancyUSDT:null,profitFactor:null,avgMinutes:null,trades:[]}:execute(a,b,monthlyData[i],costCase,prediction,variant.threshold);
      partScenarios.push({family,fold,month,costCase,algorithm:variant.algorithm,configId:variant.configId,threshold:variant.threshold,approvedByValidation:approved,cash:Boolean(variant.cash),...r});
    }
  }
  const decision={family,fold,chosen,approved,reason:approved?'Candidato positivo na validação, somente pesquisa':'Nenhum candidato aprovado; política recomenda caixa'};
  const part={trials:foldTrials,selection:decision,scenarios:partScenarios,stability:partStability};atomic(file,part);
  trials.push(...foldTrials);selection.push(decision);scenarios.push(...partScenarios);stability.push(...partStability);
  console.log(JSON.stringify({family,fold,chosen:chosen.configId,threshold:chosen.threshold,approved,complete:selection.length,total:keys.length}));
}
const summaries=[];
for(const family of p.families)for(const algorithm of [...new Set(scenarios.filter(s=>s.family===family).map(s=>s.algorithm))]){
  const own=scenarios.filter(s=>s.family===family&&s.algorithm===algorithm),base=own.filter(s=>s.costCase==='base'),stress=own.filter(s=>s.costCase==='stress');
  const controls=stress.map(s=>scenarios.find(c=>c.family===family&&c.algorithm==='no_filter'&&c.costCase==='stress'&&c.month===s.month));
  const avg=a=>a.reduce((n,s)=>n+s.pnlUSDT,0)/a.length;
  summaries.push({family,algorithm,months:stress.length,baseMeanUSDT:avg(base),stressMeanUSDT:avg(stress),stressTrades:stress.reduce((n,s)=>n+s.count,0),positiveStressMonths:stress.filter(s=>s.pnlUSDT>0).length,
    maxMonthlyDD:Math.max(...stress.map(s=>s.maxDD)),difference:pairedMonthlyInterval(stress.map((s,i)=>s.pnlUSDT-controls[i].pnlUSDT),{comparisons:21,replicates:5000,blockMonths:3,seed:p.seed}),
    note:'Comparação retrospectiva; cada mês reiniciaR$300. Média mensal, não retorno composto.'});
}
const report={runId:path.basename(run),fingerprint:hash(path.join(run,'registration.json')),completedAt:new Date().toISOString(),profile:registration.fingerprint.profile,quick:registration.fingerprint.quick,taskCount:tasks.length,protocol:p,selection,summaries,stability,
  scenarios:scenarios.map(({trades,...s})=>s),trials,realOrders:false,prospectiveApplied:false,
  caveat:'Os períodos já foram usados em pesquisa anterior. Sem novo holdout intocado. Estudos em ações não provam rentabilidade do scalping deETH. A escolha para cada trimestre usa somente a validação anterior.'};
atomic(previous,report);atomic('web/data/cpu-training-results.json',report);
console.log(JSON.stringify({done:true,scenarios:scenarios.length,approved:selection.filter(s=>s.approved).length,selections:selection.length}));
