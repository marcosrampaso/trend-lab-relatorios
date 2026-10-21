// Requested by the Ultra button only. Drain the existing coordinator cleanly.
import{ROOT,read,atomic}from'./multiasset-io.mjs';import{spawnSync}from'node:child_process';import{startExitRuntime}from'./exit-lab-service.mjs';
const base=ROOT+'/work/pepe-exits-v1',file=base+'/runtime-transition.json';
function alive(pid){const r=spawnSync('ps',['-p',String(pid),'-o','command='],{encoding:'utf8'});if(r.error)throw r.error;return r.status===0&&r.stdout.includes('/scripts/run-exit-study.py');}
try{
 let t=read(file);while(alive(t.oldPID)){await new Promise(r=>setTimeout(r,2000));t=read(file);}
 t=read(file);const report=read(base+'/status.json');
 if(t.desiredAfter!=='running'||report.status==='complete'){atomic(file,{...t,status:'cancelled',finishedAt:Date.now()});}
 else if(report.status!=='paused'){throw Error('Old coordinator did not pause cleanly: '+report.status);}
 else{atomic(file,{...t,status:'ready',finishedAt:Date.now()});atomic(base+'/control.json',{...read(base+'/control.json'),desired:'running',updatedAt:Date.now()});startExitRuntime();atomic(file,{...read(file),status:'applied',finishedAt:Date.now()});}
}catch(e){atomic(file,{...read(file),status:'error',error:e.message,finishedAt:Date.now()});process.exitCode=1;}
