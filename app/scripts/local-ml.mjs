import fs from 'node:fs';import path from 'node:path';import{spawn,spawnSync}from'node:child_process';import{fileURLToPath}from'node:url';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url))),base=path.join(root,'work/local-ml'),service=path.join(base,'service.json');
fs.mkdirSync(base,{recursive:true});
const args=process.argv.slice(2),command=args.shift()??'status',read=p=>JSON.parse(fs.readFileSync(p));
const state=fs.existsSync(service)?read(service):null;
function active(){if(!state)return false;const r=spawnSync('ps',['-p',String(state.pid),'-o','command='],{encoding:'utf8'});if(r.error||r.stderr?.trim())throw Error('Sem acesso à lista de processos; execute no terminal local ou com permissão de processo.');return r.status===0&&r.stdout.includes(state.script??'scripts/train-local-ml.py')&&r.stdout.includes(state.runId);}
if(command==='status'){let running=null,visibilityError;try{running=active();}catch(e){visibilityError=e.message;}console.log(JSON.stringify(state?{...state,active:running,visibilityError,status:fs.existsSync(state.statusPath)?read(state.statusPath):null}:{active:false},null,2));}
else if(command==='stop'){
 if(!active()){console.log('Nenhum treino pertencente a este projeto está ativo.');process.exit(0);}
 process.kill(state.pid,'SIGTERM');console.log('Parada solicitada; checkpoints serão preservados.');
}else if(command==='start'||command==='resume'){
 if(active())throw Error('Já existe treino ativo neste projeto.');
 const python=path.join(root,'.venv-ml/bin/python');if(!fs.existsSync(python))throw Error('Execute npm run ml:setup primeiro.');
 const resume=command==='resume';let runId=resume?state?.runId:new Date().toISOString().replace(/[-:.]/g,'').replace('Z','Z');
 const runIndex=args.indexOf('--run-id');if(runIndex>=0){runId=args[runIndex+1];args.splice(runIndex,2);}
 if(!runId||!/^[A-Za-z0-9_-]+$/.test(runId))throw Error('run-id inválido');
 if(resume&&state?.runId===runId){for(const flag of ['--profile','--workers','--max-minutes']){if(!args.includes(flag)){const i=state.args?.indexOf(flag)??-1;if(i>=0)args.push(flag,state.args[i+1]);}}}
 const script=args[args.indexOf('--profile')+1]==='extended'?'scripts/train-local-ml-extended.py':'scripts/train-local-ml.py';
 const logPath=path.join(base,runId+'.log'),fd=fs.openSync(logPath,'a');
 const child=spawn(python,[script,'--run-id',runId,...(resume?['--resume']:[]),...args],{cwd:root,detached:true,stdio:['ignore',fd,fd]});
 child.unref();fs.closeSync(fd);
 if(process.platform==='darwin'){const awake=spawn('/usr/bin/caffeinate',['-i','-w',String(child.pid)],{detached:true,stdio:'ignore'});awake.unref();}
 const info={pid:child.pid,runId,args,script,logPath,statusPath:path.join(base,'runs',runId,'status.json')};fs.writeFileSync(service,JSON.stringify(info,null,2)+'\n');console.log(JSON.stringify(info,null,2));
}else throw Error('Use start, resume, status ou stop.');
