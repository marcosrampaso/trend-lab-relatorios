# Trend Lab · execução local

O usuário pediu para deixar o site local. Este checkout agora é o aplicativo local: não publicar, sincronizar ou alterar o site hospedado sem novo pedido explícito. Usar o checkout existente e preservar os arquivos congelados verificados pelos testes/build.

- Mercado e simulação: processoNode local, API pública da Binance eSQLite em `.local/runtime.sqlite`.
- Iniciar: `npm run local:start`. Parar: `npm run local:stop`. Estado: `npm run local:status`.
- `.local/` é estado privado da execução; não versionar, empacotar, sobrescrever ou apagar registros.
- Somente simulação, sem ordens reais, API keys de negociação ou alteração de risco para produzir lucro.
- Notícias deste chat seguem `news-operations.md` e o limite de consumo combinado. O coletor de mercado e a simulação não precisam deIA.
