import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {HOUR} from '../web/engine.js';
import {simulateDonchian} from '../web/donchian.js';
import {prepareML,simulateML,temporalSamples,classificationMetrics,predictML} from '../web/ml.js';
import {fixedCostAudit} from '../web/cost-audit.js';
const read=p=>JSON.parse(fs.readFileSync(p)),hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const protocol=read('ml-protocol.json'),freeze=read('ml-freeze.json');
assert.ok(freeze.modelSHA256&&freeze.modelFrozenAt,'Congele o modelo antes da avaliação');
for(const[file,expected]of Object.entries({...freeze.preservedFiles,'ml-protocol.json':freeze.protocolSHA256,
  'web/ml.js':freeze.implementationSHA256,'scripts/ml-labels.mjs':freeze.labelsSHA256,
  'scripts/train-ml.mjs':freeze.trainingSHA256,'web/data/ml-samples.json':freeze.samplesSHA256,
  'web/data/ml-model.json':freeze.modelSHA256,...(freeze.analysisSHA256?{'scripts/analyze-ml.mjs':freeze.analysisSHA256}:{})}))assert.equal(hash(file),expected,file);
const model=read('web/data/ml-model.json'),dataset=read('web/data/ml-samples.json'),samples=dataset.samples;
const data=read(protocol.source),strategy=read(protocol.strategyProtocol),prepared=prepareML(data,protocol,strategy);
const periods=[{...protocol.validation,id:'selection2023',label:'2023 · seleção do limiar',role:'selection'},...protocol.periods.map(p=>({...p,role:'evaluation'}))];
const scenarios=[],metrics=[],examples=[];
for(const period of periods){
  const start=Date.parse(period.start),until=Date.parse(period.end);
  const usedModel=period.role==='selection'?{...model,availableAt:Date.parse(protocol.train.end),informationCutoff:Date.parse(protocol.train.end)}:model;
  const phaseSamples=temporalSamples(samples,period);
  metrics.push({period:period.id,role:period.role,...classificationMetrics(phaseSamples,model)});
  for(const cost of strategy.costCases)for(const mode of ['control','ml']){
    const r=simulateML(data,{protocol,strategyProtocol:strategy,prepared,model:usedModel,mode,start,until,costCase:cost.id,closeAtEnd:true});
    if(mode==='control'){
      const control=simulateDonchian(data,{protocol:strategy,variant:protocol.signalVariant,start,until,costCase:cost.id,closeAtEnd:true});
      assert.deepEqual(r.trades,control.trades);assert.equal(r.final,control.final);
    }
    assert.ok(Math.abs(r.trades.reduce((n,t)=>n+t.net,0)-r.pnl)<1e-8);
    assert.ok(r.trades.every(t=>t.exitAt-t.entryAt<=24*HOUR));
    scenarios.push({period:period.id,mode,costCase:cost.id,pnlUSDT:r.pnl,returnPct:r.returnPct,count:r.trades.length,
      maxDD:r.maxDD,halted:r.halted,haltAt:r.haltAt,liquidations:r.liquidations,fees:r.fees,funding:r.fundingNet,
      filtered:r.events.filter(e=>e.kind==='filtered').length,signals:r.signals.length,trades:r.trades,
      curve:r.equity.filter((x,i)=>i%12===0||i===r.equity.length-1)});
    if(mode==='ml'&&cost.id==='base')for(const sample of phaseSamples){
      const score=predictML(model,sample.x),event=r.events.find(e=>e.at===sample.at&&['entry','filtered','rejected'].includes(e.kind));
      examples.push({...sample,period:period.id,probability:score.probability,accept:score.probability>=model.threshold,
        portfolioEvent:event?.kind??'no-entry',portfolioReason:event?.reason??(r.haltAt&&sample.at>=r.haltAt?'Pausa de risco':'Posição ou intervalo entre operações')});
    }
  }
}
const audits=scenarios.filter(s=>s.costCase==='base').map(s=>({period:s.period,mode:s.mode,...fixedCostAudit(s.trades,strategy.costCases[0],strategy.costCases[1])}));
const output='web/data/ml-results.json',prior=fs.existsSync(output)?read(output):null;
const result={generatedAt:prior?.generatedAt??new Date().toISOString(),protocol,strategyProtocol:strategy,
  registration:{registeredAt:freeze.registeredAt,protocolSHA256:freeze.protocolSHA256,modelFrozenAt:freeze.modelFrozenAt,modelSHA256:freeze.modelSHA256},
  model,periods,scenarios,metrics,examples,audits,dataset:{count:samples.length,excluded:dataset.excluded,samplesSHA256:freeze.samplesSHA256},
  exploratory:true,newsApplied:false,prospectiveApplied:false,execution:'1h'};
const bytes=JSON.stringify(result);
if(freeze.resultSHA256){assert.equal(createHash('sha256').update(bytes).digest('hex'),freeze.resultSHA256,'Resultado divergente; nenhum arquivo foi sobrescrito');assert.equal(hash(output),freeze.resultSHA256);}
else fs.writeFileSync(output,bytes);
console.log(JSON.stringify({modelThreshold:model.threshold,metrics,scenarios:scenarios.map(s=>({period:s.period,mode:s.mode,cost:s.costCase,netBRL:s.pnlUSDT*strategy.fx,trades:s.count,filtered:s.filtered,maxDD:s.maxDD}))},null,2));
