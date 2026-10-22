import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {read,hash} from '../scripts/multiasset-io.mjs';
const base='work/pepe-payoff-genetic-v1',p=read(base+'/protocol.json'),reg=read(base+'/registration.json');
test('registered genetic sources and ancestor inputs remain immutable without an hour limit',()=>{
 assert.equal(hash(base+'/protocol.json'),reg.protocolSHA256);for(const[f,h]of Object.entries({...reg.inputs,...reg.sourceHashes}))assert.equal(hash(f),h,f);
 assert.equal(p.maxWallHours,null);assert.equal(p.generations,100);assert.equal(p.population,256);assert.equal(p.islands*p.membersPerIsland,p.population);assert.equal(p.engine.risk,.01);assert.equal(p.engine.leverage,15);assert.equal(p.realOrders,false);assert.equal(p.independentValidation,false);
});
test('all genetic selection rows use the original closed features and 2023 labels only',()=>{
 const d=read(base+'/dataset.json');assert.ok(Object.keys(d.months).every(m=>m<'2024-01'));
 for(const fold of p.folds){assert.ok(fold.trainMonths.every(m=>m<fold.calibrationMonth));assert.ok(fold.calibrationMonth<fold.validationMonth);const labels=new Map(d.months[fold.validationMonth].filter(r=>r.side===1).map(r=>[r.at,r]));for(const f of d.grids[fold.validationMonth]){assert.equal(f.at,f.knownAt);assert.deepEqual(f.x,labels.get(f.at).x);assert.equal(f.at%1800000,0);}}
});
test('archived founder has exact hashed weights, causal maturity and reconciled continuous wallets',()=>{
 const dirs=fs.readdirSync(base+'/champions'),founder=dirs.find(d=>fs.existsSync(base+'/champions/'+d+'/complete.json'));assert.ok(founder);const a=read(base+'/champions/'+founder+'/complete.json');for(const[f,h]of Object.entries(a.artifacts))assert.equal(hash(f),h);
 assert.equal(a.wallets.length,4);for(const w of a.wallets){assert.equal(w.initialBRL,1000);assert.ok(w.cdi.comparable);assert.ok(Math.abs(w.trades.reduce((n,t)=>n+t.net*p.engine.fx,0)-w.pnlBRL)<1e-7);}
 for(let i=0;i<4;i++)for(const v of Object.values(a.candidate.maturity[i].maturity)){assert.ok(v.maxTrainExitAt<=p.folds[i].trainEnd-1800000);assert.ok(v.maxCalibrationExitAt<=p.folds[i].calibrationEnd-1800000);}
});
test('search checkpoint separates selection history from final audit and resumes fixed population',()=>{
 const c=read(base+'/checkpoint.json');assert.equal(c.population.length,256);for(let i=0;i<4;i++)assert.equal(c.population.filter(v=>v.island===i).length,64);
 assert.equal(c.history.length,c.completedGenerations);if(c.completedGenerations<100){assert.equal(c.audit,undefined);assert.ok(!fs.existsSync(base+'/final-audit/result.json'));}assert.ok(c.baseline.path);assert.ok(c.best.path);
});
