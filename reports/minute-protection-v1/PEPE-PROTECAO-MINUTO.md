# PEPE: proteção em 1 minuto versus 5 minutos

Experimento exploratório registrado antes da execução. Concluído em 2026-10-21T21:23:51.931Z. Sem retreino e sem ordens reais.

## Por que testar

Quatro compras selecionadas pela genética de semente151 tiveram lucro líquido estimado em algum fechamento de1m, mas duas acabaram no stop. Isso motivou verificar se a ativação mais frequente do mesmo lock preserva ganhos. Os picos foram identificados retrospectivamente; não são preços de saída garantidos. Esta semente151 é distinta do antigo campeãoG151.

## Mudança isolada

Acrescentar somente decisões de ativação do lock nos fechamentos intermediários de1m. Mesma condição: custos da quantidade restante e0,25 do risco inicial de preço. Entradas, alvos e parciais permanecem em5m. Os stops ativos já são verificados em1m no controle. Ordem aplicada na abertura seguinte, com gaps e prioridade de stop/liquidação preservados. Sem otimizar limiares nas quatro compras.

Mantidos risco1%,15x,stop1,5ATR,escada líquida10/20/40% da margem inicial,frações25/50/25,custos de estresse,funding,lotes e limites diário/global.

## Resultados

23.408 pares com entrada e quantidade inicial idênticas;64 carteiras mensais com propostas congeladas, quatro fontes e oito meses. Nas quatro compras originais, o líquido total descritivo passou de-R$12,72 para-R$1,27. A compra de23/05 passou de-R$9,42 para+R$2,03; as outras três não mudaram o líquido. Esta soma não é rentabilidade composta: as carteiras mensais reiniciam.

| Entrada UTC | Controle BRL | Proteção1m BRL |
|---|---:|---:|
| 2024-04-12T17:30:00.000Z | 4.69 | 4.69 |
| 2024-04-13T20:00:00.000Z | -9.70 | -9.70 |
| 2024-05-23T13:00:00.000Z | -9.42 | 2.03 |
| 2024-06-24T03:00:00.000Z | 1.71 | 1.71 |

Média líquida por oportunidade, em orçamentoR de R$10:

| Calendário | Lado | Controle | Proteção1m |
|---|---|---:|---:|
| pairedDiagnostic | Compra | -0.332729R | -0.331458R |
| pairedDiagnostic | Venda | -0.306045R | -0.304753R |
| temporalReplay | Compra | -0.316779R | -0.302830R |
| temporalReplay | Venda | -0.331314R | -0.325643R |

923 perdas viraram lucro e nenhum ganho virou perda. Porém1.850 oportunidades tiveram resultado líquido menor, inclusive por redução de ganhos, e todas as médias por lado/calendário permaneceram negativas. Nenhuma das64 carteiras mensais superou o CDI no seu mês. Ambos os seedsPPO e os meses em caixa estão incluídos. A carteira de tendência alinhada ficou pior; a mudança não é uma melhora universal de carteira.

## Conclusão

A frequência da proteção explica parte da perda em uma compra, mas não resolve a expectativa negativa. Não demonstramos que o bot sabe escolher entradas lucrativas. Não selecionar o novo braço apenas por salvar essa operação. Manter a hipótese como diagnóstico, sem promover para dinheiro real; qualquer ajuste posterior requer uma nova avaliação cronológica previamente reservada ou prospectiva. Os oito calendários já foram vistos e não são validação independente.

## Integridade e reprodução

23408 oportunidades e32 resumos/ledgers de controle reproduzidos exatamente. 1405 arquivos/fontes registrados conferidos antes/depois. Os testes incluem decisões causais, gaps que continuam produzindo perdas e ausência de novas parciais em1m.

Executar scripts/prepare-minute-protection.mjs e scripts/run-minute-protection.mjs somente em uma cópia sem registro prévio, com os dados e artefatos locais restaurados. O runner recusa sobrescrever resultado concluído.

Página local: http://127.0.0.1:4173/pesquisa-genetica/protecao-minuto.html
