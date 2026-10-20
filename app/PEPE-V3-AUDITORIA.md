# PEPE V3 — continuidade, arquivos imutáveis e ações válidas

Novo experimento isolado, registrado em 20/10/2026 antes da comparação dos pesos. Os experimentos antigos e seus números permanecem preservados. Só simulação local, sem ordens, chaves ou API paga.

## Por que mudamos

O pico registrado na G830 veio de uma janela reiniciada de dois dias; a carteira contínua da reconstrução atingiu a perda global antes de chegar à alta de novembro. O arquivo original dessa geração não havia sido guardado. O PPO antigo também podia pedir parcial/proteção sem posição: o modelo selecionado terminou o teste sem operações. Isso mostrou problemas na evidência e na formulação das ações; não demonstrou que corrigir ambos produziria lucro.

## Quatro mudanças

1. Recordes de lucro da sondagem e de score contínuo recebem pesos copiados antes de outro aprendizado/substituição, SHA-256, carteira, todas as posições e parciais, calendário, custos, fontes e linhagem. Cópias em diretório `archives`, criação exclusiva, permissão de leitura e conferência por hash. Os recibos conservam os pesos de todos os trabalhos até o checkpoint; interrupção não repete treino concluído.
2. Todos os 250 candidatos, em toda geração, são avaliados em **outubro–dezembro/2024**, uma carteira de R$1.000 por candidato, sem reinício entre dias/meses e com limites de perdas. Só esse resultado determina reprodução. Score = líquido − 0,25 × queda máxima × R$1.000, com custos de estresse. Caixa não recebe punição artificial.
3. Sondagens de dois dias, auditoria fixa e teste final são separados no painel. Não somamos rendimentos de janelas reiniciadas. O final antigo de julho/2025–agosto/2026 já foi consultado; não voltou a ser independente. Na V3, **o teste final está bloqueado e pendente de novo calendário prospectivo registrado**. Mais gerações podem sobreajustar o trimestre de desenvolvimento.
4. **MaskablePPO do SB3-Contrib**, com o ambiente de futuros da pesquisa FinRL: máscaras no aprendizado e também na avaliação determinística. Sem posição não há fechamento/parcial/proteção. Com posição não há nova entrada. Parcial depende de lote/restante e só pode ocorrer uma vez; proteção depende do preço conhecido e custos. Caixa é sempre válido. O futuro pode trazer gaps, funding, preços/lotes e volume que ainda impeçam uma ordem elegível no momento da decisão; isso fica separado de ação incompatível por estado.

Não chamamos o algoritmo mascarado de PPO criado pelo factory FinRL: esse factory fornece PPO simples. Os 38 estados e 10 ações foram preservados, e a transferência verificou 12 tensores, totalizando 14.027 parâmetros idênticos. O otimizador foi reiniciado.

## Escolha do pai

Inventário registrado: **1.150 arquivos / 1.093 arquivos de pesos distintos**, das populações anteriores 250/1.000, candidatos imutáveis e reconstrução comportamental da G830. Não recuperamos pesos que foram sobrescritos. Árvores ETH G151 e regras Donchian não são tensores compatíveis.

Todos foram convertidos e auditados no mesmo trimestre, sem acessar o teste final antigo para ranking. Critério ativo para inicialização separado de caixa; 1.063 políticas abriram posição. Pai escolhido: **agente 80 da população parcial de 1.000** (`v1-1000-partial-current-a80`), depois da conversão para ações mascaradas:

- Saldo final **R$1.074,25**; líquido **R$74,25**; quatro posições.
- Queda máxima **9,91%**; score com penalidade **R$49,47**; sem atingir a perda global.
- Taxas **R$4,80**, funding **−R$1,50**; slippage já incluído nos preços executados. Não subtrair slippage novamente do líquido.
- CDI bruto no mesmo calendário: **R$1.026,76**; diferença histórica **R$47,50**. Taxas diárias reconciliadas, 63 observações; fonte instalada BCB/Ipeadata.
- Nenhuma ação incompatível por estado. São apenas quatro posições e desenvolvimento usado para escolher entre 1.093 candidatos: seleção múltipla e sobreajuste continuam sendo limitações fortes.
- SHA dos pesos convertidos arquivados: `19858116add8e09a6937929a3b77e26a9c0c557d8b173f331680a4d6d9ebff92`.

Os 250 iniciam com esses pesos; agente 0 mantém os hiperparâmetros do pai, demais agentes recebem parâmetros de aprendizado diversos e sementes próprias. Depois cada um aprende: o desempenho inicial pode piorar. O pai original permanece arquivado e comparável no painel.

## Execução

Alvo: 1.000 gerações × 250 agentes × 1.024 passos, até 48 horas ativas, com checkpoint. Boost: três processos de treino com duas threads Torch cada; eco: um processo. Não são 250 processos simultâneos. Maturidade de cinco gerações, substituição dos 20% inferiores elegíveis, herança dos 20% superiores, mutação de taxa de aprendizado, entropia, gamma e clip; imigrantes novos e aumento de diversidade após estagnação. Risco 1%, diário 3%, global 10%, alavancagens 10×/15×, taxas/slippage de 0,10% por lado no treino e seleção, funding real dos arquivos. Sem aumento de risco para fabricar lucro.

```sh
.venv-rl/bin/python scripts/prepare-pepe-mask.py  # somente uma vez; recusa sobrescrever registro
node scripts/local-pepe-mask.mjs status
node scripts/local-pepe-mask.mjs pause
node scripts/local-pepe-mask.mjs resume boost
```

Controle HTTP separado em `127.0.0.1:4175`, somente origens locais autorizadas, JSON e cabeçalho próprio. A execução existente usa `caffeinate -is -w PID`, limitado a 48h; tampa aberta e alimentação suficiente. Aprendizado não depende de internet após os dados instalados. Sem execução automática depois de reiniciar o macOS.

## Evidências e telas

- [Painel local](http://127.0.0.1:4173/pesquisa-genetica/pepe-v3.html)
- [Ranking inicial completo](http://127.0.0.1:4173/data/pepe-mask-parent-scan.json)
- [Estado da execução](http://127.0.0.1:4173/data/pepe-mask.json)
- Registro local: `work/pepe-finrl-mask-v3/registration.json`, inventário, `parent-selection.json`, resultados da varredura, checkpoints, recibos e arquivos de campeões.
- Fontes científicas novas verificadas por hash; adaptador, motor e fontes registrados dos experimentos antigos não foram alterados.

Validação final: 335 testes Node, teste real de transferência/treino mascarado (1.024 passos), repetição sem novo aprendizado, contabilidade no calendário inteiro, bloqueio de sobrescrita de arquivos e zero ações incompatíveis. A suíte inclui dois testes da apresentação e fases do painel; controles locais e arquivos respondem HTTP200. Não foi feita inspeção visual no navegador nesta etapa.

Referências técnicas: [MaskablePPO oficial](https://sb3-contrib.readthedocs.io/en/master/modules/ppo_mask.html), [FinRL](https://github.com/AI4Finance-Foundation/FinRL), [PBT](https://arxiv.org/abs/1711.09846). A adaptação é síncrona e não replica literalmente o protocolo do artigo PBT.
