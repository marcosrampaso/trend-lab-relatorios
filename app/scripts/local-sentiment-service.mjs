import fs from 'node:fs';import path from 'node:path';import {spawn} from 'node:child_process';import {ROOT,read,atomic,alive,json} from './multiasset-io.mjs';
const state=path.join(ROOT,'work/local-sentiment'),pidFile=path.join(state,'service.json'),action=process.argv[2]??'status',pid=fs.existsSync(pidFile)?read(pidFile).pid:null;
if(action==='start'){
 const s=await json('http://127.0.0.1:4173/api/local/status');if(s.app!=='trend-lab-local'||s.paused)throw Error('Trend Lab inactive/paused');
 if(alive(pid))console.log(JSON.stringify({running:true,pid}));else{const fd=fs.openSync(path.join(state,'runner.log'),'a'),c=spawn(path.join(ROOT,'.venv-sentiment/bin/python'),[path.join(ROOT,'scripts/local-sentiment.py')],{cwd:ROOT,detached:true,stdio:['ignore',fd,fd]});fs.closeSync(fd);c.unref();atomic(pidFile,{pid:c.pid});console.log(JSON.stringify({started:true,pid:c.pid}));}
}else if(action==='stop'){if(alive(pid))process.kill(pid,'SIGTERM');console.log(JSON.stringify({stopped:true,preserved:true}));}
else if(action==='status'){const f=path.join(ROOT,'web/data/local-sentiment.json'),d=fs.existsSync(f)?read(f):{};console.log(JSON.stringify({running:alive(pid),pid,status:d.status,articles:d.articles?.length,updatedAt:d.updatedAt,errors:d.errors,error:d.error}));}
else throw Error('Use start/status/stop');
