const names={no_filter:'Controle sem filtro',constant:'Referência constante',logistic:'Regressão logística',tree:'Árvore de decisão',random_forest:'Random Forest',extra_trees:'Extra Trees',hist_boosting:'Gradient boosting',mlp:'Rede neural MLP',selected_by_validation:'Escolha pela validação',cash_policy:'Política com opção de caixa'};
const states={preparing:'Preparando exemplos por prazo',training:'Treinando modelos',evaluating:'Avaliando carteiras e custos',completed:'Comparação concluída',stopped:'Interrompido · checkpoints salvos',time_limit:'Limite de tempo · checkpoints salvos',failed:'Falha · consulte o log local'};
import{installEvolutionUI}from'./cpu-evolution-ui.js';
export function installCPUTraining({root,money,num,download}){
 let status,result,busy=false,active=false;
 const panel=document.createElement('article');panel.className='panel prose cpu-training';
 panel.innerHTML=`<span class="eyebrow">TREINAMENTO NA SUA MÁQUINA · CPU</span><h2>Comparação local de modelos</h2><p><a class="button secondary" href="./evolucao/index.html">Acompanhar genética adaptativa · R$ 1.000 ↗</a></p><p><a class="button secondary" href="./relatorios/index.html">Ver relatórios de todos os treinos ↗</a></p>
 <p id="cpu-training-state" role="status">Consultando o treinamento local…</p>
 <progress id="cpu-training-progress" max="1" value="0" aria-label="Modelos treinados"></progress>
 <p id="cpu-training-detail" class="small-copy"></p><p id="cpu-training-time" class="micro"></p><p id="cpu-last-task" class="micro"></p>
 <p id="cpu-method" class="micro">9 meses de treino → 3 de validação → 3 de teste. Sinais de5min, contexto1h/4h e operações de até30min. O score filtra entradas de cada estratégia; o motor mantém os limites de risco.</p>
 <details id="cpu-results"><summary>Revelar comparação histórica dos modelos · consulta resultados futuros do replay</summary>
 <p id="cpu-results-note"></p><p id="cpu-model-warnings" class="micro"></p><label for="cpu-family">ESTRATÉGIA</label><select id="cpu-family"><option value="bands">Bollinger + RSI</option><option value="cross">EMA9/21</option><option value="vwap">VWAP + volume</option></select>
 <div class="table-scroll"><table><thead><tr><th>MODELO / POLÍTICA</th><th>MÉDIA/MÊS · BASE</th><th>MÉDIA/MÊS · CUSTOS2×</th><th>MESES POSITIVOS ·2×</th><th>OPERAÇÕES ·2×</th></tr></thead><tbody id="cpu-comparison"></tbody></table></div>
 <p id="cpu-results-verdict"></p><p class="micro">Cada mês reiniciaR$300. Média mensal não é retorno composto. Meses já estudados: pesquisa exploratória, sem novo teste intocado. Caixa rende zero neste simulador. Melhorar a perda do controle não demonstra rentabilidade.</p>
 <button id="cpu-export" class="button subtle">Exportar comparação ↓</button></details>
 <p class="micro">No terminal do projeto: <code>npm run ml:status</code> · <code>npm run ml:stop</code> · <code>npm run ml:resume</code>. Os modelos desta comparação ficam salvos para pesquisa; o replay histórico continua usando a árvore da rodada anterior.</p>`;
 root.firstElementChild.after(panel);const $=s=>panel.querySelector(s),evolution=installEvolutionUI({panel,money,download});
 function renderResults(){
  const current=result&&result.runId===status?.runId;$('#cpu-results').hidden=!current;if(!current)return;
  const family=$('#cpu-family').value,rows=result.summaries.filter(s=>s.family===family);
  $('#cpu-results-note').textContent=(result.quick?'Teste rápido de funcionamento. ':'Avaliação completa. ')+result.taskCount+' ajustes · '+(rows[0]?.months??0)+' meses posteriores · '+result.runId+'.';
  const warnings=(result.stability??[]).flatMap(s=>s.warnings);$('#cpu-model-warnings').textContent=warnings.length?warnings.length+' avisos de convergência registrados. As redes que atingiram o limite de iterações continuam identificadas no relatório; seus scores exigem cautela.':'Sem avisos de convergência registrados nesta rodada.';
  $('#cpu-comparison').replaceChildren();for(const row of rows){const tr=document.createElement('tr');for(const value of [names[row.algorithm]??row.algorithm,money(row.baseMeanUSDT*5),money(row.stressMeanUSDT*5),row.positiveStressMonths+'/'+row.months,row.stressTrades]){const td=document.createElement('td');td.textContent=value;tr.append(td);}$('#cpu-comparison').append(tr);}
  const decisions=result.selection.filter(s=>s.family===family),accepted=decisions.filter(s=>s.approved).length;
  $('#cpu-results-verdict').textContent=accepted?accepted+' de '+decisions.length+' cortes aprovaram um filtro na validação anterior. Confira o resultado posterior e os custos; aprovação retrospectiva não é autorização para operar.':'Nenhum corte aprovou um filtro com resultado positivo e superior ao controle sob custos dobrados. A política ficou em caixa.';
 }
 async function refresh(){
  if(busy)return;busy=true;
  try{
   const response=await fetch('./data/cpu-training-status.json',{cache:'no-store'});
   if(!response.ok){$('#cpu-training-state').textContent='Nenhum treinamento local registrado.';return;}
   status=await response.json();const labeling=status.state==='preparing',evaluating=status.mode==='extended'&&status.state==='evaluating';
   const completed=labeling?(status.labelCompleted??0):evaluating?status.evaluationCompleted:status.completed,total=labeling?(status.labelTotal??99):evaluating?status.evaluationTotal:status.total;
   $('#cpu-training-state').textContent=(states[status.state]??status.state)+' · '+completed+'/'+total+(labeling?' meses/prazos':evaluating?' avaliações':' ajustes');
   $('#cpu-training-progress').max=total;$('#cpu-training-progress').value=completed;
   $('#cpu-training-detail').textContent='Até '+status.workers+' processos · '+status.threadsPerWorker+' thread por processo · perfil '+status.profile+' · '+status.failed+' falhas · '+status.runId;
   $('#cpu-last-task').textContent=labeling?'Preparação:1 processo · prazo '+(status.labelHold??'—')+'min · mês '+(status.labelMonth??'—'):status.lastCompleted?'Último ajuste salvo: '+status.lastCompleted+' · '+(status.skipped??0)+' omitidos por dados insuficientes · '+(status.warnings??0)+' avisos.':'';
   $('#cpu-method').textContent=status.mode==='extended'?'Rodada ampliada:3 estratégias · 7 algoritmos · prazos30/60/120/240min · treino6/9/12 meses +3 de validação → mês seguinte. Seleção conjunta de prazo, janela e modelo usa apenas a validação anterior. Rótulos próprios por prazo, contexto fechado1h/4h e custos2×. Os estudos anteriores permanecem preservados.':'9 meses de treino → 3 de validação → 3 de teste. Sinais de5min, contexto1h/4h e operações de até30min. O score filtra entradas de cada estratégia; o motor mantém os limites de risco.';
   const fmt=t=>new Date(t).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'});
   $('#cpu-training-time').textContent='Atualizado '+fmt(status.updatedAt)+' · limite '+fmt(status.deadlineAt)+'. O treino para ao terminar, mesmo antes desse horário.';
   if(status.state==='completed'&&result?.runId!==status.runId){const r=await fetch('./data/cpu-training-results.json',{cache:'no-store'});if(r.ok)result=await r.json();}
   renderResults();await evolution.refresh();
  }catch{$('#cpu-training-state').textContent='Não foi possível consultar o treinamento. Verifique npm run ml:status.';}finally{busy=false;}
 }
 $('#cpu-family').onchange=renderResults;$('#cpu-export').onclick=()=>result&&download('trend-lab-comparacao-cpu.json',JSON.stringify(result,null,2),'application/json');
 $('#cpu-results').hidden=true;
 window.addEventListener('trend-view-change',e=>{active=e.detail.view==='scalping';if(active)refresh();});
 setInterval(()=>{if(active&&!document.hidden)refresh();},5000);
 return{show(){active=true;refresh();}};
}
