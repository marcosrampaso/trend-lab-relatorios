# Saídas adaptativas e novas entradas

O experimento está em `http://127.0.0.1:4173/pesquisa-genetica/saidas.html`. A rodada de 18/10/2026 congelou como referência o campeão `01607563faf0bfb1f828`, geração 73, enquanto a genética original continuou rodando.

`npm run research:exits` executa outra rodada registrada com o campeão disponível naquele momento. O perfil exige uma árvore; não altera a campanha genética, seus modelos ou seus arquivos registrados. Cada execução tem sua pasta em `work/adaptive-exit-study/`. A preparação lê dados públicos já salvos, sem chamadas pagas e sem ordens.

## Duas perguntas diferentes

1. Quatro políticas de saída usam as mesmas predições de entrada: referência; retirar só o prazo individual; trailing sem alvo fixo com invalidação EMA; alvo contextual com trailing e invalidação. Risco 1%, capital R$1.000, alavancagem10×, stop inicial e custos permanecem.
2. A ablação treina árvores com12 e30entradas sobre os mesmos exemplos, janelas, parâmetros, rótulos e semente. A árvore12 deve reproduzir os scores salvos. As árvores30 mantêm os limiares existentes, sem ajustá-los à validação.

Foram calculadas120carteiras: cinco casos × dois custos × (nove meses reiniciados + três blocos contínuos). Os nove meses da referência reproduzem PnL, contagem e drawdown registrados. Os blocos não são somados através das lacunas. O fim da janela encerra posições mesmo nas variantes sem relógio.

O protocolo é `adaptive-exit-study-protocol.json`, salvo e identificado por hash antes dos cálculos. Modelos e resultados brutos permanecem na pasta da rodada. O relatório é exploratório, em validação já conhecida, sem teste final ou promoção automática.

## Regras causais

Indicadores de5min só ficam disponíveis no fechamento. O motor atualiza stop para o minuto seguinte usando esse contexto. O trailing ativa após1R pelo fechamento e acompanha o melhor fechamento por2ATR, sem afastar o stop. O piso de equilíbrio considera taxas, slippage e funding já conhecidos; gaps podem causar perdas. O alvo contextual é definido na entrada em2R ou3R conformeADX, EMA eMACD; não é empurrado indefinidamente para longe.

As novas entradas incluem DMI/ADX, MACD, Bollinger, retornos15min/1h, mudança deRSI/ATR, delta agregado, corpo/sombras, volatilidade realizada, basis mark/negócio, volume agregado e ciclo horário. Não há open interest, livro ou notícias históricas inventados.

## Limite do aprendizado

Os rótulos reutilizados descrevem as saídas originais. As árvores30 aprendem a filtrar essas entradas, não a escolher novas saídas. Treinar um modelo de saída exigirá outros rótulos, maturidade após o encerramento, separação temporal e seleção próprios. A pesquisa atual não usa predições do teste final.

O relatório inclui uma anotação posterior separada: as variantes móveis encerraram34 de47 operações pela regraEMA5min. Isso sugere uma incompatibilidade com reversãoBollinger, mas não isola causalmente o efeito do trailing. Seria preciso registrar um próximo ensaio que separe os componentes.
