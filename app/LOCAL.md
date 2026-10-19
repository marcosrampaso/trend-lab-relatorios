# Trend Lab no seu computador

Abra **http://127.0.0.1:4173/**. O monitor local mostra o preço atual deETHUSDT, atividade, último sinal, posição e resultados simulados. A coleta funciona com a aba fechada enquanto o processo estiver ativo e o computador estiver ligado, acordado e conectado.

## Iniciar e parar

Dê dois cliques em `Iniciar Trend Lab.command`. O servidor roda em segundo plano e abre o navegador. Para encerrar, use `Parar Trend Lab.command`. Reabrir o atalho de início reaproveita o processo existente.

Pelo Terminal, dentro desta pasta:

```sh
cd "/Users/marcosbezner/Documents/Codex/2026-10-16/fi/outputs/trend-lab"
npm run local:start
npm run local:status
npm run local:stop
```

Para acompanhar o console em primeiro plano: `npm run dev` (Ctrl+C encerra). Node26 já está disponível neste computador; o servidor usaNode comSQLite integrado, sem instalar pacotes. O atalho usaNode doPATH ou a instalação local detectada como fallback. Se atualizar/removerNode e o atalho falhar, ajuste esse caminho.

## Atualizações

- Preço de referência: consulta pública a cada10 segundos; em erro, espera60 segundos antes da nova tentativa.
- Candles horários para a abaMercado agora: cache local atualizado a cada60 segundos, filtrando somente candles encerrados nas decisões.
- Simulação prospectiva: captura a cada15 minutos, registrando apenas o último sinal1h fechado antes da abertura seguinte. Resultados usam candles15min encerrados; o preço corrente não é o lucro realizado.
- Notícias: análise deste chat, conforme rotina5h e limites do plano. Não háAPI paga deIA. O loop de preços e a simulação não usam tokens.

O monitor possui **Pausar coleta**, **Retomar coleta** e **Atualizar agora**. A pausa persiste no banco entre reinícios; atualização manual pode consultar uma vez mesmo pausado. Pausar não apaga posições ou decisões. As horas sem captura ficam explícitas e não recebem sinais retroativos.

## Dados e independência

O processo mantém um banco novo e independente em `.local/runtime.sqlite`; não importa nem sincroniza o banco hospedado ou os registros antigos deQA em `.cache/local-news.sqlite`. A estratégia local usa as mesmas regras congeladas da rodada prospectiva de rompimento+volume+filtro de custo, sem criar ordens reais. Range eVWAP continuam como backtests; não foram inseridos na rodada prospectiva.

A pequena curva de preços acompanha a sessão atual do processo e recomeça após reinício; decisões e eventos permanecem no banco. Horários do monitor usam SãoPaulo.

Logs do processo: `.local/server.log`. Decisões, notícias, snapshots e eventos ficam noSQLite. Para backup consistente, encerre o processo e copie a pasta `.local/`. Fechar o navegador não encerra o servidor. Reiniciar/desligar ou suspender oMac interrompe o acompanhamento; use o atalho depois. Não instalamos inicialização automática no login.

O servidor escuta apenas em127.0.0.1. O endereço não funciona no celular ou em outro computador. Não há acesso à sua contaBinance. O site hospedado anterior permanece disponível como publicação separada e não recebe estas alterações locais.

## Replay histórico

Abra http://127.0.0.1:4173/?view=replay. O monitor do processo atual aparece somente em Mercado agora; continua funcionando enquanto você usa o replay.

- Escolha “Intradiária · EMA 9/21 de 1h · até 24h” para acompanhar a hipótese intradiária existente. A troca reinicia o mês, preservando capital e risco.
- Use “Próxima atividade do bot” para avançar o relógio até um sinal, execução, rejeição ou saída. Um segundo clique pode ser necessário para revelar a execução após o sinal.
- “Reproduzir” avança um candle por vez, com velocidade de 1, 6 ou 24 horas históricas por segundo; entradas e saídas aparecem no gráfico e no diário. O painel “Bot no replay” mostra posição, stop, alvo e motivo da espera.
- A estratégia original de 4h não abre posições em abril/maio de 2025 com a configuração padrão: em abril a tentativa é rejeitada pelo mínimo da corretora; em maio o sinal só chega na fronteira final dos dados.

Os dados são horários: isto é uma simulação por candle, sem reprodução de cada negócio intrabar. Atividade maior não demonstra rentabilidade. A navegação consulta a linha do tempo apenas para escolher o próximo relógio; o estado é recalculado pelo motor usando somente dados disponíveis até esse instante.

O replay salva a estratégia, o mês, o relógio e a velocidade neste navegador. Ao recarregar, volta ao mesmo ponto, pausado. Trocar de aba pausa a reprodução. “Ver período completo” avança ao último candle e mostra todo o diário, sem alterar as regras.

## Volume, RSI e contexto das decisões

O replay exibe volume em ETH, volume relativo à média das20 horas anteriores, RSI14 de Wilder, ADX14, ATR14 e VWAP diário aproximado (HLC3×volume, reinício UTC). Só usa candles completos até o relógio. As barras discretas no gráfico mostram volume; volume sozinho não define compra ou venda.

Na estratégia “Intradiária · EMA9/21”, o seletor “Volume e RSI” permite observar sem veto, exigir RVOL≥1,2×, exigir RSI LONG50–70/SHORT30–50, ou exigir os dois. Trocar reinicia o período. Esses limiares são hipóteses experimentais, sem ajuste para melhorar os resultados. ADX, VWAP e o ATR do painel são informativos: o motor e seu ATR para stops continuam preservados. Nenhum indicador foi adicionado ao processo prospectivo em tempo real.

A explicação do último sinal usa os valores disponíveis naquele sinal; os cartões mostram o relógio atual. O diário inclui entradas vetadas. O estudo após o diário publica48 cenários: quatro variantes, seis janelas já conhecidas e dois cenários de custos. Abril/maio estão contidos no primeiro semestre. A comparação de custos inclui operações fixas e uma carteira recalculada. Notícias não são inseridas no passado.

Reproduzir estudo: `node scripts/analyze-context.mjs`. Protocolo registrado em `context-protocol.json`; verificações e hashes em `context-freeze.json`. Resultados completos exportáveis no painel.

## Scalping de5min, execução por minuto

Acesse http://127.0.0.1:4173/?view=scalping ou “Scalping ·5min”. O histórico é carregado somente ao abrir essa aba. São89.280 candles1min, de31/03 a31/05/2025, seis arquivos oficiais com checksum e OHLC reconciliado com os dados horários. A partir deles,17.856 candles5min mantêm quote volume e volume comprador taker. O VWAP desta aba usa soma quote/base por diaUTC, diferente da aproximação do replay horário. Delta=2×taker buy base−volume total, sem reconstrução de livro/ticks.

Três hipóteses congeladas: cruzamento EMA9/21 como controle, pullback VWAP+EMA+volume e retorno Bollinger+RSI. MACD12/26/9 é contexto, sem veto adicional. Stop1,5ATR, alvo2R nas duas primeiras ou média conhecida nas bandas, máximo30min por operação e intervalo10min após saída. Entradas na abertura seguinte ao sinal5min, execução e risco por minuto, com mark price e funding. Conflito de stop/alvo no mesmo minuto usa stop primeiro; liquidação estimada tem prioridade. Mínimos da corretora e custos são hipóteses existentes, não tarifas pessoais ou filtros reconstruídos para2025.

Use “Próxima atividade” para revelar sinal, entrada e saída. “Reproduzir eventos” avança um evento por segundo e pula intervalos vazios; pausa ao sair da aba ou atingir o limite global de risco. “+1 minuto” permite acompanhar o interior de um candle5min. O gráfico exibe os360 últimos minutos, com indicadores atualizados apenas a cada5min completos. A comparação histórica fica recolhida e avisa que revela resultados posteriores ao relógio do replay.

Todos os seis cenários base atingiram perda de aproximadamente10%; nenhuma hipótese demonstrou melhora nesta rodada. Mantivemos também os seis cenários de custos2x, com auditoria das mesmas operações. Não foram promovidos à rodada prospectiva atual. Para verificar a reprodução sem sobrescrever resultados congelados: `node scripts/analyze-scalping.mjs`. Regras e hashes em `scalping-protocol.json` e `scalping-freeze.json`.


## Comparação Donchian

Nova aba local `?view=donchian`: controle20h versus janela10–40h conforme volatilidade anterior. Inclui16 cenários, custos base/dobrados, replay causal e duas carteiras no mesmo relógio. Detalhes em `DONCHIAN.md`. Reproduzir: `node scripts/analyze-donchian.mjs`. Protocolo e resultados têm hashes; o controle reproduz os estudos anteriores. Não altera a rodada prospectiva nem envia ordens.


## Histórico Donchian ampliado

A aba Donchian agora usa59.520 candles1h (jan2020–15out2026),9 blocos e36 cenários, com exportação do histórico. Janeiro2020 é aquecimento. Os16 resultados anteriores continuam idênticos. Reproduzir: `node scripts/analyze-donchian-history.mjs`; detalhes em `DONCHIAN-HISTORICO.md`. Os novos dados não são treino deML nem dados1min para scalping.


## Modelos treinados e estratégias

Nova aba local `?view=ml`: três árvores, três regressões e três controles, treino2020–2022, seleção2023 e avaliação posterior, com108 cenários. Estrutura das árvores e decisões inspecionáveis. Detalhes e reprodução em `ML-ESTRATEGIAS.md`. Não altera o processo prospectivo nem envia ordens.

## Scalping: duração e contexto

Na abaScalping há prazos30/60/120/240min e contexto fechado1h/4h, com observação ou veto somente de novas entradas. Os96 cenários exploratórios e o plano de aprendizado estão em `SCALPING-METODO.md`. Nenhum terminou positivo; não há promoção ao processo prospectivo. Reproduzir com `node scripts/analyze-scalping-context.mjs`.

## Árvore de scalping treinada

Treino local concluído:57 árvores,19.535 exemplos e378 carteiras temporais em21 meses posteriores. O painelScalping permite inspecionar e aplicar árvores no replay de30min. Nenhuma passou todos os critérios de pesquisa; não houve alteração do processo prospectivo. Método, limites e reprodução em `SCALP-ARVORE.md`.
