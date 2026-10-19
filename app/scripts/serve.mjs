import {createLocalServer} from '../local/server.mjs';
const app=createLocalServer();let closing=false;
for(const sig of ['SIGINT','SIGTERM'])process.on(sig,async()=>{if(closing)return;closing=true;await app.close();process.exit(0);});
try{await app.listen();}catch(e){console.error(e.code==='EADDRINUSE'?'A porta4173 já está em uso. Use npm run local:status.':e.message);app.db.close();process.exitCode=1;}
