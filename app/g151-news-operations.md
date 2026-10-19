# G151 no experimento prospectivo de notícias

Adicionado em19/10/2026, com protocolo separado e30dias próprios. O rompimento1h continua no processo e registro anteriores. O painel comum permite alternar os pares A/B e ver as quatro carteiras, cada uma com R$1.000 simulados e custos base/elevados. São oito cenários contábeis, não oito contas reais.

## Modelo e regras

- G151 `c6cb2a8370cd058b0be0`, Random Forest com1.200árvores, profundidade10 e mínimo100exemplos por folha. Mesmos pesos; nenhum fit ou ajuste de limiar.
- Cinco sementes por família do fold2026-09. Treino encerrado em01/06/2026, com rótulos maturados antes do corte. Os dez arquivos binários são lidos do arquivo preservado, com conferência de hashes.
- Regime volátil se ATR/preço>=0,005408; tendência conforme contexto1h/4h e corte1,702; demais casos entram no regime lateral. Rotas: tendência/cruzamento/120min/score0,326; volátil/Bollinger/240min/0,411; lateral/Bollinger/240min/0,643.
- Sinais5m com contexto de horas encerradas. Cruzamento mantém alvo2R; Bollinger mantém alvo na média conhecida. Stop1,5ATR; risco1%, alavancagem10x e limites de perda herdados do protocolo de scalping.
- A entrada foi deslocada para a abertura do minuto seguinte ao fechamento5m, dando tempo de registrar inferência e notícias antes de conhecer o preço de entrada. Se o registro chegar depois dessa abertura, o sinal é perdido e aparece como lacuna. Isso é uma adaptação prospectiva explícita e não reprodução idêntica dos fills históricos de G151.
- Motor de execução1m com a contabilidade de funding corrigida, já existente no projeto. Nenhum arquivo congelado foi modificado. Aquecimento inicial de5m dos últimos3dias completos mais o dia atual e contexto1h das últimas1.000horas disponíveis. Isso define a inicialização dos indicadores desta rodada.

O filtro usa o mesmo contrato de notícias já testado: risco alto ou viés contrário pode bloquear nova entrada. Informação ausente, inválida, futura ou expirada não bloqueia e não conta como cobertura válida. Sinais contrários permanecem disponíveis para fechar posições em ambas as carteiras. O scoreRF não é tratado como probabilidade calibrada de lucro.

## Execução

```sh
node scripts/local-g151-news.mjs start
node scripts/local-g151-news.mjs status
node scripts/local-g151-news.mjs stop
```

Estado próprio em `work/g151-news-v1/`, com protocolo, dados de avaliação e decisões imutáveis com checksum. Nenhuma escrita no banco da rodada original. Polling a cada15segundos, inferência somente para gatilhos novos. A pausa do servidor principal é respeitada; o serviço não o reinicia. Sem API paga, chamadas deIA ou ordens reais. Requer computador acordado e internet para coletar preços.

Painel: http://127.0.0.1:4173/pesquisa-genetica/experimento-noticias.html?strategy=g151

## Evidência de implementação

Os dez modelos reproduziram exatamente20scores de vetores arquivados (erro absoluto máximo0). Isso verifica a inferência, não demonstra rentabilidade. Foram executados213testesNode, incluindo paridade das carteiras sem notícias, rejeição de decisões tardias/futuras e preservação de saídas contrárias quando a notícia veta a nova entrada. Os resultados financeiros terão de ser observados após o início da rodada.

As duas estratégias têm horários de início, frequências e motores de execução diferentes. A comparação principal é A×B dentro de cada estratégia. Não ranquear lucro bruto entre elas como se fosse experimento controlado com o mesmo período. Nenhuma configuração é promovida automaticamente.
