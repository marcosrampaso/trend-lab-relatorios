# V3 encerrada e piloto V4

Em 21/10/2026 o usuário pediu o teste final da V3 antes de iniciar a V4 com seu melhor modelo. A busca da V3 foi pausada no checkpoint de 338 gerações completas; oito trabalhos da G339 foram preservados. Não apresentamos a meta anterior de 1.000 como concluída.

## Teste reservado da V3

O G91/agente 245 foi escolhido pelo score já existente do desenvolvimento, antes de abrir o teste. Pesos SHA-256 `2ee954256829b8ffea36a4fea682ac3c15f046e8ca76e34c3cc4d9f9fd42dc0b`. Sua cópia imutável e o registro ficam em `work/pepe-v3-final-v1/`.

Setembro de 2026 constava como reservado e estava fora do índice de features preparado para o treino. Geramos um índice isolado e verificamos equivalência das features dos 39 meses anteriores. Há 43.200 candles, 43.200 marks e 90 pagamentos de funding no mês. Custos de estresse (principal) e base (secundário) foram declarados antes da avaliação. Não houve aprendizado: zero passos de treino e tensores iguais antes/depois.

| Setembro/2026 · R$1.000 iniciais | Líquido | Saldo | Posições |
|---|---:|---:|---:|
| Estresse | −R$102,65 | R$897,35 | 13 |
| Base | −R$101,44 | R$898,56 | 13 |
| CDI bruto no mesmo mês | +R$10,82 | R$1.010,82 | — |

Ambos os cenários atingiram o limite global e tiveram zero posições vencedoras. CDI continua até o mesmo fim de calendário. Slippage já está embutido no bruto; não descontar novamente. Resultado histórico reservado de apenas 30 dias, não retorno prospectivo ou prova de uma causa única da falha. Setembro agora está consumido e proibido na seleção da V4.

Página: http://127.0.0.1:4173/pesquisa-genetica/pepe-v3-final.html

## Diagnóstico do mesmo pai congelado

| Uso | Trimestre | Líquido com estresse |
|---|---|---:|
| Treino · diagnóstico | 2023-Q4 | −R$100,65 |
| Treino · diagnóstico | 2024-Q1 | −R$101,83 |
| Treino · diagnóstico | 2024-Q2 | −R$102,52 |
| Desenvolvimento | 2024-Q4 | +R$319,77 |
| Desenvolvimento | 2025-Q1 | −R$100,73 |
| Desenvolvimento | 2025-Q2 | −R$105,75 |

O trimestre que escolheu o campeão foi o único positivo entre estes seis. Isso é compatível com seleção de um regime favorável e sobreajuste da pesquisa. O treino também é ruim, então não temos o padrão simples de bom desempenho de treino versus ruim fora dele. Underfitting, otimização inadequada, custos e ausência de vantagem preditiva continuam hipóteses; não foram diagnosticados por esses retornos. Não calculamos PBO ou significância estatística. Avaliações trimestrais do pai não são as recompensas coletadas durante cada atualização PPO.

## V4 registrada antes de treinar

25 filhos × 20 gerações; 1.024 passos por filho/geração. Todos começam do mesmo G91 escolhido antes do teste final, independentemente do resultado de setembro. Cinco taxas de aprendizado com cinco sementes cada: 0,000001; 0,00001; 0,00003; 0,0001; 0,0003. Demais hiperparâmetros, ABI de 38 observações/10 ações, motor, custos, risco e treino originais preservados. Treino jun/2023–set/2024, excluindo ago/2024 por falhas de mark price já registradas.

Cada filho passa por 2024-Q4, 2025-Q1 e 2025-Q2. Fitness = média de (líquido − 0,25 × drawdown máximo × R$1.000) − 0,25 × perda do pior bloco. Caixa é válido e entra nas médias. Trimestres têm carteiras independentes: média trimestral não é retorno composto nem comprova sobrevivência de uma carteira única através dos nove meses.

Filhos treinam cópias; só uma melhora estrita do fitness é adotada. Pesos aceitos, rejeitados, recibos e campeões são imutáveis. A cada cinco gerações, os cinco piores retidos recebem o melhor pai e outra taxa de aprendizado registrada. Isso protege os pesos aceitos, mas selecionar repetidamente nesses trimestres também pode sobreajustar.

Default: Turbo, três workers × duas threads. Leve: um; Ultra: até cinco durante 12h, depois leve; memória baixa reduz capacidade entre trabalhos. `caffeinate` acompanha o coordenador. Reserva de disco: 10 GiB. Não há extensão automática para 1.000 gerações nem ordens reais.

Página: http://127.0.0.1:4173/pesquisa-genetica/pepe-v4.html

## Proposta do usuário: dois trimestres de validação

Faz sentido como camada separada, com estes cuidados:

1. Fixar calendários, número de candidatos e critérios antes de ler os resultados; respeitar ordem temporal, sem embaralhar candles.
2. Usar o desenvolvimento trimestral para gerar/selecionar candidatos e congelar uma lista pequena antes de abrir os dois trimestres de validação. Se os dois escolhem o vencedor, são validação de seleção e não teste final.
3. Não consultar a validação a cada geração nem ajustar parâmetros repetidamente olhando esses números. Alterações depois de vê-los consomem os períodos como desenvolvimento.
4. Exigir resultado após custos, CDI no mesmo calendário, drawdown e consistência entre blocos; um trimestre excepcional não deve esconder os demais. Examinar também a carteira contínua atravessando os blocos, sem reiniciar após perdas.
5. Depois da escolha, abrir um teste final distinto, preferencialmente prospectivo. Períodos históricos já inspecionados nas pesquisas anteriores não se tornam independentes só por receber o nome “validação”.

A pedido explícito do usuário, a V4 foi pausada em quatro gerações completas e sete trabalhos parciais preservados. Registramos a revisão `pepe-v4-v2` em `work/pepe-v4-v2/`, mantendo a revisão 1 imutável. A revisão 2 herdou o checkpoint completo da G4 e retoma a G5; os sete trabalhos parciais continuam arquivados na revisão 1. O registro novo declara a validação antes de abrir qualquer resultado dela.

Após completar as 20 gerações totais, o algoritmo congela os dois filhos distintos com maior fitness de desenvolvimento, mais o pai V3 como controle. Cada política passa uma vez por 2025-Q3 e 2025-Q4 e por uma carteira contínua de 01/10/2024 a 01/01/2026, sem resets intermediários. A seleção entre filhos prioriza o pior excesso trimestral sobre CDI, depois a média do excesso e o menor drawdown médio. Esses trimestres já foram vistos em pesquisas anteriores: são validação retrospectiva, não teste independente do laboratório.

Aprovação no protocolo exige superar o CDI nos dois trimestres e na carteira de 15 meses, sem limite global atingido e com drawdown máximo de até 20% em cada avaliação. Se nenhum passar, nenhum será aprovado. Não há retreino após consultar a validação nem promoção para ordens reais. O teste final prospectivo novo continua pendente de registro. A lista é congelada antes da validação, os pesos não recebem `learn()` nessa etapa e os resultados são guardados por modelo/registro para evitar nova tentativa seletiva.

A revisão foi verificada com 358 testes Node da aplicação e quatro testes Python de fitness/reprodução; três testes Python adicionais verificam a lista de candidatos e a escolha pelo pior trimestre. Novos testes da revisão verificam o bloqueio real do bridge de validação antes da G20/lista congelada.

Fontes metodológicas: [scikit-learn · Validation curves](https://scikit-learn.org/stable/modules/learning_curve.html), [Bailey et al. · The Probability of Backtest Overfitting](https://www.davidhbailey.com/dhbpapers/backtest-prob.pdf).

## Verificação e reprodução

- Registros originais e dependências conferidos por SHA-256 antes da preparação e no início do coordenador V4.
- Testes de fitness, adoção protegida e reprodução; bridges recusam o mês final consumido e calendários não registrados; API V4 exige origem local e seu próprio cabeçalho.
- Páginas separam todos os candidatos, campeões retidos, carteiras e CDI. Curvas completas do campeão são publicadas pelo controle local, sem expor pesos ou banco privado.
- Comandos: `node scripts/local-pepe-v4.mjs status|resume|pause|eco|boost|ultra`.
- Código e relatórios podem ser exportados ao repositório privado autorizado. Pesos, dados brutos e `.local/` permanecem locais.

## Conclusão da V4 · 20 gerações concluídas

Encerramento automático em 21/10/2026 às 11:16:49 (São Paulo). Foram 500 candidatos treinados completos ao longo das duas revisões; os sete trabalhos parciais arquivados da primeira revisão não foram contados como gerações completas. O coordenador encerrou sem erro. Não houve retreino após abrir a validação.

**Nenhum candidato foi aprovado no protocolo.** Os dois filhos selecionados, G1/a10 e G2/a10, têm pesos diferentes, mas produziram exatamente as mesmas posições nos dois trimestres de validação e as mesmas posições e curva na carteira contínua. São duas políticas numericamente distintas, mas sem diversidade comportamental nessas avaliações. O campeão do desenvolvimento permaneceu o G1/a10 até a G20.

| Avaliação do filho selecionado · R$1.000 iniciais | Líquido do bot | CDI bruto |
|---|---:|---:|
| 2025-Q3 | R$-103,66 | R$37,05 |
| 2025-Q4 | R$-100,93 | R$35,90 |
| Carteira contínua · out/2024–dez/2025 | R$-103,09 | R$173,83 |

A carteira contínua terminou com R$896,91; CDI no mesmo calendário: R$1.173,83. Diferença de R$-276,93 para o bot. O limite global foi atingido em 21/06/2025 às 21:22 (São Paulo), e a carteira ficou em caixa até o fim de dezembro; não houve reinício para acessar regimes posteriores. Queda máxima desde o pico: 42.79%. O limite global de 10% tem referência no capital inicial; não equivale a um limite de 10% desde o maior patrimônio.

Nas 245 posições da carteira contínua, o bruto já com slippage embutido foi +R$390,75; taxas R$486,86 e funding líquido R$-6,99. Valores arredondados. As taxas excederam o ganho bruto. Slippage modelado: R$489,26; não subtrair novamente. Isso identifica uma contribuição negativa importante dos custos, mas não é um backtest alternativo sem custos: mudar custos poderia mudar a trajetória e as decisões.

Apesar de as ações estarem disponíveis no ambiente, o filho não usou realizações parciais, movimentos de stop ou proteção por trailing na carteira contínua: zero em todos os três contadores. As ações observadas foram esperar e tentar entradas a 15×. Isso é um achado comportamental; não demonstra, por si só, um erro no motor ou que forçar essas saídas tornaria a estratégia lucrativa.

A seleção trimestral e a preservação dos pesos organizaram a pesquisa, mas não demonstraram melhora financeira consistente. Aumentar a contagem de gerações não é justificado por esta rodada. O próximo diagnóstico deveria separar a aprendizagem das saídas, a repetição do mesmo comportamento entre filhos e a relação sinal/custos. Uma nova hipótese exigirá registro próprio; os trimestres de validação agora também estão consumidos e não devem servir de teste independente de novos ajustes.

Integridade conferida após o encerramento: 1.391 hashes de fontes, dados, dependências, modelos herdados e registros permanecem iguais. Todos os três modelos receberam zero passos de aprendizado na avaliação e mantiveram os tensores. O relatório de validação original permaneceu imutável. Nenhuma alteração na estratégia, no risco, nas ordens reais ou nos dados privados foi feita nesta conferência.

Painel: http://127.0.0.1:4173/pesquisa-genetica/pepe-v4.html#validacao
