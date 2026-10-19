# Rodada ampliada de treinamento

Rodada `extended-20261018-v2`, iniciada por solicitação do usuário em18/10/2026. Teto de8h incluindo preparação dos exemplos, ajustes e avaliação financeira. Na execução iniciada às03h38 deSão Paulo, limite às11h38. O programa encerra antes se concluir a fila; não repete tarefas idênticas para manter aCPU ocupada.

## O que está na fila

-3 estratégias: cruzamentoEMA9/21, pullbackVWAP com volume e retorno às bandas deBollinger comRSI.
-7 algoritmos incluindo referência constante: regressão logística, árvore, Random Forest, Extra Trees, gradient boosting e redeMLP, além da referência.
-4 prazos máximos por operação:30,60,120 e240min.
-3 janelas de treino:6,9 e12 meses.
-3 meses posteriores ao treino para validação; teste no mês seguinte, com atualização mensal.
-21 meses de teste, janeiro2025–setembro2026; janelas de12 meses começam apenas em abril2025, quando há histórico anterior suficiente.

São720 grupos de estratégia/prazo/janela/mês. Cada grupo tem13 configurações, com5 sementes para florestas eMLP:37 ajustes por grupo, **26.640 tarefas**. As sementes são agregadas antes de selecionar os limiares. Dados insuficientes ou sem duas classes são explicitamente omitidos; não se completa treino com dados futuros.

O protocolo está registrado em `local-ml-extended-protocol.json`, com hashes e versões em `work/local-ml/runs/extended-20261018-v2/registration.json`. Ele foi registrado após conhecer aV1, antes de avaliar aV2. Esta é pesquisa exploratória em histórico já visto.

## O que mudou metodicamente

Cada prazo tem rótulos próprios de resultado líquido de operação isolada sob custos dobrados. As12 features e os gatilhos originais continuam os mesmos, com contexto1h/4h fechado. A disponibilidade do rótulo mantém margem conservadora de245min; resultados ainda indisponíveis nas fronteiras são purgados.

As florestas usam1200 árvores para investigar redução de variância. As redes têm limites de2000/3000 iterações, porque a primeira rodada frequentemente atingiu400/600 sem convergir. Os avisos novos também são preservados. Essas escolhas não serão reajustadas usando o resultado do teste desta rodada.

A validação agora reiniciaR$300 em cada um dos3 meses, alinhando seu regime ao teste mensal. A cada mês e estratégia, prazo, janela, configuração e limiar são escolhidos conjuntamente pela validação anterior. Critérios: resultado financeiro normal e com custos2×, cobertura mínima15%, pelo menos20 operações nos3 meses em ambos os custos e deterioração limitada de drawdown em relação ao controle30min. A seleção favorece o maior pior resultado entre os dois custos; empates favorecem menor limiar, menor prazo, menor janela e configuração mais simples.

Publicamos controles, escolhas por algoritmo, escolha geral e política com opção de caixa. Aprovação exige limiar positivo, validação com custos2× positiva e resultado superior ao controle30min. Aprovação na validação não garante ganho posterior. Aumentar o espaço de busca aumenta a possibilidade de selecionar ruído; os intervalos mensais são diagnósticos, sem corrigir todas as pesquisas anteriores. Nenhum modelo é promovido automaticamente ao replay ou à simulação prospectiva.

Risco1%, capital, alavancagem máxima10x, stops, alvos, custos, funding, intervalos e pausas permanecem do motor preservado. A única mudança financeira experimental é o prazo permitido. Não há ordens reais, API paga deIA nem notícias atuais inseridas no passado.

## Acompanhar, parar e retomar

O [painel de scalping](http://127.0.0.1:4173/?view=scalping) mostra preparação, modelos salvos e avaliação. A comparação anterior permanece em `local-cpu-benchmark-v1.json` e `RESULTADO-TREINO-CPU.md`; o painel publica a nova comparação quando sua avaliação termina.

No terminal do projeto:

```sh
cd /Users/marcosbezner/Documents/Codex/2026-10-16/fi/outputs/trend-lab
npm run ml:status
npm run ml:stop
npm run ml:resume
```

`resume` reaproveita perfil, recursos e checkpoints compatíveis. Cada retomada abre outra janela de até8h. Dados, código ou bibliotecas alterados bloqueiam a retomada. O processo usa até10 trabalhadores com uma thread nativa por modelo. Preparação de rótulos e avaliação usam um processoNode; o paralelismo principal é entre ajustesPython. Há parada com checkpoints caso o disco livre caia abaixo de4GB.

Deixe o Mac conectado à energia, ventilado e com a tampa aberta. `caffeinate` impede repouso por inatividade enquanto o processo principal estiver ativo, sem mudar preferências permanentes. O processo continua ao encerrar esta conversa; o Mac precisa permanecer ligado.

Os arquivos locais da rodada incluem `labels/` (checkpoints mensais e rótulos por prazo), `models/`, `predictions/`, `evaluation/`, `status.json` e logs. O relatório financeiro só fica completo após a etapa de avaliação. Interromper antes preserva os modelos concluídos, sem inventar resultados para tarefas pendentes.

Verificação inicial:5 testesPython,132 testesJavaScript, teste integrado de ajuste/seleção/carteira em uma amostra real de histórico e build local. A rodada anterior e seus hashes foram preservados.
