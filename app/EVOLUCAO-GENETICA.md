# Evolução genética local

Solicitada pelo usuário em18/10/2026 para executar depois da grade ampliada. A fila está registrada em `genetic-ml-protocol.json`. O processo espera `extended-20261018-v2` terminar e usa o mesmo limite de execução: **18/10/2026 às11h38 deSão Paulo**. Não inicia outra janela de8h ao entrar na genética.

## Seleção e mutações

O candidato inicial é escolhido pelos resultados de validação da grade ampliada, excluindo a referência constante. Usa três blocos de3 meses: junho–agosto2025, dezembro2025–fevereiro2026 e junho–agosto2026. Todos precisam satisfazer cobertura, número de operações e drawdown da rodadaV2. O fitness é o menor entre a soma do resultado com custos base e a soma com custos2×, dividido por9 meses. Não usa o lucro do teste posterior para selecionar.

A cada geração, o melhor candidato observado é mantido e produz10 mutações únicas. Elas podem alterar prazo, janela de treino, limiar e hiperparâmetros do algoritmo escolhido. Família de estratégia e algoritmo são mantidos nessa linhagem. Risco, alavancagem, stops e custos não são genes. Assim, esta genética não explora todos os algoritmos de novo: a grade anterior escolhe o ponto inicial e a genética refina sua vizinhança.

Há até30 gerações e parada após8 gerações sem melhora. Não se interrompe só porque apareceu lucro. Modelos idênticos são reutilizados quando a mutação muda apenas o limiar. As sementes de florestas/MLP são agregadas; não se escolhe a semente mais lucrativa. Cada modelo e geração têm checkpoints. Parada por tempo, pedido do usuário ou disco livre abaixo de4GB preserva os artefatos disponíveis.

Depois de congelar o vencedor, o sistema consulta setembro2026 uma vez como avaliação final desta busca. Esse mês já foi visto no projeto; não é um novo período intocado. O relatório distingue fitness na validação de resultado no teste. A busca pode terminar com perdas e não prova ter encontrado o melhor lucro global. Nenhum resultado ativa ordens ou promove o modelo automaticamente.

## Acompanhamento e controles

O painelScalping mostra a grade e a genética separadamente. Os resultados ficam nos diretórios locais das rodadas, e o relatório final será exportável no painel.

```sh
cd /Users/marcosbezner/Documents/Codex/2026-10-16/fi/outputs/trend-lab
npm run ml:status
npm run ml:evolution:status
```

Para interromper as duas etapas:

```sh
npm run ml:evolution:stop
npm run ml:stop
```

Parar a genética não para a grade, pois são processos separados. `ml:evolution:resume` retoma checkpoints compatíveis dentro do limite de horário original. Não há agendamento recorrente nemAPI paga deIA: são processos locais desta execução. A aba do navegador pode ser fechada sem parar os processos.

## Mac acordado

O controlador usa `caffeinate -is -w PID -t SEGUNDOS` com duração limitada ao prazo da execução. A proteção contra inatividade vale enquanto a fila genética existe; a proteção adicional de sistema depende de energiaAC. A grade também tem sua proteção por processo. As proteções terminam com os processos ou com o limite de duração, sem alterar permanentemente as preferências de energia. Não há comando para desligar a máquina.

**É necessário conectar o carregador e manter a tampa aberta.** A conferência inicial mostrou bateria69% e ausência de energiaAC. Nenhum comando evita falta de bateria, desligamento manual ou toda forma de suspensão ao fechar a tampa. A tela pode apagar, mantendo o cálculo ativo.

Verificações:8 testesPython,132 testesJavaScript e teste integrado adicional de multiprocessing, fitness financeiro de validação e teste final de vencedor congelado. O build e os estudos congelados também foram verificados. O treino ampliado permanece ativo; a genética começa após sua avaliação terminar, se houver tempo restante.
