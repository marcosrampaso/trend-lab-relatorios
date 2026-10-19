import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {monthAt,monthsBetween} from '../web/scalp-tree.js';

export const read=p=>JSON.parse(fs.readFileSync(p));
export const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
export function saveOnce(file,value){
  const bytes=JSON.stringify(value);
  if(fs.existsSync(file)){if(fs.readFileSync(file,'utf8')!==bytes)throw Error('Reprodução diverge; não sobrescrito: '+file);}
  else fs.writeFileSync(file,bytes);
}
export function verifyScalpInputs(){
  const frozen=read('scalping-context-freeze.json');
  for(const[file,expected]of Object.entries(frozen.files))if(hash(file)!==expected)throw Error('Estudo anterior alterado: '+file);
  const manifest=read('data/scalp-tree/manifest.json');
  for(const item of manifest.months)if(hash(item.path)!==item.sha256)throw Error('Shard alterado: '+item.month);
  return manifest;
}
export function scalpDataSource(history,manifest){
  const cache=new Map(),items=new Map(manifest.months.map(m=>[m.month,m]));
  function shard(month){
    if(!cache.has(month)){
      if(!items.has(month))throw Error('Mês não coletado: '+month);
      cache.set(month,read(items.get(month).path));
      if(cache.size>5)cache.delete(cache.keys().next().value);
    }
    return cache.get(month);
  }
  function window(start,end){
    const months=monthsBetween(new Date(monthAt(new Date(start).toISOString())).toISOString(),new Date(end).toISOString());
    const parts=months.map(shard);
    return {candles:parts.flatMap(m=>m.candles).filter(r=>r[0]>=start&&r[0]+60000<=end),
      marks:parts.flatMap(m=>m.marks).filter(r=>r[0]>=start&&r[0]+60000<=end),
      funding:history.funding.filter(r=>r[0]>=start&&r[0]<end),filters:history.filters};
  }
  return {shard,window};
}
