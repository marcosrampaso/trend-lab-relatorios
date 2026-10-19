# Scalping: duração, contexto e aprendizado

A rodada de18/10/2026 comparou96 cenários exploratórios noETHUSDT: abril/maio2025, três famílias, quatro durações (30/60/120/240min), com/sem alinhamento1h+4h e custos base/dobrados. **Nenhum cenário terminou positivo;78 atingiram a parada global.**

O replay está em [Scalping ·5min](http://127.0.0.1:4173/?view=scalping). Os controles originais continuam disponíveis. Mais tempo não altera o candle de sinal5min, o stop, o alvo ou o risco.

## Comparação VWAP

Cada mês começa comR$300, câmbio hipotéticoR$5/USDT. Valores líquidos modelados antes de impostos.

| Mês | Prazo | Contexto | Base | Custos2× | Operações base |
|---|---:|---|---:|---:|---:|
| Abril | 30min | Sem filtro | R$ -30,49 | R$ -30,69 | 48 |
| Abril | 60min | Sem filtro | R$ -30,68 | R$ -31,13 | 53 |
| Abril | 120min | Sem filtro | R$ -30,65 | R$ -30,73 | 53 |
| Abril | 240min | Sem filtro | R$ -30,34 | R$ -30,25 | 53 |
| Abril | 30min | 1h+4h | R$ -21,57 | R$ -29,06 | 24 |
| Abril | 60min | 1h+4h | R$ -21,56 | R$ -28,26 | 23 |
| Abril | 120min | 1h+4h | R$ -29,52 | R$ -30,84 | 22 |
| Abril | 240min | 1h+4h | R$ -30,03 | R$ -30,78 | 21 |
| Maio | 30min | Sem filtro | R$ -30,28 | R$ -30,67 | 47 |
| Maio | 60min | Sem filtro | R$ -30,41 | R$ -30,55 | 42 |
| Maio | 120min | Sem filtro | R$ -30,59 | R$ -30,53 | 45 |
| Maio | 240min | Sem filtro | R$ -30,36 | R$ -30,78 | 25 |
| Maio | 30min | 1h+4h | R$ -10,24 | R$ -18,00 | 21 |
| Maio | 60min | 1h+4h | R$ -12,42 | R$ -19,86 | 21 |
| Maio | 120min | 1h+4h | R$ -10,07 | R$ -19,48 | 21 |
| Maio | 240min | 1h+4h | R$ -10,14 | R$ -22,55 | 21 |

O contexto reduziu perdas em alguns casos, mas mais tempo não trouxe melhora consistente. Mesmo oVWAP30min alinhado continuou negativo nos dois meses, inclusive sob custos dobrados. Diferenças de centavos entre carteiras interrompidas perto de−10% não indicam vantagem. Não somar retornos dos meses. As96 combinações não são96 amostras independentes.

## Decisão em múltiplos períodos

- **5min:** gatilho original EMA9/21, VWAP+volume ou Bollinger+RSI.
- **1h e4h:** EMA20/50 com150 candles de aquecimento, calculada desde o histórico2020.4h alinhado aUTC. Somente fechamentos já disponíveis no sinal.
- **Observar:** mostra direção e conflito sem vetar. **Filtrar:** exige1h e4h no lado do gatilho; contexto indisponível veta. O filtro só impede entradas: sinais contrários continuam encerrando posições.
- A tendência ampla é contexto operacional de4h, não uma previsão macro. Não são votos independentes nem probabilidades de lucro. Na reversão, o filtro pode eliminar oportunidades legítimas; por isso há controle separado.

## Aprendizado com resultados: protocolo registrado, ainda não treinado

Aprender exige exemplos vencedores e perdedores, inclusive gatilhos vetados; os resultados hipotéticos de operações isoladas devem ser identificados separadamente do caixa real da carteira. Nunca aumentar risco para recuperar perdas.

1. Ampliar candles1min, mark price e funding para pelo menos24 meses de regimes variados. O histórico horário maior já existente não substitui execução1min. Reservar os últimos3 meses antes de ajustar; dados já inspecionados seguem exploratórios.
2. Treinar uma árvore rasa de veto de entrada (profundidade3, mínimo100 exemplos por folha). Entradas: família/lado, RSI, ATR/preço, volume relativo, distâncias deVWAP/EMA, contexto1h/4h e custo/stop. Rótulos só disponíveis245min após o sinal; purgar fronteiras sobrepostas.
3. Retreinar mensalmente em janela móvel de12 meses:9 treino +3 validação. Congelar antes de testar o mês seguinte; comparar controle sem filtro, modelo fixo e modelo com retreino. Duração e limiar são escolhidos na validação, nunca depois de olhar o teste.
4. Medir expectativa líquida, custos, drawdown, operações, motivos de saída e diferenças por blocos temporais. Usar incerteza em blocos e considerar as múltiplas variantes; não tratar operações próximas como independentes.
5. Critérios de pesquisa propostos:6 meses posteriores,200 operações agregadas, resultado líquido positivo com custos dobrados, intervalo95% da diferença contra controle acima de0 e drawdown sem deterioração material. Se não passar, rejeitar o candidato; depois ainda é necessária avaliação prospectiva separada. Esses números são gates de pesquisa, não garantia estatística universal.

Os dois meses atuais não sustentam aprovação de aprendizado adaptativo. Nenhum modelo de scalping foi treinado nesta rodada. Os modelos já existentes na abaIA usam1h e permanecem preservados.

## Verificação e limites

1488 horas deOHLC reconciliadas entre as bases1min/1h; os12 controles30min/observar reproduzem exatamente caixa e operações anteriores. Testes cobrem candle4h fechado, futuro adulterado, veto só de entrada e contabilidade/prazo. Build verifica os hashes originais e da nova rodada.

A revisão encontrou e corrigiu antes da publicação uma primeira implementação que removia sinais do registro e, assim, também removia saídas contrárias. Essa saída foi descartada; o relatório publicado usa veto somente de entrada. O ajuste está registrado no protocolo. Esta análise permanece exploratória.

Reproduzir: `node scripts/analyze-scalping-context.mjs`. Dados e resultados: `web/data/scalping-context-results.json`. Hashes: `scalping-context-freeze.json`. O comando confirma o relatório existente sem sobrescrever divergências.

Execução modelada1min, stop prioritário em conflito, mark price e liquidação aproximada; funding incluído. Sem livro, fila, latência ou spread observados. Filtros da corretora atuais aplicados retroativamente e câmbio fixo; taxas não representam necessariamente a conta pessoal.

Referências: [validação temporal e gap](https://scikit-learn.org/stable/modules/generated/sklearn.model_selection.TimeSeriesSplit.html) e [prevenção de vazamento de dados](https://scikit-learn.org/stable/common_pitfalls.html#data-leakage).
