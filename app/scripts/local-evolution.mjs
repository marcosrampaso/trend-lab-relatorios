import fs from'node:fs';import path from'node:path';import{spawn,spawnSync}from'node:child_process';import{fileURLToPath}from'node:url';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url))),dir=path.join(root,'work/local-ml'),service=path.join(dir,'evolution-service.json'),read=p=>JSON.parse(fs.readFileSync(p)),args=process.argv.slice(2),command=args.shift()??'status',state=fs.existsSync(service)?read(service):null;
function active(){if(!state)return false;const r=spawnSync('ps',['-p',String(state.pid),'-o','command='],{encoding:'utf8'});if(r.error||r.stderr?.trim())throw Error('Sem acesso à lista de processos');return r.status===0&&r.stdout.includes('scripts/genetic-ml.py')&&r.stdout.includes(state.runId);}
if(command==='status'){let running=null,error;try{running=active();}catch(e){error=e.message;}console.log(JSON.stringify(state?{...state,active:running,error,status:fs.existsSync(state.statusPath)?read(state.statusPath):null}:{active:false},null,2));}
else if(command==='stop'){if(active()){process.kill(state.pid,'SIGTERM');console.log('Parada genética solicitada; a grade base tem controle separado.');}else console.log('Nenhuma genética ativa.');}
else if(command==='start'||command==='resume'){
 if(active())throw Error('Já existe evolução ativa.');const resume=command==='resume',runId=resume?state?.runId:'genetic-'+new Date().toISOString().replace(/[-:.]/g,'');if(!runId)throw Error('Sem rodada para retomar');
 const logPath=path.join(dir,runId+'.log'),fd=fs.openSync(logPath,'a'),child=spawn(path.join(root,'.venv-ml/bin/python'),['scripts/genetic-ml.py','--run-id',runId,...(resume?['--resume']:[])],{cwd:root,detached:true,stdio:['ignore',fd,fd]});child.unref();fs.closeSync(fd);
 const base=read(path.join(root,'genetic-ml-protocol.json')).baseRun,s=read(path.join(dir,'runs',base,'status.json')),seconds=Math.max(1,Math.ceil((Date.parse(s.deadlineAt)-Date.now())/1000));
 const awake=spawn('/usr/bin/caffeinate',['-is','-w',String(child.pid),'-t',String(seconds)],{detached:true,stdio:'ignore'});awake.unref();
 const info={pid:child.pid,awakePID:awake.pid,runId,logPath,statusPath:path.join(dir,'runs',runId,'evolution-status.json')};fs.writeFileSync(service,JSON.stringify(info,null,2));console.log(JSON.stringify(info,null,2));
}else throw Error('Use start, status, stop ou resume.');
