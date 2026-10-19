import test from 'node:test';
import assert from 'node:assert/strict';
import {HOUR,DEFAULTS} from '../web/engine.js';
import {assessNews,enrollDecision,evaluateExperiment,validateCandles,QUARTER,digest} from '../scripts/news-filter-core.mjs';

const start=Date.UTC(2026,9,20,12),observedAt=start-HOUR+300000;
function fixture(side=1){
 const protocol={sourceRunId:'source',sourceProtocolSHA256:'p',sourceEngineSHA256:'e',start,end:start+24*HOUR,signal:'breakout',stopATR:1.5,targetR:2,maxHoldHours:24,cooldownHours:4,minStopToRoundTripCost:4,exchangeFilters:[],config:{...DEFAULTS,capitalBRL:1000},costCases:[{id:'base',fee:.0005,slippage:.0002},{id:'stress',fee:.001,slippage:.0004}]};
 const registration={registeredAt:start-HOUR+1000,protocol,protocolSHA256:digest(protocol)};
 const source={id:'source:d',runId:'source',recordedAt:start-HOUR+10000,signalAt:start-HOUR,entryAt:start,signal:{at:start-HOUR,side,price:100,atr:2},protocolSHA256:'p',engineSHA256:'e'};
 const news={id:'n1',availableAt:new Date(observedAt-1000).toISOString(),recordedAt:new Date(observedAt-1000).toISOString(),assessedAt:new Date(observedAt-2000).toISOString(),validUntil:new Date(start+5*HOUR).toISOString(),risk:'medium',bias:'mixed',sources:[{url:'https://example.test/news',title:'Example',publishedAt:new Date(observedAt-3000).toISOString()}]};
 const market={hourly:[],candles:[[start,100,107,93,106,500]],marks:[[start,100,107,93,106]],funding:[]};
 return {registration,source,news,market};
}
test('future news, future scoring and future sources cannot affect an entry',()=>{
 const {news}=fixture();
 for(const field of ['availableAt','recordedAt','assessedAt']){
  const r=assessNews([{...news,risk:'high',[field]:new Date(observedAt+1).toISOString()}],{observedAt,entryAt:start,side:1});assert.equal(r.veto,false);assert.equal(r.covered,false);
 }
 const r=assessNews([{...news,risk:'high',sources:[{...news.sources[0],publishedAt:new Date(observedAt+1).toISOString()}]}],{observedAt,entryAt:start,side:1});assert.equal(r.covered,false);
});
test('expired, undated, unknown and missing news are explicitly uncovered, with no veto',()=>{
 const {news}=fixture();
 for(const n of [{...news,validUntil:new Date(start).toISOString()},{...news,risk:'unknown'},{...news,sources:[{...news.sources[0],publishedAt:null}]},{...news,sources:[]}]){
  const r=assessNews([n],{observedAt,entryAt:start,side:1});assert.equal(r.covered,false);assert.equal(r.veto,false);
 }
 assert.equal(assessNews([],{observedAt,entryAt:start,side:1}).covered,false);
});
test('directional veto is symmetric; mixed sentiment does not veto; high risk vetoes both sides',()=>{
 const {news}=fixture();
 for(const side of [1,-1]){
  const opposed=side===1?'negative':'positive',aligned=side===1?'positive':'negative';
  assert.equal(assessNews([{...news,bias:opposed}],{observedAt,entryAt:start,side}).veto,true);
  assert.equal(assessNews([{...news,bias:aligned}],{observedAt,entryAt:start,side}).veto,false);
  assert.equal(assessNews([news],{observedAt,entryAt:start,side}).veto,false);
  assert.equal(assessNews([{...news,risk:'high'}],{observedAt,entryAt:start,side}).veto,true);
 }
});
test('old and missed decisions are never backfilled; source drift is rejected',()=>{
 const {registration,source}=fixture();
 assert.equal(enrollDecision(source,[],start,registration),null);
 assert.equal(enrollDecision({...source,recordedAt:registration.registeredAt-1},[],observedAt,registration),null);
 assert.throws(()=>enrollDecision({...source,runId:'other'},[],observedAt,registration),/origem/);
 assert.throws(()=>enrollDecision({...source,engineSHA256:'changed'},[],observedAt,registration),/origem/);
});
test('news is copied and frozen at observation, not changed by later assessment edits',()=>{
 const {registration,source,news}=fixture();
 const d=enrollDecision(source,[news],observedAt,registration);news.bias='negative';
 assert.equal(d.news.assessment.bias,'mixed');assert.equal(d.news.veto,false);
});
test('no-news portfolios have identical equity and trades under each cost scenario',()=>{
 const {registration,source,market}=fixture();const d=enrollDecision(source,[],observedAt,registration);
 const r=evaluateExperiment(registration,[d],market,start+QUARTER);
 for(const cost of ['base','stress']){
  const [a,b]=r.scenarios.filter(s=>s.cost===cost);assert.deepEqual(a.trades,b.trades);assert.deepEqual(a.equity,b.equity);assert.ok(a.count>0);
 }
 assert.equal(r.coverage.covered,0);assert.deepEqual(r.deltas.map(x=>x.pnlBRL),[0,0]);
});
test('veto changes only the new portfolio; baseline fills and risk remain fixed',()=>{
 const {registration,source,news,market}=fixture();
 const d=enrollDecision(source,[{...news,risk:'high'}],observedAt,registration),none=enrollDecision(source,[],observedAt,registration);
 const withNews=evaluateExperiment(registration,[d],market,start+QUARTER),without=evaluateExperiment(registration,[none],market,start+QUARTER);
 for(const cost of ['base','stress']){
  const a=withNews.scenarios.find(s=>s.variant==='control'&&s.cost===cost),prior=without.scenarios.find(s=>s.variant==='control'&&s.cost===cost),b=withNews.scenarios.find(s=>s.variant==='news-filter'&&s.cost===cost);
  assert.deepEqual(a.trades,prior.trades);assert.equal(a.count,1);assert.equal(b.count,0);assert.equal(b.newsVetoes,1);assert.equal(b.final,b.initial);
 }
});
test('coverage counts only elapsed tradable slots, with explicit gaps',()=>{
 const {registration,market}=fixture();
 let r=evaluateExperiment(registration,[],{hourly:[],candles:[],marks:[],funding:[]},start);assert.equal(r.coverage.expectedHours,0);
 r=evaluateExperiment(registration,[],market,start+QUARTER);assert.equal(r.coverage.expectedHours,1);assert.equal(r.coverage.missedHours,1);
});
test('incomplete prices, duplicate signals and non-prospective decisions fail loudly',()=>{
 const {registration,source,market}=fixture(),d=enrollDecision(source,[],observedAt,registration);
 assert.throws(()=>validateCandles([],start,start+QUARTER),/incompleta/);
 assert.throws(()=>evaluateExperiment(registration,[d,d],market,start+QUARTER),/duplicado/);
 assert.throws(()=>evaluateExperiment(registration,[{...d,observedAt:start}],market,start+QUARTER),/Integridade/);
 assert.throws(()=>evaluateExperiment(registration,[d],{...market,marks:[]},start+QUARTER),/incompleta/);
});
