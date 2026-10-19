import fs from 'node:fs';
import {read,hash,scalpDataSource} from './scalp-tree-data.mjs';import {atomic,summarize} from './extended-ml-utils.mjs';
import {monthAt} from '../web/scalp-tree.js';import {simulateAdaptive} from '../web/research-adaptive-funding.js';import {routedSignals} from '../web/adaptive-policy.js';
import {cdiWindow,dailyEquity} from '../web/compound-math.js';
import {RUN,SOURCE,FAMILIES,ARMS,tradeStats,grouped,auditTrades} from './expanded-validation-funding-common.mjs';
const p=read(RUN+'/registration.json'),control=read(RUN+'/control.json'),status=read(RUN+'/status.json');
const strategy={...read('scalping-protocol.json'),capitalBRL:p.capitalBRL};
const source=scalpDataSource(read('web/data/eth-donchian-history.json'),read('data/scalp-tree-extended/manifest.json'));
const daily=read('data/cdi/extended/daily.json'),monthly=read('data/cdi/extended/monthly.json'),oldFolds=read(SOURCE+'/registration.json').protocol.validationFolds;
const selectedMonths=new Set(control.rows.map(r=>r.month));
const compactCDI=(start,end)=>{const result=cdiWindow(daily,monthly,start,end,1000);delete result.curve;return result;};
function compactResult(result,month,caseId,maps,predictions){
 auditTrades(result);
 return {...summarize(result,1440),pnlBRL:result.pnl*5,curve:dailyEquity(result.equity,result.start,200,5),trades:result.trades.map(({context,...t})=>({...t,month,cost:caseId,score:predictions.get(t.family+'/'+t.holdMinutes)?.get(t.signalAt),feature:maps[t.family].get(t.signalAt)?.x})),reasons:Object.fromEntries([...new Set(result.events.map(e=>e.reason))].filter(Boolean).map(r=>[r,result.events.filter(e=>e.reason===r).length]))};
}
for(const block of p.plan.blocks){
 const target=RUN+'/results/'+block.id+'.json';if(fs.existsSync(target))continue;
 if(!ARMS.every(a=>fs.existsSync(RUN+'/predictions/'+block.id+'-'+a.family+'.json')))continue;
 const input={features:{},signals:{}},parts=block.months.map(m=>read(RUN+'/months/'+m+'.json'));
 for(const f of FAMILIES){input.features[f]=parts.flatMap(s=>s.features[f]);input.signals[f]=parts.flatMap(s=>s.signals[f]);}
 const maps=Object.fromEntries(FAMILIES.map(f=>[f,new Map(input.features[f].map(r=>[r.at,r]))])),predictions=new Map(),audits=[];
 for(const arm of ARMS){const r=read(RUN+'/predictions/'+block.id+'-'+arm.family+'.json');
  if(r.registrationSHA256!==hash(RUN+'/registration.json')||r.trainEnd!==monthAt(block.trainEnd)||r.trainStart!==monthAt(block.trainStart)||r.maxTrainLabelAvailableAt>=r.trainEnd||r.seeds.length!==5)throw Error('Treino não causal');
  predictions.set(arm.family+'/'+arm.hold,new Map(r.predictions));const {predictions:_,...audit}=r;audits.push(audit);
 }
 const start=monthAt(block.id),end=monthAt(block.end),signals=routedSignals(input.signals,maps,p.genome,predictions,{start,end}),rows=[];
 for(const m of block.months){const a=monthAt(m),b=monthAt(m,1),data=source.window(a,b),local=signals.filter(s=>s.at>=a&&s.at<b),row={month:m,selectionMonth:selectedMonths.has(m),allowed:local.filter(s=>s.entryAllowed).length,cdi:compactCDI(a,b)};
  for(const cost of strategy.costCases)row[cost.id]=compactResult(simulateAdaptive(data,{start:a,until:b,protocol:strategy,cost,signals:local,closeAtEnd:true}),m,cost.id,maps,predictions);
  rows.push(row);
 }
 const continuous={cdi:compactCDI(start,end)};for(const cost of strategy.costCases)continuous[cost.id]=compactResult(simulateAdaptive(source.window(start,end),{start,until:end,protocol:strategy,cost,signals,closeAtEnd:true}),block.id,cost.id,maps,predictions);
 // Three registered blocks coincide with the original nine-month control.
 const fold=new Date(monthAt(block.id,3)).toISOString().slice(0,7);let controlParity=null;
 if(oldFolds.includes(fold)){
  controlParity={months:block.months.length,maximumPnLDifference:Math.max(...rows.flatMap(row=>['base','stress'].map(k=>Math.abs(row[k].pnlBRL-control.rows.find(r=>r.month===row.month)[k].pnlBRL))))};
  controlParity.note='Diferença esperada: funding e rótulos corrigidos em estudo separado; controle antigo preservado.';
 }
 atomic(target,{block,rows,continuous,audits,controlParity,completedAt:new Date().toISOString()});
 console.log(JSON.stringify({evaluatedBlock:block.id,monthlyStressBRL:rows.map(r=>r.stress.pnlBRL)}));
}
const blocks=p.plan.blocks.filter(b=>fs.existsSync(RUN+'/results/'+b.id+'.json')).map(b=>read(RUN+'/results/'+b.id+'.json'));
const rows=blocks.flatMap(b=>b.rows),trades=rows.flatMap(r=>r.stress.trades),other=rows.filter(r=>!r.selectionMonth);
function aggregate(rows){const ts=rows.flatMap(r=>r.stress.trades);return {months:rows.length,...tradeStats(ts),meanMonthlyBRL:rows.length?rows.reduce((n,r)=>n+r.stress.pnlBRL,0)/rows.length:null,baseMeanMonthlyBRL:rows.length?rows.reduce((n,r)=>n+r.base.pnlBRL,0)/rows.length:null,positiveMonths:rows.filter(r=>r.stress.pnlBRL>0).length,flatMonths:rows.filter(r=>!r.stress.count).length,beatsCDIMonths:rows.filter(r=>r.cdi.available&&r.stress.pnlBRL>r.cdi.profitBRL).length,meanCDIBRL:rows.length?rows.reduce((n,r)=>n+(r.cdi.available?r.cdi.profitBRL:0),0)/rows.length:null,maxDD:Math.max(0,...rows.map(r=>r.stress.maxDD)),haltedMonths:rows.filter(r=>r.stress.halted).length};}
const report={version:p.version,updatedAt:new Date().toISOString(),stage:status.stage,genome:p.genome,plan:p.plan,completedBlocks:blocks.length,totalBlocks:p.plan.blocks.length,completedMonths:rows.length,totalMonths:p.plan.testMonths.length,control,aggregate:aggregate(rows),outsideSelection:aggregate(other),byReason:grouped(trades,'reason'),byRegime:grouped(trades,'regime'),bySide:grouped(trades,'side'),byYear:grouped(trades.map(t=>({...t,year:t.month.slice(0,4)})),'year'),blocks,fundingMethod:p.fundingMethod,notes:p.notes,realOrders:false,parameterSearch:false,finalTestConsulted:false};
atomic(RUN+'/report.json',report);atomic('web/data/expanded-validation.json',report);
console.log(JSON.stringify({stage:status.stage,blocks:blocks.length,months:rows.length,summary:report.aggregate,outsideSelection:report.outsideSelection}));
