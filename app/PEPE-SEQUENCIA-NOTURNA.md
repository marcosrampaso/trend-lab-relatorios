# Sequência local: genética200, auditoria e MaskablePPO

Painel: http://127.0.0.1:4173/pesquisa-genetica/noite-encadeada.html
Replay: http://127.0.0.1:4173/pesquisa-genetica/genetica-replay.html

## Por que mudar

O ganho do campeão da genética nas quatro carteiras mensais da seleção ainda não demonstra lucro em outros regimes. A mediana da população tem muitos zeros porque indivíduos ficam em caixa. Aumentá-la operando à força não resolve expectativa negativa. A V3G91 também teve R$319,77 em55 posições no trimestre escolhido e perdeu no mês final. Não demonstramos que MaskablePPO seja superior às árvores.

O objetivo novo é comparar consistência temporal, custos, drawdown e diversidade, preservando as experiências já registradas. Uma melhora de pontuação pode refletir risco e complexidade, e não lucro maior. Todos os calendários históricos já foram examinados no laboratório.

## Transições automáticas

1. A execução original continua até100 gerações e faz sua auditoria original.
2. A continuação registrada `work/pepe-payoff-genetic-200-v1` reaproveita o checkpoint da100 e os caches exatos. Executa mais100, totalizando200. Pais, fitness, risco e regras permanecem iguais. A auditoria da100 não determina as mutações ou o prazo da continuação.
3. Congelam-se os pesos200. Auditamos todos os meses elegíveis de março/2024 a setembro/2026; agosto/2024 é excluído por mark faltante. Há também uma carteira única de setembro/2024 a setembro/2026, sem reinícios após perdas. Meses de treino/calibração não são chamados fora do ajuste.
4. Após a auditoria, começa a simulação prospectiva separada do modelo200 e o novo MaskablePPO, em paralelo.

O processo responsável é `scripts/run-night-chain-v2.py` (revisão operacional2, com fontes originais preservadas), com registro em `work/pepe-night-v1`. O controle local usa4183; o servidor do site continua4173. A continuação das árvores usa4182. Nenhum processo depende deste chat para avançar. Bloqueio da tela não encerra o processamento; `caffeinate` acompanha o coordenador sem duração fixa. Tampa fechada ainda pode suspender o Mac. Sem alteração global de energia.

## MaskablePPO

250 agentes lógicos:125 originais e125 com contexto, em cinco ilhas de25 por variante. Cada agente possui sete estados de política distintos, associados a cortes temporais. Uma geração atualiza um desses sete estados, em rotação, com1.024 passos por agente. A comparação financeira ocorre a cada28 gerações e na1.000, seguida de reprodução. Não são250 trabalhadores simultâneos.

Cada uma das sete políticas aprende somente antes do trimestre que avalia. Os trimestres da seleção são2024-Q4 até2026-Q2, totalizando21 meses. O treino de cada fold começa em junho/2023 e termina no início do seu trimestre; episódios que cruzam agosto/2024 são excluídos. As carteiras trimestrais são contínuas dentro do trimestre, incluindo meses sem operações e caixa após limites. Não somamos reinícios como composição de capital.

Fitness: mediana dos21 excedentes mensais líquidos ao CDI, menos0,25 vezes sua dispersão, menos0,25 vezes o maior drawdown trimestral em reais. Média, mediana, pior mês, CDI e quantidade de modelos em caixa aparecem separadamente. A mediana da população não recebe bônus artificial. Torneio e herança ficam dentro da mesma variante/ilha e do mesmo fold; não transferimos pesos futuros para um corte anterior. Há mutações e imigrantes, ampliados após estagnação.

As duas variantes usam redes novas32×32, as mesmas sementes, orçamento, recompensa, risco, custos e saídas aprendidas, com máscaras por estado. Três épocas PPO e `target_kl=.01` são opções fixas de regularização, não prova de ausência de sobreajuste. Não transferimos os pesos selecionados da V3 para estes folds.

A variante de contexto usa a seleção de grupos de19 indicadores do campeão200 e oito componentes de probabilidade calibrada/ganho/perda/expectativa de referência. Os componentes só ficam disponíveis depois de março/2024, pois seu ajuste usa2023 e a calibração jan–fev/2024. Antes disso entram zeros e uma flag de indisponibilidade. As probabilidades referem-se à saída fixa de referência, não à política PPO; são uma hipótese de contexto, sem veto probabilístico às entradas. A outra variante recebe os15 indicadores originais e padding de zeros, mantendo a mesma dimensão51.

Após1.000 gerações congelam-se dez modelos, um por variante/ilha. A política do último fold de cada escolhido é avaliada em julho–setembro/2026, sem treino ou escolha de melhor semente nesse período. Mostramos todas as sementes e agregados. É auditoria retrospectiva fora desta seleção; esses dados já foram consumidos pelo laboratório e não são evidência prospectiva independente.

## Recursos, retomada e simulação

Árvores: até nove processos de uma thread, mais carteira Node compartilhada. PPO: até cinco workers de duas threads Torch alternando com o simulador Node, reduzidos conforme memória. Os1.000 ciclos podem levar dias ou mais; não há promessa de conclusão durante uma noite.

A pausa espera tarefas ativas salvarem; cada treino neural tem recibo e peso imutável antes da avaliação. A retomada reaproveita resultados concluídos e o checkpoint. Baixa memória ou disco livre abaixo da reserva provoca pausa. Nenhum limite de horas foi introduzido.

O acompanhamento ao vivo usa somente endpoints públicos da Binance e uma carteira simulada separada de R$1.000. Decisões têm horário registrado antes da execução agendada no minuto seguinte. Sinais perdidos não são preenchidos. Pesos não mudam online. Sem rede, aguarda dados; o PPO continua offline. Sem chaves, ordens reais ou API paga de IA. O CDI corrente é mostrado com seu estado de disponibilidade/reconciliação, sem taxa inventada.

O replay mostra os candles fechados, entradas, parciais, saídas e mudanças de stop do campeão arquivado. É histórico, separado do acompanhamento prospectivo. Fontes, pesos antigos, `.local/` e resultados encerrados permanecem preservados.
