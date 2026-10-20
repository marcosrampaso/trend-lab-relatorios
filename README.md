# Trend Lab · código e relatórios

O laboratório agora tem código e relatórios neste mesmo repositório privado.

- **[Código do aplicativo](app/)** e [instruções de reprodução](app/REPRODUCAO-GITHUB.md).
- **[Experimento de notícias com G151 e rompimento](experimentos/noticias/index.html)**: retrato datado, com resultados e protocolo.
- [Painel ao vivo na máquina](http://127.0.0.1:4173/pesquisa-genetica/experimento-noticias.html?strategy=g151).
- [Hashes dos arquivos exportados](app/source-manifest.json), [exportador de código](tools/sync-local-source.py) e [gerador do snapshot](tools/snapshot-news.py).

O GitHub guarda versões do código e retratos dos resultados. A execução permanece local; não há deploy nem atualização automática do snapshot. Pesos, candles, bancoSQLite, credenciais e pastas de execução ficam fora do Git. O G151 usa pesos preservados e entra com1min de atraso explícito em relação ao fechamento5m, sem retreino.

Os relatórios abaixo documentam as rodadas históricas e suas limitações; os resultados de seleção antigos não foram substituídos por resultados prospectivos.


## BTC × ETH e sentimento local

- [Código, método e reprodução](app/MULTIATIVOS-SENTIMENTO.md)
- [Relatório e retrato datado](experimentos/btc-eth-sentimento/index.html)
- [Painel local ao vivo](http://127.0.0.1:4173/pesquisa-genetica/cripto-sentimento.html)

Três braços (ETH/G151, BTC/pesos ETH e BTC/treino próprio), cada um com controle e filtro DistilRoBERTa executado localmente. Comparação histórica jun–set/2026 é exploratória, sem notícias do futuro. O treino do BTC usa apenas rótulos maturados anteriores ao teste; poucas operações e limiares herdados limitam conclusões. Sem ordens reais.

O classificador usa ambiente separado; pesos e dados não estão neste repositório. Exportação e atualização do retrato: `tools/sync-local-source.py` e `tools/snapshot-multiasset.py`, ambos com `--source /caminho/do/trend-lab`. Esses comandos não fazem push nem substituem o estado da execução.


## Arquivo dos relatórios da genética

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


## Day trade integrado

- [Método, limites e comandos](app/DAYTRADE-INTEGRADO.md)
- [Relatório datado com todos os resultados](experimentos/daytrade/index.html)
- [Painel local ao vivo](http://127.0.0.1:4173/pesquisa-genetica/daytrade-integrado.html)

Reaproveita EMA1h e Donchian fixo/adaptativo em BTC/ETH, até24h por operação. Cada estratégia tem controle, sentimento local, contextoBTC e ambos;24carteiras simuladas. Não utiliza pesos de scalping em sinais horários. Comparação histórica nos mesmos quatro meses, sem promoção automática. `tools/snapshot-daytrade.py --source /caminho/do/trend-lab` atualiza o retrato sem fazer push ou alterar o estado da execução.


## Comparação de todos os experimentos com o CDI

- [Painel local com filtros e curvas](http://127.0.0.1:4173/pesquisa-genetica/cdi-comparativo.html).
- [Retrato estático dos 324 cenários](experimentos/cdi/index.html) e [números e proveniência](experimentos/cdi/snapshot.json).
- [Método e limitações](app/COMPARACAO-CDI.md), [cálculo](app/scripts/cdi-reference-core.mjs) e [testes](app/tests/cdi-reference.test.mjs).

100% do CDI bruto teórico, juros reinvestidos, mesmo capital e datas por carteira. Robôs após custos modelados; ambos antes de impostos. Fontes BCB/Ipeadata, reconciliação diária/mensal, sem taxa futura estimada ou taxa anual atual retroativa. A referência de outubro fica provisória; sem ranking ou percentual enquanto faltar reconciliação. Arquivos antigos, regras dos bots e critérios de seleção preservados. As páginas de day trade, BTC/ETH e notícias incluem a seção CDI; os relatórios antigos da genética conservam seu próprio benchmark.

Atualizar este retrato: `python3 tools/snapshot-cdi.py --source /caminho/do/trend-lab`, após exportar os fontes. O comando não faz push, backtest ou operação real. 239 testes passaram na implantação.


## Donchian adaptativo desde o início · 19/10/2026

- [Painel local de saldo contínuo, filtros e prospectivo](http://127.0.0.1:4173/pesquisa-genetica/donchian-lab.html).
- [Método e conclusões](app/DONCHIAN-LAB.md), [retrato estático](experimentos/donchian/index.html), [dados](experimentos/donchian/snapshot.json).

50cenários:12de isolamento do filtro,6carteiras contínuas em82meses e32diagnósticos por blocos. Capital contínuo R$1.000 sem aportes/reset, janeiro/2020 a19/10/2026 03:08UTC. A configuração que ganhouR$67,95 emjun–set/2026 terminou a conta contínua comR$900,43; limite global acionado em31/01/2020, depois permanece em caixa. Não foi promovida. Os64minutos sem mark price foram explicitados e ocorreram sem exposição em todas ascarteiras. CDI de outubro ainda provisório.248testes e auditoria de paridade com o motor preservado passaram; fontes/dados antigos preservados. O comparativo geral CDI agora reúne374cenários.


## Genética Donchian com tela ao vivo · 19/10/2026

- [Acompanhamento na máquina](http://127.0.0.1:4173/pesquisa-genetica/donchian-genetico.html).
- [Método, genes e comandos](app/DONCHIAN-GENETICO.md).
- [Retrato datado da execução](experimentos/donchian-genetico/index.html) e [dados do retrato](experimentos/donchian-genetico/snapshot.json).

24candidatos por geração, seleção, cruzamento, mutação,4elites e imigrantes aleatórios. Busca entradas por reteste/contexto1h/4h, stop, alvo e prazo com risco1% fixo. Até200gerações ou12horas, checkpoints e aumento de diversidade após5gerações sem recorde. Catálogo desde2020 e804minutos recentes adicionados até19/10/2026 13:32 deSãoPaulo, congelados antes da seleção. Fitness usa apenas45meses completos de2020–2023;2024–2025 e2026 são diagnósticos separados, sem orientar os pais. A conta contínua desde2020 mantém seu limite global, sem repor dinheiro. Não há promoção nem ordens reais.259testes passaram; resultados antigos preservados. O GitHub é um retrato estático, não uma tela de monitoramento da máquina.

## Donchian V2 · pesquisa sem trava acumulada

[Retrato dos resultados V2](experimentos/donchian-genetico-v2/index.html) · [Método e mudanças](app/DONCHIAN-GENETICO-V2.md) · [Painel local V2](http://127.0.0.1:4173/pesquisa-genetica/donchian-genetico.html?run=v2)

Sem teto artificial de gerações/horas e sem a trava acumulada de −10%, exclusivamente na pesquisa. Risco de1% por entrada, limite diário3%, stops, custos, saldo contínuo e insolvência preservados. V1 arquivada na geração119; todos os genomas importados são reavaliados. Nenhuma ordem real ou promoção automática.

## Donchian V3 · alvos da estratégia e saídas 50/50

[Retrato V3 e comparação de saídas](experimentos/donchian-genetico-v3/index.html) · [Método e contabilidade](app/DONCHIAN-GENETICO-V3.md) · [Painel local](http://127.0.0.1:4173/pesquisa-genetica/donchian-genetico.html?run=v3#exits-section)

A genética compara saída inteira com metade no primeiro alvo e restante no segundo. Alvos em múltiplos do stop calculado pelo ATR; os3% são limite diário de perda. Funding usa a quantidade restante, parciais respeitam lote mínimo e uma posição conta uma vez. V2 preservada na geração59; sem reutilizar suas pontuações.

## Donchian V4 · sem prazo e com stop após a parcial

[Retrato V4](experimentos/donchian-genetico-v4/index.html) · [Método e proteção](app/DONCHIAN-GENETICO-V4.md) · [Painel local](http://127.0.0.1:4173/pesquisa-genetica/donchian-genetico.html?run=v4#exits-section)

Sem vencimento por operação. Após parcial válida, genética escolhe proteção dos custos conhecidos, lucro de0,25R/0,5R ou trailing porATR. Stop só aperta e passa a valer no próximo candle; gaps/funding futuro ainda podem gerar perda. Saídas no fim do histórico são identificadas separadamente. V3 preservada na geração73; sem ordens reais.

## Por que a curva cai contra o CDI? · defesas de mercado

[Auditoria e seis perfis de defesa](experimentos/donchian-defesa/index.html) · [Método, limites e custos](app/DONCHIAN-DEFESA-MERCADO.md) · [Painel local](http://127.0.0.1:4173/pesquisa-genetica/donchian-defesa.html)

ControleV4 congelado: ganho inicial em2020–2021, perdas posteriores e custos maiores que a vantagem bruta. Nenhuma defesa passou o critério de desenvolvimento contraCDI. Coleta prospectiva pública deBTC/ETH em observação, sem ordens ou vetos nos bots.

## G151 · saídas e trailing

[Dashboard e retrato dos resultados](experimentos/g151-saidas/index.html) · [Método e interpretação](app/G151-SAIDAS-TRAILING.md) · [Código da simulação](app/scripts/g151-exit-engine.mjs).

928 avaliações concluídas, com controles reproduzidos e 301 testes passando. O trailing 2 ATR reduziu a perda média de −R$7,17 para −R$6,75/mês nos 38 meses fora da seleção, mas piorou os nove meses originais. Todas as carteiras contínuas atingiram o limite de perda de 10%; nenhuma variante foi promovida. Sem novo treino nem ordens reais.


## PEPE V3 · ações válidas e auditoria antes da seleção

[Painel local](http://127.0.0.1:4173/pesquisa-genetica/pepe-v3.html) · [retrato datado](experiments/pepe-finrl-mask-v3/index.html) · [método](app/PEPE-V3-AUDITORIA.md) · [ranking inicial completo](experiments/pepe-finrl-mask-v3/parent-ranking.json).

1.093 arquivos distintos de pesos recuperáveis convertidos para MaskablePPO e auditados no mesmo trimestre contínuo out–dez/2024. Pai: agente80 da população parcial1.000, +R$74,25 líquidos (quatro posições, queda máxima9,91%), CDI +R$26,76. Todos os250 agentes passam pelo mesmo trimestre antes de reprodução; recordes guardam pesos exatos, carteira, custos e hash antes de novos treinos. Sondagens de dois dias não viram renda composta nem selecionam pais. Teste final bloqueado: o período antigo já foi visto; novo calendário prospectivo necessário. 335 testes e checagem real de treino/transferência/retomada passaram. Sem lucro futuro demonstrado, promoção ou ordens reais.
