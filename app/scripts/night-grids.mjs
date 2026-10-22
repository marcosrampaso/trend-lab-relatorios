// Closed observations only, in separate files. Original packets remain untouched.
import fs from 'node:fs';import {ROOT,read,hash}from'./multiasset-io.mjs';import{candleFeatures,featureInput}from'./specialist-core.mjs';
const b=ROOT+'/work/pepe-night-v1',p=read(b+'/protocol.json'),idx=read('work/pepe-v3-final-v1/features-index.json');
for(const m of idx.months.filter(m=>m.month>='2023-06'&&m.month<='2026-09'&&m.month!=='2024-08')){
 const target=b+'/grids/'+m.month+'.json';if(fs.existsSync(target))continue;
 if(hash(m.path)!==m.sha256||hash(m.rawPath)!==m.rawSHA256)throw Error('Changed closed feature/raw packet');
 const raw=read(m.rawPath),features=read(m.path).features,prev=idx.months.find(v=>v.month===new Date(Date.parse(m.month+'-01T00:00:00Z')-86400000).toISOString().slice(0,7));
 const fallback=read('data/pepe-finrl-v1/manifest.json').months.find(v=>v.month===new Date(Date.parse(m.month+'-01T00:00:00Z')-86400000).toISOString().slice(0,7));const past=prev??{rawPath:fallback?.path,rawSHA256:fallback?.sha256};if(!past.rawPath||hash(past.rawPath)!==past.rawSHA256)throw Error('No causal month boundary context');
 const candles=[...read(past.rawPath).candles.slice(-5),...raw.candles];
 const rows=features.filter(f=>f.at<raw.end).map(f=>{const i=(f.at-raw.start)/60000+5;const x=candleFeatures(f,candles.slice(i-5,i));featureInput(x,x.at);return x;});
 fs.writeFileSync(target,JSON.stringify({month:m.month,start:raw.start,end:raw.end,rows}),{flag:'wx',mode:0o444});
 console.log(JSON.stringify({grid:m.month,rows:rows.length}));
}
