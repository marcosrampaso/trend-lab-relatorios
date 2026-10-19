import fs from'node:fs';import{createHash}from'node:crypto';import assert from'node:assert/strict';
import{simulate,HOUR}from'../web/engine.js';import{simulateDonchian}from'../web/donchian.js';
import{temporalSamples}from'../web/ml.js';import{prepareFamily,simulateFamily,strategyMetrics}from'../web/tree-ml.js';
import{fixedCostAudit}from'../web/cost-audit.js';
const read=p=>JSON.parse(fs.readFileSync(p)),hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const p=read('tree-protocol.json'),f=read('tree-freeze.json');assert.ok(f.modelsSHA256&&f.modelsFrozenAt,'Congele os modelos antes de avaliar');
for(const[file,expected]of Object.entries({...f.preservedFiles,'tree-protocol.json':f.protocolSHA256,'web/tree-ml.js':f.implementationSHA256,
 'scripts/tree-samples.mjs':f.labelsSHA256,'scripts/train-trees.mjs':f.trainingSHA256,'web/data/tree-samples.json':f.samplesSHA256,
 'web/data/tree-models.json':f.modelsSHA256,...(f.analysisSHA256?{'scripts/analyze-trees.mjs':f.analysisSHA256}:{})}))assert.equal(hash(file),expected,file);
const data=read(p.source),strategy=read(p.strategyProtocol),models=read('web/data/tree-models.json'),dataset=read('web/data/tree-samples.json');
const periods=[{...p.validation,id:'selection2023',label:'2023 · seleção de estratégias e limiares',role:'selection'},...p.periods.map(x=>({...x,role:'evaluation'}))];
const scenarios=[],metrics=[],examples=[];
for(const family of p.families){
 const prepared=prepareFamily(data,p,strategy,family);
 for(const period of periods){
  const start=Date.parse(period.start),until=Date.parse(period.end),samples=temporalSamples(dataset.groups[family.id],period);
  const sampleExamples=samples.map(s=>({...s,period:period.id,family:family.id,events:{}}));
  for(const combo of models.combinations.filter(c=>c.family===family.id)){
   const model=combo.model&&period.role==='selection'?{...combo.model,availableAt:Date.parse(p.train.end),informationCutoff:Date.parse(p.train.end)}:combo.model;
   metrics.push({period:period.id,combination:combo.id,...(model?strategyMetrics(samples,model,combo.threshold):{count:samples.length})});
   for(const cost of strategy.costCases){
    const r=simulateFamily(data,{protocol:p,strategyProtocol:strategy,family,prepared,model,threshold:combo.threshold,start,until,costCase:cost.id,closeAtEnd:true});
    if(combo.kind==='control'){
     const original=family.id==='donchian'?simulateDonchian(data,{protocol:strategy,variant:'adaptive',start,until,costCase:cost.id,closeAtEnd:true}):
      simulate(data,{start,until,strategy:family.engine,maxHoldHours:family.maxHoldHours,stopATR:family.stopATR,targetR:family.targetR,cooldownHours:family.cooldownHours,config:{fee:cost.fee,slippage:cost.slippage},closeAtEnd:true});
     assert.deepEqual(r.trades,original.trades);assert.equal(r.final,original.final);
    }
    assert.ok(Math.abs(r.trades.reduce((n,t)=>n+t.net,0)-r.pnl)<1e-8);assert.ok(r.trades.every(t=>t.exitAt-t.entryAt<=family.maxHoldHours*HOUR));
    scenarios.push({period:period.id,combination:combo.id,costCase:cost.id,pnlUSDT:r.pnl,returnPct:r.returnPct,count:r.trades.length,maxDD:r.maxDD,
     halted:r.halted,haltAt:r.haltAt,liquidations:r.liquidations,fees:r.fees,funding:r.fundingNet,filtered:r.events.filter(e=>e.kind==='filtered').length,
     trades:r.trades,curve:r.equity.filter((x,i)=>i%12===0||i===r.equity.length-1)});
    if(cost.id==='base')for(const s of sampleExamples){const e=r.events.find(e=>e.at===s.at&&['entry','filtered','rejected'].includes(e.kind));s.events[combo.kind]={kind:e?.kind??'no-entry',reason:e?.reason??(r.haltAt&&s.at>=r.haltAt?'Pausa de risco':'Posição ou intervalo entre operações')};}
   }
  }
  examples.push(...sampleExamples);
 }
}
const audits=scenarios.filter(s=>s.costCase==='base').map(s=>({period:s.period,combination:s.combination,...fixedCostAudit(s.trades,strategy.costCases[0],strategy.costCases[1])}));
const output='web/data/tree-results.json',prior=fs.existsSync(output)?read(output):null;
const report={generatedAt:prior?.generatedAt??new Date().toISOString(),protocol:p,strategyProtocol:strategy,models,
 registration:{registeredAt:f.registeredAt,protocolSHA256:f.protocolSHA256,modelsSHA256:f.modelsSHA256,modelsFrozenAt:f.modelsFrozenAt},
 periods,scenarios,metrics,examples,audits,excluded:dataset.excluded,retrospective:true,prospectiveApplied:false,newsApplied:false};
const bytes=JSON.stringify(report);
if(f.resultSHA256){assert.equal(createHash('sha256').update(bytes).digest('hex'),f.resultSHA256,'Reprodução divergiu, nenhum arquivo sobrescrito');assert.equal(hash(output),f.resultSHA256);}else fs.writeFileSync(output,bytes);
console.log(JSON.stringify({winner:models.winner,scenarios:scenarios.length,results:scenarios.filter(s=>s.costCase==='base').map(s=>({period:s.period,combination:s.combination,netBRL:s.pnlUSDT*5,count:s.count}))},null,2));
