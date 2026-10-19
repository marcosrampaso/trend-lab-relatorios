// Public market data only. Account credentials are never sent to Binance.
export async function collectMarket(status,{fetcher=fetch,now=Date.now()}={}){
 const H=3600000,Q=H/4,run=status?.run,requests=[];
 async function get(url){const r=await fetcher(url,{signal:AbortSignal.timeout(25000)});if(!r.ok)throw Error('Binance pública: HTTP '+r.status);const data=await r.json();requests.push({url,data});return data;}
 const hour=Math.floor(now/H)*H,start=run?.start??Math.ceil((now+1)/H)*H,end=Math.min(Math.floor(now/Q)*Q,run?.end??Infinity);
 const jobs=[get(`https://fapi.binance.com/fapi/v1/klines?symbol=ETHUSDT&interval=1h&startTime=${Math.max(0,Math.min(start-300*H,hour-300*H))}&endTime=${Math.min(hour,run?.end??Infinity)-1}&limit=1500`)];
 if(!run)jobs.push(get('https://fapi.binance.com/fapi/v1/exchangeInfo'));
 if(run&&end>start){jobs.push(get(`https://fapi.binance.com/fapi/v1/fundingRate?symbol=ETHUSDT&startTime=${start}&endTime=${end-1}&limit=1000`));for(const kind of ['klines','markPriceKlines'])jobs.push((async()=>{for(let cursor=start;cursor<end;){const a=await get(`https://fapi.binance.com/fapi/v1/${kind}?symbol=ETHUSDT&interval=15m&startTime=${cursor}&endTime=${end-1}&limit=1000`);if(!Array.isArray(a)||!a.length)throw Error('Sem candles públicos suficientes');const next=Number(a.at(-1)[0])+Q;if(next<=cursor)throw Error('Paginação inválida');cursor=next;}})());}
 await Promise.all(jobs);return {collectedAt:new Date().toISOString(),requests};
}
export async function captureFromDevice({fetcher=fetch,headers={},origin='.'}={}){
 const statusResponse=await fetcher(origin+'/api/forward',{headers,cache:'no-store',redirect:'error'});if(!statusResponse.ok)throw Error('Registro privado indisponível');const status=await statusResponse.json(),market=await collectMarket(status,{fetcher});return fetcher(origin+'/api/forward',{method:'POST',headers:{...headers,'content-type':'application/json','x-trend-lab-writer':'forward-v1'},body:JSON.stringify({market}),redirect:'error'});
}
