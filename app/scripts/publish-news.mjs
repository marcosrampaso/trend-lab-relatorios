import {captureFromDevice} from '../web/market-collector.js';
import readline from 'node:readline';import {execFileSync} from 'node:child_process';
const origin='https://meu-dinheiro-trend-lab.fizzymoose17.chatgpt.site';
if(process.stdin.isTTY)execFileSync('stty',['-echo','-icanon','min','1','time','0'],{stdio:['inherit','ignore','ignore']});
console.log('Ready for news update JSON on stdin (input is hidden).');
const rl=readline.createInterface({input:process.stdin,terminal:false});
rl.once('line',async line=>{rl.close();try{
 const {token,assessment}=JSON.parse(line);if(typeof token!=='string'||!token)throw Error('Acesso de serviço ausente');
 const headers={'OAI-Sites-Authorization':'Bearer '+token,'content-type':'application/json','x-trend-lab-writer':'news-v1'};
 const response=await fetch(origin+'/api/news',{method:'POST',headers,body:JSON.stringify(assessment),redirect:'error'});if(!response.ok)throw Error('POST recusado: HTTP '+response.status);const saved=await response.json();
 const verify=await fetch(origin+'/api/news',{headers,redirect:'error'});if(!verify.ok)throw Error('Readback indisponível');const body=await verify.json();
 if(!body.updates.some(x=>x.id===saved.saved.id))throw Error('Registro não encontrado no readback');
 let forwardUpdated=false;try{const f=await captureFromDevice({origin,headers:{'OAI-Sites-Authorization':'Bearer '+token}});forwardUpdated=f.ok;}catch{}
 console.log(JSON.stringify({saved:true,id:saved.saved.id,availableAt:saved.saved.availableAt,readback:true,forwardUpdated}));
 }catch{console.error('Falha ao gravar ou verificar a análise. Nenhuma credencial será exibida.');process.exitCode=1;}finally{if(process.stdin.isTTY)execFileSync('stty',['sane'],{stdio:['inherit','ignore','ignore']});process.stdin.destroy();}});
