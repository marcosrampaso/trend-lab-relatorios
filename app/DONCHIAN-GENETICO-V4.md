# Donchian V4 · sem vencimento e com stop após a parcial

Em 19/10/2026, Marcos pediu retirar o prazo de 720 minutos das posições e proteger o restante após realizar metade. A V3 foi parada graciosamente na geração 73, com 1.464 candidatos avaliados, preservando código, checkpoint, melhores genomas e resultados. A nova V4 usa arquivos e caches próprios. Não altera os bots prospectivos nem envia ordens reais.

## Sem prazo máximo por posição

Todas as candidatas V4 têm `holdMinutes=null`, inclusive as importadas de versões anteriores. Não há encerramento após 720 minutos, 24 horas ou outra duração. Posição pode durar vários dias, até atingir alvo, stop, sinal contrário ou limite de perda da carteira. Esta pesquisa portanto admite operações que ultrapassam day trade. O prazo de validade de um sinal de reteste e o intervalo entre novas entradas continuam sendo regras de entrada, não prazo de uma posição aberta.

A carteira contínua mantém a posição entre dias e meses, incluindo funding e saldo. As janelas independentes de desenvolvimento continuam iniciando R$1.000 por janela e precisam avaliar posições ainda abertas no fim do recorte. Essa liquidação modelada, com custos, aparece como **“Fim do recorte (avaliação)”**, nunca como prazo operacional. O painel conta essas saídas separadamente. A carteira contínua só enfrenta essa fronteira no corte final do histórico. Não se observa o futuro para aguardar a resolução depois do fim dos dados.

## Proteção após realizar a primeira metade

Permanecem alvos em múltiplos da distância inicial do stop, calculada pelo ATR conhecido antes da entrada. A genética compara saída inteira e saída 50/50. Na saída inteira não há ativação de proteção por parcial; em toda candidata com parcial válida, o restante recebe uma das três regras:

1. **Cobrir custos conhecidos:** stop no preço de equilíbrio líquido da quantidade restante, incluindo taxa de entrada ainda atribuída, funding já ocorrido, taxa de saída e slippage adverso modelado. Busca preservar o lucro líquido já realizado na primeira metade.
2. **Proteger ganho:** acrescentar 0,25R ou 0,5R por unidade restante além do ponto de equilíbrio líquido. R é sempre a distância inicial do stop, não a distância do stop depois de movido.
3. **Trailing por volatilidade:** seguir o melhor fechamento de 1 minuto observado após a parcial, a uma distância de 1, 1,5, 2 ou 3 ATR. O ATR só é atualizado a partir de candles de 1h fechados e liberados com atraso de 2 minutos. O preço de equilíbrio líquido funciona como proteção mínima.

Para uma posição comprada, o stop só sobe. Para uma vendida, só desce. Aumento de volatilidade ou recebimento de funding não afrouxa o stop. Funding pago posteriormente pode elevar a proteção necessária; só os valores já conhecidos entram no cálculo. Se o lote mínimo impedir a parcial, ela é rejeitada e não se finge que a proteção foi ativada.

### Preço de equilíbrio do restante

Seja `q` a quantidade restante, `e` o preço executado de entrada, `f` a taxa de saída, `s` o slippage, `F` o funding conhecido atribuído ao restante e `E` a taxa de entrada ainda atribuída:

- Compra: preço executado necessário = `(q × e + E − F) / (q × (1 − f))`; referência do stop = esse preço dividido por `(1 − s)`.
- Venda: preço executado necessário = `(q × e − E + F) / (q × (1 + f))`; referência do stop = esse preço dividido por `(1 + s)`.

O cálculo cobre os custos conhecidos no modelo, não garante ausência de prejuízo. Gap pode executar além do stop; funding futuro, custos reais diferentes, profundidade e ordens não reconstruídas podem mudar o resultado.

## Sem usar o futuro do candle

A parcial é reconhecida com o candle de 1 minuto concluído. O novo stop é calculado com os dados desse fechamento e passa a ser verificado **somente no candle seguinte**. Não se usa o novo stop contra a mínima/máxima de um candle que já passou. O trailing usa fechamentos, não uma sequência de ticks inventada. Se stop e alvo coexistem num minuto, a prioridade conservadora do stop/liquidação permanece. Gap além do stop realiza o preço adverso de abertura, sem inventar execução no ponto de equilíbrio.

Os eventos `stop-update` registram horário conhecido/efetivo, stop anterior e novo, modo, ATR disponível e fechamento usado. Cada trade contém `stopHistory`; o painel mostra stop inicial e protegido, realizações e resultado completo. Uma posição com duas realizações continua contando como uma operação.

## Seleção e comparação

O campeão V3 é convertido para prazo ilimitado e, quando usa parcial, proteção de equilíbrio líquido como referência V4. Essa referência é reavaliada integralmente: seus números antigos não são usados como fitness novo. Ela não isola por si só o efeito de remover o prazo do efeito de proteger o stop. Os dados V3 permanecem acessíveis para auditoria.

A população inicial compara modos de proteção e alvos mantendo os genes de entrada dessa referência. Depois, entrada, alvos e proteção podem evoluir juntos. Campos inativos são normalizados, e o espaço efetivo tem 385.152 combinações sem duplicatas, verificado por enumeração. Quatro elites, arquivo dos melhores, diversidade ampliada após estagnação e exigência de genomas inéditos permanecem. Sem teto de gerações ou horas; pausa do servidor, pedido de parada, falha e exaustão real da grade são respeitados.

Desenvolvimento 2020–2023, em 45 meses completos/16 janelas, é o único período que seleciona pais. 2024–2025 e 2026 são diagnósticos. O histórico já visto não é validação independente. Mesmos dados, filtros e taxas CDI da V3 foram copiados e tiveram hashes registrados antes da avaliação. Corte: 19/10/2026 às 13:32 de São Paulo. CDI das janelas completo; outubro no recorte contínuo permanece provisório, sem extrapolar taxa. Saldo contínuo recebe R$1.000 uma vez, câmbio modelado de R$5/USDT.

Não se aumentaram risco por entrada (1%) ou alavancagem (10x). Stops, limite diário de perda de 3%, taxas, slippage, funding, lote mínimo, insolvência e ausência de reposição permanecem. Trava acumulada de 10% continua desativada somente nesta pesquisa. Remover o prazo e apertar stops são hipóteses a testar; podem aumentar ou reduzir o resultado.

## Executar e acompanhar

Painel: <http://127.0.0.1:4173/pesquisa-genetica/donchian-genetico.html?run=v4#exits-section>

```sh
node scripts/local-donchian-genetic-v4.mjs start
node scripts/local-donchian-genetic-v4.mjs status
node scripts/local-donchian-genetic-v4.mjs stop
node scripts/local-donchian-genetic-v4.mjs resume
```

Estado privado: `work/donchian-evolution-v4/`. Dados do painel: `web/data/donchian-evolution-{status,baseline,best}-v4.json`. `?run=v3`, `?run=v2` e `?run=v1` consultam rodadas preservadas. Código, método e retrato datado vão para o repositório privado autorizado; banco, candles brutos e caches ficam locais.

## Verificações

287 testes passaram. Os 12 novos verificam equivalência monetária com política V3 desativando as novidades; duração além de 720 minutos/24h; proteção líquida de compra/venda com custos e funding; ausência de disparo retroativo no candle da parcial; trailing com ATR conhecido e sem afrouxar; rejeição de contexto futuro; execução adversa em gap; proteção de lucro e continuidade entre partes do histórico; lote mínimo sem falsa ativação; distinção de fim do recorte; sinais realmente sem prazo; grade completa de 385.152 genomas únicos.
