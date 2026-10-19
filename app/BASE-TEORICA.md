# Base teórica do Trend Lab

Adotamos os guias enviados como catálogo de hipóteses. Eles não demonstram quais estratégias serão mais rentáveis para ETHUSDT, este capital e nossos custos. As regras propostas são nossas traduções para teste, não métodos validados pelos autores. O plano completo e exportável está em `web/data/theory-plan.json`.

| Família | Uso no laboratório |
|---|---|
| Rompimento e tendência | Preservar os testes existentes como controles. Os resultados são mistos. Open interest não foi coletado nem usado. |
| Range | Próxima candidata: rejeição de uma borda de canal anterior, com regime lateral definido antes da entrada. Diferente do teste Bollinger já realizado. |
| Pullback no VWAP | Segunda candidata: retorno ao VWAP a favor da direção4h, usando fechamento e abertura seguintes. |
| Scalping | Laboratório local5min/1min: EMA/VWAP/volume e Bollinger/RSI, com controle EMA9/21. As três hipóteses perderam em abril e maio2025. Não valida segundos ou microestrutura. |
| SMC e liquidity sweeps | Transformar em falso rompimento mensurável, sem inferir identidade ou intenção dos participantes. |

## Regras propostas e depois testadas

**Range:** sinal15min; canal dos32 candles anteriores; regime lateral se abs(EMA16−EMA64)/ATR14 no último4h completo for <=0,5. Pavio toca uma borda e fechamento volta ao canal; se tocar ambas, ignorar. Entrada seguinte, stop1,5ATR de15min, alvo no meio do canal conhecido, máximo12h e intervalo4h após saída. Rejeitar alvo já ultrapassado. Sem RSI adicional na primeira versão.

**VWAP:** sinal15min, direçãoEMA16/64 de4h e reinício diário00:00UTC; exigir4 candles do dia completos. Long: fechamento anterior acima do VWAP anterior, mínima atual toca esse VWAP e fechamento volta acima do VWAP atual; short simétrico. Entrada seguinte, stop1,5ATR, alvo2R, máximo24h e intervalo4h após saída. Ignorar mudança de dia e volume acumulado zero.

O limiar0,5 e os demais detalhes foram registrados antes da análise, sem busca pelo melhor resultado. A primeira versão de VWAP usará preço típico ponderado por volume: uma aproximação por candle. Uma versão por volume em moeda de cotação exige recuperar esse campo dos arquivos oficiais e será outro experimento.

## O que os indicadores permitem afirmar

RSI14 mede momentum; 30/70 não obrigam o preço a reverter. Médias e MACD compartilham informação do preço: não representam confirmações independentes só por terem nomes diferentes. Volume ajuda a descrever participação, mas não certifica que um rompimento continuará. Um pavio não prova que uma instituição caçou stops.

A escolha entre tendência e range também é hipótese. Não montaremos uma combinação escolhendo retrospectivamente a melhor estratégia de cada período.

## Avaliação

Manter R$300 simulados, risco1%, hipótese10x, custos e limites existentes. Primeiro verificar causalidade e implementar as regras; depois congelar e testar cada hipótese isoladamente, publicando perdas nos mesmos períodos conhecidos. Separar a conta de custos nas mesmas operações de uma nova simulação que muda a carteira. Medir expectativa líquida, drawdown, amostra e custos. A rodada prospectiva existente fica intacta; notícias continuam valendo somente a partir de seu registro. Os resultados da execução posterior estão registrados na seção final.

## Referências consultadas

- [IG: crypto day trading](https://www.ig.com/au/crypto-need-to-knows/crypto-day-trading): famílias e custos; o produtoCFD não equivale ao perpétuo da Binance.
- [Kraken: day trading strategies](https://www.kraken.com/learn/day-trading-strategies): planejamento de entradas/saídas e exigências de execução.
- [Gemini: day trading crypto](https://www.gemini.com/es/cryptopedia/day-trading-crypto): terminologia dos indicadores.
- [LiteFinance: crypto strategies](https://www.litefinance.org/blog/for-beginners/how-to-trade-crypto/crypto-day-trading-strategies/): inspiração conceitual, sem endossar alegações de eficácia.
- [TradingView: VWAP](https://www.tradingview.com/support/solutions/43000502018-volume-weighted-average-price-vwap/): fórmula por preço típico e âncora.
- [TradingView: RSI](https://www.tradingview.com/support/solutions/43000502338-relative-strength-index-rsi/): cálculo e interpretação contextual.

## Execução posterior do plano

As duas hipóteses acima foram implementadas sem otimização e avaliadas nos quatro períodos históricos conhecidos. Os resultados constam em `web/data/range-vwap-results.json` e no painel; ambas perderam em todos os blocos com custos base. O JSON do plano inicial foi preservado como arquivo histórico, enquanto `range-vwap-protocol.json` e seu congelamento registram a rodada efetivamente executada. Nenhuma conclusão futura foi atribuída a esses backtests.

## Scalping5min/1min · rodada posterior

O catálogo enviado em16/10/2026 foi traduzido em `scalping-protocol.json`, registrado antes dos resultados. O controle cruzaEMA9/21. A primeira candidata combina direçãoEMA9/21, pullbackVWAP eRVOL≥1,2; a segunda combina retorno àsBandas20±2σ com saída doRSI14 de um extremo30/70. ATR14 determina stop1,5ATR, alvo2R nas hipóteses de tendência eSMA20 conhecida na reversão, duração máxima30min e intervalo10min após saída.

A nova coleta preserva quote volume e taker buy base volume: VWAP=sum(quote)/sum(base) no diaUTC; delta=2×taker buy base−base total. MACD12/26/9 e delta são informativos, sem votos adicionais. O VWAP exato desta rodada não substitui a aproximação congelada dos estudos anteriores.

89.280 candles1min, incluindo um dia de aquecimento e dois meses completos, foram verificados por checksum e reconciliados comOHLC1h. Execução1min ainda não observa a sequência de ticks, filas, spread real ou latência. Os12 cenários publicados mantêm custos base/dobrados e os limites anteriores. Os seis cenários base atingiram perda aproximada de10%; não houve melhora financeira demonstrada. Os períodos já eram conhecidos em resolução maior e continuam exploratórios.
