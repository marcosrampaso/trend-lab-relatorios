import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {HOUR,DEFAULTS,aggregate4h,indicators,snapshot,makeProbe,evaluateProbe,sizePosition,simulate} from '../web/engine.js';
const data=JSON.parse(fs.readFileSync(new URL('../web/data/eth-2025.json',import.meta.url)));
const cutoff=Date.parse('2025-04-23T12:00:00Z');

test('arquivos históricos contínuos, mark prices alinhados e funding no período',()=>{
 assert.equal(data.candles.length,3624);assert.equal(data.marks.length,data.candles.length);assert.equal(data.sources.length,15);
 data.candles.forEach((r,i)=>{assert.equal(r[0],data.marks[i][0]);assert.ok(r[2]>=r[4]&&r[3]<=r[4]);if(i)assert.equal(r[0]-data.candles[i-1][0],HOUR);});
 assert.equal(data.funding.length,453);assert.ok(data.sources.every(s=>s.sha256.length===64));
});
test('candles de 4h não ficam disponíveis antes do encerramento',()=>{
 const rows=data.candles.slice(0,8),t=rows[0][0];assert.equal(aggregate4h(rows,t+3*HOUR).length,0);assert.equal(aggregate4h(rows,t+4*HOUR).length,1);assert.equal(aggregate4h(rows,t+7*HOUR).length,1);
});
test('alterar todo o futuro não altera indicador, sinais, ordens ou saldo do passado',()=>{
 const poisoned={...data,candles:data.candles.map(r=>r[0]>=cutoff?[r[0],...r.slice(1).map(n=>n*100)]:r),marks:data.marks.map(r=>r[0]>=cutoff?[r[0],...r.slice(1).map(n=>n*100)]:r),funding:data.funding.map(r=>r[0]>=cutoff?[r[0],.99]:r)};
 assert.deepEqual(snapshot(data.candles,cutoff),snapshot(poisoned.candles,cutoff));assert.deepEqual(simulate(data,{until:cutoff,config:{risk:.03}}),simulate(poisoned,{until:cutoff,config:{risk:.03}}));
});
test('calcular apenas um prefixo reproduz exatamente a execução com o arquivo completo',()=>{
 const prefix={...data,candles:data.candles.filter(r=>r[0]+HOUR<=cutoff),marks:data.marks.filter(r=>r[0]+HOUR<=cutoff),funding:data.funding.filter(r=>r[0]<cutoff)};
 assert.deepEqual(simulate(data,{until:cutoff,config:{risk:.03}}),simulate(prefix,{until:cutoff,config:{risk:.03}}));
});
test('leitura +3h permanece oculta até o horizonte e é calculada só depois',()=>{
 const p=makeProbe(data.candles,cutoff);assert.equal(p.target,cutoff+3*HOUR);assert.deepEqual(evaluateProbe(p,data.candles,cutoff+2*HOUR),{status:'pending'});
 const result=evaluateProbe(p,data.candles,cutoff+3*HOUR);assert.equal(result.status,'resolved');assert.equal(result.price,data.candles.find(r=>r[0]+HOUR===p.target)[4]);assert.equal(result.directional,(result.price/p.price-1)*p.side);
});
test('quantidade mínima nunca é arredondada para cima para criar uma operação',()=>{
 const rules={step:.001,minQty:.001,minNotional:20};assert.equal(sizePosition(60,1800,1700,DEFAULTS,rules),null);
 const size=sizePosition(1000,1800,1780,DEFAULTS,rules);assert.ok(size);assert.ok(size.plannedRisk<=10+1e-9);assert.ok(size.notional>=20);assert.ok(size.margin<=1000);
});
test('preço após um candle incompleto não influencia a decisão',()=>{
 const until=cutoff+HOUR/2,ind=indicators(data.candles,until);assert.ok(ind.every(b=>b.at<=until));assert.ok(snapshot(data.candles,until).visible.every(r=>r[0]+HOUR<=until));
});
test('taxas e funding reconciliam com caixa e patrimônio, sem dupla contagem',()=>{
 const r=simulate(data,{until:Date.parse('2025-06-01T00:00:00Z'),config:{risk:.03,totalLimit:.5}});
 assert.ok(r.trades.length>0,'cenário de teste deve executar ordens');assert.ok(r.fees>0);assert.ok(r.trades.some(t=>t.funding!==0));
 const closedNet=r.trades.reduce((n,t)=>n+t.net,0),openAdjustment=r.position?(r.position.funding-r.position.entryFee):0;
 assert.ok(Math.abs(r.cash-(r.initial+closedNet+openAdjustment))<1e-8);
 const feeSum=r.trades.reduce((n,t)=>n+t.entryFee+t.exitFee,0)+(r.position?.entryFee??0);assert.ok(Math.abs(feeSum-r.fees)<1e-8);
});
test('sinais usam fechamento 4h e as entradas só ocorrem na próxima abertura',()=>{
 const r=simulate(data,{until:Date.parse('2025-06-01T00:00:00Z'),config:{risk:.03,totalLimit:.5}});
 for(const t of r.trades){assert.equal(t.entryAt,t.signalAt);assert.equal(t.signalAt%(4*HOUR),0);const signalCandle=data.candles.find(c=>c[0]+HOUR===t.signalAt);assert.ok(signalCandle);const entryCandle=data.candles.find(c=>c[0]===t.entryAt);assert.ok(entryCandle);assert.equal(t.entry,entryCandle[1]*(1+t.side*DEFAULTS.slippage));}
});
test('rejeita capital, câmbio e alavancagem fora do escopo',()=>{
 assert.throws(()=>simulate(data,{config:{fx:0}}));assert.throws(()=>simulate(data,{config:{leverage:20}}));assert.throws(()=>simulate(data,{config:{capitalBRL:-1}}));
});
