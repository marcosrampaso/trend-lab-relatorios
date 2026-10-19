# Treinamento local porCPU

Implementação emPython/scikit-learn com avaliação financeira no motor original doTrend Lab. Ambiente isolado `.venv-ml`, versões fixadas em `requirements-local-ml.lock.txt`. Hardware detectado: AppleM5,10 núcleos lógicos,16GBRAM.

## Acompanhar

Abra [Scalping local](http://127.0.0.1:4173/?view=scalping). O painel **Comparação local de modelos** consulta o progresso a cada5 segundos enquanto a aba está visível e permite revelar/exportar a comparação concluída. O relógio do replay não controla o treinamento.

No terminal:

```sh
cd /Users/marcosbezner/Documents/Codex/2026-10-16/fi/outputs/trend-lab
npm run ml:status
```

## Executar e interromper

O ambiente já está preparado nesta máquina. Para instalar em outra instalação compatível, use `npm run ml:setup` (Python3 eNode necessários; o lock atual foi criado comPython3.14/arm64).

```sh
npm run ml:train -- --profile overnight --workers 10
npm run ml:stop
npm run ml:resume
```

`ml:train` inicia um processo separado que continua após encerrar esta conversa. `ml:stop` solicita parada somente ao processo identificado deste projeto. `ml:resume` reutiliza o perfil anterior e tarefas concluídas compatíveis; se dados, código ou bibliotecas mudarem, exige uma nova rodada. A avaliação também tem checkpoints por família e trimestre. Retomar abre uma nova janela de tempo, sem refazer tarefas concluídas. Não use `resume` para repetir uma rodada já concluída: ela só reutilizará os artefatos.

| Perfil | Ajustes | Limite por execução |
|---|---:|---:|
| `quick` |9, teste de funcionamento |10min |
| `balanced` |273 |30min |
| `overnight` |777 |8h |

No perfil noturno, cada uma das6 configurações de florestas/MLP tem5 sementes; as demais usam uma. A média dos scores é calculada antes da seleção na validação. São3 famílias de estratégias e7 cortes trimestrais. Usamos até10 processos e uma thread por processo; a avaliação de carteiras vem depois do ajuste dos modelos.

**Oito horas são um teto, não uma duração obrigatória.** Esta base tem19.535 exemplos de sinais e12 features, portanto a rodada pode acabar em poucos minutos. Não há ganho em repetir tarefas idênticas para manter aCPU ocupada. Na próxima rodada, uma hipótese útil deve alterar os dados ou a pergunta de pesquisa e ter novo protocolo.

No macOS, `caffeinate -i -w PID` impede repouso por inatividade apenas enquanto o processo de treino existe. Deixe o Mac conectado à energia, ventilado e com a tampa aberta; esse comando não mantém um Mac fechado treinando. Nenhuma configuração permanente de energia é alterada.

## Protocolo e resultados

`local-ml-protocol.json` registra configurações, limiares, sementes e critérios. Histórico1min de2024–setembro2026, com aquecimento anterior; teste posterior de janeiro2025 a setembro2026 em7 blocos de3 meses. Cada bloco usa9 meses de treino e3 de validação anteriores. Rótulos são purgados pela disponibilidade do resultado, com margem conservadora de245min herdada da base.

Na validação, a carteira roda continuamente por3 meses; na avaliação posterior, cada mês reiniciaR$300, como no estudo anterior. Isso pode favorecer escolhas inadequadas para resets mensais; é uma limitação explícita. Uma próxima hipótese pode alinhar os dois regimes, registrada separadamente, sem reescrever os resultados desta rodada.

O resultado principal é a escolha feita pela validação anterior; o resultado de cada algoritmo é diagnóstico. Carteiras com custos dobrados são recalculadas, não apenas uma subtração no lucro. Um filtro só é aprovado na validação se tiver resultado positivo sob custos2× e superar o controle, além dos critérios de cobertura, operações e queda máxima. Aprovar na validação não garante sucesso no trimestre seguinte.

Modelos e artefatos ficam em `work/local-ml/runs/ID/`:

- `registration.json`: protocolo e hashes de código, dados e versões;
- `models/*.joblib`: modelos ajustados;
- `predictions/*.json`: scores, fronteiras temporais, métricas de validação, sementes, avisos de convergência, tempos e memória;
- `evaluation/*.json`: carteiras, operações e seleção por trimestre;
- `evaluation.json`: relatório agregado final;
- `status.json`, `evaluation.log`: progresso e diagnóstico.

O painel lê `web/data/cpu-training-status.json` e `web/data/cpu-training-results.json`. O resumo monetário usa a mesma hipótese de câmbioR$5/USDT do estudo, sem consultar cotação atual. Modelos serializados devem ser carregados apenas quando forem artefatos conhecidos desta execução.

Esta comparação não instala modelos novos no replay nem no processo prospectivo. A árvore anterior continua disponível no replay. Nenhuma ordem real ouAPI paga deIA é usada. Os dados e estudos anteriores continuam congelados.

Veja [a pesquisa e suas limitações](PESQUISA-ML-MERCADOS.md). O benchmark não reproduz integralmente os estudos acadêmicos citados.
