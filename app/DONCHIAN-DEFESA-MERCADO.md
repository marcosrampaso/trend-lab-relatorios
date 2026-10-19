# Curva contra CDI e teste de defesas de mercado · 19/10/2026

O pedido foi explicar por que o patrimônio começou acima do CDI e depois caiu, e testar a hipótese de usar contexto de mercado como defesa. O diagnóstico foi fixado no genoma V4 `70c90549a3cd9585`, capturado antes das avaliações da nova rodada. A genética V4 continua em separado; novos campeões não substituem retroativamente o controle deste relatório. Não foram alterados risco, alvos ou regras dos bots ativos. Nenhuma ordem real.

## O que a curva mostra

No cenário de custos elevados, R$1.000 iniciais atingiram pico de R$1.182,81 em novembro de 2021 e terminaram em R$788,59 no corte de 19/10/2026 às 13:32 de São Paulo. O último ponto diário acima da curva CDI publicada foi em junho de 2022. A curva compara patrimônio ao longo do calendário, não lucro por geração.

| Ano UTC | Variação do patrimônio do bot | Acréscimo nominal da carteira CDI |
| --- | ---: | ---: |
| 2020 | +R$89,52 | +R$27,58 |
| 2021 | +R$77,72 | +R$45,46 |
| 2022 | −R$35,13 | +R$132,96 |
| 2023 | −R$106,67 | +R$157,25 |
| 2024 | −R$203,03 | +R$148,27 |
| 2025 | −R$52,88 | +R$216,51 |
| 2026 até o corte | +R$19,06 | +R$191,28 |

A vantagem inicial não foi mantida. Houve perdas efetivas, sobretudo em 2023–2024, enquanto a referência CDI continuou acumulando juros. CDI completo de outubro ainda é provisório, sem reconciliação mensal final: a referência publicada de R$1.919,30 não dá direito a ranking ou percentual do CDI no recorte integral. As janelas de desenvolvimento com meses completos têm CDI reconciliado.

### Custos e qualidade das operações

Nas mesmas 516 posições do controle com custos elevados:

- Resultado nos preços de referência, antes de atribuir custos: **+R$212,32**.
- Slippage adverso: **−R$116,84**.
- Taxas de entrada/saída: **−R$292,10**.
- Funding líquido: **−R$14,80**.
- Resultado líquido reconciliado: **−R$211,41**.

Este bruto mantém as mesmas posições e quantidades; não é um novo backtest sem custos. Quantidade e execução de sinais poderiam mudar com outra política. O bruto executado já contém slippage, por isso não é descontado duas vezes.

O problema também está na estratégia: posições encerradas em 2023 e 2024 tiveram bruto de referência negativo (−R$68,69 e −R$130,58) antes dos custos. Compras somaram +R$38,27 líquidos; vendas a descoberto, −R$249,68. Essa associação não prova que bloquear shorts melhorará outros períodos. A taxa de acerto total foi48,06%; ganho médio R$8,65 e perda média R$8,79. Uma vantagem inicial sobre CDI não demonstra expectativa positiva persistente.

A variação anual do patrimônio usa valores marcados a mercado nas fronteiras UTC. Atribuição de custos, bruto e acerto agrupa a posição inteira pelo encerramento; posições que cruzam o ano podem produzir diferenças de competência entre as duas tabelas. O diagnóstico é posterior aos resultados, não prova causalidade ou manipulação.

## Experimento separado, registrado antes dos resultados

Registro: `work/donchian-market-defense-v1/registration.json`. Fonte do campeão, código, cadastro dos dados e parâmetros foram identificados por SHA256. O controle foi reproduzido exatamente, incluindo número de posições e saldo, em custos base e elevados. Dados e taxas são os mesmos congelados da V4. Mudou somente a autorização de novas entradas; todos os sinais contrários continuam podendo encerrar posições.

Seis perfis fixos, sem ajustar limiares após ver resultados:

1. Controle congelado.
2. Regime: vetar entrada contra o lado de EMA20/50 de4h fechada.
3. Choque: volume horário ≥2× média das20horas anteriores e true range ≥2,5× ATR anterior.
4. Fluxo: volume ≥1,5× referência e delta taker contra a entrada ≥15% do volume. Delta =2×volume comprador agressor/volume−1.
5. Funding: vetar a direção que pagaria taxa publicada ≥0,05% no último evento conhecido; atraso modelado de2min e valor com mais de12h tratado como desconhecido.
6. Combinado: qualquer alerta dos quatro filtros.

As informações são de candles fechados e funding conhecido. A referência de volume exclui a própria hora avaliada. Contexto ausente é marcado como desconhecido e não vira veto. O horário conhecido de cada sinal é respeitado. Nenhum livro histórico, open interest ou identificação de baleia de2020 foi inventado. Não houve treino de nova IA nesta rodada: é um teste de hipóteses com regras fixas, antes de considerar um modelo que aprenda suas combinações.

Elegibilidade exploratória foi definida apenas sobre2020–2023: lucro médio mensal maior que CDI, ao menos30posições e máximo drawdown não superior ao controle. 2024–2026 não escolhem perfis ou limiares. O histórico já foi visto muitas vezes; essa separação não é prova independente. Nenhuma promoção automática à genética ou aos bots ativos.

## Resultados observados

Capital único deR$1.000 na carteira contínua, câmbio modeladoR$5/USDT, antes de impostos:

| Perfil | PnL base | PnL com custos elevados | DD com custos elevados | Posições com custos elevados |
| --- | ---: | ---: | ---: | ---: |
| Controle | −R$40,66 | −R$211,41 |36,00%|516|
| Regime4h | −R$169,36 | −R$252,91 |31,23%|316|
| Choque | −R$11,12 | −R$177,83 |32,30%|486|
| Fluxo contrário | −R$40,66 | −R$211,41 |36,00%|516|
| Funding extremo | +R$15,89 | −R$172,35 |35,30%|485|
| Combinado | −R$145,54 | −R$221,17 |28,99%|268|

**Nenhum perfil passou o critério de desenvolvimento contra CDI.** Choque e funding reduziram perdas no recorte completo observado; nenhum tornou o resultado robusto a custos elevados. Regime e combinação reduziram drawdown, mas pioraram lucro. O filtro de fluxo vetou zero oportunidades: equivaleu ao controle e não foi uma defesa efetivamente acionada nessa amostra.

Funding não foi o maior custo monetário, mas seu filtro também muda quais posições são abertas e a trajetória futura da carteira; a diferença de resultados não pode ser atribuída somente ao funding economizado. O resultado não comprova manipulação, nem demonstra que estas defesas predizem intenções de grandes participantes.

## Dados prospectivos deBTC/ETH

Um coletor separado consulta a cada60s endpoints públicos Binance USD-M:

- `depth`,20níveis do livro;
- `openInterest`, quantidade em aberto por símbolo;
- `premiumIndex`, incluindo funding publicado e horário do próximo evento.

Cada observação guarda horário solicitado, horário conhecido após as respostas, timestamps da corretora, latência, spread, profundidade e flags de defasagem/cobertura. Somente vinte níveis podem não cobrir10bps inteiros; nesses casos o desequilíbrio da faixa é marcado como truncado. A coleta não captura todas as ordens e cancelamentos, não é um detector de spoofing e não dá acesso à intenção ou identidade de participantes. Ela fica só em observação, sem alterar os bots.

```sh
node scripts/local-market-defense-observer.mjs start
node scripts/local-market-defense-observer.mjs status
node scripts/local-market-defense-observer.mjs stop
node scripts/local-market-defense-observer.mjs resume
```

Raw privado: `work/market-defense-observer-v1/observations.ndjson`. O coletor respeita a pausa do servidor local, registra falhas e tenta novamente no próximo ciclo. Sem APIkey, conta de negociação, API paga de IA ou tokens do chat por coleta. Snapshot público do estado: `web/data/donchian-defense-observer.json`.

## Entregáveis e verificação

Painel: <http://127.0.0.1:4173/pesquisa-genetica/donchian-defesa.html>.

Dados do estudo: `web/data/donchian-market-defense.json`. Executor registrado: `scripts/run-donchian-defense-study.mjs`. Para repetir somente esse mesmo registro, manter fontes e entradas congeladas e executar o script; janelas de desenvolvimento usam cache próprio. Para alterar parâmetros, criar outro registro.

291 testes passaram, incluindo quatro novos: reconciliação dos custos sem descontar slippage duas vezes, veto sem apagar saída por sinal contrário, dados ausentes sem alertas inventados, rejeição de informação futura, referência de volume anterior e atraso de disponibilidade do funding. Atribuição por posição, valores do controle e hashes das entradas foram conferidos. A validação visual no navegador ficou indisponível nesta sessão por bloqueio de acesso da ferramenta; arquivos, sintaxe e dados foram verificados por ferramentas locais.

Referências para limites dos dados e interpretação:

- [Binance · Open Interest Statistics](https://developers.binance.com/docs/derivatives/usds-margined-futures/market-data/rest-api/Open-Interest-Statistics): endpoint de estatísticas disponibiliza somente o último mês; isso não é uma reconstrução automática do histórico completo.
- [Binance · dados públicos](https://github.com/binance/binance-public-data): esquema de candles com volume e volume taker.
- [Fabre e Challet · Learning the Spoofability of Limit Order Books](https://arxiv.org/abs/2504.15908): pesquisa com dadosLevel3 sobre possíveis ordens enganosas. Não equivale aos nossos candles nem comprova uma estratégia lucrativa.
