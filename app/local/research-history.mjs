import fs from 'node:fs';import path from 'node:path';import {gunzipSync} from 'node:zlib';import {createHash} from 'node:crypto';
export function createHistoryReader(root,{manifestFile='data/history-v2/manifest.json'}={}){
 const cache=new Map();
 return params=>{
  const manifest=JSON.parse(fs.readFileSync(path.resolve(root,manifestFile))),catalog={symbol:manifest.symbol,snapshotEnd:manifest.snapshotEnd,intervals:manifest.intervals,months:manifest.months.map(m=>({month:m.month,complete:m.complete,minutes:m.minutes,alignedMinutes:m.alignedMinutes,firstCandle:m.firstCandle,candleGapMinutes:m.candleGaps.reduce((n,g)=>n+g.missing,0),markGapMinutes:m.markGaps.reduce((n,g)=>n+g.missing,0)}))};
  if(params.get('mode')==='catalog')return catalog;
  const interval=params.get('interval')??'5m',month=params.get('month')??catalog.months.at(-1)?.month,entry=manifest.months.find(m=>m.month===month),frame=entry?.frames[interval];
  if(!frame||!Object.hasOwn(manifest.intervals,interval))throw Error('Período ou mês não disponível');
  const limit=Number(params.get('limit')??150),before=params.has('before')?Number(params.get('before')):Number.MAX_SAFE_INTEGER;
  if(!Number.isInteger(limit)||limit<1||limit>500||!Number.isSafeInteger(before)||before<0)throw Error('Consulta histórica inválida');
  const file=path.resolve(root,frame.path);if(!file.startsWith(path.resolve(root,'data')+path.sep))throw Error('Caminho fora do catálogo de dados');
  const key=file+'/'+frame.sha256;
  if(!cache.has(key)){const bytes=fs.readFileSync(file);if(createHash('sha256').update(bytes).digest('hex')!==frame.sha256)throw Error('Checksum de histórico divergente');cache.set(key,JSON.parse((frame.encoding==='gzip'?gunzipSync(bytes):bytes).toString()));if(cache.size>3)cache.delete(cache.keys().next().value);}
  const data=cache.get(key),all=data.candles;let end=all.length;
  while(end&&all[end-1][0]>=before)end--;
  const start=Math.max(0,end-limit),candles=all.slice(start,end),width=frame.intervalMinutes*60000;
  return {symbol:manifest.symbol,month,interval,intervalMinutes:frame.intervalMinutes,candles,complete:entry.complete,totalCandles:all.length,hasEarlier:start>0,hasLater:end<all.length,previousBefore:candles[0]?.[0]??null,nextBefore:all[Math.min(all.length-1,end+limit-1)]?.[0]+width,snapshotEnd:manifest.snapshotEnd};
 };
}
