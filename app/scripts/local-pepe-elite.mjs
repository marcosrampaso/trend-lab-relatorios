import fs from 'node:fs';import path from 'node:path';import {spawn,spawnSync}from'node:child_process';import{ROOT,read,atomic}from'./multiasset-io.mjs';
const base=path.join(ROOT,'work/pepe-elite-study-v1'),script=path.join(ROOT,'scripts/run-pepe-elite.py'),action=process.argv[2]??'status';
function status(){const s=fs.existsSync(base+'/service.json')?read(base+'/service.json'):null,c=s?spawnSync('ps',['-p',String(s.pid),'-o','command='],{encoding:'utf8'}):null;if(c?.error)throw c.error;const active=Boolean(c?.status===0&&c.stdout.includes(script));return{active,pid:active?s.pid:null,control:read(base+'/control.json'),report:read(base+'/status.json')};}
if(!['status','resume','pause'].includes(action))throw Error('Use status, resume or pause');
let s=status();
if(action!=='status'){
 if(action==='resume'&&s.report.status==='complete')throw Error('Study complete; register a new study');
 atomic(base+'/control.json',{desired:action==='resume'?'running':'paused',updatedAt:Date.now()});
 if(action==='resume'&&!s.active){const log=fs.openSync(base+'/service.log','a'),p=spawn(path.join(ROOT,'.venv-rl/bin/python'),[script],{cwd:ROOT,env:{...process.env,OMP_NUM_THREADS:'2',OPENBLAS_NUM_THREADS:'2',MPLCONFIGDIR:path.join(ROOT,'work/finrl-cache/matplotlib'),XDG_CACHE_HOME:path.join(ROOT,'work/finrl-cache')},detached:true,stdio:['ignore',log,log]});p.unref();fs.closeSync(log);const awake=spawn('/usr/bin/caffeinate',['-is','-w',String(p.pid)],{detached:true,stdio:'ignore'});awake.unref();atomic(base+'/service.json',{pid:p.pid,awakePID:awake.pid,startedAt:Date.now(),script});}
 s=status();
}
console.log(JSON.stringify({active:s.active,pid:s.pid,control:s.control,status:s.report.status,round:s.report.round,jobs:s.report.jobsCompleted,currentJob:s.report.currentJob,error:s.report.error}));
