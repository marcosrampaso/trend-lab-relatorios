import fs from'node:fs';import{spawn,spawnSync}from'node:child_process';import{ROOT,read,atomic,hash}from'./multiasset-io.mjs';
import{exportExitEvaluations}from'./report-exit-evaluations.mjs';
const base=ROOT+'/work/pepe-exits-v1',legacy=ROOT+'/scripts/run-exit-study.py',ultra=ROOT+'/scripts/run-exit-study-ultra.py',transitionFile=base+'/runtime-transition.json';
export function exitRuntime(control,report,now=Date.now()){
 const valid=Number.isFinite(control.ultraRequestedAt)&&control.ultraExpiresAt>now,mode=control.mode==='ultra'&&!valid?'eco':control.mode,latest=report.executionRuntime;
 return{profiles:{eco:{workers:1},boost:{workers:3},ultra:{workers:5}},maximumWorkers:5,threadsPerWorker:2,requestedMode:control.mode,effectiveMode:mode,workers:latest?.workers??({eco:1,boost:3,ultra:5}[mode]),adapterActive:true,memoryLimited:latest?.memoryLimited??false,ultraExpiresAt:control.ultraExpiresAt,ultraExpired:control.mode==='ultra'&&!valid,scientificProtocolChanged:false};
}
export function exitStatus(){
 exportExitEvaluations();const service=fs.existsSync(base+'/service.json')?read(base+'/service.json'):null,ps=service?spawnSync('ps',['-p',String(service.pid),'-o','command='],{encoding:'utf8'}):null;if(ps?.error)throw ps.error;
 const active=Boolean(ps?.status===0&&[legacy,ultra].some(script=>ps.stdout.includes(script))),control=read(base+'/control.json'),report=read(base+'/status.json'),transition=fs.existsSync(transitionFile)?read(transitionFile):null;
 return{app:'trend-lab-exit-control',active,pid:service?.pid,upgraded:service?.script===ultra,control,report,runtime:exitRuntime(control,report),transition};
}
export function startExitRuntime(upgraded=true){
 const script=upgraded?ultra:legacy;if(upgraded){const reg=read(base+'/runtime-registration-ultra-v1.json');if(hash(base+'/registration.json')!==reg.scientificRegistrationSHA256)throw Error('Scientific registration changed');for(const[f,h]of Object.entries(reg.sourceHashes))if(hash(ROOT+'/'+f)!==h)throw Error('Runtime source changed: '+f);}
 if(fs.existsSync(base+'/coordinator.lock')){const pid=Number(fs.readFileSync(base+'/coordinator.lock','utf8'));try{process.kill(pid,0);throw Error('A coordinator is already active');}catch(e){if(e.code!=='ESRCH')throw e;}fs.unlinkSync(base+'/coordinator.lock');}
 const log=fs.openSync(base+'/service.log','a'),p=spawn(ROOT+'/.venv-rl/bin/python',[script],{cwd:ROOT,env:{...process.env,OMP_NUM_THREADS:'2',OPENBLAS_NUM_THREADS:'2',MPLCONFIGDIR:ROOT+'/work/finrl-cache/matplotlib',XDG_CACHE_HOME:ROOT+'/work/finrl-cache'},detached:true,stdio:['ignore',log,log]});p.unref();fs.closeSync(log);const awake=spawn('/usr/bin/caffeinate',['-is','-w',String(p.pid)],{detached:true,stdio:'ignore'});awake.unref();atomic(base+'/service.json',{pid:p.pid,awakePID:awake.pid,startedAt:Date.now(),script});
}
export function exitAction(action){
 if(!['resume','pause','eco','boost','ultra'].includes(action))throw Error('Unknown exit action');const old=exitStatus(),now=Date.now(),pending=old.transition?.status==='waiting_checkpoint';
 if(old.report.status==='complete'&&action==='resume')throw Error('Registered pilot complete; no automatic extension');
 if(['eco','boost','ultra'].includes(action)&&!pending&&(!old.active||old.control.desired!=='running'))throw Error('O treino está parado ou pausado; retome pelo painel antes de mudar CPU');
 const control={...old.control,desired:action==='pause'?'paused':action==='resume'?'running':old.control.desired,mode:['eco','boost','ultra'].includes(action)?action:old.control.mode,updatedAt:now};
 if(action==='ultra'){control.ultraRequestedAt=now;control.ultraExpiresAt=now+12*3600e3;}
 if(pending){atomic(transitionFile,{...old.transition,desiredAfter:action==='pause'?'paused':action==='resume'?'running':old.transition.desiredAfter,updatedAt:now});control.desired='paused';atomic(base+'/control.json',control);return exitStatus();}
 if(action==='ultra'&&!old.upgraded){
  control.desired='paused';atomic(base+'/control.json',control);atomic(transitionFile,{status:'waiting_checkpoint',oldPID:old.pid,requestedAt:now,desiredAfter:'running',reason:'Explicit Ultra button; wait for frozen checkpoint before replacing only coordinator'});
  const log=fs.openSync(base+'/runtime-upgrade.log','a'),p=spawn(process.execPath,[ROOT+'/scripts/exit-lab-upgrade.mjs'],{cwd:ROOT,detached:true,stdio:['ignore',log,log]});p.unref();fs.closeSync(log);const awake=spawn('/usr/bin/caffeinate',['-is','-w',String(p.pid)],{detached:true,stdio:'ignore'});awake.unref();atomic(transitionFile,{...read(transitionFile),upgradePID:p.pid,awakePID:awake.pid});return exitStatus();
 }
 atomic(base+'/control.json',control);if(control.desired==='running'&&!old.active)startExitRuntime(old.upgraded||(control.mode==='ultra'&&Number.isFinite(control.ultraRequestedAt)&&control.ultraExpiresAt>now));return exitStatus();
}
