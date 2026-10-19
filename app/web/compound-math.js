const DAY=86400000;
export function parseBCB(rows){
 if(!Array.isArray(rows))throw Error('Série BCB inválida');
 const seen=new Set();return rows.map(r=>{const m=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(r.data??'');if(!m)throw Error('Data BCB inválida');const date=m[3]+'-'+m[2]+'-'+m[1],value=Number(String(r.valor).replace(',','.'));if(!Number.isFinite(value)||seen.has(date)||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date)throw Error('Observação BCB inválida');seen.add(date);return{date,value};}).sort((a,b)=>a.date.localeCompare(b.date));
}
export function cdiWindow(daily,monthly,start,end,capital=1000){
 const first=new Date(start).toISOString().slice(0,10),last=new Date(end).toISOString().slice(0,10),days=daily.filter(r=>r.date>=first&&r.date<last),monthlyMap=new Map(monthly.map(r=>[r.date.slice(0,7),r.value])),months=[];
 for(let t=start;t<end;){const d=new Date(t);months.push(d.toISOString().slice(0,7));t=Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,1);}
 const checks=months.map(month=>{const a=days.filter(r=>r.date.startsWith(month)),calculatedPct=(a.reduce((f,r)=>f*(1+r.value/100),1)-1)*100,publishedPct=monthlyMap.get(month),valid=a.length>=15&&a.every(r=>r.value>=0&&r.value<5)&&Number.isFinite(publishedPct)&&Math.abs(calculatedPct-publishedPct)<=.0055;return{month,count:a.length,calculatedPct,publishedPct:publishedPct??null,valid};});
 if(!checks.length||checks.some(c=>!c.valid))return{available:false,reason:'Séries CDI incompletas ou divergentes; sem estimativa ou preenchimento.',checks,curve:[]};
 const map=new Map(days.map(r=>[r.date,r.value]));let balance=capital;const curve=[{time:start,value:capital}];
 for(let t=start;t<end;t+=DAY){const date=new Date(t).toISOString().slice(0,10);if(map.has(date))balance*=1+map.get(date)/100;curve.push({time:t+DAY,value:balance});}
 return{available:true,initialBRL:capital,finalBRL:balance,profitBRL:balance-capital,returnPct:balance/capital-1,observations:days.length,checks,curve};
}
export function dailyEquity(equity,start,initial,fx=1){
 const map=new Map();for(const p of equity){const day=new Date(p.time-1).toISOString().slice(0,10);map.set(day,{time:Date.parse(day+'T00:00:00Z')+DAY,value:p.value*fx});}return[{time:start,value:initial*fx},...map.values()];
}
export function monthlyEquity(equity,start,end,initial,fx=1){
 let index=0,last=initial;const rows=[];for(let at=start;at<end;){const d=new Date(at),next=Math.min(end,Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,1)),begin=last;while(index<equity.length&&equity[index].time<=next){last=equity[index].value;index++;}rows.push({month:d.toISOString().slice(0,7),initialBRL:begin*fx,finalBRL:last*fx,profitBRL:(last-begin)*fx,returnPct:last/begin-1});at=next;}return rows;
}
