# Genética Donchian com acompanhamento local

Pedido de19/10/2026: melhorar a estratégia após diagnosticar as entradas perdedoras de janeiro/2020 e criar uma busca genética com dados desde2020 até o início da execução. A rotina está separada dos bots prospectivos e do estudo anterior, sem ordens reais.

Painel: http://127.0.0.1:4173/pesquisa-genetica/donchian-genetico.html . Atualização automática a cada3s, com geração, avaliações, fitness, lucro médio mensal do treino, genes do líder, conta contínua desde2020 versus original/CDI e períodos posteriores separados.

## O que aprende

O algoritmo procura combinações de regras, sem treinar rede neural ou floresta. Canal Donchian adaptativo10–40h, volume>1,2×média20h e ATR14 permanecem como fonte dos rompimentos. Entradas e saídas são modeladas em1minuto, com atraso de2min depois do fechamento horário.

| Gene | Alternativas |
|---|---|
| Esperar reteste | Sim/não |
| Exigir tendência EMA20/50 alinhada em1h e4h | Sim/não |
| Espera máxima do reteste |1,2,3,4,6horas |
| Tolerância em torno do nível rompido |0,05;0,15;0,30ATR da origem |
| Confirmação além do nível |0,05;0,10;0,20ATR |
| Invalidação dentro do canal |0,25;0,50;1ATR |
| Stop |1,25;1,50;2;2,50ATR |
| Alvo |1,25;1,50;2;2,50×distância do stop |
| Prazo da operação |120,240,720,1440min |
| Intervalo após saída |60,120,240min |

Reteste só pode usar uma vela posterior ao rompimento, após tocar a região do nível e fechar novamente do lado esperado. Rompimento contrário cancela o reteste pendente e mantém sua função de saída, mesmo quando uma entrada é vetada. Contextos1h/4h ficam disponíveis somente depois de fecharem. A hipótese de custo do filtro é sempre elevada e usa distância de referência1,5ATR; ampliar o stop não afrouxa esse filtro.

Risco1%, alavancagem10x, capitalR$1.000, limite diário3% e global10% ficam fixos. Stop mais largo reduz a posição para respeitar o mesmo orçamento em reais. Esses limites não são genes e não foram aumentados para produzir lucro. A conta contínua mantém bloqueio global permanente, com todos os meses seguintes em caixa se ele for acionado.

Referência conceitual, sem comprovação destes parâmetros: [Binance Academy — rompimento, confirmação e reteste](https://www.binance.com/en/academy/glossary/breakout).

## Evolução e orçamento

População24, sete sementes ligadas às hipóteses anteriores e17candidatos aleatórios. Seleção pela metade superior, cruzamento uniforme, quatro elites, mutação20% por gene e20% de imigrantes aleatórios. Após5gerações sem novo recorde, mutação50% e imigrantes40%. Genes de reteste inativos são normalizados para não contar cópias equivalentes como diversidade.

Semente reprodutível2026101951; limite200gerações ou12horas desde o início, sem prolongar automaticamente até encontrar lucro. O cache guarda avaliações completas por genoma/janela; checkpoints preservam os pais, geração e histórico. Retomar não repõe saldo, reinicia o orçamento temporal ou muda parâmetros. O processo éNode emCPU local, com heap limitado a1,5GB. `caffeinate -i -w PID` evita suspensão por inatividade enquanto o treinador permanece ativo; não altera preferências permanentes do macOS.

## Separação temporal e fitness

Desenvolvimento2020–2023:16janelas trimestrais/contíguas completas,45meses, usadas para escolher pais. Meses incompletos de mark price são excluídos igualmente para todos os genomas. Validação2024–2025 e avaliação2026 aparecem nos diagnósticos de cada novo líder, mas não entram na seleção/mutação. O corte recente é congelado antes da primeira avaliação. Todo o histórico já foi visto no laboratório: não se trata de validação independente, e muitas tentativas genéticas também podem sobreajustar.

Cada janela de seleção reiniciaR$1.000 e reinveste dentro dela; os lucros dessas janelas não formam uma carteira contínua. As médias mensais servem para comparar janelas de tamanhos diferentes. Sem custos/risco diferentes por candidato.

Fitness, em unidades deR$/mês ajustadas por penalidades:

```
lucro médio mensal com custos elevados
− CDI médio mensal das mesmas janelas
− 0,25 × dispersão do lucro mensal entre janelas
− 20 × proporção de janelas com bloqueio global
− 2 × quantidade de operações faltantes até30
− 1000 × excesso de drawdown acima de15%
```

Isso não é dinheiro ganho. Os gráficos mostram fitness e lucro separadamente; candidatos sem operações recebem penalidade. “Elegível” no núcleo significa apenas lucro médio positivo e ao menos30operações no treino; não significa aprovado para operar, superar oCDI ou robustez demonstrada. Nenhum líder é promovido automaticamente.

## Dados e conta contínua

Catálogo ETH desde01/01/2020UTC. O novo trecho foi baixado dos endpoints públicos USD-M da Binance, com candles negociados/mark1m e funding, até dois minutos antes do início para permitir fechamento. Respostas recentes ficam em `work/donchian-evolution-v1/tail.json`, fora doGit. O painel mostra o corte em horário de São Paulo e a quantidade de minutos adicionados. O instante inicial00hUTC corresponde a21h do dia anterior em São Paulo.

Diagnóstico contínuo: R$1.000 uma única vez, com reinvestimento e sem reset entre meses/anos, em custos base/elevados. Usa todos os82meses e o trecho recente.64minutos sem mark original usam proxy explícito do OHLC negociado; minutos/entradas com exposição são contados por líder, sem assumir que o resultado antigo de zero exposição vale para novos candidatos. Dados antigos não são preenchidos ou alterados.

CDI100% bruto, taxas diárias compostas com as mesmas datas/capital. Na seleção, todos os meses precisam reconciliar com acumulados mensais. No contínuo, outubro fica provisório enquanto faltarem taxas/reconciliação, sem inventar CDI ou percentual de superação. Custos/funding modelados, câmbio fixoR$5/USDT e filtros atuais de lote são aproximações, antes de impostos.

## Execução e testes

```sh
node scripts/local-donchian-genetic.mjs start
node scripts/local-donchian-genetic.mjs status
node scripts/local-donchian-genetic.mjs stop
node scripts/local-donchian-genetic.mjs resume
```

O servidor local deve estar ativo/não pausado. A rotina respeita pausa e não inicia outro servidor. Fontes, parâmetros e insumos privados de referência são conferidos por hashes. Estado isolado em `work/donchian-evolution-v1/`, com `registration.json`, `checkpoint.json`, `folds/`, `trials/` e `diagnostics/`. JSONs públicos: `donchian-evolution-status.json`, `donchian-evolution-best.json` e `donchian-evolution-baseline.json`. O protocolo existente não é sobrescrito para reiniciar a busca.

259testes passaram, incluindo causalidade dos sinais, reteste posterior/expirado/inválido, preservação das saídas contrárias, equivalência do controle, invariância do fitness a lucros futuros, diversidade/cruzamento reprodutíveis e posição menor com stop maior para o mesmo risco. Estudos antigos permanecem preservados. O GitHub recebe somente código/método e retrato datado; mercado bruto, banco e cache de treino ficam locais.
