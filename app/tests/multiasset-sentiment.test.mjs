import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {sentimentAt,freezeMultiBatch,multiExecutionSignals,routeRow,aggregateRows,evaluateMultiArm} from '../scripts/multiasset-core.mjs';import {digest} from '../scripts/news-filter-core.mjs';
const policy=JSON.parse(fs.readFileSync(new URL('../multiasset-sentiment-protocol.json',import.meta.url))).sentiment;
const at=600000000,entry=at+60000,genome={trendCut:1,volatilityCut:.005,routes:{range:{family:'bands',hold:240,threshold:.6},trend:{family:'cross',hold:120,threshold:.3},volatile:{family:'bands',hold:240,threshold:.4}}};
const feature={at,hourlyAt:at-60000,fourHourlyAt:at-120000,x:[1,0,.001,0,0,0,0,0,0,0,.2,0]},raw={context:{at,ready:true},signals:[{family:'bands',signalAt:at,side:1,price:100,atr:1,target:105,feature}]};
const arm={id:'btc-transfer',symbol:'BTCUSDT',label:'BTC',filters:[]},protocol={start:entry,end:entry+86400000,genome,sentiment:policy},reg={registeredAt:at-1,protocol,protocolSHA256:digest(protocol)};
const articles=()=>['one','two'].map((id,i)=>({id,title:id,url:'https://example.com/'+id,publisher:'publisher'+i,publishedAt:at-60000,firstSeenAt:at-1000,classifiedAt:at,revision:policy.revision,assets:['BTCUSDT'],language:'en',scores:{negative:.95,neutral:.03,positive:.02}}));
const assess=(rows,extra={})=>sentimentAt(rows,{symbol:'BTCUSDT',observedAt:at,entryAt:entry,side:1,policy,...extra});
test('sentiment requires asset relevance, two publishers, fresh dated evidence and directional confidence',()=>{
 const a=articles();assert.equal(assess(a).veto,true);assert.equal(assess(a,{side:-1}).veto,false);assert.equal(assess(a,{symbol:'ETHUSDT'}).covered,false);
 assert.equal(assess(a.slice(0,1)).veto,false);assert.equal(assess(a.map(r=>({...r,publisher:'same'}))).veto,false);
 assert.equal(assess(a.map(r=>({...r,scores:{negative:.2,neutral:.6,positive:.2}}))).veto,false);
});
test('future, expired, duplicated, invalid and wrong-revision headlines cannot veto',()=>{
 const a=articles();for(const patch of [{classifiedAt:at+1},{firstSeenAt:at+1},{publishedAt:at+1},{publishedAt:at-301*60000},{revision:'other'},{scores:{negative:2,neutral:0,positive:0}},{language:'pt'}])assert.equal(assess(a.map(r=>({...r,...patch}))).veto,false);
 assert.equal(assess([a[0],a[0]]).veto,false);assert.equal(assess([]).covered,false);
});
test('conflicting evidence does not create a directional veto',()=>{const a=articles();a[1].scores={negative:.02,neutral:.03,positive:.95};assert.equal(assess(a).bias,'uncertain');assert.equal(assess(a).veto,false);});
test('batch freezes exact news and disallows late or retroactive entries',()=>{
 const a=articles(),b=freezeMultiBatch(raw,[{id:'bands/'+at,score:.8}],a,at,reg,arm);a[0].scores.negative=0;
 assert.equal(b.rows[0].sentiment.veto,true);assert.equal(b.rows[0].sentiment.articles[0].scores.negative,.95);
 assert.equal(freezeMultiBatch(raw,[],[],entry,reg,arm),null);assert.equal(freezeMultiBatch(raw,[],[],at,{...reg,registeredAt:at+1},arm),null);
});
test('sentiment veto preserves opposite signals for exits; control remains allowed',()=>{
 const b=freezeMultiBatch(raw,[{id:'bands/'+at,score:.8}],articles(),at,reg,arm),control=multiExecutionSignals([b],reg,arm),filtered=multiExecutionSignals([b],reg,arm,true);
 assert.equal(control.length,1);assert.equal(filtered.length,1);assert.equal(control[0].entryAllowed,true);assert.equal(filtered[0].entryAllowed,false);assert.equal(filtered[0].side,1);
});
test('decision integrity, duplicated batches and future context are rejected',()=>{
 const b=freezeMultiBatch(raw,[{id:'bands/'+at,score:.8}],[],at,reg,arm);
 assert.throws(()=>multiExecutionSignals([b,b],reg,arm));assert.throws(()=>multiExecutionSignals([{...b,symbol:'ETHUSDT'}],reg,arm));
 const future=structuredClone(b);future.rows[0].feature.hourlyAt=at+1;delete future.payloadSHA256;future.payloadSHA256=digest(future);assert.throws(()=>multiExecutionSignals([future],reg,arm));
 assert.throws(()=>routeRow(raw.signals[0],1.1,genome));assert.throws(()=>routeRow(raw.signals[0],null,genome));
});
test('minute aggregation excludes incomplete blocks and retains exact volume',()=>{
 const rows=Array.from({length:6},(_,i)=>[i*60000,100,102,99,101,2,200,1]),five=aggregateRows(rows,300000);assert.equal(five.length,1);assert.deepEqual(five[0],[0,100,102,99,101,10,1000,5]);
 assert.equal(aggregateRows(rows.slice(1),300000).length,0);
});
test('control and sentiment portfolios are identical without eligible news',()=>{
 const strategy=JSON.parse(fs.readFileSync(new URL('../scalping-protocol.json',import.meta.url)));strategy.capitalBRL=1000;
 const p={...protocol,strategy},r={...reg,protocol:p,protocolSHA256:digest(p)},b=freezeMultiBatch(raw,[{id:'bands/'+at,score:.8}],[],at,r,arm),candles=Array.from({length:3},(_,i)=>[entry+i*60000,100,100.2,99.8,100,10]);
 const result=evaluateMultiArm(r,[b],{candles,marks:candles,funding:[]},entry+3*60000,arm);
 for(const cost of strategy.costCases){const [a,c]=result.scenarios.filter(s=>s.cost===cost.id);assert.deepEqual(a.trades,c.trades);assert.deepEqual(a.equity,c.equity);assert.equal(a.finalBRL,c.finalBRL);}
});
