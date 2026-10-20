import test from'node:test';import assert from'node:assert/strict';import{spawnSync}from'node:child_process';
test('research-quality audit reconciles actual exits, dates, class coverage and constants without fitting',()=>{const python=`
import importlib.util
spec=importlib.util.spec_from_file_location('quality','scripts/audit-pepe-research-quality.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
base={'entryAt':1735689600000,'decisionAt':1735689600000,'side':1,'entry':100,'initialStop':90,'strategyTarget':120,'status':'resolved','y':0,'labelAt':1735693200000,'stage':'fit','x':[1.0,2.0],'policyIDs':['a','b']}
trade={**base,'net':-1,'exitAt':1735691400000}
audit=m.audit([base],{'a':[trade],'b':[trade]},['availability','signal'])
assert audit['resolved']==1 and audit['referenceDisagreesWithNetSign']==1
assert audit['labelMaturesAfterActualExit']==1
assert audit['stages'][0]['activeDays']==1 and audit['stages'][0]['directions']=={'long':1}
assert audit['stages'][0]['duplicatePoliciesWithDifferentNetSign']==0
assert audit['stages'][0]['outcomeDiagnostic']['negativeNet']==1
assert audit['features'][0]['constantInTraining']
assert audit['stages'][1]['resolved']==0 and audit['stages'][1]['months']=={}
changed=m.audit([base],{'a':[trade],'b':[{**trade,'net':2}]},['availability','signal'])
assert changed['stages'][0]['duplicatePoliciesWithDifferentNetSign']==1
try:m.audit([base],{'a':[],'b':[trade]},['availability','signal']);raise AssertionError('Missing provenance accepted')
except KeyError:pass
`;const r=spawnSync('python3',['-c',python],{encoding:'utf8'});assert.equal(r.status,0,r.stdout+r.stderr);});
