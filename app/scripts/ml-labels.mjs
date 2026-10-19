import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {simulate,HOUR} from '../web/engine.js';
import {prepareML} from '../web/ml.js';
const read=p=>JSON.parse(fs.readFileSync(p)),hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const protocol=read('ml-protocol.json'),freeze=read('ml-freeze.json');
for(const[file,expected]of Object.entries({...freeze.preservedFiles,'ml-protocol.json':freeze.protocolSHA256}))if(hash(file)!==expected)throw Error('Arquivo preservado alterado: '+file);
const strategy=read(protocol.strategyProtocol),data=read(protocol.source),prepared=prepareML(data,protocol,strategy);
const samples=[],excluded={warmup:0,incompleteHorizon:0,notExecutable:0};
const index=new Map(data.candles.map((r,i)=>[r[0],i]));
const signals=prepared.bars.filter(b=>b.ready&&b.cross);
for(const b of signals){
  if(b.at<Date.parse(protocol.train.start)){excluded.warmup++;continue;}
  const available=b.at+protocol.label.availableAfterHours*HOUR;
  const offset=index.get(b.at),feature=prepared.features.get(b.at);
  if(offset===undefined||available>data.candles.at(-1)[0]+HOUR){excluded.incompleteHorizon++;continue;}
  if(!feature){excluded.warmup++;continue;}
  const end=offset+protocol.label.availableAfterHours;
  const slice={...data,candles:data.candles.slice(offset,end),marks:data.marks.slice(offset,end),
    funding:data.funding.filter(r=>r[0]>=b.at&&r[0]<available)};
  const candidates=signals.filter(s=>s.at>=b.at&&s.at<available&&(s.at===b.at||s.cross!==b.cross))
    .map(s=>({at:s.at,side:s.cross,price:s.close,atr:s.atr,fast:s.fast,slow:s.slow}));
  const cost=strategy.costCases.find(x=>x.id===protocol.label.costCase);
  const r=simulate(slice,{start:b.at,until:available,strategy:'breakout',maxHoldHours:strategy.maxHoldHours,
    stopATR:strategy.stopATR,targetR:strategy.targetR,cooldownHours:strategy.cooldownHours,
    config:{capitalBRL:strategy.capitalBRL,fx:strategy.fx,risk:strategy.risk,leverage:strategy.leverage,
      fee:cost.fee,slippage:cost.slippage,dailyLimit:strategy.dailyLimit,totalLimit:strategy.totalLimit},
    registeredSignals:new Map(candidates.map(s=>[s.at,s])),closeAtEnd:true});
  const t=r.trades.find(t=>t.signalAt===b.at&&t.entryAt===b.at);
  if(!t){excluded.notExecutable++;continue;}
  samples.push({...feature,y:t.net>0?1:0,netUSDT:t.net,netR:t.net/t.plannedRisk,
    labelAvailableAt:available,exitAt:t.exitAt,reason:t.reason});
}
const target='web/data/ml-samples.json',prior=fs.existsSync(target)?read(target):null;
const report={generatedAt:prior?.generatedAt??new Date().toISOString(),protocolSHA256:freeze.protocolSHA256,
  sourceSHA256:hash(protocol.source),features:protocol.features,excluded,samples};
const bytes=JSON.stringify(report);
if(freeze.samplesSHA256){if(createHash('sha256').update(bytes).digest('hex')!==freeze.samplesSHA256||hash(target)!==freeze.samplesSHA256)throw Error('Amostras divergentes; não foram sobrescritas');}
else fs.writeFileSync(target,bytes);
console.log(JSON.stringify({samples:samples.length,excluded,positiveRate:samples.reduce((n,s)=>n+s.y,0)/samples.length}));
