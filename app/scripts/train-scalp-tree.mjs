import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {fitTree,predictTree} from '../web/tree-ml.js';
import {availableScalpSamples,scalpEntryFilter,monthAt,monthsBetween,pairedMonthlyInterval} from '../web/scalp-tree.js';
import {simulateScalpTree} from '../web/scalp-tree-engine.js';
import {read,hash,saveOnce,verifyScalpInputs,scalpDataSource} from './scalp-tree-data.mjs';

export function trainScalpCandidate(rows,p,window,evaluate){
  const train=availableScalpSamples(rows,window.trainStart,window.trainEnd);
  const validation=availableScalpSamples(rows,window.validationStart,window.validationEnd);
  if(train.length<p.learner.minimumSamples)throw Error('Amostra insuficiente para treino: '+train.length);
  const model=fitTree(train,p);
  const training={count:train.length,positive:train.filter(s=>s.y).length,maxLabelAvailableAt:Math.max(...train.map(s=>s.labelAvailableAt))};
  const initial={model,availableAt:window.trainEnd,informationCutoff:window.trainEnd};
  const trials=[];let control;
  for(const threshold of p.thresholds){
    const coverage=threshold===0?1:validation.filter(s=>predictTree(model,s.x).probability>=threshold).length/validation.length;
    const results=evaluate({...initial,threshold});
    if(threshold===0)control=results;
    const eligible=threshold===0||coverage>=p.selection.minimumAcceptedFraction&&
      Math.min(results.base.count,results.stress.count)>=p.selection.minimumTradesBothCosts&&
      results.base.maxDD<=control.base.maxDD+p.selection.maximumDrawdownDeterioration&&results.stress.maxDD<=control.stress.maxDD+p.selection.maximumDrawdownDeterioration;
    trials.push({threshold,coverage,eligible,basePnL:results.base.pnlUSDT,stressPnL:results.stress.pnlUSDT,robustUSDT:Math.min(results.base.pnlUSDT,results.stress.pnlUSDT),baseCount:results.base.count,stressCount:results.stress.count,baseDD:results.base.maxDD,stressDD:results.stress.maxDD});
  }
  const chosen=trials.filter(t=>t.eligible).sort((a,b)=>b.robustUSDT-a.robustUSDT||a.threshold-b.threshold)[0];
  let brier=0,constantBrier=0;
  for(const s of validation){brier+=(predictTree(model,s.x).probability-s.y)**2;constantBrier+=(model.trainRate-s.y)**2;}
  return {...initial,threshold:chosen.threshold,availableAt:window.validationEnd,informationCutoff:window.validationEnd,
    window,training,validation:{...chosen,count:validation.length,brier:validation.length?brier/validation.length:null,constantBrier:validation.length?constantBrier/validation.length:null},trials,
    filterEnabled:chosen.threshold>0,validationApproved:chosen.threshold>0&&chosen.stressPnL>0&&chosen.robustUSDT>trials[0].robustUSDT};
}

export function summarizeScalp(r){
  const n=r.trades.length,positive=r.trades.filter(t=>t.net>0).reduce((n,t)=>n+t.net,0),negative=-r.trades.filter(t=>t.net<0).reduce((n,t)=>n+t.net,0);
  const net=r.trades.reduce((n,t)=>n+t.net,0);
  if(Math.abs(net-r.pnl)>1e-8)throw Error('Caixa não reconciliado');
  if(!r.trades.every(t=>t.exitAt-t.entryAt<=30*60000))throw Error('Prazo30min excedido');
  return {pnlUSDT:r.pnl,finalUSDT:r.final,count:n,signals:r.signals.length,vetoes:r.events.filter(e=>e.reason?.startsWith('Árvore')).length,
    maxDD:r.maxDD,halted:r.halted,haltAt:r.haltAt,feesUSDT:r.fees,fundingUSDT:r.fundingNet,
    grossUSDT:r.trades.reduce((n,t)=>n+t.gross,0),slippageUSDT:r.trades.reduce((n,t)=>n+t.slippageCost,0),
    winRate:n?r.trades.filter(t=>t.net>0).length/n:null,expectancyUSDT:n?r.pnl/n:null,profitFactor:negative?positive/negative:null,
    avgMinutes:n?r.trades.reduce((n,t)=>n+(t.exitAt-t.entryAt)/60000,0)/n:null};
}

async function main(){
  const p=read('scalp-tree-protocol.json'),strategy={...read('scalping-protocol.json'),maxHoldMinutes:p.maxHoldMinutes};
  const manifest=verifyScalpInputs(),history=read('web/data/eth-donchian-history.json'),source=scalpDataSource(history,manifest);
  const dataset=read('data/scalp-tree/samples.json'),input=read('data/scalp-tree/features.json');
  if(dataset.protocolSHA256!==hash('scalp-tree-protocol.json')||input.protocolSHA256!==dataset.protocolSHA256)throw Error('Protocolo diverge das amostras');
  const maps=Object.fromEntries(p.families.map(f=>[f,new Map(input.features[f].map(s=>[s.at,s]))]));
  const windows=monthsBetween(p.testStart,new Date(monthAt(p.holdoutStart,1)).toISOString());
  const models=[];
  function prepared(family,start,end){return{signals:{[family]:input.signals[family].filter(s=>s.at>=start&&s.at<end)}};}
  function simulate(windowData,family,start,end,bundle,costCase){
    return simulateScalpTree(windowData,{strategy:family,start,until:end,protocol:strategy,
      cost:strategy.costCases.find(c=>c.id===costCase),prepared:prepared(family,start,end),
      entryFilter:scalpEntryFilter(bundle,maps[family],start),closeAtEnd:true});
  }
  for(const month of windows){
    const validationEnd=monthAt(month),validationStart=monthAt(month,-3),trainEnd=validationStart,trainStart=monthAt(month,-12);
    const window={trainStart,trainEnd,validationStart,validationEnd};
    const data=source.window(validationStart,validationEnd);
    for(const family of p.families){
      const bundle=trainScalpCandidate(dataset.groups[family],p,window,model=>Object.fromEntries(['base','stress'].map(cost=>[cost,summarizeScalp(simulate(data,family,validationStart,validationEnd,model,cost))])));
      models.push({id:month+'/'+family,month,family,...bundle});
      console.log(JSON.stringify({phase:'train',month,family,train:bundle.training.count,threshold:bundle.threshold,validationStressBRL:bundle.validation.stressPnL*5,approved:bundle.validationApproved}));
    }
  }
  const modelsOutput='web/data/scalp-tree-models.json';
  const trainedAt=fs.existsSync(modelsOutput)?read(modelsOutput).trainedAt:new Date().toISOString();
  const publicModels={trainedAt,protocol:p,protocolSHA256:hash('scalp-tree-protocol.json'),samplesSHA256:hash('data/scalp-tree/samples.json'),models};
  saveOnce(modelsOutput,publicModels);
  const scenarios=[],inspection={};
  const fixed=f=>models.find(m=>m.family===f&&m.month===p.testStart.slice(0,7));
  const rolling=(f,month)=>models.find(m=>m.family===f&&m.month===(month>=p.holdoutStart.slice(0,7)?p.holdoutStart.slice(0,7):month));
  for(const month of monthsBetween(p.testStart,p.end)){
    const start=monthAt(month),end=monthAt(month,1),data=source.window(start,end);
    for(const family of p.families){
      for(const variant of p.variants)for(const costCase of ['base','stress']){
        const bundle=variant==='control'?null:variant==='fixed'?fixed(family):rolling(family,month);
        const r=simulate(data,family,start,end,bundle,costCase),stats=summarizeScalp(r);
        scenarios.push({month,family,variant,costCase,modelId:bundle?.id??null,threshold:bundle?.threshold??0,holdout:start>=Date.parse(p.holdoutStart),...stats,
          trades:r.trades.map(({context,...t})=>t)});
      }
      if(['2025-04','2025-05'].includes(month)){
        inspection[month+'/'+family]=input.features[family].filter(s=>s.at>=start&&s.at<end).map(s=>({at:s.at,side:s.side,x:s.x,
          fixed:predictTree(fixed(family).model,s.x),rolling:predictTree(rolling(family,month).model,s.x)}));
      }
    }
    console.log(JSON.stringify({phase:'evaluate',month,scenarios:scenarios.length}));
  }
  const comparisons=[];
  for(const family of p.families)for(const variant of ['fixed','rolling']){
    const own=scenarios.filter(s=>s.family===family&&s.variant===variant&&s.costCase==='stress');
    const control=own.map(s=>scenarios.find(c=>c.family===family&&c.variant==='control'&&c.costCase==='stress'&&c.month===s.month));
    const interval=pairedMonthlyInterval(own.map((s,i)=>s.pnlUSDT-control[i].pnlUSDT),p.uncertainty);
    const pnl=own.reduce((n,s)=>n+s.pnlUSDT,0),count=own.reduce((n,s)=>n+s.count,0),holdout=own.filter(s=>s.holdout).reduce((n,s)=>n+s.pnlUSDT,0);
    const drawdownOkay=own.every((s,i)=>s.maxDD<=control[i].maxDD+p.promotion.maximumDrawdownDeterioration);
    const reasons=[];
    if(own.length<p.promotion.minimumMonths)reasons.push('Poucos meses');if(count<p.promotion.minimumTrades)reasons.push('Poucas operações');
    if(pnl<=0)reasons.push('Resultado agregado negativo com custos2×');if(!interval||interval.lowerUSDT<=0)reasons.push('Melhora relativa sem limite inferior positivo');
    if(!drawdownOkay)reasons.push('Drawdown piorou além de2 pontos percentuais em algum mês');if(holdout<=0)reasons.push('Checagem final negativa com custos2×');
    comparisons.push({family,variant,months:own.length,count,stressPnLUSDT:pnl,controlStressPnLUSDT:control.reduce((n,s)=>n+s.pnlUSDT,0),holdoutStressPnLUSDT:holdout,positiveMonths:own.filter(s=>s.pnlUSDT>0).length,interval,drawdownOkay,researchPassed:reasons.length===0,reasons});
  }
  const report={generatedAt:fs.existsSync('web/data/scalp-tree-results.json')?read('web/data/scalp-tree-results.json').generatedAt:new Date().toISOString(),
    trainedAt,protocol:p,data:{months:33,warmupMonths:1,minutes:manifest.totalMinutes,checksums:manifest.checksums,repairMinutes:manifest.months.flatMap(m=>m.sources).filter(s=>s.repair).reduce((n,s)=>n+s.rows,0),differentHours:manifest.differentHours,manifestSHA256:hash('data/scalp-tree/manifest.json'),manifest},
    samples:{counts:Object.fromEntries(p.families.map(f=>[f,dataset.groups[f].length])),excluded:dataset.excluded},models:models.map(m=>({id:m.id,month:m.month,family:m.family,training:m.training,threshold:m.threshold,availableAt:m.availableAt,validationApproved:m.validationApproved,filterEnabled:m.filterEnabled})),
    scenarios,comparisons,inspection,prospectiveApplied:false,realOrders:false};
  if(scenarios.length!==378||models.length!==57)throw Error('Número inesperado de modelos/cenários');
  saveOnce('web/data/scalp-tree-results.json',report);
  const files=['scalp-tree-protocol.json','web/scalp-tree.js','web/scalp-tree-engine.js','scripts/scalp-tree-data.mjs','scripts/fetch-scalp-tree.py','scripts/build-scalp-tree-samples.mjs','scripts/train-scalp-tree.mjs','data/scalp-tree/manifest.json','data/scalp-tree/samples.json','data/scalp-tree/features.json','web/data/scalp-tree-models.json','web/data/scalp-tree-results.json','scalping-context-freeze.json','tree-freeze.json',...manifest.months.map(m=>m.path)];
  const freeze={registeredAt:p.registeredAt,files:Object.fromEntries(files.map(f=>[f,hash(f)]))};
  const frozenPath='scalp-tree-freeze.json';
  if(fs.existsSync(frozenPath)){if(JSON.stringify(read(frozenPath))!==JSON.stringify(freeze))throw Error('Congelamento diverge');}
  else fs.writeFileSync(frozenPath,JSON.stringify(freeze,null,2)+'\n');
  console.log(JSON.stringify({done:true,trees:models.length,scenarios:scenarios.length,comparisons},null,2));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
