import fs from'node:fs';import path from'node:path';import{spawn,spawnSync}from'node:child_process';import{ROOT,read,atomic}from'./multiasset-io.mjs';
let exportedSHA=null;
const revised=fs.existsSync(path.join(ROOT,'work/pepe-v4-v2/registration.json')),base=path.join(ROOT,revised?'work/pepe-v4-v2':'work/pepe-v4-v1'),script=path.join(ROOT,revised?'scripts/run-pepe-v4-v2.py':'scripts/run-pepe-v4.py');
export function v4Status(){
 const s=fs.existsSync(base+'/service.json')?read(base+'/service.json'):null,c=s?spawnSync('ps',['-p',String(s.pid),'-o','command='],{encoding:'utf8'}):null;if(c?.error)throw c.error;
 const active=Boolean(c?.status===0&&c.stdout.includes(script)),control=read(base+'/control.json'),report=read(base+'/status.json'),effectiveMode=control.mode==='ultra'&&!(control.ultraExpiresAt>Date.now())?'eco':control.mode;
 if(report.best&&report.best.modelSHA256!==exportedSHA){const result=read(base+'/results/'+report.best.key+'.json');if(result.modelSHA256!==report.best.modelSHA256)throw Error('Champion evidence mismatch');atomic(path.join(ROOT,'web/data/pepe-v4-wallet.json'),{app:'trend-lab-pepe-v4-wallet',modelSHA256:result.modelSHA256,blocks:result.blocks});exportedSHA=result.modelSHA256;}
 return{app:'trend-lab-pepe-mask-control',run:'v4',active,pid:active?s.pid:null,control,report,runtime:{...report.executionRuntime,adapterActive:active,profiles:{eco:{workers:1},boost:{workers:3},ultra:{workers:5}},requestedMode:control.mode,effectiveMode,threadsPerWorker:2}};
}
export function v4Action(action,mode){
 if(!['start','resume','pause','eco','boost','ultra'].includes(action)||mode!==undefined&&!['eco','boost','ultra'].includes(mode))throw Error('Unknown action/mode');
 const old=v4Status(),now=Date.now(),control={...old.control,desired:action==='pause'?'paused':['start','resume'].includes(action)?'running':old.control.desired,mode:['eco','boost','ultra'].includes(action)?action:mode??old.control.mode,updatedAt:now};
 if(control.desired==='running'){
  if(old.report.status==='pilot_complete'&&(!revised||fs.existsSync(base+'/validation-report.json')))throw Error('Pilot complete; register another study');
  const v3=read(path.join(ROOT,'work/pepe-finrl-mask-v3/control.json'));if(v3.desired!=='paused')throw Error('V3 must stay closed');
 }
 if(control.mode==='ultra'&&(action==='ultra'||['start','resume'].includes(action)))control.ultraExpiresAt=now+12*3600e3;
 atomic(base+'/control.json',control);
 if(control.desired==='running'&&!old.active){
  const log=fs.openSync(base+'/service.log','a'),p=spawn(path.join(ROOT,'.venv-rl/bin/python'),[script],{cwd:ROOT,env:{...process.env,OMP_NUM_THREADS:'2',OPENBLAS_NUM_THREADS:'2',MPLCONFIGDIR:path.join(ROOT,'work/finrl-cache/matplotlib'),XDG_CACHE_HOME:path.join(ROOT,'work/finrl-cache')},detached:true,stdio:['ignore',log,log]});p.unref();fs.closeSync(log);
  const awake=spawn('/usr/bin/caffeinate',['-is','-w',String(p.pid)],{detached:true,stdio:'ignore'});awake.unref();atomic(base+'/service.json',{pid:p.pid,awakePID:awake.pid,startedAt:now,script});
 }
 return v4Status();
}
