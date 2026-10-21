import fs from 'node:fs';import {spawn} from 'node:child_process';
import {ROOT,read,hash,atomic} from './multiasset-io.mjs';
import {SPECIALISTS} from './specialist-core.mjs';
const base=ROOT+'/'+SPECIALISTS,p=read(base+'/protocol.json'),reg=read(base+'/registration.json');
if(fs.existsSync(base+'/result.json'))throw Error('Pilot already complete');
const children=new Set(),startedAt=Date.now();let phase='labels';
function verify(){
  if(hash(base+'/protocol.json')!==reg.protocolSHA256)throw Error('Changed specialist protocol');
  for(const[f,h]of Object.entries({...reg.inputHashes,...reg.sourceHashes}))
    if(hash(ROOT+'/'+f)!==h)throw Error('Specialist input changed: '+f);
}
function publish(error){
  const labels=p.months.filter(m=>fs.existsSync(base+'/labels/'+m.month+'.json')).length;
  const jobs=p.jobs.map(j=>{const f=base+'/models/'+j.key+'/status.json';return{key:j.key,...(fs.existsSync(f)?read(f):{phase:'pending'})};});
  const s={app:'trend-lab-specialist-status',pid:process.pid,phase,startedAt,updatedAt:Date.now(),
    activeWorkers:children.size,labels,months:p.months.length,jobs,error,realOrders:false};
  atomic(base+'/status.json',s);atomic(ROOT+'/web/data/specialists-status.json',s);
}
function command(binary,args){return new Promise((resolve,reject)=>{
  const child=spawn(binary,args,{cwd:ROOT,stdio:['ignore','inherit','inherit']});children.add(child);publish();
  child.on('error',reject);child.on('close',code=>{children.delete(child);publish();code?reject(Error(args.join(' ')+' exited '+code)):resolve();});
});}
async function pool(items,fn){let n=0;await Promise.all(Array.from({length:Math.min(p.workers,items.length)},async()=>{
  while(n<items.length)await fn(items[n++]);
}));}
let timer;
try{
  verify();publish();timer=setInterval(()=>publish(),3000);
  await pool(p.months,async m=>{
    const file=base+'/labels/'+m.month+'.json';
    if(!fs.existsSync(file))await command(process.execPath,[ROOT+'/scripts/specialist-label-month.mjs',m.month]);
    const data=read(file);if(data.registrationSHA256!==hash(base+'/registration.json'))throw Error('Wrong label registration');
  });
  const files=Object.fromEntries(p.months.map(m=>[SPECIALISTS+'/labels/'+m.month+'.json',hash(base+'/labels/'+m.month+'.json')]));
  if(!fs.existsSync(base+'/dataset-registration.json'))fs.writeFileSync(base+'/dataset-registration.json',JSON.stringify({registeredAt:Date.now(),files}),{flag:'wx',mode:0o444});
  else if(JSON.stringify(read(base+'/dataset-registration.json').files)!==JSON.stringify(files))throw Error('Dataset changed');
  phase='training';publish();
  await pool(p.jobs,async j=>{
    const dir=base+'/models/'+j.key;
    if(!fs.existsSync(dir+'/complete.json'))await command(ROOT+'/.venv-rl/bin/python',[ROOT+'/scripts/train-specialist.py',String(j.side),j.family,String(j.seed)]);
    const manifest=read(dir+'/complete.json');for(const[f,h]of Object.entries(manifest.artifacts))if(hash(ROOT+'/'+f)!==h)throw Error('Changed model artifact');
  });
  phase='evaluating';publish();verify();
  await command(process.execPath,[ROOT+'/scripts/evaluate-specialists.mjs']);verify();
  phase='complete';publish();clearInterval(timer);
}catch(e){phase='error';for(const c of children)c.kill('SIGTERM');clearInterval(timer);publish(e.message);throw e;}
