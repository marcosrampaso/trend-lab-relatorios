# Plano para buscar 60% de qualidade de pesquisa

Diagnóstico `pepe-quality-audit-v1`, 20/10/2026. [Painel](http://127.0.0.1:4173/pesquisa-genetica/qualidade-pesquisa.html). O usuário definiu uma meta inicial de 60% de acurácia balanceada; não é garantia de atingir a meta nem um padrão universal de lucro.

## O que foi feito

Auditoria somente de leitura dos 137 casos do experimento anterior, dos oito ledgers já produzidos e de seus hashes. Não houve ajuste de modelo, escolha de limiar, abertura de dados novos ou alteração da V3.

| Etapa | Resolvidas | Dias com entradas | Compras / vendas | Rótulo discorda do sinal líquido | Evento após saída efetiva |
| --- | ---: | ---: | ---: | ---: | ---: |
| Treino | 91 | 31 | 55 / 36 | 24 | 10 |
| Calibração | 11 | 7 | 11 / 0 | 4 | 0 |
| Avaliação | 34 | 15 | 34 / 0 | 6 | 3 |

Uma entrada adicional da avaliação ficou censurada. Os dados não têm entradas em fevereiro/2025; maio tem 32 e junho só três (uma censurada). A avaliação, portanto, não permite afirmar que o modelo funciona para vendas ou para qualquer regime.

O rótulo de stop inicial versus alvo nominal de 2R discorda do sinal do resultado líquido do PPO em 34 de 136 casos resolvidos (25%). Em 13 casos resolve depois da saída efetiva. Isso é esperado como possibilidade: o PPO tem saídas próprias, enquanto o rótulo acompanha um bracket hipotético. O estudo original permanece preservado. Se quisermos classificar perda líquida efetiva, será outra hipótese, com versão da política e saídas congeladas.

Somente 11 exemplos calibraram sigmoid, com cinco stops primeiro; na avaliação foram 24/34. Não dá para atribuir toda a piora da calibração a essa mudança, mas a amostra reduzida e a mudança de frequência são limitações concretas. Mais CPU ou mais agentes correlacionados não criam dias de mercado independentes.

As flags de volume/VWAP/RVOL têm valor constante 1 nos exemplos de treino. São proteções de qualidade, não sinais de previsão nesta amostra. O seletor L1 ficou com todos os coeficientes zero e o limiar médio zero manteve os 16 campos: na próxima versão isso deve ser detectado e exposto explicitamente, mantendo as flags protegidas. Nenhuma correção foi aplicada retroativamente aos modelos.

## Ordem de trabalho proposta

1. **Base e calendário.** Expandir o conjunto de entradas únicas e a cobertura de meses, direções e regimes. Fixar a composição das políticas antes de abrir uma avaliação nova; deduplicar entradas compartilhadas. Preservar carteiras contínuas e limites, registrar ausência de operações e não forçar ordens para atingir uma quantidade. Usar períodos já inspecionados somente como desenvolvimento.
2. **Pergunta fixa.** Manter stop-versus-2R como uma tarefa própria. Uma eventual tarefa de perda líquida nas saídas do PPO fica separada. Não trocar a tarefa para tornar o número de acurácia maior.
3. **Uma hipótese de informação por vez.** Testar contexto BTC e retorno relativo PEPE/BTC; depois regime PEPE de volatilidade/volume/força da tendência; depois custo estimado conhecido antes da ordem em relação ao stop. Somente candles fechados, com cutoffs aprendidos no treino. Não presumir que um indicador novo acrescenta informação útil.
4. **Poucos modelos controlados.** Logística regularizada e boosting de árvores rasas, capacidade limitada. Um grupo de features por rodada e lista de candidatos registrada antes dos resultados. Pesos de classe como ablação separada; tratar explicitamente seleção com coeficientes zerados.
5. **Separação temporal.** Treino com seleção interna, bloco posterior para calibração de probabilidades, outro para escolha do limiar e avaliação bloqueada. Nunca escolher o limiar nos 34 casos observados nem usar K-fold aleatório que misture passado e futuro.

Pisos iniciais propostos para o desenho: 1.000 entradas de treino (200 por classe), 200 de calibração (50 por classe), 200 para o limiar (50 por classe) e 300 de avaliação (100 por classe, 60 dias com entradas). São triagem de desenho, não cálculo de poder estatístico nem garantia de suficiência. Será preciso levar em conta dependência temporal, desequilíbrio e disponibilidade real antes de congelar o protocolo executável. Não fabricar novos casos repetindo agentes ou janelas.

## Critério para dizer que atingimos a meta

- Acurácia balanceada ≥60% numa avaliação registrada e bloqueada, com intervalo por blocos de dias acima de 50% e cobertura temporal suficiente.
- Recall ≥50% nas duas classes, sob limiar fixado anteriormente.
- Brier e log loss melhores que a frequência histórica do treino no mesmo calendário.
- Pelo menos três blocos temporais definidos antes dos resultados, com suporte das duas classes. Não omitir blocos ruins ou sem operações; se não houver casos, registrar ausência e insuficiência, sem inventar uma acurácia para o bloco.

Se isso não acontecer, o resultado será “meta não demonstrada”. Não haverá repetição automática até aparecer 60%, inversão de previsões pelo resultado do teste nem promoção ao PPO.

## Estado e limites

**Diagnóstico e plano concluídos; próximo treino ainda não iniciado.** Falta ampliar a base e registrar o calendário completo antes de avaliar novos candidatos. O JSON salva `calendar: null` e exige seu registro antes da execução. Esta entrega não é uma pré-inscrição completa de experimento já executável nem promete coleta futura automática.

A V3 segue no protocolo original. O passo 4 financeiro permanece adiado até as 1.000 gerações: mesma política com/sem filtro, custos completos, carteira contínua, CDI e todos os blocos, incluindo sem operações na média. Mesmo atingir a meta de classificação não demonstra benefício financeiro nem ativa filtro.

Arquivos: `scripts/audit-pepe-research-quality.py`, `work/pepe-quality-audit-v1/audit-and-plan.json` imutável e `web/data/pepe-quality-plan.json`. O script verifica o manifesto do estudo original e se recusa a substituir o diagnóstico concluído. O teste verifica reconciliação com saídas efetivas, dias, classes, duplicatas e proveniência ausente.

Referências: [limiares e separação da escolha](https://scikit-learn.org/stable/modules/classification_threshold.html), [calibração](https://scikit-learn.org/stable/modules/calibration.html), [validação temporal](https://scikit-learn.org/stable/modules/cross_validation.html#time-series-split).
