# Resultado da pesquisa de rentabilidade — tendência EMA16/64

Rodada de 16/10/2026 · ETHUSDT perpétuo · Binance Futures · simulação a 10x.

**A estratégia não demonstrou rentabilidade consistente.** Houve lucro no segundo semestre de 2025, mas os três riscos testados perderam no período posterior de janeiro a setembro de 2026. Os cenários foram definidos antes do download ampliado; nenhum resultado desfavorável foi removido.

## Teste posterior: janeiro a setembro de 2026

Capital inicial R$300 em cada cenário. Resultado após custos de negociação modelados, antes de impostos e despesas operacionais. Câmbio fixo hipotético de R$5/USDT.

| Risco por operação | Saldo final | Resultado | Retorno | Operações | Queda máxima em 1h |
|---|---:|---:|---:|---:|---:|
| 1% | R$ 287,76 | -R$ 12,24 | -4,08% | 8 | 4,27% |
| 2% | R$ 269,39 | -R$ 30,61 | -10,20% | 18 | 12,36% |
| 3% | R$ 269,46 | -R$ 30,54 | -10,18% | 16 | 13,66% |

Os cenários de 2% e 3% atingiram o limite global sobre o capital inicial e ficaram parados até o fim. As perdas ultrapassam ligeiramente o limite planejado de 10% por causa da execução e dos custos. A queda desde um pico pode superar esse limite, pois ele é referido ao capital inicial.

## Execução contínua: janeiro de 2025 a setembro de 2026

O capital não é reiniciado entre meses. Esta coluna evita somar retornos de simulações que começam novamente com R$300.

| Risco por operação | Saldo final | Resultado | Retorno | Operações | Queda máxima em 1h |
|---|---:|---:|---:|---:|---:|
| 1% | R$ 300,80 | R$ 0,80 | +0,27% | 12 | 6,77% |
| 2% | R$ 300,28 | R$ 0,28 | +0,09% | 68 | 22,09% |
| 3% | R$ 269,74 | -R$ 30,26 | -10,09% | 27 | 17,09% |

No cenário inicial de 1%, o ganho de aproximadamente R$0,80 em 21 meses é insuficiente para sustentar uma proposta de geração de renda e não cobre necessariamente despesas não modeladas. Há somente 12 operações, com muitas entradas inviáveis pelos mínimos de negociação.

## Como conferir

[Abrir o dashboard privado](https://meu-dinheiro-trend-lab.fizzymoose17.chatgpt.site) e usar a aba Rentabilidade. Todos os períodos, cenários e custos estão disponíveis, além das exportações de operações e do relatório completo.

- Motor: `dist/engine.js`; análise: `scripts/analyze-profitability.mjs`.
- Dados: 16.056 candles horários e 2.007 eventos de funding; 66 arquivos mensais com checksums verificados.
- As 24 horas ausentes de mark price em 29/06/2026 foram recuperadas na API pública oficial, com origem e hash registrados.
- Taxa base de 0,05% por execução; slippage de 0,02%; funding histórico. O estresse dobra taxa e slippage e recalcula o dimensionamento.
- Filtros atuais aplicados retroativamente; liquidação e margem de manutenção aproximadas. Não há reconstrução de ticks ou livro de ofertas.
- Posições abertas são encerradas com custos no fim de cada cenário.
- Sem operação real, treino de IA, otimização nesta rodada ou garantia de retorno futuro.

A regra está fixa em médias de 16/64 candles de 4h, ATR14 e stop de 2×ATR. O relatório diferencia resultado histórico positivo de uma vantagem futura demonstrada.
