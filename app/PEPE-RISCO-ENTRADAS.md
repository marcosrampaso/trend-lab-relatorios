# Risco nas entradas propostas pelo PPO

Experimento `pepe-entry-risk-v1`, concluído em 20/10/2026, separado da genética V3. [Painel local](http://127.0.0.1:4173/pesquisa-genetica/risco-entradas.html).

O usuário autorizou os passos 1–3: coletar entradas do PPO, definir stop versus alvo e comparar logística/boosting com calibração. O passo 4 (utilidade financeira com/sem filtro) ficou explicitamente para depois das 1.000 gerações da V3. Nenhum filtro, regra de risco, genética ou saída da V3 foi alterado.

## Coleta e congelamento

Antes da coleta foram registrados os hashes de oito arquivos imutáveis presentes no laboratório: pai inicial e todos os recordes de auditoria contínua disponíveis, até G41. Não foram usados pesos mutáveis da população nem picos de sondagem. As políticas foram aprendidas nos meses de treino da V3, anteriores a outubro/2024, e selecionadas em outubro–dezembro/2024. Não houve seleção de políticas pelo resultado posterior.

Cada política percorreu janeiro–junho/2025 com carteira contínua, risco, custos de estresse, limites diário/global, máscaras e motor original preservados. Não há reinício mensal nem reposição de perdas. O processo usou uma thread e prioridade reduzida; a V3 continuou separada.

Foram 149 propostas, 140 posições preenchidas, nove propostas sem preenchimento. Três entradas com a mesma geometria foram removidas entre políticas: **137 entradas únicas**. Uma política não propôs nenhuma ordem e permaneceu no relatório. Três atingiram o limite global; não foram reiniciadas. São políticas correlacionadas no mesmo mercado, não oito amostras independentes.

Inputs do classificador: as primeiras 15 observações de mercado float32 conhecidas pelo PPO antes da ordem e o lado proposto. Sem preço de preenchimento, resultado, identidade da política ou dados futuros como entrada do classificador. Preenchimento e preços futuros servem somente à construção do rótulo.

## Rótulo e limitação de interpretação

Evento binário: o preço toca o **stop inicial de 1,5 ATR antes do alvo nominal de 2R**? Os níveis são os realmente calculados no preenchimento pelo motor, com ticks/slippage. Abertura do minuto tem precedência sobre máxima/mínima; toque dos dois níveis no mesmo candle sem ordem conhecida é ambíguo e excluído. Minutos sem negócios não produzem toque executável. Sem prazo fixo: o caminho termina no fim registrado de cada etapa, e casos não resolvidos ficam censurados.

O PPO em modo agente não executa automaticamente esse alvo nominal. Ele pode encerrar, realizar parcial ou alterar o stop antes. Este estudo acompanha o **bracket inicial hipotético**, mesmo após a saída efetiva do PPO; não mede a saída dinâmica, o PnL da posição, perda após custos nem o benefício de filtrar. Não alteramos o robô para tornar esse rótulo real.

| Etapa | Calendário UTC | Resolvidas | Alvo primeiro | Stop primeiro | Censuradas |
| --- | --- | ---: | ---: | ---: | ---: |
| Treino | jan–mar/2025 | 91 | 29 | 62 | 0 |
| Calibração | abr/2025 | 11 | 6 | 5 | 0 |
| Avaliação | mai–jun/2025 | 34 | 10 | 24 | 1 |

Nenhum caso ambíguo. Os pisos registrados foram 100/40/60 casos e 20/10/15 por classe respectivamente. **Nenhuma etapa atingiu todo o piso.** Esses pisos são filtros de triagem, não cálculo de poder estatístico. Modelos puderam ser ajustados somente como descrição, pois havia pelo menos dois exemplos de cada classe no treino e na calibração.

Janeiro–junho/2025 já foi inspecionado em outras pesquisas, inclusive no estudo anterior de risco. Esta é uma nova pergunta sobre dados de desenvolvimento consumidos; não é um teste final independente. Julho/2025 em diante não foi aberto.

## Seleção, classificação e calibração

StandardScaler e seleção L1 opcional; flags de disponibilidade e lado são protegidos. Comparação com todas as 16 variáveis. C do seletor: 0,001; 0,01; 0,1. Logística: C 0,1 ou 1. Boosting: HistGradientBoostingClassifier, 3 ou 7 folhas, 100 iterações, taxa 0,05, mínimo de dez exemplos por folha, regularização L2 1, sem early stopping aleatório.

Escolha de parâmetros por log loss em divisões internas cronológicas do treino, purgando rótulos que ainda não haviam maturado e mais 30 minutos. Uma divisão interna não tinha exemplos de validação em fevereiro e foi declarada inutilizável; a divisão com validação em março foi utilizável. Nenhum parâmetro veio de abril ou maio–junho. Não houve nova tentativa após observar o resultado.

A seleção reteve as 16 entradas: com o C escolhido, os coeficientes L1 ficaram zerados e o limiar médio zero preservou todas. Portanto, braços “selecionadas” e “todas” são idênticos nesta rodada; não houve benefício nem redução de dimensionalidade. Não mudamos o seletor depois de ver isso.

Sigmoid foi ajustado somente nos 11 casos de abril com FrozenEstimator do pipeline completo. Um hash de todo o pipeline antes/depois confirma que scaler, seletor e classificador não foram reajustados. O tamanho reduzido e a mudança de frequência entre abril e a avaliação limitam a calibração.

## Resultado observado em 34 casos

Agora são duas classes: referência de acurácia balanceada 50%. Não comparar esse número diretamente com os 33,3% de três classes do estudo anterior. Frequência de stop na avaliação: 70,6%; referência para average precision: 0,706.

| Família e calibração | Brier | Log loss | Acurácia balanceada | ROC AUC |
| --- | ---: | ---: | ---: | ---: |
| Frequência do treino | 0,20842 | 0,60768 | 50,0% | 0,500 |
| Logística sem calibração | 0,24464 | 0,68342 | 46,7% | 0,425 |
| Boosting com sigmoid | 0,29913 | 0,79499 | 47,5% | 0,417 |
| Boosting sem calibração | 0,31502 | 0,84189 | 42,9% | 0,417 |
| Logística com sigmoid | 0,39760 | 1,08715 | 39,2% | 0,425 |

Cada família aparece com todas/selecionadas no painel, totalizando oito modelos e um controle. A referência simples superou os modelos em Brier e log loss nesta amostra. Não inverter previsões, escolher limiar ou recalibrar usando esses 34 casos. Amostra pequena e dados consumidos não sustentam inferência de utilidade futura. Nenhum classificador está aprovado para apoiar decisões.

## Próximo passo financeiro: adiado

`step4_gate` exige simultaneamente estado `complete_training_final_locked` e geração ≥1000 no relatório e no checkpoint da V3. Pausa por orçamento, geração parcial ou interrupção não contam como conclusão. O gate só informa prontidão para outro protocolo; **não inicia automaticamente um A/B**, não escolhe campeão pela janela nova e não ativa filtros.

Antes de alterar a genética, a comparação futura deverá medir expectativa líquida fora da seleção, CDI no mesmo calendário e vários blocos, incluindo todos os blocos sem operações na média. Usar carteira contínua, custos completos e mesma política com/sem filtro. Se este classificador continuar sem evidência útil, não há justificativa para conectá-lo.

Hipóteses de calibração por regime, uma mudança de entrada por vez e comparação de saídas com entrada congelada permanecem não aplicadas. Cada mudança requer protocolo anterior ao resultado e uma nova janela não usada para escolher parâmetros. A genética atual prossegue com seu protocolo original; esta análise não muda sua função de seleção.

## Arquivos e verificação

- Protocolo: `pepe-entry-risk-protocol.json`.
- Fontes: `scripts/pepe_entry_risk.py`, `scripts/run-pepe-entry-risk.py`.
- Registro, oito ledgers de replay, casos e resultado imutáveis: `work/pepe-entry-risk-v1/`.
- Oito modelos joblib e um NPZ de previsões permanecem locais. Manifesto de 19 artefatos verificado; 74 hashes de entradas/fontes/dependências verificados. Registro da V3 (1.166 hashes) e estudo anterior (60 hashes) intactos.
- Execução: `LOKY_MAX_CPU_COUNT=1 .venv-rl/bin/python scripts/run-pepe-entry-risk.py` (141,5 segundos). O runner recusa sobrescrever uma execução registrada; outra rodada exige novo protocolo/ID.
- 343 testes Node passaram, incluindo oito verificações Python reais para rótulos, gaps, censura, cronologia, calibração congelada e gate G1000. Painel e troca de variante conferidos no navegador, sem erros de console.

Referências: [HistGradientBoostingClassifier](https://scikit-learn.org/stable/modules/generated/sklearn.ensemble.HistGradientBoostingClassifier.html), [calibração](https://scikit-learn.org/stable/modules/calibration.html), [divisões temporais](https://scikit-learn.org/stable/modules/generated/sklearn.model_selection.TimeSeriesSplit.html).
