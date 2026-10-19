export function tradeStats(trades,fx=5){
 const sum=fn=>trades.reduce((n,t)=>n+fn(t)*fx,0),net=sum(t=>t.net),fees=sum(t=>t.entryFee+t.exitFee),funding=sum(t=>t.funding),slippage=sum(t=>t.slippageCost),executedGross=sum(t=>t.gross),referenceGross=executedGross+slippage;
 if(Math.abs(referenceGross-slippage-fees+funding-net)>1e-7)throw Error('Custos não reconciliados');
 const ordered=trades.map(t=>t.net*fx).sort((a,b)=>b-a),wins=ordered.filter(x=>x>0),losses=ordered.filter(x=>x<0),winSum=wins.reduce((a,b)=>a+b,0),lossSum=-losses.reduce((a,b)=>a+b,0);
 return{count:trades.length,net,fees,funding,slippage,executedGross,referenceGross,wins:wins.length,losses:losses.length,winRate:trades.length?wins.length/trades.length:null,expectancy:trades.length?net/trades.length:null,profitFactor:lossSum?winSum/lossSum:null,avgMinutes:trades.length?trades.reduce((n,t)=>n+(t.exitAt-t.entryAt)/60000,0)/trades.length:null,best:ordered[0]??null,worst:ordered.at(-1)??null,withoutBest:net-(ordered[0]??0),withoutTop3:net-ordered.slice(0,3).reduce((a,b)=>a+b,0)};
}
export function groupTrades(trades,key,fx=5){const groups=new Map();for(const t of trades){const k=key(t);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(t);}return[...groups].map(([label,rows])=>({label,...tradeStats(rows,fx)}));}
export function saoPauloHour(timestamp){return Number(new Intl.DateTimeFormat('en-GB',{timeZone:'America/Sao_Paulo',hour:'2-digit',hourCycle:'h23'}).format(timestamp));}
export function behaviorSignature(row){return JSON.stringify(row.metrics.flatMap(b=>(b.months??[]).map(m=>[m.month,...['base','stress'].flatMap(c=>['pnlUSDT','count','maxDD'].map(k=>Math.round(m[c][k]*1e8)/1e8))])));}
