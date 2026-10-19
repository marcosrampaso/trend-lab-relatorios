# Modo atual: local

O usuário pediu execução local. Veja [LOCAL.md](LOCAL.md), use o atalho **Iniciar Trend Lab.command** e acesse **http://127.0.0.1:4173/**. As seções abaixo documentam o histórico de pesquisa e hospedagem. As alterações deste modo não foram publicadas no site anterior. Mercado e simulação rodam no processoNode local, sem tokens deIA; notícias seguem `news-operations.md` e a rotina autorizada deste chat.

# Trend Lab

## Relatórios dos treinos

A campanha nova fica em **Genética adaptativa**, em http://127.0.0.1:4173/evolucao/index.html. Ela usa capital simulado de R$ 1.000, uma conta compartilhada entre estratégias e roteamento por contexto. O painel acompanha o processo Python independente do navegador.

`npm run ml:adaptive` inicia até 24h/1.000 gerações, com população de 64 e até dez processos. `npm run ml:adaptive:status`, `npm run ml:adaptive:stop` e `npm run ml:adaptive:resume` consultam, interrompem ou retomam os checkpoints no prazo original. A campanha não para por estagnação: amplia mutações após oito gerações e faz reinícios parciais a cada 24. Veja [GENETICA-ADAPTATIVA.md](GENETICA-ADAPTATIVA.md) e `adaptive-genetic-protocol.json`. Nenhum modelo é promovido automaticamente ao replay ou a ordens reais.

O menu **Treinos e resultados** abre http://127.0.0.1:4173/relatorios/index.html, com seis relatórios independentes: regressão Donchian, árvores e estratégias, árvore de scalping, benchmark CPU, treino ampliado e evolução genética. Cada página reúne método, períodos, entradas, configurações, resultados, limitações e hashes dos arquivos de origem. Os relatórios são fotografias dos resultados salvos; não acompanham novos treinos automaticamente.

`npm run reports:generate` atualiza os HTMLs e os resumos JSON a partir desses resultados, sem treinar modelos ou executar backtests. Os arquivos em `web/relatorios/` também abrem offline pelo `index.html`; CSS, JavaScript e dados são locais. O link **Abrir laboratório** exige o servidor local ativo. `npm test` verifica valores, links, dados embutidos e hashes das fontes.

Dashboard privado, estático, em português, para estudar a estratégia de tendência EMA16/64 com replay histórico e leituras avaliadas três horas depois.

## Rodada de rentabilidade

A página inicial agora abre **Rentabilidade**, com 24 cenários publicados: quatro períodos, três níveis de risco por operação (1%, 2%, 3%) e dois modelos de custos. O capital inicial de cada cenário independente é R$300, a configuração é 10x e o câmbio fixo hipotético é R$5/USDT. Os ajustes do replay não alteram esse relatório congelado.

O histórico ampliado contém 16.056 candles horários entre dezembro de 2024 e setembro de 2026, além de 2.007 eventos de funding. Dezembro/2024 aquece os indicadores. Os blocos são jan–jun/2025, jul–dez/2025 e jan–set/2026. Há também uma execução contínua de janeiro/2025 a setembro/2026, sem reiniciar o capital após perdas.

O protocolo está em `research-protocol.json` e seu hash foi registrado localmente em `research-freeze.json` antes do download ampliado. Não houve otimização ou exclusão de cenários desfavoráveis. Esse registro não equivale a uma auditoria independente.

Um arquivo mensal de mark price tinha 24 horas ausentes em 29/06/2026. O trecho foi recuperado na API pública oficial, sem interpolar preços ou usar candles negociados como substituto. A resposta e seu hash estão registrados em `web/data/eth-extended.json`. Os 66 arquivos mensais tiveram SHA-256 conferido contra o checksum publicado; a resposta REST de recuperação tem hash registrado, sem checksum externo publicado.

O relatório é reproduzível com:

```sh
node scripts/analyze-profitability.mjs
```

O resultado completo está em `web/data/profitability.json`. Os testes recalculam os resultados e verificam a reconciliação dos custos, fechamento das posições e encadeamento mensal. Rebaixar o risco para 1% não produz demonstração de rentabilidade: no teste de jan–set/2026, R$300 terminaram em R$287,76 (-4,08%), após custos modelados e antes de impostos. No período contínuo de 21 meses, terminaram em R$300,80 (+0,27%). Não há lucro futuro comprovado.

A redução máxima é medida nos fechamentos de 1h. O limite global de 10% se refere à perda sobre o capital inicial, não à queda desde cada novo pico. Conversão, saques, infraestrutura e tributos não foram incluídos. Todas as posições são encerradas com taxa e slippage no fim de cada cenário para não omitir o custo de saída.

## Abrir localmente

Requer Node.js para testes e Python 3 para servir os arquivos. Não precisa instalar pacotes.

```sh
npm test
npm run dev
```

Abra http://127.0.0.1:4173. O dashboard publicado no Sites serve os mesmos arquivos de `web/`.

## Como usar

1. Selecione abril de 2025 e escolha um instante no relógio. O arquivo completo está no navegador, mas o motor só processa candles encerrados até esse instante.
2. Clique em **Registrar leitura +3h**. A direção e o preço conhecido são gravados no armazenamento local do navegador.
3. Clique em **Avançar 3 horas**. O resultado da observação aparece; voltar o relógio esconde o resultado novamente.
4. Consulte **Sinais e viabilidade** para distinguir cruzamentos, entradas executadas e entradas rejeitadas pelos mínimos ou limites.
5. Compare com maio sem mudar as regras depois de olhar seus resultados. O capital reinicia na troca de período.
6. **Mercado agora** consulta apenas candles públicos, a cada minuto enquanto a página está visível. Não existe robô executando operações em segundo plano.

O TradingView abre separadamente como referência; não sincroniza com o relógio do replay. Os gráficos incorporados usam Lightweight Charts 5.0.8 com atribuição e licença em `web/vendor/`.

## Dados e estratégia

- ETHUSDT perpétuo USDⓈ-M; 3.624 candles horários entre janeiro e maio de 2025.
- 453 eventos históricos de funding e candles horários de mark price.
- Origem: arquivos mensais públicos em data.binance.vision, com SHA-256 conferido contra o checksum publicado. URLs e hashes estão em `web/data/eth-2025.json`.
- Jan–mar prepara as médias; abril é validação temporal, maio é teste posterior. Não houve treino de machine learning ou otimização de parâmetros.
- EMA16/64 em candles completos de quatro horas; sinal no cruzamento; entrada na abertura seguinte; stop inicial e móvel de duas vezes o ATR14.
- Configuração inicial: R$300, câmbio hipotético de R$5/USDT, 10x, 1% de risco planejado por operação, 0,05% de taxa por execução e 0,02% de slippage por execução.
- Funding histórico é contabilizado. Reserva de 0,03% do notional no dimensionamento; pausa diária de 3% no dia UTC e limite global de 10%, todos restritos à simulação.
- Filtros atuais de mínimo e quantidade são aplicados retroativamente, com data da consulta no manifesto. Margem de manutenção aproximada de 0,5%, editável; faixas de manutenção e taxa específica de liquidação não são reconstruídas.
- Se stop e liquidação forem tocados na mesma hora, assume-se liquidação primeiro. Esta é uma aproximação conservadora, não uma reconstrução de ticks.
- Timestamps do gráfico representam fechamento dos candles; a exibição usa São Paulo. Os blocos mensais de avaliação e o limite diário usam UTC.

Com o orçamento e risco iniciais, os mínimos de negociação podem impedir entradas. O simulador não aumenta a posição automaticamente para atingir esses mínimos. Ausência de operações não é evidência de rentabilidade ou de segurança.

Leitura +3h é uma observação de direção do preço, separada do resultado da estratégia, sem custos ou alavancagem. Resultados da estratégia incluem posição em aberto marcada a mercado, taxas e funding, sujeitos às aproximações acima.

## Privacidade e persistência

Não há conexão com a conta Binance, chave de negociação, depósito, ordem real, assinatura paga ou processo contínuo. Configurações e leituras ficam no localStorage deste navegador, sem sincronização entre dispositivos. Exporte CSV/JSON para guardar resultados. Leituras atuais que ficarem fora da janela de 1.000 candles disponíveis na consulta ao vivo serão marcadas sem dados.

A leitura ao vivo depende do acesso público à API da Binance na rede e região do visitante. O painel mostra falhas explicitamente e mantém o replay histórico disponível.

## Verificação

`npm test` cobre integridade temporal dos dados, candles incompletos, invariância ao alterar preços futuros, equivalência entre prefixo e histórico completo, ocultação do resultado +3h, mínimos de negociação, reconciliação de caixa/custos/funding e sequência sinal–entrada.

O relatório `validation-results.json` preserva a rodada inicial curta com parâmetros padrão. O relatório ampliado está em `web/data/profitability.json`. Eles não devem ser interpretados como recomendação de investimento nem como demonstração de vantagem estatística.

As bases conceituais estão no painel **Método e dados** e no caderno de pesquisa da conversa. As regras são hipóteses propostas para este experimento, sem promessa de lucro.

## Intradiário e notícias prospectivas

A aba Day trade publica32 cenários, com risco1% e operações limitadas a24h (12h na reversão). Inclui EMA9/21 em1h, rompimento20h com volume, reversão Bollinger20 e controle EMA16/64 com saída por24h. Nenhuma notícia ou análise de IA foi aplicada retroativamente. Os resultados em dados já vistos são exploratórios; a janela adicional de1–15/10/2026 é curta.

Reproduzir: `node scripts/analyze-intraday.mjs`. Dados e resultados estão em `web/data/eth-intraday.json` e `web/data/intraday-results.json`. O protocolo foi registrado em `intraday-protocol.json` e seu hash em `intraday-freeze.json` antes do cálculo.

A hospedagem usa um Worker ESM com assets comprimidos incorporados e um banco D1 vinculado comoDB. `npm run build` gera apenas `dist/server/index.js` e o manifesto. `node scripts/validate-artifact.mjs` verifica o artefato. O preview `npm run dev` usa SQLite local. O backend não chama API de IA nem negocia.

`GET /api/news` lê as análises. `POST /api/news` grava análises novas pelo limite de acesso privado do Sites, com JSON e cabeçalho específico de escrita. O servidor cria o horário de disponibilidade e a validade de5h, sem aceitar backdating. Preservar audiência somente do proprietário; não tornar público sem introduzir autorização própria de escrita.

A análise é produzida pelo Codex neste chat com o plano do usuário, não por API de modelo paga. A rotina e o orçamento estão em `news-operations.md`; o estado da cota fica em `../../work/news-budget.json` no workspace. Usar somente credencial de serviço nativa em memória e stdin oculto para `scripts/publish-news.mjs`, nunca em arquivo, ambiente ou navegador. Rotinas atualizam D1 sem novo deploy.

O controle de20 pontos percentuais por janela5h é aproximado e compartilhado com outros chats; parar preventivamente em17. Nenhuma garantia de corte rígido por token é anunciada. O benefício financeiro do filtro de notícias ainda precisa ser medido prospectivamente.

## Quatro melhorias · rodada preservada

A aba **Melhorias e futuro** adiciona uma sequência exploratória: rompimento original1h, execução15min, filtro amplitude/custo>=4 e entrada com atraso1h para permitir registro prospectivo. Regras em `improvements-protocol.json`, congelamento local SHA256 em `improvements-freeze.json`. Não otimizar o limiar após ler os resultados. Dados15min oficiais,74 ZIPs com CHECKSUM e96 mark prices reparados via REST com hash em `data/eth-15m.json`. Reproduzir com `python3 scripts/fetch-15m.py` e `node scripts/analyze-improvements.mjs`. Preserva relatórios anteriores.

`/api/forward` GET mostra a rodada e últimos40 registros; POST com cabeçalho `x-trend-lab-writer: forward-v1` registra somente o último fechamento1h antes da próxima abertura e simula duas carteiras (com/sem veto de risco alto), em custos base/dobrados. Acesso depende do limite owner-private Sites. D1 guarda rodada e filtros imutáveis, decisões sem sobrescrita e snapshots com hashes do motor/dados. Registra neutros também. Registro depois da entrada é recusado; horas perdidas não são preenchidas. Disponibilidade de notícias vem do servidor, usada antes da decisão, e deve permanecer válida na entrada.

A captura automática ocorre com a aba aberta/visível e na rotina de notícias5h. Não é um serviço contínuo24/7; lacunas são mostradas. Rodada termina30 dias após a primeira abertura elegível. Critérios de revisão no protocolo; nenhuma amostra futura foi inventada e nenhum resultado autoriza operar dinheiro real. SHA256 local não equivale a registro independente externo. Mercado/funding reais, custos/câmbio/liquidação modelados.

### Coleta local de mercado

A Binance respondeu HTTP403 à hospedagem. O coletor `web/market-collector.js` consulta endpoints públicos no navegador/dispositivo do proprietário (ou pelo helper local) e envia as respostas ao endpoint privado. O servidor verifica janela temporal, continuidade e formatos, calcula hashes e mantém sua própria hora de registro da decisão. `sourceMode: owner_device_public_api` identifica essa dependência; os preços recebidos não têm atestação independente do servidor. Falhas de rede ou cobertura incompleta não geram resultado novo. O token de acesso privado é enviado somente ao Site, nunca à Binance.

## Direção4h e auditoria de custos

Rodada separada em `direction-protocol.json`, registrada antes do cálculo em `direction-freeze.json`. `node scripts/analyze-direction.mjs` compara rompimento15min sem filtro de custo com a mesma estratégia exigindo alinhamento EMA16/64 de4h no instante do sinal. Só candles4h completos; sinal, saídas e risco preservados. Todos os quatro períodos já eram conhecidos e são exploratórios.

`web/cost-audit.js` separa a sensibilidade contábil (mesmos horários, quantidades, preços de referência, saídas e funding; alterar apenas taxa/slippage) de uma simulação operacional recalculada. A primeira não recalcula margem, liquidação ou limites e não é outra carteira executável. A segunda muda tamanhos, execução, elegibilidade e limites; no experimento antigo, muda também o filtro de custo. O painel e a exportação mantêm ambas as perguntas separadas, inclusive nos16 pares de cenários anteriores.

Motor, filtros originais, coletor, Worker prospectivo, protocolos e resultados congelados anteriores permanecem idênticos aos hashes registrados. O build valida isso. A variante4h não foi inserida na rodada prospectiva já iniciada.

## Teoria e próximas hipóteses

Os guias enviados pelo usuário foram registrados como catálogo em `BASE-TEORICA.md` e `web/data/theory-plan.json`, visíveis em **Teoria e método**. O catálogo inicial foi publicado com rascunhos de range/rejeição e pullbackVWAP; os testes executados depois estão descritos na seção abaixo; parâmetros propostos não são apresentados como recomendações validadas pelos autores. Scalping agora possui laboratório local com sinal5min e execução1min, descrito em `LOCAL.md`; segundos, ticks e livro continuam fora do modelo. SMC é tratado como padrão observável sem inferência de agentes. A publicação da teoria não altera motores, rodadas, estratégias executadas ou resultados congelados.

## Testes de range e VWAP

`range-vwap-protocol.json` registra as duas regras do plano antes da avaliação. `range-vwap-freeze.json` contém hashes e instante do registro; `web/range-vwap.js` implementa os sinais15min, ATR14Wilder e VWAPHLC3×volume diárioUTC. O motor congelado original é reutilizado sem alteração, injetando os sinais históricos na abertura seguinte. Range usa alvo no meio do canal conhecido e máximo12h; VWAP usa alvo2R e máximo24h; ambos têm cooldown4h, risco1% e os mesmos limites/custos. Não são decisões prospectivas.

Reproduzir: `node scripts/analyze-range-vwap.mjs`; publica16 cenários e auditorias de custos em `web/data/range-vwap-results.json`. Todas as perdas, operações e pausas permanecem exportáveis. `web/data/theory-plan.json` continua sendo o plano inicial arquivado; a interface identifica os dois testes como já realizados. Nenhuma otimização, notícia retroativa, combinação de regimes ou alteração da rodada futura. Os dois testes falharam nos quatro períodos com custos base. Build confere os hashes preservados.


Histórico Donchian ampliado: veja `DONCHIAN-HISTORICO.md`. A aba local compara9 blocos de2020–2026, com59.520 candles1h e36 cenários; preserva os16 resultados anteriores.


## Modelos treinados e estratégias

Nova aba local `?view=ml`: três árvores, três regressões e três controles, treino2020–2022, seleção2023 e avaliação posterior, com108 cenários. Estrutura das árvores e decisões inspecionáveis. Detalhes e reprodução em `ML-ESTRATEGIAS.md`. Não altera o processo prospectivo nem envia ordens.

## Scalping: duração e contexto

Na abaScalping há prazos30/60/120/240min e contexto fechado1h/4h, com observação ou veto somente de novas entradas. Os96 cenários exploratórios e o plano de aprendizado estão em `SCALPING-METODO.md`. Nenhum terminou positivo; não há promoção ao processo prospectivo. Reproduzir com `node scripts/analyze-scalping-context.mjs`.

## Árvore de scalping treinada

Treino local concluído:57 árvores,19.535 exemplos e378 carteiras temporais em21 meses posteriores. O painelScalping permite inspecionar e aplicar árvores no replay de30min. Nenhuma passou todos os critérios de pesquisa; não houve alteração do processo prospectivo. Método, limites e reprodução em `SCALP-ARVORE.md`.

## Comparação de modelos naCPU

PipelinePython local com checkpoints: `npm run ml:train -- --profile overnight --workers 10`, `npm run ml:status`, `npm run ml:stop`, `npm run ml:resume`. O ambiente já foi instalado; em uma nova instalação, usar `npm run ml:setup`.

A primeira rodada concluiu777 ajustes e1.260 carteiras, com teto8h e parada ao concluir. O painelScalping acompanha progresso e comparação; os novos modelos ficam como pesquisa. Nenhuma estratégia demonstrou resultado médio positivo. Instruções em [TREINO-LOCAL-CPU.md](TREINO-LOCAL-CPU.md), evidências acadêmicas em [PESQUISA-ML-MERCADOS.md](PESQUISA-ML-MERCADOS.md) e resultados em [RESULTADO-TREINO-CPU.md](RESULTADO-TREINO-CPU.md).

Rodada ampliada: `npm run ml:train -- --profile extended --workers 10 --max-minutes 480`. São26.640 tarefas envolvendo prazos30/60/120/240min, janelas6/9/12 meses, sete algoritmos e três estratégias. Detalhes, limites e controles em [TREINO-AMPLIADO.md](TREINO-AMPLIADO.md). Preparação, modelos e avaliação têm checkpoints; o usuário pediu para deixar essa rodada rodando em segundo plano.

Refinamento genético após a grade:10 mutações por geração, até30 gerações e8 sem melhora, fitness só na validação e avaliação final após congelamento. Mantém o prazo original e a proteção temporária contra repouso. Método e comandos em [EVOLUCAO-GENETICA.md](EVOLUCAO-GENETICA.md).

## Pesquisa do campeão

Abra http://127.0.0.1:4173/pesquisa-genetica/index.html para os testes genéticos, resumo.html para a síntese e campeao.html para o deep dive. O menu local tem o atalho **Pesquisa do campeão**.

`npm run reports:champion` gera um retrato da última geração concluída. Reutiliza modelos salvos e reexecuta as 18 carteiras mensais de validação (nove meses × dois custos), conferindo PnL, contagem e drawdown contra o campeão registrado. Não inicia outro treino, não muda a campanha, não consulta o teste final e não inicia simulação prospectiva.

O relatório identifica geração, campeão, data e hashes; traz tabelas por regime, direção, horário, custos e saídas, filtros do livro de operações e downloads JSON/CSV. A comparação composta e CDI é separada do fitness mensal.

## Saídas e indicadores

A nova comparação está em http://127.0.0.1:4173/pesquisa-genetica/saidas.html e no menu **Saídas adaptativas**. Inclui quatro saídas e uma ablação de12/30entradas, com dados e regras registrados. Consulte `SAIDAS-ADAPTATIVAS.md`. `npm run research:exits` repete o experimento em uma nova pasta, sem alterar a genética em execução.
