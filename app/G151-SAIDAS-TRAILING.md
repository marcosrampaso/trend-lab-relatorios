# G151 · saídas, trailing e gráficos

## Por que fizemos este teste

O usuário voltou ao campeão G151 (c6cb2a8370cd058b0be0), que marcou **R$18,40/mês nos nove meses usados pela seleção genética**, e pediu gráficos como os do Donchian, além de testar o stop dinâmico. O Donchian continua cancelado e preservado. Não treinamos novos pesos, não alteramos as entradas nem promovemos um novo campeão.

## Resultado

O efeito não foi consistente. O trailing de 2 ATR reduziu a perda média nos 38 meses fora da seleção em R$0,41/mês; nos nove meses originais reduziu o lucro em R$3,56/mês. A proteção dos custos após 1R teve a menor perda média fora da seleção, mas continuou negativa. As parciais antecipadas cortaram ganhos. Nenhuma das oito variantes bateu o CDI nessa amostra externa.

| Saída | 9 meses originais, R$/mês | 38 meses fora da seleção, R$/mês | Diferença externa vs original |
|---|---:|---:|---:|
| G151 original | R$ 18,40 | R$ -7,17 | R$ 0,00 |
| Sem prazo · alvo original | R$ 17,59 | R$ -7,57 | R$ -0,40 |
| Proteção dos custos após 1R | R$ 14,71 | R$ -6,55 | R$ 0,62 |
| Trailing 1 ATR após 1R | R$ 12,19 | R$ -6,90 | R$ 0,26 |
| Trailing 2 ATR após 1R | R$ 14,85 | R$ -6,75 | R$ 0,41 |
| 50% no meio do alvo + proteção | R$ 8,35 | R$ -8,21 | R$ -1,05 |
| 50% no meio do alvo + trailing 2 ATR | R$ 8,41 | R$ -8,32 | R$ -1,16 |
| 50% no alvo + restante com trailing | R$ 17,00 | R$ -7,40 | R$ -0,24 |

Custos elevados: taxa de 0,10% e slippage adverso de 0,04% em cada lado, mais funding histórico. Custos base também ficam disponíveis no painel (0,05% e 0,02% por lado). O CDI histórico médio dos 38 meses é R$9,52/mês sobre R$1.000 reiniciado mensalmente.

**A conta contínua é o teste decisivo de acumulação: todas as variantes atingiram o limite global de perda de 10%.** Os valores um pouco além de R$100 refletem a execução e custos, não um limite garantido. A carteira fica em caixa depois do limite. Não removemos essa proteção para produzir um resultado melhor.

| Trecho contínuo | Original: lucro/prejuízo | Trailing 2 ATR: lucro/prejuízo | CDI bruto: ganho |
|---|---:|---:|---:|
| 2021-11_2022-06 | R$ -101,10 | R$ -103,43 | R$ 68,51 |
| 2023-06_2026-08 | R$ -100,88 | R$ -102,66 | R$ 486,65 |

Não somar carteiras separadas e chamar de retorno composto. Os dois trechos começam individualmente com R$1.000; há uma lacuna entre eles. Dentro de cada trecho o saldo, as posições e os limites passam de um mês ao próximo.

## Controles e causalidade

- Controle legado reproduzido em 18 cenários (9 meses × 2 custos), com mesmos scores e operações. R$18,402207/mês legado; R$18,403297/mês após corrigir o horário do funding, sem retreino. A correção contábil não é ganho da estratégia.
- Os 47 meses da validação ampliada reutilizam scores de 16 blocos causais, cinco sementes por braço, treino nos nove meses anteriores. Seus pesos foram treinados com rótulos de saída antiga; este estudo testa uma sobreposição de saídas, não retreina o modelo para elas.
- Novos controles reproduziram lucro e quantidade de posições dos 47 meses, nos dois custos. Setembro/2026 reservado não foi consultado.
- Mesmo risco de 1%, alavancagem de 10×, stop inicial 1,5 ATR, alvo 2R no cruzamento e SMA20 no Bollinger, limites diário de 3% e global de 10%, cooldown de 10 minutos.
- Sinais de entrada e scores são iguais, mas uma saída diferente altera o tempo em posição e o saldo. Isso pode alterar operações efetivamente aceitas e tamanhos; os testes não presumem trades idênticos.
- Sem prazo ainda pode sair por sinal contrário da mesma família, alvo, stop, risco ou fim explícito da avaliação.

## Políticas de saída

- Original mantém os prazos do G151: 120 minutos no cruzamento e 240 no Bollinger.
- Sem prazo remove apenas o vencimento, mantendo os alvos originais.
- Proteção após 1R considera o fechamento de 1 minuto, não uma máxima intrabar conveniente. R é a distância da entrada ao stop inicial.
- Trailing usa o melhor fechamento observado após ativação e ATR14 de candles de 5 minutos fechados. Só aperta o stop e só passa a valer no candle seguinte. Nenhuma invalidação adicional por EMA foi introduzida.
- Nas parciais antecipadas, sai 50% da quantidade na metade da distância ao alvo original; o restante mantém o alvo original. Bollinger pode ter alvo menor que 1R. Não forçamos um alvo de 1R que rejeitaria entradas válidas.
- No runner, sai metade no alvo original e o restante fica sem alvo fixo, com trailing de 2 ATR e proteção dos custos após a parcial.
- A quantidade é arredondada ao lote. Se a parcial/restante não atende os mínimos da corretora, volta ao alvo original para a posição inteira. As pernas contam como uma única posição.
- O preço de equilíbrio protege os custos conhecidos da quantidade restante: taxas, slippage e funding acumulado. Não garante proteção contra gaps ou funding futuro.

## O que há no painel

- Histórico arquivado G80–G226, com recorde G151 e candidato por geração. É um arquivo da genética anterior, não treinamento novo ou gerações fictícias.
- Oito saídas × dois custos, com quatro recortes: nove meses originais, nove sobrepostos com retreino causal, 38 fora da seleção e 47 totais.
- Curva contínua de saldo, lucro/prejuízo, comparação com CDI, queda máxima, parciais e ajustes de stop.
- Gráfico de uma posição: stop vigente, fechamentos que causaram ajustes e execuções. Até 50 posições por carteira no painel; todas ficam guardadas localmente. A amostragem do gráfico de saldo é diária; o drawdown máximo é calculado a cada minuto.

## Interpretação e próximo passo

A pequena melhora externa não sustenta afirmar superioridade. No trailing 2 ATR, oito meses melhoraram, sete pioraram e 23 ficaram iguais. A pesquisa já olhou esses meses antes; não são holdout independente. Os intervalos normais descritivos presentes no JSON não corrigem dependência temporal nem comparações múltiplas e não devem ser usados como significância estatística.

Não escolhemos mais um vencedor pela amostra conhecida. Antes de novo treino, faz sentido separar o comportamento da reversão Bollinger e do cruzamento, examinar as operações cuja proteção encerrou cedo e definir uma hipótese limitada para avaliação prospectiva com scores congelados. Isso é um próximo estudo, não parte executada deste teste.

## Reprodução e arquivos

```sh
node --test tests/g151-exits.test.mjs
node scripts/run-g151-exit-study.mjs
```

- Painel: http://127.0.0.1:4173/pesquisa-genetica/g151-evolucao.html
- Registro: `work/g151-exits-v1/registration.json`; inclui hashes das fontes, predições e candles antes das avaliações.
- Todas as avaliações: `work/g151-exits-v1/monthly/` e `continuous/`.
- Dados do painel: `web/data/g151-exits.json`.
- Fontes: `scripts/g151-exit-engine.mjs`, `scripts/g151-exit-study-core.mjs`, `scripts/run-g151-exit-study.mjs`.
- Paper trading antigo com notícias permanece separado: esta rodada não corrige nem regrava seu candle revisado.

Resultados retrospectivos antes de impostos, FX fixo de R$5/USDT e filtros históricos aproximados. Sem ordens reais, sem API paga e sem publicação no site hospedado.
