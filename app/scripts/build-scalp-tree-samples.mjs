import fs from 'node:fs';
import {prepareScalping,aggregateFive,MINUTE} from '../web/scalping.js';
import {simulateScalpTree} from '../web/scalp-tree-engine.js';
import {scalpTrendFrames,scalpFeatures} from '../web/scalp-tree.js';
import {read,hash,saveOnce,verifyScalpInputs,scalpDataSource} from './scalp-tree-data.mjs';

const p=read('scalp-tree-protocol.json'),strategy=read('scalping-protocol.json'),history=read('web/data/eth-donchian-history.json');
const manifest=verifyScalpInputs(),source=scalpDataSource(history,manifest),five=[];
for(const item of manifest.months)five.push(...aggregateFive(source.shard(item.month).candles));
const hourly=[];
for(let i=0;i<five.length;i+=12){const a=five.slice(i,i+12);if(a.length!==12)throw Error('Hora incompleta');hourly.push([a[0][0],a[0][1],Math.max(...a.map(r=>r[2])),Math.min(...a.map(r=>r[3])),a.at(-1)[4],a.reduce((n,r)=>n+r[5],0)]);}
const contextRows=[...history.candles.filter(r=>r[0]<Date.parse(p.warmupStart)),...hourly];
const prepared=prepareScalping({five},strategy),frames=scalpTrendFrames(contextRows,read('scalping-context-protocol.json').trend);
const groups={},features={},signals={},excluded={};
const datasetEnd=Date.parse(p.end);
for(const family of p.families){
  features[family]=prepared.signals[family].map(sig=>scalpFeatures(sig.context,sig.side,frames,strategy)).filter(Boolean);
  signals[family]=prepared.signals[family].map(({context,...sig})=>({...sig,context:{}}));
  groups[family]=[];excluded[family]={warmup:0,incomplete:0,notExecutable:0};
}
const maps=Object.fromEntries(p.families.map(f=>[f,new Map(features[f].map(s=>[s.at,s]))]));
for(const item of manifest.months){
  const monthStart=Date.parse(item.month+'-01T00:00:00Z');
  if(monthStart<Date.parse(p.start))continue;
  const shard=source.shard(item.month),last=shard.candles.at(-1)[0]+MINUTE;
  const extendedEnd=Math.min(last+p.labelAvailableAfterMinutes*MINUTE,datasetEnd);
  const window=source.window(monthStart,extendedEnd),index=new Map(window.candles.map((r,i)=>[r[0],i]));
  for(const family of p.families){
    const all=signals[family];
    for(const sig of all.filter(s=>s.at>=monthStart&&s.at<last)){
      const x=maps[family].get(sig.at),available=sig.at+p.labelAvailableAfterMinutes*MINUTE;
      if(!x){excluded[family].warmup++;continue;}
      if(available>datasetEnd){excluded[family].incomplete++;continue;}
      const offset=index.get(sig.at);if(offset===undefined)throw Error('Entrada sem minuto');
      const slice={...window,candles:window.candles.slice(offset,offset+p.labelAvailableAfterMinutes),marks:window.marks.slice(offset,offset+p.labelAvailableAfterMinutes),funding:window.funding.filter(f=>f[0]>=sig.at&&f[0]<available)};
      const nearby=all.filter(s=>s.at>=sig.at&&s.at<available);
      const r=simulateScalpTree(slice,{strategy:family,start:sig.at,until:available,protocol:{...strategy,maxHoldMinutes:p.maxHoldMinutes},cost:strategy.costCases.find(c=>c.id===p.labelCostCase),prepared:{signals:{[family]:nearby}},entryFilter:s=>s.at===sig.at?null:'Rótulo isolado: sem reentrada',closeAtEnd:true});
      const t=r.trades.find(t=>t.signalAt===sig.at&&t.entryAt===sig.at);
      if(!t){excluded[family].notExecutable++;continue;}
      groups[family].push({...x,y:t.net>0?1:0,netUSDT:t.net,netR:t.net/t.plannedRisk,labelAvailableAt:available,exitAt:t.exitAt,reason:t.reason});
    }
  }
  console.log(JSON.stringify({month:item.month,labels:Object.fromEntries(p.families.map(f=>[f,groups[f].length]))}));
}
const frameStart=Date.parse(p.start)-4*3600000;
const compactFrames=Object.fromEntries(Object.entries(frames).map(([k,a])=>[k,a.filter(b=>b.at>=frameStart&&b.at<=datasetEnd)]));
saveOnce('data/scalp-tree/features.json',{protocolSHA256:hash('scalp-tree-protocol.json'),features,signals,frames:compactFrames});
saveOnce('data/scalp-tree/samples.json',{protocolSHA256:hash('scalp-tree-protocol.json'),groups,excluded,manifestSHA256:hash('data/scalp-tree/manifest.json')});
console.log(JSON.stringify({done:true,excluded,samples:Object.fromEntries(p.families.map(f=>[f,groups[f].length]))}));
