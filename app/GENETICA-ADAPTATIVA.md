# Genética adaptativa local

## Continuação V3 após o platô

A versãoV2 chegou ao recorde deR$12,73/mês na validação na geração20 e permaneceu nesse patamar após o reinício da45. O diagnóstico encontrou os12pais efetivamente selecionados todos em`hist_boosting`, apesar de haver outros algoritmos na população. A diversidade de rotas não garantia diversidade entre algoritmos; em estagnação, as mutações amplas também substituíam a maior parte da exploração local.

A continuação `adaptive-search-v3` usa código/protocolo separados (`scripts/adaptive-search-v3.py`, `scripts/search-v3-operators.py`, `adaptive-search-v3-protocol.json`). Reserva um pai de cada algoritmo disponível, mantém diversidade aproximada de comportamento pelas métricas mensais e divide64descendentes em quatro pistas. Em estagnação:24refinamentos locais,8cruzamentos,16imigrantes e16saltos de nicho. O reinício parcial mantém16refinamentos,8cruzamentos,24imigrantes e16saltos. Fora da estagnação:24/16/16/8. Os campos antigos de fração de imigrantes herdados daV2 não controlam aV3; as contagens das pistas têm precedência.

As métricas mensais usadas para distinguir comportamentos incluemPnL, contagem e queda máxima por custo. São uma assinatura aproximada do comportamento no histórico, não prova de que os trades sejam idênticos. O arquivo de exploração mantém alternativas por algoritmo. O gráfico e a tabela agora distinguem o recorde acumulado do melhor candidato novo de cada geração, com resultados distintos e composição dos pais.

O processoV2 foi encerrado com checkpoints; seu código, protocolo e resultados não foram sobrescritos. A continuação reutilizou44.112predições existentes, carregou o campeão, o histórico, as contagens e o prazo original19/10/2026às13h24deSãoPaulo. O limite de30GB contabiliza também o tamanho herdado. Rótulos e predições antigos são lidos por links; novos modelos são gravados somente na nova rodada. `continuation-audit.json` e `registration.json` registram a origem e os hashes. O teste final não foi consultado nessa transição. Uma busca corrigida não garante novo lucro.

## Estudo separado de15× e20×

`leverage-study-protocol.json`, `scripts/analyze-leverage.mjs` e `web/leverage-research-engine.js` definem18carteiras:3blocos×3alavancagens×2custos, com o mesmo campeão e saldo contínuo. O motor10× precisa reproduzir a avaliação anterior. O risco permanece1%do saldo; alavancagem muda margem e liquidação, sem multiplicar automaticamente o tamanho da posição. Entrada com stop além da liquidação estimada é recusada. Não há aumento de risco nem promoção de15×/20× para o treinamento ou ordens reais.

No campeão`a5aa4a77566c08fbc23b`, o lucro foi igual em10×,15× e20× nos três blocos, nos dois custos. Com custos dobrados:jun–ago/2025R$41,38;dez/2025–fev/2026R$54,96;jun–ago/2026R$18,56. Neste último bloco a margem média foiR$101,48em10×,R$67,66em15×eR$50,74em20×. Não houve liquidação nos cenários; isso não garante proteção futura nem valida a aproximação de liquidação para todos os regimes.

O painel contém a seção**10× /15× /20×**, com filtros de período/custo, margem, operações e rejeições. O processo de diagnóstico recalcula o estudo quando muda o campeão. É validação retrospectiva: não entra no fitness e não consulta o teste final. Custo base por execução:taxa0,05%+slippage0,02%;dobrado:0,10%+0,04%. Entrada e saída somam aproximadamente0,14%ou0,28%do notional, respectivamente; funding histórico não é dobrado. As tarifas são hipóteses, sem consulta à conta pessoal.

Esta rodada combina as três estratégias de sinais já implementadas — EMA9/21, pullback VWAP e reversão Bollinger/RSI — com durações de 30min, 1h, 2h, 4h, 12h e 24h. É um experimento retrospectivo com R$1.000 simulados, risco de 1% e alavancagem de 10×. Os estudos de R$300 permanecem preservados. Não são introduzidas ordens reais ou promoção automática.

O melhor candidato da rodada anterior, usando a mesma validação de nove meses, foi a árvore Bollinger com profundidade6, folha mínima100, limiar0,4, treino9meses e prazo60min: −R$7,85/mês. O +R$5,09 de setembro/2026 é teste conhecido, e não foi usado para escolher a semente. A nova população contém essa semente, os melhores de cada família/algoritmo na validação antiga e candidatos aleatórios. Os resultados em R$1.000 são recalculados; não se extrapolam proporcionalmente os resultados em R$300.

## Roteamento no sinal

O genoma contém algoritmo e parâmetros, janela de treino e três braços, um para cada regime. Cada braço escolhe família, duração e limiar do modelo, ou caixa.

1. Volatilidade alta se ATR5min/preço superar o limiar do genoma.
2. Caso contrário, tendência se as direções dos candles fechados de 1h e 4h concordarem e a separação média absoluta das EMAs/ATR superar o gene de força.
3. Os demais sinais são classificados como lateralização.

O regime é uma classificação pelas regras, e não uma afirmação de que essas condições garantem oportunidades. Os genes são escolhidos pela validação. Um modelo separado por família/prazo produz o score usado para aceitar a entrada. Todos os modelos de um genoma usam a mesma arquitetura e janela; florestas e MLP agregam cinco sementes. Não há escolha da melhor semente.

Família e duração são fixadas ao abrir a posição. O novo contexto não estende o prazo de uma posição existente. Somente sinais contrários da família que abriu a posição causam essa saída, mesmo quando o roteador ou o modelo vetam novas entradas. Uma carteira compartilha saldo, funding, custos, margem, limite diário de3% e global de10%; há no máximo uma posição aberta. O roteador não mistura saldos nem soma resultados de estratégias independentes.

## Treino e validação

Rótulos líquidos próprios para cada prazo, com capitalR$1000 e custos dobrados. O rótulo amadurece 1445min após o sinal, inclusive para prazos curtos; essa purga conservadora impede atravessar fronteiras. Usa apenas dados de candles completos já armazenados. Sinais e doze entradas são os do estudo anterior; a execução continua sendo de1min.

Em cada corte, treino de6/9/12meses antes de três meses de validação. Os cortes são setembro/2025, março/2026 e setembro/2026: os nove meses de fitness são junho–agosto/2025, dezembro/2025–fevereiro/2026 e junho–agosto/2026. Cada mês reiniciaR$1000. A média não representa capital composto de uma conta contínua.

Fitness: menor das médias de PnL base e com custos dobrados nos nove meses. Elegibilidade exige pelo menos30operações no total e3em cada bloco em ambos os custos e queda máxima até15%. O limite de queda é um critério de rejeição do candidato; não altera stops ou limites do motor. Empates favorecem menor queda e mais meses positivos. Validação negativa continua não aprovada; caixa rende zero neste experimento. Setembro/2026 é avaliado uma vez ao encerrar, depois de congelar o vencedor. O mês já era conhecido, portanto não é um novo holdout.

## Diversidade e recursos

- População inicial de64; até1000 gerações seguintes, com64 descendentes inéditos por geração.
- Até12 pais diversos por algoritmo e combinação de famílias. Torneio, cruzamento e mutação, mantendo o melhor elegível global.
- Pelo menos25% de imigrantes aleatórios. Após8gerações sem melhora superior aUSDT0,01/mês, mutações maiores e65% de imigrantes. A cada24gerações nessa situação, reinício parcial com85% de imigrantes. O campeão é conservado; estagnação não encerra a campanha.
- Máximo24h a partir do início, incluindo rótulos e avaliação. Até10processos, uma thread nativa por processo. O limite de gerações é um teto; a quantidade concluída depende do tempo de ajuste e simulação.
- Parada com menos de8GB livres ou mais de30GB de artefatos da nova rodada. Nenhum arquivo de estudos anteriores é apagado. O limite de30GB é aproximado, verificado entre tarefas; tarefas simultâneas podem ultrapassá-lo parcialmente antes da parada.
- Rótulos, modelos, predições e gerações têm checkpoints. Retomada exige os mesmos hashes e preserva o prazo original. Limiares e rotas diferentes reutilizam modelos idênticos. Ajustes que falham ficam registrados e invalidam o candidato; não viram lucro zero.
- `caffeinate -is -w PID` impede repouso ocioso enquanto a campanha roda. Mantenha a tampa aberta e o carregador conectado; fechar a tampa ou desligar o Mac interrompe a execução. Isso não altera permanentemente preferências do sistema.

## Acompanhamento

O painel também contém **Saldo acumulado × 100% do CDI**. Esse diagnóstico usa o campeão atual e executa cada bloco de três meses de uma vez, conservando saldo, posições e limites entre meses. O risco de cada nova entrada continua1% do saldo disponível: sobe após ganhos e diminui após perdas. Não há reset de R$1000 na virada do mês dentro do bloco. Cada um dos três blocos inicia separadamente, pois há meses sem avaliação entre eles; não encadeamos intervalos ausentes como se fossem uma conta de nove meses consecutivos.

Os modelos e o fitness da campanha atual permanecem preservados. A comparação é uma avaliação adicional em validação já conhecida; não consulta o teste final. `compound-benchmark-protocol.json` registra as regras. O processo auxiliar verifica a cada60s se o campeão mudou e recalcula o diagnóstico quando necessário, encerrando quando a campanha terminar. Ele não treina modelos nem coleta mercado.

CDI: taxas diárias e acumulados mensais doBCB republicados oficialmente peloIpeadata (`SGS366_CDI366` e `BM12_TJCDI12`); a API direta doBCB rejeitou as consultas nesta coleta. Os316dados diários e15meses são armazenados com metadados eSHA256 em `data/cdi/`. O produto diário precisa conferir com o acumulado mensal publicado, dentro do arredondamento de0,0055p.p.; cobertura incompleta fica indisponível. Fonte: [API oficial Ipeadata](https://www.ipeadata.gov.br/api/) e [metodologia de composição doDI/B3](https://www.b3.com.br/pt_br/market-data-e-indices/indices/indices-de-segmentos-e-setoriais/di/metodologia-de-calcudo-acumulado-de-di/).

Comparação antes de impostos; o bot inclui taxas, slippage e funding modelados, eCDI é um índice bruto sem produto financeiro contratado. Câmbio do bot permanece hipotético fixoR$5/USDT; os resultados em reais não refletem oscilação cambial. O caixa do bot não recebe CDI simultaneamente. O calendário dos candles éUTC, enquanto oCDI usa a taxa de cada data, sem ajuste de horário intradiário. Finais de semana e feriados sem observação não recebem rendimentos extras. O gráfico mostra saldo diário a mercado, incluindo posições abertas, e a liquidação final do bloco.

`npm run benchmark:start`, `benchmark:status` e `benchmark:stop` controlam somente esse processo. `npm run benchmark:calculate` executa uma avaliação isolada. `python3 scripts/fetch-ipea-cdi.py` atualiza as fontes; `--cached` confere e normaliza os downloads já salvos. O modelo nunca é selecionado por esse diagnóstico na campanha atual.

Abra http://127.0.0.1:4173/evolucao/index.html. O painel lê `web/data/adaptive-evolution-status.json` e `adaptive-evolution-results.json`, a cada5s enquanto visível. O processo não depende da aba aberta. Relatórios antigos ficam separados. Os arquivos completos desta campanha ficam em `work/local-ml/runs/adaptive-…`, e o controle em `work/local-ml/adaptive-service.json`.

```sh
npm run ml:adaptive:status
npm run ml:adaptive:stop
npm run ml:adaptive:resume
```

O algoritmo conserva todas as pontuações, incluindo candidatos inelegíveis e perdas. `seed-audit.json` registra as sementes; `children-N.json`, `mix-N.json` e `scores-N.json` registram os candidatos e resultados. `registration.json` guarda protocolo, prazo e hashes de código/dados. Esses hashes locais verificam integridade, sem equivaler a auditoria independente.

## Limitações e referências

Não há garantia de ótimo global. Uma busca grande em dados conhecidos amplia o risco de sobreajuste e exige validação prospectiva depois. Não calculamos uma probabilidade de sobreajuste validada para este experimento; exibir lucro na validação não elimina o problema. Os estudos anteriores em1h, incluindo Donchian, não são inseridos diretamente como especialistas nesta versão: os três especialistas usam os mesmos sinais5min, com horizontes de scalp a intradiário. Prazo de24h é um teto, e stops/sinais contrários podem encerrar muito antes.

O desenho de população, cruzamento e duplicatas segue conceitos documentados em [pymoo GA](https://www.pymoo.org/algorithms/soo/ga.html); elites, descendentes e mutantes também são documentados em [pymoo BRKGA](https://www.pymoo.org/algorithms/soo/brkga.html). Não usamos a biblioteca nem alegamos reproduzir exatamente esses algoritmos. O risco de selecionar resultados por tentativa repetida é discutido em [Bailey et al., The Probability of Backtest Overfitting](https://www.davidhbailey.com/dhbpapers/backtest-prob.pdf). Essas referências fundamentam o método, não comprovam rentabilidade em cripto.
