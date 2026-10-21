import test from 'node:test';import assert from 'node:assert/strict';
import{read}from'../scripts/multiasset-io.mjs';import{Market}from'../scripts/exit-lab-core.mjs';
import{candidateOutcome,candleFeatures}from'../scripts/specialist-core.mjs';
import{knownFeasibility,opportunityGroups,inspectOpportunity,summarizeOpportunities}from'../scripts/specialist-opportunity-core.mjs';
const p=read('work/pepe-specialists-v1/protocol.json').engine,market=new Market();
const feature=(atr=.0001)=>({at:Date.UTC(2024,3,1,0,30),knownAt:Date.UTC(2024,3,1,0,30),close:.01,atr,x:Array(19).fill(0)});
test('known feasibility respects cost/tick stop and liquidation and cannot use next candle',()=>{
 const f=feature(),buy=knownFeasibility(f,1,p,market.filters),sell=knownFeasibility(f,-1,p,market.filters);
 assert.ok(buy.feasible&&sell.feasible);assert.ok(buy.flatCostPriceR>0);assert.ok(buy.breakEvenMovePct>0);
 assert.deepEqual(buy,knownFeasibility({...f,futureOpen:.2,futureHigh:1,netR:100},1,p,market.filters));
 assert.equal(knownFeasibility(feature(.001),1,p,market.filters).reason,'Stop além da liquidação estimada');
 assert.equal(knownFeasibility(feature(.001),-1,p,market.filters).feasible,false);
 assert.throws(()=>knownFeasibility({...f,knownAt:f.at+1},1,p,market.filters),/future/);
});
test('regime groups depend on known trends and cost buckets, not outcomes',()=>{
 const f=feature();f.x[7]=f.x[8]=1;f.x[2]=0;
 assert.equal(opportunityGroups(f,1,{flatCostPriceR:.25}).trend,'aligned');assert.equal(opportunityGroups(f,-1,{flatCostPriceR:.5}).trend,'opposed');
 assert.equal(opportunityGroups(f,1,{flatCostPriceR:.25}).friction,'upTo025R');assert.equal(opportunityGroups(f,1,{flatCostPriceR:.5}).friction,'025to05R');
});
test('enriched diagnosis reproduces frozen candidate outcome and cost identity',()=>{
 const raw=market.packet(Date.UTC(2024,3,1)),m=read('work/pepe-specialists-v1/protocol.json').months.find(m=>m.month==='2024-04');
 for(const side of[1,-1]){const at=raw.features.find(r=>r.at>=m.start+1800000).at,original=market.context(at),idx=(at-raw.start)/60000;
  const f=candleFeatures(original,raw.candles.slice(idx-5,idx)),context=market.contexts(m.start,m.end);
  const a=inspectOpportunity(f,side,m.end,p,market,context),b=candidateOutcome(f,side,m.end,p,market,context);
  for(const[k,v]of Object.entries(b))assert.deepEqual(a[k],v);
  assert.ok(Math.abs(a.referenceGrossBRL-a.slippageBRL-a.feesBRL+a.fundingBRL-a.netBRL)<1e-8);
 }
});
test('opportunity means include unfilled zero and retain boundaries separately',()=>{
 const a={netR:1,filled:true,netBRL:10,grossBRL:12,referenceGrossBRL:13,feesBRL:2,slippageBRL:1,fundingBRL:0,boundary:true};
 const b={netR:0,filled:false,unfilledReason:'Stop além da liquidação estimada',boundary:false};
 const summary=summarizeOpportunities([a,b]);assert.equal(summary.meanNetR,.5);assert.equal(summary.meanNetRFilled,1);assert.equal(summary.meanNetRWithoutBoundary,0);assert.equal(summary.unfilled,1);
 assert.equal(summarizeOpportunities([]).meanNetR,null);
});
