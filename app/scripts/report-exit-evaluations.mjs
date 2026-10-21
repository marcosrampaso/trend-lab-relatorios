import fs from'node:fs';import{pathToFileURL}from'node:url';import{ROOT,read,hash,atomic}from'./multiasset-io.mjs';
let previous='';
export function exportExitEvaluations(){
 const base=ROOT+'/work/pepe-exits-v1',s=read(base+'/status.json'),signature=JSON.stringify(Object.values(s.runs??{}).map(r=>[r.key,r.evaluations?.map(e=>e.steps)]));if(signature===previous)return;
 const runs={};for(const r of Object.values(s.runs??{})){runs[r.key]=[];for(const ev of r.evaluations??[]){const b=base+'/runs/'+r.key,file=b+'/evaluation-'+ev.steps+'.json',d=read(file);if(hash(b+'/model-'+ev.steps+'.zip')!==d.modelSHA256)throw Error('Evaluation/weight mismatch');runs[r.key].push(d);}}
 atomic(ROOT+'/web/data/exit-evaluations.json',{app:'trend-lab-exit-evaluations',runs,updatedAt:Date.now(),realOrders:false});previous=signature;
}
if(import.meta.url===pathToFileURL(process.argv[1]??'').href)exportExitEvaluations();
