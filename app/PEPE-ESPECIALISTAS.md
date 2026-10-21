# Especialistas de compra e venda: genética e PPO

Piloto `pepe-specialists-v1`, registrado e executado em 21/10/2026.
Painel: http://127.0.0.1:4173/pesquisa-genetica/especialistas.html

## O que foi implementado

Dois especialistas independentes por família: compras e vendas. A genética evolui uma regra linear por lado; o PPO aprende a aceitar ou rejeitar uma oportunidade de um lado. O controlador pode escolher compra, venda ou caixa. Não treinamos apenas nos acertos: ganhos, perdas e entradas não preenchidas permanecem nos exemplos.

FinRL é o framework de pesquisa financeira; PPO é o algoritmo de reforço que usamos anteriormente. Neste piloto, o PPO do Stable-Baselines3 roda em um **bandit contextual de uma decisão**, com recompensa histórica de uma saída fixa. Não usa a fábrica FinRL DRLAgent nem é o antigo ambiente que aprendia toda a gestão da posição. Essa redução permite estudar entradas sem mudar a saída ao mesmo tempo. RSI é um indicador de entrada, não o treinador.

São 19 variáveis conhecidas antes da ordem: as 15 observações originais (RSI, ATR, volume relativo, VWAP, EMA, MACD, delta, tendências1h/4h e disponibilidade) e quatro medidas do último candle5m fechado (corpo com sinal, pavio superior, pavio inferior e amplitude, normalizados pelo ATR). Nenhum próximo open, máxima favorável futura ou resultado entra nas features.

O slippage permanece no modelo conservador de execução. OHLC não identifica a profundidade do livro, fila, latência e tamanho executado: não alegamos treinar um previsor de slippage real. Esse seria um experimento posterior com dados adequados de execução.

## Calendário e alvo fixados antes da execução

| Etapa | Calendário | Uso |
|---|---|---|
| Treino | jun–dez/2023 | Pesos genéticos e quatro PPOs |
| Seleção | jan–fev/2024 | Escolher entre 20 campeões de treino por lado e o controle de caixa |
| Calibração | mar/2024 | Score → estimativa de resultado líquido em R |
| Avaliação retrospectiva | abr,mai,jun,jul,set/2024 | Todas as nove variantes, sem ajustar modelos |

Scaler ajustado apenas no treino. Rótulos precisam ter terminado até30min antes do fim da etapa; dados não maturados são excluídos, não transferidos a outro bloco. Os dois lados de um timestamp pertencem ao mesmo calendário. Todas essas histórias já foram usadas pelo laboratório; não representam teste independente novo. 2025 e setembro/2026 não entraram no aprendizado ou nas carteiras deste piloto.

Propomos as duas direções a cada30min, incluindo momentos em que o G91 não entrou. O primeiro horário de cada mês é omitido por não conter os cinco minutos anteriores no pacote mensal. O rótulo é o PNL líquido após todos os custos sob escada+lock fixos, dividido pelo orçamento de risco original (R$10, com carteira R$1000 e risco1%). Há posições contrafactuais sobrepostas: seus somatórios e o fitness **não são rentabilidade de carteira**. O estado de risco é reiniciado por oportunidade apenas para construir os rótulos. A avaliação financeira tem uma carteira contínua e seus limites próprios.

Os rótulos mantêm stop, escada25/50/25 nos alvos líquidos equivalentes10/20/40% da margem original e proteção0,25R. A primeira decisão de gestão vem após5min, com execução no próximo open e prioridade dos stops/gaps. Sem prazo máximo novo; posições ainda abertas são liquidadas na fronteira mensal da pesquisa, marcadas como tal. Entradas não preenchidas têm resultado0 e status explícito.

Cada lado teve10.263 exemplos de treino e1.486 de calibração após o embargo. Seleção:2.877 compras e2.876 vendas; a diferença vem da maturação do desfecho antes do corte. São rótulos correlacionados do mesmo mercado, não essa quantidade de dias independentes.

## Busca e controlador

Genética:48 indivíduos ×20 gerações por lado, quatro elites, pais entre os12 melhores, cruzamento, mutação SD0,2 com probabilidade0,35 por gene e oito imigrantes por geração. Fitness é média mensal do resultado normalizado das oportunidades aceitas (rejeitadas valem0), menos0,25 do desvio entre meses; não é drawdown de carteira. Os20 campeões de treino são arquivados e só depois comparados nos dois meses de seleção, incluindo a regra de caixa.

PPO: duas sementes finais fixas (101/202) por lado,32.768 passos cada, rede32/32, episódios de uma decisão, ações caixa/aceitar, recompensa0 ou0,1×resultado líquido em R, gamma0. Não houve escolha de checkpoint ou semente pela avaliação. Modelos novos; não fingimos transferir os pesos G91 para regras lineares ou cabeças incompatíveis.

IsotonicRegression de março mapeia cada score para resultado líquido esperado em R. Para ser elegível, a política precisa aceitar o lado (score genético>0 ou probabilidade PPO de aceitar>0,5), e a estimativa calibrada precisa superar0,1R. O controlador combinado escolhe a maior estimativa elegível, com empate em caixa. A calibração não pode ativar uma regra genética que escolheu caixa. Nenhum limiar foi buscado após os resultados e o antigo filtro ATR/custo não foi acrescentado.

## Resultado das nove variantes

Uma carteira R$1000 independente por mês, contínua dentro dele, com risco1%,15× fixo, limites3% diário/10% global e custos de estresse. Meses sem ordens entram nas médias. Conversão fixa R$5/USDT; CDI bruto antes de impostos, sem variação cambial. Não compor reinícios mensais.

| Sistema | Modo | Líquido mensal médio | Operações | Acima do CDI | Meses sem ordens |
|---|---|---:|---:|---:|---:|
| Genética151 | Compra | −R$2,54 | 4 | 0/5 | 2/5 |
| Genética151 | Venda | R$0,00 | 0 | 0/5 | 5/5 |
| Genética151 | Combinado | −R$2,54 | 4 | 0/5 | 2/5 |
| PPO101 | Compra | R$0,00 | 0 | 0/5 | 5/5 |
| PPO101 | Venda | −R$1,94 | 1 | 0/5 | 4/5 |
| PPO101 | Combinado | −R$1,94 | 1 | 0/5 | 4/5 |
| PPO202 | Compra | R$0,00 | 0 | 0/5 | 5/5 |
| PPO202 | Venda | R$0,00 | 0 | 0/5 | 5/5 |
| PPO202 | Combinado | R$0,00 | 0 | 0/5 | 5/5 |

Média das duas sementes PPO: comprasR$0,00, vendas e combinado−R$0,97 por carteira mensal. CDI bruto médio+R$8,50. Não somar operações dos modos isolados e combinado como se fossem novas oportunidades: várias são as mesmas posições contrafactuais.

## O que isso diz

A arquitetura foi implementada e executada, mas **não demonstrou vantagem financeira**. A atividade foi muito pequena. Caixa não é uma previsão bem-sucedida de preço; as poucas ordens tampouco permitem afirmar que o modelo reconhece movimentos fortes. Em treino, a média das oportunidades foi negativa nos dois lados (compra−0,389R/venda−0,346R), e na calibração também (−0,211R/−0,231R). Isso é compatível com aprender a rejeitar muitas entradas, mas não isola se a principal limitação está nas features, na regra de saída, no custo, na capacidade linear/PPO ou no calendário.

Combinar dois especialistas fracos não produziu automaticamente um especialista lucrativo. Não aumentar gerações, ajustar o limiar ou selecionar o PPO202 por ter ficado zerado depois desta avaliação. O piloto terminou; pesos e resultados foram preservados, nenhuma regra foi promovida e não há treino infinito ou execução real em andamento.

Antes de outra rodada, registrar um diagnóstico de aceitação por etapa para localizar onde as oportunidades deixam de ser elegíveis (política ou expectativa líquida calibrada) e comparar com uma referência supervisionada simples sob o mesmo alvo. Qualquer nova hipótese deve ter protocolo e avaliação próprios; um teste futuro independente ainda precisará de dados prospectivos.

## Artefatos e verificações

Protocolo e fontes registrados antes dos dados/treino: `work/pepe-specialists-v1/{protocol,registration}.json`. Quinze pacotes preparados em `labels/`, com hashes em `dataset-registration.json`. Seis diretórios finais em `models/`, quatro pesos PPO32.768 passos,40 campeões genéticos de treino, scalers e calibradores. Pesos permanecem locais e imutáveis.

Resultado: `work/pepe-specialists-v1/result.json`, espelho `web/data/specialists.json`. Progresso/diagrama no painel local. Os quatro testes Node passaram, incluindo reprodução de uma posição congelada do estudo anterior. Foram conferidos hashes das entradas/fontes e de todos os modelos finais, formas das observações/ações, quatro contadores PPO32.768,20 gerações arquivadas por lado e contabilidade das45 carteiras. Os scripts e resultados antigos não foram alterados.

Fontes: [FinRL](https://github.com/AI4Finance-Foundation/FinRL), [dados de mercado Binance](https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/market-data). Não houve API paga, credenciais de negociação ou ordens reais.

## Replay e diagnóstico das recusas

[Replay local de candles, ordens, stops e decisões](http://127.0.0.1:4173/pesquisa-genetica/especialistas-replay.html).
Diagnóstico e reprodução exata das 45 carteiras documentados em `PEPE-ESPECIALISTAS-REPLAY.md`. Nenhum modelo ou regra foi alterado.
