export const REGIMES=['trend','range','volatile'];
export function regimeFor(feature,genome){
 if(!feature||feature.hourlyAt>feature.at||feature.fourHourlyAt>feature.at||feature.x.length!==12||!feature.x.every(Number.isFinite))return null;
 const x=feature.x;
 if(x[2]>=genome.volatilityCut)return 'volatile';
 if(x[6]!==0&&x[6]===x[7]&&(Math.abs(x[8])+Math.abs(x[9]))/2>=genome.trendCut)return 'trend';
 return 'range';
}
export function routedSignals(input,featureMaps,genome,predictions,{start,end,final=false}={}){
 const result=[];
 for(const family of ['cross','vwap','bands'])for(const sig of input[family]){
  if(sig.at<start||sig.at>=end)continue;
  const feature=featureMaps[family].get(sig.at),regime=regimeFor(feature,genome),arm=regime?genome.routes[regime]:null;
  const active=arm&&arm.family===family;
  const score=active&&arm.threshold>0?predictions.get(family+'/'+arm.hold)?.get(sig.at):null;
  result.push({...sig,family,regime,knownAt:sig.at,holdMinutes:active?arm.hold:30,entryAllowed:Boolean(active&&(arm.threshold===0||Number.isFinite(score)&&score>=arm.threshold))});
 }
 return result.sort((a,b)=>a.at-b.at||a.family.localeCompare(b.family));
}
