# PEPE · gestão de saídas: escada líquida e stop em lucro

Piloto local iniciado em 21/10/2026, somente simulação. Página: http://127.0.0.1:4173/pesquisa-genetica/gestao-saidas.html

## Por que mudamos

V3/G91 e os filhos V4 não sustentaram o resultado do trimestre usado na seleção. A V4 terminou sem saídas voluntárias, parciais ou proteção escolhidas pelo agente nas avaliações finais. Mais gerações daquele desenho não resolveram o problema. Agora isolamos a gestão da posição para auditar a mecânica e a recompensa antes de alterar entradas.

## Regra confirmada pelo usuário

Alvos de +10%/+20%/+40% líquidos equivalentes sobre a margem ORIGINAL, vendendo 25%/50%/restante da quantidade ORIGINAL. O equivalente é o lucro líquido hipotético da posição inteira original naquele preço, com taxas, slippage adverso e funding já conhecido. A referência não diminui depois das parciais. Os ganhos ponderados seriam cerca de 22,5% da margem se todos os alvos fossem preenchidos exatamente. Não são 40% de ganho final da operação nem +10%/+20%/+40% na moeda.

Após a primeira parcial, proteção automática dos custos conhecidos da quantidade restante. O PPO pode escolher breakeven, lock líquido de 0,25R e trailing1/2ATR, além de esperar/encerrar. Não recebe bônus por apertar esses comandos. Stops só apertam; gaps/funding futuro podem causar perdas. Alvos são sinalizados pelo último fechamento conhecido e preenchidos na próxima abertura negociável somente se ainda atingirem o retorno líquido. Uma etapa por decisão; lote/notional inválido não é preenchido.

## Evidência e calendários

G91/a245 congelado: 2ee954256829b8ffea36a4fea682ac3c15f046e8ca76e34c3cc4d9f9fd42dc0b. Entradas geradas sem learn; tensores conferidos antes/depois. 15 carteiras mensais geraram320 posições. Guardamos estado anterior, ATR, lado, alavancagem e preenchimento exatos. 261 chegam à primeira decisão após cinco minutos:153 treino e108 desenvolvimento. As59 restantes entram nas avaliações agregadas sem decisões retroativas.

Treino novo: junho/2023–março/2024. Desenvolvimento: abril,maio,junho,julho,setembro/2024. Agosto é excluído por cobertura de mark. A lista `months` e o dataset-index governam o split; campos legados `train`/`validation` do protocolo de origem são herdados para rastreabilidade e não definem os novos calendários. Todos já foram vistos pelo laboratório/G91: não há teste independente nem prova de lucro futuro. 2025 e setembro/2026 não entram neste piloto.

Estudo pareado: cada posição usa preço/quantidade/estado de entrada idênticos, mas as saídas podem durar até o fim do mês. Posições contrafactuais podem se sobrepor; soma de resultados NÃO é rentabilidade de carteira.

Auditoria financeira separada: uma carteira R$1000 contínua por mês, com os mesmos SINAIS de entrada e tamanho calculado sobre saldo próprio com risco1%. Sobreposição, limites e mínimos geram skips/rejeições explícitos. Não inventamos entradas adicionais onde o G91 original não operou. A agenda congelada depende do caminho original: é um controle experimental de saída, não uma estratégia completa pronta para executar. Cada mês é independente e não se compõe com o seguinte.

## Controles concluídos antes do treino

Esperar reproduziu o líquido das320 posições e das15 carteiras mensais, com tolerância1e-6BRL. O registro principal foi congelado após essa auditoria mecânica e antes do treino. Nenhum parâmetro foi ajustado para maximizar o resultado dos controles.

| Regra | Líquido mensal médio (5meses dev) | Meses acima CDI | Queda máxima média | Diferença pareada/posição |
|---|---:|---:|---:|---:|
| wait | R$14.89 | 1/5 | 18.23% | R$0.00 |
| lock | R$-59.15 | 0/5 | 9.68% | R$-3.47 |
| trail | R$-57.08 | 1/5 | 8.44% | R$-3.70 |
| ladder | R$-63.12 | 0/5 | 8.85% | R$-3.86 |
| ladder_trail | R$-60.14 | 1/5 | 8.59% | R$-3.62 |

A média positiva do controle esperar concentra-se em maio/2024; quatro dos cinco meses perdem. A escada e os stops simples reduziram drawdown em alguns recortes, mas cortaram ganhos no mês forte e não melhoraram o líquido geral. Não os classificamos como aprovados.

## Treino registrado

Dois braços de recompensa × sementes101/202/303, cada um65.536passos, rede64×64 e seis ações. Controle usa patrimônio marcado; tratamento usa valor de liquidação no último preço negociado conhecido já descontando o custo de saída. Portanto também muda mark versus preço negociado: o contraste não isola somente custos. Recompensa em risco de preço originalR, com penalidade0,25 por aumento de drawdown emR.

PPO recebe episódios somente das entradas de treino. Avaliação determinística sem learn ou mudança de tensores em0,32.768,65.536passos, incluindo todas as posições de desenvolvimento e cinco carteiras mensais. Comparação final agrega as três sementes por braço; não promove o checkpoint mais lucrativo. Nenhuma genética nem escolha de filho.

Checkpoints imutáveis a cada8.192passos. RNG e ambiente reiniciam em cada bloco; episódios de treino abertos nesse corte são abandonados, sem fingir uma carteira contínua de treino. Fim dos dados mensais é truncagem, não stop por tempo. Não há prazo arbitrário de720min.

Risco1%, limite diário3%, global10%, entradas10×/15× herdadas. Até3workers ×2threads, modo leve1worker; redução por pressão de memória; reserva de disco10GiB. Caffeinate acompanha o coordenador. Pausar espera checkpoint e retomar carrega seus pesos. O status mostra passos confirmados por checkpoint, não cada passo em memória.

Proteção automática da primeira parcial e etapas automáticas são contadas separadas de comandos de proteção do PPO realmente aplicados. Ação escolhida não prova aprendizado; as avaliações de0passos mostram a política inicial não treinada.

## CDI e custos

CDI diário congelado/reconciliado, nos mesmos diasUTC completos, bruto antes de impostos, comparado apenas às carteiras mensais. Taxa de estresse0,1% e slippage0,1% por execução sobre notional; funding histórico. Slippage já altera preenchimentos e o lucro bruto: seu custo reportado não é descontado de novo.

## Estado e reprodução

Treino iniciado; resultados finais pendentes. Página lê status e avaliações arquivadas, não inventa resultados intermediários. Novas avaliações atualizam as curvas quando os pesos passam pelos marcos registrados.

`work/pepe-exits-v1/source-registration.json`: geração imutável das entradas. `dataset-registration.json`:320 posições congeladas. `registration.json`: protocolo, fontes, dados, dependências e pai antes de aprender. Pesos e dados brutos ficam locais, fora do GitHub.

Comandos: `node scripts/local-exit-lab.mjs status`, `pause`, `resume`, `eco`, `boost`. `scripts/run-exit-study.py` coordena seis políticas; `exit-lab-worker.py` treina/avalia; `exit-lab-engine.mjs` é fork separado. Os motores e relatóriosV3/V4 continuam congelados.

## Referências

- SB3: https://stable-baselines3.readthedocs.io/en/master/guide/rl_tips.html — problema simplificado, desenho de recompensa, múltiplas sementes e avaliação separada.
- Binance: https://www.binance.com/en/support/faq/detail/98488a516eb84e3eb34605683dffd554 — taxas de negociação e funding; as tarifas modeladas não substituem a consulta à conta.
