# Auditoria de entradas e saídas · PEPE

Data:21/10/2026. Página:http://127.0.0.1:4173/pesquisa-genetica/auditoria-entradas.html

## Desenho congelado antes de executar

Depois do piloto PPO negativo, auditamos oportunidade das entradas, momento da decisão e fricção. O protocolo foi registrado em `work/pepe-entry-audit-v1/protocol.json` antes desta execução; fontes e entradas têm hashes em `registration.json`. Nenhum modelo foi treinado, nenhum filtro escolhido e nenhum calendário de2025 ou teste de setembro/2026 foi aberto.

Usamos320entradas congeladas:189de treino original,131de desenvolvimento. Todas permanecem na análise, incluindo59encerradas antes de uma decisão de gestão. São15carteiras independentes de origem, dez meses de treino e cinco de desenvolvimento. PesosG91 já usaram essas histórias: o diagnóstico é retrospectivo e não independente.

As quatro regras mantêm a mesma primeira decisão após5minutos, escada automática25/50/25nos alvos líquidos equivalentes10/20/40%, proteção dos custos após a primeira parcial, custos de estresse, funding, ticks, stops, limites e risco1%. Elas apenas pedem: sair na primeira decisão, esperar, lock líquido0,25R quando possível ou trailing1ATR após1R. Não mudamos prazo máximo do bot; os horizontes5/30/60/240são medidas de valor, não novas regras de encerramento.

A regra esperar com escada reproduziu exatamente320posições e15carteiras do controle anterior. A trajetória passiva por1minuto também reconcilia cada posição com o preenchimento/resultado original. Dados/modelos anteriores não foram modificados.

## Oportunidade líquida antes dos stops/limites

| Métrica | Treino original | Desenvolvimento |
|---|---:|---:|
| Entradas | 189 | 131 |
| Chegam à primeira decisão | 153 | 108 |
| Positivas na marca de5min | 22 | 17 |
| Algum fechamento1m com líquido positivo | 109 | 81 |
| Alguma decisão5m com líquido positivo | 94 | 72 |
| Alvo10% em fechamento de decisão | 65 | 47 |
| Alvo20% em fechamento de decisão | 53 | 34 |
| Alvo40% em fechamento de decisão | 37 | 21 |

Uma posição ficar positiva no passado não significa que o agente poderia prever a hora certa de sair. Os máximos de trajetória não são ganhos realizáveis de um oráculo, taxas de acerto ou fills. A grade1m e a de decisão5m são distintas. Observamos fechamentos conhecidos enquanto a posição está aberta; o fechamento ou máxima/mínima depois de um stop intrabar não entra no diagnóstico. A contagem de estágios realmente preenchidos vem de simulações causais separadas.

Custo mediano de uma ida e volta a preço parado: 0.491R em desenvolvimento e 0.528R no treino. AquiR=quantidade×distância entre entrada e stop inicial, antes de custos. A mediana do movimento para cobrir custos é 0.401% da moeda, antes de funding. A mediana do melhor fechamento líquido observado foi 3.77% da margem original; isso usa o futuro para diagnóstico e não pode virar saída executável.

A maioria das entradas não estava líquida no positivo na primeira decisão. Isso é compatível com as perdas do fechamento precoce, mas não prova que simplesmente esperar tornará a estratégia lucrativa.

## Regras com oportunidade igual · desenvolvimento

| Regra | Média mensalBRL | Queda máxima média | Acima CDI | Δmensal vsPPO liquidação |
|---|---:|---:|---:|---:|
| close_first | -72.86 | 7.41% | 0/5 | -3.59 |
| ladder_wait | -63.12 | 8.85% | 0/5 | 6.16 |
| ladder_lock | -52.98 | 7.24% | 0/5 | 16.29 |
| ladder_trail | -61.97 | 8.56% | 0/5 | 7.30 |

CDI bruto médio dos mesmos cinco meses: R$8.50. A escada+lock reduziu a perda média para R$-52.98, diferença de R$16.29 contra a média das três sementes PPO de liquidação. Ainda perdeu nos5meses e não superou CDI em nenhum. Nenhuma regra foi aprovada ou promovida.

Conversão de pesquisa fixa emR$5/USDT, sem simulação da variação cambialBRL/USDT; CDI bruto antes de impostos. Uma carteiraR$1000 por mês, contínua dentro dele; não somar/compôr meses. A agenda de entrada permanece a original, sem criar sinais em espaços deixados por saídas rápidas. Tamanho usa saldo próprio e risco1%; limites/sobreposição podem impedir sinais, então o número de posições executadas pode diferir entre regras.

## Comparação pareada por posição

| Regra | Δmédio/posição vsPPO liquidação | Melhor/pior/igual | Estágios10/20/40executados |
|---|---:|---:|---:|
| close_first | -0.450 | 23/35/73 | 1/0/0 |
| ladder_wait | -0.207 | 43/46/42 | 47/22/11 |
| ladder_lock | 0.244 | 55/34/42 | 24/11/6 |
| ladder_trail | -0.136 | 46/43/42 | 40/15/3 |

Cada posição começa no preço, quantidade e estado anterior congelados. Posições alternativas podem se sobrepor, então a soma não é rentabilidade de carteira. Essa pergunta difere da carteira mensal com capital e tamanhos próprios. Na comparação PPO, usamos os seis pesos FINAIS previamente arquivados e agregamos três sementes por grupo; não escolhemos checkpoint ou semente favorável.

## Horizontes e censura

| Horizonte | Conhecidas | Censuradas | Positivas | Líquido médioBRL/posição |
|---|---:|---:|---:|---:|
| 5min | 131 | 0 | 17 | -3.534 |
| 30min | 131 | 0 | 43 | -2.964 |
| 60min | 131 | 0 | 39 | -2.888 |
| 240min | 130 | 1 | 25 | -4.155 |

Valores são liquidações hipotéticas no fechamento conhecido; se a posição fechou antes naturalmente, usamos o resultado realizado. Não são ordens de saída no próximo open nem rendimento de estratégia com limite de tempo. Um recorte censurado após240min fica explícito e não entra na média disponível: os denominadores podem diferir e essas médias não devem escolher um prazo ótimo.

## Contextos pré-entrada e limites

Grupos registrados: lado, alavancagem original, tendência1h/4h, RSI, RVOL, custo/R e faixasUTC de6h. São descrições, não filtros. Sinalizamos grupos com menos de20casos; uma categoria lucrativa pequena ou concentrada em maio/2024 não demonstra vantagem. Todas as131entradas de desenvolvimento originais usaram15×; não há amostra10× para inferir superioridade de alavancagem.

Os diagnósticos não isolam uma causa única. Custos são grandes em relação ao risco de preço; o PPO encerra cedo; uma regra de proteção simples perde menos, mas ainda perde. As entradas não sustentaram vantagem financeira com nenhuma das quatro saídas registradas nestes cinco meses. Isso não comprova que todas as entradas possíveis ou o mercado são intrinsecamente inviáveis.

## Próxima hipótese, ainda sem novo treino

Registrar uma hipótese de entrada com custo compatível com o movimento esperado, mantendo uma regra simples de proteção como controle. Uma alteração por vez, dados/risco/custos fixados antes da execução e avaliação futura reservada após congelar escolhas. Não transformar os melhores grupos retrospectivos desta auditoria em um filtro treinado no mesmo calendário.

Artefatos: `work/pepe-entry-audit-v1/{protocol,registration,result}.json`; publicação local `web/data/entry-audit.json`; código `scripts/{entry-audit-core,prepare-entry-audit,run-entry-audit}.mjs`. Pesos/dados brutos ficam locais.
