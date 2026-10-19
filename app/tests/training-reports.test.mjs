import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';import path from'node:path';import{createHash}from'node:crypto';
import{escapeHTML}from'../scripts/generate-training-reports.mjs';
const dir='web/relatorios',read=f=>JSON.parse(fs.readFileSync(f)),catalog=read(dir+'/catalogo.json');
test('seis relatórios HTML mantêm dados embutidos, links locais e origem rastreável',()=>{
 assert.equal(catalog.reports.length,6);
 for(const item of catalog.reports){const report=read(dir+'/dados/'+item.id+'.json'),html=fs.readFileSync(dir+'/'+item.id+'.html','utf8');assert.deepEqual(JSON.parse(html.match(/<script type="application\/json" id="report-data">([\s\S]*?)<\/script>/)[1]),report);assert.ok(html.includes('<html lang="pt-BR">'));assert.ok(html.includes('Somente simulação'));
  for(const match of html.matchAll(/(?:href|src)="([^"#]+)"/g)){const link=match[1];if(/^(https?:|data:)/.test(link))continue;assert.ok(fs.existsSync(path.resolve(dir,link.split(/[?#]/)[0])),link);}
  for(const s of report.sources)assert.equal(createHash('sha256').update(fs.readFileSync(s.file)).digest('hex'),s.sha256);
 }
});
test('resumos monetários daCPU conferem com fontes, sem substituir escolha pelo melhor teste',()=>{
 for(const[id,file]of[['04-benchmark-cpu','local-cpu-benchmark-v1.json'],['05-treino-ampliado','work/local-ml/runs/extended-20261018-v2/evaluation.json']]){
  const report=read(dir+'/dados/'+id+'.json'),source=read(file),table=report.blocks.find(b=>b.id==='comparacao');assert.equal(table.rows.length,source.summaries.length);
  for(let i=0;i<table.rows.length;i++){assert.equal(table.rows[i].baseBRL,source.summaries[i].baseMeanUSDT*5);assert.equal(table.rows[i].stressBRL,source.summaries[i].stressMeanUSDT*5);}
  const monthly=report.blocks.find(b=>b.id==='meses');assert.equal(monthly.rows.length,63);
 }
});
test('genética conserva fitness negativo, teste positivo e todos os candidatos rejeitados',()=>{
 const r=read(dir+'/dados/06-evolucao-genetica.json'),source=read('web/data/cpu-evolution-results.json'),candidates=r.blocks.find(b=>b.id==='candidatos');assert.equal(candidates.rows.length,81);assert.ok(r.chart.groups[0].series[0].points.every(p=>p.value<0));assert.equal(r.blocks.find(b=>b.id==='teste-final').rows[0].stressBRL,source.finalTest.stress.pnlUSDT*5);assert.ok(source.finalTest.stress.pnlUSDT>0);assert.ok(candidates.rows.some(r=>r.eligible==='Não'&&r.fitnessBRL===null));assert.match(r.verdict,/dez operações/);
});
test('HTML escapa conteúdo externo antes de renderizar',()=>{assert.equal(escapeHTML('<script>"&\'</script>'),'&lt;script&gt;&quot;&amp;&#39;&lt;/script&gt;');});
