# Resultado da rodada local deCPU

Rodada `overnight-20261018-v1`, concluída em18/10/2026 às03:18 deSão Paulo. **777 ajustes concluídos, zero falhas**,10 processos, uma thread nativa por processo. Tempo total aproximado:1min41s, incluindo avaliação financeira. O perfil tinha teto de8h; encerrou ao terminar.

A base contém19.535 exemplos de sinais com12 features. Treinar várias árvores nesta quantidade de dados é rápido. O objetivo desta implementação é uma comparação reproduzível; manter aCPU ocupada por mais horas não criaria novos exemplos independentes.

## O resultado financeiro

Teste posterior de janeiro2025 a setembro2026,21 meses. Cada mês reiniciaR$300; câmbio hipotéticoR$5/USDT. Médias mensais sob custos dobrados, sem composição:

| Estratégia | Controle sem filtro | Modelo/limiar escolhidos na validação anterior | Política que pode ficar em caixa |
|---|---:|---:|---:|
| CruzamentoEMA9/21 | −R$30,71 | −R$30,80 | R$0,00 |
| VWAP + volume | −R$30,79 | −R$15,13 | R$0,00 |
| Bollinger + RSI | −R$30,62 | −R$12,79 | −R$1,35 |

**A rodada não demonstrou estratégia lucrativa.** Filtrar reduziu a perda deVWAP eBollinger; não bastou para alcançar resultado médio positivo. A escolha geral por validação variou entre configurações ao longo dos trimestres. Não é correto apresentar o algoritmo que ficou melhor depois de olhar todos os testes como um vencedor validado.

Como diagnóstico posterior, a regressão logística comBollinger teve a menor perda média entre os modelos ativos: −R$11,55/mês sob custos2×. A Random Forest nessa mesma estratégia teve −R$15,33. Esses números não foram usados para substituir retroativamente a escolha feita em cada validação. Uma árvore ou rede mais complexa não ganhou automaticamente da regressão.

Somente1 dos21 cortes família/trimestre passou a condição de aprovação na validação: regressão logísticaC=0,1 comBollinger, limiar0,35, para abril–junho2026. Ainda assim, seus três meses posteriores perderam, respectivamente, R$10,63, R$7,45 eR$10,32 sob custos2×,24 operações no total. O −R$1,35 da política com caixa é a média nos21 meses, incluindo18 meses sem operação; não representa retorno de uma carteira continuamente composta.

## Limites e verificações

- Os meses já foram examinados em pesquisas anteriores. Há separação temporal entre ajuste e teste, mas nenhum novo histórico intocado. A rodada é exploratória.
-205 ajustes deMLP atingiram o limite de iterações sem convergir; os avisos foram preservados e aparecem no painel. Não aumentamos iterações depois de ver o teste.
- A média dos scores das5 sementes de cada configuração é usada antes da escolha do limiar. Dispersão entre sementes está em `stability` no relatório.
- Validação usa carteira contínua de3 meses; teste reinicia mensalmente. Essa diferença pode afetar a seleção e precisa de protocolo separado para ser investigada.
- Custos, funding, mark prices, regras de risco e execução vêm do motor preservado. Spread observado, fila e latência de ordens não são simulados.
-129 testesJavaScript e3 testesPython passaram. As verificações incluem purga temporal, padronização, limite de threads, hashes dos777 modelos, controle original, caixa e seleção pela validação. O build também passou, preservando os estudos anteriores.

O relatório consolidado desta rodada está em [local-cpu-benchmark-v1.json](local-cpu-benchmark-v1.json), separado dos arquivos de progresso que mudam em novas execuções. As operações por trimestre e os modelos estão no diretório local da rodada descrito em [TREINO-LOCAL-CPU.md](TREINO-LOCAL-CPU.md). Nenhum modelo novo foi promovido ao replay ou à simulação prospectiva.

Uma próxima rodada útil deve investigar uma hipótese específica — por exemplo, alinhar os resets da validação e teste, ou registrar um prazo maior de operação com novos rótulos — e observar um período ainda não usado. Esta rodada não autoriza alterar essas regras retrospectivamente nem executar ordens reais.
