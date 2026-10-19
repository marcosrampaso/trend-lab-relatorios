import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {fitLogistic,temporalSamples,predictML,classificationMetrics,prepareML,simulateML} from '../web/ml.js';

export function trainWorkflow(samples,protocol,data,strategyProtocol,prepared=null) {
  const train=temporalSamples(samples,protocol.train),validation=temporalSamples(samples,protocol.validation);
  const model=fitLogistic(train,protocol);
  model.availableAt=Date.parse(protocol.train.end);model.informationCutoff=model.availableAt;
  prepared??=prepareML(data,protocol,strategyProtocol);
  const start=Date.parse(protocol.validation.start),until=Date.parse(protocol.validation.end);
  const validationFeatures=[...prepared.features.values()].filter(s=>s.at>start&&s.at<=until);
  const selection=protocol.thresholdSelection,candidates=[];
  for(const threshold of selection.candidates) {
    const candidate={...model,threshold};
    const r=simulateML(data,{protocol,strategyProtocol,prepared,model:candidate,mode:'ml',start,until,closeAtEnd:true});
    const accepted=validationFeatures.filter(s=>predictML(candidate,s.x).probability>=threshold).length;
    const coverage=accepted/validationFeatures.length;
    candidates.push({threshold,pnlUSDT:r.pnl,count:r.trades.length,filtered:r.events.filter(e=>e.kind==='filtered').length,
      coverage,eligible:threshold===0||coverage>=selection.minimumAcceptedFraction&&r.trades.length>=selection.minimumTrades});
  }
  const selected=candidates.filter(c=>c.eligible).sort((a,b)=>b.pnlUSDT-a.pnlUSDT||a.threshold-b.threshold)[0];
  model.threshold=selected.threshold;model.availableAt=Date.parse(protocol.modelAvailableAt);
  model.informationCutoff=until;
  return {...model,id:protocol.version,retrospective:true,
    training:{count:train.length,positives:train.reduce((s,r)=>s+r.y,0),
      maxSignalAt:Math.max(...train.map(s=>s.at)),maxLabelAvailableAt:Math.max(...train.map(s=>s.labelAvailableAt)),
      purged:samples.filter(s=>s.at>=Date.parse(protocol.train.start)&&s.at<Date.parse(protocol.train.end)).length-train.length,
      metrics:classificationMetrics(train,model)},
    validation:{count:validation.length,maxLabelAvailableAt:Math.max(...validation.map(s=>s.labelAvailableAt)),
      purged:samples.filter(s=>s.at>=start&&s.at<until).length-validation.length,
      candidates,selected:selection.objective,metrics:classificationMetrics(validation,model)}};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const read=p=>JSON.parse(fs.readFileSync(p)),hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
  const protocol=read('ml-protocol.json'),freeze=read('ml-freeze.json');
  for(const[file,expected]of Object.entries({...freeze.preservedFiles,'ml-protocol.json':freeze.protocolSHA256,
    'web/ml.js':freeze.implementationSHA256,'scripts/ml-labels.mjs':freeze.labelsSHA256,
    'web/data/ml-samples.json':freeze.samplesSHA256,'scripts/train-ml.mjs':freeze.trainingSHA256}))if(hash(file)!==expected)throw Error('Arquivo alterado: '+file);
  const data=read(protocol.source),strategy=read(protocol.strategyProtocol),samples=read('web/data/ml-samples.json').samples;
  const output='web/data/ml-model.json',previous=fs.existsSync(output)?read(output):null;
  const model={...trainWorkflow(samples,protocol,data,strategy),trainedAt:previous?.trainedAt??new Date().toISOString(),
    protocolSHA256:freeze.protocolSHA256,samplesSHA256:freeze.samplesSHA256};
  const bytes=JSON.stringify(model);
  if(freeze.modelSHA256){if(createHash('sha256').update(bytes).digest('hex')!==freeze.modelSHA256||hash(output)!==freeze.modelSHA256)throw Error('Modelo divergente; não sobrescrito');}
  else fs.writeFileSync(output,bytes);
  console.log(JSON.stringify({train:model.training,validation:model.validation,threshold:model.threshold,initialLoss:model.initialLoss,finalLoss:model.finalLoss},null,2));
}
