import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import{createHash}from'node:crypto';
import{rankTrials,approvedTrial}from'../scripts/local-ml-evaluation.mjs';
const read=p=>JSON.parse(fs.readFileSync(p)),r=read('local-cpu-benchmark-v1.json'),old=read('web/data/scalp-tree-results.json');
test('777 ajustes concluídos respeitam cortes temporais, artefatos e uma thread nativa',()=>{
 assert.equal(r.quick,false);assert.equal(r.taskCount,777);assert.equal(r.realOrders,false);assert.equal(r.prospectiveApplied,false);
 const base=path.join('work/local-ml/runs',r.runId),files=fs.readdirSync(path.join(base,'predictions'));assert.equal(files.length,777);
 const pids=new Set();for(const file of files){const p=read(path.join(base,'predictions',file));assert.ok(p.maxTrainLabelAvailableAt<p.trainEnd);assert.ok(p.trainEnd<p.validationEnd&&p.validationEnd<p.testEnd);assert.ok(p.threadPools.every(pool=>pool.num_threads===1));pids.add(p.workerPID);assert.equal(createHash('sha256').update(fs.readFileSync(p.artifact)).digest('hex'),p.artifactSHA256);}
 assert.equal(pids.size,10);
});
test('controles e todos os limiares zero reproduzem o estudo anterior',()=>{
 let checked=0;for(const s of r.scenarios){const control=old.scenarios.find(c=>c.variant==='control'&&c.family===s.family&&c.month===s.month&&c.costCase===s.costCase);if(!control||s.threshold!==0||s.cash)continue;for(const key of ['pnlUSDT','count','feesUSDT','fundingUSDT','haltAt','maxDD'])assert.equal(s[key],control[key],s.family+'/'+s.month+'/'+key);checked++;}assert.ok(checked>=114);
});
test('escolhas publicadas usam somente validação e caixa respeita reprovações',()=>{
 for(const decision of r.selection){const trials=r.trials.filter(t=>t.family===decision.family&&t.fold===decision.fold),chosen=rankTrials(trials,r.protocol.configs)[0];assert.deepEqual(chosen,decision.chosen);const control=trials.find(t=>t.threshold===0);assert.equal(decision.approved,approvedTrial(chosen,{base:{pnlUSDT:control.basePnL},stress:{pnlUSDT:control.stressPnL}}));const cash=r.scenarios.filter(s=>s.family===decision.family&&s.fold===decision.fold&&s.algorithm==='cash_policy');assert.equal(cash.length,6);if(!decision.approved)for(const s of cash){assert.equal(s.cash,true);assert.equal(s.count,0);assert.equal(s.pnlUSDT,0);}}
 for(const s of r.scenarios)assert.ok(Math.abs(s.finalUSDT-60-s.pnlUSDT)<1e-8);
});
