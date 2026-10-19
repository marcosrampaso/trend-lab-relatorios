# Donchian genético V2 · pesquisa sem trava acumulada

Em 19/10/2026, Marcos pediu que a pesquisa continuasse mesmo após perder cerca de R$100 e que as gerações não tivessem limite artificial. A V1 foi parada graciosamente na geração 119, com 119 gerações concluídas e 1.592 candidatos completos. Registro, checkpoint, caches e resultados anteriores permanecem em `work/donchian-evolution-v1/`. O painel anterior está disponível com `?run=v1`.

## O que mudou

A V2 desativa somente a trava acumulada de 10% na simulação de pesquisa e remove os tetos de 200 gerações/12 horas. Uma liquidação isolada de posição não bloqueia para sempre uma carteira ainda solvente. Permanecem risco de 1% por entrada, alavancagem de 10x, stop e alvo por operação, limite diário de 3%, lotes mínimos, taxas, slippage, funding e reinvestimento sobre o saldo efetivo. A carteira contínua recebe R$1.000 uma única vez; perdas não são apagadas e não há reposição. Uma carteira insolvente não abre novas operações. Gaps podem produzir saldo negativo no modelo conservador, que não é truncado para melhorar o resultado.

Remover uma trava permite medir a trajetória completa, mas não cria vantagem estatística. A seleção continua penalizando perdas, drawdown, instabilidade, baixa amostra e desempenho contra o CDI, e acrescenta 1.000 pontos de penalidade por janela de desenvolvimento insolvente. Lucro isolado não é aprovação para operação real.

## Herança e comparação

Foram importados o melhor genoma e parte da população da V1, junto das hipóteses já estudadas. Nenhuma pontuação ou avaliação em cache da V1 foi aceita como resultado da V2. Todos são reavaliados sob a nova política. Os mesmos dados, corte temporal, taxas CDI e filtros de lote da V1 foram copiados e tiveram hashes registrados antes da primeira avaliação; isso permite comparar políticas sem alterar simultaneamente os dados. O arquivo `seed-origin.json` guarda a origem e o hash do checkpoint anterior.

O histórico vai de 2020 até o corte de 19/10/2026 às 13:32 de São Paulo. Somente 2020–2023 seleciona os pais: 45 meses completos em 16 janelas independentes. 2024–2025 e 2026 permanecem diagnósticos posteriores e não alteram fitness ou mutação. Dados já vistos não são teste independente. O CDI das janelas usa taxas publicadas; o recorte contínuo com outubro incompleto permanece provisório, sem extrapolar taxas. Câmbio fixo de R$5/USDT é hipótese de simulação.

## Evolução e arquivo

Cada geração tem 24 candidatos, quatro elites, cruzamento, mutação e imigrantes. Após cinco gerações sem recorde, a mutação sobe para 50% por gene e os imigrantes para 40%. As demais vagas exigem genomas ainda não avaliados; hits de cache não substituem exploração nova. O checkpoint conserva os 20 melhores genomas com fitness, número de operações e insolvências. O histórico integral de gerações é acrescentado a `generations.ndjson`; o painel mostra os últimos 500 pontos e o checkpoint mantém os últimos 1.000.

A grade tem 52.224 combinações efetivas. Não há teto de gerações ou horas, mas uma grade finita pode se esgotar; nesse caso a execução encerra com `search-space-exhausted`, em vez de apresentar repetições como descobertas. Parada explícita, falha de integridade ou indisponibilidade do servidor também podem interromper o treino; a pausa local é respeitada. O processo usa CPU local e `caffeinate` enquanto permanece vivo, sem API paga de IA ou tokens do chat por avaliação.

## Executar e acompanhar

No diretório do Trend Lab:

```sh
node scripts/local-donchian-genetic-v2.mjs start
node scripts/local-donchian-genetic-v2.mjs status
node scripts/local-donchian-genetic-v2.mjs stop
node scripts/local-donchian-genetic-v2.mjs resume
```

Painel: <http://127.0.0.1:4173/pesquisa-genetica/donchian-genetico.html?run=v2>

Estado privado: `work/donchian-evolution-v2/`. Dados do painel: `web/data/donchian-evolution-{status,best,baseline}-v2.json`. O código V1 e os bots prospectivos permanecem preservados. Não há promoção automática de campeão nem ordens reais.

## Verificação

265 testes passaram. Os seis testes novos verificam equivalência monetária da política antiga, continuidade além de R$100 de perda sem reposição, permanência do limite diário com retomada no dia seguinte, insolvência sem novas entradas, ausência de tetos artificiais/diversidade inédita/penalização de insolvência, e continuação após liquidação de posição com saldo ainda positivo. O painel distingue as versões e expõe solvência, liquidações e rejeições por capital mínimo.
