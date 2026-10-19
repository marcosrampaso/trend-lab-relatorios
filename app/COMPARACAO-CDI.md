# Comparação dos experimentos com o CDI

Implementação de 19/10/2026. O catálogo reúne 324 cenários publicados de nove grupos: BTC/ETH histórico e prospectivo, estudo de contexto BTC, day trade histórico e prospectivo, notícias G151/rompimento, históricos anteriores e blocos de capital composto. Variações de custos ou filtros sobrepostos não são carteiras independentes que possam ser somadas. Os relatórios antigos da genética mantêm suas referências CDI originais.

Painel geral: http://127.0.0.1:4173/pesquisa-genetica/cdi-comparativo.html . A mesma seção aparece nos painéis de day trade, cripto/sentimento e notícias. Filtros selecionam grupo e ativo; a tabela mostra capital, lucro do robô, lucro CDI, diferença em reais e percentual do CDI. A curva só aparece quando foi publicada pelo relatório original.

## Referência e cálculo

Fonte: Banco Central, republicado pelo Ipeadata, séries `SGS366_CDI366` (% ao dia) e `BM12_TJCDI12` (% ao mês). Consulta diária: https://www.ipeadata.gov.br/api/odata4/ValoresSerie(SERCODIGO='SGS366_CDI366') . Consulta mensal: https://www.ipeadata.gov.br/api/odata4/ValoresSerie(SERCODIGO='BM12_TJCDI12') . Trata-se de uma referência teórica de 100% do CDI bruto, não de um produto financeiro específico ou de garantia de remuneração.

Para cada carteira, usamos o mesmo capital inicial e recorte temporal. Patrimônio CDI = capital × produto de (1 + taxa diária / 100). Juros são reinvestidos; não aplicamos a taxa anual atual a anos anteriores. CDI antes de impostos; robôs após os custos modelados e antes de impostos. Não há ajuste fiscal, taxa de administração de um investimento real ou promessa de execução do bot pelos preços simulados.

Diferença em reais = lucro do robô − lucro CDI. Percentual do CDI = retorno do robô / retorno CDI × 100, somente quando o denominador é positivo e a referência está verificada. Perdas resultam em percentuais negativos. Retornos de datas, capitais ou critérios de seleção diferentes não devem ser ranqueados como equivalentes.

Convenção explícita: datas em UTC, apenas dias completos, início parcial excluído e crédito da taxa no fim do dia. Não há rateio intradiário, preenchimento de feriados/fins de semana ou projeção de taxas futuras. O corte prospectivo acompanha a última marcação de patrimônio publicada por cada carteira, não o relógio atual nem a data futura de término do experimento.

Cada mês completo precisa reconciliar o produto das taxas diárias com a taxa mensal publicada (tolerância de 0,0055 ponto percentual; ao menos 15 observações). A referência inicial validou 82 meses, dezembro/2019 a setembro/2026. Quatro observações em feriados de 2024 já excluídas na referência anterior são preservadas como exclusões auditadas; nenhum arquivo antigo é alterado. Mês sem reconciliação, cobertura incompleta ou taxa ausente aparece como provisório/indisponível, sem diferença, percentual ou ranking. Uma janela sem dia completo mostra referência zero e não calcula percentual do CDI.

## Atualização e preservação

`scripts/refresh-cdi-reference.py` busca as duas séries públicas, verifica hashes dos insumos antigos, preserva respostas novas por hash e recusa revisões de taxas antigas para revisão manual. Tudo novo fica em `work/cdi-comparison-v1/`. Falhas mantêm a referência anterior e aparecem no estado publicado. Na implantação, a última taxa disponível era de 15/10/2026; outubro segue provisório.

`scripts/local-cdi-comparison.mjs` verifica o servidor Trend Lab ativo/não pausado, lê 14 arquivos de resultados publicados a cada minuto e tenta atualizar a fonte a cada quatro horas. O painel consulta o JSON a cada minuto. Sem servidor ativo não se inicia outro servidor. O serviço é um processo separado: não faz backtests, muda pesos, regras, risco, fitness ou decisões e não envia ordens. Não usa IA, API paga ou tokens de chat.

Comandos, no checkout local com dados CDI preservados:

```sh
node scripts/local-cdi-comparison.mjs start
node scripts/local-cdi-comparison.mjs status
node scripts/local-cdi-comparison.mjs stop
node --test tests/cdi-reference.test.mjs
```

Os snapshots no GitHub são estáticos, datados e ligados ao manifesto de código. Dados de execução privados, candles e pesos permanecem locais. O código exportado precisa dos insumos CDI auditados para atualizar a referência; os testes unitários usam fixtures e não precisam deles.

## Leitura inicial, não seleção de vencedor

Para R$ 1.000 entre 01/06/2026 e 01/10/2026 (junho a setembro completos), 86 taxas diárias resultam em CDI de 4,586297%, lucro R$ 45,862971 e saldo R$ 1.045,862971.

| Carteira / custos base | Lucro do bot | Diferença para CDI | % do CDI |
|---|---:|---:|---:|
| G151 ETH | R$ 27,50 | −R$ 18,37 | 59,96% |
| Day trade Donchian adaptativo ETH | R$ 27,04 | −R$ 18,82 | 58,96% |
| Day trade EMA BTC | R$ 55,16 | R$ 9,30 | 120,27% |

A EMA BTC supera a referência com custos base neste recorte, mas perde com custos elevados. O filtro de custo do day trade altera as entradas aceitas em cada cenário; resultados base/elevados podem ter operações diferentes. Não é evidência de robustez nem motivo para escolher a melhor variante retrospectivamente. O período já foi visto; notícias atuais não são inseridas no histórico.

Validação: 239 testes Node passaram, incluindo sete testes novos de CDI/adaptadores; protocolos e arquivos congelados permanecem válidos. Tabelas e curvas conferidas no navegador local. O erro já registrado de revisão de candle no experimento antigo de rompimento continua explícito na origem, sem reset ou preenchimento de decisões.
