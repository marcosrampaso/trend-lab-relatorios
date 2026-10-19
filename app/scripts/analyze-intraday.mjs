import fs from 'node:fs';import crypto from 'node:crypto';import path from 'node:path';import {fileURLToPath} from 'node:url';import {simulate,HOUR} from '../web/engine.js';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));const read=p=>JSON.parse(fs.readFileSync(path.join(root,p)));
const protocol=read('intraday-protocol.json'),freeze=read('intraday-freeze.json'),data=read('web/data/eth-intraday.json');
const sha=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'intraday-protocol.json'))).digest('hex');if(sha!==freeze.protocolSHA256||sha!==data.intradayProtocolSHA256)throw Error('Protocolo alterado');
const scenarios=[];
for(const p of protocol.periods)for(const def of protocol.strategies)for(const cost of protocol.costCases){
 const r=simulate(data,{start:Date.parse(p.start),until:Date.parse(p.end),strategy:def.id,maxHoldHours:def.maxHoldHours,stopATR:def.stopATR,targetR:def.targetR,cooldownHours:def.cooldownHours,config:{risk:protocol.risk,fee:cost.fee,slippage:cost.slippage},closeAtEnd:true});
 if(r.trades.some(t=>t.exitAt-t.entryAt>def.maxHoldHours*HOUR))throw Error('Operação ultrapassou duração');
 const sum=r.trades.reduce((n,t)=>n+t.net,0);if(Math.abs(sum-r.pnl)>1e-8)throw Error('Caixa não reconciliado');
 scenarios.push({period:p.id,strategy:def.id,costCase:cost.id,initialUSDT:r.initial,finalUSDT:r.final,pnlUSDT:r.pnl,returnPct:r.returnPct,maxDrawdown:r.maxDD,count:r.trades.length,winRate:r.trades.length?r.trades.filter(t=>t.net>0).length/r.trades.length:null,
 fees:r.fees,funding:r.fundingNet,slippage:r.trades.reduce((n,t)=>n+t.slippageCost,0),rejected:r.rejected,halted:r.halted,haltAt:r.haltAt,
 avgHoldHours:r.trades.length?r.trades.reduce((n,t)=>n+(t.exitAt-t.entryAt)/HOUR,0)/r.trades.length:null,maxHoldHours:r.trades.length?Math.max(...r.trades.map(t=>(t.exitAt-t.entryAt)/HOUR)):0,trades:r.trades,
 curve:r.equity.filter((p,i)=>i%6===0||i===r.equity.length-1).map(p=>({time:p.time,value:p.value}))});
}
const report={version:1,generatedAt:new Date().toISOString(),protocol,freeze,scenarios,newsApplied:false,notes:['Notícias ainda não entram nestes resultados: coleta prospectiva iniciada separadamente.','O período2026 já conhecido é exploratório; a janela nova de15 dias é curta.','Comparação em resolução1h, com stop primeiro quando stop e alvo forem tocados na mesma hora.','Risco1% e capitalR$300 fixos, taxas e funding incluídos; antes de impostos, câmbio hipotéticoR$5/USDT.']};
fs.writeFileSync(path.join(root,'web/data/intraday-results.json'),JSON.stringify(report));
console.log(JSON.stringify(scenarios.filter(s=>s.costCase==='base').map(s=>({period:s.period,strategy:s.strategy,netBRL:s.pnlUSDT*5,returnPct:s.returnPct,trades:s.count,avgHours:s.avgHoldHours,maxHours:s.maxHoldHours})),null,2));
