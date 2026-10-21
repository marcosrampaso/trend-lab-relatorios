# Oportunidade e viabilidade das entradas

Página local: http://127.0.0.1:4173/pesquisa-genetica/oportunidades.html

## Conclusão

A execução não explica a inatividade geral: **14.574 de 14.582 oportunidades isoladas preencheram**, com as regras originais de 15× e risco de 1%. O gargalo é demonstrar expectativa positiva após custos e selecionar oportunidades com evidência suficiente. A calibração positiva dos poucos sinais aprovados tinha suporte muito pequeno e falhou retrospectivamente.

Não há recomendação de promover nenhum modelo. A auditoria terminou, sem retreino e sem modificar qualquer piloto anterior.

## Escopo e protocolo

- Protocolo e hashes registrados em `work/pepe-opportunity-v1/protocol.json` e `registration.json`, antes da execução.
- Mesmos cinco meses do piloto: abril, maio, junho, julho e setembro de 2024, todos já usados pelo laboratório.
- Compra e venda a cada 30 minutos: 7.291 horários × dois lados = 14.582 oportunidades.
- Cada oportunidade começa isoladamente com R$ 1.000. Resultados podem se sobrepor e **não podem ser somados como lucro de uma carteira**.
- Mesma escada 25/50/25, alvos líquidos equivalentes de 10%/20%/40% da margem original, stop 1,5 ATR, proteção e lock, custos de estresse, ticks/lotes, funding e limites de risco.
- Sem busca de parâmetros, redução de limiar, ajuste de alavancagem, refit de calibração, treino de modelo ou promoção automática.
- Encerramentos na fronteira mensal mantidos e reportados separadamente.

## Viabilidade

Estimativa estática com o **último fechamento conhecido**, ATR e regras da corretora. Não usa a próxima abertura nem extremos/volume futuros. Inclui custo de entrada, tamanho, stop e liquidação aproximada.

| Pré-checagem | Preencheu isoladamente | Não preencheu |
|---|---:|---:|
| Permite | 14.574 | 0 |
| Recusa | 0 | 8 |

As oito recusas foram por stop além da liquidação estimada. Essa concordância é observada neste histórico e não garante execução futura: preço, volume e saldo real podem mudar. Todas as estimativas usam a carteira inicial padrão, não o saldo variável de uma carteira contínua.

Duas das oito recusas pertencem aos três sinais selecionados pelo PPO 101 de venda. O motor já recusava esses sinais e revertia a taxa da entrada. Uma máscara de viabilidade pode melhorar o problema de aprendizado, mas não geraria lucro adicional nessas ordens que já não eram preenchidas. Nenhuma máscara nova foi aplicada.

## Distribuição de resultados

R representa o orçamento inicial de risco de R$ 10; não é retorno da margem.

| Medida | Compra | Venda |
|---|---:|---:|
| Oportunidades | 7.291 | 7.291 |
| Preenchidas | 7.287 | 7.287 |
| Positivas | 3.224 (44,24%) | 3.416 (46,88%) |
| Ganho médio entre positivas | +0,3703R | +0,3587R |
| Perda média entre negativas | −0,8909R | −0,8930R |
| Média líquida, incluindo não preenchidas como zero | −0,3327R | −0,3060R |
| Taxa de equilíbrio com esses ganhos/perdas médios | 70,64% | 71,34% |

Taxa de equilíbrio = perda média absoluta / (ganho médio + perda média absoluta). É uma descrição dos payoffs observados, não uma meta de acurácia nem probabilidade futura. A escada sobre margem permite ganhos típicos pequenos em relação à perda do stop em ATR. Isso justifica uma próxima comparação controlada de saídas; não prova que aumentar alvos resolverá o problema.

Houve três encerramentos na fronteira mensal (dois de compra e um de venda). Excluí-los não inverte a expectativa negativa: aproximadamente −0,3329R e −0,3062R.

## Custos na mesma trajetória de ordens

Médias por oportunidade preenchida, em reais:

| Atribuição | Compra | Venda |
|---|---:|---:|
| Bruto a preços de referência | −0,0604 | +0,2003 |
| Slippage e ticks adversos | −1,6368 | −1,6379 |
| Taxas | −1,6278 | −1,6289 |
| Funding | −0,0041 | +0,0043 |
| Líquido | **−3,3291** | **−3,0621** |

Identidade verificada: bruto de referência − slippage − taxas + funding = líquido. O bruto com preços de preenchimento modelados já contém slippage; não o descontamos novamente do bruto modelado.

O bruto de referência é reconstruído sobre **a mesma trajetória de ordens e saídas**, não é uma simulação sem custos. Retirar custos poderia alterar stops, alvos, sizing e decisões; portanto esses valores não demonstram rentabilidade de uma estratégia sem custos. Nenhum parâmetro de custo foi alterado para produzir lucro.

## Controles de carteira e CDI

Uma carteira realmente contínua de R$ 1.000 por mês, com própria sobreposição, cooldown, tamanho e limites diário/global. Meses independentes não são compostos.

| Controle fixado previamente | Líquido mensal médio | Acima do CDI | Posições | Meses com limite global |
|---|---:|---:|---:|---:|
| Ficar em caixa | R$ 0,00 | 0/5 | 0 | 0/5 |
| Sempre comprar | −R$ 102,67 | 0/5 | 137 | 5/5 |
| Sempre vender | −R$ 101,51 | 0/5 | 266 | 5/5 |
| Tendência comum de 1h e 4h | −R$ 101,79 | 0/5 | 268 | 5/5 |
| CDI bruto nos mesmos meses | +R$ 8,50 | — | — | — |

A perda pode passar do gatilho global de R$ 100 por custos/preço de execução. O saldo não é reiniciado dentro do mês para buscar um regime favorável.

Para contexto, os especialistas congelados combinados tinham média mensal de −R$ 2,54 na genética, −R$ 1,94 no PPO 101 e R$ 0,00 no PPO 202. Operar pouco preservou capital relativamente aos controles ativos; não demonstrou lucro nem superação do CDI.

## Regimes

Cortes unidimensionais registrados: tendências 1h/4h alinhadas, opostas ou mistas; custo de ida e volta ≤0,25R de preço, >0,25 a 0,5R, >0,5R; RVOL <1, de 1 a 2 e ≥2. O R de preço do grupo de custo é a distância entre entrada e stop vezes quantidade, diferente do orçamento R usado no resultado.

Nenhum grupo não vazio apresentou média líquida positiva no agregado dos cinco meses. Custos relativos menores reduziram a perda média, mas não produziram vantagem positiva. Uma subdivisão de tendência teve um único mês positivo; isso não valida uma estratégia. Todos os grupos e blocos constam no JSON, sem mineração de combinações ou escolha do melhor corte.

As oportunidades se sobrepõem: não se calcula significância estatística como se fossem milhares de retornos independentes.

## Suporte da calibração

Os scalers, pesos e calibradores foram somente carregados. As previsões foram reconstruídas e conferidas contra os arquivos congelados; nenhuma calibração nova foi ajustada.

- Genética de compra: a faixa estimada acima de 0,25R tinha **sete** exemplos em março. Quatro sinais passaram política e limiar depois; previsão média +0,5631R versus resultado isolado médio −0,3169R. Dois desses quatro scores estavam acima do suporte bruto observado em março e foram saturados pelo calibrador.
- PPO 101 de venda: a faixa estimada (0,1; 0,25]R tinha **dez** exemplos em março. Três sinais aceitos; previsão média +0,1488R versus resultado isolado médio −0,3239R. Dois não preencheram e o terceiro perdeu.
- Demais especialistas não aprovaram entradas depois dos dois filtros.
- Oportunidades positivas rejeitadas são identificáveis somente olhando o futuro; sua existência não demonstra que o modelo conseguiria selecioná-las antes da entrada.

Os bins completos e scores fora do suporte são apresentados por modelo. Menos de 50 exemplos é um alerta descritivo registrado, não um novo filtro aplicado. Março contém o ajuste original do calibrador, portanto seu próprio desempenho não é teste independente.

## Integridade e reprodução

- Trinta casos determinísticos de junho/dezembro de 2023 e março de 2024 reproduziram exatamente tanto a função congelada `candidateOutcome` quanto seus rótulos arquivados.
- 1.350 hashes de fontes e entradas antigas/novas conferidos antes/depois, incluindo pesos, previsões, labels, mercado e fontes científicas registradas.
- Modelos/labels antigos e estado privado `.local/` preservados.
- Verificações adicionais: contabilidade e partições completas, cobertura das previsões, ausência de sobreposição nas carteiras, CDI conciliado, custo sem dupla contagem e inputs causais.

```sh
node --test tests/specialist-opportunity.test.mjs tests/opportunity-results.test.mjs tests/specialist.test.mjs tests/specialist-replay.test.mjs
```

Código: `scripts/specialist-opportunity-core.mjs`, `prepare-opportunity-audit.mjs`, `run-opportunity-audit.mjs`, `audit-specialist-calibration.py`.
Resultados congelados: `work/pepe-opportunity-v1/result.json`; oportunidades individuais locais: `work/pepe-opportunity-v1/months/`; painel: `web/data/opportunities.json`.

## Próxima hipótese, ainda não aplicada

Auditar a relação entre alvos, stop e custos com entradas congeladas. Comparar uma alteração de saída por vez, por exemplo alvos relacionados ao risco do stop, sem simultaneamente mexer no modelo e nas entradas. Só prosseguir a retreino se houver evidência de expectativa favorável e condições de seleção observáveis antes da ordem.

Como os cinco meses já foram examinados, qualquer escolha baseada neles precisa de uma nova avaliação cronológica previamente reservada ou prospectiva. Aumentar gerações ou reduzir limiares para forçar operações não resolve os payoffs negativos. Este diagnóstico não prova impossibilidade de outras estratégias e não autoriza promoção automática.

## Continuidade da pesquisa

A hipótese de escada relacionada ao risco foi executada posteriormente, em estudo separado: [comparação local de saídas em R](http://127.0.0.1:4173/pesquisa-genetica/saidas-em-r.html). Consulte `PEPE-SAIDAS-EM-R.md` para protocolo, resultados pareados e limites da evidência. Este diagnóstico original permanece preservado.
