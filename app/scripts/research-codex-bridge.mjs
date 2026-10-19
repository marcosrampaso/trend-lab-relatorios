// Official local App Server protocol. No API key, no new chat, no approval bypass.
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {budgetDecision} from './research-monitor-core.mjs';
export async function connect() {
 const child=spawn(process.env.TREND_CODEX_BIN||'codex',['app-server'],{stdio:['pipe','pipe','pipe']});
 let next=0;const pending=new Map(),listeners=new Set();let stderr='';child.stderr.on('data',b=>{stderr=(stderr+b).slice(-2000);});
 const send=x=>child.stdin.write(JSON.stringify(x)+'\n');
 const lines=createInterface({input:child.stdout});
 lines.on('line',line=>{let m;try{m=JSON.parse(line);}catch{return;}
  if(m.id!==undefined&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}
  else if(m.id!==undefined){ // Decline unexpected interactive approval; never silently grant new authority.
   send({id:m.id,error:{code:-32601,message:'Monitor não aprova solicitações interativas. Solicitar revisão humana.'}});
  }else for(const f of listeners)f(m);
 });
 child.on('error',e=>{for(const p of pending.values()){clearTimeout(p.timer);p.reject(e);}pending.clear();});
 child.on('exit',code=>{for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error(`App Server encerrado (${code}): ${stderr.slice(-350)}`));}pending.clear();});
 const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++next,timer=setTimeout(()=>{pending.delete(id);reject(Error('Tempo esgotado: '+method));},20000);pending.set(id,{resolve,reject,timer});send({id,method,params});});
 const close=()=>{lines.close();child.stdin.end();child.kill('SIGTERM');};
 try{await call('initialize',{clientInfo:{name:'trend_lab_event_monitor',version:'1.0.0'},capabilities:{experimentalApi:true}});send({method:'initialized',params:{}});}catch(e){close();throw e;}
 return {call,close,listeners};
}
export async function inspect(threadId,budget) {
 const rpc=await connect();try {
  const account=await rpc.call('account/read',{refreshToken:false});
  if(account.account?.type!=='chatgpt')return {ready:false,reason:'Conexão exige autenticação ChatGPT; API paga não é permitida'};
  const rate=await rpc.call('account/rateLimits/read');
  const decision=budgetDecision(budget,rate.rateLimitsByLimitId?.codex?.primary??rate.rateLimits?.primary);
  const {thread}=await rpc.call('thread/read',{threadId});
  const turns=await rpc.call('thread/turns/list',{threadId,limit:1,itemsView:'notLoaded',sortDirection:'desc'});
  const latest=turns.data?.[0];
  // An unfinished persisted turn is conservatively treated as busy, including interrupted turns without completedAt.
  const busy=thread.status?.type==='active'||latest?.status==='inProgress'||latest&&latest.completedAt===null;
  return {ready:decision.allowed&&!busy,reason:busy?'Chat ocupado ou último turno ainda sem conclusão':decision.reason,budget:decision.budget,additional:decision.additional,threadId:thread.id,latestTurnStatus:latest?.status,transportVerified:true};
 }finally{rpc.close();}
}
export async function deliver(threadId,text,onAccepted=()=>{}) {
 const rpc=await connect();try {
  await rpc.call('thread/resume',{threadId,excludeTurns:true});
  let activeId,completeResolve;const done=new Promise(resolve=>{completeResolve=resolve;});
  rpc.listeners.add(m=>{if(m.method==='turn/completed'&&m.params?.threadId===threadId&&(!activeId||m.params.turn.id===activeId))completeResolve(m.params.turn);});
  const {turn}=await rpc.call('turn/start',{threadId,input:[{type:'text',text}]});activeId=turn.id;onAccepted({turnId:activeId,acceptedAt:new Date().toISOString()});
  const timer=setTimeout(()=>completeResolve({id:activeId,status:'monitor_timeout'}),15*60*1000);
  const result=await done;clearTimeout(timer);
  if(result.status==='monitor_timeout'){await rpc.call('turn/interrupt',{threadId,turnId:activeId});throw Error('Revisão excedeu 15 minutos; turno interrompido, evento preservado para avaliação humana');}
  return {turnId:result.id,status:result.status,deliveredAt:new Date().toISOString()};
 }finally{rpc.close();}
}
