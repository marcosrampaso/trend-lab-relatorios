import test from 'node:test';import assert from 'node:assert/strict';
import {dueEvents,winnerAt,parameterChanges,budgetDecision} from '../scripts/research-monitor-core.mjs';
const h=(g,improved=false,n=10)=>({generation:g,improved,bestValidationMonthlyBRL:n});
test('catch up all records and anchored milestones, once only',()=>{
 const state={anchorGeneration:79,events:[]},report={runId:'run',history:[h(79,true),h(80,true),h(81,true),h(104),h(129),h(179)]};
 const events=dueEvents(state,report);assert.equal(events.filter(e=>e.kind==='record').length,2);assert.deepEqual(events.filter(e=>e.kind==='checkpoint').map(e=>e.generation),[104,129,154,179]);assert.deepEqual(events.filter(e=>e.kind==='report').map(e=>e.generation),[129,179]);assert.deepEqual(events.filter(e=>e.kind==='full-history').map(e=>e.generation),[179]);assert.deepEqual(dueEvents({...state,events},report),[]);
});
test('unfinished generation never triggers its milestone',()=>assert.deepEqual(dueEvents({anchorGeneration:79,events:[]},{runId:'r',generation:104,history:[h(103)]}),[]));
test('never attribute a future winner to an old record',()=>{
 const report={generation:81,winner:{genome:{id:'future'},fitnessUSDT:5},history:[h(80,true,20),h(81,true,25)]},old={genome:{id:'old'},fitnessUSDT:4,eligible:true,maxDD:.02,positiveMonths:7};
 assert.equal(winnerAt(report,80,()=>({candidates:[old]})).genome.id,'old');assert.throws(()=>winnerAt(report,80,()=>({candidates:[]})),/não encontrado/);
});
test('terminal event is idempotent even without reaching 25 generations',()=>{const s={anchorGeneration:79,events:[]},r={runId:'r',history:[h(83)]};const e=dueEvents(s,r,true);assert.equal(e[0].kind,'terminal');assert.deepEqual(dueEvents({...s,events:e},r,true),[]);});
test('only actual genome changes are presented',()=>assert.deepEqual(parameterChanges({id:'a',params:{depth:2},cut:1},{id:'b',params:{depth:2},cut:1.2}),[{parameter:'cut',before:1,after:1.2}]));
test('17 additional percentage points stops new AI calls',()=>assert.equal(budgetDecision({resetsAt:10000,baseline:3},{windowDurationMins:300,usedPercent:20,resetsAt:10000},9000000).allowed,false));
test('second rounding does not reset a real 5h baseline',()=>{const d=budgetDecision({resetsAt:10000,baseline:3},{windowDurationMins:300,usedPercent:20,resetsAt:10001},10002000);assert.equal(d.budget.baseline,3);assert.equal(d.allowed,false);});
test('real new window permits a new baseline; quota unavailable fails closed',()=>{
 const d=budgetDecision({resetsAt:10000,baseline:3},{windowDurationMins:300,usedPercent:1,resetsAt:28000},10002000);assert.equal(d.budget.baseline,1);assert.equal(d.allowed,true);assert.equal(budgetDecision(null,null).allowed,false);assert.equal(budgetDecision(null,{windowDurationMins:300,usedPercent:91,resetsAt:28000}).allowed,false);
});
test('a blocked writer channel prevents new dispatch without dropping events',async()=>{
 const {canAttemptReview}=await import('../scripts/research-monitor-core.mjs');
 const events=[{id:'r:checkpoint:229',delivery:'pending'}];
 assert.equal(canAttemptReview({bridge:{disabled:true},events}),false);assert.equal(events[0].delivery,'pending');
 assert.equal(canAttemptReview({bridge:{disabled:false},events}),true);
});
