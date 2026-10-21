export const money=v=>Number.isFinite(v)?v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'—';
export const percent=v=>Number.isFinite(v)?(v*100).toFixed(2)+'%':'—';
export const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function plot(host,series,{label='Resultado por geração',time=false}={}){
 const all=series.flatMap(s=>s.points).filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y));if(!all.length){host.textContent='Aguardando avaliações concluídas.';return;}
 const W=960,H=320,L=100,R=22,T=25,B=45,x0=Math.min(...all.map(p=>p.x)),x1=Math.max(x0+1,...all.map(p=>p.x)),low=Math.min(...all.map(p=>p.y)),high=Math.max(...all.map(p=>p.y)),margin=Math.max(3,(high-low)*.12),y0=low-margin,y1=high+margin,X=x=>L+(x-x0)/(x1-x0)*(W-L-R),Y=y=>T+(y1-y)/(y1-y0)*(H-T-B);let s='';
 for(let i=0;i<4;i++){const y=y0+(y1-y0)*i/3;s+=`<line x1="${L}" x2="${W-R}" y1="${Y(y)}" y2="${Y(y)}" stroke="#34485e"/><text x="${L-9}" y="${Y(y)+5}" text-anchor="end" fill="#b2c3d8" font-size="13">${esc(money(y))}</text>`;}
 for(let i=0;i<3;i++){const x=x0+(x1-x0)*i/2,txt=time?new Date(x).toLocaleDateString('pt-BR',{timeZone:'UTC'}):Math.round(x).toLocaleString('pt-BR')+' passos';s+=`<text x="${X(x)}" y="${H-13}" text-anchor="${i===0?'start':i===2?'end':'middle'}" fill="#b2c3d8" font-size="13">${esc(txt)}</text>`;}
 for(const line of series){const pts=line.points.filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y));if(!pts.length)continue;s+=`<path fill="none" stroke="${line.color}" stroke-width="2.8" d="${pts.map((p,i)=>(i?'L':'M')+X(p.x)+','+Y(p.y)).join(' ')}"/>`;for(const p of pts)s+=`<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="2.6" fill="${line.color}"><title>${esc(line.name)} · ${time?new Date(p.x).toISOString().slice(0,10):p.x.toLocaleString('pt-BR')+' passos'}: ${esc(money(p.y))}</title></circle>`;}
 host.innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">${s}</svg>`;
}
