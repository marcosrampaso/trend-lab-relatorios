import test from'node:test';import assert from'node:assert/strict';
import{read}from'../scripts/multiasset-io.mjs';import{Market}from'../scripts/exit-lab-core.mjs';
import{createResearchAccount}from'../scripts/protection-gate-engine.mjs';
import{armProtocol,exitAction,pairedPosition,monthlyWallet}from'../scripts/protection-gate-core.mjs';
const p=read('work/pepe-specialists-v1/protocol.json').engine,market=new Market(),cost=p.costCases.find(c=>c.id==='stress');
function setup(arm){const start=Date.UTC(2024,0,1),pp=armProtocol(p,arm),account=createResearchAccount({start,until:start+4*60000,protocol:pp,cost,filters:market.filters,agentMode:true,stopContext:[],startingState:{cash:200,initial:200,day:'2024-01-01',dayStart:200,lastClose:.01,position:null}});account.queueEntry(1,.0001,start,15);return{account,start,pp};}
function consume(account,t,price){const c=[t,price,price+.000001,price-.000001,price,100000];account.consume({candles:[c],marks:[c],funding:[]});}
test('treatment refuses profit protection before a filled partial, preserving the initial stop',()=>{
 const {account:a,start}=setup('afterFirstPartial');consume(a,start,.01);const initial=a.state().position.initialStop;
 a.queueAction(6,start+60000);consume(a,start+60000,.0102);
 assert.equal(a.state().position.stop,initial);assert.equal(a.state().position.firstTaken,false);
 a.queueAction(7,start+120000);consume(a,start+120000,.01005);assert.equal(a.state().position.firstTaken,false);
 a.queueAction(6,start+180000);consume(a,start+180000,.0102);const r=a.finish();
 assert.ok(r.decisions.some(d=>d.reason==='Proteção aguarda primeira parcial preenchida'));
 assert.ok(!r.events.some(e=>e.kind==='stop-update'));assert.equal(r.partialExits,0);
});
test('a successful partial activates original protection, and later lock remains available',()=>{
 const {account:a,start,pp}=setup('afterFirstPartial');consume(a,start,.01);consume(a,start+60000,.0102);
 a.queueAction(7,start+120000);consume(a,start+120000,.0102);const s=a.state();assert.ok(s.position.firstTaken);assert.ok(s.position.stop>s.position.initialStop);
 a.queueAction(6,start+180000);consume(a,start+180000,.0103);const r=a.finish();
 const partial=r.events.find(e=>e.kind==='partial-exit');assert.ok(partial);assert.ok(r.events.filter(e=>e.kind==='stop-update').every(e=>e.at>=partial.at));
 assert.deepEqual(pp.profitLadder,p.profitLadder);assert.equal(pp.leverage,p.leverage);assert.equal(pp.risk,p.risk);
});
test('initial stop still closes a position before the first partial',()=>{
 const {account:a,start}=setup('afterFirstPartial');consume(a,start,.01);const stop=a.state().position.initialStop;
 const b=[start+60000,.01,.01001,stop-.00001,stop,100000];a.consume({candles:[b],marks:[b],funding:[]});
 consume(a,start+120000,stop);consume(a,start+180000,stop);const r=a.finish();assert.equal(r.trades[0].reason,'Stop');assert.equal(r.partialExits,0);
});
test('current arm matches the complete previous paired outcome and initial fill is unchanged',()=>{
 const m=read('work/pepe-r-ladder-v1/protocol.json').months[0],grid=read('work/pepe-r-ladder-v1/grids/'+m.month+'.json').rows,
  f=grid.find(r=>r.at===Date.UTC(2024,3,12,17,30)),before=read('work/pepe-r-ladder-v1/pairs/'+m.month+'.json').rows.find(r=>r.at===f.at&&r.side===1).margin;
 const pair=pairedPosition(f,1,m.end,p,market,market.contexts(m.start,m.end));for(const[k,v]of Object.entries(before))assert.deepEqual(pair.current[k],v,k);
 assert.deepEqual(pair.current.identity,pair.afterFirstPartial.identity);
});
test('current monthly wallet matches frozen previous driver for every ledger field',()=>{
 const old=read('work/pepe-r-ladder-v1/result.json'),m=old.protocol.months[0],entries=read('work/pepe-r-ladder-v1/signals.json')['genetic-151'][m.month];
 const result=monthlyWallet(m,entries,armProtocol(p,'current'),market),expected=old.wallets['genetic-151'].margin.wallets[0];
 for(const[k,v]of Object.entries(result))assert.deepEqual(v,expected[k],k);
});
