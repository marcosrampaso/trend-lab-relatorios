import test from 'node:test';import assert from 'node:assert/strict';
import {MINUTE,FIVE} from '../web/scalping.js';
import {digest} from '../scripts/news-filter-core.mjs';
import {freezeG151Batch,executionSignals,evaluateG151,latestG151Signals} from '../scripts/g151-news-core.mjs';

const close=Date.UTC(2026,9,20,12),start=close+MINUTE;
function fixture(){
 const strategy={capitalBRL:1000,fx:5,risk:.01,leverage:10,dailyLimit:.03,totalLimit:.1,maintenance:.005,fundingReserve:.0003,stopATR:1.5,targetR:2,cooldownMinutes:0,costCases:[{id:'base',fee:.0005,slippage:.0002},{id:'stress',fee:.001,slippage:.0004}]};
 const genome={trendCut:1.702,volatilityCut:.005408,routes:{trend:{family:'cross',hold:120,threshold:.326},range:{family:'bands',hold:240,threshold:.643},volatile:{family:'bands',hold:240,threshold:.411}}};
 const protocol={genome,firstSignalAt:close,start,end:start+30*86400000,config:{fx:5},strategy,costCases:strategy.costCases,exchangeFilters:[]};
 const registration={registeredAt:close-MINUTE,protocol,protocolSHA256:digest(protocol)};
 const feature={at:close,hourlyAt:close,fourHourlyAt:close,x:[1,.1,.001,0,0,0,1,1,2,2,.2,0]};
 const raw={context:{at:close,ready:true},signals:[{family:'cross',signalAt:close,side:1,price:100,atr:1,target:null,feature}]};
 const score=[{id:'cross/'+close,score:.4}];
 const news={id:'n',availableAt:new Date(close-1000).toISOString(),recordedAt:new Date(close-1000).toISOString(),assessedAt:new Date(close-2000).toISOString(),validUntil:new Date(close+3600000).toISOString(),risk:'medium',bias:'negative',sources:[{url:'https://example.test/n',publishedAt:new Date(close-3000).toISOString()}]};
 return {registration,raw,score,news};
}
test('G151 keeps champion routes and thresholds, including inactive-family veto',()=>{
 const {registration,raw,score}=fixture();
 raw.signals.push({...raw.signals[0],family:'bands'});
 const batch=freezeG151Batch(raw,[...score,{id:'bands/'+close,score:.99}],[],close+10000,registration);
 assert.equal(batch.rows[0].modelAllowed,true);assert.equal(batch.rows[0].holdMinutes,120);
 assert.equal(batch.rows[1].modelAllowed,false);assert.match(batch.rows[1].modelReason,/Família/);
 const low=freezeG151Batch({...raw,signals:[raw.signals[0]]},[{id:'cross/'+close,score:.325}],[],close+10000,registration);assert.equal(low.rows[0].modelAllowed,false);
});
test('late G151 inference is skipped and never filled at a past price',()=>{
 const {registration,raw,score}=fixture();assert.equal(freezeG151Batch(raw,score,[],start,registration),null);
 const d=freezeG151Batch(raw,score,[],close+10000,registration);assert.equal(d.entryAt,start);assert.ok(d.observedAt<d.entryAt);assert.equal(d.rows[0].signalAt,close);
});
test('news veto preserves original opposing signal for exits',()=>{
 const {registration,raw,score,news}=fixture();
 const batch=freezeG151Batch(raw,score,[news],close+10000,registration),a=executionSignals([batch],registration),b=executionSignals([batch],registration,true);
 assert.equal(a[0].entryAllowed,true);assert.equal(b[0].entryAllowed,false);assert.equal(b.length,a.length);assert.equal(b[0].side,a[0].side);assert.equal(b[0].at,start);
});
test('duplicate/future context or edited G151 decisions fail explicitly',()=>{
 const {registration,raw,score}=fixture();
 const batch=freezeG151Batch(raw,score,[],close+10000,registration);
 assert.throws(()=>executionSignals([batch,batch],registration),/duplicado/);
 assert.throws(()=>executionSignals([{...batch,observedAt:start}],registration),/Integridade/);
 raw.signals[0].feature.hourlyAt=close+1;const future=freezeG151Batch(raw,score,[],close+10000,registration);assert.throws(()=>executionSignals([future],registration),/futura/);
});
test('without news, two G151 portfolios have identical fills, PnL, funding and equity',()=>{
 const {registration,raw,score}=fixture();const batch=freezeG151Batch(raw,score,[],close+10000,registration),market={candles:[[start,100,104,99,103]],marks:[[start,100,104,99,103]],funding:[[start+1,.0001]]};
 const r=evaluateG151(registration,[batch],market,start+MINUTE);
 for(const cost of ['base','stress']){const [a,b]=r.scenarios.filter(s=>s.cost===cost);assert.equal(a.count,1);assert.deepEqual(a.trades,b.trades);assert.deepEqual(a.equity,b.equity);assert.equal(a.fundingBRL,b.fundingBRL);}
 assert.ok(r.deltas.every(d=>d.pnlBRL===0));
});
test('news-blocked reverse closes prior position exactly like the control',()=>{
 const {registration,raw,score,news}=fixture();const first=freezeG151Batch(raw,score,[],close+10000,registration),later=close+FIVE;
 const secondRaw={context:{at:later},signals:[{...raw.signals[0],side:-1,signalAt:later,feature:{...raw.signals[0].feature,at:later,hourlyAt:close,fourHourlyAt:close}}]};
 const second=freezeG151Batch(secondRaw,[{id:'cross/'+later,score:.4}],[{...news,bias:'positive'}],later+10000,registration);
 const rows=Array.from({length:7},(_,i)=>[start+i*MINUTE,i===0?100:101,101.2,99.8,101]),market={candles:rows,marks:rows,funding:[]};
 const r=evaluateG151(registration,[first,second],market,start+7*MINUTE),[a,b]=r.scenarios.filter(s=>s.cost==='base');
 assert.equal(a.trades[0].reason,'Sinal contrário');assert.equal(b.trades[0].reason,'Sinal contrário');assert.equal(a.trades[0].exitAt,b.trades[0].exitAt);assert.equal(a.trades[0].net,b.trades[0].net);assert.equal(b.position,null);assert.ok(a.position);
});
test('G151 analysis excludes unfinished/future5m candles',()=>{
 const five=Array.from({length:80},(_,i)=>{const t=close-(80-i)*FIVE,c=100+Math.sin(i/4);return[t,c,c+1,c-1,c,10,1000,5];}),strategy={strategies:[{id:'cross'},{id:'vwap'},{id:'bands'}],rvol:{min:1.2},costCases:[{id:'stress',fee:.001,slippage:.0004}],stopATR:1.5},trend={fast:20,slow:50,minimumBars:150};
 const before=latestG151Signals(five,[],close,strategy,trend),after=latestG151Signals([...five,[close,1,9999,.01,999,999,999,999]],[],close,strategy,trend);assert.deepEqual(after,before);
});
