import fs from'node:fs';import{spawn,spawnSync}from'node:child_process';import{ROOT,read,atomic}from'./multiasset-io.mjs';
import{exportExitEvaluations}from'./report-exit-evaluations.mjs';
const base=ROOT+'/work/pepe-exits-v1',script=ROOT+'/scripts/run-exit-study.py';
export function exitStatus(){exportExitEvaluations();const service=fs.existsSync(base+'/service.json')?read(base+'/service.json'):null,ps=service?spawnSync('ps',['-p',String(service.pid),'-o','command='],{encoding:'utf8'}):null;if(ps?.error)throw ps.error;return{app:'trend-lab-exit-control',active:Boolean(ps?.status===0&&ps.stdout.includes(script)),pid:service?.pid,control:read(base+'/control.json'),report:read(base+'/status.json')};}
export function exitAction(action){
 if(!['resume','pause','eco','boost'].includes(action))throw Error('Unknown exit action');const old=exitStatus();if(old.report.status==='complete'&&action==='resume')throw Error('Registered pilot complete; no automatic extension');
 const control={...old.control,desired:action==='pause'?'paused':action==='resume'?'running':old.control.desired,mode:['eco','boost'].includes(action)?action:old.control.mode,updatedAt:Date.now()};atomic(base+'/control.json',control);
 if(control.desired==='running'&&!old.active){
  if(fs.existsSync(base+'/coordinator.lock')){const pid=Number(fs.readFileSync(base+'/coordinator.lock','utf8'));try{process.kill(pid,0);throw Error('A coordinator is already active');}catch(e){if(e.code!=='ESRCH')throw e;}fs.unlinkSync(base+'/coordinator.lock');}
  const log=fs.openSync(base+'/service.log','a'),p=spawn(ROOT+'/.venv-rl/bin/python',[script],{cwd:ROOT,env:{...process.env,OMP_NUM_THREADS:'2',OPENBLAS_NUM_THREADS:'2',MPLCONFIGDIR:ROOT+'/work/finrl-cache/matplotlib',XDG_CACHE_HOME:ROOT+'/work/finrl-cache'},detached:true,stdio:['ignore',log,log]});p.unref();fs.closeSync(log);const awake=spawn('/usr/bin/caffeinate',['-is','-w',String(p.pid)],{detached:true,stdio:'ignore'});awake.unref();atomic(base+'/service.json',{pid:p.pid,awakePID:awake.pid,startedAt:Date.now(),script});
 }return exitStatus();
}
