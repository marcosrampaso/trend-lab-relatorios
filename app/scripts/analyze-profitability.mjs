import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {simulate,DEFAULTS,HOUR} from '../web/engine.js';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const protocolBytes=fs.readFileSync(path.join(root,'research-protocol.json'));
const protocol=JSON.parse(protocolBytes),freeze=JSON.parse(fs.readFileSync(path.join(root,'research-freeze.json')));
const digest=crypto.createHash('sha256').update(protocolBytes).digest('hex');
if(digest!==freeze.protocolSHA256)throw Error('O protocolo mudou após o congelamento');
const dataPath=path.join(root,'web/data/eth-extended.json'),data=JSON.parse(fs.readFileSync(dataPath));
if(data.protocolSHA256!==digest)throw Error('Dados vinculados a outro protocolo');

function ciBlock(values){
  if(values.length<2)return null;
  let seed=protocol.resampling.seed>>>0;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const n=values.length,block=Math.min(protocol.resampling.blockLength,n),means=[];
  for(let b=0;b<protocol.resampling.iterations;b++){
    let sum=0,count=0;
    while(count<n){const at=Math.floor(random()*n);for(let i=0;i<block&&count<n;i++,count++)sum+=values[(at+i)%n];}
    means.push(sum/n);
  }
  means.sort((a,b)=>a-b);return {lower:means[Math.floor(means.length*.025)],upper:means[Math.floor(means.length*.975)],n,block};
}
function summarize(r,period,risk,cost){
  const wins=r.trades.filter(t=>t.net>0),losses=r.trades.filter(t=>t.net<0),sumWin=wins.reduce((s,t)=>s+t.net,0),sumLoss=-losses.reduce((s,t)=>s+t.net,0);
  const slippage=r.trades.reduce((s,t)=>s+t.slippageCost,0);
  const beforeCosts=r.trades.reduce((s,t)=>s+t.side*t.qty*(t.exitReference-t.entryReference),0);
  if(Math.abs(beforeCosts-slippage-r.fees+r.fundingNet-r.pnl)>1e-7)throw Error('Reconciliação falhou: '+period.id+'/'+risk+'/'+cost.id);
  const monthly=[];let previous=r.initial;
  for(let at=Date.parse(period.start);at<Date.parse(period.end);){
    const d=new Date(at),next=Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,1),end=Math.min(next,Date.parse(period.end));
    const points=r.equity.filter(p=>p.time>at&&p.time<=end),last=points.at(-1)?.value??previous;
    const trades=r.trades.filter(t=>t.exitAt>=at&&(t.exitAt<end||(end===r.until&&t.exitAt===end)));
    monthly.push({month:new Date(at).toISOString().slice(0,7),startUSDT:previous,finalUSDT:last,pnlUSDT:last-previous,returnPct:last/previous-1,trades:trades.length});previous=last;at=next;
  }
  const begin=data.candles.find(c=>c[0]>=r.start),last=data.candles.find(c=>c[0]+HOUR===r.until),priceRatio=last[4]/begin[1];
  const markMap=new Map(data.candles.map(c=>[c[0]+HOUR,c[4]]));
  const selected=r.equity.filter((p,i)=>i%6===0||i===r.equity.length-1);
  const stats={period:period.id,risk,costCase:cost.id,start:r.start,end:r.until,initialUSDT:r.initial,finalUSDT:r.final,pnlUSDT:r.pnl,returnPct:r.returnPct,maxDrawdown:r.maxDD,
    count:r.trades.length,winRate:r.trades.length?wins.length/r.trades.length:null,profitFactor:sumLoss>0?sumWin/sumLoss:null,noLosingTrades:losses.length===0,
    expectancyUSDT:r.trades.length?r.pnl/r.trades.length:null,expectancyInterval:ciBlock(r.trades.map(t=>t.net)),feesUSDT:r.fees,fundingUSDT:r.fundingNet,
    slippageUSDT:slippage,beforeCostsUSDT:beforeCosts,rejected:r.rejected,signals:r.signals.length,liquidations:r.liquidations,halted:r.halted,
    haltAt:r.haltAt,
    pendingAtEnd:!!r.pending,monthly,trades:r.trades,
    curve:selected.map(p=>({time:p.time,value:p.value,reference:r.initial*markMap.get(p.time)/begin[1]})),referenceReturn:priceRatio-1,
    verdict:r.trades.length===0?'Sem operações: não demonstra rentabilidade.':r.returnPct>0?'Resultado histórico positivo; vantagem futura não comprovada.':'Resultado histórico negativo ou nulo: rentabilidade não demonstrada.'};
  return stats;
}
const scenarios=[];
for(const period of protocol.periods){for(const risk of protocol.risks){for(const cost of protocol.costCases){
  const r=simulate(data,{start:Date.parse(period.start),until:Date.parse(period.end),config:{risk,fee:cost.fee,slippage:cost.slippage},closeAtEnd:true});
  scenarios.push(summarize(r,period,risk,cost));
}}}
const result={schemaVersion:1,generatedAt:new Date().toISOString(),protocol,freeze,protocolSHA256:digest,datasetSHA256:crypto.createHash('sha256').update(fs.readFileSync(dataPath)).digest('hex'),
  data:{symbol:data.symbol,start:data.candles[0][0],end:data.candles.at(-1)[0]+HOUR,candles:data.candles.length,fundingEvents:data.funding.length,files:data.sources.length,repairs:data.repairs,filters:data.filters,filtersAsOf:data.filtersAsOf,retrievedAt:data.retrievedAt},
  baseConfig:DEFAULTS,scenarios,limitations:[
    'Backtest simulado, sem operações reais e sem garantia de retorno futuro.',
    'Câmbio fixo hipotético de R$5/USDT: resultados BRL não reconstroem variação cambial.',
    'Filtros atuais de negociação retroativos; manutenção aproximada de 0,5%, sem faixas da conta ou taxa específica de liquidação.',
    'Execução e queda máxima usam resolução de uma hora; não há ticks nem livro de ofertas.',
    'Funding no início da hora pertence à posição anterior; ordem exata em eventos simultâneos é aproximada.',
    'Cenários independentes reiniciam R$300; seus retornos não devem ser somados. O cenário contínuo mantém o saldo e os limites.',
    'Custos de conversão/saque, infraestrutura e tributos não foram incluídos. Valores líquidos referem-se a custos de negociação modelados, antes de impostos.',
    'Intervalo por reamostragem descreve a amostra histórica; não é intervalo de previsão de lucros futuros.',
    'Referência ETH1x é variação bruta do preço do perpétuo, sem custos ou funding e com risco diferente; não representa um investimento executável.',
    'Não houve ajuste dos parâmetros nesta rodada. Resultados negativos permanecem publicados.'
  ]};
fs.writeFileSync(path.join(root,'web/data/profitability.json'),JSON.stringify(result));
console.log(JSON.stringify(scenarios.filter(s=>s.costCase==='base').map(s=>({period:s.period,risk:s.risk,finalBRL:s.finalUSDT*DEFAULTS.fx,pnlBRL:s.pnlUSDT*DEFAULTS.fx,returnPct:s.returnPct,trades:s.count,drawdown:s.maxDrawdown,rejected:s.rejected,halted:s.halted})),null,2));
