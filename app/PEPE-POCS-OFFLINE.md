# FinRL explicado, treino offline e duas POCs

Página: http://127.0.0.1:4173/pesquisa-genetica/finrl-explicado.html

POCs: http://127.0.0.1:4173/pesquisa-genetica/finrl-explicado.html#pocs

Controle1.000: http://127.0.0.1:4173/pesquisa-genetica/pepe-finrl.html?population=1000

## O que é FinRL nesta implementação

FinRL0.3.7 instalado fornece o DRLAgent real, que cria PPO do Stable-Baselines3. Um ambiente Gymnasium próprio conversa por stdin/stdout com o motor de futuros. O PBT é a camada que seleciona membros, herda pesos e modifica parâmetros de aprendizado. Isso não é um modelo de linguagem decidindo ordens e não usa API paga de IA.

38 observações,10 ações; risco planejado1%,10x/15x por entrada, limite diário3%/global10%. A página tem diagrama do ciclo, exploração interativa de quatro passos, tabela de funções e resultados atualizados pelos arquivos locais. Notícias/BTC/DistilRoBERTa permanecem fora do PPO PEPE.

## Offline

Histórico, features e dependências já estão no disco. Treino PPO/PBT, POC de risco, painel4173 e controle4174 funcionam sem internet. Downloads novos, notícias, cotações ao vivo e GitHub dependem de conexão.

`scripts/check-pepe-offline.py` executou PPO real por256 passos para cada ambiente250/1.000, com chamadas Python de socket/DNS e chamadas Node de TCP/HTTP/DNS/fetch bloqueadas nos subprocessos de teste. Não mudou Wi-Fi, coletores em andamento, pesos oficiais ou período final. É um teste operacional instrumentado; não uma auditoria integral de rede do sistema.

Manter tampa aberta e energia suficiente. `caffeinate` é associado ao processo de treino; fechar tampa ou esgotar bateria pode suspender o Mac. Checkpoints sobrevivem, mas retomada automática depois de reiniciar/login não foi instalada.

## População1.000 isolada e controle

Fork registrado: `pepe-finrl-pbt-1000-v1`, diretório `work/pepe-finrl-1000-v1`, protocolo `pepe-finrl-1000-protocol.json`. Fontes científicas250 e seus hashes não foram alterados. O gerador `prepare-pepe-1000.mjs` verifica os insumos registrados, cria cópias isoladas dos adaptadores e congela seus hashes. Reutiliza dados/indicadores íntegros e bibliotecas instaladas; não herda pesos escolhidos dos250. Os250 primeiros membros têm as mesmas sementes iniciais para permitir comparação pareada exploratória.

“1.000” são membros lógicos, não1.000 processos. Boost limita a3 workers com2 threads cada; eco usa1. Endpoint4174 agora aceita apenas populações250/1.000, origem local permitida, JSON e cabeçalho próprio. Uma troca solicita pausa, aguarda o processo anterior terminar e só então inicia o outro. Se a pausa demorar mais de60s, a nova população não inicia. Controle manual pausa a sequência automática da POC e cancela trocas pendentes.

Foi testada a troca real250→1.000→250, com7 trabalhos1.000 preservados na geração parcial. Nenhuma concorrência entre as duas populações foi observada no teste. Limites48h ativas e10GiB permanecem.

## POC1: orçamento de aprendizado igual

Registrada antes dos alvos de comparação:

1. Manter250 atéG200:51.200.000 passos.
2. Pausar250 e executar1.000 atéG50:51.200.000 passos.
3. Comparar as auditorias arquivadas do trimestre fixo out-dez2024, custos elevados, líquido e score com penalidade de drawdown.
4. Preservar1.000 pausado e retomar250.

O scheduler local `run-pepe-population-poc.mjs` verifica arquivos a cada5s, sem chamadas de IA/internet. Não lê teste final. Se surgir erro ou pausa de disco/orçamento, interrompe a sequência. Um controle manual pausa o scheduler. Reiniciar explicitamente com `node scripts/start-pepe-population-poc.mjs`; não há mudança de estratégia automática.

As auditorias são exatamenteG200/G50 mesmo se o monitor pedir pausa alguns trabalhos depois. A comparação não usa o lucro de uma sondagem curta ou um número diferente de decisões. O painel também prepara paresG400/G100,600/150,800/200,1000/250, mas a sequência automática desta POC cobre só o primeiro par.

É uma execução por população em desenvolvimento previamente examinado. Não é prova estatística independente de superioridade; frequência de seleção, tempo individual e agenda de sondagens também diferem. Não selecionar pelo teste2025/2026.

## POC2: GaussianNB de risco em observação

Registro `pepe-nb-poc-v2`; resultado `web/data/pepe-nb-poc.json`. A primeira tentativa técnica falhou antes de construir o conjunto por nome de campo incorreto no arquivo bruto. Código, registro e falha foram preservados em `work/pepe-nb-poc-v1`; a correção usa limites do pacote de features e um registro novo. Nenhum modelo foi escolhido por esse erro.

Pergunta: excursão adversa nos próximos30min em relação à distância de stop1,5ATR. Classes: baixo<0,5; moderado0,5..<1; alto>=1. Entrada é próxima abertura1m com slippage0,10%; o rótulo não é lucro líquido e não inclui taxa/funding. Baixo não significa seguro.

Oportunidades a cada30min, compra/venda pareadas, oito features conhecidas: ATR/preço, logRVOL, distância VWAP/ATR, tendência1h, tendência4h, retorno5m, disponibilidade de volume e direção candidata. Janela de rótulo completa e amadurecida antes da fronteira temporal; entrada sem volume é excluída. Não treinamos só em ordens vencedoras do PPO.

- Ajuste jun2023-mai2024:35.136 exemplos.
- Calibração jun-jul2024:5.856 exemplos.
- Avaliação posterior out-dez2024:8.824 exemplos. Mesmo desenvolvimento já usado por outras pesquisas; diagnóstico retrospectivo, não holdout independente do laboratório.

Resultados Brier multiclasse (menor é melhor):

| Modelo | Brier |
|---|---:|
| GaussianNB sem calibração |0,666364|
| GaussianNB calibrado |0,657359|
| Logística calibrada |0,656091|
| Frequência histórica |0,661161|
| Regra por volatilidade |0,657289|

Calibrar ajudou o GaussianNB em relação à versão crua e à frequência constante. Ainda não superou a logística ou a regra por volatilidade. Não há evidência de ganho financeiro: nenhuma POC de execução com esse filtro foi avaliada, e o modelo não foi conectado ao PPO. Não foram acessados dadosJan2025+ neste ajuste/avaliação. A página mostra log loss, acurácia balanceada, contagem por conjunto e calibração de risco alto; oJSON guarda matrizes de confusão e exemplos.

## Verificações

Suíte com327 testes passou, além de2 testes da nova página. Verificação offline real:2×256 passos,38 observações/10 ações. HTTP de página/resultados e isolamento250/1.000 confirmados. Não houve inspeção visual interativa no navegador nesta sessão; os diagramas são SVG local e os estados da página foram verificados por testes estruturais.

Fontes: [FinRL](https://github.com/AI4Finance-Foundation/FinRL), [PPO](https://stable-baselines3.readthedocs.io/en/master/modules/ppo.html), [PBT](https://arxiv.org/abs/1711.09846), [Naive Bayes](https://scikit-learn.org/stable/modules/naive_bayes.html), [calibração](https://scikit-learn.org/stable/modules/calibration.html).
