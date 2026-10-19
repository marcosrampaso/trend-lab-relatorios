# Aprendizado de máquina para o Trend Lab

Pesquisa consultada em18/10/2026. A evidência apoia comparar árvores, ensembles e redes; não identifica um algoritmo universalmente mais lucrativo. Os estudos abaixo são de ações. Transferir seus resultados para ETHUSDT com sinais5min exige uma nova avaliação, com custos e regras de execução do nosso bot.

| Estudo e fonte primária | O que foi comparado e encontrado | Implicação para este projeto |
|---|---|---|
| [Gu, Kelly e Xiu (2020), Empirical Asset Pricing via Machine Learning](https://www.aqr.com/insights/research/journal-article/empirical-asset-pricing-via-machine-learning) | Comparação de modelos na previsão de retornos e prêmios de risco de ações. Árvores e redes tiveram os melhores resultados no cenário estudado; interações não lineares ajudaram. Momento, liquidez e volatilidade estavam entre os sinais dominantes. | Incluir ensembles e uma rede pequena junto a referências simples. O problema de precificação de ações não equivale ao nosso scalping. |
| [Krauss, Do e Huck (2017), Deep neural networks, gradient-boosted trees, random forests](https://www.sciencedirect.com/science/article/abs/pii/S0377221716308657) | Comparação de DNN, boosting e Random Forest em arbitragem estatística diária de ações doS&P500,1992–2015. Random Forest liderou os modelos individuais; a combinação simples teve destaque. | Justifica testar RF e boosting. Isso não reproduz o artigo: usamos features, ativo, alvo e execução diferentes. Taxas e deterioração temporal impedem tratar o retorno publicado como expectativa atual. |
| [Fischer e Krauss (2018), Deep learning with long short-term memory networks for financial market predictions](https://www.sciencedirect.com/science/article/pii/S0377221717310652) | LSTM superou referências na comparação histórica de ações. O texto do editor relata que, desde2010, seu resultado depois de custos oscilou próximo de zero. | Uma rede pode prever melhor e ainda não remunerar as operações. Precisamos medir resultado líquido e estabilidade por período. A MLP desta rodada não é uma reprodução daLSTM. |
| [Ghosh, Neufeld e Sahoo (2021, versão2), Forecasting directional movements…](https://arxiv.org/abs/2004.10178) | LSTM e RF noS&P500,1993–2018. Acrescentar informações de abertura e retorno intradiário melhorou os resultados descritos; os retornos destacados no resumo são antes de custos. A estratégia seleciona ações para posições intradiárias diárias. | Melhorar a representação dos dados pode importar tanto quanto mudar o modelo. Não confundir “intradiário” diário em várias ações com operações de minutos num único criptoativo. |

Escopo da leitura: página dos autores/AQR e resumo do arXiv; para os dois artigos daElsevier, resumo e trechos públicos do editor retornados pela busca. O acesso direto ao texto integral daElsevier não foi disponibilizado. Não afirmamos ter auditado ou reproduzido integralmente esses trabalhos.

## Escolha implementada

A rodada local compara referência constante, regressão logística, árvore de decisão, Random Forest, Extra Trees, gradient boosting por histogramas e redeMLP. São13 configurações registradas antes da rodada; o perfil noturno repete florestas eMLP em5 sementes e usa a média dos scores por configuração. Não escolhe a semente mais rentável.

Essa é uma decisão de engenharia para nossa base tabular pequena, não um ranking universal. LSTM, reforço e transformers ficam para uma hipótese posterior: exigiriam outras representações e um protocolo próprio. Aumentar complexidade agora tornaria mais difícil identificar se o ganho veio dos dados, da seleção ou do modelo.

O modelo recebe12 entradas já calculadas no instante de cada sinal: lado, RSI,ATR/preço, volume relativo, distâncias deVWAP/EMAs, alinhamentos1h/4h, custo/stop e delta taker. O alvo é lucro líquido de uma operação isolada sob custos dobrados. A regra financeira continua responsável por execução, stops, saídas, risco, intervalos e pausas.

## Como avaliar a hipótese

1. Separar cronologicamente9 meses de treino,3 de validação e3 posteriores de teste. Remover exemplos cujos resultados ainda não estariam disponíveis na fronteira.
2. Ajustar normalização somente no treino. Desativar validação interna aleatória para parada antecipada.
3. Escolher configuração e limiar apenas na validação anterior, usando resultado financeiro com custos normais e dobrados, cobertura, quantidade de operações e queda máxima.
4. Publicar resultados posteriores de todos os algoritmos, do controle e da opção de caixa. Uma perda menor não é aprovação para operar.
5. Exigir nova observação prospectiva antes de qualquer conclusão operacional. Todos os meses desta rodada já haviam sido examinados no projeto: ela é exploratória.

Os testes medem previsões fora da janela de ajuste, mas isso não elimina a seleção decorrente de pesquisas anteriores. Intervalos mensais em blocos são diagnósticos de incerteza; não transformam este histórico conhecido em validação independente.

ParaCPU, cada processo usa uma thread nativa e as florestas usam `n_jobs=1`; o paralelismo fica entre tarefas. Isso evita multiplicar10 processos por10 threads. Referência técnica: [documentação oficial de paralelismo do scikit-learn](https://scikit-learn.org/stable/computing/parallelism.html).
