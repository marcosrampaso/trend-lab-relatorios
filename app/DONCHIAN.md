# Donchian fixo versus adaptativo

Comparação local concluída, sem alterar o bot prospectivo. Abra **Donchian · comparação** em [http://127.0.0.1:4173/?view=donchian](http://127.0.0.1:4173/?view=donchian).

O adaptativo superou o fixo em 2 de 4 blocos com custos base. Com custos dobrados, o adaptativo perdeu nos quatro. A melhora não foi consistente e não sustenta operar dinheiro real. Cada bloco reinicia R$300; os retornos não devem ser somados.

| Período conhecido | Fixo · base | Adaptativo · base | Fixo · custos2x | Adaptativo · custos2x |
|---|---|---|---|---|
| Jan–jun 2025 · desenvolvimento | R$-30,07 / 71 operações / DD 13,62% | R$-30,22 / 78 operações / DD 14,03% | R$-30,53 / 49 operações / DD 12,39% | R$-30,32 / 49 operações / DD 12,71% |
| Jul–dez 2025 · validação conhecida | R$-11,59 / 140 operações / DD 14,09% | R$-2,09 / 132 operações / DD 9,70% | R$-30,14 / 90 operações / DD 14,24% | R$-27,47 / 124 operações / DD 10,11% |
| Jan–set 2026 · comparação retrospectiva | R$8,90 / 200 operações / DD 16,08% | R$30,38 / 193 operações / DD 14,88% | R$-30,24 / 109 operações / DD 18,27% | R$-30,60 / 161 operações / DD 20,40% |
| 1–15 out 2026 · janela adicional | R$9,22 / 11 operações / DD 2,42% | R$0,50 / 11 operações / DD 3,12% | R$4,29 / 11 operações / DD 2,46% | R$-2,64 / 11 operações / DD 3,42% |

## O que foi alterado

Somente a duração do canal. Controle: 20 horas. Variante: `N = clamp(round(20 × referência / recente), 10, 40)`, em que recente é ATR14 dividido pelo fechamento da hora anterior e referência é a média dos 168 valores anteriores. Maior volatilidade encurta o canal; menor alonga. Tanto o canal quanto a seleção da janela excluem o candle de sinal.

A fórmula é uma hipótese nossa, registrada antes de calcular os novos resultados. O [artigo de Joe Tay](https://medium.com/@joetay_50959/from-failed-experiments-to-43-8-apr-how-i-finally-built-a-profitable-trading-bot-with-ai-64771995d38c) não divulga a função adaptativa nem a gestão Agno. Não estamos replicando seu sistema nem atribuindo os resultados a IA.

## Regras mantidas

ETHUSDT, candles e execução de 1h. Fechamento além da máxima/mínima dos N candles anteriores, com volume maior que 1,2 vezes a média dos 20 volumes anteriores. Stop 1,5ATR, alvo 2R (3ATR), máximo 24h, intervalo 4h e encerramento por sinal contrário. O alvo preserva nosso controle e difere dos 2ATR do pseudocódigo do artigo.

R$300 por carteira, câmbio hipotético R$5/USDT, risco de 1%, alavancagem 10x, limites diário de 3% e global de 10% sobre capital inicial. Taxas de 0,05% e slippage de 0,02% por lado no cenário base; ambos dobrados no estresse. Funding histórico incluído. Antes de impostos. Filtros de lote obtidos posteriormente são uma hipótese.

Os limites são avaliados em fechamentos horários e podem ser ultrapassados por gaps e custos. Drawdown desde o pico é diferente de perda sobre o capital inicial e pode superar 10% sem pausa global. Conflito na mesma hora usa liquidação estimada antes de stop e stop antes de alvo. Não resolve ticks, spread observado, fila ou latência.

## Reprodução e acompanhamento

`node scripts/analyze-donchian.mjs` verifica a reprodução do relatório congelado sem sobrescrevê-lo. `npm test` verifica causalidade, contabilidade, controles e preservação. `npm run build` verifica os hashes de todos os estudos.

O controle reproduziu integralmente as operações anteriores nos quatro blocos e dois custos. Os 16 cenários e a sensibilidade de custos com operações fixas estão em `web/data/donchian-results.json`; protocolo em `donchian-protocol.json`; hashes em `donchian-freeze.json`.

No painel, o replay tem relógio próprio, canal, janela atual, sinais, entradas, saídas, posição e duas curvas de patrimônio até o mesmo instante. Clique em **Próxima atividade**, depois **+1 hora** para revelar a execução. **Ver período completo** reconcilia o cenário com a comparação. É possível trocar período, canal e custos e exportar o relatório ou o replay. Reprodução pausa ao trocar de aba e recarrega pausada, sem perder o instante salvo.

Todos os períodos já haviam sido vistos. Registrar as regras antes desta rodada não os transforma em validação inédita. Não houve otimização posterior. A comparação com gestão por IA e a coleta futura desta hipótese permanecem etapas separadas, não implementadas nesta rodada.
