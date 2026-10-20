# PEPE · seleção, classificação, calibração e avaliação

Experimento `pepe-risk-selection-v1`, concluído em 20/10/2026. [Painel local](http://127.0.0.1:4173/pesquisa-genetica/selecao-calibracao.html).

Foram ajustados 36 pipelines: três janelas × três sementes (19, 73, 151) × duas famílias × dois conjuntos de variáveis. Cada pipeline foi avaliado sem calibração e com sigmoid. Com os controles de frequência e volatilidade, são 90 avaliações, sobre 26.392 candidatas únicas nos períodos posteriores. Repetir sementes não cria novos históricos independentes.

## Pergunta e método

Testar se seleção de variáveis e calibração melhoram probabilidades de risco de movimento adverso. Não é um novo treino do PPO nem uma carteira de negociação.

O pipeline é StandardScaler → seletor L1 opcional → Gaussian Naive Bayes ou regressão logística. São 16 entradas causais de preço, volume, tendência e qualidade dos dados, incluindo o lado da candidata. As três flags de disponibilidade e o lado são protegidos; sua retenção obrigatória não representa importância aprendida. A seleção escolhe C entre 0,001; 0,01; 0,1 pelo log loss médio de três divisões cronológicas internas do treino. Há separação adicional de 30 minutos e as direções do mesmo horário permanecem juntas.

A calibração sigmoid usa um bloco posterior, com FrozenEstimator sobre o pipeline completo: scaler, seletor e classificador não são reajustados nesse bloco. A avaliação vem depois e não escolhe parâmetros. Os scripts e o protocolo foram registrados por SHA-256 antes da execução.

| Janela | Treino | Calibração | Avaliação posterior |
| --- | --- | --- | --- |
| f1 | jun/2023–fev/2024 | mar–abr/2024 | mai–jul/2024 |
| f2 | jun/2023–ago/2024 | set/2024 | out–dez/2024 |
| f3 | jun/2023–dez/2024 | jan–mar/2025 | abr–jun/2025 |

Agosto/2024 é excluído de todas as etapas. Somente 24 pacotes mensais entre junho/2023 e junho/2025 foram lidos. Julho/2025 em diante não foi aberto por este experimento. As janelas já estiveram disponíveis em pesquisas anteriores: esta avaliação é retrospectiva, sem novo teste final independente.

## Rótulo

A cada 30 minutos são propostas compra e venda. O preço de referência é a abertura do minuto seguinte com slippage adverso de 0,1%. O rótulo mede a maior excursão adversa nos 30 minutos seguintes em relação a uma distância de stop de 1,5 ATR: baixo (<0,5 distância), moderado (0,5 a <1) e alto (≥1). O caminho futuro serve exclusivamente ao rótulo; precisa estar completo e maturado dentro de sua etapa. Cinco janelas sem negócios na abertura foram excluídas.

“Baixo” não significa seguro nem probabilidade de lucro. O rótulo não inclui taxas/funding e não representa o desfecho final de uma posição.

## Resultados observados

Menor Brier e log loss são melhores. Brier multiclasses é a soma dos três erros quadráticos, sem dividir por dois.

| Variante | Brier | Log loss | Acurácia balanceada |
| --- | ---: | ---: | ---: |
| Logística · todas · sem calibração | 0,656631 | 1,083599 | 35,8% |
| Logística · selecionadas · sem calibração | 0,656657 | 1,083624 | 35,5% |
| Logística · selecionadas · sigmoid | 0,656715 | 1,083805 | 35,0% |
| Logística · todas · sigmoid | 0,656713 | 1,083877 | 35,1% |
| Regra por volatilidade | 0,657860 | 1,085481 | 37,1% |
| NB · todas · sigmoid | 0,658786 | 1,087092 | 34,4% |
| NB · selecionadas · sigmoid | 0,658970 | 1,087284 | 34,7% |
| Frequência histórica | 0,661590 | 1,091172 | 33,3% |
| NB · selecionadas · sem calibração | 0,662983 | 1,100655 | 35,2% |
| NB · todas · sem calibração | 0,672017 | 1,118651 | 35,9% |

A seleção ajudou o NB sem calibração nas três janelas: Δ Brier −0,009034, intervalo descritivo de 95% [−0,010793; −0,007257]. A calibração com todas as variáveis também ajudou o NB nas três: −0,013231 [−0,017263; −0,009869]. Acrescentar seleção ao NB já calibrado não melhorou o agregado: +0,000183 [−0,000819; +0,001431]. As diferenças entre as variantes logísticas foram pequenas, com intervalos incluindo zero.

O menor log loss observado foi o da logística com todas as entradas e sem calibração. A regra por volatilidade teve maior acurácia balanceada; não existe superioridade em todas as métricas. A classe moderada tem recall muito baixo em alguns ajustes, exposto no painel.

Os intervalos usam 500 reamostragens pareadas por dia UTC, com média das perdas por semente antes da reamostragem e ambas as direções juntas. São condicionais aos ajustes realizados: não cobrem toda a incerteza do treinamento, seleção do ativo ou pesquisa prévia.

ATR/preço e RVOL foram retidos nos nove ajustes de cada família. NB reteve 6–7 entradas; logística 6–9, incluindo as quatro protegidas. Frequência de seleção não prova causalidade nem benefício financeiro.

## Estado e evidência

Nenhuma promoção automática, filtro PPO ou ordem real. O treino V3 continuou em processo separado. Utilidade financeira exige outro protocolo comparando a mesma política com e sem o filtro em carteira contínua, com custos completos e CDI no mesmo calendário. Esta classificação não possui patrimônio para comparar ao CDI.

- Protocolo: `pepe-risk-selection-protocol.json`.
- Código: `scripts/pepe_risk_selection.py` e `scripts/run-pepe-risk-selection.py`.
- Registro imutável, resultado e manifesto: `work/pepe-risk-selection-v1/`.
- 72 modelos joblib e nove blocos de previsões NPZ preservados localmente; 81 hashes de artefatos verificados.
- Resultado para o painel: `web/data/pepe-risk-selection.json`.
- Execução realizada: `.venv-rl/bin/python scripts/run-pepe-risk-selection.py` (85,4 s, uma thread). O runner recusa sobrescrever a execução concluída; outro estudo requer novo protocolo/identificador.
- Verificação: 341 testes Node passaram, incluindo cinco verificações reais de sklearn, mais conferência do painel no navegador. Calibração foi testada para não reajustar scaler, seleção ou classificador.

Referências de implementação: [seleção de variáveis](https://scikit-learn.org/stable/modules/feature_selection.html), [calibração](https://scikit-learn.org/stable/modules/calibration.html), [FrozenEstimator](https://scikit-learn.org/stable/modules/generated/sklearn.frozen.FrozenEstimator.html).
