import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {trainScalpCandidate} from '../scripts/train-scalp-tree.mjs';
import {simulateScalping,prepareScalping,MINUTE} from '../web/scalping.js';
import {simulateScalpTree} from '../web/scalp-tree-engine.js';
import {predictTree} from '../web/tree-ml.js';
import {availableScalpSamples,scalpFeatures,scalpEntryFilter,monthAt,pairedMonthlyInterval} from '../web/scalp-tree.js';

const read=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url)));
const p=read('scalp-tree-protocol.json'),strategy=read('scalping-protocol.json');
const rows=read('data/scalp-tree/samples.json'),models=read('web/data/scalp-tree-models.json'),results=read('web/data/scalp-tree-results.json');

test('amostras usam contexto fechado, rótulo maduro e custos2x; fronteiras são purgadas',()=>{
  for(const group of Object.values(rows.groups))for(const s of group){
    assert.equal(s.x.length,12);assert.ok(s.x.every(Number.isFinite));
    assert.ok(s.hourlyAt<=s.at&&s.fourHourlyAt<=s.at);
    assert.ok(s.at-s.hourlyAt<3600000&&s.at-s.fourHourlyAt<4*3600000);
    assert.equal(s.labelAvailableAt,s.at+245*MINUTE);assert.ok(s.exitAt<=s.at+30*MINUTE);
    assert.equal(s.y,s.netUSDT>0?1:0);
  }
  assert.deepEqual(availableScalpSamples([{at:0,labelAvailableAt:11}],0,10),[]);
  assert.equal(availableScalpSamples([{at:0,labelAvailableAt:9}],0,10).length,1);
});
test('57 árvores respeitam janela9+3 meses, folhas100 e congelamento final',()=>{
  assert.equal(models.models.length,57);
  for(const m of models.models){
    assert.equal(m.availableAt,monthAt(m.month));assert.equal(m.informationCutoff,m.availableAt);
    assert.equal(m.window.trainStart,monthAt(m.month,-12));assert.equal(m.window.trainEnd,monthAt(m.month,-3));
    assert.equal(m.window.validationStart,m.window.trainEnd);assert.equal(m.window.validationEnd,m.availableAt);
    assert.ok(m.training.maxLabelAvailableAt<m.window.trainEnd);
    function visit(n,d=0){assert.ok(d<=3);assert.ok(n.probability>0&&n.probability<1);
      if(n.left){assert.equal(n.count,n.left.count+n.right.count);visit(n.left,d+1);visit(n.right,d+1);}else assert.ok(n.count>=100);
    }visit(m.model.root);assert.equal(m.model.root.count,m.training.count);
  }
  for(const s of results.scenarios){
    if(s.variant==='control')continue;
    const m=models.models.find(m=>m.id===s.modelId);assert.ok(m.availableAt<=monthAt(s.month));
    if(s.holdout&&s.variant==='rolling')assert.equal(m.month,'2026-07');
    if(s.variant==='fixed')assert.equal(m.month,'2025-01');
  }
});
test('adulterar rótulos futuros não altera árvore, limiar nem seleção anterior',()=>{
  const expected=models.models.find(m=>m.id==='2025-04/bands');
  const evaluate=b=>{const t=expected.trials.find(t=>t.threshold===b.threshold);return{base:{count:t.baseCount,pnlUSDT:t.basePnL,maxDD:t.baseDD},stress:{count:t.stressCount,pnlUSDT:t.stressPnL,maxDD:t.stressDD}};};
  const poisoned=rows.groups.bands.map(s=>s.at>=expected.availableAt?{...s,x:s.x.map(v=>v+999),y:1-s.y,netUSDT:999}:s);
  const actual=trainScalpCandidate(poisoned,p,expected.window,evaluate);
  const {id,month,family,...saved}=expected;
  assert.deepEqual(actual,saved);
});
test('features e filtro não usam candles maiores ainda abertos; modelo futuro é rejeitado',()=>{
  const b={at:1000,ready:true,atr:2,rvol:1.2,rsi:60,vwap:99,deltaPct:.1,close:100,fast:101,slow:100};
  const past={at:900,side:1,fast:100,slow:99,atr:2};
  const frames={hourly:[past,{...past,at:1001,side:-1,fast:999}],fourHourly:[past,{...past,at:1001,side:-1,fast:999}]};
  const x=scalpFeatures(b,1,frames,strategy);assert.equal(x.hourlyAt,900);assert.equal(x.fourHourlyAt,900);assert.equal(x.x[6],1);
  const bundle=models.models[0];assert.throws(()=>scalpEntryFilter(bundle,new Map(),bundle.availableAt-1),/disponível/);
  assert.equal(scalpEntryFilter({...bundle,threshold:0},new Map(),bundle.availableAt),null);
  const row=new Map([[1000,x]]),filter=scalpEntryFilter({...bundle,threshold:1},row,bundle.availableAt);
  assert.equal(filter({at:1000}),'Árvore vetou nova entrada');
});
test('veto de árvore conserva sinal contrário de saída e controle reproduz motor original',()=>{
  const start=Date.parse('2025-04-01T00:00:00Z'),candles=Array.from({length:40},(_,i)=>[start+i*MINUTE,2000,2001,1999,2000,10]);
  const data={candles,marks:candles.map(r=>r.slice(0,5)),funding:[],filters:read('web/data/scalping-market.json').filters};
  const prepared={signals:{cross:[{at:start,side:1,atr:10,target:null,context:{}},{at:start+10*MINUTE,side:-1,atr:10,target:null,context:{}}]}};
  const opts={strategy:'cross',start,until:start+40*MINUTE,protocol:strategy,prepared,closeAtEnd:true};
  assert.deepEqual(simulateScalpTree(data,opts),simulateScalping(data,opts));
  const r=simulateScalpTree(data,{...opts,entryFilter:s=>s.side===1?null:'Árvore vetou nova entrada'});
  assert.equal(r.trades[0].reason,'Sinal contrário');assert.equal(r.trades[0].exitAt,start+10*MINUTE);
  assert.ok(!r.events.some(e=>e.kind==='entry'&&e.side===-1));
});
test('378 carteiras reconciliam caixa, prazo, custo e modelo; limiar0 preserva todas as operações',()=>{
  assert.equal(results.scenarios.length,378);assert.equal(results.prospectiveApplied,false);assert.equal(results.realOrders,false);
  for(const s of results.scenarios){
    assert.ok(Math.abs(s.pnlUSDT-s.trades.reduce((n,t)=>n+t.net,0))<1e-8);
    assert.ok(Math.abs(s.pnlUSDT-(s.grossUSDT-s.feesUSDT+s.fundingUSDT))<1e-8);
    assert.ok(s.trades.every(t=>t.exitAt-t.entryAt<=30*MINUTE));
    if(s.variant!=='control'&&s.threshold===0){const c=results.scenarios.find(c=>c.month===s.month&&c.family===s.family&&c.variant==='control'&&c.costCase===s.costCase);assert.deepEqual(s.trades,c.trades);assert.equal(s.pnlUSDT,c.pnlUSDT);}
  }
});
test('bootstrap pareado em blocos é reprodutível e mantém diferença constante',()=>{
  const values=Array(21).fill(2),a=pairedMonthlyInterval(values,p.uncertainty);
  assert.equal(a.lowerUSDT,2);assert.equal(a.upperUSDT,2);assert.equal(a.meanUSDT,2);
  assert.deepEqual(a,pairedMonthlyInterval(values,p.uncertainty));
  assert.equal(pairedMonthlyInterval([1],p.uncertainty),null);
});
test('fontes, resultados e estudos anteriores mantêm hashes registrados',()=>{
  for(const name of ['scalp-tree-freeze.json','scalp-tree-preview-freeze.json'])for(const[file,expected]of Object.entries(read(name).files)){
    assert.equal(createHash('sha256').update(fs.readFileSync(new URL('../'+file,import.meta.url))).digest('hex'),expected,file);
  }
  const manifest=read('data/scalp-tree/manifest.json');assert.equal(manifest.months.length,34);assert.equal(manifest.checksums,68);
  assert.equal(manifest.months.reduce((n,m)=>n+m.minutes,0),manifest.totalMinutes);
  assert.equal(results.data.differentHours,manifest.differentHours);
  assert.ok(manifest.months.flatMap(m=>m.sources).filter(s=>s.repair).every(s=>s.note.includes('sem checksum externo')));
});
