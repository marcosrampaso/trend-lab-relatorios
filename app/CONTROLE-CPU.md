# Controle de CPU da V3

O cabeçalho de todas as páginas locais oferece três modos:

- **Leve**: um worker, duas threads de cálculo.
- **Turbo**: três workers, duas threads por worker.
- **Ultra · 12h**: até cinco workers, duas threads por worker: até dez threads de cálculo nos dez núcleos do Mac. Não são 1.000 processos simultâneos; os 250 agentes continuam na mesma fila.

O Ultra tem prazo de 12 horas por ativação explícita. Quando expira, os trabalhos em andamento terminam e a capacidade volta ao modo leve. A pesquisa continua enquanto seu orçamento original permitir; não se promete concluir 1.000 gerações durante a noite. Pressão de memória reduz a capacidade para três workers abaixo de 20% de memória disponível, ou um abaixo de 12%. Se a consulta de memória falhar, limita a três. Esses limiares são proteções operacionais, não estimativas de desempenho.

## Continuidade e registro

O adaptador `scripts/run-pepe-mask-ultra.py` importa o coordenador original e reutiliza seu treino, trabalhadores, checkpoints, recibos, ranking e evolução. O protocolo científico original permanece em três workers como registro histórico; a concorrência operacional efetiva aparece separadamente em `executionRuntime`/`runtime`. A emenda operacional em `work/pepe-finrl-mask-v3/runtime-config.json` registra o hash do adaptador e da inscrição original; cópias do estado anterior e hashes dos resultados já concluídos ficam em `runtime-migrations/`. Nunca se substitui a inscrição científica.

Ao implantar: geração 134 concluída e 147 trabalhos da geração 135 persistidos. A retomada ignora esses trabalhos e executa somente os restantes. Mesmos dois threads Torch por worker, passos por agente, sementes, custos, máscaras, risco, auditoria trimestral, população e seleção. Paralelismo não garante ganho proporcional de velocidade, reprodução bit a bit entre ambientes ou melhora de lucro.

O botão usa exclusivamente a API local `127.0.0.1:4175/api/mask`; consultas não escrevem. O componente confirma a identidade do serviço e não inicia nem retoma uma pesquisa pausada. Retomada explícita usa o painel V3 ou `node scripts/local-pepe-mask.mjs resume ultra`.

Ao iniciar o processo em Ultra, `caffeinate -is -w PID -t 43200` mantém o Mac acordado por até 12 horas enquanto o coordenador existir. Deixe o notebook conectado à tomada e com a tampa aberta: isso não impede suspensão por fechamento da tampa, desligamento ou falta de bateria. Nenhuma configuração permanente de energia é alterada.

## Validação

Testes do escalonador usam tarefas fictícias: cinco faixas, execução única, pausa, redução/aumento em andamento, expiração, pressão de memória e erro sem travar. Testes da interface verificam confirmação explícita, renovação, origem local e ausência de retomada automática. Os hashes científicos originais são conferidos antes da execução. Validação financeira independente permanece pendente e separada deste ajuste de recursos.
