import fs from 'node:fs';import path from 'node:path';
import {ROOT,read,atomic,hash} from './multiasset-io.mjs';
process.chdir(ROOT);
const dir='work/g151-exits-v1',r=read('web/data/g151-exits.json'),registration=read(dir+'/registration.json');
function check(condition,message){if(!condition)throw Error(message);}
const near=(a,b)=>Math.abs(a-b)<1e-7;let windows=0,positions=0,legs=0,stopUpdates=0;
check(r.status==='complete'&&r.progress.done===928,'Incomplete study');
for(const [file,sha]of Object.entries({...registration.hashes,...registration.rawHashes}))check(hash(file)===sha,'Input changed '+file);
for(const folder of ['monthly','continuous'])for(const file of fs.readdirSync(dir+'/'+folder).filter(f=>f.endsWith('.json'))){const v=read(dir+'/'+folder+'/'+file);windows++;check(near(v.finalBRL-v.initialBRL,v.pnlBRL),'Final cash mismatch '+file);check(near(v.trades.reduce((n,t)=>n+t.net*5,0),v.pnlBRL),'Position cash mismatch '+file);check(near(v.grossBRL-v.feesBRL+v.fundingBRL,v.pnlBRL),'Cost reconciliation '+file);check(v.cdi.comparable,'Unreconciled CDI '+file);
 for(const t of v.trades){positions++;check(t.entryAt>=v.curve[0].at&&t.exitAt<=v.curve.at(-1).at,'Outside window '+file);if(v.policy==='original')check(t.exitAt-t.entryAt<=t.holdMinutes*60000,'Original deadline lost');else check(!/^Limite de \d+min/.test(t.reason),'Unexpected expiry '+file);let previous=t.initialStop;for(const s of t.stopHistory){stopUpdates++;check(s.knownAt===s.at&&s.effectiveAt===s.at&&s.at>t.entryAt&&s.at<t.exitAt,'Noncausal stop '+file);check((s.stop-previous)*t.side>0,'Stop widened '+file);previous=s.stop;}
 if(t.legs){legs+=t.legs.length;check(near(t.legs.reduce((n,l)=>n+l.qty,0),t.qty),'Leg quantity mismatch');check(near(t.legs.reduce((n,l)=>n+l.net,0),t.net),'Leg cash mismatch');for(const l of t.legs)check(near(l.gross-l.entryFee-l.exitFee+l.funding,l.net),'Leg cost mismatch');}
 }
}
check(windows===928,'Missing cached evaluations');
const legacy=r.legacyCheck.filter(x=>x.cost==='stress');check(legacy.length===9&&near(legacy.reduce((n,x)=>n+x.pnlBRL,0)/9,18.402207221636612),'Legacy G151 reproduction failed');
const audit={checkedAt:Date.now(),windows,positions,legs,stopUpdates,inputHashesVerified:Object.keys(registration.hashes).length+Object.keys(registration.rawHashes).length,legacyMonthlyBRL:18.402207221636612,correctedMonthlyBRL:r.aggregates.find(a=>a.dataset==='selection'&&a.policy==='original'&&a.cost==='stress').monthlyBRL,reportSHA256:hash('web/data/g151-exits.json'),allContinuousStressHalted:r.continuous.filter(c=>c.cost==='stress').every(c=>c.halted),realOrders:false,independentHoldout:false};
atomic(dir+'/audit.json',audit);atomic('web/data/g151-exits-audit.json',audit);console.log(JSON.stringify(audit));
