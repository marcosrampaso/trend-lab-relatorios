# Árvores e estratégias: primeiro treino supervisionado

Disponível em [IA · árvores e estratégias](http://127.0.0.1:4173/?view=ml).

Treinamos três árvores e três regressões, uma de cada tipo para Donchian adaptativo, tendência EMA9/21 de1h e reversão Bollinger20 de1h. Cada família também tem carteira sem filtro. São9 combinações e108 cenários publicados, incluindo seleção2023 e avaliação posterior, com custos base e dobrados.

As árvores aprendem regras de aceitação/veto de sinais. Não recebem ordens reais nem alteram o processo prospectivo. As estratégias não operam simultaneamente: cada carteira começa comR$300, risco1% e10x. Donchian eEMA conservam stop1,5ATR, alvo2R, máximo24h e intervalo4h. Reversão conserva alvo na média conhecida e máximo12h.

## Treino e escolha temporal

Treino em2020–2022; escolha de limiar e combinação em2023; avaliação de2jan2024 até15out2026. Rótulos ficam disponíveis25h após cada sinal; amostras cujo rótulo atravessa a fronteira são excluídas. Preprocessamento e pesos usam somente o treino. Os mesmos dados históricos já foram inspecionados em estudos anteriores; a avaliação é posterior ao ajuste do modelo, mas retrospectiva e não validação futura intocada.

CART aproximada com Gini: até3 níveis, ao menos50 exemplos por folha,32 candidatos de corte por feature e suavização deLaplace1. Regressão logística comL2,1500 passos e taxa0,05, com padronização e clipping em±5 desvios do treino. Implementação numérica local emJavaScript, sem instalar dependências nem usar API deIA. Estes hiperparâmetros foram registrados antes desta rodada e não alterados após os resultados.

Cada modelo tem12 entradas conhecidas no fechamento: lado, retornos log1h/6h/24h a favor, ATR/preço, log do volume relativo, separação EMA/ATR, RSI a favor, ADX, distância VWAP/ATR, largura do canal/ATR e distância do rompimento/ATR. No Donchian o canal é adaptativo; nas outras famílias, as features de canal usam as20 horas anteriores. Nenhuma notícia atual é inserida no passado.

O rótulo é se uma operação isolada, usando custos e regras da família, teria resultado líquido positivo. Não é o resultado de uma carteira. Foram rotulados3312 exemplos Donchian,2434 EMA e3095 reversão em toda a base; apenas1392,898 e1204, respectivamente, entraram no treino2020–2022. Sinais próximos podem ter horizontes sobrepostos: essas contagens não significam amostras independentes.

## Nove combinações na seleção2023

Critério: maior valor do **pior resultado entre custos base e dobrados**. Limiares0%,35%,40%,45%,50%,55%,60%; filtros exigem ao menos20 operações em ambos os custos e20% dos sinais.0% desativa o filtro. Empates favorecem resultado base, menor limiar e controle mais simples. Todos os limiares testados estão exportados.

| Combinação | Exemplos de treino | Limiar | Base2023 | Custos2x2023 |
|---|---:|---:|---:|---:|
| Donchian adaptativo · Sem filtro | 1392 | 0% | R$-30,77 | R$-31,33 |
| Donchian adaptativo · Regressão | 1392 | 35% | R$-30,41 | R$-30,44 |
| Donchian adaptativo · Árvore | 1392 | 40% | R$-30,44 | R$-30,25 |
| Tendência EMA9/21 · 1h · Sem filtro | 898 | 0% | R$-30,53 | R$-31,43 |
| Tendência EMA9/21 · 1h · Regressão | 898 | 40% | R$-30,69 | R$-30,52 |
| Tendência EMA9/21 · 1h · Árvore | 898 | 35% | R$-30,95 | R$-30,38 |
| Reversão Bollinger20 · 1h · Sem filtro | 1204 | 0% | R$-30,49 | R$-30,58 |
| Reversão Bollinger20 · 1h · Regressão | 1204 | 40% | R$-30,48 | R$-30,37 |
| Reversão Bollinger20 · 1h · Árvore | 1204 | 0% | R$-30,49 | R$-30,58 |

Todas as nove combinações perderam no critério de seleção. A menor perda ficou em Donchian+regressão, mas a diferença para a árvore Donchian é menor que um centavo no pior cenário. Paradas perto do limite global tornam diferenças de centavos pouco informativas. Não foi aprovada uma estratégia rentável.

Pesos, árvores, limiares e escolha foram congelados antes de rodar a avaliação posterior desta rodada. A regressão original do Donchian e seus resultados permanecem preservados como experimento anterior. Os modelos não foram retreinados para favorecer qualquer ano posterior.

## Exemplo de leitura: árvore+EMA

A árvore+EMA superou o controle em4/5 blocos com custos base e5/5 com custos dobrados. Porém terminou com perda em4/5 blocos de custos dobrados. O desempenho melhor em alguns blocos não modifica a escolha congelada em2023.

| Bloco posterior | EMA sem filtro · base | EMA+árvore · base | EMA sem filtro · custos2x | EMA+árvore · custos2x |
|---|---:|---:|---:|---:|
| 2024 · avaliação posterior | R$-30,75 | R$-11,07 | R$-31,07 | R$-30,34 |
| Jan–jun 2025 · desenvolvimento | R$-26,54 | R$3,54 | R$-30,67 | R$-6,00 |
| Jul–dez 2025 · validação conhecida | R$-30,32 | R$-31,21 | R$-31,17 | R$-30,14 |
| Jan–set 2026 · comparação retrospectiva | R$20,91 | R$36,15 | R$-25,38 | R$6,51 |
| 1–15 out 2026 · janela adicional | R$-2,88 | R$0,51 | R$-7,03 | R$-3,12 |

Cada bloco reiniciaR$300; não somar retornos. Outubro contém só15 dias. O relatório completo mantém todos os108 cenários, curvas, operações, vetos, drawdowns, custos e controles, inclusive outras famílias e modelos que pioraram.

## Inspeção no painel

Escolha período e combinação. A tabela compara todas as nove carteiras; o gráfico compara a combinação escolhida com o controle da mesma família. O inspetor mostra score, limiar, evento da carteira, as12 entradas, caminho da árvore e sua estrutura completa expansível. A folha mostra quantos exemplos de treino a formaram. A contribuição da regressão é exibida separadamente quando selecionada.

O resultado isolado posterior só aparece ao clicar emRevelar. Ele não entra no cálculo do score. Aprovar um sinal não garante entrada: posições, intervalos e limites ainda se aplicam. Um sinal exatamente na fronteira inicial do bloco não gera nova entrada naquela carteira.

Score de classe não é probabilidade de lucro calibrada nem expectativa de retorno. Brier contra uma referência constante do treino está disponível em Treino, métricas e reprodução. Uma melhora de previsão não garante melhora financeira, e vice-versa.

## Limites e reprodução

Execução1h, mark price e liquidação aproximada; em conflito na mesma hora, liquidação estimada precede stop e stop precede alvo. Gaps e custos podem ultrapassar os limites. Filtros de lote atuais e câmbioR$5/USDT aplicados retroativamente. Sem ticks, fila, latência ou spread observados. Funding histórico incluído; antes de impostos. Scalping5min e range/VWAP15min mantêm estudos próprios e não são reproduzidos artificialmente com estes candles1h.

Arquivos congelados: `tree-protocol.json`, `tree-freeze.json`, `web/data/tree-samples.json`, `web/data/tree-models.json`, `web/data/tree-results.json`. O primeiro experimento logístico está preservado sob `ml-protocol.json`, `ml-freeze.json` e os arquivos `ml-*.json`.

Reprodução: `node scripts/tree-samples.mjs`, `node scripts/train-trees.mjs`, `node scripts/analyze-trees.mjs`. Os comandos conferem hashes e reprodução sem sobrescrever resultados congelados. `npm test` verifica gradiente, aprendizado, causalidade, purga, preservação e contabilidade. `npm run build` confere todos os congelamentos.

Os testes também modificam os preços e rótulos posteriores a2023 e verificam que pesos, árvores, limiares e seleção permanecem exatamente iguais. Todos os110 testes passaram.

Referências metodológicas: [árvores de decisão](https://scikit-learn.org/stable/modules/tree.html), [regressão logística](https://scikit-learn.org/stable/modules/linear_model.html#logistic-regression) e [vazamento de dados](https://scikit-learn.org/stable/common_pitfalls.html#data-leakage). A implementação é local e não executa scikit-learn.
