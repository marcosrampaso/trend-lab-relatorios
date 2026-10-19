import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
import {read,hash,scalpDataSource} from './scalp-tree-data.mjs';
import {atomic,isolatedLabel} from './extended-ml-utils.mjs';
import {aggregateFive,prepareScalping} from '../web/scalping.js';
import {scalpFeatures,scalpTrendFrames,monthAt} from '../web/scalp-tree.js';
import {averagePredictions} from './local-ml-evaluation.mjs';
import {simulateAdaptive} from '../web/adaptive-engine.js';import {routedSignals} from '../web/adaptive-policy.js';
import {cdiWindow} from '../web/compound-math.js';
import {RUN,SOURCE,FAMILIES,ARMS,planHistory,month,tradeStats,grouped,auditTrades} from './expanded-validation-common.mjs';

const manifest=read('data/scalp-tree-extended/manifest.json'),old=read('data/scalp-tree/features.json');
const origin=read(SOURCE+'/registration.json'),winner=read(SOURCE+'/seed-winner.json'),g=winner.genome;
const strategy={...read('scalping-protocol.json'),capitalBRL:1000},history=read(manifest.fundingSource);
const plan=planHistory(manifest.months),source=scalpDataSource(history,manifest);
const scripts=['scripts/expanded-validation-common.mjs','scripts/prepare-expanded-validation.mjs','scripts/evaluate-expanded-validation.mjs','scripts/train-expanded-validation.py'];
const status=(stage,extra={})=>atomic(RUN+'/status.json',{...(fs.existsSync(RUN+'/status.json')?read(RUN+'/status.json'):{}),stage,updatedAt:new Date().toISOString(),...extra});
if(!fs.existsSync(RUN+'/registration.json')){
 for(const [file,sha] of Object.entries(origin.fingerprint))if(hash(file)!==sha)throw Error('Fonte da campanha alterada: '+file);
 const registration={version:'g151-fixed-expanded-v1',registeredAt:new Date().toISOString(),genome:g,plan,seeds:origin.protocol.seeds,capitalBRL:1000,fx:5,trainMonths:9,retrainEveryMonths:3,labelAvailableAfterMinutes:1445,workers:2,threadsPerWorker:1,realOrders:false,usedForSelection:false,sourceSHA256:Object.fromEntries(['data/scalp-tree-extended/manifest.json',manifest.fundingSource,SOURCE+'/seed-winner.json',...scripts,...Object.keys(origin.fingerprint)].map(f=>[f,hash(f)])),notes:['Campeão fixo; nenhum ajuste de parâmetro após os resultados.','Um mês inteiro de aquecimento após cada lacuna, seguido de nove meses de treino.','Retreino a cada bloco de até três meses; rótulos maturados estritamente antes do começo do bloco.','Meses reiniciam R$1.000, com reinvestimento dentro do mês. Blocos também são simulados sem reinício interno.','Resultados mensais e blocos independentes não formam uma conta contínua em seis anos.','Setembro de 2026 reservado. Meses já usados pela busca são identificados.','Câmbio fixo de R$5/USDT, filtros da corretora retrospectivos; CDI e bot antes de impostos.','Pesquisa retrospectiva, mesmo nos anos não usados por esta campanha; nenhuma prova de lucro futuro.']};
 atomic(RUN+'/registration.json',registration);status('registered',{totalMonths:plan.testMonths.length,totalBlocks:plan.blocks.length});
}
const registered=read(RUN+'/registration.json');
for(const f of scripts)if(hash(f)!==registered.sourceSHA256[f])throw Error('Implementação registrada mudou: '+f);
for(const item of manifest.months)if(hash(item.path)!==item.sha256)throw Error('Shard alterado: '+item.month);
if(hash(manifest.fundingSource)!==manifest.fundingSourceSHA256)throw Error('Funding alterado');

// Exact reproduction on the nine months selected by the genetic search.
if(!fs.existsSync(RUN+'/control.json')){
 const maps=Object.fromEntries(FAMILIES.map(f=>[f,new Map(old.features[f].map(r=>[r.at,r]))]));
 const cache=read(SOURCE+'/model-cache.json'),rows=[],trades=[],daily=read('data/cdi/extended/daily.json'),monthly=read('data/cdi/extended/monthly.json');
 for(const fold of origin.protocol.validationFolds){
  const predictions=new Map();
  for(const arm of ARMS){const key=createHash('sha256').update(JSON.stringify({algorithm:g.algorithm,family:arm.family,hold:arm.hold,params:Object.fromEntries(Object.entries(g.params).sort()),trainMonths:g.trainMonths})).digest('hex').slice(0,20);
   const replicas=cache[key].map(read).filter(r=>r.fold===fold);if(replicas.length!==5)throw Error('Réplicas incompletas');
   const [avg]=averagePredictions(replicas);predictions.set(arm.family+'/'+arm.hold,new Map(avg.validation));
  }
  for(const offset of [-3,-2,-1]){
   const m=month(fold,offset),start=monthAt(m),end=monthAt(m,1),data=source.window(start,end),signals=routedSignals(old.signals,maps,g,predictions,{start,end}),row={month:m,cdi:cdiWindow(daily,monthly,start,end,1000)};delete row.cdi.curve;
   for(const cost of strategy.costCases){const result=simulateAdaptive(data,{start,until:end,protocol:strategy,cost,signals,closeAtEnd:true});auditTrades(result);const expected=winner.metrics.find(x=>x.fold===fold).months.find(x=>x.month===m)[cost.id];if(Math.abs(result.pnl-expected.pnlUSDT)>1e-10||result.trades.length!==expected.count)throw Error('Controle não reproduziu '+m);
    row[cost.id]={pnlBRL:result.pnl*5,count:result.trades.length,maxDD:result.maxDD,halted:result.halted};
    trades.push(...result.trades.map(({context,...t})=>({...t,month:m,cost:cost.id,feature:maps[t.family].get(t.signalAt)?.x,score:predictions.get(t.family+'/'+t.holdMinutes)?.get(t.signalAt)})));
   }rows.push(row);
  }
 }
 const stress=trades.filter(t=>t.cost==='stress');atomic(RUN+'/control.json',{verifiedAt:new Date().toISOString(),exact:true,rows,trades,stats:tradeStats(stress),byReason:grouped(stress,'reason'),byRegime:grouped(stress,'regime'),monthlyBRL:rows.reduce((n,r)=>n+r.stress.pnlBRL,0)/9,realOrders:false});
 status('control_verified',{controlMonthlyBRL:rows.reduce((n,r)=>n+r.stress.pnlBRL,0)/9});
}
if(process.argv.includes('--control-only'))process.exit(0);

// Canonical frozen features/labels are reused from Jan/2024 onward. Earlier
// features are generated independently inside contiguous minute-data segments.
const oldLabels=Object.fromEntries(ARMS.map(a=>[a.family,read(SOURCE+'/labels/hold-'+a.hold+'.json').groups[a.family]]));
for(const segment of plan.segments){
 if(!segment.test.length)continue;
 const earlyMonths=segment.months.filter(m=>m<'2024-01');let early=null;
 if(earlyMonths.length){
  const five=[];for(const m of earlyMonths)five.push(...aggregateFive(source.shard(m).candles));
  const hourly=[];for(let i=0;i<five.length;i+=12){const a=five.slice(i,i+12);if(a.length!==12)throw Error('Hora incompleta');hourly.push([a[0][0],a[0][1],Math.max(...a.map(r=>r[2])),Math.min(...a.map(r=>r[3])),a.at(-1)[4],a.reduce((n,r)=>n+r[5],0)]);}
  const prepared=prepareScalping({five},strategy),frames=scalpTrendFrames(hourly,read('scalping-context-protocol.json').trend);
  early={features:{},signals:{}};
  for(const family of FAMILIES){early.features[family]=prepared.signals[family].map(s=>scalpFeatures(s.context,s.side,frames,strategy)).filter(Boolean);early.signals[family]=prepared.signals[family].map(({context,...s})=>({...s,context:{}}));}
 }
 const allSignals=Object.fromEntries(FAMILIES.map(f=>[f,[...(early?.signals[f]??[]),...old.signals[f].filter(s=>s.at>=monthAt('2024-01')&&s.at<monthAt(segment.months.at(-1),1))]]));
 for(const m of segment.months){
  if(m>=plan.reserved)continue;const file=RUN+'/months/'+m+'.json';if(fs.existsSync(file))continue;
  const start=monthAt(m),end=monthAt(m,1),input=m<'2024-01'?early:old;
  const part={month:m,features:{},signals:{},labels:{}};
  for(const f of FAMILIES){part.features[f]=input.features[f].filter(s=>s.at>=start&&s.at<end);part.signals[f]=allSignals[f].filter(s=>s.at>=start&&s.at<end);}
  if(m<'2024-01'){
   const segmentEnd=monthAt(segment.months.at(-1),1),until=Math.min(end+1445*60000,segmentEnd),data=source.window(start,until),index=new Map(data.candles.map((r,i)=>[r[0],i]));
   for(const {family,hold} of ARMS){const maps=new Map(part.features[family].map(r=>[r.at,r])),near=allSignals[family].filter(s=>s.at>=start&&s.at<until);part.labels[family]=[];let right=0;
    for(const sig of part.signals[family]){const feature=maps.get(sig.at),available=sig.at+1445*60000;if(!feature||available>segmentEnd)continue;const offset=index.get(sig.at);if(offset===undefined)throw Error('Sinal sem minuto');while(right<near.length&&near[right].at<sig.at)right++;let next=right;while(next<near.length&&near[next].at<available)next++;
     const slice={...data,candles:data.candles.slice(offset,offset+hold+5),marks:data.marks.slice(offset,offset+hold+5),funding:data.funding.filter(f=>f[0]>=sig.at&&f[0]<sig.at+(hold+5)*60000)};
     const row=isolatedLabel({data:slice,family,sig,nearby:near.slice(right,next),feature,protocol:strategy,hold,available});if(row)part.labels[family].push(row);
    }
   }
  }else for(const {family} of ARMS)part.labels[family]=oldLabels[family].filter(r=>r.at>=start&&r.at<end);
  atomic(file,part);status('preparing',{preparingMonth:m,preparedMonths:fs.readdirSync(RUN+'/months').length});console.log(JSON.stringify({stage:'prepared',month:m}));
 }
}
status('prepared');
