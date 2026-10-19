import fs from 'node:fs';import path from 'node:path';
import {searchView,portfolioView} from './research-genetic-view.mjs';
import {cdiWindow} from '../web/compound-math.js';
function readerForRun(root,relativeRun){
 let cached=null,last=0,searchCache=new Map(),daily=null,monthly=null;
 const run=path.join(root,relativeRun);
 function cdi(start,end,original){
  daily??=JSON.parse(fs.readFileSync(path.join(root,'data/cdi/extended/daily.json')));
  monthly??=JSON.parse(fs.readFileSync(path.join(root,'data/cdi/extended/monthly.json')));
  const value=cdiWindow(daily,monthly,Date.parse(start+'-01T00:00:00Z'),Date.parse(end+'-01T00:00:00Z'),1000);
  if(!value.available||Math.abs(value.profitBRL-original.profitBRL)>1e-7)throw Error('Curva CDI diverge do resultado registrado');
  return value;
 }
 function view(source){
  const v=searchView(source);if(v.leader)for(const b of v.leader.blocks)b.cdi=cdi(b.start,b.end,b.cdi);return v;
 }
 return()=>{
  const status=JSON.parse(fs.readFileSync(path.join(run,'status.json'))),file=path.join(run,'report.json'),mtime=fs.statSync(file).mtimeMs;
  if(mtime!==last){
   const r=JSON.parse(fs.readFileSync(file)),rejections={};
   const folds=r.folds.map(f=>{for(const c of f.candidates)for(const reason of c.metrics.rejections)rejections[reason]=(rejections[reason]??0)+1;
    return {fold:f.fold,history:f.history,candidateCount:f.candidates.length,eligible:f.candidates.filter(c=>c.metrics.eligible).length,frozen:f.frozen,
     outer:Object.fromEntries(Object.entries(f.outer).map(([k,v])=>[k,{cdi:cdi(v.start,v.end,v.cdi),base:portfolioView(v.base),stress:portfolioView(v.stress)}])),search:view(f)};});
   cached={updatedAt:r.updatedAt,stage:r.stage,protocol:r.protocol,coverage:r.coverage,summary:r.summary,retrospectiveGates:r.retrospectiveGates,promoted:r.promoted,realOrders:false,independentHoldout:false,folds,rejections,newMLFits:r.newMLFits};last=mtime;
  }
  const currentFile=path.join(run,'search',status.fold+'.json');let activeSearch=null;
  if(fs.existsSync(currentFile)){
   const currentMtime=fs.statSync(currentFile).mtimeMs,previous=searchCache.get(currentFile);
   if(previous?.mtime===currentMtime)activeSearch=previous.value;
   else{activeSearch=view(JSON.parse(fs.readFileSync(currentFile)));searchCache.set(currentFile,{mtime:currentMtime,value:activeSearch});}
  }
  return {...cached,status,activeSearch};
 };
}

export function createGeneticReader(root){
 const paths={v6:'work/genetic-validation-v6/pilot-20261019-v1','stability-1':'work/genetic-validation-v6/stability/replica-1','stability-2':'work/genetic-validation-v6/stability/replica-2','stability-3':'work/genetic-validation-v6/stability/replica-3'},readers=new Map();
 return (query=new URLSearchParams())=>{
  const key=query.get('run')??'v6';if(!Object.hasOwn(paths,key))throw Error('Execução não permitida');
  if(!readers.has(key))readers.set(key,readerForRun(root,paths[key]));
  const file=path.join(root,'work/genetic-validation-v6/stability/status.json');
  return {...readers.get(key)(),campaign:{id:key,title:key==='v6'?'V6 original':'Estabilidade V6 · réplica '+key.at(-1)},stability:fs.existsSync(file)?JSON.parse(fs.readFileSync(file)):null};
 };
}
