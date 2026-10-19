import fs from 'node:fs';import test from 'node:test';import assert from 'node:assert/strict';
import {daytradeSignals,distinctHeadlines,dayBtcAt,freezeDayBatch,dayExecutionSignals,evaluateDayArm,HOUR,MINUTE} from '../scripts/daytrade-core.mjs';import {prepareDonchian} from '../web/donchian.js';import {intradayBars} from '../web/strategies.js';import {digest} from '../scripts/news-filter-core.mjs';
const read=f=>JSON.parse(fs.readFileSync(new URL('../'+f,import.meta.url))),donchian=read('donchian-protocol.json'),policy=read('multiasset-sentiment-protocol.json').sentiment,btcPolicy=read('btc-context-protocol.json'),definition=read('daytrade-integrated-protocol.json'),strategy={...read('scalping-protocol.json'),capitalBRL:1000,cooldownMinutes:240},at=1000*HOUR;
const p={...definition,start:at+2*MINUTE,end:at+48*HOUR,donchian,btcPolicy,sentiment:policy,strategy,minimumCostRatio:4},reg={registeredAt:at-1,protocol:p,protocolSHA256:digest(p)},arm={id:'ETHUSDT-trend1h',symbol:'ETHUSDT',strategy:'trend1h',filters:[]};
const signals={'trend1h':[{signalAt:at,side:1,price:100,atr:1}], 'donchian-fixed':[], 'donchian-adaptive':[]};
const batch=(extra={})=>freezeDayBatch({symbol:'ETHUSDT',signalAt:at,signals,articles:[],btcFrames:[],observedAt:at+30000,registration:reg,...extra});
test('daytrade reuses preserved hourly signals exactly, and excludes future candles',()=>{
 const rows=Array.from({length:300},(_,i)=>{const c=100+Math.sin(i/6)*5+i*.04;return [i*HOUR,c,c+2,c-2,c,i%13===0?100:10];}),until=250*HOUR,result=daytradeSignals(rows,donchian,until),d=prepareDonchian(rows.filter(r=>r[0]+HOUR<=until),donchian);
 for(const [id,bars]of [['trend1h',intradayBars(rows,until,'trend1h')],['donchian-fixed',d.fixed],['donchian-adaptive',d.adaptive]])assert.deepEqual(result[id].map(s=>[s.signalAt,s.side,s.atr]),bars.filter(b=>b.ready&&b.cross).map(b=>[b.at,b.cross,b.atr]));
 assert.deepEqual(result,daytradeSignals(rows.slice(0,250),donchian,until));
});
test('daytrade news deduplicates canonical URLs and revised titles before weighting',()=>{
 const a={id:'1',title:'Bitcoin gains today',url:'https://example.com/news?utm_source=one',firstSeenAt:1,classifiedAt:2},b={...a,id:'2',title:'Bitcoin gains even more',url:'https://example.com/news?utm_source=two',firstSeenAt:3,classifiedAt:4};assert.deepEqual(distinctHeadlines([b,a]),[a]);assert.equal(distinctHeadlines([a,{...b,url:'https://other.com/article',title:a.title}]).length,1);
});
test('daytrade registration rejects backfills, premature hours and late decisions',()=>{assert.ok(batch());assert.equal(batch({observedAt:at+29999}),null);assert.equal(batch({observedAt:at+2*MINUTE}),null);assert.equal(batch({registration:{...reg,registeredAt:at+1}}),null);});
test('daytrade uses four independent variants and retains blocked signals for exits',()=>{
 const b=batch(),row=b.rows[0];row.sentiment.veto=true;row.btc.veto=true;delete b.payloadSHA256;b.payloadSHA256=digest(b);
 assert.equal(dayExecutionSignals([b],reg,arm,'control',strategy.costCases[0])[0].entryAllowed,true);
 for(const v of ['sentiment','btc-context','combined']){const s=dayExecutionSignals([b],reg,arm,v,strategy.costCases[0]);assert.equal(s.length,1);assert.equal(s[0].entryAllowed,false);assert.equal(s[0].holdMinutes,1440);}
});
test('daytrade cost gate is scenario-specific and all decisions remain causally checked',()=>{
 const b=batch();b.rows[0].atr=.6;delete b.payloadSHA256;b.payloadSHA256=digest(b);assert.equal(dayExecutionSignals([b],reg,arm,'control',strategy.costCases[0])[0].entryAllowed,true);assert.equal(dayExecutionSignals([b],reg,arm,'control',strategy.costCases[1])[0].entryAllowed,false);
 assert.throws(()=>dayExecutionSignals([b,b],reg,arm,'control',strategy.costCases[0]));assert.throws(()=>dayExecutionSignals([{...b,symbol:'BTCUSDT'}],reg,arm,'control',strategy.costCases[0]));
});
test('BTC daytrade own-trend filter does not require self-correlation',()=>{const frames=[{at,btcTrend1h:-1,btcTrend4h:-1,correlation72h:.1}];assert.equal(dayBtcAt(frames,at,1,'ETHUSDT',btcPolicy).veto,false);assert.equal(dayBtcAt(frames,at,1,'BTCUSDT',btcPolicy).veto,true);});
test('daytrade portfolios are identical when context/news provide no veto',()=>{
 const b=batch(),entry=p.start,candles=Array.from({length:10},(_,i)=>[entry+i*MINUTE,100,100.2,99.8,100,10]),r=evaluateDayArm(reg,[b],{candles,marks:candles,funding:[]},entry+10*MINUTE,arm);
 assert.equal(r.scenarios.length,8);for(const cost of strategy.costCases){const cases=r.scenarios.filter(s=>s.cost===cost.id);for(const c of cases){assert.deepEqual(c.equity,cases[0].equity);assert.equal(c.finalBRL,cases[0].finalBRL);}assert.ok(cases[0].position);}
});
