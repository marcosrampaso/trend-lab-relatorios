# Entradas congeladas: escada por margem versus escada em R

Painel: http://127.0.0.1:4173/pesquisa-genetica/saidas-em-r.html

## A entrada já funciona e só falta vender melhor?

Ainda não há evidência disso. Os especialistas de entrada não aprenderam a gerir saídas: suas saídas foram regras fixas do experimento. Custos, seleção de entradas e mecânica das saídas podem contribuir conjuntamente para as perdas.

Nas cinco oportunidades preenchidas selecionadas pelos próprios especialistas nos cinco meses originais, três perderam. **Nenhuma dessas três exibiu estimativa de encerramento líquida positiva nos instantes de decisão de cinco minutos observados**, antes da perda. Isso não mede todos os movimentos intraminuto; também não demonstra habilidade de entrada numa amostra tão pequena.

No universo amplo da auditoria anterior, 548/4.063 compras perdedoras (13,49%) e 519/3.871 vendas perdedoras (13,41%) chegaram a mostrar lucro líquido numa decisão5m antes de perder. A leitura de que todos os prejuízos eram lucros devolvidos na saída não é sustentada por esses dados.

## Hipótese testada

Mudança única de conceito: referência e magnitudes da escada de realização.

| | Controle | Alternativa |
|---|---|---|
| Referência | Margem original | Risco de preço original do stop |
| Alvos líquidos equivalentes | 10% / 20% / 40% | 1R / 2R / 3R de preço |
| Frações da quantidade inicial | 25% / 50% / 25% | Idênticas |

1R de preço = quantidade original × distância absoluta entre preenchimento inicial e stop inicial. Os alvos usam a liquidação líquida hipotética da quantidade **original**, incluindo taxas, slippage/ticks e funding conhecido, e mantêm a referência após parciais. Realizar 25% em 1R equivalente não significa receber 1R sobre a posição completa.

A métrica de resultado nas tabelas é outra unidade: **R de orçamento = R$ 10**, o risco de 1% de uma carteira isolada de R$ 1.000. As referências não se confundem com percentual de margem.

Stop 1,5 ATR, 15×, risco 1%, proteção/lock originais, frações, timing5m/1m, alvo reconferido na abertura, custos, funding, lote/ticks e limites3%/10% foram mantidos. Não foi adicionado limite de permanência; fronteiras mensais continuam explícitas. Nenhum alvo, seed ou parâmetro foi otimizado após olhar resultados.

## Protocolo e execução

Registro anterior aos resultados: `work/pepe-r-ladder-v1/protocol.json` e `registration.json`.

- **23.408 pares** de compra/venda no mesmo grid de30min, cada posição com carteira inicial isolada de R$1.000.
- Preenchimento inicial idêntico verificado em cada par: horário, lado, preço de referência e efetivo, quantidade, stop, margem, fee e risco iniciais.
- **64 carteiras mensais**: quatro fontes de propostas de entrada × dois braços × oito meses.
- Fontes: genética semente151, PPO101, PPO202 combinados e controle simples de tendência alinhada1h/4h.
- Calendário original: abril, maio, junho, julho e setembro/2024.
- Checagem cronológica adicional: outubro–dezembro/2024, fixada antes dos novos resultados. Esses meses já haviam sido usados pelo laboratório: **não são validação independente**.
- Pesos, scalers, calibradores e limiar de entrada congelados. Previsões antigas conferidas e copiadas exatamente; inferência adicional apenas para os novos meses.
- As estimativas calibradas continuam voltadas à saída antiga. Não são previsões calibradas para a nova escada; o propósito aqui é manter as entradas para comparar saídas.

Pares isolados podem se sobrepor; não somar nem compor seus resultados como uma carteira. Nas carteiras reais de simulação, propostas são iguais, mas saídas diferentes podem mudar o saldo, o tamanho das próximas posições e quais sinais encontram uma posição ocupada. As contagens são reportadas.

## Resultado pareado

Média líquida por oportunidade, em R de orçamento:

| Calendário | Lado | Controle | Em R | Diferença |
|---|---|---:|---:|---:|
| Cinco meses originais | Compra | −0,332729 | −0,332505 | +0,000224 |
| Cinco meses originais | Venda | −0,306045 | −0,309179 | −0,003134 |
| Out–dez/2024 | Compra | −0,316779 | −0,316287 | +0,000492 |
| Out–dez/2024 | Venda | −0,331314 | −0,328828 | +0,002487 |

As diferenças foram pequenas e todas as médias permaneceram negativas. Nenhum braço foi promovido.

## Carteiras mensais

Líquido mensal médio, uma carteira independente de R$1.000 por mês:

| Fonte de entrada | Originais · controle | Originais · em R | Out–dez · controle | Out–dez · em R |
|---|---:|---:|---:|---:|
| Genética151 | −R$2,54 | −R$3,03 | R$0,00 | R$0,00 |
| PPO101 | −R$1,94 | −R$1,94 | +R$0,64 | −R$2,68 |
| PPO202 | R$0,00 | R$0,00 | −R$3,26 | −R$3,26 |
| Tendência alinhada | −R$101,79 | −R$102,27 | −R$101,59 | −R$101,88 |

Nenhuma dessas carteiras superou CDI no respectivo mês. PPO101 manteve sete posições em outubro–dezembro nos dois braços, mas o lucro mensal médio pequeno do controle virou prejuízo na escada em R. Não escolhemos essa semente para implantação; ambas são reportadas e sua média é mostrada no painel.

A genética ficou em caixa nos três meses posteriores; isso entra como zero na média, não desaparece da avaliação. Limites de perda originais foram mantidos. Resultados e CDI bruto antes de impostos; câmbio fixo de pesquisa5BRL/USDT. Não se compõem reinícios mensais.

## Por que mudar o alvo teve pouco efeito?

Nos cinco meses originais, **12.703 de14.582 pares (87,12%)** tiveram resultado líquido igual. No calendário posterior, 7.509 de8.826 (85,08%).

No controle dos meses originais, 7.932 posições encerraram no stop inicial e 6.016 no stop protegido. Apenas2.330 tiveram alguma parcial. A regra já podia ativar lock de lucro antes da primeira realização; essa proteção foi mantida nos dois braços.

Na escada em R, os encerramentos foram semelhantes:7.933 stops iniciais,6.041 stops protegidos e1.674 posições com parcial. Portanto, trocar alvos não impede que stops/proteções encerrem antes deles. Isso é uma explicação do mecanismo, não uma prova de que desligar a proteção seria melhor. As contagens de encerramentos e presença de parciais descrevem aspectos diferentes e não são somadas.

## Integridade

- Motor antigo preservado. Fork separado `scripts/r-ladder-engine.mjs`, com base explícita da escada e rótulos apropriados.
- Braço de margem reproduziu exatamente **14.582 resultados de oportunidade antigos** e **20 resumos/ledgers mensais antigos**.
- Identidade dos preenchimentos iniciais verificada em todos os23.408 pares.
- **1.359 inputs/fontes registrados** conferidos antes/depois; sinais congelados antes dos resultados de saída.
- Nenhum retreino, modificação de pesos, alteração de risco ou ordem real.

Execução concluída. Evidência congelada em `work/pepe-r-ladder-v1/result.json`, pares por mês em `pairs/`, sinais em `signals.json`, inferências em `predictions/`. Os dados e pesos permanecem locais. Código e relatório são exportados ao repositório privado.

## Próxima hipótese, ainda não aplicada

Investigar isoladamente o instante de ativação da proteção, preservando entradas e risco. O teste atual não demonstra que entradas funcionam nem que toda saída falha; avalia apenas a escada mantendo a proteção original. Remover stops ou ampliar risco para buscar lucro não foi testado nem aplicado.

Qualquer seleção apoiada nesses históricos exige uma nova avaliação cronológica previamente reservada ou acompanhamento prospectivo com candidato congelado. Não aumentar gerações na mesma recompensa como substituto de evidência de vantagem líquida.

## Continuidade: gatilho da proteção testado

A comparação isolada entre proteção atual e proteção após a primeira parcial foi concluída em um estudo separado. [Painel local](http://127.0.0.1:4173/pesquisa-genetica/gatilho-protecao.html) · Documento `PEPE-GATILHO-PROTECAO.md`. O teste de escada aqui documentado permanece preservado.
