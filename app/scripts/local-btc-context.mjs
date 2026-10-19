import fs from 'node:fs';import path from 'node:path';import {spawn} from 'node:child_process';
import {ROOT,BASE,read,hash,atomic,alive,json} from './multiasset-io.mjs';import {btcContextFrames,btcBiasAt} from './btc-context-core.mjs';
const state=path.join(BASE,'btc-context-live'),registration=path.join(state,'registration.json'),pidFile=path.join(state,'pid.json'),publicFile=path.join(ROOT,'web/data/btc-market-context.json'),action=process.argv[2]??'status';
const sourceHashes=()=>Object.fromEntries(['scripts/local-btc-context.mjs','scripts/btc-context-core.mjs','web/scalping-context.js','btc-context-protocol.json'].map(f=>[f,hash(path.join(ROOT,f))]));
function register(){fs.mkdirSync(path.join(state,'decisions'),{recursive:true});const r={registeredAt:Date.now(),policy:read(path.join(ROOT,'btc-context-protocol.json')),sourceHashes:sourceHashes(),mode:'diagnostic_shadow_only',noPortfolioChanges:true};fs.writeFileSync(registration,JSON.stringify(r),{flag:'wx'});}
async function tick(){
 const reg=read(registration);if(JSON.stringify(sourceHashes())!==JSON.stringify(reg.sourceHashes))throw Error('Context source changed');
 const s=await json('http://127.0.0.1:4173/api/local/status');if(s.app!=='trend-lab-local')throw Error('Wrong server');if(s.paused){atomic(publicFile,{status:'paused',updatedAt:Date.now(),mode:reg.mode});return;}
 const btc=read(path.join(BASE,'forward/BTCUSDT-market.json')),eth=read(path.join(BASE,'forward/ETHUSDT-market.json')),frames=btcContextFrames(btc.hourly,eth.hourly,reg.policy),now=Date.now(),context=btcBiasAt(frames,now,1,reg.policy).context,sourceDir=path.join(BASE,'forward/decisions/eth-g151'),recent=[];
 for(const name of fs.readdirSync(sourceDir).filter(n=>n.endsWith('.json')).sort()){
  const dest=path.join(state,'decisions',name),b=read(path.join(sourceDir,name));
  if(fs.existsSync(dest)){recent.push(read(dest));continue;}
  if(b.signalAt<reg.registeredAt||now>=b.entryAt)continue;
  const record={signalAt:b.signalAt,entryAt:b.entryAt,observedAt:now,sourcePayloadSHA256:b.payloadSHA256,rows:b.rows.map(r=>({family:r.family,side:r.side,modelAllowed:r.modelAllowed,sentiment:r.sentiment.bias,btc:btcBiasAt(frames,b.signalAt,r.side,reg.policy)})),mode:reg.mode};fs.writeFileSync(dest,JSON.stringify(record),{flag:'wx'});recent.push(record);
 }
 atomic(publicFile,{status:'collecting',updatedAt:now,registeredAt:reg.registeredAt,mode:reg.mode,noPortfolioChanges:true,context,policy:reg.policy,decisions:recent.slice(-30),note:'BTC é contexto diagnóstico; o filtro só foi aplicado no estudo histórico separado, não nas carteiras já registradas.'});
}
let busy=false;async function safeTick(){if(busy)return;busy=true;try{await tick();}catch(e){atomic(publicFile,{status:'error',updatedAt:Date.now(),mode:'diagnostic_shadow_only',error:e.message});console.error(e.message);}finally{busy=false;}}
const pid=fs.existsSync(pidFile)?read(pidFile).pid:null;
if(action==='start'){
 if(!fs.existsSync(registration))register();if(alive(pid))console.log(JSON.stringify({running:true,pid}));else{const fd=fs.openSync(path.join(state,'runner.log'),'a'),c=spawn(process.execPath,[import.meta.filename,'run'],{cwd:ROOT,detached:true,stdio:['ignore',fd,fd]});fs.closeSync(fd);c.unref();atomic(pidFile,{pid:c.pid});console.log(JSON.stringify({started:true,pid:c.pid,mode:'diagnostic_shadow_only'}));}
}else if(action==='run'){await safeTick();setInterval(safeTick,5000);}
else if(action==='status'){const d=fs.existsSync(publicFile)?read(publicFile):{};console.log(JSON.stringify({running:alive(pid),...d,decisions:d.decisions?.length}));}
else if(action==='stop'){if(alive(pid))process.kill(pid,'SIGTERM');}
else if(action==='tick')await tick();else throw Error('Use start/status/stop/tick');
