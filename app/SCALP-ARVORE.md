# Árvore de scalping: treino concluído

Treino concluído em2026-10-18T05:58:19.459Z. Foram treinadas57 árvores (3 famílias ×19 cortes temporais), usando19.535 exemplos rotulados em33 meses deETHUSDT1min. São378 carteiras de avaliação:21 meses ×3 famílias ×3 variantes ×2 custos. Nenhuma passou todos os critérios de pesquisa.

O painel local [Scalping](http://127.0.0.1:4173/?view=scalping) permite inspecionar as regras, o caminho de cada decisão e aplicar árvores no replay. A execução automática prospectiva não foi alterada. Não há retreino contínuo em tempo real nem ordens reais.

## Dados e validação temporal

- Candles de1min, mark price, quote volume e agressão taker oficiais. Base: dezembro2023 para aquecimento e janeiro2024–setembro2026 para estudo. Total1.490.400 minutos incluindo aquecimento;68 arquivos mensais com checksum externo.
- Foram recuperados1.442 minutos ausentes pelaAPI oficial, com respostas preservadas e hashes próprios, sem checksum externo para essas respostas. Nenhuma interpolação.
- Há3 horas com divergência entre o agregado dos arquivos1min e os arquivos1h do estudo anterior. As duas versões estão registradas no manifesto. Este estudo usa1min como base canônica para execução e para agregar1h/4h; dados antigos não foram alterados. Histórico horário anterior a dezembro2023 serve ao aquecimento dos indicadores maiores.
- Funding vem do histórico oficial já congelado. Mínimos da corretora são os atuais aplicados retroativamente, câmbio hipotéticoR$5/USDT, taxas modeladas, sem impostos nem livro/fila/latência real.

| Etapa | Datas / regra |
|---|---|
| Treino inicial | Jan–set2024 |
| Escolha do limiar inicial | Out–dez2024 |
| Avaliação com retreino histórico | Jan2025–jun2026;9 meses treino +3 validação, anteriores ao mês seguinte |
| Checagem final reservada | Jul–set2026; versão de1jul congelada para os3 meses |

A avaliação é posterior ao treino de cada versão, mas retrospectiva. Os dados horários desses períodos já tinham sido examinados em outras estratégias. A checagem final foi reservada antes desta rodada; não é prova prospectiva em mercado novo.

## O que a árvore aprende

Uma árvore rasa por família (EMA9/21, VWAP+volume ou Bollinger+RSI). CART aproximada comGini, profundidade máxima3, mínimo100 exemplos por folha,32 candidatos de corte por entrada e suavizaçãoLaplace1. Implementação numérica local já usada pelo projeto; não chamaAPI deIA.

As12 entradas conhecidas no gatilho: lado; RSI5min a favor; ATR/preço; log do volume relativo; distânciaVWAP/ATR; diferençaEMA5min/ATR; alinhamento1h e4h; diferençaEMA20/50/ATR1h e4h; custo estimado/stop; delta taker a favor. Contexto maior usa somente candles fechados, com150 barras de aquecimento.

| Família | Exemplos rotulados |
|---|---:|
| EMA9/21 | 13871 |
| VWAP + volume | 2501 |
| Bollinger + RSI | 3163 |

Rótulo: resultado líquido positivo de uma operação isolada de até30min, com custos dobrados, funding, stops, alvos e saídas contrárias originais. Inclui ganhos/perdas de todos os gatilhos executáveis, mesmo que uma carteira os vetasse.37 sinais Bollinger e2 EMA sem execução foram excluídos;1 sinal EMA estava em aquecimento e1 não tinha horizonte completo.

O rótulo só fica disponível245min após o sinal, de forma conservadora; exemplos cujo rótulo atravessa o limite treino/validação são purgados. Sinais próximos podem ter resultados dependentes;19.535 exemplos não equivalem a19.535 observações independentes.

O score é proporção de classe suavizada nas folhas, não probabilidade de lucro calibrada. Limiar escolhido entre0,35%,40%,45%,50%,55%,60%,65%, usando somente validação anterior.0 desativa o filtro e reproduz o controle. Critério: maior pior resultado entre custos base e dobrados, no mínimo20 operações em ambos,15% de cobertura e deterioração máxima de2 pontos percentuais no drawdown frente ao controle. Empates favorecem menor limiar. Os critérios não foram mudados depois dos resultados.

Só15/57 versões selecionaram limiar acima de0; nenhuma teve validação aprovada como rentável. Isso significa que muitas árvores foram aprendidas, mas a seleção manteve o controle sem veto. Não se força um filtro só para aparentar aprendizado.

O filtro só pode impedir novas entradas. Não elimina sinais contrários de saída, não afrouxa stops, não altera alvos e não aumenta posição para recuperar prejuízo. Risco1%, capital inicial mensalR$300, alavancagem10x, limites diário3% e global10% e intervalo10min permanecem iguais.

## Avaliação em21 meses posteriores

Média de resultados mensais, cada mês reiniciado comR$300. Não é rendimento composto ou promessa de renda. Custos2× recalculam a carteira e podem mudar operações e pausas.

| Família | Carteira | Média/mês base | Média/mês2× | Meses positivos2× | Operações2× |
|---|---|---:|---:|---:|---:|
| EMA9/21 | Sem árvore | R$ -30,57 | R$ -30,71 | 0/21 | 518 |
| EMA9/21 | Árvore fixa | R$ -30,57 | R$ -30,71 | 0/21 | 518 |
| EMA9/21 | Retreino mensal | R$ -30,57 | R$ -30,71 | 0/21 | 518 |
| VWAP + volume | Sem árvore | R$ -30,12 | R$ -30,79 | 0/21 | 572 |
| VWAP + volume | Árvore fixa | R$ -30,12 | R$ -30,79 | 0/21 | 572 |
| VWAP + volume | Retreino mensal | R$ -28,13 | R$ -29,35 | 0/21 | 554 |
| Bollinger + RSI | Sem árvore | R$ -30,04 | R$ -30,62 | 0/21 | 605 |
| Bollinger + RSI | Árvore fixa | R$ -30,04 | R$ -30,62 | 0/21 | 605 |
| Bollinger + RSI | Retreino mensal | R$ -14,16 | R$ -18,11 | 2/21 | 468 |

O retreino Bollinger reduziu a perda média2× emR$12,51/mês frente ao controle. O intervalo simultâneo do bootstrap para essa diferença relativa foi aproximadamenteR$5,20 aR$21,93/mês. Essa melhora relativa não tornou a estratégia lucrativa: o resultado agregado e os três meses finais continuaram negativos.

O bootstrap usa blocos móveis de3 meses,5000 réplicas e ajusteBonferroni para6 comparações (3 famílias ×2 modelos). Há somente21 meses e pouca diversidade de blocos; os intervalos são aproximações retrospectivas e não garantem retorno futuro. O efeito das paradas globais precisa ser considerado: carteiras próximas de−10% podem ter negociado quantidades e dias muito diferentes.

| Modelo | Checagem final2× jul–set2026 | Resultado da triagem |
|---|---:|---|
| EMA9/21 · Árvore fixa | R$ -93,16 | Resultado agregado negativo com custos2×; Melhora relativa sem limite inferior positivo; Checagem final negativa com custos2× |
| EMA9/21 · Retreino mensal | R$ -93,16 | Resultado agregado negativo com custos2×; Melhora relativa sem limite inferior positivo; Checagem final negativa com custos2× |
| VWAP + volume · Árvore fixa | R$ -93,46 | Resultado agregado negativo com custos2×; Melhora relativa sem limite inferior positivo; Checagem final negativa com custos2× |
| VWAP + volume · Retreino mensal | R$ -93,46 | Resultado agregado negativo com custos2×; Melhora relativa sem limite inferior positivo; Checagem final negativa com custos2× |
| Bollinger + RSI · Árvore fixa | R$ -91,68 | Resultado agregado negativo com custos2×; Melhora relativa sem limite inferior positivo; Checagem final negativa com custos2× |
| Bollinger + RSI · Retreino mensal | R$ -91,68 | Resultado agregado negativo com custos2×; Checagem final negativa com custos2× |

Valores da checagem final são soma de3 carteiras mensais reiniciadas, não retorno de uma conta contínua. Em todas as famílias o modelo de1julho escolheu limiar0, portanto a checagem final manteve o controle. Nenhuma versão foi promovida ao processo prospectivo.

## Usar no painel

1. AbraScalping e escolha a família/mês do replay.
2. EmÁrvore no replay, selecione inspeção, árvore fixa ou retreino histórico mensal. Aplicar bloqueia o prazo em30min e substitui o filtro manual pelo filtro aprendido; ao desligar, restaura a seleção anterior.
3. Avance uma atividade e um minuto. A tela mostra score, limiar, folha e regras percorridas, além de entrada/veto no diário. Limiar0 é identificado explicitamente.
4. Revele a avaliação posterior para comparar todas as carteiras e a checagem final. O botão de exportação contém modelos, limiares testados, resultados e operações.

O replay original de abril/maio preserva seus dados e aquecimento antigos. Pode diferir marginalmente dos sinais do estudo contínuo ampliado. Para a decisão no replay, as12 entradas são recalculadas no gatilho exibido; o contexto é fechado e o modelo precisa estar disponível no começo do mês. O retreino mensal aqui foi executado historicamente, não agendado para produção.

## Verificação e reprodução

Arquivos principais: `scalp-tree-protocol.json`, `data/scalp-tree/manifest.json`, `data/scalp-tree/samples.json`, `web/data/scalp-tree-models.json`, `web/data/scalp-tree-results.json`. Congelamentos: `scalp-tree-freeze.json` e `scalp-tree-preview-freeze.json`. Os arquivos anteriores e oSQLite privado foram preservados.

Reproduzir a coleta verificada: `python3 scripts/fetch-scalp-tree.py`. Amostras: `node --max-old-space-size=3072 scripts/build-scalp-tree-samples.mjs`. Treino e avaliação: `node --max-old-space-size=3072 scripts/train-scalp-tree.mjs`. Saídas existentes divergentes são recusadas, não sobrescritas.

Os testes verificam purga, candles fechados, aprendizado real, limites das árvores, proteção contra rótulos futuros, saída contrária apesar de veto, caixa, custos e prazo das378 carteiras, limiar0 idêntico ao controle e hashes. O painel mostra as perdas e reprovações.

Referências primárias: [arquivos e checksums Binance](https://github.com/binance/binance-public-data), [árvores de decisão](https://scikit-learn.org/stable/modules/tree.html) e [validação temporal](https://scikit-learn.org/stable/modules/generated/sklearn.model_selection.TimeSeriesSplit.html).
