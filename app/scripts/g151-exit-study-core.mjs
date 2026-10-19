export const POLICIES=[
 {id:'original',name:'G151 original',noClock:false,protectMode:'off',exitMode:'single'},
 {id:'no-clock',name:'Sem prazo · alvo original',noClock:true,protectMode:'off',exitMode:'single'},
 {id:'breakeven',name:'Proteção dos custos após 1R',noClock:true,protectMode:'breakeven',protectActivationR:1,exitMode:'single'},
 {id:'trail-1',name:'Trailing 1 ATR após 1R',noClock:true,protectMode:'trail',trailATR:1,protectActivationR:1,exitMode:'single'},
 {id:'trail-2',name:'Trailing 2 ATR após 1R',noClock:true,protectMode:'trail',trailATR:2,protectActivationR:1,exitMode:'single'},
 {id:'split-be',name:'50% no meio do alvo + proteção',noClock:true,protectMode:'breakeven',exitMode:'split',partialFraction:.5,firstTargetFraction:.5},
 {id:'split-trail',name:'50% no meio do alvo + trailing 2 ATR',noClock:true,protectMode:'trail',trailATR:2,exitMode:'split',partialFraction:.5,firstTargetFraction:.5},
 {id:'runner',name:'50% no alvo + restante com trailing',noClock:true,protectMode:'trail',trailATR:2,exitMode:'split',partialFraction:.5,firstTargetFraction:1,runner:true}
];
export function configure(policy,protocol,signals){return{protocol:{...protocol,...policy},signals:signals.map(s=>({...s,holdMinutes:policy.noClock?null:s.holdMinutes}))};}
export function aggregate(rows){
 const sum=k=>rows.reduce((n,r)=>n+(r[k]??0),0);
 return{months:rows.length,monthlyBRL:sum('pnlBRL')/rows.length,netBRL:sum('pnlBRL'),count:sum('count'),maxDD:Math.max(0,...rows.map(r=>r.maxDD)),positiveMonths:rows.filter(r=>r.pnlBRL>0).length,feesBRL:sum('feesBRL'),slippageBRL:sum('slippageBRL'),fundingBRL:sum('fundingBRL'),partialExits:sum('partialExits'),stopMoves:sum('stopMoves'),protectedPositions:sum('protectedPositions'),boundaryExits:sum('boundaryExits')};
}
export function pairedDifferences(rows,control){
 const deltas=rows.map(r=>r.pnlBRL-control.find(c=>c.month===r.month).pnlBRL),mean=deltas.reduce((a,b)=>a+b,0)/deltas.length;
 // Descriptive normal interval, not proof: temporal months need not be independent.
 const variance=deltas.length>1?deltas.reduce((n,d)=>n+(d-mean)**2,0)/(deltas.length-1):0,se=Math.sqrt(variance/deltas.length);
 return{meanBRL:mean,improvedMonths:deltas.filter(d=>d>1e-8).length,worseMonths:deltas.filter(d=>d< -1e-8).length,equalMonths:deltas.filter(d=>Math.abs(d)<=1e-8).length,descriptive95:[mean-1.96*se,mean+1.96*se],independenceAssumed:false};
}
// ATR14 Wilder on complete 5m bars, released at close. Never consumes future bars.
export function atrContexts(five){let previous,atr,seed=0;return five.map((r,i)=>{const tr=Math.max(r[2]-r[3],previous===undefined?0:Math.abs(r[2]-previous),previous===undefined?0:Math.abs(r[3]-previous));if(i<14){seed+=tr;if(i===13)atr=seed/14;}else atr=(atr*13+tr)/14;previous=r[4];return{at:r[0]+300000,knownAt:r[0]+300000,atr};}).filter(r=>r.atr>0);}
