# Histórico ampliado do Donchian: 2020–2026

Disponível no [painel local](http://127.0.0.1:4173/?view=donchian), incluindo seleção de ano/bloco, custos base/dobrados, replay e exportação do histórico.

## Cobertura e integridade

- 59.520 candles de 1h e mark prices alinhados, de 1jan2020 até 15out2026 UTC.
- 7.440 eventos de funding histórico; checagem de lacunas e duplicações.
- 177 arquivos mensais adicionais da Binance com SHA256 verificado contra CHECKSUM oficial.
- 48 mark prices ausentes nos arquivos foram recuperados pela API oficial (24 em2out2022 e24 em24fev2023). Sem interpolação ou substituição por preço negociado.
- Dezembro2024 em diante é cópia exata do arquivo já preservado. Seus dados e reparos anteriores continuam registrados separadamente.
- Janeiro2020 serve como aquecimento. Testes iniciam em1fev2020.

## Comparação ampliada

Cinco novos blocos anuais (2020 parcial; 2021–2024 completos), mais os quatro blocos anteriores de2025–2026. São36 cenários:9 blocos ×2 variantes ×2 custos. Cada carteira reiniciaR$300 por bloco. Não somar retornos nem interpretar estes blocos como operação contínua.

| Bloco | Fixo · base | Adaptativo · base | Fixo · custos2x | Adaptativo · custos2x |
|---|---|---|---|---|
| Fev–dez 2020 · histórico ampliado | R$-20,13; 126 operações; pausa por liquidação estimada | R$-10,05; 122 operações; pausa por liquidação estimada | R$-31,33; 81 operações; pausa global | R$-30,61; 79 operações; pausa global |
| 2021 · histórico ampliado | R$35,90; 70 operações; pausa por liquidação estimada | R$29,54; 64 operações; pausa por liquidação estimada | R$24,35; 62 operações; pausa por liquidação estimada | R$13,48; 58 operações; pausa por liquidação estimada |
| 2022 · histórico ampliado | R$-30,38; 117 operações; pausa global | R$-23,38; 236 operações | R$-30,69; 85 operações; pausa global | R$-30,29; 87 operações; pausa global |
| 2023 · histórico ampliado | R$-30,35; 65 operações; pausa global | R$-30,77; 128 operações; pausa global | R$-30,12; 43 operações; pausa global | R$-31,33; 44 operações; pausa global |
| 2024 · histórico ampliado | R$-30,30; 81 operações; pausa global | R$-30,94; 92 operações; pausa global | R$-30,31; 62 operações; pausa global | R$-30,39; 62 operações; pausa global |
| Jan–jun 2025 · desenvolvimento | R$-30,07; 71 operações; pausa global | R$-30,22; 78 operações; pausa global | R$-30,53; 49 operações; pausa global | R$-30,32; 49 operações; pausa global |
| Jul–dez 2025 · validação conhecida | R$-11,59; 140 operações | R$-2,09; 132 operações | R$-30,14; 90 operações; pausa global | R$-27,47; 124 operações |
| Jan–set 2026 · comparação retrospectiva | R$8,90; 200 operações | R$30,38; 193 operações | R$-30,24; 109 operações; pausa global | R$-30,60; 161 operações; pausa global |
| 1–15 out 2026 · janela adicional | R$9,22; 11 operações | R$0,50; 11 operações | R$4,29; 11 operações | R$-2,64; 11 operações |

O adaptativo superou o fixo em4/9 blocos com custo base e perdeu em8/9 com custos dobrados. Nos cinco blocos adicionados, apenas2021 terminou positivo no adaptativo. Os16 cenários anteriores, incluindo todas as operações e curvas, permanecem idênticos.

Alguns blocos foram encerrados por **liquidação estimada**, inclusive com lucro acumulado positivo em2021. Isso pode acontecer porque liquidar uma posição não implica zerar a carteira inteira. A execução1h prioriza liquidação estimada antes do stop se ambos forem atingidos na mesma hora; não sabemos a sequência real dos ticks. Esses números não são resultados executáveis garantidos.

## Treino e validação

O Donchian atual não é um modelo treinado. Preservamos integralmente a fórmula adaptativa, janelas10–40h, filtro de volume, stop, alvo e risco da rodada anterior. Não houve otimização nos novos anos.

Mais histórico permite examinar cenários e preparar futuros modelos, mas não transforma dados já observados em teste inédito. Para um modelo de aprendizado de máquina, a etapa seguinte precisa definir cortes cronológicos antes de ajustar parâmetros, treinar apenas no passado, validar no bloco seguinte e reservar um teste final sem consulta. Como já inspecionamos estes resultados, eles não podem ser apresentados como validação futura intocada. Notícias atuais também não podem ser inseridas retroativamente.

Este banco é horário: não substitui dados1min para scalping. Custos, filtros de lote atuais, câmbio hipotético e liquidação aproximada continuam hipóteses. A rodada prospectiva e as estratégias antigas foram preservadas.

## Reprodução

- `python3 scripts/fetch-donchian-history.py`: verifica e reutiliza o histórico congelado; não sobrescreve seus dados.
- `node scripts/analyze-donchian-history.mjs`: reproduz todos os36 cenários e confere os16 antigos sem regravar resultados.
- `npm test`: cobre continuidade, causalidade, aquecimento, caixa, reprodução e hashes.
- `npm run build`: confere preservação dos estudos anteriores e da ampliação.

Arquivos: `donchian-history-protocol.json`, `donchian-history-freeze.json`, `web/data/eth-donchian-history.json` e `web/data/donchian-history-results.json`. Histórico e estudo podem ser exportados pelo painel.
