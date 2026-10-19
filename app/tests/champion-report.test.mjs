import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';import{tradeStats,groupTrades,saoPauloHour}from'../scripts/champion-report-stats.mjs';
const row=(net,gross=net+.2)=>({net,gross,entryFee:.1,exitFee:.1,funding:0,slippageCost:.3,entryAt:0,exitAt:60000});
test('report reconciles reference gross without subtracting slippage twice',()=>{const r=tradeStats([row(1)],5);assert.equal(r.net,5);assert.equal(r.referenceGross,7.5);assert.equal(r.slippage,1.5);assert.equal(r.fees,1);assert.equal(r.referenceGross-r.slippage-r.fees+r.funding,r.net);});
test('concentration is arithmetic contribution, preserving losing trades and group totals',()=>{const rows=[row(3),row(-2),row(1),row(-1)],r=tradeStats(rows,1);assert.equal(r.withoutBest,-2);assert.equal(r.withoutTop3,-2);assert.equal(r.winRate,.5);assert.equal(r.profitFactor,4/3);assert.equal(groupTrades(rows,t=>t.net>0?'gain':'loss',1).reduce((n,g)=>n+g.net,0),r.net);});
test('entry hour uses Sao Paulo rather than machine timezone',()=>{assert.equal(saoPauloHour(Date.parse('2026-10-18T02:00:00Z')),23);});
test('published snapshot reconciles all monthly trades, groups and candidate counts',()=>{
 const d=JSON.parse(fs.readFileSync('web/pesquisa-genetica/dados.json'));assert.equal(d.months.length,9);assert.equal(d.usedFinalTest,false);assert.equal(d.realOrders,false);assert.equal(d.promoted,false);assert.equal(new Set(d.candidates.map(c=>c.id)).size,d.candidateCount);assert.equal(d.algorithms.reduce((n,r)=>n+r.trials,0),d.candidateCount);
 assert.ok(!JSON.stringify(d).includes('/Users/'),'published snapshot must use repository-relative provenance paths');
 for(const cost of['base','stress']){
  for(const m of d.months){const trades=d.trades.filter(t=>t.cost===cost&&t.month===m.month);assert.equal(trades.length,m[cost].count);assert.ok(Math.abs(trades.reduce((n,t)=>n+t.net*d.fx,0)-m[cost].pnlUSDT*d.fx)<1e-7);}
  for(const group of Object.values(d.groups[cost])){assert.equal(group.reduce((n,g)=>n+g.count,0),d.stats[cost].count);assert.ok(Math.abs(group.reduce((n,g)=>n+g.net,0)-d.stats[cost].net)<1e-7);}
 }
});
test('all report pages ship their own linked HTML, CSS, JS and downloadable data',()=>{
 const base='web/pesquisa-genetica/';for(const file of['index.html','resumo.html','campeao.html']){const s=fs.readFileSync(base+file,'utf8');for(const match of s.matchAll(/(?:href|src)="([^"]+)"/g)){const target=match[1];if(!target.startsWith('http')&&!target.startsWith('#'))assert.ok(fs.existsSync(base+target),file+' → '+target);}assert.ok(s.includes('Validação conhecida'));}
 const d=JSON.parse(fs.readFileSync(base+'dados.json'));assert.equal(fs.readFileSync(base+'operacoes.csv','utf8').trim().split('\n').length,d.trades.length+1);
});
