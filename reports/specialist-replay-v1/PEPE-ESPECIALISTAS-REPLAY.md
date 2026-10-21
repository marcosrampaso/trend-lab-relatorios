# Especialistas: por que ficam em caixa e replay de ordens

Página local: http://127.0.0.1:4173/pesquisa-genetica/especialistas-replay.html

## O que encontramos

Os seis especialistas terminaram. Cada um recebeu 7.291 horários de avaliação, a cada 30 minutos, nos meses de abril, maio, junho, julho e setembro de 2024. Os históricos já tinham sido utilizados pelo laboratório; esta avaliação é retrospectiva.

| Especialista | Política aceita | Calibração recusa dentre as aceitas | Passam ambos os filtros |
|---|---:|---:|---:|
| Genética 151 compra | 4 | 0 | 4 |
| Genética 151 venda | 6 | 6 | 0 |
| PPO 101 compra | 108 | 108 | 0 |
| PPO 101 venda | 282 | 279 | 3 |
| PPO 202 compra | 26 | 26 | 0 |
| PPO 202 venda | 33 | 33 | 0 |

Na combinação, a genética executou quatro posições. O PPO 101 selecionou três vendas, mas duas em abril foram recusadas por **stop além da liquidação estimada**, a 15×. Executou uma em maio. O PPO 202 não selecionou entradas. Carteiras separadas e combinadas repetem posições; não devem ser somadas como novas operações independentes. Nenhuma carteira foi interrompida pelo limite global nesse piloto.

O retorno mensal médio da combinação genética foi −R$ 2,5443776366; a média das duas sementes PPO, −R$ 0,9716786356; o CDI bruto dos mesmos meses, +R$ 8,5009837127. As carteiras começam com R$ 1.000 independentemente em cada mês. Não é uma série composta de cinco meses.

Os rótulos de treino tinham média −0,3892R para compra e −0,3462R para venda, sob a saída fixa e custos de estresse. Esperar dá recompensa zero. A política tem incentivo a recusar entradas. Isso explica a direção da aprendizagem, mas não prova que toda recusa é ótima. A escassez de operações impede evidência suficiente de eficácia. Os 0,1R da barreira são expectativa de resultado normalizado, não probabilidade de acerto.

## O que foi implementado

- Replay local de candles OHLCV de 1m, agregados visualmente para 5m ou 15m. O intervalo de visualização não muda os sinais do modelo.
- Seletor de variante, mês e operação; reprodução/pausa, velocidades 1/5/30, próximo candle, próxima decisão e próximo evento.
- Entradas, realizações, encerramentos e trajetória de stops com preços e quantidades arquivados.
- Estado da posição reconstruído exclusivamente dos eventos confirmados. Líquido das realizações é a soma das pernas já confirmadas, convertida pelo câmbio fixo de pesquisa, não saldo marcado a mercado.
- Candles fechados e eventos só são revelados no relógio apropriado (`knownAt`). Em 5m/15m, o agrupamento incompleto não aparece. O motor usa barras OHLC; não existe trajetória de ticks intraminuto para reproduzir.
- Meses sem ordens continuam mostrando candles e decisões de caixa. O funil retrospectivo completo é explicitamente separado do relógio do replay.
- Candles mensais carregados sob demanda, sem dependência de API externa. Após gerar o pacote e manter o servidor local ativo, os arquivos preparados funcionam sem internet.

## Integridade e reprodução

`scripts/export-specialist-replay.mjs` usa os modelos e previsões finais imutáveis. Reexecuta apenas a avaliação financeira inalterada para recuperar eventos de recusa que não estavam nos resumos antigos; **não retreina**, não pesquisa parâmetros e não altera regras, risco, sinais ou pesos.

As **45 carteiras** reproduziram exatamente todos os campos do resumo original: trades, pernas, custos, saldo, curva, stops, ações e contagens. As fontes registradas e artefatos dos modelos são verificados por SHA-256 antes e depois. Evidência: `work/pepe-specialist-replay-v1/audit.json`. As entradas antigas não são sobrescritas.

Gerar arquivos locais:

```sh
node scripts/export-specialist-replay.mjs
node --test tests/specialist-replay.test.mjs tests/specialist.test.mjs
```

Pacote local: `web/data/specialist-replay/`. Candles não são enviados ao GitHub. O repositório privado recebe código e metadados de diagnóstico; pesos e dados brutos permanecem locais.

## Próxima hipótese, ainda não aplicada

Verificar a viabilidade das entradas por lado e regime antes de investir em mais gerações. Medir cobertura e retorno após custos contra uma política simples nas mesmas oportunidades. Auditar suporte e estabilidade das faixas de calibração. Se existir vantagem mensurável, registrar uma única alteração com nova avaliação cronológica. Não baixar o limiar apenas para criar operações e não selecionar novos parâmetros nestes mesmos meses e chamá-los de teste independente.
