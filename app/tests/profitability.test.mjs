import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {simulate,HOUR} from '../web/engine.js';
const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url)));
const data=read('../web/data/eth-extended.json'),report=read('../web/data/profitability.json');
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');

test('protocolo e dados correspondem aos hashes registrados antes da análise',()=>{
 const frozen=read('../research-freeze.json');assert.equal(digest(fs.readFileSync(new URL('../research-protocol.json',import.meta.url))),frozen.protocolSHA256);assert.equal(report.protocolSHA256,frozen.protocolSHA256);
 assert.equal(digest(fs.readFileSync(new URL('../web/data/eth-extended.json',import.meta.url))),report.datasetSHA256);
 assert.ok(Date.parse(frozen.frozenAt)<Date.parse(report.generatedAt));
});
test('histórico ampliado não tem lacunas e a recuperação de mark prices é explícita',()=>{
 assert.equal(data.candles.length,16056);assert.equal(data.marks.length,data.candles.length);assert.equal(data.sources.length,66);
 assert.equal(data.repairs.reduce((n,r)=>n+r.missingHours,0),24);
 for(let i=0;i<data.candles.length;i++){assert.equal(data.candles[i][0],data.marks[i][0]);if(i)assert.equal(data.candles[i][0]-data.candles[i-1][0],HOUR);}
});
test('relatório publica todos os riscos, períodos e estresses do protocolo',()=>{
 assert.equal(report.scenarios.length,24);
 for(const p of report.protocol.periods)for(const risk of report.protocol.risks)for(const cost of report.protocol.costCases){assert.equal(report.scenarios.filter(s=>s.period===p.id&&s.risk===risk&&s.costCase===cost.id).length,1);}
 assert.ok(report.scenarios.some(s=>s.returnPct<0));assert.ok(report.scenarios.some(s=>s.count===0));
});
test('pausas globais têm instante registrado mesmo após uma saída por stop',()=>{
 for(const s of report.scenarios.filter(s=>s.halted)){assert.ok(s.haltAt>=s.start&&s.haltAt<=s.end);const r=simulate(data,{start:s.start,until:s.end,config:{risk:s.risk,...report.protocol.costCases.find(c=>c.id===s.costCase)},closeAtEnd:true});assert.equal(r.haltAt,s.haltAt);assert.ok(!r.events.some(e=>e.kind==='entry'&&e.at>=r.haltAt));}
});
test('todos os saldos fecham com operações, custos e funding sem posição residual',()=>{
 for(const s of report.scenarios){
  const net=s.trades.reduce((n,t)=>n+t.net,0);assert.ok(Math.abs(net-s.pnlUSDT)<1e-8);assert.ok(Math.abs(s.finalUSDT-s.initialUSDT-s.pnlUSDT)<1e-8);
  assert.ok(Math.abs(s.beforeCostsUSDT-s.slippageUSDT-s.feesUSDT+s.fundingUSDT-s.pnlUSDT)<1e-8);
  assert.equal(s.curve.at(-1).time,s.end);assert.ok(Math.abs(s.curve.at(-1).value-s.finalUSDT)<1e-8);
  assert.ok(s.trades.every(t=>t.exitAt<=s.end));assert.equal(s.count,s.trades.length);
 }
});
test('retornos mensais encadeiam o mesmo patrimônio sem reiniciar após perdas',()=>{
 for(const s of report.scenarios){let value=s.initialUSDT;let count=0;for(const m of s.monthly){assert.ok(Math.abs(m.startUSDT-value)<1e-8);assert.ok(Math.abs(m.finalUSDT-m.startUSDT-m.pnlUSDT)<1e-8);value=m.finalUSDT;count+=m.trades;}
 assert.ok(Math.abs(value-s.finalUSDT)<1e-8);assert.equal(count,s.count);
 const chained=s.monthly.reduce((n,m)=>n*(1+m.returnPct),1)-1;assert.ok(Math.abs(chained-s.returnPct)<1e-8);
 }
});
test('relatório reproduz exatamente o motor com encerramento final e custos',()=>{
 for(const risk of [.01,.02,.03]){
  const s=report.scenarios.find(s=>s.period==='test'&&s.risk===risk&&s.costCase==='base');
  const r=simulate(data,{start:s.start,until:s.end,config:{risk},closeAtEnd:true});assert.equal(r.position,null);assert.equal(r.final,s.finalUSDT);assert.deepEqual(r.trades,s.trades);assert.equal(r.maxDD,s.maxDrawdown);
 }
});
test('aumentar custos não deixa de contabilizar o encerramento de uma posição aberta',()=>{
 const start=Date.UTC(2025,0,1);let open;
 for(let end=start+HOUR;end<start+90*24*HOUR;end+=24*HOUR){const r=simulate(data,{start,until:end,config:{risk:.03}});if(r.position){open={end,r};break;}}
 assert.ok(open,'é necessário um cenário com posição em aberto para testar');
 const closed=simulate(data,{start,until:open.end,config:{risk:.03},closeAtEnd:true});assert.equal(closed.position,null);assert.equal(closed.trades.at(-1).reason,'Encerramento do teste');
 assert.ok(closed.fees>open.r.fees);assert.equal(closed.equity.at(-1).value,closed.final);
 const position=open.r.position,last=data.candles.find(r=>r[0]+HOUR===open.end),exit=last[4]*(1-position.side*open.r.config.slippage);
 const expected=open.r.cash+position.side*position.qty*(exit-position.entry)-position.qty*exit*open.r.config.fee;
 assert.ok(Math.abs(closed.final-expected)<1e-10,'fechamento usa preço negociado, slippage e taxa de saída');
});
test('futuro ampliado alterado não muda os resultados antes do corte',()=>{
 const until=Date.UTC(2026,3,1),start=Date.UTC(2026,0,1);
 const poisoned={...data,candles:data.candles.map(r=>r[0]>=until?[r[0],...r.slice(1).map(v=>v*100)]:r),marks:data.marks.map(r=>r[0]>=until?[r[0],...r.slice(1).map(v=>v*100)]:r),funding:data.funding.map(r=>r[0]>=until?[r[0],.9]:r)};
 assert.deepEqual(simulate(data,{start,until,config:{risk:.02},closeAtEnd:true}),simulate(poisoned,{start,until,config:{risk:.02},closeAtEnd:true}));
});
