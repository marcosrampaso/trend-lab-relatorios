import {createHash} from 'node:crypto';
import {monthAt,monthsBetween} from '../web/scalp-tree.js';
const stable=x=>Array.isArray(x)?x.map(stable):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,stable(x[k])])):x;
export const canonical=x=>JSON.stringify(stable(x));
export function identify(input){const {id,...g}=input;return {...g,id:createHash('sha256').update(canonical(g)).digest('hex').slice(0,20)};}
export const ym=(m,i=0)=>new Date(monthAt(m,i)).toISOString().slice(0,7);
export const months=(a,b)=>monthsBetween(new Date(monthAt(a)).toISOString(),new Date(monthAt(b)).toISOString());
export function buildFolds(available,outerStarts){
 const set=new Set(available);
 return outerStarts.map(id=>{
  const innerStart=ym(id,-13),innerEnd=ym(id,-1),outerEnd=ym(id,3)>'2026-09'?'2026-09':ym(id,3),innerMonths=months(innerStart,innerEnd),outerMonths=months(id,outerEnd);
  if([...innerMonths,...outerMonths].some(m=>!set.has(m)))throw Error('Lacuna nas janelas de validação: '+id);
  return {id,innerStart,innerEnd,gapMonth:innerEnd,outerStart:id,outerEnd,innerMonths,outerMonths,innerBlocks:[0,3,6,9].map(i=>({start:ym(innerStart,i),end:ym(innerStart,i+3)}))};
 });
}
export function fullHistoryPlan(available){
 const list=[...available].filter(m=>m<'2026-09').sort(),set=new Set(list),starts=[],covered=new Set();
 for(const id of list){
  if(covered.has(id))continue;
  if(!months(ym(id,-13),ym(id,-1)).every(m=>set.has(m)))continue;
  const end=ym(id,3)>'2026-09'?'2026-09':ym(id,3),outer=months(id,end);if(!outer.every(m=>set.has(m)))continue;
  starts.push(id);for(const m of outer)covered.add(m);
 }
 return {folds:buildFolds(list,starts),availableModelMonths:list.length,nestedMonths:covered.size,excluded:list.filter(m=>!covered.has(m)).map(month=>({month,reason:'Sem12meses internos completos e1mês de afastamento após o treino causal; somente diagnóstico anterior.'})),reserved:'2026-09'};
}
export function assertWindow(fold,phase,start,end,frozen=null){
 const a=monthAt(start),b=monthAt(end);
 if(!(a<b)||b>monthAt('2026-09'))throw Error('Janela inválida ou reserva de setembro');
 if(phase==='inner'){
  if(a<monthAt(fold.innerStart)||b>monthAt(fold.innerEnd))throw Error('Seleção tentou consultar período externo/futuro');
 }else if(phase==='outer'){
  if(start!==fold.outerStart||end!==fold.outerEnd||!frozen||frozen.fold!==fold.id||!frozen.registrationSHA256)throw Error('Avaliação externa exige escolha previamente congelada');
 }else throw Error('Fase inválida');
}
export function validateGenome(g,baseline){
 if(g.id==='cash')return;
 if(!['rf_g151','tree_d3','tree_d6','logistic_c01'].includes(g.predictor))throw Error('Preditor fora do protocolo');
 for(const k of ['algorithm','params','trainMonths'])if(canonical(g[k])!==canonical(baseline[k]))throw Error('O piloto não altera o preditor herdado');
 if(![.0025,.005,.01,.02,.03,.05,.1,.15,.2].includes(g.risk)||![1,2,5,10,15,20].includes(g.leverage))throw Error('Exposição fora do espaço autorizado');
 if(!(g.trendCut>=.2&&g.trendCut<=3&&g.volatilityCut>=.0004&&g.volatilityCut<=.006))throw Error('Corte inválido');
 for(const key of ['trend','volatile','range']){const a=g.routes[key];if(!a||!(a.threshold>=.2&&a.threshold<=.8)||!(a.family===null||a.family==='cross'&&a.hold===120||a.family==='bands'&&a.hold===240))throw Error('Rota sem modelo/rótulo correspondente');}
 if(identify(g).id!==g.id)throw Error('Genoma alterado');
}
export function assess(blocks,criteria){
 if(blocks.length!==4)throw Error('Exige quatro blocos internos');
 const sum=k=>blocks.reduce((n,b)=>n+b[k].pnlBRL,0),count=k=>blocks.reduce((n,b)=>n+b[k].count,0);
 if(blocks.some(b=>!b.cdi.available))throw Error('CDI ausente não equivale a zero');
 const excess=blocks.map(b=>Math.min(b.base.pnlBRL,b.stress.pnlBRL)-b.cdi.profitBRL).sort((a,b)=>a-b);
 const maxDD=Math.max(...blocks.flatMap(b=>[b.base.maxDD,b.stress.maxDD])),rejections=[];
 if(Math.min(count('base'),count('stress'))<criteria.minimumTrades)rejections.push('Amostra insuficiente');
 if(blocks.some(b=>Math.min(b.base.count,b.stress.count)<criteria.minimumTradesPerBlock))rejections.push('Poucas operações em um ou mais trimestres');
 if(Math.min(sum('base'),sum('stress'))<=0)rejections.push('Resultado líquido não positivo');
 if(excess.reduce((n,v)=>n+v,0)<=0)rejections.push('Não supera CDI agregado');
 if(excess.filter(v=>v>0).length<criteria.minimumBlocksAboveCDI)rejections.push('Não supera CDI em pelo menos três trimestres');
 if(maxDD>criteria.maximumDrawdown)rejections.push('Drawdown acima do limite');
 if(blocks.some(b=>b.base.halted||b.stress.halted))rejections.push('Parada global de risco');
 return {eligible:!rejections.length,rejections,baseBRL:sum('base'),stressBRL:sum('stress'),baseTrades:count('base'),stressTrades:count('stress'),maxDD,blocksAboveCDI:excess.filter(v=>v>0).length,worstQuarterExcessBRL:excess[0],medianQuarterExcessBRL:(excess[1]+excess[2])/2,meanMonthlyBRL:Math.min(sum('base'),sum('stress'))/12,meanMonthlyExcessBRL:excess.reduce((n,v)=>n+v,0)/12};
}
export function rank(a,b){return Number(b.metrics.eligible)-Number(a.metrics.eligible)||b.metrics.worstQuarterExcessBRL-a.metrics.worstQuarterExcessBRL||b.metrics.medianQuarterExcessBRL-a.metrics.medianQuarterExcessBRL||a.genome.id.localeCompare(b.genome.id);}
export function choose(candidates){const accepted=candidates.filter(c=>c.metrics.eligible).sort(rank);return accepted[0]??null;}
export function random(seed){let state=seed>>>0;return()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};}
export function mutate(parent,rng){
 const g=structuredClone(parent);delete g.id;const key=Math.floor(rng()*8),regime=['trend','volatile','range'][Math.floor(rng()*3)],a=g.routes[regime];
 if(key<3)a.threshold=Number(Math.max(.2,Math.min(.8,a.threshold+(rng()-.5)*.24)).toFixed(3));
 else if(key===3){if(rng()<.5)g.trendCut=Number(Math.max(.2,Math.min(3,g.trendCut+(rng()-.5)*1)).toFixed(3));else g.volatilityCut=Number(Math.max(.0004,Math.min(.006,g.volatilityCut*Math.exp((rng()-.5)*.8))).toFixed(6));}
 else if(key===4){const family=[null,'cross','bands'][Math.floor(rng()*3)];a.family=family;a.hold=family==='cross'?120:240;}
 else if(key===5)g.risk=[.0025,.005,.01,.02,.03,.05,.1,.15,.2][Math.floor(rng()*9)];
 else if(key===6)g.leverage=[1,2,5,10,15,20][Math.floor(rng()*6)];
 else g.predictor=['rf_g151','tree_d3','tree_d6','logistic_c01'][Math.floor(rng()*4)];
 return identify(g);
}
