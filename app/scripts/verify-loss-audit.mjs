import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import path from 'node:path';
process.chdir(path.resolve(import.meta.dirname,'..'));const read=f=>JSON.parse(fs.readFileSync(f)),hash=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex'),audit=read('work/loss-audit-v1/report.json'),p=read('scalping-protocol.json');let hashes=0,fees=0,fills=0,risks=0,models=0,gapStops=[];
for(const [file,h]of Object.entries(audit.scope.sourceHashes)){assert.equal(hash(file),h,file);hashes++;}
for(const run of ['pilot-20261019-v1','stability/replica-1','stability/replica-2','stability/replica-3']){
 const r=read('work/genetic-validation-v6/'+run+'/registration.json');for(const [file,h]of Object.entries(r.sourceHashes)){assert.equal(hash(file),h,file);hashes++;}
}
for(const file of fs.readdirSync('work/expanded-validation/g151-fixed-funding-v2/predictions'))if(file.endsWith('.json')){const r=read('work/expanded-validation/g151-fixed-funding-v2/predictions/'+file);assert.ok(r.maxTrainLabelAvailableAt<r.trainEnd);assert.equal(r.seeds.length,5);models+=r.seeds.length;}
for(const file of fs.readdirSync('work/genetic-validation-v6/models'))if(file.endsWith('.json')&&!['registration.json','status.json'].includes(file)){const r=read('work/genetic-validation-v6/models/'+file);assert.ok(r.maxTrainLabelAvailableAt<r.trainEnd);assert.equal(r.seeds.length,1);models++;}
for(const cost of p.costCases){const rows=audit.details.filter(t=>t.cost===cost.id);for(const month of new Set(rows.map(t=>t.month))){let cash=200;for(const t of rows.filter(t=>t.month===month)){
 assert.ok(Math.abs(t.entryFee-t.qty*t.entry*cost.fee)<1e-9);assert.ok(Math.abs(t.exitFee-t.qty*t.exit*cost.fee)<1e-9);fees++;
 assert.ok(Math.abs(t.entry-t.entryReference*(1+t.side*cost.slippage))<1e-8);assert.ok(Math.abs(t.exit-t.exitReference*(1-t.side*cost.slippage))<1e-8);fills++;
 assert.ok(t.plannedRisk<=cash*.01+1e-8);assert.ok(t.margin<=cash*.8+1e-8);risks++;
 if(t.reason==='Stop'&&-t.net>t.plannedRisk+1e-8)gapStops.push({month:t.month,entryAt:t.entryAt,netBRL:t.net*5,plannedRiskBRL:t.plannedRisk*5});cash+=t.net;
 }} }
const result={verifiedAt:new Date().toISOString(),sourceHashChecks:hashes,causalModels:models,feeChecks:fees,fillChecks:fills,riskAndMarginChecks:risks,gapStops,originalSourceHashesUnchanged:true,independentHoldout:false,realOrders:false};fs.writeFileSync('web/pesquisa-genetica/diagnostico-perdas-verificacao.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
