# Donchian adaptativo: retorno desde o início

Pedido de19/10/2026: testar o Donchian que se destacou no day trade e ampliar para todo o histórico instalado, com retorno monetário contínuo. Painel: http://127.0.0.1:4173/pesquisa-genetica/donchian-lab.html . Os50cenários concluíram; nenhuma variante foi promovida.

## Perguntas e desenho

O resultado que motivou a rodada foi ETH adaptativo, controle, custos elevados: +R$67,95 em42operações de junho a setembro/2026. O base ganhouR$27,04 em80operações. Como a hipótese de custo também determina a elegibilidade das entradas, não se pode atribuir a diferença às taxas isoladamente.

Registramos antes dos cálculos três políticas: filtro calculado pelo custo de cada cenário; filtro fixo na hipótese base; filtro fixo na hipótese elevada. Só o filtro muda. A contabilidade continua com taxas/slippage base ou elevados. Elegibilidade idêntica não implica necessariamente mesmas quantidades ou operações, porque patrimônio e limites também mudam.

- 12cenários de replicação: BTC/ETH ×3políticas ×2custos, junho–setembro/2026. Os quatro controles originais reproduziram lucro, número de operações e drawdown.
- 6carteiras contínuas: ETH ×3políticas ×2custos, 01/01/2020 00:00UTC até19/10/2026 03:08UTC, corte do catálogo instalado.82meses, incluindo outubro parcial. R$1.000 uma vez, sem aportes/reset; reinvestimento e limites globais persistem entre meses/anos. Indicadores aquecem na primeira semana sem operar.
- 32diagnósticos em8blocos anuais/contíguos completos, ETH ×2políticas ×2custos.78meses completos; exclui janeiro/dezembro2020 e julho2022 por lacunas de mark price e outubro2026 parcial. Cada bloco reiniciaR$1.000: seus lucros não são somados como carteira contínua.

Risco1%,10x, stop1,5ATR, alvo2R, prazo até24h, intervalo4h, limite diário3% e global10%, parâmetros preservados. Fonte de sinais é o Donchian original: canal10–40h adaptado à volatilidade anterior, volume>1,2vezes média20h, execução1m e atraso2min. Não houve busca de parâmetros, treino, mudança de risco, notícia retroativa ou ordem real.

## Resultado monetário principal

A configuração correspondente ao destaque deR$67,95 (filtro elevado/custos elevados) terminou com **R$900,427583**, prejuízo de **R$99,572417 (−9,9572%)**. Fez16operações e acionou o limite global em31/01/2020 02:21UTC; continuou em caixa pelo restante do histórico. Percorrer82meses não significa permanecer operando por82meses. O valor pode diferir ligeiramente do gatilho de10% porque o limite é detectado no patrimônio marcado e a saída executada usa preço negociado/custos.

| Política / contabilidade | Saldo final | Lucro líquido | Operações | Limite global |
|---|---:|---:|---:|---|
| Por cenário / base | R$899,00 | −R$101,00 |116|15/06/2020|
| Por cenário / elevados | R$900,43 | −R$99,57 |16|31/01/2020|
| Fixo base / base | R$899,00 | −R$101,00 |116|15/06/2020|
| Fixo base / elevados | R$898,30 | −R$101,70 |19|31/01/2020|
| Fixo elevado / base | R$899,24 | −R$100,76 |118|09/07/2020|
| Fixo elevado / elevados | R$900,43 | −R$99,57 |16|31/01/2020|

Em2026 jan–set, começando uma carteira nova só nesse bloco, o filtro elevado ganhouR$211,28 no base eR$101,30 no elevado. Nos mesmos testes, diversos blocos anteriores perderam e acionaram o limite. Isso mostra dependência do período, não robustez comprovada.

No recorte jun–set/2026, fixar o filtro elevado e pagar custos base gerouR$106,54 em42operações, contraR$67,95 com custos elevados. Fixar o filtro base e elevar os custos gerou−R$35,26. É evidência descritiva de que a diferença antiga envolvia a seleção das entradas; não é seleção de um vencedor ou validação independente. Todos os resultados foram publicados.

## Lacunas, CDI e aproximações

Há64minutos sem mark price em três meses. A consulta pública da Binance para a primeira lacuna retornou lista vazia. Na conta contínua, uma política registrada usa o OHLC negociado observado como proxy apenas nesses minutos; dados originais não são alterados. A auditoria mostrou **zero posições abertas e zero entradas nos64minutos em todas as6carteiras**. Portanto não houve fluxo de posição, funding ou liquidação dependente dessa aproximação nos resultados observados. A existência da lacuna permanece indicada; não se apresenta o proxy como mark price real.

O CDI segue a metodologia emCOMPARACAO-CDI.md:100% bruto teórico, capital igual, taxas diárias compostas, antes de impostos e sem extrapolação. O catálogo inteiro termina19/10, mas a última taxa CDI publicada é15/10. O acumulado parcial conhecido éR$919,30 (saldoR$1.919,30); o relatório não trata isso como referência completa até19/10 e não calcula superação/percentual nesse recorte. Blocos completos têm comparação CDI reconciliada. Robôs usam câmbio fixoR$5/USDT, taxas/slippage modelados e filtros atuais da corretora; resultados não são lucro realizado.

## Implementação e verificação

`scripts/evaluate-donchian-lab.mjs` registra protocolo, fontes e referência CDI antes de avaliar. Insumos novos e arquivos auxiliares ficam em `work/donchian-lab-v1/`; resultado público `web/data/donchian-lab-study.json`. Fonte, mercado e referência são verificados por hashes; um registro existente não é sobrescrito. O script confere servidor ativo/não pausado e não o reinicia.

`scripts/donchian-streaming-core.mjs` é uma cópia separada do motor de pesquisa preservado, com estado persistente entre lotes mensais e curva diária para reduzir memória. Caixa, posição, stop, funding, pico, limites diário/global e intervalo após saída não reiniciam no lote. O motor antigo não foi editado.

248testesNode passaram. Novos testes cobrem filtro fixo, atraso, sinais sem futuro, blocos sem lacunas, reconciliação, persistência de limite global e equivalência entre lotes/dias/meses. Auditoria adicional com dados reais jun–set/2026 reproduziu exatamente as42operações, caixa, funding, taxas e risco nas duas contabilidades, comparando execução mensal em lotes com o motor original em memória. Verificação pública: `web/data/donchian-lab-audit.json`.

O Donchian prospectivo original continua dentro do experimento de30dias de day trade, separado deste retrospectivo. A nova política filtro elevado/custo base não foi aplicada às decisões ao vivo; isso exigiria uma rodada prospectiva própria registrada antes das entradas. Relatórios antigos e modelos permanecem preservados.
