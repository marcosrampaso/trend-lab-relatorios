import fs from 'node:fs';
import {ROOT,read,hash} from './multiasset-io.mjs';
import {Market} from './exit-lab-core.mjs';
import {SPECIALISTS,featureInput,candidateOutcome,candleFeatures} from './specialist-core.mjs';
const base=ROOT+'/'+SPECIALISTS,p=read(base+'/protocol.json'),month=p.months.find(m=>m.month===process.argv[2]);
if(!month)throw Error('Unregistered month');const file=base+'/labels/'+month.month+'.json';
if(fs.existsSync(file))throw Error('Labels already frozen');
const market=new Market(),packet=market.packet(month.start);
// Use timestamps modulo milliseconds, never candle array index (gaps would change cadence).
const grid=packet.features.filter(f=>f.at>=month.start+300000&&f.at<month.end&&f.at%(p.candidateMinutes*60000)===0);
const contexts=market.contexts(month.start,month.end),rows=[];
for(const original of grid){
  const idx=(original.at-packet.start)/60000;
  const f=candleFeatures(original,packet.candles.slice(idx-5,idx));
  const x=featureInput(f,f.at);
  if(month.split==='evaluation')rows.push({at:f.at,x,atr:f.atr,close:f.close});
  else for(const side of[1,-1])rows.push({at:f.at,x,side,...candidateOutcome(f,side,month.end,p.engine,market,contexts)});
  if(rows.length%400===0)console.log(JSON.stringify({month:month.month,rows:rows.length}));
}
fs.writeFileSync(file,JSON.stringify({month:month.month,split:month.split,start:month.start,end:month.end,
  registrationSHA256:hash(base+'/registration.json'),rows}),{flag:'wx',mode:0o444});
console.log(JSON.stringify({month:month.month,rows:rows.length,complete:true}));
