import path from 'node:path';import {ROOT,BASE,read,hash} from './multiasset-io.mjs';import {aggregateRows} from './multiasset-core.mjs';
export function daytradeHourlyInputs(){
 const definition=read(path.join(ROOT,'daytrade-integrated-protocol.json')),start=Date.parse(definition.historical.start),end=Date.parse(definition.historical.end),from='2025-08',to=definition.historical.end.slice(0,7),hourly={},sourceHashes={};
 for(const [symbol,manifestPath]of [['ETHUSDT','data/scalp-tree/manifest.json'],['BTCUSDT','work/multiasset-v1/history/manifest.json']]){const manifest=read(path.join(ROOT,manifestPath));sourceHashes[manifestPath]=hash(path.join(ROOT,manifestPath));hourly[symbol]=[];
  for(const item of manifest.months.filter(m=>m.month>=from&&m.month<to)){if(hash(path.join(ROOT,item.path))!==item.sha256)throw Error('Hourly input shard changed');hourly[symbol].push(...aggregateRows(read(path.join(ROOT,item.path)).candles,3600000));sourceHashes[item.path]=item.sha256;}
 }
 const markets=Object.fromEntries([['ETHUSDT','eth'],['BTCUSDT','btc']].map(([s,id])=>{const f=path.join(BASE,id+'-test-market.json');sourceHashes[path.relative(ROOT,f)]=hash(f);return [s,read(f)];}));return {start,end,hourly,markets,sourceHashes};
}
