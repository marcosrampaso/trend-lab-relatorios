# PEPE - FinRL/PPO com população e controle manual

Registro: `pepe-finrl-pbt-v2`. Somente pesquisa local; nenhuma ordem real, credencial de conta ou API paga de IA.

## Estado e uso

Painel: http://127.0.0.1:4173/pesquisa-genetica/pepe-finrl.html
Mapa: http://127.0.0.1:4173/arquitetura-trend-lab.pdf

O teste operacional terminou pausado: 48 de 250 membros da primeira geração processados, 49.152 passos, zero gerações completas. São resultados de desenvolvimento; o teste final PEPE não foi aberto. A meta é 1.000 gerações, não uma contagem de gerações já concluídas.

- **Executar/retomar os 250 - boost**: até três workers CPU, duas threads cada. A população é processada em fila, nunca 250 processos simultâneos.
- **Rodar leve**: um worker, sem apagar pesos ou a geração parcial.
- **Pausar com checkpoint**: espera os trabalhos em execução e salva a geração parcial. Retomar pula os membros concluídos.
- O treinador aciona `caffeinate -is` enquanto estiver ativo. Manter o notebook aberto. Há orçamento preventivo de 48 horas ativas acumuladas e reserva de 10 GiB; o painel informa essas pausas. Não existe promessa de concluir 1.000 gerações durante uma noite.

Helper local na porta4174: `node scripts/start-pepe-pbt-control.mjs`. Ele permanece disponível para os botões mesmo com o treinamento parado. A porta4173 é o site existente, preservado. Controle por origem local permitida, JSON, cabeçalho próprio e campos de ação restritos. Não aceita caminhos ou comandos arbitrários.

CLI equivalente: `node scripts/local-pepe-pbt.mjs status|start|resume|pause|boost|eco`. `start` mantém o modo já selecionado. Os wrappers `local-pepe-finrl.mjs` e `run-pepe-finrl.mjs` apontam ao PBT novo. O antigo `train-pepe-finrl.py` pertence à tentativa V1 e não deve ser usado para este registro.

## Algoritmo e decisões

FinRL0.3.7 instalado fornece seu `DRLAgent`; PPO é Stable-Baselines3 sobre ambiente Gymnasium próprio de futuros. O adaptador carrega os submódulos reais instalados sem os imports de brokers não usados do `__init__` raiz do FinRL. Rede 64x64 em CPU; não transfere pesos de ETH/G151. Versões e hashes das dependências estão registrados.

38 observações = 15 de mercado/disponibilidade + 23 de carteira/posição. São 10 ações: caixa/manter, compra10x, venda10x, fechar, realizar metade uma vez, proteger custos, trailing1ATR, trailing2ATR, compra15x, venda15x. A alavancagem é escolhida só na entrada; risco planejado continua 1%, limite diário3%, global10%. Aumentar a alavancagem reduz margem para o mesmo notional quando o tamanho é limitado pelo stop; não multiplica automaticamente o lucro por1,5.

Sem prazo obrigatório ou alvo fixo do PPO. Stop inicial1,5ATR, liquidação, limites e encerramento do período continuam obrigatórios. Stops só apertam; sem pirâmide ou reversão instantânea. Ação usa apenas informação fechada e executa na abertura1m seguinte. Taxas, slippage adverso, funding, ticks e restrições de lote/notional. A ausência de volume não cria fills fictícios; saídas de risco esperam a próxima abertura negociável. Gaps podem exceder o risco planejado. Filtros atuais aplicados ao passado e manutenção fixa são aproximações declaradas.

## Dados e correção da tentativa V1

1000PEPEUSDT perpétuo: preço em USDT por mil PEPE, não por token individual. Arquivos públicos mensais de maio2023 a setembro2026, com checksum. Maio é aquecimento. Setembro2026 fica reservado. Agosto2024 tem dois minutos de mark price ausentes também no arquivo diário e na API; excluído dos episódios financeiros. Seus candles de preço íntegros só podem dar contexto passado aos indicadores.

A tentativa V1 usava features derivadas que pulavam barras sem volume. Isso produziu observação defasada; os checkpoints e resultados foram preservados sob `work/pepe-finrl-v1`, com fontes/entradas congeladas e correção documentada. Não houve teste final PEPE. A V2 mantém essas barras e explicita disponibilidade de volume/VWAP/RVOL: 342.144 estados5m em39 meses. Novos pesos e novo registro; não promover a tentativa falha.

## População, exploração e calendário

250 membros, até1.000 gerações, 1.024 passos PPO por membro/geração. Episódios independentes de7 dias no treino jun2023-set2024, excluindo agosto2024. Recompensa: variação do patrimônio marcado menos penalidade por aumento do drawdown, incluindo custos e prejuízo aberto. Inatividade não é artificialmente punida.

Desenvolvimento out-dez2024: sondagem determinística de2 dias, mesma para todos os membros de cada geração. Janelas mudam entre gerações, portanto uma linha crescente nessas sondagens não prova melhora no mesmo mercado. Maturação mínima5 gerações; pais nos20% melhores, até20% piores substituídos, incluindo5% aleatórios. Mutam learning_rate, ent_coef, gamma e clip_range. A cada três auditorias fixas sem melhora, mais imigrantes e maior mutação, conforme regra predefinida.

Auditoria na G1 e a cada50 usa trimestre inteiro, com arquivos imutáveis dos candidatos. Após G1000, até10 finalistas são comparados em jan-jun2025 (validação). Escolha por lucro líquido -0,25 x DD máximo x R$1.000; salvar modelo/hash antes do teste jul2025-ago2026. O teste final não volta como fitness. Nem os campeões antigos, nem a moeda escolhida após pesquisa anterior constituem validação prospectiva independente.

## Comparação e melhores/piores posições

Quatro curvas no calendário comum jul2025-ago2026: CDI histórico, G151 arquivado, DonchianV4 arquivado e PEPE final. Uma carteira de R$1.000 cada, FXfixo5, antes de impostos, capital carregado continuamente. G151/Donchian operam ETH e permitem referência fixa10x/15x; PPO opera PEPE com10x/15x por entrada. Não isola efeito da moeda ou algoritmo. G151 dos R$18,40 mensais não tem essa média extrapolada aqui.

Base: taxa0,05% +slippage0,05% por lado. Elevados: taxa0,10% +slippage0,10% por lado. Funding histórico adicional. CDI bruto usa as mesmas datas. A linha PEPE fica ausente até existir teste final selecionado e congelado.

Melhores/piores são posições completas por resultado líquido, incluindo todas as parciais e funding. Painel distingue exemplos do desenvolvimento (usados na seleção) do teste final; permite ver10x/15x e o JSON das realizações. Uma posição vencedora no desenvolvimento não demonstra desempenho posterior.

## Naive Bayes - hipótese ainda não implementada

Proposta: GaussianNB numérico como observador de risco baixo/moderado/alto. Não treinado, não conectado às38 features, não bloqueia PPO e não altera este registro. Notícias/DistilRoBERTa/BTC existem em outros módulos do laboratório; não são entradas deste PPO.

Antes de treinar: registrar um evento mensurável (por exemplo stop inicial atingido até horizonteH), direção, horizonte e faixas. Usar todas as oportunidades com desfecho amadurecido, não só ganhos ou ordens escolhidas pelo próprio bot. Evitar sobreposição/vazamento nas fronteiras temporais. Estimar/calibrar no passado e avaliar depois. RSI/EMA/MACD correlacionados podem levar NB a excesso de confiança; separar funções e comparar com regressão logística e regra de volatilidade. Medir Brier, log loss, calibração e erros por classe, além do líquido após custos em experimento posterior com/sem filtro. “Baixo risco” não significa seguro ou rentável.

## Verificações e fontes

A suíte final passou com321 testes, incluindo execução causal, custos, alavancagem, população, controle HTTP e renderização estrutural do painel. Gymnasium checker e256 passos do PPO real verificaram observações38/ações10 sem abrir o teste final. Exercício operacional do helper processou48 trabalhos, preservou checkpoints e terminou pausado. Verificação de HTTP/arquivos é distinta de validação visual no navegador. O PDF foi renderizado e inspecionado em todas as páginas.

- [FinRL oficial](https://github.com/AI4Finance-Foundation/FinRL)
- [PPO/SB3](https://stable-baselines3.readthedocs.io/en/master/modules/ppo.html)
- [Population Based Training, Jaderberg et al.](https://arxiv.org/abs/1711.09846) - adaptação síncrona local, sem alegar tamanho universal de população.
- [Arquivos públicos Binance](https://github.com/binance/binance-public-data)
- [Gaussian/Naive Bayes](https://scikit-learn.org/stable/modules/naive_bayes.html)
- [Calibração](https://scikit-learn.org/stable/modules/calibration.html)
