export function averagePredictions(replicas){
 if(!replicas.length)throw Error('Sem réplicas');
 return [...new Set(replicas.map(r=>r.config.id))].map(id=>{
  const a=replicas.filter(r=>r.config.id===id),first=a[0];
  for(const r of a)if(r.trainEnd!==first.trainEnd||r.validationEnd!==first.validationEnd||r.maxTrainLabelAvailableAt>=r.trainEnd)throw Error('Corte de informação incorreto');
  const average=key=>{
   if(!a.every(r=>r[key].length===first[key].length))throw Error('Sementes desalinhadas');
   return first[key].map(([at],i)=>{if(!a.every(r=>r[key][i][0]===at&&Number.isFinite(r[key][i][1])&&r[key][i][1]>=0&&r[key][i][1]<=1))throw Error('Sementes desalinhadas ou score inválido');return[at,a.reduce((n,r)=>n+r[key][i][1],0)/a.length];});
  };
  const spread=first.validation.reduce((n,_,i)=>{const values=a.map(r=>r.validation[i][1]);return n+Math.max(...values)-Math.min(...values);},0)/first.validation.length;
  return{...first,id:first.family+'-'+first.fold+'-'+id,replicas:a.length,meanValidationSeedRange:spread,validation:average('validation'),test:average('test')};
 });
}
export function rankTrials(trials,configs){return trials.filter(t=>t.eligible).sort((a,b)=>b.robustUSDT-a.robustUSDT||a.threshold-b.threshold||configs.findIndex(c=>c.id===a.configId)-configs.findIndex(c=>c.id===b.configId));}
export function approvedTrial(chosen,controls){return chosen.threshold>0&&chosen.stressPnL>0&&chosen.robustUSDT>Math.min(controls.base.pnlUSDT,controls.stress.pnlUSDT);}
