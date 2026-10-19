import fs from 'node:fs';import path from 'node:path';
import{simulateScalpTree}from'../web/research-scalp-funding.js';
export function atomic(file,value){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file+'.tmp',JSON.stringify(value));fs.renameSync(file+'.tmp',file);}
export function publishStage(run,extra){const file=path.join(run,'status.json'),s=JSON.parse(fs.readFileSync(file));Object.assign(s,extra,{updatedAt:new Date().toISOString()});atomic(file,s);if(process.env.ML_NO_PUBLIC!=='1')atomic('web/data/cpu-training-status.json',s);}
export function summarize(r,hold){
 const positive=r.trades.filter(t=>t.net>0).reduce((n,t)=>n+t.net,0),negative=-r.trades.filter(t=>t.net<0).reduce((n,t)=>n+t.net,0),n=r.trades.length;
 if(Math.abs(r.trades.reduce((n,t)=>n+t.net,0)-r.pnl)>1e-8||r.position)throw Error('Caixa/posição não reconciliados');
 if(r.trades.some(t=>t.exitAt-t.entryAt>hold*60000))throw Error('Prazo excedido');
 return{pnlUSDT:r.pnl,finalUSDT:r.final,count:n,signals:r.signals.length,vetoes:r.events.filter(e=>e.reason?.startsWith('Árvore')).length,maxDD:r.maxDD,halted:r.halted,haltAt:r.haltAt,feesUSDT:r.fees,fundingUSDT:r.fundingNet,grossUSDT:r.trades.reduce((n,t)=>n+t.gross,0),slippageUSDT:r.trades.reduce((n,t)=>n+t.slippageCost,0),winRate:n?r.trades.filter(t=>t.net>0).length/n:null,expectancyUSDT:n?r.pnl/n:null,profitFactor:negative?positive/negative:null,avgMinutes:n?r.trades.reduce((n,t)=>n+(t.exitAt-t.entryAt)/60000,0)/n:null};
}
export function isolatedLabel({data,family,sig,nearby,feature,protocol,hold,available}){
 const r=simulateScalpTree(data,{strategy:family,start:sig.at,until:available,protocol:{...protocol,maxHoldMinutes:hold},cost:protocol.costCases.find(c=>c.id==='stress'),prepared:{signals:{[family]:nearby}},entryFilter:s=>s.at===sig.at?null:'Rótulo isolado: sem reentrada',closeAtEnd:true});
 const t=r.trades.find(t=>t.signalAt===sig.at&&t.entryAt===sig.at);if(!t)return null;
 summarize(r,hold);return{...feature,y:t.net>0?1:0,netUSDT:t.net,netR:t.net/t.plannedRisk,labelAvailableAt:available,exitAt:t.exitAt,reason:t.reason};
}
export function rankExtended(trials,configs){return trials.filter(t=>t.eligible).sort((a,b)=>b.robustUSDT-a.robustUSDT||a.threshold-b.threshold||a.hold-b.hold||a.trainMonths-b.trainMonths||configs.findIndex(c=>c.id===a.configId)-configs.findIndex(c=>c.id===b.configId));}
export function approvedExtended(chosen,control){return chosen.threshold>0&&chosen.stressPnL>0&&chosen.robustUSDT>control.robustUSDT;}
