import fs from'node:fs';import path from'node:path';
import{read,hash,verifyScalpInputs,scalpDataSource}from'./scalp-tree-data.mjs';
import{monthAt,pairedMonthlyInterval}from'../web/scalp-tree.js';
import{simulateScalpTree}from'../web/scalp-tree-engine.js';
import{averagePredictions}from'./local-ml-evaluation.mjs';
import{atomic,publishStage,summarize,rankExtended,approvedExtended}from'./extended-ml-utils.mjs';
const run=path.resolve(process.argv[2]??'');if(!run.startsWith(path.resolve('work/local-ml/runs')+path.sep))throw Error('Diretório inválido');
const registration=read(path.join(run,'registration.json')),p=registration.protocol,previous=path.join(run,'evaluation.json');
if(fs.existsSync(previous)){const r=read(previous);if(r.fingerprint!==hash(path.join(run,'registration.json')))throw Error('Checkpoint incompatível');if(process.env.ML_NO_PUBLIC!=='1')atomic('web/data/cpu-training-results.json',r);process.exit(0);}
const manifest=verifyScalpInputs(),source=scalpDataSource(read('web/data/eth-donchian-history.json'),manifest),input=read('data/scalp-tree/features.json'),strategy=read('scalping-protocol.json'),tasks=read(path.join(run,'tasks.json')).tasks;
const scenarios=[],selection=[],trials=[],stability=[];
for(const family of p.families)for(const fold of p.folds){
 const partFile=path.join(run,'evaluation',family+'-'+fold+'.json');let part;
 if(fs.existsSync(partFile))part=read(partFile);else{
  const start=monthAt(fold),valStart=monthAt(fold,-3),end=monthAt(fold,1),window=source.window(valStart,end);
  const monthly=Array.from({length:4},(_,i)=>{const a=monthAt(fold,i-3),b=monthAt(fold,i-2);return{a,b,data:{...window,candles:window.candles.filter(r=>r[0]>=a&&r[0]+60000<=b),marks:window.marks.filter(r=>r[0]>=a&&r[0]+60000<=b),funding:window.funding.filter(r=>r[0]>=a&&r[0]<b)},prepared:{signals:{[family]:input.signals[family].filter(s=>s.at>=a&&s.at<b)}}};});
  const cache=new Map(),predictions=new Map(),foldTasks=tasks.filter(t=>t.family===family&&t.fold===fold);
  function execute(index,hold,cost,prediction,threshold){
   const key=[index,hold,cost,threshold===0?'control':prediction.id,threshold].join('/');if(cache.has(key))return cache.get(key);
   const {a,b,data,prepared}=monthly[index];if(prediction&&(index===3?prediction.validationEnd:prediction.trainEnd)>a)throw Error('Modelo futuro');
   const scores=threshold>0?new Map(index===3?prediction.test:prediction.validation):null;
   const r=simulateScalpTree(data,{strategy:family,start:a,until:b,protocol:{...strategy,maxHoldMinutes:hold},cost:strategy.costCases.find(c=>c.id===cost),prepared,closeAtEnd:true,entryFilter:threshold===0?null:sig=>scores.has(sig.at)&&scores.get(sig.at)>=threshold?null:'Árvore/modelo vetou nova entrada'});
   const result={...summarize(r,hold),trades:r.trades.map(({context,...t})=>t)};cache.set(key,result);return result;
  }
  function validation(hold,cost,prediction,threshold){const a=[0,1,2].map(i=>execute(i,hold,cost,prediction,threshold));return{pnlUSDT:a.reduce((n,r)=>n+r.pnlUSDT,0),count:a.reduce((n,r)=>n+r.count,0),maxDD:Math.max(...a.map(r=>r.maxDD))};}
  const controls={base:validation(30,'base',null,0),stress:validation(30,'stress',null,0)};controls.robustUSDT=Math.min(controls.base.pnlUSDT,controls.stress.pnlUSDT);
  const foldTrials=[],partStability=[];
  for(const hold of p.holdingMinutes)for(const trainMonths of p.trainWindows){
   const own=foldTasks.filter(t=>t.hold===hold&&t.trainMonths===trainMonths);if(!own.length)continue;
   const replicas=own.map(t=>read(path.join(run,'predictions',t.id+'.json'))).filter(r=>!r.skipped);if(!replicas.length)continue;
   for(const prediction of averagePredictions(replicas)){
    if(prediction.trainEnd!==valStart||prediction.validationEnd!==start||prediction.testEnd!==end)throw Error('Corte temporal divergente');
    prediction.id+='-h'+hold+'-w'+trainMonths;predictions.set(prediction.id,prediction);
    partStability.push({family,fold,hold,trainMonths,configId:prediction.config.id,seeds:prediction.replicas,meanValidationSeedRange:prediction.meanValidationSeedRange,warnings:replicas.filter(r=>r.config.id===prediction.config.id).flatMap(r=>r.warnings)});
    for(const threshold of p.thresholds){
     const coverage=threshold===0?1:prediction.validation.filter(([,v])=>v>=threshold).length/prediction.validation.length;
     const trial={family,fold,hold,trainMonths,predictionId:prediction.id,configId:prediction.config.id,algorithm:prediction.config.algorithm,threshold,coverage};
     if(threshold>0&&coverage<p.minimumValidationCoverage){foldTrials.push({...trial,eligible:false,reason:'Pouca cobertura'});continue;}
     const b=validation(hold,'base',prediction,threshold),s=validation(hold,'stress',prediction,threshold);
     const eligible=threshold===0||Math.min(b.count,s.count)>=p.minimumValidationTradesBothCosts&&b.maxDD<=controls.base.maxDD+p.maxDrawdownDeterioration&&s.maxDD<=controls.stress.maxDD+p.maxDrawdownDeterioration;
     foldTrials.push({...trial,eligible,basePnL:b.pnlUSDT,stressPnL:s.pnlUSDT,baseCount:b.count,stressCount:s.count,baseDD:b.maxDD,stressDD:s.maxDD,robustUSDT:Math.min(b.pnlUSDT,s.pnlUSDT)});
    }
   }
  }
  const ranked=rankExtended(foldTrials,p.configs);if(!ranked.length)throw Error('Nenhum modelo elegível');const chosen=ranked[0],approved=approvedExtended(chosen,controls);
  const perAlgorithm=[...new Set(ranked.map(t=>t.algorithm))].map(algorithm=>ranked.find(t=>t.algorithm===algorithm));
  const variants=[{algorithm:'no_filter',hold:30,trainMonths:null,threshold:0,configId:null},...perAlgorithm,{...chosen,algorithm:'selected_by_validation'},{...chosen,algorithm:'cash_policy',cash:!approved}],ownScenarios=[];
  for(const variant of variants)for(const costCase of ['base','stress']){
   const r=variant.cash?{pnlUSDT:0,finalUSDT:60,count:0,signals:0,vetoes:0,maxDD:0,halted:false,haltAt:null,feesUSDT:0,fundingUSDT:0,grossUSDT:0,slippageUSDT:0,winRate:null,expectancyUSDT:null,profitFactor:null,avgMinutes:null,trades:[]}:execute(3,variant.hold,costCase,predictions.get(variant.predictionId),variant.threshold);
   ownScenarios.push({family,fold,month:fold,algorithm:variant.algorithm,hold:variant.hold,trainMonths:variant.trainMonths,configId:variant.configId,threshold:variant.threshold,costCase,cash:Boolean(variant.cash),approvedByValidation:approved,...r});
  }
  part={scenarios:ownScenarios,selection:{family,fold,chosen,approved,controls,reason:approved?'Aprovado somente na validação anterior':'Validação não aprovou filtro; caixa'},trials:foldTrials,stability:partStability};atomic(partFile,part);
 }
 scenarios.push(...part.scenarios);selection.push(part.selection);trials.push(...part.trials);stability.push(...part.stability);publishStage(run,{evaluationCompleted:selection.length,evaluationTotal:p.families.length*p.folds.length});console.log(JSON.stringify({family,fold,completed:selection.length,total:63}));
}
const summaries=[];
for(const family of p.families)for(const algorithm of [...new Set(scenarios.filter(s=>s.family===family).map(s=>s.algorithm))]){
 const own=scenarios.filter(s=>s.family===family&&s.algorithm===algorithm),base=own.filter(s=>s.costCase==='base'),stress=own.filter(s=>s.costCase==='stress'),mean=a=>a.reduce((n,s)=>n+s.pnlUSDT,0)/a.length;
 const differences=stress.map(s=>s.pnlUSDT-scenarios.find(c=>c.family===family&&c.algorithm==='no_filter'&&c.costCase==='stress'&&c.month===s.month).pnlUSDT);
 summaries.push({family,algorithm,months:stress.length,baseMeanUSDT:mean(base),stressMeanUSDT:mean(stress),stressTrades:stress.reduce((n,s)=>n+s.count,0),positiveStressMonths:stress.filter(s=>s.pnlUSDT>0).length,maxMonthlyDD:Math.max(...stress.map(s=>s.maxDD)),difference:pairedMonthlyInterval(differences,{replicates:5000,blockMonths:3,comparisons:21,seed:p.seed}),note:'Exploratório; seleção de prazo/janela/configuração pela validação anterior. Reset mensalR$300. Intervalos diagnósticos não corrigem todas as pesquisas anteriores.'});
}
const report={runId:path.basename(run),mode:'extended',profile:'extended',quick:false,taskCount:tasks.length,fingerprint:hash(path.join(run,'registration.json')),completedAt:new Date().toISOString(),protocol:p,selection,summaries,stability,trials,scenarios:scenarios.map(({trades,...s})=>s),realOrders:false,prospectiveApplied:false,caveat:'Rodada ampliada após conhecer aV1; nenhum novo holdout intocado. Escolhas de prazo, janela e modelo usam apenas validação anterior. Não é prova de rentabilidade.'};atomic(previous,report);if(process.env.ML_NO_PUBLIC!=='1')atomic('web/data/cpu-training-results.json',report);
