import fs from 'node:fs';import{createHash}from'node:crypto';
import{simulate,HOUR}from'../web/engine.js';import{prepareFamily}from'../web/tree-ml.js';
const read=p=>JSON.parse(fs.readFileSync(p)),hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const p=read('tree-protocol.json'),f=read('tree-freeze.json'),strategy=read(p.strategyProtocol),data=read(p.source);
for(const[file,expected]of Object.entries({...f.preservedFiles,'tree-protocol.json':f.protocolSHA256}))if(hash(file)!==expected)throw Error('Arquivo preservado alterado: '+file);
const groups={},excluded={};
for(const family of p.families){
  if(family.id==='donchian'){groups[family.id]=read('web/data/ml-samples.json').samples;excluded[family.id]=read('web/data/ml-samples.json').excluded;continue;}
  const prepared=prepareFamily(data,p,strategy,family),signals=prepared.bars.filter(b=>b.ready&&b.cross);
  const samples=[],skip={warmup:0,incompleteHorizon:0,notExecutable:0},index=new Map(data.candles.map((r,i)=>[r[0],i]));
  for(const b of signals){
    if(b.at<Date.parse(p.train.start)){skip.warmup++;continue;}
    const available=b.at+p.label.availableAfterHours*HOUR,offset=index.get(b.at),feature=prepared.features.get(b.at);
    if(offset===undefined||available>data.candles.at(-1)[0]+HOUR){skip.incompleteHorizon++;continue;}
    if(!feature){skip.warmup++;continue;}
    const end=offset+p.label.availableAfterHours;
    const slice={...data,candles:data.candles.slice(offset,end),marks:data.marks.slice(offset,end),funding:data.funding.filter(r=>r[0]>=b.at&&r[0]<available)};
    const candidates=signals.filter(s=>s.at>=b.at&&s.at<available&&(s.at===b.at||s.cross!==b.cross))
      .map(s=>({at:s.at,side:s.cross,price:s.close,atr:s.atr,fast:s.fast,slow:s.slow,...(family.engine==='reversion'?{mean:s.mean}:{})}));
    const cost=strategy.costCases.find(x=>x.id===p.label.costCase);
    const r=simulate(slice,{start:b.at,until:available,strategy:family.engine,maxHoldHours:family.maxHoldHours,
      stopATR:family.stopATR,targetR:family.targetR,cooldownHours:family.cooldownHours,config:{capitalBRL:strategy.capitalBRL,fx:strategy.fx,
        risk:strategy.risk,leverage:strategy.leverage,fee:cost.fee,slippage:cost.slippage,dailyLimit:strategy.dailyLimit,totalLimit:strategy.totalLimit},
      registeredSignals:new Map(candidates.map(s=>[s.at,s])),closeAtEnd:true});
    const t=r.trades.find(t=>t.signalAt===b.at&&t.entryAt===b.at);if(!t){skip.notExecutable++;continue;}
    samples.push({...feature,y:t.net>0?1:0,netUSDT:t.net,netR:t.net/t.plannedRisk,labelAvailableAt:available,exitAt:t.exitAt,reason:t.reason});
  }
  groups[family.id]=samples;excluded[family.id]=skip;
}
const output='web/data/tree-samples.json',prior=fs.existsSync(output)?read(output):null;
const report={generatedAt:prior?.generatedAt??new Date().toISOString(),protocolSHA256:f.protocolSHA256,groups,excluded};const bytes=JSON.stringify(report);
if(f.samplesSHA256){if(createHash('sha256').update(bytes).digest('hex')!==f.samplesSHA256||hash(output)!==f.samplesSHA256)throw Error('Amostras divergentes, não sobrescritas');}else fs.writeFileSync(output,bytes);
console.log(JSON.stringify({samples:Object.fromEntries(Object.entries(groups).map(([id,a])=>[id,a.length])),excluded}));
