import fs from 'node:fs';import path from 'node:path';import {spawn,spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));process.chdir(root);
const dir='work/research-monitor',file=dir+'/service.json',command=process.argv[2]??'status';fs.mkdirSync(dir,{recursive:true});
const saved=fs.existsSync(file)?JSON.parse(fs.readFileSync(file)):null;
function active(){if(!saved)return false;const p=spawnSync('ps',['-p',String(saved.pid),'-o','command='],{encoding:'utf8'});if(p.error||p.stderr?.trim())throw Error('Sem acesso à lista de processos');return p.status===0&&p.stdout.includes('scripts/research-monitor.mjs');}
if(command==='start'){
 if(active())throw Error('Monitor já ativo');const fd=fs.openSync(dir+'/monitor.log','a');const child=spawn(process.execPath,['scripts/research-monitor.mjs','--watch'],{cwd:root,detached:true,stdio:['ignore',fd,fd]});child.unref();fs.closeSync(fd);
 const state={pid:child.pid,script:'scripts/research-monitor.mjs',startedAt:new Date().toISOString()};fs.writeFileSync(file,JSON.stringify(state,null,2)+'\n');console.log(JSON.stringify(state));
}else if(command==='stop'){if(active())process.kill(saved.pid,'SIGTERM');console.log('Parada solicitada; eventos preservados.');}
else if(command==='status'){let running=null,error;try{running=active();}catch(e){error=e.message;}console.log(JSON.stringify({...saved,active:running,error,status:fs.existsSync('web/data/research-monitor-status.json')?JSON.parse(fs.readFileSync('web/data/research-monitor-status.json')):null},null,2));}
else throw Error('Use start, status ou stop');
