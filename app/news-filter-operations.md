# Experimento local de filtro de notícias

Implementado em 19/10/2026 como primeira etapa inspirada no CBITS. Não treina BERT nem altera G151, V6, o motor congelado ou as decisões da rodada operacional anterior.

O controle usa os sinais novos de rompimento1h já registrados na coleta operacional. Cada carteira nova começa com R$1.000 simulados. A variante de notícias pode vetar risco alto ou viés contrário. Saídas, risco, custos e execução são idênticos entre as variantes; a carteira que deixou de entrar pode naturalmente ter patrimônio, quantidades e disponibilidade diferentes depois disso.

As análises são qualitativas, geradas por este chat na rotina já existente. O coletor do experimento não pesquisa notícias, não chamaIA e não envia ordens. A rotina de notícias continua regida por `news-operations.md`, inclusive orçamento e disponibilidade. Sem análise causal válida, o filtro não veta e registra ausência de cobertura.

## Uso

No diretório do Trend Lab:

```sh
node scripts/local-news-experiment.mjs start
node scripts/local-news-experiment.mjs status
node scripts/local-news-experiment.mjs stop
```

O primeiro start congela protocolo e hashes antes de admitir decisões. Start posterior retoma o mesmo registro. O processo acompanha a pausa da coleta principal e informa erro se o servidor estiver inacessível; não o reinicia. O computador precisa estar acordado. O encerramento é herdado da rodada de origem e pode ser inferior aos30 dias necessários para revisão. Nesse caso, o resultado continua inconclusivo.

Painel: http://127.0.0.1:4173/pesquisa-genetica/experimento-noticias.html

Estado independente em `work/news-filter-v1/`. Decisões têm criação exclusiva e checksum; registros antigos não são reescritos. A leitura da execução anterior ocorre somente porGET nas APIs locais; o experimento não abre nem edita `.local/runtime.sqlite`. Candles de execução/mark e funding são obtidos apenas de endpoints públicos da Binance para avaliar resultados posteriores. Lacunas de decisão não são preenchidas. A eventual recuperação de preços após uma pausa não cria novas decisões antigas.

Fontes de cálculo alteradas após registro fazem o experimento falhar explicitamente, exigindo outro protocolo. Nunca apague a rodada anterior para alterar regras ou escolher uma configuração que tenha melhor resultado. Resultados e protocolo consultáveis no painel, sem chaves nem dados de conta da corretora.

## Validação realizada

Testes de dados futuros/expirados, notícias sem datas, direção simétrica, registro anterior à entrada, preservação do contexto, carteiras idênticas sem notícias, veto isolado e gaps de preço/decisão. O teste unitário usa dados sintéticos declarados e não é resultado de trading. A evidência financeira terá de vir da coleta prospectiva.
