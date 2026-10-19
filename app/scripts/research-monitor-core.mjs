export const terminalStates = new Set(['completed','stopped','time_limit','disk_limit','failed']);
export function dueEvents(state, report, terminal=false) {
 const end=report.history.at(-1)?.generation??state.anchorGeneration, out=[];
 const push=(kind,generation,extra={})=>out.push({id:`${report.runId}:${kind}:${generation}`,kind,generation,...extra});
 for(const h of report.history)if(h.generation>state.anchorGeneration&&h.generation<=end&&h.improved)push('record',h.generation,{monthlyBRL:h.bestValidationMonthlyBRL});
 for(let g=state.anchorGeneration+25;g<=end;g+=25)push('checkpoint',g);
 for(let g=state.anchorGeneration+50;g<=end;g+=50)push('report',g,{from:g-49});
 for(let g=state.anchorGeneration+100;g<=end;g+=100)push('full-history',g);
 if(terminal)push('terminal',end);
 const known=new Set(state.events.map(e=>e.id));return out.filter(e=>!known.has(e.id)).sort((a,b)=>a.generation-b.generation||a.kind.localeCompare(b.kind));
}
export function winnerAt(report, generation, loadScores, initial) {
 const h=report.history.find(h=>h.generation===generation);if(!h)throw Error('Geração ainda não concluída');
 if(report.generation===generation&&Math.abs(report.winner.fitnessUSDT*5-h.bestValidationMonthlyBRL)<1e-8)return report.winner;
 const rows=loadScores(generation).candidates, winner=rows.filter(c=>c.eligible&&Math.abs(c.fitnessUSDT*5-h.bestValidationMonthlyBRL)<1e-8).sort((a,b)=>(b.fitnessUSDT-a.fitnessUSDT)||(a.maxDD-b.maxDD)||(b.positiveMonths-a.positiveMonths))[0];
 if(winner)return winner;
 // A carried champion may not be re-evaluated in a generation. Its original scored record is authoritative.
 for(const previous of [...report.history].reverse())if(previous.generation<generation&&previous.improved&&Math.abs(previous.bestValidationMonthlyBRL-h.bestValidationMonthlyBRL)<1e-8)return winnerAt(report,previous.generation,loadScores,initial);
 if(initial&&Math.abs(initial.fitnessUSDT*5-h.bestValidationMonthlyBRL)<1e-8)return initial;
 throw Error('Campeão histórico não encontrado; não substituir pelo campeão futuro');
}
export function parameterChanges(before,after,prefix='') {
 const changes=[];
 for(const k of new Set([...Object.keys(before??{}),...Object.keys(after??{})])) {
  if(k==='id')continue;const a=before?.[k],b=after?.[k],key=prefix?`${prefix}.${k}`:k;
  if(a&&b&&typeof a==='object'&&typeof b==='object')changes.push(...parameterChanges(a,b,key));
  else if(JSON.stringify(a)!==JSON.stringify(b))changes.push({parameter:key,before:a??null,after:b??null});
 }return changes;
}
export function budgetDecision(budget, primary, now=Date.now()) {
 if(!primary||primary.windowDurationMins!==300||!Number.isFinite(primary.usedPercent))return {allowed:false,reason:'Limite de 5h indisponível',budget};
 let b=budget;
 // A shifted reset timestamp in the same real window must not reset the baseline.
 if(!b||Math.abs(primary.resetsAt-b.resetsAt)>120&&now>=b.resetsAt*1000)b={resetsAt:primary.resetsAt,baseline:primary.usedPercent};
 const additional=Math.max(0,primary.usedPercent-b.baseline);
 return {allowed:primary.usedPercent<90&&additional<17,reason:primary.usedPercent>=90?'Menos de 10% disponíveis':additional>=17?'Parada preventiva: 17 pontos percentuais adicionais':'Disponível',budget:b,additional};
}
export function canAttemptReview(state){return !state.bridge?.disabled&&state.events.some(e=>e.delivery==='pending');}
