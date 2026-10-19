import fs from'node:fs';import path from'node:path';
import{read,hash,verifyScalpInputs,scalpDataSource}from'./scalp-tree-data.mjs';
import{atomic,isolatedLabel}from'./extended-ml-utils.mjs';
const run=path.resolve(process.argv[2]??'');if(!run.startsWith(path.resolve('work/local-ml/runs')+path.sep))throw Error('Diretório inválido');
const p=read(path.join(run,'registration.json')).protocol,source=scalpDataSource(read('web/data/eth-donchian-history.json'),verifyScalpInputs()),strategy={...read('scalping-protocol.json'),capitalBRL:p.capitalBRL},input=read('data/scalp-tree/features.json');
const maps=Object.fromEntries(p.families.map(f=>[f,new Map(input.features[f].map(x=>[x.at,x]))]));
const first=Date.parse(p.datasetStart),end=Date.parse(p.datasetEnd),manifest=read('data/scalp-tree/manifest.json'),months=manifest.months.filter(m=>Date.parse(m.month+'-01T00:00:00Z')>=first);let completed=0;
function publish(hold,month){const s=read(path.join(run,'status.json'));Object.assign(s,{updatedAt:new Date().toISOString(),labelCompleted:completed,labelTotal:months.length*p.holdingMinutes.length,labelHold:hold,labelMonth:month});atomic(path.join(run,'status.json'),s);atomic('web/data/adaptive-evolution-status.json',s);}
for(const hold of p.holdingMinutes){
 const target=path.join(run,'labels','hold-'+hold+'.json');
 if(fs.existsSync(target)){completed+=months.length;continue;}
 const groups=Object.fromEntries(p.families.map(f=>[f,[]]));
 for(const month of months){
  const file=path.join(run,'labels','hold-'+hold,month.month+'.json');let part;
  if(fs.existsSync(file))part=read(file);else{
   part=Object.fromEntries(p.families.map(f=>[f,[]]));const start=Date.parse(month.month+'-01T00:00:00Z'),last=source.shard(month.month).candles.at(-1)[0]+60000,window=source.window(start,Math.min(last+p.labelAvailableAfterMinutes*60000,end)),index=new Map(window.candles.map((r,i)=>[r[0],i]));
   for(const family of p.families){
    const all=input.signals[family],local=all.filter(s=>s.at>=start&&s.at<last),extended=all.filter(s=>s.at>=start&&s.at<last+p.labelAvailableAfterMinutes*60000);let right=0;
    for(const sig of local){const feature=maps[family].get(sig.at),available=sig.at+p.labelAvailableAfterMinutes*60000;if(!feature||available>end)continue;const offset=index.get(sig.at);if(offset===undefined)throw Error('Sinal sem minuto');while(right<extended.length&&extended[right].at<sig.at)right++;let next=right;while(next<extended.length&&extended[next].at<available)next++;
     const data={...window,candles:window.candles.slice(offset,offset+hold+5),marks:window.marks.slice(offset,offset+hold+5),funding:window.funding.filter(f=>f[0]>=sig.at&&f[0]<sig.at+(hold+5)*60000)};
     const row=isolatedLabel({data,family,sig,nearby:extended.slice(right,next),feature,protocol:strategy,hold,available});if(row)part[family].push(row);
    }
   }atomic(file,part);
  }
  for(const family of p.families)groups[family].push(...part[family]);completed++;publish(hold,month.month);console.log(JSON.stringify({hold,month:month.month,completed}),{flush:true});
 }
 atomic(target,{groups,capitalBRL:p.capitalBRL,holdingMinutes:hold,labelAvailableAfterMinutes:p.labelAvailableAfterMinutes,protocolSHA256:hash('adaptive-genetic-protocol.json')});
}
