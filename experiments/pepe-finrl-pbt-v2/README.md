# PEPE PPO/PBT v2 - snapshot de pesquisa

Estado em19/10/2026: pausado após teste operacional;48/250 trabalhos da primeira geração,49.152 passos e zero gerações completas. Meta:250 membros/1.000 gerações. Não há PEPE final selecionado; resultados de desenvolvimento são usados na seleção e não são validação independente.

Código completo em `../../app/`. Método em `../../app/PEPE-FINRL-PBT.md`. PDF distingue implementação atual de proposta Naive Bayes, ainda não treinada. Dados brutos, modelos, runtimeSQLite e credenciais não são enviados. Os hashes de registro permitem conferir os insumos locais; este snapshot não basta para reproduzir o treino sem restaurar os dados e dependências.

`references.json`: CDI, G151 e Donchian no calendário comum jul2025-ago2026; referências ETH10x/15x e custos base/elevados. `status-snapshot.json` contém exemplos de desenvolvimento; não é uma execução em tempo real pelo GitHub. O painel operacional funciona exclusivamente no computador local.
