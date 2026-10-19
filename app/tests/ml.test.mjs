import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';import{createHash}from'node:crypto';
import{HOUR}from'../web/engine.js';import{fitLogistic,logisticObjective,predictML,temporalSamples}from'../web/ml.js';
import{fitTree,predictTree,prepareFamily,simulateFamily}from'../web/tree-ml.js';import{trainStrategies}from'../scripts/train-trees.mjs';
const read=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url)));
const p=read('tree-protocol.json'),strategy=read(p.strategyProtocol),data=read(p.source),dataset=read('web/data/tree-samples.json'),models=read('web/data/tree-models.json');

test('gradiente logístico coincide com diferença finita, incluindo regularização',()=>{
 const rows=[{x:[-1,2],y:0},{x:[2,-.5],y:1},{x:[.2,.3],y:1}],w=[.2,-.4],bias=.1,lambda=.03,epsilon=1e-6;
 const actual=logisticObjective(rows,w,bias,lambda);
 for(let i=0;i<w.length;i++){const a=w.slice(),b=w.slice();a[i]+=epsilon;b[i]-=epsilon;const numeric=(logisticObjective(rows,a,bias,lambda).loss-logisticObjective(rows,b,bias,lambda).loss)/(2*epsilon);assert.ok(Math.abs(actual.gradient[i]-numeric)<1e-8);}
 const numeric=(logisticObjective(rows,w,bias+epsilon,lambda).loss-logisticObjective(rows,w,bias-epsilon,lambda).loss)/(2*epsilon);assert.ok(Math.abs(actual.bias-numeric)<1e-8);
});
test('regressão aprende um padrão de treino e mantém score estável em valores extremos',()=>{
 const small={features:['x'],learner:{...p.learner,minimumSamples:20,minimumClassSamples:5}},samples=Array.from({length:100},(_,i)=>({x:[(i-50)/10],y:i>=50?1:0}));
 const m=fitLogistic(samples,small);assert.ok(m.finalLoss<m.initialLoss);assert.ok(predictML(m,[-1000000]).probability<.1);assert.ok(predictML(m,[1000000]).probability>.9);
 assert.throws(()=>fitLogistic(samples.map(s=>({...s,y:0})),small));
});
test('árvore aprende cortes reais e respeita profundidade, mínimo de folha e scores suavizados',()=>{
 const cfg={...p,features:['x'],learner:{...p.learner,minimumSamples:20},tree:{...p.tree,minLeaf:10,maxDepth:2}};
 const samples=Array.from({length:120},(_,i)=>({x:[i-60],y:i>=60?1:0})),model=fitTree(samples,cfg);
 assert.ok(model.root.left);assert.ok(predictTree(model,[-50]).probability<.2);assert.ok(predictTree(model,[50]).probability>.8);
 function check(node,depth=0){assert.ok(depth<=2);assert.ok(node.probability>0&&node.probability<1);if(node.left){assert.equal(node.count,node.left.count+node.right.count);check(node.left,depth+1);check(node.right,depth+1);}else assert.ok(node.count>=10);}check(model.root);
 assert.equal(predictTree(model,[-50]).path[0].left,true);assert.throws(()=>predictTree(model,[NaN]));
});
test('rótulos são posteriores, purgados na fronteira e respeitam as saídas de cada estratégia',()=>{
 for(const family of p.families){const samples=dataset.groups[family.id];assert.ok(samples.length>1000);
  assert.ok(samples.every(s=>s.x.length===12&&s.x.every(Number.isFinite)&&s.labelAvailableAt===s.at+25*HOUR&&s.exitAt>s.at&&s.exitAt-s.at<=family.maxHoldHours*HOUR&&s.y===(s.netUSDT>0?1:0)));
  const train=temporalSamples(samples,p.train);assert.ok(train.every(s=>s.labelAvailableAt<Date.parse(p.train.end)));
 }
 const boundary=Date.parse(p.train.end);assert.equal(temporalSamples([{at:boundary-HOUR,labelAvailableAt:boundary+HOUR}],p.train).length,0);
 assert.deepEqual(dataset.groups.donchian,read('web/data/ml-samples.json').samples);
});
test('nove combinações e seis modelos mantêm o mesmo corte de informação e folhas válidas',()=>{
 assert.equal(models.combinations.length,9);assert.equal(models.combinations.filter(c=>c.model).length,6);
 for(const c of models.combinations){assert.ok(c.training.maxLabelAvailableAt<Date.parse(p.train.end));assert.ok(c.validation.eligible);if(!c.model)continue;
  assert.equal(c.model.availableAt,Date.parse(p.modelAvailableAt));assert.equal(c.model.informationCutoff,Date.parse(p.validation.end));
  if(c.kind==='tree'){function check(n,depth=0){assert.ok(depth<=p.tree.maxDepth);if(n.left){check(n.left,depth+1);check(n.right,depth+1);}else assert.ok(n.count>=p.tree.minLeaf);}check(c.model.root);}
 }
});
test('alterar dados e rótulos posteriores à validação não altera pesos, árvores, limiares ou seleção',()=>{
 const cutoff=Date.parse(p.validation.end),poison={...data,candles:data.candles.map(r=>r[0]>=cutoff?[r[0],...r.slice(1).map(x=>x*100)]:r),marks:data.marks.map(r=>r[0]>=cutoff?[r[0],...r.slice(1).map(x=>x*100)]:r),funding:data.funding.map(r=>r[0]>=cutoff?[r[0],99]:r)};
 const groups=Object.fromEntries(Object.entries(dataset.groups).map(([family,rows])=>[family,rows.map(s=>s.at>=cutoff?{...s,x:s.x.map(x=>x*100),y:1-s.y,netUSDT:999}:s)]));
 const actual=trainStrategies(groups,p,poison,strategy);
 const {trainedAt,protocolSHA256,samplesSHA256,...expected}=models;
 assert.deepEqual(actual,expected);
});
test('features e carteira de cada família permanecem causais com futuro alterado',()=>{
 const period=p.periods[0],start=Date.parse(period.start),until=start+100*HOUR;
 const poison={...data,candles:data.candles.map(r=>r[0]>=until?[r[0],...r.slice(1).map(x=>x*100)]:r),marks:data.marks.map(r=>r[0]>=until?[r[0],...r.slice(1).map(x=>x*100)]:r),funding:data.funding.map(r=>r[0]>=until?[r[0],99]:r)};
 for(const family of p.families){
  const before=prepareFamily(data,p,strategy,family,until),after=prepareFamily(poison,p,strategy,family,until);assert.deepEqual(before,after);
  const combo=models.combinations.find(c=>c.family===family.id&&c.kind==='tree');
  const opts={protocol:p,strategyProtocol:strategy,family,model:combo.model,threshold:combo.threshold,start,until};
  assert.deepEqual(simulateFamily(data,{...opts,prepared:before}),simulateFamily(poison,{...opts,prepared:after}));
  assert.throws(()=>simulateFamily(data,{...opts,start:Date.parse(p.validation.start)}));
 }
});
test('limiar zero não inventa vetos ou altera a carteira original',()=>{
 const start=Date.parse(p.periods[0].start),until=start+200*HOUR;
 for(const family of p.families){const prepared=prepareFamily(data,p,strategy,family,until),model=models.combinations.find(c=>c.family===family.id&&c.kind==='tree').model;
  const opts={protocol:p,strategyProtocol:strategy,family,prepared,start,until,closeAtEnd:true};
  const control=simulateFamily(data,opts),zero=simulateFamily(data,{...opts,model,threshold:0});assert.deepEqual(control.trades,zero.trades);assert.equal(control.final,zero.final);
 }
});
test('publicação completa reconcilia os108 cenários sem substituir estudos anteriores',()=>{
 const report=read('web/data/tree-results.json');assert.equal(report.scenarios.length,108);assert.equal(report.models.winner,models.winner);assert.equal(report.prospectiveApplied,false);
 for(const s of report.scenarios){assert.ok(Math.abs(s.trades.reduce((sum,t)=>sum+t.net,0)-s.pnlUSDT)<1e-8);assert.ok(s.trades.every(t=>t.exitAt-t.entryAt<=p.families.find(f=>f.id===s.combination.split('-')[0]).maxHoldHours*HOUR));}
 const f=read('tree-freeze.json');for(const[file,expected]of Object.entries({...f.preservedFiles,'tree-protocol.json':f.protocolSHA256,
  'web/tree-ml.js':f.implementationSHA256,'scripts/tree-samples.mjs':f.labelsSHA256,'scripts/train-trees.mjs':f.trainingSHA256,
  'web/data/tree-samples.json':f.samplesSHA256,'web/data/tree-models.json':f.modelsSHA256,'scripts/analyze-trees.mjs':f.analysisSHA256,'web/data/tree-results.json':f.resultSHA256}))assert.equal(createHash('sha256').update(fs.readFileSync(new URL('../'+file,import.meta.url))).digest('hex'),expected,file);
});
