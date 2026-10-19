# Código, execução e relatórios

Este diretório contém o código do laboratório que gera os resultados publicados na raiz deste repositório. `source-manifest.json` identifica por SHA256 cada arquivo exportado do checkout local. Os relatórios são retratos datados, enquanto os processos de simulação continuam no computador.

## Rodar o serviço local

Requer Node.js com `node:sqlite` (Node22.13+; ambiente usado na validação: consulte o código/protocolos). No diretório `app/`:

```sh
node scripts/local-service.mjs start
node scripts/local-service.mjs status
```

O serviço usa dados públicos da Binance, sem chaves de negociação. Os painéis históricos precisam dos datasets omitidos do Git; sua ausência não significa que esses estudos foram refeitos. Os registros novos da execução ficam em `.local/` e `work/`, nunca no repositório.

O teste com notícias de rompimento pode ser iniciado por `node scripts/local-news-experiment.mjs start`. Ele requer o serviço ativo e uma rodada operacional ainda válida. As análises são produzidas separadamente por este chat; o coletor não chamaIA.

## Adicionar G151 em outra cópia

Restaure o diretório original `champions/g151-c6cb2a8370cd058b0be0/` da máquina que preservou o campeão, mantendo manifesto, modelos, predições e vetores usados para conferir inferência. Esses binários e dados de treino não foram enviados ao Git. Não substitua por modelos baixados de terceiros nem retreine mantendo o nomeG151.

Prepare `.venv-ml` com o ambiente fixado em `requirements-local-ml.lock.txt`. O comando `scripts/setup-local-ml.sh` cria esse ambiente. Depois:

```sh
node scripts/local-g151-news.mjs verify-models
node scripts/local-g151-news.mjs start
node scripts/local-g151-news.mjs status
```

Cada cópia registra uma rodada nova antes de admitir decisões. As pastas de execução da máquina original não devem ser transplantadas por cima de outro estado. O protocolo próprio do G151, o motor de funding e o atraso prospectivo estão documentados em `g151-news-operations.md`.

## Conferir o código sem os datasets grandes

```sh
node --test tests/g151-news.test.mjs tests/news-filter-experiment.test.mjs
```

Esses16testes usam fixtures sintéticas declaradas. A suíte completa de213testes foi executada no checkout original com seus datasets; vários testes históricos requerem arquivos omitidos deste pacote. A paridade dos dez modelos em20vetores requer o arquivo preservado do campeão.

## Ligação com os relatórios

- [Retrato do experimento](../experimentos/noticias/index.html): inclui horários de início, resultados e limitações, com dados embutidos para abrir offline.
- [Relatórios históricos](../README.md).
- [G151: cálculo](scripts/g151-news-core.mjs), [coletor](scripts/local-g151-news.mjs) e [inferência](scripts/g151-inference.py).
- [Rompimento: cálculo](scripts/news-filter-core.mjs) e [coletor](scripts/local-news-experiment.mjs).
- [Painel ao vivo local](http://127.0.0.1:4173/pesquisa-genetica/experimento-noticias.html?strategy=g151).

O GitHub não mantém esse painel rodando, não armazena o banco nem recebe cada atualização automaticamente. Para sincronizar código após revisão, execute da raiz do repositório:

```sh
python3 tools/sync-local-source.py --source /caminho/do/trend-lab
```

Revise o diff e faça commit/push. O exportador não copia credenciais, banco, candles, pesos nem processos locais. Resultados novos precisam de outro snapshot datado, preservando os anteriores.


## BTC, ETH e sentimento local

Consulte [MULTIATIVOS-SENTIMENTO.md](MULTIATIVOS-SENTIMENTO.md) para preparação do ambiente separado, download da revisão fixada, coleta de manchetes e treino BTC. O GitHub não contém os331MBde pesos DistilRoBERTa, os pesos das florestas ou os históricos. O novo download exige internet; a inferência usaCPU local, sem API deIA. Não repetir a preparação/treino no diretório de uma execução já congelada.

Os28testes específicos de notícias/G151/multiativos/contextoBTC podem rodar sem os grandes datasets:

```sh
node --test tests/news-filter-experiment.test.mjs tests/g151-news.test.mjs tests/multiasset-sentiment.test.mjs tests/btc-context.test.mjs
```

A suíte completa de225testes exige os dados locais originais. [Relatório datado](../experimentos/btc-eth-sentimento/index.html); [painel local](http://127.0.0.1:4173/pesquisa-genetica/cripto-sentimento.html).
