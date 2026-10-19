import fs from'node:fs';import path from'node:path';import{fileURLToPath}from'node:url';import{createHash}from'node:crypto';
import{fitLogistic,temporalSamples}from'../web/ml.js';
import{fitTree,prepareFamily,predictStrategy,simulateFamily,strategyMetrics}from'../web/tree-ml.js';
export function candidateOrder(a,b){return b.robustUSDT-a.robustUSDT||b.basePnL-a.basePnL||a.threshold-b.threshold||(['control','logistic','tree'].indexOf(a.kind)-['control','logistic','tree'].indexOf(b.kind))||a.familyIndex-b.familyIndex;}
export function trainStrategies(groups,p,data,strategy){
 const combinations=[];
 for(const[familyIndex,family]of p.families.entries()){
  const train=temporalSamples(groups[family.id],p.train),validation=temporalSamples(groups[family.id],p.validation);
  const prepared=prepareFamily(data,p,strategy,family),start=Date.parse(p.validation.start),until=Date.parse(p.validation.end);
  const features=[...prepared.features.values()].filter(s=>s.at>start&&s.at<=until);
  for(const kind of p.models){
   const model=kind==='control'?null:kind==='tree'?fitTree(train,p):fitLogistic(train,p);
   if(model){model.availableAt=Date.parse(p.train.end);model.informationCutoff=model.availableAt;}
   const thresholds=kind==='control'?[0]:p.thresholdSelection.candidates,trials=[];
   for(const threshold of thresholds){
    const coverage=model?features.filter(s=>predictStrategy(model,s.x).probability>=threshold).length/features.length:1;
    const run=costCase=>simulateFamily(data,{protocol:p,strategyProtocol:strategy,family,prepared,model,threshold,start,until,costCase,closeAtEnd:true});
    const base=run('base'),stress=run('stress');
    const eligible=threshold===0||coverage>=p.thresholdSelection.minimumAcceptedFraction&&Math.min(base.trades.length,stress.trades.length)>=p.thresholdSelection.minimumTradesBothCosts;
    trials.push({family:family.id,familyIndex,kind,threshold,coverage,eligible,basePnL:base.pnl,stressPnL:stress.pnl,
      robustUSDT:Math.min(base.pnl,stress.pnl),baseCount:base.trades.length,stressCount:stress.trades.length,baseDD:base.maxDD,stressDD:stress.maxDD});
   }
   const chosen=trials.filter(x=>x.eligible).sort(candidateOrder)[0];
   if(model){model.availableAt=Date.parse(p.modelAvailableAt);model.informationCutoff=until;}
   combinations.push({id:family.id+'-'+kind,family:family.id,kind,threshold:chosen.threshold,model,validation:chosen,trials,
    training:{count:train.length,positives:train.reduce((s,r)=>s+r.y,0),maxLabelAvailableAt:Math.max(...train.map(s=>s.labelAvailableAt))},
    validationMetrics:model?strategyMetrics(validation,model,chosen.threshold):{count:validation.length}});
  }
 }
 const ranked=combinations.slice().sort((a,b)=>candidateOrder(a.validation,b.validation));
 return {combinations,winner:ranked[0].id,selection:'2023 only; maximize worse of base and doubled-cost net result',retrospective:true};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const read=p=>JSON.parse(fs.readFileSync(p)),hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
 const p=read('tree-protocol.json'),f=read('tree-freeze.json');
 for(const[file,expected]of Object.entries({...f.preservedFiles,'tree-protocol.json':f.protocolSHA256,
  'web/tree-ml.js':f.implementationSHA256,'scripts/tree-samples.mjs':f.labelsSHA256,'scripts/train-trees.mjs':f.trainingSHA256,'web/data/tree-samples.json':f.samplesSHA256}))if(hash(file)!==expected)throw Error('Arquivo alterado: '+file);
 const result=trainStrategies(read('web/data/tree-samples.json').groups,p,read(p.source),read(p.strategyProtocol));
 const output='web/data/tree-models.json',previous=fs.existsSync(output)?read(output):null;
 const report={...result,trainedAt:previous?.trainedAt??new Date().toISOString(),protocolSHA256:f.protocolSHA256,samplesSHA256:f.samplesSHA256};
 const bytes=JSON.stringify(report);
 if(f.modelsSHA256){if(createHash('sha256').update(bytes).digest('hex')!==f.modelsSHA256||hash(output)!==f.modelsSHA256)throw Error('Modelos divergentes, não sobrescritos');}else fs.writeFileSync(output,bytes);
 console.log(JSON.stringify({winner:report.winner,combinations:report.combinations.map(c=>({id:c.id,threshold:c.threshold,train:c.training.count,validationBaseBRL:c.validation.basePnL*5,validationStressBRL:c.validation.stressPnL*5,robustBRL:c.validation.robustUSDT*5}))},null,2));
}
