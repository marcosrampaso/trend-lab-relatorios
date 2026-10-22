import fs from 'node:fs';import {spawn} from 'node:child_process';import {ROOT,read,atomic} from './multiasset-io.mjs';
const base=ROOT+'/work/pepe-payoff-genetic-v1',action=process.argv[2]??'status';let running=null;
try{const r=await fetch('http://127.0.0.1:4180/api/payoff-genetic',{signal:AbortSignal.timeout(1500)});const v=await r.json();if(v.app==='trend-lab-payoff-genetic')running=v;}catch{}
if(action==='status'){console.log(JSON.stringify(running?{running:true,pid:running.pid,phase:running.phase,generations:running.completedGenerations,completedMembers:running.completedMembers}: {running:false,snapshot:fs.existsSync(base+'/status.json')?read(base+'/status.json').phase:null}));}
else if(action==='start'){
 if(running)console.log(JSON.stringify({running:true,pid:running.pid,phase:running.phase}));
 else{const c=fs.existsSync(base+'/checkpoint.json')?read(base+'/checkpoint.json'):null;if(c?.completedGenerations>=100)throw Error('Completed run remains frozen');atomic(base+'/control.json',{desired:'running',updatedAt:Date.now()});
 const fd=fs.openSync(base+'/service.log','a'),child=spawn(ROOT+'/.venv-rl/bin/python',['-u',ROOT+'/scripts/run-payoff-genetic.py'],{cwd:ROOT,env:{...process.env,OMP_NUM_THREADS:'1',OPENBLAS_NUM_THREADS:'1',MKL_NUM_THREADS:'1',LOKY_MAX_CPU_COUNT:'1'},detached:true,stdio:['ignore',fd,fd]});fs.closeSync(fd);child.unref();
 const awake=spawn('/usr/bin/caffeinate',['-is','-w',String(child.pid)],{detached:true,stdio:'ignore'});awake.unref();atomic(base+'/service.json',{pid:child.pid,awakePID:awake.pid,startedAt:Date.now(),maxWallHours:null,script:'scripts/run-payoff-genetic.py'});console.log(JSON.stringify({started:true,pid:child.pid,awakePID:awake.pid,maxWallHours:null}));}
}else throw Error('Use start or status');
