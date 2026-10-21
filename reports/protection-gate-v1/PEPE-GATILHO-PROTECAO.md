# Proteção de lucro: regra atual versus após a primeira parcial

Painel local: http://127.0.0.1:4173/pesquisa-genetica/gatilho-protecao.html

## Conclusão

Atrasar a proteção até a primeira parcial aumentou o ganho médio entre vencedores, mas reduziu a frequência de trades positivos. A expectativa líquida continuou negativa nos dois lados e nos dois calendários. Na genética selecionada, uma oportunidade que rendia R$1,71 passou a perder R$9,03. A média mensal dos cinco meses originais piorou de −R$2,54 para −R$4,69.

A nova regra **não foi promovida**. O piloto original, pesos e fontes congeladas permanecem preservados. A rodada terminou como comparação de regras, sem treino novo.

## Hipótese e isolamento

O estudo anterior mostrou que a regra de lock podia mover o stop para proteger lucro antes da primeira parcial. Testamos se esperar uma realização preenchida permitiria ganhos maiores suficientes para compensar as perdas adicionais.

- **Controle:** gatilho original, inclusive lock antes da primeira parcial quando elegível.
- **Tratamento:** ajustes de stop para proteger lucro bloqueados até a confirmação de uma primeira parcial preenchida (`firstTaken`). Depois disso, mesmos mecanismos de breakeven/lock/proteção originais.
- Um alvo tocado ou uma ordem de parcial recusada **não** libera a proteção.
- O stop inicial de1,5ATR permanece ativo desde a entrada nos dois braços.

A escada preservada é a original sobre margem: 10%/20%/40% líquidos equivalentes sobre a quantidade/margem inicial, frações25/50/25. **Não adotamos a escada1/2/3R do experimento anterior.**

Mantidos15×, risco1%, limites diário/global3%/10%, lock0,25R de preço, todos os custos de estresse/funding/lotes/ticks, decisão5m, execução e alvo reconferido na abertura, fronteira mensal explícita. Nenhum prazo de operação foi adicionado. Não houve busca de parâmetros, troca de entrada ou aumento de risco para fabricar lucro.

## Protocolo e amostra

Registro anterior aos resultados: `work/pepe-protection-gate-v1/protocol.json` e `registration.json`.

- **23.408 pares** de oportunidades com entradas idênticas: mesmo horário, lado, preenchimento/referência, quantidade, stop/margem/fee/risco inicial.
- **64 carteiras mensais:** quatro fontes de sinais × dois braços × oito meses.
- Reutilização exata dos grids, previsões e propostas imutáveis do estudo anterior; sem inferência, retreino, refit do calibrador ou alteração de limiar.
- Fontes: genética semente151, PPO101, PPO202 combinados e controle de tendência alinhada1h/4h.
- Cinco meses originais: abril, maio, junho, julho, setembro/2024.
- Calendário posterior: outubro–dezembro/2024. Todos esses meses já tinham sido examinados no laboratório e no teste anterior: **não há validação independente nova**.

As posições isoladas se sobrepõem e começam cada uma com R$1.000. Não somar seus resultados como lucro de carteira. Os resultados emR usam o orçamento de risco original de R$10, não retorno percentual da margem.

As carteiras mantêm saldo, dimensionamento, sobreposição e limites reais dentro de cada mês; uma saída mais longa pode impedir uma próxima entrada. Propostas são iguais, mas preenchimentos posteriores e quantidades podem divergir. Caixa entra nas médias, reinícios mensais não são compostos. Mesmos calendários e capital no CDI bruto, resultados antes de impostos e câmbio fixo5BRL/USDT.

## Resultado pareado

Média líquida por oportunidade, em R de orçamento:

| Calendário | Lado | Atual | Após parcial | Diferença |
|---|---|---:|---:|---:|
| Cinco meses originais | Compra | −0,332729 | −0,324173 | +0,008556 |
| Cinco meses originais | Venda | −0,306045 | −0,295901 | +0,010145 |
| Out–dez/2024 | Compra | −0,316779 | −0,316951 | −0,000172 |
| Out–dez/2024 | Venda | −0,331314 | −0,314092 | +0,017223 |

Melhoras pequenas em algumas médias não representam aprovação: todas continuaram negativas, e a compra no calendário posterior piorou ligeiramente.

Nos cinco meses originais:

| Medida | Compra · atual → após parcial | Venda · atual → após parcial |
|---|---:|---:|
| Posições positivas entre preenchidas |44,24% →34,34%|46,88% →36,41%|
| Ganho médio dos vencedores |+0,3703R →+0,7584R|+0,3587R →+0,7452R|
| Perda média dos negativos após mudança |−0,8905R|−0,8922R|
| Lucros que viraram perdas |722|763|
| Perdas que viraram lucros |0|0|
| Proteções antes da primeira parcial |2.544 →0|2.815 →0|

No calendário posterior,477 compras e400 vendas antes positivas viraram negativas; nenhuma perda virou lucro. No total, foram2.362 conversões de lucro para perda. Há posições que melhoraram bastante, mas isso não compensou o resultado líquido no conjunto de forma suficiente para produzir vantagem positiva.

A proteção do tratamento nunca ocorreu antes de uma parcial preenchida, tanto nas posições isoladas quanto nos ledgers das carteiras. O stop inicial continuou fechando posições quando necessário.

## Carteiras mensais

Líquido mensal médio:

| Fonte de entrada | Originais · atual | Originais · após parcial | Out–dez · atual | Out–dez · após parcial |
|---|---:|---:|---:|---:|
| Genética151 |−R$2,54|−R$4,69|R$0,00|R$0,00|
| PPO101 |−R$1,94|−R$1,94|+R$0,64|+R$0,64|
| PPO202 |R$0,00|R$0,00|−R$3,26|−R$3,26|
| Tendência alinhada |−R$101,79|−R$102,56|−R$101,59|−R$101,08|

Nenhuma carteira superou CDI no respectivo mês. As duas sementes PPO e sua média são reportadas; não escolhemos o PPO101 para promover por ter lucro pequeno num sufixo. O controle de tendência continuou atingindo limite global nos oito meses, antes de custos finais/gaps poderem ultrapassar o gatilho nominal.

O caso alterado entre os poucos sinais dos especialistas foi a compra de24/06/2024 às03:00UTC: +R$1,71 virou −R$9,03 no teste isolado. Antes a proteção antecipada preservava um ganho; sem parcial preenchida no novo braço, o stop inicial encerrou com perda. O painel mostra os instantes de primeira parcial, primeira proteção e encerramento nas duas regras.

## O que isso diz sobre entrada e saída?

O teste mede uma mudança específica do gatilho de proteção, não prova que as entradas funcionam. Os especialistas de entrada não aprenderam as saídas deste piloto, que são regras fixas. Atrasar a proteção redistribuiu os resultados de posições antes positivas; não recuperou perdas nesta amostra.

Continuar ajustando saídas nesses mesmos históricos aumenta o risco de escolher um detalhe que só funciona no passado. Nenhum novo treino foi iniciado para perseguir o melhor resultado. Uma próxima hipótese precisa demonstrar seleção observável antes da entrada com expectativa líquida favorável e nova avaliação cronológica reservada/prospectiva antes de qualquer promoção.

## Integridade e reprodução

- Motor anterior preservado; novo fork `scripts/protection-gate-engine.mjs` com gate explícito.
- Gatilho aplicado tanto no controlador quanto no motor, inclusive para comandos de proteção prematuros.
- Controle reproduziu exatamente **23.408 resultados de oportunidade** e **32 resumos/ledgers mensais anteriores**.
- Identidade dos preenchimentos iniciais verificada nos23.408 pares.
- **1.390 inputs/fontes registrados** conferidos antes e depois, incluindo previsões, sinais e pares do estudo pai.
- Testes verificam parcial recusada, stop inicial ativo, proteção liberada após preenchimento, ausência de proteção prematura, contabilidade, períodos, sinais, carteiras sem sobreposição e CDI.

Código: `protection-gate-engine.mjs`, `protection-gate-core.mjs`, `prepare-protection-gate.mjs`, `run-protection-gate.mjs`. Protocolo, registro, pares e resultado congelado em `work/pepe-protection-gate-v1/`.

```sh
node --test tests/protection-gate.test.mjs tests/protection-gate-results.test.mjs tests/r-ladder.test.mjs tests/r-ladder-results.test.mjs tests/opportunity-results.test.mjs tests/specialist-opportunity.test.mjs tests/specialist-replay.test.mjs tests/specialist.test.mjs
```

A execução foi concluída, sem retreino, sem ordens reais e sem alteração da regra em produção/simulação contínua. Dados e pesos permanecem locais; código e metadados seguem para o repositório privado autorizado.
