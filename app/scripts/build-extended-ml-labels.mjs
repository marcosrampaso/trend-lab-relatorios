import fs from'node:fs';import path from'node:path';
import{read,hash,verifyScalpInputs,scalpDataSource}from'./scalp-tree-data.mjs';
import{atomic,publishStage,isolatedLabel}from'./extended-ml-utils.mjs';
const run=path.resolve(process.argv[2]??'');if(!run.startsWith(path.resolve('work/local-ml/runs')+path.sep))throw Error('Diretório inválido');
const p=read(path.join(run,'registration.json')).protocol,manifest=verifyScalpInputs(),source=scalpDataSource(read('web/data/eth-donchian-history.json'),manifest),strategy=read('scalping-protocol.json'),input=read('data/scalp-tree/features.json'),old=read('data/scalp-tree/samples.json');
const maps=Object.fromEntries(p.families.map(f=>[f,new Map(input.features[f].map(x=>[x.at,x]))]));
const months=manifest.months.filter(m=>Date.parse(m.month+'-01T00:00:00Z')>=Date.parse(p.datasetStart));let completed=0;const total=months.length*(p.holdingMinutes.length-1),end=Date.parse(p.datasetEnd);
for(const hold of p.holdingMinutes){
 const target=path.join(run,'labels','hold-'+hold+'.json');if(fs.existsSync(target)){if(hold!==30)completed+=months.length;continue;}
 const groups=Object.fromEntries(p.families.map(f=>[f,[]]));
 if(hold===30){Object.assign(groups,old.groups);}else for(const month of months){
  const file=path.join(run,'labels','hold-'+hold,month.month+'.json');
  let part;if(fs.existsSync(file))part=read(file);else{
   part=Object.fromEntries(p.families.map(f=>[f,[]]));const start=Date.parse(month.month+'-01T00:00:00Z'),last=source.shard(month.month).candles.at(-1)[0]+60000,window=source.window(start,Math.min(last+245*60000,end)),index=new Map(window.candles.map((r,i)=>[r[0],i]));
   for(const family of p.families){const all=input.signals[family],local=all.filter(s=>s.at>=start&&s.at<last),extended=all.filter(s=>s.at>=start&&s.at<last+245*60000);let right=0;
    for(const sig of local){const feature=maps[family].get(sig.at),available=sig.at+p.labelAvailableAfterMinutes*60000;if(!feature||available>end)continue;const offset=index.get(sig.at);if(offset===undefined)throw Error('Entrada sem minuto');while(right<extended.length&&extended[right].at<sig.at)right++;let next=right;while(next<extended.length&&extended[next].at<available)next++;
     const data={...window,candles:window.candles.slice(offset,offset+245),marks:window.marks.slice(offset,offset+245),funding:window.funding.filter(f=>f[0]>=sig.at&&f[0]<available)};
     const row=isolatedLabel({data,family,sig,nearby:extended.slice(right,next),feature,protocol:strategy,hold,available});if(row)part[family].push(row);
    }
   }atomic(file,part);
  }
  for(const family of p.families)groups[family].push(...part[family]);completed++;publishStage(run,{labelCompleted:completed,labelTotal:total,labelHold:hold,labelMonth:month.month});console.log(JSON.stringify({stage:'labels',hold,month:month.month,completed,total}));
 }
 atomic(target,{groups,protocolSHA256:hash('local-ml-extended-protocol.json'),holdingMinutes:hold});
}
console.log(JSON.stringify({labelsReady:true}));
