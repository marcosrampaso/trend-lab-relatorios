// Isolate the accounting correction: same original model scores and signals.
import fs from 'node:fs';import {read,scalpDataSource} from './scalp-tree-data.mjs';import {atomic} from './extended-ml-utils.mjs';
import {SOURCE,FAMILIES,ARMS,auditTrades} from './expanded-validation-common.mjs';
import {simulateAdaptive} from '../web/research-adaptive-funding.js';import {routedSignals} from '../web/adaptive-policy.js';import {monthAt} from '../web/scalp-tree.js';
const legacy='work/expanded-validation/g151-fixed-v1',run='work/expanded-validation/g151-fixed-funding-v2',p=read(run+'/registration.json'),strategy={...read('scalping-protocol.json'),capitalBRL:1000};
const source=scalpDataSource(read('web/data/eth-donchian-history.json'),read('data/scalp-tree-extended/manifest.json')),folds=read(SOURCE+'/registration.json').protocol.validationFolds,rows=[];
for(const fold of folds){
 const first=new Date(monthAt(fold,-3)).toISOString().slice(0,7),block=read(legacy+'/results/'+first+'.json'),predictions=new Map(ARMS.map(a=>[a.family+'/'+a.hold,new Map(read(legacy+'/predictions/'+first+'-'+a.family+'.json').predictions)]));
 for(const m of block.block.months){
  const part=read(legacy+'/months/'+m+'.json'),maps=Object.fromEntries(FAMILIES.map(f=>[f,new Map(part.features[f].map(r=>[r.at,r]))])),start=monthAt(m),end=monthAt(m,1),signals=routedSignals(part.signals,maps,p.genome,predictions,{start,end}),row={month:m};
  for(const cost of strategy.costCases){const r=simulateAdaptive(source.window(start,end),{start,until:end,protocol:strategy,cost,signals,closeAtEnd:true});auditTrades(r);const old=block.rows.find(r=>r.month===m)[cost.id];row[cost.id]={legacyBRL:old.pnlBRL,correctedBRL:r.pnl*5,deltaBRL:r.pnl*5-old.pnlBRL,oldTrades:old.count,newTrades:r.trades.length,oldFundingBRL:old.fundingUSDT*5,correctedFundingBRL:r.fundingNet*5};}
  rows.push(row);
 }
}
const report={checkedAt:new Date().toISOString(),modelScoresFrozen:true,labelsRetrained:false,rows,legacyMonthlyBRL:rows.reduce((n,r)=>n+r.stress.legacyBRL,0)/9,correctedMonthlyBRL:rows.reduce((n,r)=>n+r.stress.correctedBRL,0)/9,realOrders:false};
atomic(run+'/funding-ablation.json',report);atomic('web/data/champion-funding-audit.json',report);console.log(JSON.stringify(report));
