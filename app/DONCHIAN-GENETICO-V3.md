# Donchian V3 · alvos da estratégia e saídas parciais

Pedido de 19/10/2026: realizar 50% da posição no alvo X e o restante no alvo Y, com alvos ligados à estratégia. Os 3% mostrados na V2 são o limite diário de perda sobre a carteira; não são alvo de lucro. O campeão V2 no encerramento usava stop de 2,5 ATR e alvo inteiro de 1,25R, em que R é a distância inicial do preço de entrada até o stop. A V2 foi preservada na geração 59, com 1.184 candidatos avaliados.

## Configuração da pesquisa

A V3 inclui genes `exitMode` (`single`/`split`), `firstR` (0,5; 1; 1,5) e `targetR` (1,25; 1,5; 2; 2,5; 3; 4). Na saída parcial, o primeiro alvo deve ser menor que o final. `partialFraction=0.5` define metade da quantidade no primeiro alvo. As opções e a população são registradas, com hash, antes das avaliações; para mudar a grade, criar outra rodada, sem editar uma execução congelada.

Para compra: stop = entrada − stopATR × ATR; X = entrada + firstR × distância do stop; Y = entrada + targetR × distância do stop. Para venda, os sinais se invertem. O ATR vem do sinal horário fechado e conhecido antes da entrada; os níveis desta versão são definidos na entrada e não se afastam conforme o preço. Não foi introduzido trailing stop ou movimento automático para breakeven.

Exemplo sem custos: entrada em 100 USDT, stop em 98 (1R=2), metade em 102 (1R) e metade em 104 (2R). Se ambos forem alcançados, o ganho ponderado é 1,5R antes dos custos, enquanto a saída inteira em 2R ganharia 2R. Se o preço voltar ao stop depois da primeira parcial, o ganho da primeira metade pode compensar a perda da segunda; taxas, slippage e funding ainda podem tornar o resultado líquido negativo. A comparação deve medir esse compromisso, sem assumir que parcial melhora o resultado.

## Contabilidade e execução

- Uma posição pode ter duas realizações, mas conta como uma operação no fitness e na taxa de acerto. As realizações ficam em `trade.legs` e eventos `partial-exit`.
- Taxa de entrada é cobrada uma vez e distribuída contabilmente entre as pernas. Taxas de saída e slippage usam a quantidade de cada execução. Duas saídas de metade não dobram automaticamente uma taxa proporcional ao volume.
- Funding após a primeira parcial incide somente na quantidade restante. Margem, risco planejado e taxa de entrada ainda atribuídos à posição aberta também caem proporcionalmente. Funding realizado não é creditado duas vezes.
- A quantidade parcial é arredondada para baixo ao passo do lote; o restante fica na segunda parte. A divisão pode se afastar ligeiramente de 50/50 por arredondamento. Ambas devem respeitar lote e notional mínimos. Se não puder dividir, mantém a posição inteira até a saída final e registra `partial-rejected`; não aumenta a entrada para viabilizar a parcial. Os filtros são os já congelados na V2 e não reconstroem mudanças históricas da corretora.
- Stop e liquidação estimada prevalecem sobre os alvos se coexistirem no mesmo candle de 1 minuto. Se somente os dois alvos forem alcançados, pode realizar as duas partes naquele minuto. O modelo não reconstrói ticks, fila de ordens ou profundidade histórica.
- Sinal contrário, limite diário ou prazo da operação também podem encerrar o restante antes do segundo alvo. A primeira parcial não inicia o intervalo de cooldown de uma nova posição; o intervalo começa na saída final.
- Permanecem risco de 1%, alavancagem 10x, capital único de R$1.000 na carteira contínua, custos/funding, limite diário de perda de 3%, insolvência, ausência de reposição e ausência da trava acumulada de 10%. Não há ordens reais ou promoção automática de campeão.

## Comparação e evolução

O campeão V2 é reavaliado como controle com saída inteira. A geração inicial inclui os mesmos genes de entrada com cada alvo final em saída inteira e as combinações válidas de saída 50/50: 22 perfis pareados, mais duas sementes anteriores. Custos elevados, dados, calendário e referência CDI são iguais. Execuções futuras podem divergir quando a política de saída libera a posição em outro momento; são as regras de entrada que são mantidas, não uma lista artificialmente fixa de trades.

Pontuações e caches anteriores não são reutilizados. Todos os perfis são avaliados novamente. A seleção usa apenas 2020–2023, em 45 meses completos/16 janelas, com penalidades por drawdown, dispersão, insolvência e amostra pequena. 2024–2025 e 2026 permanecem diagnósticos, sem escolher pais. Dados já vistos não se tornam teste independente. CDI completo é comparado nas janelas; o recorte contínuo com outubro incompleto continua provisório. O corte de mercado é o mesmo da V2: 19/10/2026 às 13:32 de São Paulo.

Nas gerações seguintes, os genes de entrada e saída podem evoluir juntos. Quatro elites, arquivo dos 20 melhores, mutação ampliada após estagnação e candidatos inéditos permanecem. A grade passou a 287.232 combinações efetivas, verificadas por enumeração sem duplicatas. Sem teto de gerações/horas; parada explícita, falha, pausa do servidor e exaustão real da grade são respeitadas.

## Operação local e resultados

Painel: <http://127.0.0.1:4173/pesquisa-genetica/donchian-genetico.html?run=v3#exits-section>

```sh
node scripts/local-donchian-genetic-v3.mjs start
node scripts/local-donchian-genetic-v3.mjs status
node scripts/local-donchian-genetic-v3.mjs stop
node scripts/local-donchian-genetic-v3.mjs resume
```

Estado privado: `work/donchian-evolution-v3/`. Saídas públicas: `web/data/donchian-evolution-{status,baseline,best}-v3.json`. O painel inclui comparação de saída inteira/50/50, parciais e rejeições por lote, exemplos reais do backtest, curvas de saldo/CDI e progresso. V1 e V2 podem ser consultadas com `?run=v1` e `?run=v2`.

275 testes passaram, incluindo dez novos: equivalência exata da saída inteira com V2; compra/venda em duas partes; taxas e funding sobre quantidade restante; continuidade ao processar dados em partes; precedência conservadora do stop; restante encerrado por stop, prazo, sinal contrário ou fim do teste; lote mínimo; ordenação de alvos; normalização/variação dos genes e tamanho exato da grade. O código, a documentação e um retrato datado são publicados no repositório privado autorizado; dados de mercado brutos, banco e caches continuam locais.
