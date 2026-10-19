# Day trade integrado ao laboratório

Pedido de19/10/2026: reaproveitar as estratégias de day trade junto a sentimento e contextoBTC. A comparação anterior estava concentrada noG151 de5min; não avaliava os sinais horários no novo sistema. O experimento antigo de rompimento permanece preservado com a divergência de candle registrada; esta rodada coleta dados e decisões próprias.

Painel: http://127.0.0.1:4173/pesquisa-genetica/daytrade-integrado.html

## O que foi reaproveitado

Funções congeladas `intradayBars` e `prepareDonchian`: cruzamentoEMA9/21, Donchian fixo20h e adaptativo10–40h com volume. Dois ativos, BTCUSDT e ETHUSDT. Quatro variantes por estratégia/ativo: controle, sentimento local, contextoBTC e ambos. São24carteiras independentes comR$1.000 simulados; cada uma tem cenários de custos base e elevados,48cenários contábeis. Não é uma carteira que distribui dinheiro entre24estratégias.

Prazo até24h, stop1,5ATR, alvo2R, intervalo4h após saída; risco1%,10x, limites diário/global e demais controles preservados. Não é encerramento obrigatório à meia-noite nem prazo obrigatório de24h. Execução1m com motor de funding corrigido. Atraso fixo2min depois do sinal, registro após30s de espera para fechamento da hora; adaptação explícita dos testes antigos. Informação ausente não é inventada. Pesos da floresta de scalping não são aplicados a sinais1h. Não houve treino de floresta ou genética nesta etapa.

## Evidências e custos

Mesmo período jun–set/2026 e capital da comparaçãoG151, com todos os24cenários históricos publicados. Somente controle/contextoBTC no histórico; notícias atuais nunca entram no passado. Períodos já vistos, sem holdout independente e sem promoção automática.

ETH Donchian adaptativo/controle: +R$27,04 em80operações no base; +R$67,95 em42operações com custos elevados. BTC EMA/controle: +R$55,16 em47operações no base e−R$20,65 em9operações com custos elevados. Esses exemplos não representam vencedor geral nem lucro futuro; resultados negativos, drawdowns, interrupções e número de operações ficam no painel/JSON.

O filtro de amplitude/custo≥4 é aplicado usando cada hipótese de custo. Assim, aumentar custo pode excluir muitas operações e mudar a trajetória: o cenário de estresse não mantém exatamente as mesmas entradas e quantidades. Não interpretar lucro maior no estresse como benefício de pagar taxas maiores. Exibir resultado líquido, taxas, funding líquido, slippage embutido nos fills, tempo médio e queda máxima. Bruto dos fills já incorpora slippage: não subtrair esse componente novamente ao reconciliar PnL. Gross−fees+funding = resultado líquido nas carteiras históricas encerradas.

Menos operações pode reduzir custos de negociação; prazo maior também aumenta exposição e pode atravessar pagamentos de funding. O desempenho relativo é hipótese a medir, não maior chance de sucesso assumida. [Binance: taxas e funding](https://www.binance.com/en-AE/support/faq/detail/98488a516eb84e3eb34605683dffd554).

## Contexto e notícias

ETH exige correlação72h≥0,60 e BTC1h/4h ambos contra a entrada para vetoBTC. BTC usa sua própria tendência1h/4h, sem correlação consigo mesmo. Sentimento usa o DistilRoBERTa local/revisão/limiares já fixados, com2manchetes direcionais de2veículos eTTL5h desde publicação. Há deduplicação adicional porURL canônica e título normalizado; preserva a primeira versão recebida para não dar peso extra a manchetes atualizadas. Esta melhoria só vale nesta nova rodada; não altera decisões/coletores antigos.

Ausência, futuro, expiração, revisão errada, baixa confiança e amostra insuficiente não vetam. Fonte e horários são congelados antes da entrada. Vetos só impedem entrada, preservam sinais contrários para saída. Não há acesso ao corpo completo das notícias, garantia de veracidade, detecção causal de impacto ou probabilidade de lucro. Sem tokens do chat nem API paga para classificar.

## Operação

```sh
node scripts/local-daytrade.mjs start
node scripts/local-daytrade.mjs status
node scripts/local-daytrade.mjs stop
```

Estado próprio em `work/daytrade-integrated-v1/`;30dias prospectivos. `start` posterior retoma o mesmo registro, sem substituir parâmetros. Respeita pausa do servidor principal, não o reinicia, não toca oSQLite privado. Dados somente de endpoints públicos, filtros próprios dos contratos. Decisões de horas perdidas não são preenchidas. Fontes/protocolo alterados fazem o processo falhar por integridade.

Avaliação retrospectiva em `scripts/evaluate-daytrade.mjs`, reproduzível em diretório novo com os dados originais. Registro antes do cálculo, hashes de entradas/fontes e reconciliação monetária/prazo. JSONs públicos `daytrade-integrated-history.json` e `daytrade-integrated-forward.json`. Custos/filtros atuais/FXfixo5 são aproximações; antes de impostos, sem ordens reais ou alteração do risco para produzir lucro.
