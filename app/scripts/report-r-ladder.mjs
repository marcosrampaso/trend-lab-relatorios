// Display-only derived explanations. Scientific artifacts are read, never rewritten.
import fs from'node:fs';import{ROOT,read,hash,atomic}from'./multiasset-io.mjs';
const base='work/pepe-r-ladder-v1',result=read(base+'/result.json'),signals=read(base+'/signals.json'),rows=result.protocol.months.flatMap(m=>read(base+'/pairs/'+m.month+'.json').rows);
const stages={};for(const stage of ['pairedDiagnostic','temporalReplay']){const group=rows.filter(r=>r.stage===stage);
 stages[stage]={count:group.length,unchanged:group.filter(r=>Math.abs(r.deltaR)<=1e-9).length,
  arms:Object.fromEntries(result.protocol.arms.map(arm=>{const filled=group.map(r=>r[arm]).filter(r=>r.filled);return[arm,{filled:filled.length,
   initialStop:filled.filter(r=>r.reason==='Stop').length,protectedStop:filled.filter(r=>r.reason==='Stop protegido').length,
   protectionWithoutPartial:filled.filter(r=>r.stopMoves>0&&r.partials===0).length,anyPartial:filled.filter(r=>r.partials>0).length,
   reasons:Object.fromEntries([...new Set(filled.map(r=>r.reason))].map(reason=>[reason,filled.filter(r=>r.reason===reason).length]))}];}))};
}
const old=result.protocol.months.filter(m=>m.stage==='pairedDiagnostic').flatMap(m=>read('work/pepe-opportunity-v1/months/'+m.month+'.json').rows);
const priorProfit=Object.fromEntries([1,-1].map(side=>{const loss=old.filter(r=>r.side===side&&r.filled&&r.netR<0);return[side,{losers:loss.length,priorPositiveDecision:loss.filter(r=>r.positiveAtDecision).length}];}));
const examples=Object.keys(signals).filter(k=>k!=='aligned_trend').flatMap(key=>{const allowed=new Set(Object.values(signals[key]).flat().map(e=>e.trade.entryAt+':'+e.trade.side));return rows.filter(r=>allowed.has(r.at+':'+r.side)).map(r=>({key,...r}));});
const selectedIds=new Set(examples.filter(r=>r.stage==='pairedDiagnostic').map(r=>r.at+':'+r.side));
const selected=old.filter(r=>selectedIds.has(r.at+':'+r.side)&&r.filled),selectedLosses=selected.filter(r=>r.netR<0);
const selectedEvidence={filled:selected.length,losers:selectedLosses.length,losersWithPriorPositiveDecision:selectedLosses.filter(r=>r.positiveAtDecision).length};
atomic(ROOT+'/web/data/r-ladder-display.json',{sourceSHA256:hash(base+'/result.json'),stages,priorProfit,selectedEvidence,examples});
console.log(JSON.stringify({pairs:rows.length,examples:examples.length}));
