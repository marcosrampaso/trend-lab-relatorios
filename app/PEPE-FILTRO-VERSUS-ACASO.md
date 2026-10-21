# Filtro de custos versus descarte aleatório

Experimento `pepe-entry-random-v1`, concluído em 21/10/2026.
Painel: http://127.0.0.1:4173/pesquisa-genetica/filtro-aleatorio.html

## Pergunta e desenho

O filtro ATR/custo reduziu a perda média mensal de −R$52,98 para −R$2,83, mas reduziu a atividade de 115 para 16 operações. Comparamos sua escolha de sinais com escolhas aleatórias de mesma quantidade mensal antes de decidir se isso justifica um novo modelo.

O protocolo, fontes e 200 sementes (10001 a 10200) foram registrados antes de simular os sorteios. Não houve busca de sementes, nova tentativa ou escolha do melhor resultado. Cada sorteio seleciona sem reposição exatamente 7 de 48 sinais em abril, 2 de 5 em maio, 5 de 19 em junho, 2 de 34 em julho e 0 de 25 em setembro de 2024. Os IDs são ordenados pelo SHA-256 de versão/semente/mês/ID; a atribuição não consulta preço, indicadores ou retorno. A ordem temporal original é preservada para executar.

Todos usam a mesma agenda G91, escada+lock0,25R, decisão de 5min/execução1min, risco1%, limites diário/global3%/10%, custos de estresse, ticks, lotes, funding ocorrido e alavancagem original10×/15×. São carteiras R$1.000 independentes por mês, contínuas dentro dele; não compor reinícios mensais. Setembro permanece em todas as médias sem ordens. Conversão de pesquisa fixa R$5/USDT; CDI bruto nos mesmos calendários, antes de impostos.

Igualamos **sinais aceitos**. Não impusemos igualdade de duração, notional, direção, volatilidade ou taxas. As ordens preenchidas e a exposição são resultados, e nenhuma semente seria descartada por ficar em caixa ou atingir limites. Na execução realizada, todas as sementes preencheram exatamente as 16 entradas.

## Resultado principal

Cada número abaixo é a média de cinco resultados mensais independentes, não lucro acumulado de uma carteira composta.

| Referência | Líquido mensal médio |
|---|---:|
| Todos os sinais, sem filtro | −R$52,98 |
| Filtro ATR/custo congelado | −R$2,83 |
| Aleatório: média das 200 médias | −R$6,44 |
| Aleatório: mediana | −R$6,52 |
| Aleatório: percentil2,5 | −R$15,62 |
| Aleatório: percentil97,5 | +R$3,84 |
| Aleatório: mínimo / máximo | −R$20,86 / +R$9,65 |
| Caixa sem rendimento | R$0,00 |
| CDI bruto médio | +R$8,50 |

O filtro ficou no **percentil78**: 156 das 200 médias aleatórias foram inferiores e 44 foram iguais ou superiores (22%; não houve empate no agregado). A fração superior com correção de mais um foi45/201=22,39%. É uma medida descritiva de Monte Carlo condicionada à agenda e contagens, **não um p-valor formal**, acurácia ou probabilidade de lucro futuro.

O filtro foi melhor que a mediana em R$3,69 mensais, mas ficou dentro da faixa central das simulações e continuou negativo. Isso não demonstra ausência de qualquer efeito; tampouco demonstra uma seleção excepcional além da menor atividade sob este controle. Não escolher o máximo aleatório como campeão: seria seleção posterior nos mesmos dados, sem política preditiva validada.

## Meses e atividade

| Mês | Aceitos/disponíveis | Filtro | Mediana aleatória | Percentil do filtro |
|---|---:|---:|---:|---:|
| Abr/2024 | 7/48 | −R$15,16 | −R$24,27 | 68 |
| Mai/2024 | 2/5 | −R$8,86 | −R$7,95 | 15,25 |
| Jun/2024 | 5/19 | +R$16,79 | +R$0,92 | 86 |
| Jul/2024 | 2/34 | −R$6,94 | −R$6,20 | 45 |
| Set/2024 | 0/25 | R$0,00 | R$0,00 | 50; todos empatados |

As escolhas não foram consistentemente superiores em todos os meses. Setembro é um resultado sem atividade, não uma observação de habilidade de seleção.

O filtro pagou R$16,78 em taxas nas cinco carteiras; os sorteios tiveram mediana R$23,81 (mínimoR$21,53, máximoR$27,15). Horas totais expostas: filtro11,67h, mediana aleatória11,63h (4,73–27h). Operações:16 em todos. Queda máxima média: filtro1,28%; mediana aleatória1,53%. Portanto, a defesa de custos tem uma diferença contábil observada mesmo com quantidade igual, mas essa diferença não basta para afirmar capacidade de prever retornos ou superar CDI.

## Limitações e decisão

São 200 repetições dos mesmos cinco meses, não 200 mercados independentes. A quantidade K é condicionada ao total já conhecido do filtro no mês completo: o controle não é uma política online executável. Os sinais do G91 são uma agenda selecionada por uma política já treinada e escolhida com esses históricos. A comparação não iguala todos os determinantes de exposição e não corrige a pesquisa anterior. A faixa2,5–97,5% é um envelope dos sorteios, não um intervalo de confiança de lucro futuro.

**Nenhuma promoção, mudança de limiar ou treino novo.** O filtro continua reprovado no estudo anterior, com média negativa, só16 operações e1/5 meses acima do CDI. Mesmo um resultado incomum neste controle não reverteria automaticamente esses critérios. O próximo problema de pesquisa é avaliar entradas pelo retorno líquido sob saída fixa; não procurar sementes ou cortes que tornem este recorte positivo.

Nenhum calendário de2025 ou setembro/2026 foi usado em simulação, rótulos ou escolha neste estudo. A verificação de integridade lê bytes dos arquivos já registrados para conferir seus hashes; isso não os incorpora ao calendário de avaliação. Nenhuma janela futura começou.

## Verificação e arquivos

Dez carteiras de referência (cinco sem filtro e cinco com filtro) reproduziram exatamente PNL, número de trades e curvas congeladas. As 1.000 avaliações mensais dos sorteios mantêm todas as sementes e reconciliam bruto − taxas + funding = líquido. Subconjuntos idênticos reutilizam a mesma simulação determinística; foram584 execuções distintas incluindo as dez referências, sem eliminar repetições da distribuição. Houve200/10/197/168/1 subconjuntos distintos por mês, respectivamente.

Quatro testes cobrem reprodutibilidade, contagem sem reposição, independência da ordem de entrada, ausência de consulta a dados futuros, quantis/empates e retenção de meses sem ordens. Fontes e entradas foram verificadas antes/depois; estudos anteriores permaneceram intactos.

Fontes novas: `scripts/{entry-random-core,prepare-entry-random,entry-random-month,run-entry-random}.mjs`; teste `tests/entry-random.test.mjs`.
Protocolo, registro, resultado e ledgers mensais imutáveis: `work/pepe-entry-random-v1/`.
Resultado publicado localmente: `web/data/entry-random.json`; estado operacional separado: `web/data/entry-random-status.json`.
