import test from 'node:test';import assert from 'node:assert/strict';import {searchView,portfolioView} from '../local/research-genetic-view.mjs';
const candidate=(id,score,pnl,eligible=false)=>({genome:{id},metrics:{eligible,worstQuarterExcessBRL:score,medianQuarterExcessBRL:score,baseBRL:pnl*2,stressBRL:pnl},blocks:[]});
test('generation graphs use only candidates already evaluated in that generation and preserve eligibility ranking',()=>{
 const source={fold:{id:'2024-07'},candidates:[candidate('a',-8,24),candidate('b',-4,-12),candidate('c',-1,120),candidate('d',-2,36,true)],history:[{generation:0,uniqueCandidates:2},{generation:1,uniqueCandidates:3},{generation:2,uniqueCandidates:4}]};
 const before=JSON.stringify(source),v=searchView(source);
 assert.deepEqual(v.history.map(h=>h.leaderId),['b','c','d']);assert.deepEqual(v.history.map(h=>h.stressMeanMonthlyBRL),[-1,10,3]);assert.equal(v.leader.genome.id,'d');assert.equal(v.eligible,1);assert.equal(JSON.stringify(source),before);
});
test('portfolio curves retain real BRL values and convert trade net and costs once',()=>{
 const curve=[{time:1,value:1000},{time:2,value:987.5}],v=portfolioView({pnlBRL:-12.5,count:1,maxDD:.0125,curve,feesUSDT:.2,fundingUSDT:.1,trades:[{net:-2.5,side:-1,entryAt:1,exitAt:2}]});
 assert.deepEqual(v.curve,curve);assert.equal(v.trades[0].netBRL,-12.5);assert.equal(v.feesBRL,1);assert.equal(v.fundingBRL,.5);assert.equal(v.pnlBRL,-12.5);
});
