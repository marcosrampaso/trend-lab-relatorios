import {forwardApi} from './forward.js';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json;charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
export function validateAssessment(value,now=Date.now()){
 if(!value||typeof value!=='object'||!Array.isArray(value.sources)||value.sources.length>5||!['low','medium','high','unknown'].includes(value.risk)||!['positive','negative','mixed','uncertain'].includes(value.bias))throw Error('Formato da análise inválido');
 if(typeof value.summary!=='string'||value.summary.length<10||value.summary.length>1800)throw Error('Resumo inválido');
 const assessedAt=Date.parse(value.assessedAt);if(!Number.isFinite(assessedAt)||Math.abs(assessedAt-now)>3600000)throw Error('Análise deve ter sido feita na última hora');
 const sources=value.sources.map(s=>{const u=new URL(s.url);if(u.protocol!=='https:'||u.username||u.password||typeof s.title!=='string'||s.title.length>250)throw Error('Fonte inválida');const publishedAt=s.publishedAt?Date.parse(s.publishedAt):null;if(publishedAt&&publishedAt>now+300000)throw Error('Publicação futura');return {url:u.href,title:s.title,publishedAt:publishedAt?new Date(publishedAt).toISOString():null};});
 return {id:'news-'+now+'-'+crypto.randomUUID().slice(0,8),assessedAt:new Date(assessedAt).toISOString(),recordedAt:new Date(now).toISOString(),availableAt:new Date(now).toISOString(),validUntil:new Date(now+5*3600000).toISOString(),risk:value.risk,bias:value.bias,summary:value.summary,sources,sourceType:'Codex neste chat · análise do plano do usuário',execution:'research_only'};
}
export function createHandler(assets={}){return {async fetch(request,env){
 const url=new URL(request.url),pathname=url.pathname;
 if(pathname==='/api/forward')return forwardApi(request,env);
 if(pathname==='/api/news'){
  if(!env.DB)return json({error:'Armazenamento de notícias indisponível'},503);
  try{
   await env.DB.prepare('CREATE TABLE IF NOT EXISTS news_assessments (id TEXT PRIMARY KEY, available_at INTEGER NOT NULL, payload TEXT NOT NULL)').run();
   if(request.method==='GET'){
    const records=await env.DB.prepare('SELECT payload FROM news_assessments ORDER BY available_at DESC LIMIT 20').all();
    return json({updates:records.results.map(r=>JSON.parse(r.payload)),mode:'prospective',serverTime:new Date().toISOString()});
   }
   if(request.method==='POST'){
    // This endpoint relies on the confirmed owner-private Sites dispatch boundary.
    // Browser writes additionally require a same-origin custom-header JSON request.
    const origin=request.headers.get('origin');if(origin&&origin!==url.origin)return json({error:'Origem não permitida'},403);
    if(request.headers.get('x-trend-lab-writer')!=='news-v1'||!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'Cabeçalho de escrita obrigatório'},403);
    const text=await request.text();if(text.length>15000)return json({error:'Análise muito grande'},413);
    let entry;try{entry=validateAssessment(JSON.parse(text));}catch(e){return json({error:e.message},400);}
    await env.DB.prepare('INSERT INTO news_assessments (id, available_at, payload) VALUES (?, ?, ?)').bind(entry.id,Date.parse(entry.availableAt),JSON.stringify(entry)).run();
    return json({saved:entry},201);
   }
   return json({error:'Método não permitido'},405);
  }catch{return json({error:'Falha ao ler ou salvar a análise'},503);}
 }
 if(request.method!=='GET'&&request.method!=='HEAD')return new Response('Method not allowed',{status:405});
 const name=pathname==='/'?'/index.html':pathname,asset=assets[name];
 if(!asset)return new Response('Not found',{status:404});
 const headers={'content-type':asset.type,'cache-control':'no-cache','x-content-type-options':'nosniff','referrer-policy':'strict-origin-when-cross-origin'};
 let body=Uint8Array.from(atob(asset.body),c=>c.charCodeAt(0));
 if(asset.encoding==='gzip'){if(request.headers.get('accept-encoding')?.includes('gzip'))headers['content-encoding']='gzip';else body=new Response(body).body.pipeThrough(new DecompressionStream('gzip'));}
 return new Response(request.method==='HEAD'?null:body,{headers});
}};}
