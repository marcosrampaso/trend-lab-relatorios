import fs from 'node:fs';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {ROOT,read,atomic} from './multiasset-io.mjs';
const base=path.join(ROOT,'work/pepe-finrl-mask-v3');
const legacyScript=path.join(ROOT,'scripts/run-pepe-mask.py'),ultraScript=path.join(ROOT,'scripts/run-pepe-mask-ultra.py');
const configFile=base+'/runtime-config.json',leaseMS=12*3600*1000;
export function maskedStatus(){
 const s=fs.existsSync(base+'/service.json')?read(base+'/service.json'):null;
 let active=false,actualScript=null;
 if(s){const p=spawnSync('ps',['-p',String(s.pid),'-o','command='],{encoding:'utf8'});if(p.error)throw p.error;actualScript=[ultraScript,legacyScript].find(v=>p.status===0&&p.stdout.includes(v))??null;active=Boolean(actualScript);}
 const control=read(base+'/control.json'),config=fs.existsSync(configFile)?read(configFile):null;
 const latest=fs.existsSync(base+'/runtime-status.json')?read(base+'/runtime-status.json'):null;
 const effectiveMode=control.mode==='ultra'&&!(control.ultraExpiresAt>Date.now())?'eco':control.mode;
 const runtime=config?{...latest,profiles:config.profiles,maximumWorkers:config.maximumWorkers,threadsPerWorker:config.threadsPerWorker,requestedMode:control.mode,effectiveMode,ultraExpiresAt:control.ultraExpiresAt??null,ultraExpired:control.mode==='ultra'&&effectiveMode==='eco',adapterActive:active&&actualScript===ultraScript}:null;
 return{app:'trend-lab-pepe-mask-control',active,pid:active?s.pid:null,script:actualScript,control,runtime,report:fs.existsSync(base+'/status.json')?read(base+'/status.json'):null};
}
export function maskedAction(action,mode){
 if(!['start','resume','pause','eco','boost','ultra'].includes(action))throw Error('Unknown action');
 if(mode!==undefined&&!['eco','boost','ultra'].includes(mode))throw Error('Unknown mode');
 const old=maskedStatus(),now=Date.now(),control={...old.control,desired:action==='pause'?'paused':['start','resume'].includes(action)?'running':old.control.desired,mode:['eco','boost','ultra'].includes(action)?action:mode??old.control.mode,updatedAt:now};
 if(control.mode==='ultra'){
  if(!fs.existsSync(configFile))throw Error('Ultra runtime not registered');
  if(old.active&&old.script!==ultraScript)throw Error('Pause the legacy coordinator and wait for its checkpoint before enabling Ultra');
  if(action==='ultra'||['start','resume'].includes(action))control.ultraExpiresAt=now+leaseMS;
 }
 if(control.desired==='running'){
  if(old.report?.status==='complete_training_final_locked')throw Error('Training complete; register another run before retraining');
  for(const run of['pepe-finrl-v2','pepe-finrl-1000-v1']){const file=path.join(ROOT,'work',run,'service.json');if(!fs.existsSync(file))continue;const svc=read(file),check=spawnSync('ps',['-p',String(svc.pid),'-o','command='],{encoding:'utf8'});if(check.error)throw check.error;if(check.status===0&&/scripts\/run-pepe-(pbt|1000)\.mjs/.test(check.stdout))throw Error('Pause the old population and wait for its checkpoint first');}
 }
 atomic(base+'/control.json',control);
 if(control.desired==='running'&&!old.active){
  const script=fs.existsSync(configFile)?ultraScript:legacyScript,log=fs.openSync(base+'/service.log','a');
  const child=spawn(path.join(ROOT,'.venv-rl/bin/python'),[script],{cwd:ROOT,env:{...process.env,MPLCONFIGDIR:path.join(ROOT,'work/finrl-cache/matplotlib'),XDG_CACHE_HOME:path.join(ROOT,'work/finrl-cache'),OMP_NUM_THREADS:'2',OPENBLAS_NUM_THREADS:'2'},detached:true,stdio:['ignore',log,log]});child.unref();fs.closeSync(log);
  const duration=control.mode==='ultra'?43200:172800,awake=spawn('/usr/bin/caffeinate',['-is','-w',String(child.pid),'-t',String(duration)],{detached:true,stdio:'ignore'});awake.unref();
  atomic(base+'/service.json',{pid:child.pid,awakePID:awake.pid,awakeExpiresAt:now+duration*1000,startedAt:now,script});
 }
 if(control.desired==='running'&&old.active&&control.mode==='ultra'&&(action==='ultra'||['start','resume'].includes(action))){
  const awake=spawn('/usr/bin/caffeinate',['-is','-w',String(old.pid),'-t','43200'],{detached:true,stdio:'ignore'});awake.unref();
  atomic(base+'/service.json',{...read(base+'/service.json'),awakePID:awake.pid,awakeExpiresAt:now+leaseMS});
 }
 return maskedStatus();
}
