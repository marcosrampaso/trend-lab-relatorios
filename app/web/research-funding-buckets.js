// Research-only handling of actual funding timestamps. No rates are synthesized.
// Exactly aligned payments precede opening actions; subminute payments follow
// opening actions and precede intrabar stops/targets. Intraminute ordering and
// mark price at the exact millisecond cannot be reconstructed from 1m candles.
export function fundingBuckets(rows,start,end){
 const before=new Map(),after=new Map(),seen=new Set();
 for(const [at,rate] of rows??[]){
  if(!Number.isSafeInteger(at)||!Number.isFinite(rate)||seen.has(at))throw Error('Funding inválido ou duplicado');seen.add(at);
  if(at<start||at>=end)continue;
  const minute=Math.floor(at/60000)*60000,target=at===minute?before:after;
  if(before.has(minute)||after.has(minute))throw Error('Mais de um funding no mesmo instante de aplicação');target.set(minute,rate);
 }
 return {before,after};
}
