# PEPE: estimar chance, ganho e perda antes da entrada

Concluído em 2026-10-21T21:34:06.198000+00:00. Experimento local, exploratório e sem ordens reais.

## Pergunta e método

Depois dos estudos de saídas, investigamos se os 19 indicadores já conhecidos conseguem selecionar operações com expectativa líquida positiva. O ganho médio é muito menor que a perda média neste protocolo; melhorar a frequência de acertos, isoladamente, pode não resolver isso.

Mantivemos as saídas originais de cinco minutos. A proteção de um minuto do estudo anterior não foi adotada neste experimento, para modificar somente a entrada. Mantidos stop, escada, risco de 1%, alavancagem de 15×, limites, ticks, custos de estresse e funding. Os resultados-alvo já são líquidos; não se descontam custos novamente na fórmula.

Expectativa = P(lucro) × ganho líquido médio condicional − [1 − P(lucro)] × perda líquida média condicional.

Comparamos regressão logística (probabilidade variável, ganhos/perdas médios fixos do treino) e boosting raso (classificador mais dois regressores de magnitude). Cada família tem compra e venda separadas. O controlador entra somente acima do limiar fixo de 0,1R; empates ficam em caixa. Um R é o orçamento inicial de risco de R$ 10 na oportunidade isolada de R$ 1.000.

## Calendário congelado

- Treino: junho–dezembro de 2023.
- Calibração sigmoide da probabilidade: janeiro–fevereiro de 2024.
- Diagnóstico, sem seleção de parâmetros: março de 2024.
- Avaliação: abril, maio, junho, julho, setembro, outubro, novembro e dezembro de 2024.

Foram excluídos resultados não amadurecidos até o fim da respectiva etapa menos 30 minutos. Scaler, classificador e regressores usam somente o treino. A calibração usa somente janeiro–fevereiro. Março não escolhe variáveis nem limiares. Não houve busca genética, ajuste em meses vencedores, troca de seed ou mudança de parâmetros após os resultados.

Todos esses calendários já tinham sido vistos em pesquisas anteriores. A separação cronológica neste código reduz vazamento dentro do novo ajuste, mas não restaura a independência do histórico. Esta rodada não tem teste final independente.

## Resultados de todas as políticas

São 48 carteiras mensais independentes: duas famílias × três modos × oito meses. Cada carteira começa com R$ 1.000; a média abaixo inclui os meses em caixa. Não se compõem reinícios mensais. CDI bruto médio nos mesmos oito calendários: R$ 8,63 por mês, antes de impostos, com câmbio fixo de R$ 5/USDT no bot.

| Política | Posições | Líquido mensal médio | Meses acima do CDI | Meses sem ordens |
|---|---:|---:|---:|---:|
| logistic-long | 12 | R$ -0,53 | 0/8 | 4/8 |
| logistic-short | 12 | R$ 0,24 | 1/8 | 6/8 |
| logistic-combined | 14 | R$ 1,59 | 1/8 | 4/8 |
| payoff_boost-long | 1 | R$ 0,24 | 0/8 | 7/8 |
| payoff_boost-short | 3 | R$ 2,34 | 1/8 | 6/8 |
| payoff_boost-combined | 4 | R$ 2,58 | 1/8 | 5/8 |

O boosting combinado produziu quatro posições positivas, mas a amostra é muito pequena:

| Mês | Direção | Líquido da posição |
|---|---|---:|
| 2024-04 | Venda | R$ 11,93 |
| 2024-11 | Compra | R$ 1,91 |
| 2024-12 | Venda | R$ 2,13 |
| 2024-12 | Venda | R$ 4,67 |

Em abril, o ganho de R$ 11,93 superou o CDI de R$ 8,87 daquele mês. Nos oito meses, a média de R$ 2,58 ficou abaixo dos R$ 8,63 do CDI. Quatro acertos não demonstram uma taxa de acerto futura de 100%.

## O que aprendemos

No treino, ganhos médios de aproximadamente 0,36–0,38R e perdas médias de aproximadamente 0,88R exigem cerca de 70%–71% de operações positivas para empatar com aquela distribuição. Esse percentual de equilíbrio usa médias observadas; não é uma garantia nem um novo limiar de entrada.

AUC no diagnóstico de março ficou aproximadamente entre 0,56 e 0,58, dependendo da família e do lado. A ordenação dos resultados é limitada e menor que no treino. Melhorar Brier em relação à probabilidade constante não comprova lucro nem mede exclusivamente calibração.

As faixas de expectativa positiva têm poucos casos em março: o boosting selecionou uma compra e nenhuma venda naquele bloco. Por isso não há suporte suficiente para validar a cauda que depois gerou as quatro operações. O suporte mínimo de 50 é apenas uma marca diagnóstica pré-registrada, sem filtro acrescentado depois.

Os deslocamentos dos grupos de indicadores por 7, 14 e 21 dias são descritivos. Não escolhem novas variáveis, não refazem o treino e não identificam relações causais. Todas as sensibilidades são publicadas, incluindo valores negativos.

## Decisão

Arquivar os quatro modelos e suas previsões. Não promover para ordens reais nem reduzir o limiar para fabricar mais operações. Para avaliar se o resultado se sustenta, é necessário coletar mais decisões em uma janela futura previamente registrada, preservando o protocolo e reportando caixa, custos, risco e CDI. Este experimento mostra uma hipótese testável de seleção de entradas, não uma estratégia validada.

## Integridade e verificação

Foram reproduzidas exatamente 32 carteiras antigas antes de avaliar os novos sinais. 1424 arquivos/fontes registrados foram conferidos antes e depois. Pesos e previsões são imutáveis e têm SHA-256; permanecem no armazenamento local de pesquisa. O GitHub recebe código e relatórios, sem pesos, candles, credenciais ou estado privado de execução.

Validação: 9 testes Python, 19 testes Node e conferência no navegador das 48 combinações de carteira, 36 diagnósticos e layout móvel. O alias de importação Python resolve para os mesmos bytes do núcleo registrado; não alterou protocolo, hipóteses ou cálculos.

## Fontes técnicas

- [Calibração de probabilidades — scikit-learn](https://scikit-learn.org/stable/modules/calibration.html)
- [HistGradientBoostingRegressor — scikit-learn](https://scikit-learn.org/stable/modules/generated/sklearn.ensemble.HistGradientBoostingRegressor.html)

Página local: http://127.0.0.1:4173/pesquisa-genetica/ganho-perda-entradas.html

Reprodução: scripts/prepare-payoff-entry.mjs, scripts/train-payoff-entry.py e scripts/evaluate-payoff-entry.mjs, com os dados e artefatos restaurados. Não executar a preparação por cima do registro atual: os scripts recusam sobrescrever a pesquisa concluída.
