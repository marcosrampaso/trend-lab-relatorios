import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import {DatabaseSync} from 'node:sqlite';import {fileURLToPath} from 'node:url';import {createHandler} from '../worker/handler.js';import {adapt} from './sqlite.mjs';import {createRuntime} from './runtime.mjs';
import {createHistoryReader} from './research-history.mjs';
import {createGeneticReader} from './research-genetics.mjs';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export function createLocalServer({port=4173,stateDirectory=path.join(root,'.local'),fetcher=fetch,log=console.log,clock=()=>Date.now(),autoStart=true}={}){
 fs.mkdirSync(stateDirectory,{recursive:true,mode:0o700});const db=new DatabaseSync(path.join(stateDirectory,'runtime.sqlite'));db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000');const DB=adapt(db),runtime=createRuntime({db,DB,fetcher,log,clock}),worker=createHandler();
 const send=(res,value,status=200)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(value));};
 const researchHistory=createHistoryReader(root);
 const researchGenetics=createGeneticReader(root);
 const server=http.createServer(async(req,res)=>{
  const host=req.headers.host,allowed=new Set(['127.0.0.1:'+port,'localhost:'+port]);if(!allowed.has(host)){send(res,{error:'Host local inválido'},403);return;}const origin='http://'+host,url=new URL(req.url,origin),provided=req.headers.origin;
  if(provided&&provided!==origin){send(res,{error:'Origem não permitida'},403);return;}
  try{
   if(url.pathname==='/api/local/status'){if(req.method!=='GET')return send(res,{error:'Método inválido'},405);return send(res,await runtime.status());}
   if(url.pathname==='/api/local/market'){if(req.method!=='GET')return send(res,{error:'Método inválido'},405);const rows=runtime.getMarket();return send(res,rows??{error:'Aguardando primeira consulta de mercado'},rows?200:503);}
   if(url.pathname==='/api/research/history'){if(req.method!=='GET')return send(res,{error:'Método inválido'},405);return send(res,researchHistory(url.searchParams));}
   if(url.pathname==='/api/research/genetics'){if(req.method!=='GET')return send(res,{error:'Método inválido'},405);return send(res,researchGenetics(url.searchParams));}
   if(url.pathname.startsWith('/api/')){
    let length=0;const chunks=[];for await(const chunk of req){length+=chunk.length;if(length>2500000)return send(res,{error:'Conteúdo muito grande'},413);chunks.push(chunk);}const body=Buffer.concat(chunks);
    if(url.pathname==='/api/local/control'){if(req.method!=='POST'||req.headers['x-trend-local']!=='runtime-v1'||!req.headers['content-type']?.startsWith('application/json'))return send(res,{error:'Cabeçalho de controle obrigatório'},403);let value;try{value=JSON.parse(body);}catch{return send(res,{error:'JSON inválido'},400);}if(!['pause','resume','tick'].includes(value.action))return send(res,{error:'Ação inválida'},400);return send(res,await runtime.control(value.action));}
    if(url.pathname==='/api/forward'&&req.method==='POST'){if(req.headers['x-trend-lab-writer']!=='forward-v1')return send(res,{error:'Cabeçalho de escrita obrigatório'},403);return send(res,await runtime.capture());}
    const response=await worker.fetch(new Request(url,{method:req.method,headers:req.headers,...(body.length?{body}: {})}),{DB});if(url.pathname==='/api/news'&&req.method==='POST'&&response.status===201)runtime.event('news','Nova análise de notícias registrada localmente');res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;
   }
   if(!['GET','HEAD'].includes(req.method))return send(res,{error:'Método não permitido'},405);
   const localFile=url.pathname==='/local/runtime-ui.js'?path.join(root,'local/runtime-ui.js'):null;
   const base=path.join(root,'web'),file=localFile??path.resolve(base,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));if(!localFile&&!file.startsWith(base+path.sep))return send(res,{error:'Caminho inválido'},403);
   let bytes=fs.readFileSync(file);const mime={'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.txt':'text/plain'};
   if(file===path.join(base,'index.html'))bytes=Buffer.from(bytes.toString().replace('</head>','<script>window.__TREND_LAB_LOCAL__=true;</script><script type="module" src="/local/runtime-ui.js"></script></head>'));
   res.writeHead(200,{'content-type':mime[path.extname(file)]??'application/octet-stream','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'same-origin'});res.end(req.method==='HEAD'?null:bytes);
  }catch(e){if(!res.headersSent)send(res,{error:e.code==='ENOENT'?'Arquivo não encontrado':e.message},e.code==='ENOENT'?404:503);else res.end();}
 });
 return {server,runtime,db,async listen(){await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});port=server.address().port;if(autoStart)await runtime.start();log('Local: http://127.0.0.1:'+port);return port;},async close(){const closed=new Promise(resolve=>server.close(resolve));await runtime.close();await closed;db.close();}};
}
