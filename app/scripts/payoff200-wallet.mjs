// One shared wallet process avoids duplicating four months of candles per ML worker.
import fs from 'node:fs';import readline from 'node:readline';import {createHash} from 'node:crypto';import {ROOT,read,hash} from './multiasset-io.mjs';import {Market} from './exit-lab-core.mjs';import {monthlyWallet} from './protection-gate-core.mjs';import {cdiReference} from './cdi-reference-core.mjs';
const base=ROOT+'/work/pepe-payoff-genetic-200-v1',p=read(base+'/protocol.json'),rates=read('work/pepe-exits-v1/rates.json');
class CachedMarket extends Market{constructor(){super();this.all=new Map();}packet(t){const key=new Date(t).toISOString().slice(0,7);if(!this.all.has(key))this.all.set(key,super.packet(t));return this.all.get(key);}}
const market=new CachedMarket(),memory=new Map();
function wallet(month,entries){const m=[...p.selectionMonths,...p.auditMonths].find(m=>m.month===month);if(!m)throw Error('Unregistered calendar');const key=createHash('sha256').update(JSON.stringify({protocol:hash(base+'/protocol.json'),month,entries})).digest('hex'),file=base+'/wallet-cache/'+key+'.json';
 if(memory.has(key))return memory.get(key);if(fs.existsSync(file)){const v=read(file);memory.set(key,v);return v;}
 const rows=entries.map(e=>({atr:e.atr,trade:{entryAt:e.at,side:e.side,leverage:p.engine.leverage}}));
 const w=monthlyWallet(m,rows,p.engine,market),cdi=cdiReference(rates,m.start,m.end,p.engine.capitalBRL);if(!cdi.comparable)throw Error('CDI unavailable');const value={...w,cdi};fs.writeFileSync(file,JSON.stringify(value),{flag:'wx',mode:0o444});memory.set(key,value);return value;
}
const rl=readline.createInterface({input:process.stdin,terminal:false});for await(const line of rl){try{const q=JSON.parse(line);let result;
 if(q.parity){const old=read('work/pepe-minute-protection-v1/result.json'),signals=read('work/pepe-r-ladder-v1/signals.json')['genetic-151'];let count=0;for(const m of p.auditMonths){const w=wallet(m.month,signals[m.month].map(e=>({at:e.trade.entryAt,side:e.trade.side,atr:e.atr}))),expected=old.wallets['genetic-151'].current.wallets.find(v=>v.month===m.month);for(const[k,v]of Object.entries(w))if(JSON.stringify(v)!==JSON.stringify(expected[k]))throw Error('Wallet parity '+m.month+' '+k);count++;}result={parity:count};}
 else result=q.folds.map(f=>wallet(f.month,f.entries));console.log(JSON.stringify({ok:true,result}));
 }catch(e){console.log(JSON.stringify({ok:false,error:e.message}));}}
