const time=v=>typeof v==='number'?v:Date.parse(v),DAY=86400000;
export function compactCurve(input,capital,fx=1,start,end){
 const days=new Map();for(const p of input??[]){const at=p.at??p.time,brl=p.brl??p.value*fx;if(!Number.isFinite(at)||!Number.isFinite(brl)||at<start||at>end)continue;days.set(Math.floor((at-1)/DAY),{at,brl});}return [{at:start,brl:capital},...days.values()].sort((a,b)=>a.at-b.at);
}
export function publishedScenarios(documents){
 const out=[];const add=(group,file,key,label,symbol,cost,start,end,capital,pnl,curve=[],fx=1,health='historical')=>{
  if(![start,end,capital,pnl].every(Number.isFinite)||end<start||capital<=0)return;
  const normalized=compactCurve(curve,capital,fx,start,end);
  out.push({id:group+':'+key,group,sourceFile:file,label,symbol,cost,start,end,capitalBRL:capital,pnlBRL:pnl,finalBRL:capital+pnl,health,hasCurve:normalized.some(p=>p.at>start),curve:normalized});
 };
 for(const[file,d]of Object.entries(documents)){
  const key=file.replace(/\.json$/,'');
  if(key==='donchian-lab-study'){for(const s of d.results??[])add(key,file,s.id,s.label+' · '+s.stage+' · '+s.blockId,s.symbol,s.cost,s.start,s.end,s.initialBRL,s.pnlBRL,s.curve);continue;}
  if(['multiasset-history','daytrade-integrated-history','btc-context-study'].includes(key)){
   for(const [i,s]of d.results.entries())add(key,file,i,[s.label??s.arm??'ETH G151',s.variant??'controle'].join(' · '),s.symbol??'ETHUSDT',s.cost,d.start,d.end,s.initialBRL,s.pnlBRL,s.equity);continue;
  }
  if(['multiasset-forward','daytrade-integrated-forward'].includes(key)){
   const p=d.registration?.protocol;if(!p)continue;for(const a of d.arms??[])for(const s of a.scenarios??[]){const end=s.equity?.at(-1)?.at??p.start;add(key,file,a.id+'/'+s.variant+'/'+s.cost,[a.label??a.id,s.variant].join(' · '),a.symbol,s.cost,p.start,end,s.initialBRL,s.pnlBRL,s.equity,1,d.status);}continue;
  }
  if(['news-filter-v1','g151-news-filter-v1'].includes(key)){
   const p=d.registration?.protocol;if(!p)continue;const fx=p.config.fx;for(const s of d.scenarios??[])add(key,file,s.variant+'/'+s.cost,(key.startsWith('g151')?'G151':'Rompimento1h')+' · '+s.variant,'ETHUSDT',s.cost,p.start,s.equity?.at(-1)?.at??p.start,s.initial*fx,s.pnlBRL,s.equity,1,d.status);continue;
  }
  if(key==='compound-benchmark-results'){
   for(const b of d.blocks??[])for(const cost of ['base','stress']){const s=b[cost];if(s)add(key,file,b.fold+'/'+cost,'Genética · bloco '+b.fold,'ETHUSDT',cost,b.start,b.end,b.initialBRL,s.profitBRL,s.curve);}continue;
  }
  const p=d.protocol??{},original=d.originalProtocol??{},periods=p.periods??original.periods??[],fx=p.fx??original.fx??d.baseConfig?.fx??5;
  for(const [i,s]of (d.scenarios??[]).entries()){
   const period=periods.find(x=>x.id===s.period),start=time(s.start??period?.start),end=time(s.end??period?.end),capital=s.initialUSDT!=null?s.initialUSDT*fx:p.capitalBRL??original.capitalBRL??d.baseConfig?.capitalBRL;
   add('legacy',file,key+'/'+i,[key,s.strategy??s.variant??'tendência',s.period,s.mode??'',s.maxHoldMinutes?'prazo'+s.maxHoldMinutes+'min':'',s.risk?'risco'+100*s.risk+'%':''].filter(Boolean).join(' · '),'ETHUSDT',s.costCase??s.cost,start,end,capital,s.pnlUSDT*fx,s.curve,fx);
  }
 }return out;
}
