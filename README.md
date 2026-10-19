# Trend Lab · relatórios da genética

Retrato da geração 68, gerado em 2026-10-18T19:10:58.829Z. Campeão: a5aa4a77566c08fbc23b.

Abra index.html para os testes, resumo.html para a síntese e campeao.html para o deep dive. Todas as páginas e filtros funcionam sem servidor, inclusive por arquivo local. O link para o painel ao vivo requer o Trend Lab rodando em 127.0.0.1:4173.

Os resultados são retrospectivos, nos nove meses usados na seleção. Não são validação independente, promessa de rentabilidade ou operações reais. O teste final não foi consultado.

- dados.json: snapshot completo, resultados e hashes de origem.
- operacoes.csv: livro de operações base e custos dobrados.
- styles.css e report.js: apresentação e filtros locais, sem serviço externo.

Nenhum banco privado, credencial, modelo binário ou histórico bruto foi incluído. Gerar estas páginas não inicia acompanhamento prospectivo nem altera a campanha em execução.

## Saídas e indicadores

[Saídas adaptativas e novas entradas](saidas.html) documenta uma rodada separada, com referência da geração73. Os relatórios principais continuam no retrato da geração68. [Resultados completos](saidas-dados.json) incluem as cinco variantes e os modelos comparados. Nenhuma variante foi promovida para a genética ou para ordens reais.

## Acompanhamento por eventos

[Acompanhamento local](acompanhamento/index.html): relatórios HTML por novo recorde; revisões agrupadas a cada25gerações ou ganho. Relatórios de50gerações e registro de diagnóstico a cada100, contados daG79, preservando marcos e histórico. A versão GitHub é um retrato estático; treino, cota e fila ao vivo ficam somente no computador. A primeira entrega por evento ainda precisa de recibo; o painel distingue conexão verificada de revisão realmente entregue.

O monitor lê checkpoints semIA e só aciona o Codex por evento. A rotina antiga de30min está pausada. Não há API paga nem ordens reais. Um diagnóstico de histórico enfileirado não é apresentado como teste concluído.

## Nova campanha: campeão daG151 comoG0

[Novo plano de testes](nova-campanha.html): aG0 reproduziu exatamenteR$18,402207/mês, diferença zero. A primeira geração testa61variações controladas e3candidatos exploratórios. Alterações ainda são hipóteses, com mesmo capital, risco, custos e validação. O cache agora recicla artefatos descartáveis e protegeG0, campeão atual e pais diversos.

[Campanha anterior arquivada](campanhas/search-v3-20261018T183222773Z/index.html). O campeão completo foi salvo localmente em umZIP independente antes da limpeza. Modelos descartados da rodada encerrada foram removidos com auditoria. Os históricos e a base de simulação foram preservados.

## Avaliação do G151 em outros anos · 18/10/2026

[Relatório completo](validacao-ampliada.html): 47 meses avaliados em 16 blocos, depois de aquecimento e nove meses de treino em cada trecho contínuo. Parâmetros fixos, cinco sementes, 160 modelos retreinados. Setembro/2026 não avaliado.

A auditoria detectou funding com timestamps dentro do minuto que a implementação antiga ignorava. A correção ficou em motores e rótulos separados; fontes congeladas e a genética em andamento não foram alteradas. Cinco rótulos mudaram de classe. Mesmo modelo, só corrigindo a contabilidade: R$18,402 → R$18,403/mês no controle original. Após recalcular rótulos e retreinar, esses nove meses ficaram em R$16,00/mês.

Nos 38 meses fora da seleção: -R$7,17/mês para o bot contra R$9,52 do CDI, com R$1.000 por mês e custos dobrados. No conjunto dos 47 meses: -R$2,73 contra R$9,90. Não se trata de uma carteira contínua de vários anos. O campeão não demonstrou robustez; não foi promovido.

A página contém um retrato embutido para abrir por arquivo local, além de JSON, CSV, protocolo e auditorias. Os resultados anteriores permanecem como registros históricos da implementação antiga. Os gráficos são retrospectivos; CDI e bot antes de impostos, com câmbio fixo no bot.

## Redesenho da validação e genética V6 · 19/10/2026

- [Por que mudamos a abordagem](mudanca-de-abordagem.html): avaliação temporal, correção de funding, critérios e limites da evidência.
- [V6: resultados e evolução por geração](nova-genetica.html): retrato datado embutido, abre por arquivo local. Apenas seleção e mutação, sem cruzamento. 96 novos modelos já treinados; o processo local avalia as combinações. A V4 foi parada e preservada.
- [Snapshot compacto](validacao-v6-snapshot.json), [protocolo registrado](validacao-v6-protocolo.json) e [auditoria](validacao-v6-auditoria.json).
- [54 perfis de risco/alavancagem](alocacao-historico.csv): diagnóstico de 47 meses, separado da seleção genética.
- [Histórico e gráficos](historico.html): requer o servidor local e seus dados; os candles não são publicados neste repositório.

Catálogo ampliado: 82 meses, 3.575.708 candles de 1 minuto, 12 resoluções. Há 64 minutos de mark price ausentes em três meses, explicitamente sinalizados. A V6 mantém sinais de 5 minutos e contexto de 1h/4h; o catálogo não implica que todos os intervalos foram treinados. A avaliação aninhada tem 26 meses elegíveis em 9 janelas. Todos esses dados já foram vistos anteriormente; nenhum resultado é validação independente ou autorização de operação real.

A V6 original concluiu 9 janelas e 1.296 avaliações. Os gráficos incluem evolução do líder por geração, média mensal base/dobrada, curvas de saldo, CDI, parâmetros e operações. A seção do campeão mostra o líder interno mesmo quando reprovado; ele não é automaticamente promovido.

Uma auditoria separada de estabilidade foi registrada com três sementes fixas (2026101911, 2026101912, 2026101913), sem escolher a melhor réplica. Reutiliza os 256 modelos; não faz novos ajustes dos classificadores. Uma réplica por vez e prazo agregado até 19/10/2026 às 06:38 de São Paulo, podendo concluir antes. [Protocolo da auditoria](validacao-v6-estabilidade-protocolo.json). O andamento das réplicas requer o servidor local.

A V6 para conforme o protocolo registrado, sem prolongar o orçamento para perseguir lucro. Caixa é rejeição dos candidatos, não aprovação de rendimento. A versão GitHub fica congelada na data do snapshot; a página local acompanha o processo.

## Auditoria das perdas · 19/10/2026

[Diagnóstico completo, com filtros e operações](diagnostico-perdas.html). A página traz os dados embutidos e funciona por arquivo local. São 179 operações G151 em 47 meses, separando nove meses usados na seleção dos outros 38; não são períodos intocados. Carteiras mensais independentes de R$ 1.000, custos dobrados.

Nos 38 meses fora da seleção original: movimento de preço R$ 100,61, taxas R$ 266,32, slippage R$ 106,53 e funding -R$ 0,05: líquido -R$ 272,28. A família EMA + suas saídas responde por -R$ 253,53; Bollinger por -R$ 18,75. São contribuições descritivas, não uma ablação causal ou uma nova estratégia sem custos.

Dois problemas reproduzidos: contador antigo de vetos exclui os eventos do roteador (zero exibido versus 27.592 minutos vetados); um alvo economicamente inviável foi atingido, mas perdeu R$ 0,11 após custos. O relatório recupera a contagem real e documenta a falta do filtro de alvo líquido; fontes e regras congeladas foram preservadas. Nenhum novo treino foi iniciado. Dos 28.099 sinais por família, 22.691 foram excluídos pela escolha de família do roteador, 5.215 ficaram abaixo do limiar do modelo, 192 foram liberados e um não tinha contexto. A maior parte dos bloqueios não foi uma decisão direta do classificador.

19 testes passaram. Contabilidade, preços de abertura, taxas, slippage, risco/margem e causalidade temporal foram conferidos nos registros existentes. A verificação cobre 256 modelos e 1.195 conferências de hashes. A ausência de falhas nessas checagens não valida todos os caminhos possíveis do motor nem elimina as aproximações da simulação. [Dados](diagnostico-perdas.json), [operações CSV](diagnostico-perdas-operacoes.csv) e [verificação](diagnostico-perdas-verificacao.json).
