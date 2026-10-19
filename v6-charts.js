export const escapeHTML=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
export const money=v=>Number.isFinite(v)?v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'—';
export function lineChart(series,{label,xLabel='Geração',time=false,reference=0}={}){
 const valid=series.filter(s=>s.points?.length),all=valid.flatMap(s=>s.points).filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y));if(!all.length)return '<p class="note">Aguardando uma geração completa.</p>';
 const xmin=Math.min(...all.map(p=>p.x)),xmax=Math.max(xmin+1,...all.map(p=>p.x)),values=all.map(p=>p.y),low=Math.min(reference,...values),high=Math.max(reference,...values),pad=Math.max(1,(high-low)*.13),min=low-pad,max=high+pad;
 const x=v=>86+(v-xmin)/(xmax-xmin)*610,y=v=>235-(v-min)/(max-min)*200,fmtX=v=>time?new Date(v).toISOString().slice(0,10):'G'+v;
 let svg=`<svg viewBox="0 0 740 295" role="img" aria-label="${escapeHTML(label)}"><title>${escapeHTML(label)}</title>`;
 for(let i=0;i<5;i++){const v=min+(max-min)*i/4;svg+=`<line x1="86" x2="696" y1="${y(v)}" y2="${y(v)}" stroke="#293647"/><text x="76" y="${y(v)+4}" text-anchor="end" fill="#9aabbe" font-size="11">${escapeHTML(money(v))}</text>`;}
 svg+=`<line x1="86" x2="696" y1="${y(reference)}" y2="${y(reference)}" stroke="#8391a2" stroke-dasharray="4 5"/>`;
 for(const s of valid){const points=s.points.filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y));svg+=`<polyline points="${points.map(p=>x(p.x)+','+y(p.y)).join(' ')}" fill="none" stroke="${s.color}" stroke-width="2.5" stroke-linejoin="round"/>`;for(const p of points)svg+=`<circle cx="${x(p.x)}" cy="${y(p.y)}" r="${time?2:4}" fill="${s.color}"><title>${escapeHTML(s.label)} · ${fmtX(p.x)} · ${escapeHTML(money(p.y))}</title></circle>`;}
 svg+=`<text x="86" y="262" fill="#9aabbe" font-size="12">${fmtX(xmin)}</text><text x="696" y="262" text-anchor="end" fill="#9aabbe" font-size="12">${fmtX(Math.max(...all.map(p=>p.x)))}</text><text x="390" y="287" text-anchor="middle" fill="#9aabbe" font-size="11">${escapeHTML(xLabel)}</text></svg>`;
 return `<div class="v6-chart" tabindex="0">${svg}</div><div class="v6-legend">${valid.map(s=>`<span><i style="background:${s.color}"></i>${escapeHTML(s.label)} · ${escapeHTML(money(s.points.at(-1).y))}</span>`).join('')}</div>`;
}
export function profitBars(folds){
 if(!folds.length)return '<p>Aguardando avaliações externas.</p>';
 const colors=['#f0b46b','#91a4d7','#76cdb1'],labels=['Decisão V6','G151 fixo','CDI'],values=folds.flatMap(f=>[f.outer.selected.stress.pnlBRL,f.outer.baseline.stress.pnlBRL,f.outer.selected.cdi.profitBRL]);const low=Math.min(0,...values),high=Math.max(0,...values),pad=Math.max(2,(high-low)*.12),min=low-pad,max=high+pad,y=v=>215-(v-min)/(max-min)*185,slot=610/folds.length,width=Math.min(15,slot/4);
 let svg='<svg viewBox="0 0 740 285" role="img" aria-label="Lucro ou prejuízo por janela externa com custos dobrados"><title>Lucro ou prejuízo por janela externa, com R$ 1.000 reiniciados em cada janela</title>';
 for(let i=0;i<5;i++){const v=min+(max-min)*i/4;svg+=`<line x1="86" x2="696" y1="${y(v)}" y2="${y(v)}" stroke="#293647"/><text x="76" y="${y(v)+4}" text-anchor="end" fill="#9aabbe" font-size="11">${escapeHTML(money(v))}</text>`;}
 svg+=`<line x1="86" x2="696" y1="${y(0)}" y2="${y(0)}" stroke="#8391a2"/>`;
 folds.forEach((f,i)=>{const vals=[f.outer.selected.stress.pnlBRL,f.outer.baseline.stress.pnlBRL,f.outer.selected.cdi.profitBRL];vals.forEach((v,j)=>{const cx=86+slot*(i+.5)+(j-1)*(width+2);svg+=`<rect x="${cx-width/2}" y="${Math.min(y(v),y(0))}" width="${width}" height="${Math.max(1,Math.abs(y(v)-y(0)))}" fill="${colors[j]}"><title>${f.fold.id} · ${labels[j]} · ${money(v)}</title></rect>`;});svg+=`<text x="${86+slot*(i+.5)}" y="235" transform="rotate(-35 ${86+slot*(i+.5)} 235)" text-anchor="end" fill="#9aabbe" font-size="10">${f.fold.id}</text>`;});
 return `<div class="v6-chart" tabindex="0">${svg}</svg></div><div class="v6-legend">${labels.map((s,i)=>`<span><i style="background:${colors[i]}"></i>${s}</span>`).join('')}</div>`;
}
