# Revisões autônomas do treino

Autorização do usuário em18/10/2026: manter o treino e fazer ajustes necessários com autonomia. Atualização posterior: SUBSTITUIR revisões por horário por eventos a cada25novas gerações ou novo recorde. A automação de30min está PAUSADA. O monitor local semIA detecta eventos e agrupa os pendentes numa única revisão neste chat pelo App Server oficial; se houver chat ocupado, cota indisponível ou consumo adicional de17pontos, adiar sem perder eventos. Publicar um relatório a cada50novas gerações com hipóteses, mudanças, razões e resultados. A cada100novas gerações, fazer diagnóstico no histórico compatível completo e comparar com100% doCDI. Site local e repositório privado `marcosrampaso/trend-lab-relatorios` autorizados; nenhuma ordem real.

## Referência e execução

Checkout: `/Users/marcosbezner/Documents/Codex/2026-10-16/fi/outputs/trend-lab`. Ler `AGENTS.md` e `work/research-monitor/state.json` primeiro. As cadências são contadas da geração concluída registrada em `anchorGeneration`, sem reiniciar contadores em uma continuação. O primeiro relatório cobre exatamente as50gerações seguintes. Revisões sem resultado material ficam registradas, sem avisos repetidos ao usuário.

Conferir `node scripts/local-adaptive.mjs status`, horário de atualização, logs, progresso de ajustes, falhas, diversidade dos pais/comportamentos, espaço livre e `pmset -g assertions`. Não confundir ausência de melhora no fitness com processo travado. Um ajuste lento isolado ou avisos de convergência não bastam para reiniciar. Se for falha real, corrigir causa e retomar checkpoint no prazo original; nunca duplicar processo.

Prazo original da campanha:19/10/2026 13:24:30 emSãoPaulo. Não estender automaticamente nem resetar orçamento de24h. Ao terminar por prazo,1000gerações ou limite de disco, gerar relatório final parcial e conclusão, preservar artefatos e encerrar esta rotina. O processoPython e `caffeinate` já estão ativos; não reiniciar o servidor ou alterar preferências de repouso globais.

## Investigar e ajustar

Registrar cada hipótese ANTES do cálculo: identificador, evidência, uma pergunta específica, variante/controle, métricas, cobertura, critérios e orçamento de tentativas. Aplicar uma mudança por vez quando possível. No relatório seguinte, retomar a hipótese pelo mesmo identificador, dizer o que foi aplicado, resultados base/dobrados, operações, drawdown, duração e conclusão: melhorou, piorou, inconclusivo ou não executado. Nunca inventar aplicação, conclusão ou melhora.

Primeira hipótese proposta: separar trailing de invalidaçãoEMA5min. A rodada `work/adaptive-exit-study/20261018T192330480Z` mostrou34 de47operações encerradas pela invalidação; não demonstra que trailing sozinho é ruim. Registrar uma nova ablação com o mesmo campeão congelado, custos e dados: retirar somente a invalidação, mantendo a regra de trailing comparável. Preservar os resultados negativos anteriores. A ablação de30entradas também foi pior e não deve ser promovida sem nova evidência.

Não repetir rodadas idênticas apenas para procurar um resultado positivo. Até uma nova hipótese principal por ciclo de50gerações; estudos curtos em um processo/thread para não lançar outra campanha longa concorrente. Ajustes operacionais comprovados podem ocorrer nas revisões intermediárias e precisam de registro.

Pode corrigir bugs, investigar gargalos, registrar experimentos e criar nova versão da busca quando houver motivo verificável. Nunca editar arquivos cujo hash esteja registrado na campanha ativa: copiar/versionar, testar controle e preservar linhagem, geração, prazos e checkpoints. Só incorporar política nova após comparação reproduzível, critérios originais de cobertura/risco e custos2×; não promover por lucro isolado maior se a comparação mudou o denominador. Saídas novas exigem novos rótulos maduros antes de treinar um modelo que as escolha; não reutilizar rótulos antigos alegando aprendizado de saídas dinâmicas.

CapitalR$1.000, risco1%, alavancagem10× e limites de perda preservados. Sem chaves, ordens reais, gastos, API paga, redução de custos modelados para fabricar lucro ou relaxamento de critérios para aprovar um candidato. O teste final de setembro/2026 da genética permanece reservado até o congelamento previsto; relatórios intermediários devem identificar sua exclusão e sua cobertura real.

## A cada100gerações

Congelar o candidato do marco e avaliar com treino temporal apenas no passado, no histórico1min íntegro disponível, com mark price e funding correspondentes. Mostrar início/fim dos dados, período de treino/aquecimento, início/fim efetivamente negociado e lacunas; não trocar execução1min por1h nem preencher preços artificialmente. Não treinar no histórico inteiro e medir sobre os mesmos exemplos como prova independente. Preservar a janela final reservada até o término da campanha.

Comparar100%CDI diário oficial no MESMO intervalo e capital, reinvestimento dentro de intervalos contínuos, custos/funding do bot, antes de impostos e câmbio hipotético identificado. As séries brutas doBCB republicadas noIpeadata já estão em `data/cdi/*-raw.json`; normalizar cobertura ampliada em pasta NOVA, sem sobrescrever a comparação congelada. Conferir produto diário com acumulado mensal, sem juros extras em fins de semana. Fonte ausente fica indisponível, nunca zero.

O histórico horário instalado começa em2020; o histórico1min inicial tem34meses, dez/2023–set/2026. O usuário autorizou ampliar candles1min e mark price em pasta independente; quantidade confirmada: mais48meses, total alvo82, de dezembro/2019 a setembro/2026. A coleta foi iniciada em pasta separada; consultar web/data/history-expansion-status.json e data/scalp-tree-extended/manifest.json para cobertura real. Meses ausentes/incompletos não são interpolados nem contam como cobertos. Não prometer “provar cinco anos”: mostrar somente o que foi realmente coberto e os limites do backtest. Se os dados não estiverem íntegros, registrar diagnóstico como pendente/incompleto e não alegar execução.

## Relatórios, uso e publicação

Usar `scripts/research-monitor.mjs` para status, registros e relatórios quando disponível. Estado e eventos em `work/research-monitor/`; páginas em `web/pesquisa-genetica/acompanhamento/`. Incluir campeão inicial/final, ganho de fitness, quantidade de candidatos, diversidade, erros, alterações de código/protocolo, hipóteses antigas e novas e links para evidências. Separar fatos, interpretações e planos.

Atualizar o índice local e a cópia privada noGitHub somente com HTML/CSS/JS/JSON/CSV e documentação do relatório. Preservar hashes e commits; nunca subir `.local/`, credenciais, caches, históricos brutos ou modelos binários. A publicação é de relatórios, não do site hospedado. Verificar leitura após gravar e commit remoto após envio.

Consultar limites do plano antes de pesquisa nova; se houver menos de10% na janela de5h ou indisponibilidade, manter treino semIA, registrar adiamento de pesquisa e evitar chamadas caras. Não comprar créditos. A automação de notícias é separada e conserva seu orçamento próprio. Avisar somente ao publicar um relatório de50/100gerações, ao concluir ou em falha que exija ação. Não há garantia de melhora; perdas e platôs devem ser relatados honestamente.

## Contrato dos eventos

O monitor não consome tokens para observar arquivos e gerar HTML. Mantém a âncora79: avisos104/129/154…, relatórios129/179…, diagnóstico179/279…. Cada recorde também gera HTML próprio, sem esperar50gerações. Entrega agrupada, uma revisão de cada vez; não iniciar outra se o último turno persistido ainda não foi concluído. O primeiro recebimento deve registrar que o ping realmente chegou; verificar o recibo antes de declarar entrega comprovada. Falha de entrega fica explícita, nunca é tratada como sucesso. Não criar chamada periódica de IA como alternativa.

Estado state.json é de propriedade do monitor: a revisão deve LER e criar um JSON novo em work/research-monitor/reviews/ com eventIds, recordedAt, facts, hypotheses, changes e evidence. Não editar state.json durante o loop, para evitar concorrência. Hipóteses e ajustes são incorporados à próxima apresentação como revisões auditáveis. Corrigir infra se houver erro comprovado. Se um estudo demorar, iniciar um processo separado registrado e retornar; não ficar esperando gerações.

Nos marcos100 o monitor congela o vencedor daquele marco e abre uma tarefa de histórico completo; isso NÃO significa que o backtest já foi executado. A revisão deve construir/executar a avaliação temporal com a nova base e registrar saídas reprodutíveis, ou explicar o bloqueio no relatório. Não publicar como sucesso um trabalho apenas enfileirado. Notícias continuam na automação separada. O canal de eventos usa o login ChatGPT local e nunca compra créditos nem utiliza chave deAPI.

## Falha de entrega confirmada em18/10 às20:15 (SãoPaulo)

Todas as tentativas receberam `already has an active writer` ao retomar este chat pelo processo externo. Nenhuma revisão automática foi entregue; consultar metadados não comprova capacidade de envio. O canal foi desativado no estado do monitor e não deve ser reativado sem uma integração suportada e um teste real de recebimento. Não remover locks, contornar exclusividade do aplicativo ou voltar à pesquisa periódica comIA contra o pedido do usuário. Os relatórios locais e a genética continuam semIA. O diagnóstico ampliadoG179 ficou pendente e não foi executado. Revisão manual de status registrada em work/research-monitor/reviews/20261018T2315-status.json.

## Nova campanha V4 autorizada após limpeza

O usuário pediu limpar os artefatos descartáveis, salvar o campeão deR$18,40 (G151) e iniciar novos testes com ele naG0. O resgate foi verificado e está em champions/g151-c6cb2a8370cd058b0be0 e noZIP deoutputs; G0 reproduziu exatamente18.402207221636612. O protocolo novo é adaptive-search-v4-protocol.json, com prazo próprio de24h, até1000gerações adicionais, mesmos riscos/custos/dados de seleção. Consultar a registration.json da campanha atual, sem herdar a data-limite antiga. Os arquivos registrados das campanhas antigas não foram editados; modelos/predições descartados têm registro de limpeza.

A nova âncora é0: avisos25/50/75…, relatórios50/100…, diagnósticos100/200…. O estado anterior e os relatórios estão arquivados. A falha conhecida de envio para este chat continua bloqueada; não reativar canal nem criar polling comIA. O monitor local gera os relatórios semIA. A rotina de avaliação do histórico ampliado não passa a ser executada só por reiniciar a campanha e segue explicitamente pendente até haver evidência.

G1 tem61ablações registradas e3imigrantes. Pistas seguintes preservam diversidade, com mais foco local. Separar melhorias históricas observadas de novas hipóteses: não há significância estatística demonstrada por35operações. Variantes de saída e30indicadores que foram piores não são promovidas. O cacheV4 recicla modelos/predições não protegidos após cada geração acima de6GiB, buscando4GiB, conservandoG0, campeão e12pais; parâmetros/sementes e scores de todas as gerações ficam registrados.
