import fs from 'node:fs';import path from 'node:path';import {spawn} from 'node:child_process';import {createHash} from 'node:crypto';
export const ROOT=path.resolve(import.meta.dirname,'..'),BASE=path.join(ROOT,'work/multiasset-v1');
export const read=f=>JSON.parse(fs.readFileSync(f,'utf8')),hash=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
export function atomic(file,data){fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=file+'.'+process.pid+'.tmp';fs.writeFileSync(tmp,JSON.stringify(data));fs.renameSync(tmp,file);}
export function infer(models,params,rows){
 if(!rows.length)return Promise.resolve([]);
 return new Promise((resolve,reject)=>{
  const child=spawn(path.join(ROOT,'.venv-ml/bin/python'),[path.join(ROOT,'scripts/multiasset-inference.py')],{cwd:ROOT,stdio:['pipe','pipe','pipe']});let stdout='',stderr='';const timer=setTimeout(()=>{child.kill();reject(Error('Forest inference timeout'));},120000);
  child.on('error',e=>{clearTimeout(timer);reject(e);});child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr=(stderr+b).slice(-3000));child.on('close',c=>{clearTimeout(timer);if(c)return reject(Error(stderr));try{resolve(JSON.parse(stdout).scores);}catch(e){reject(e);}});child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify({models,params,rows}));
 });
}
export function inventories(){
 const archive='champions/g151-c6cb2a8370cd058b0be0',g=read(path.join(ROOT,'web/data/g151-news-filter-v1.json')).registration.protocol,original=Object.fromEntries(Object.entries(g.models).map(([f,a])=>[f,a.map(m=>({path:archive+'/'+m.model,sha256:m.sha256,trainEnd:m.trainEnd,seed:m.seed}))])),btc=read(path.join(BASE,'btc-models.json'));
 for(const m of [...Object.values(original).flat(),...Object.values(btc.models).flat()])if(hash(path.join(ROOT,m.path))!==m.sha256)throw Error('Model hash mismatch');
 return {genome:g.genome,original,btc:btc.models,trainedAt:btc.trainedAt};
}
export async function json(url){const r=await fetch(url,{signal:AbortSignal.timeout(25000),redirect:'error'});if(!r.ok)throw Error('HTTP '+r.status+' '+url);return r.json();}
export const alive=pid=>{try{if(!Number.isInteger(pid)||pid<=0)return false;process.kill(pid,0);return true;}catch{return false;}};
