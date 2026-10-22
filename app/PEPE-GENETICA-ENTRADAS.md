# Genética das entradas de PEPE

Acompanhamento: http://127.0.0.1:4173/pesquisa-genetica/genetica-entradas.html

Rodada local registrada em `work/pepe-payoff-genetic-v1`, com 256 indivíduos em quatro ilhas e 100 gerações. Sem limite de horas. Até nove processos de treinamento de uma thread e um processo compartilhado de carteira. Memória e disco podem provocar pausa; o usuário também pode pausar pelo painel. `caffeinate` acompanha o coordenador sem duração fixa; fechar a tampa ainda pode suspender o Mac.

A genética escolhe grupos dos 19 indicadores e hiperparâmetros de árvores HistGradientBoosting. São três estimadores por lado: probabilidade de lucro líquido, ganho líquido condicional e perda líquida condicional. A calibração sigmoid usa o mês anterior à seleção. Não é a antiga população neural PPO. O pai inicial é a configuração anterior do boosting, com pesos refeitos do zero em cada bloco; não é a antiga árvore G151.

Saídas de cinco minutos, alavancagem 15x, risco de 1%, proteção, limites, funding e custos de estresse permanecem congelados. Não há ordens reais ou API paga de IA.

## Cronologia

| Treino | Calibração | Seleção |
| --- | --- | --- |
| Jun–jul/2023 | Ago/2023 | Set/2023 |
| Jun–ago/2023 | Set/2023 | Out/2023 |
| Jun–set/2023 | Out/2023 | Nov/2023 |
| Jun–out/2023 | Nov/2023 | Dez/2023 |

Resultados precisam amadurecer antes do corte, com embargo de 30 minutos. Os quatro meses usados repetidamente pela genética são seleção, não teste independente. Carteiras mensais começam com R$1.000; seus reinícios não são juros compostos.

A pontuação é mediana do excedente líquido mensal ao CDI menos 0,25 vezes sua dispersão, menos 0,25 vezes o maior drawdown em reais e menos R$0,001 por indicador. Pontuação não é lucro. Caixa, meses sem operações e modelos abaixo do CDI são exibidos. Suporte mínimo exige 30 posições e atividade em três dos quatro meses; não há incentivo para operar à força.

Após 100 gerações, automaticamente congela-se o campeão, refazem-se os pesos com jun–dez/2023 e a calibração com jan–fev/2024, e audita-se abr–jul e set–dez/2024. A auditoria não escolhe pais, mutações ou outro campeão. Esses calendários já foram vistos no laboratório: a análise é retrospectiva fora desta seleção e não demonstra generalização prospectiva.

## Integridade e operação

Protocolo, fontes científicas e entradas têm hashes registrados. Pesos, previsões, carteiras e operações de cada campeão são arquivados antes de publicar seu resultado. O checkpoint atômico registra cada candidato; genomas repetidos reutilizam o resultado exato e não representam novos treinos.

Estado: `node scripts/local-payoff-genetic.mjs status`.
Início/retomada após encerramento do processo: `node scripts/local-payoff-genetic.mjs start`.
Pausa e retomada sem encerrar o processo: botões no painel. Tarefas ativas terminam antes da pausa.

O processamento usa dados locais, funciona offline e continua sem o chat aberto. O site depende do servidor local já existente em 4173. Controle da rodada em 4180 aceita apenas comandos locais de pausa/retomada; parâmetros científicos são rejeitados. A rodada concluída não é reiniciada pelo mesmo comando.

Verificações: cinco testes Python, sete testes de integridade/resultados Node, quatro testes da navegação e teste real do Chrome nos quatro meses, desktop e celular. Controle HTTP e pausa/retomada verificados; sem alteração de geração ou limite de horas. Modelos binários, candles e `.local/` não são exportados ao GitHub.

## Média da população e sequência posterior

Painel: http://127.0.0.1:4173/pesquisa-genetica/genetica-validacao.html

Um acompanhamento independente (`scripts/watch-payoff-followup.py`, registro em `work/pepe-payoff-followup-v1`) reconstrói cada população pelos operadores e sementes registrados, confere com o checkpoint atual e calcula média/mediana dos256 indivíduos. Repetições de genomas mantêm peso e candidatos sem ordens entram com zero. Não altera a fitness ou os parâmetros da genética.

Após a auditoria automática do campeão, grava um relatório imutável comparando os mesmos oito meses com o boosting original. Inclui líquido mensal médio e mediano, CDI, quantidade de posições, meses ativos e concentração nas duas melhores posições. A exclusão das duas melhores é aritmética, não um novo backtest com caminhos/capital recalculados.

O antigo pico era da G830 do PPO v2: R$330,49 em uma posição numa sondagem de dois dias. Sua reconstrução no trimestre inteiro terminou em -R$100,71. Modelo e protocolo distintos das árvores atuais; contexto histórico, não comparação direta. O arquivo original de pesos não foi recuperado.

A possibilidade de1.000 gerações fica documentada, mas nenhum segundo treinador é disparado por esse acompanhamento. Primeiro, verificamos suporte, média/mediana após custos e CDI e dependência das melhores trades. O resultado é um critério para orçamento de pesquisa, não aprovação para operar. Fontes, protocolo e referências registrados separadamente. O processo lê arquivos locais a cada30s e não consome tokens de chat. Respeita pausas e não retoma o treinamento automaticamente.
