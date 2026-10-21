# Uma mudança de entrada: amplitude conhecida versus custos

Estudo concluído em 21/10/2026. Painel local: http://127.0.0.1:4173/pesquisa-genetica/filtro-custos.html

## Por que fizemos este teste

A auditoria anterior mostrou custos grandes em relação ao risco de preço e resultados negativos com quatro saídas simples. Registramos uma hipótese única: só aceitar um sinal se o ATR conhecido de 5 minutos cobrir pelo menos duas vezes o custo estimado de entrar e sair a preço parado. O múltiplo 2 foi fixado antes de executar; não houve busca de cortes ou escolha dos grupos retrospectivos mais lucrativos.

ATR é amplitude recente, não previsão de retorno ou direção. O filtro usa apenas lado do sinal, fechamento e ATR conhecidos no instante da decisão, além das taxas/slippage/tick congelados. Estima preenchimentos adversos nas duas pontas e ambas as taxas. Funding futuro fica fora dessa estimativa; funding ocorrido permanece na contabilidade. Não consulta próxima abertura, preço real de entrada, retorno futuro, máxima favorável ou resultado original.

## O que ficou fixo

- Mesma agenda congelada de 320 sinais G91: 189 de treino original e 131 de desenvolvimento.
- Uma carteira independente de R$1.000 por mês e por grupo, contínua dentro do mês. São 15 meses e 30 carteiras; não compor os reinícios mensais.
- Risco 1%, limites diário/global 3%/10%, alavancagem do sinal 10×/15×, custos de estresse, funding, stops, ticks e lotes.
- Saída escada + proteção de 0,25R nos dois grupos, com a mesma primeira decisão após cinco minutos e sem novo prazo máximo.
- Escada 25%/50%/25% nos alvos líquidos equivalentes de 10%/20%/40% sobre a margem original; não são percentuais do patrimônio da carteira.
- Conversão fixa de pesquisa R$5/USDT, sem variação cambial, CDI bruto diário antes de impostos nos mesmos períodos.

Rejeitar um sinal deixa caixa ocioso. Não regeneramos oportunidades que o G91 original deixou de emitir enquanto estava em outra posição. Este é um experimento controlado de veto em uma agenda fixa; não é um bot de entradas completo. Cada grupo usa seu próprio saldo para dimensionar posições e conserva seus próprios limites. Meses sem trades entram nas médias.

## Resultados: desenvolvimento

| Medida | Sem filtro | Com filtro |
|---|---:|---:|
| Sinais aceitos / disponíveis | 131/131 | 16/131 |
| Operações executadas | 115 | 16 |
| Líquido mensal médio | −R$52,98 | −R$2,83 |
| Queda máxima média | 7,24% | 1,28% |
| Meses negativos | 5/5 | 3/5 |
| Meses sem operações | 0/5 | 1/5 |
| Meses acima do CDI | 0/5 | 1/5 |

CDI bruto mensal médio: +R$8,50. Diferença mensal média contra controle: +R$50,15; mediana: +R$69,09. Diferença positiva aqui significa menor perda relativa, não lucro.

| Mês | Sem filtro | Com filtro | CDI bruto | Aceitos / disponíveis |
|---|---:|---:|---:|---:|
| 2024-04 | −R$100,19 | −R$15,16 | +R$8,87 | 7/48 |
| 2024-05 | −R$14,56 | −R$8,86 | +R$8,32 | 2/5 |
| 2024-06 | −R$1,43 | +R$16,79 | +R$7,88 | 5/19 |
| 2024-07 | −R$79,65 | −R$6,94 | +R$9,07 | 2/34 |
| 2024-09 | −R$69,09 | R$0,00 | +R$8,35 | 0/25 |

Nas cinco carteiras independentes, taxas somaram R$184,87 sem filtro e R$16,78 com filtro. O bruto com slippage já embutido foi −R$80,05 e +R$2,61, respectivamente; funding aproximadamente zero. Esses totais são decomposição contábil, não uma carteira composta. O filtro reduziu muito a exposição: sem um controle de veto aleatório equivalente não isolamos vantagem preditiva além da redução de atividade. Ficar integralmente em caixa também teria resultado R$0 antes de rendimentos e custos; a média filtrada ainda ficou abaixo disso.

Nos dez meses do treino original, o filtro aceitou 33/189 sinais, executou 33 operações, teve média mensal −R$7,81 contra −R$50,88 e superou CDI em 0/10. Houve três meses sem operações, mantidos na média.

## Decisão pelo protocolo

Foram exigidos: líquido médio positivo, diferenças média e mediana positivas, superar CDI em pelo menos 3/5 meses e pelo menos 30 operações de desenvolvimento. Apenas as duas diferenças passaram. **Hipótese não avançou. Nenhuma promoção, retreino ou mudança no bot.** Não vamos alterar o múltiplo após olhar este resultado nem chamar junho isolado de comprovação.

Os históricos e o gerador G91 já foram usados em pesquisas anteriores, inclusive no treino/seleção de seus pesos. Os dois recortes são retrospectivos, não validação independente. Não consumimos 2025 ou setembro de 2026 neste teste. Nenhuma janela futura foi aberta ou iniciada. Uma confirmação futura requer candidato congelado e um protocolo prospectivo próprio.

## Verificação e preservação

O protocolo e os hashes foram gravados antes dos resultados. Os 1.222 arquivos herdados e as quatro fontes novas foram conferidos antes/depois. As 15 carteiras sem filtro reproduziram exatamente lucro, quantidade de operações e curvas anteriores. As 30 carteiras reconciliaram bruto − taxas + funding = líquido. Os 320 sinais originais têm decisão e entrada no mesmo timestamp; o veto lê o fechamento conhecido antes de consumir a vela da execução.

Passaram nove testes, incluindo as verificações de causalidade, custos/ticks em compra e venda e ausência de leitura dos resultados futuros. Os arquivos científicos anteriores não foram alterados. O estudo não usa API paga, rede ou ordens reais.

Artefatos: `work/pepe-entry-cost-v1/{protocol,registration,result,status}.json`; publicação local `web/data/entry-cost-gate.json`; implementação `scripts/{entry-cost-gate-core,prepare-entry-cost-gate,run-entry-cost-gate}.mjs`.
