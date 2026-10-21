import test from'node:test';import assert from'node:assert/strict';
import{read}from'../scripts/multiasset-io.mjs';import{Market}from'../scripts/exit-lab-core.mjs';import{candidateOutcome,candleFeatures}from'../scripts/specialist-core.mjs';
import{originalMarginROI,createResearchAccount}from'../scripts/r-ladder-engine.mjs';
import{armProtocol,pairedPosition,monthlyWallet}from'../scripts/r-ladder-core.mjs';
const old=read('work/pepe-specialists-v1/protocol.json'),p=old.engine,market=new Market();
test('net ladder denominator changes only between original margin and original price-risk',()=>{
 const pos={side:1,qty:10,initialQty:10,entry:100,initialStop:95,margin:100,initialMargin:100,entryFee:0,initialEntryFee:0,funding:0};
 assert.equal(originalMarginROI(pos,110,{fee:0,slippage:0,ladderBasis:'margin'}),1);
 assert.equal(originalMarginROI(pos,110,{fee:0,slippage:0,ladderBasis:'priceRisk'}),2);
 const remaining={...pos,qty:5,margin:50,entryFee:0};assert.equal(originalMarginROI(remaining,110,{fee:0,slippage:0,ladderBasis:'priceRisk'}),2);
 const short={...pos,side:-1,initialStop:105};assert.equal(originalMarginROI(short,90,{fee:0,slippage:0,ladderBasis:'priceRisk'}),2);
});
test('paired diagnostic has identical actual entry and original arm reproduces frozen engine',()=>{
 const m=old.months.find(m=>m.month==='2024-04'),raw=market.packet(m.start),at=Date.UTC(2024,3,12,17,30),idx=(at-raw.start)/60000;
 const f=candleFeatures(market.context(at),raw.candles.slice(idx-5,idx)),contexts=market.contexts(m.start,m.end);
 const pair=pairedPosition(f,1,m.end,p,market,contexts),baseline=candidateOutcome(f,1,m.end,p,market,contexts);
 for(const[k,v]of Object.entries(baseline))assert.deepEqual(pair.margin[k],v,k);
 assert.deepEqual(pair.margin.identity,pair.priceRisk.identity);
 assert.deepEqual(armProtocol(p,'priceRisk').profitLadder.map(r=>r.fraction),p.profitLadder.map(r=>r.fraction));
 assert.equal(armProtocol(p,'priceRisk').leverage,15);assert.equal(armProtocol(p,'priceRisk').risk,.01);
});
test('wallet driver and margin fork reproduce all frozen summary values and ledgers',()=>{
 const m=old.months.find(m=>m.month==='2024-04'),grid=read('work/pepe-specialists-v1/labels/2024-04.json').rows,
  predictions=read('work/pepe-specialists-v1/models/genetic-1-151/predictions.json').predictions;
 const allowed=new Set(predictions.filter(r=>r.eligible&&r.netR>.1).map(r=>r.at)),entries=grid.filter(r=>allowed.has(r.at)).map(f=>({atr:f.atr,trade:{entryAt:f.at,side:1,leverage:15}}));
 const r=monthlyWallet(m,entries,armProtocol(p,'margin'),market),w=read('work/pepe-specialists-v1/result.json').results['genetic-151-combined'].wallets[0];
 for(const[k,v]of Object.entries(r))if(!['stage','realOrders'].includes(k))assert.deepEqual(v,w[k],k);
});
test('stage signals cannot force a partial fill after a gap below the observed target',()=>{
 const pp=armProtocol(p,'priceRisk'),start=Date.UTC(2024,0,1),filt=market.filters,cost=pp.costCases.find(c=>c.id==='stress');
 const account=createResearchAccount({start,until:start+3*60000,protocol:pp,cost,filters:filt,agentMode:true,stopContext:[],startingState:{cash:200,initial:200,day:'2024-01-01',dayStart:200,lastClose:.01,position:null}});
 account.queueEntry(1,.0001,start,15);const a=[start,.01,.0105,.00999,.0105,10000];account.consume({candles:[a],marks:[a],funding:[]});
 account.queueAction(7,start+60000);const b=[start+60000,.01005,.01006,.01004,.01005,10000];account.consume({candles:[b],marks:[b],funding:[]});
 assert.equal(account.state().position.ladderStage,0);
 const c=[start+120000,.01005,.01006,.01004,.01005,10000];account.consume({candles:[c],marks:[c],funding:[]});const result=account.finish();
 assert.ok(result.decisions.some(d=>!d.applied&&d.reason==='Abertura não atende alvo líquido; parcial não preenchida'));
});
