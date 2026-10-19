export function costRatio(signal,config,stopATR=1.5){
 const cost=signal.price*(2*config.fee+2*config.slippage+config.fundingReserve);
 return cost>0?signal.atr*stopATR/cost:Infinity;
}
export function volatilityVeto(signal,config,minimum=4){return costRatio(signal,config)>=minimum?null:'Amplitude insuficiente em relação ao custo';}
export function newsAt(news,time){return news.filter(n=>Number.isFinite(Date.parse(n.availableAt))&&Date.parse(n.availableAt)<=time&&time<Date.parse(n.validUntil)).sort((a,b)=>Date.parse(b.availableAt)-Date.parse(a.availableAt))[0]??null;}
export function newsVeto(assessment,entryAt){return assessment?.risk==='high'&&Date.parse(assessment.availableAt)<=entryAt&&entryAt<Date.parse(assessment.validUntil)?'Notícia com risco alto registrado antes da entrada':null;}
