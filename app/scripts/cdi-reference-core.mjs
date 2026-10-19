export const DAY=86400000;
export function cdiReference(rates,start,end,capital){
 if(![start,end,capital].every(Number.isFinite)||end<start||!(capital>0))throw Error('Invalid CDI window/capital');
 const first=Math.ceil(start/DAY)*DAY,last=Math.floor(end/DAY)*DAY,base={start,end,initialBRL:capital,convention:'Somente diasUTC completos; início parcial excluído; taxa creditada ao fim do dia, sem rateio intradiário.',beforeTaxes:true,curve:[{at:start,brl:capital}]};
 if(last<=first)return {...base,available:true,comparable:false,status:end===start?'not-started':'no-complete-day',finalBRL:capital,pnlBRL:0,returnPct:0,observations:0,reason:'Ainda não há dia completo para acumular CDI; percentual do CDI não calculado.'};
 const months=new Set();for(let t=first;t<last;t+=DAY)months.add(new Date(t).toISOString().slice(0,7));const verified=new Set(rates.checks.filter(c=>c.verified).map(c=>c.month)),complete=[...months].every(m=>verified.has(m));
 const selected=rates.daily.filter(r=>Date.parse(r.date+'T00:00:00Z')>=first&&Date.parse(r.date+'T00:00:00Z')<last),seen=new Set();let factor=1;
 for(const r of selected){const at=Date.parse(r.date+'T00:00:00Z');if(!Number.isFinite(at)||seen.has(r.date)||!Number.isFinite(r.value)||r.value<0||r.value>=5)throw Error('Invalid/duplicate CDI observation');seen.add(r.date);factor*=1+r.value/100;base.curve.push({at:at+DAY,brl:capital*factor});}
 const finalBRL=capital*factor;if(!selected.length&&!complete)return {...base,available:false,comparable:false,status:'unavailable',reason:'Sem taxa diária publicada para a janela; sem estimativa.',finalBRL:null,pnlBRL:null,returnPct:null,observations:0};
 if(complete&&last>first)base.curve.push({at:last,brl:finalBRL});return {...base,available:true,comparable:complete,status:complete?'verified':'provisional',finalBRL,pnlBRL:finalBRL-capital,returnPct:factor-1,observations:selected.length,lastRateDate:selected.at(-1)?.date??null,reason:complete?'Taxas diárias reconciliadas com os acumulados mensais oficiais.':'CDI parcial publicado; mês ainda sem reconciliação final ou cobertura incompleta. Sem ranking ou extrapolação.',requestedFullDayEnd:last};
}
export function compareCDI(scenario,reference){
 const comparable=reference.available&&reference.comparable,returnPct=scenario.pnlBRL/scenario.capitalBRL;
 return {...scenario,benchmark:reference,returnPct,excessCDIBRL:comparable?scenario.pnlBRL-reference.pnlBRL:null,excessCDIPoints:comparable?(returnPct-reference.returnPct)*100:null,percentOfCDI:comparable&&reference.returnPct>0?returnPct/reference.returnPct*100:null};
}
