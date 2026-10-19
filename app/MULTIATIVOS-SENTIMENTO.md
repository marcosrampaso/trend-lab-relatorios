# BTC, ETH e sentimento local

Implementado em19/10/2026. Painel: http://127.0.0.1:4173/pesquisa-genetica/cripto-sentimento.html

## Perguntas e braços

ETH com G151 preservado; BTC com os mesmos pesos de ETH; BTC com uma floresta treinada no próprio ativo. Cada braço tem uma carteira técnica e uma com sentimento, R$1.000 simulados cada. Custos base/elevados são cenários contábeis. Não são contas reais nem resultado do capital real do usuário.

Os experimentos anteriores ficam preservados. O novo usa início/fim comum,30dias, sinais5m/contexto1h+4h, execução1m, atraso explícito de1min, risco1%,10x, funding corrigido, filtros do próprio contrato, câmbio fixo5. Rotas, limiares e arquitetura do G151 ficam fixos. Não se aumentou risco ou número de entradas para produzir lucro.

## Histórico e treinamento

BTC:14meses de candles1m, ago/2025–set/2026. ZIPs oficiais de trade/mark com SHA256 contra CHECKSUM da Binance; eventuais recuperações REST registram hash próprio, sem checksum independente. ETH reutiliza shards já instalados e verificados. Aquecimento em agosto; treino BTC set/2025–mai/2026; teste comum jun–set/2026. Todos os rótulos maturam antes do corte, com margem24h. Rótulo é resultado líquido positivo em operação isolada com custos elevados, funding corrigido, saída120/240min e entrada com1min de atraso. Sinais contrários podem encerrar antes do prazo.

BTC tem3.735exemplos de cruzamento e779de Bollinger. Cinco sementes por família,1.200árvores, profundidade10, mínimo100por folha; quatro processos, uma thread por ajuste. Pesos ETH são os preservados do G151, não um novo treino. Os rótulos BTC com atraso/funding corrigido são uma adaptação e limitam atribuir diferenças somente ao ativo. Limiares herdados podem ser inadequados para os scores do BTC; não foram ajustados olhando o teste.

Comparação retrospectiva sem sentimento, nas mesmas datas e condições. Junho–setembro/2026 de ETH já foi explorado e não constitui holdout independente. Regras e preparação têm registros/hashes. Custos, mínimos atuais aplicados ao passado, manutenção estimada e câmbio fixo são aproximações; não inclui tributos. As pequenas amostras de operações não comprovam vantagem. Nenhum vencedor é promovido.

## DistilRoBERTa

Modelo público: https://huggingface.co/mrm8488/distilroberta-finetuned-financial-news-sentiment-analysis

Revisão fixada `ae0eab9ad336d7d548e0efe394b07c04bcaf6e91`. Pesos safetensors, arquivos locais com hashes, `trust_remote_code=False`, sem download de Python remoto ou uso de pickle do repositório. Ambiente `.venv-sentiment` separado de `.venv-ml`; bibliotecas em `requirements-local-sentiment.lock.txt`. CPU com2threads. Não retreina o modelo de linguagem, não gasta tokens do chat e não usa API paga.

CoinDesk e Cointelegraph RSS, a cada5min. Somente manchetes em feeds ingleses; o conteúdo completo não é analisado nem verificado. Relevância explícita por palavras BTC/Bitcoin e ETH/Ether/Ethereum; temas macro sem menção ao ativo não entram. Duplicatas por título normalizado são removidas, mas paráfrases do mesmo evento podem permanecer. Cada registro preserva publicação, primeira recepção, classificação e revisão. Recepção/reclassificação não renovam idade; expiração após5h da publicação.

Filtro fixado: pelo menos2manchetes com confiança direcional≥0,8 de2veículos diferentes; média de P(positivo)−P(negativo)≥0,2 veta SHORT, média≤−0,2 veta LONG. Neutro, conflito, ausência, expiração, futuro ou falta de fontes suficientes: não veta, registra cobertura. Nunca transforma sentimento em risco alto ou probabilidade de lucro. Valores são hiperparâmetros exploratórios, sem validação prévia em cripto.

O JSON de notícias é copiado para a decisão antes da entrada. Dados recebidos depois não alteram sinais antigos. Saídas contrárias são mantidas mesmo quando a entrada é vetada. O modelo pode classificar mal notícia de cripto ou atribuir sentimento de uma empresa ao ativo mencionado: o teste mede se o filtro ajuda apesar dessas limitações.

## Processos e reprodução

```sh
python3 -m venv .venv-sentiment
.venv-sentiment/bin/python -m pip install --only-binary=:all: -r requirements-local-sentiment.lock.txt
.venv-sentiment/bin/python scripts/prepare-local-sentiment.py
node scripts/local-sentiment-service.mjs start
python3 scripts/fetch-btc-comparison.py
node --max-old-space-size=4096 scripts/build-btc-comparison.mjs
.venv-ml/bin/python scripts/train-btc-comparison.py
node scripts/evaluate-btc-comparison.mjs
node scripts/local-multiasset.mjs start
```

Não repetir avaliação no diretório já registrado nem sobrescrever treino/rodada existentes para mudar regras. Em outra máquina, restaurar campeão preservado e os dados ETH omitidos do GitHub conforme as instruções do projeto. `start` retoma os mesmos registros; `status` e `stop` estão disponíveis nos dois serviços. Os processos respeitam a pausa do servidor principal e não o iniciam. Estado em `work/multiasset-v1` e `work/local-sentiment`; somente JSONs de relatório ficam em `web/data`. Não acessam nem alteram `.local/runtime.sqlite`.

Arquivos do modelo e dados brutos ficam locais; código, métodos e retratos resumidos podem ir ao repositório privado. O histórico antigo de rompimento apresentou revisão de candle13:00UTC em19/10; seu guard de integridade recusou o novo dado. Não se apagou nem reescreveu aquela rodada para contornar a divergência; não é resultado deste novo filtro.


## BTC como contexto: teste separado

Pedido adicional: avaliar se BTC pode informar o viés de operações no ETH. Implementação em `scripts/btc-context-core.mjs`, protocolo `btc-context-protocol.json`. Entradas diagnósticas: retornos BTC1h/4h/24h, EMA20/50 em1h/4h, correlação e beta dos retornos logarítmicos de ETH/BTC nas últimas72h, força relativa24h e correlações defasadas1h nos dois sentidos. Correlações de defasagem são descritivas: não são testes de Granger nem demonstram causalidade.

Ablação histórica fixa: somente veta nova entrada ETH se correlação72h≥0,60 e ambos os períodos BTC estiverem contra o lado da operação. Saídas contrárias permanecem. Junho–setembro/2026 com custos base: controle +R$27,50/8operações/drawdown2,37%; filtroBTC +R$13,95/1operação/drawdown0,63%. Custos elevados: +R$15,17 e+R$10,46. O filtro vetou8dos9sinais liberados, não necessariamente8entradas efetivas. Reduziu atividade e lucro; a pequena amostra não estabelece melhora. Resultado completo em `web/data/btc-context-study.json`.

Por esse resultado, o filtro não foi promovido às carteiras já registradas. `node scripts/local-btc-context.mjs start` mantém somente observações prospectivas de diagnóstico, registradas antes da entrada futura. Não adiciona variáveis a florestas existentes de12entradas nem muda seus pesos. `status` e `stop` disponíveis; respeita pausa do serviço principal. Contexto ao vivo em `web/data/btc-market-context.json`; painel na âncora `#btc-context`.

Base consultada: [Kurihara e Matsumoto,2026](https://link.springer.com/article/10.1007/s10690-026-09589-z) relatam reações principalmente simultâneas em ETH/LTC e mais atraso nas pequenas moedas selecionadas; seus recortes de eventos não validam este filtro. [Sifat etal.,2019](https://doi.org/10.1016/j.ribaf.2019.06.012), conforme resumo disponível, relatam testes mistos e relações amplamente bidirecionais. Tratar “BTC sempre lidera tudo” como hipótese, não como lei.

Validação final:225testesNode aprovados, incluindo equivalência das carteiras sem notícias, disponibilidade temporal, integridade de decisões e invariância do contextoBTC ao modificar dados futuros. RSS pode atualizar títulos no mesmoURL; o coletorV1 deduplica por título normalizado, portanto revisões do mesmo artigo ainda podem ser contadas separadamente. Esta limitação está registrada para a próxima versão, sem reescrever a política da rodada iniciada.
