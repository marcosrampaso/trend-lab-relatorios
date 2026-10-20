# Trend Lab — navegação compartilhada

Refatoração da apresentação local de todas as 52 páginas, incluindo laboratórios, relatórios históricos e campanhas. Página inicial em `/` e `/inicio.html`; rotas antigas `/?view=...` continuam operando.

## Organização

- Meu laboratório: visão geral, mercado, replay e CDI.
- PEPE e reforço: treino V3, populações anteriores, auditoria G830, conclusão e FinRL/POCs.
- Estratégias: day trade, Donchian, G151 e scalping.
- Modelos: árvores, genética e treinos documentados.
- Contexto: BTC/ETH, sentimento e notícias.
- Pesquisa: custos, perdas, validação, saídas e estudos do campeão.
- Arquivos: campanhas, relatórios por treino e registros de eventos.

Menu lateral com busca sem acentos, grupos recolhíveis, página ativa e preferências locais. A aba “Nesta página” acompanha os títulos visíveis, inclusive nas telas dinâmicas, e preserva os atalhos do estudo. Tecla `/` abre a busca; Escape fecha a gaveta móvel; foco preso no diálogo aberto e conteúdo de fundo inerte. Há link de pular para conteúdo, suporte a movimento reduzido e navegação por teclado. Na impressão, a navegação sai do caminho.

A visão geral mostra o estado publicado da V3, progresso e último resultado da auditoria de desenvolvimento com identificação do período, e informa quando o estado estiver desatualizado. Consulta somente os endpoints locais de leitura; não inicia treinos nem aciona ordens ou controles de coleta.

## Implementação

`local/ui-shell.mjs` adiciona os assets ao HTML servido, sem reescrever o HTML científico arquivado. Abrange também novas páginas geradas pelos monitores. `web/ui/navigation.js` define os assuntos; `pages.js` é o catálogo gerado com `npm run ui:catalog`; `shell.js` e `shell.css` aplicam navegação e apresentação; `home.js`/`home.css` cuidam da visão geral.

Menus antigos permanecem disponíveis para os controladores de abas existentes, mas saem da apresentação. Identificadores, gráficos, formulários e controles de treinamento permanecem acessíveis. Tabelas sem recipiente de rolagem recebem um; tabelas já preparadas são preservadas. Hashes longos quebram linha nos cartões, sem expandir a página móvel.

O guia FinRL possuía a regra global `svg{min-width:850px}`, que expandia os ícones da navegação. A regra agora se limita a `figure svg`, e os ícones do shell têm dimensões explicitamente limitadas. O diagrama científico mantém sua largura e rolagem própria.

## Verificação

339 testes passaram, incluindo catálogo, busca, rotas anteriores e entrega HTTP das 52 páginas com fontes originais intactos. Conferência no navegador: busca por G151, navegação para o relatório, índice de seções, replay existente, gaveta móvel, fechamento com Escape e ausência de erros de console nas páginas conferidas. V3 e FinRL em 390 px sem excesso de largura; ícones entre 13–24 px após a correção. Layout desktop conferido a 1440 px.

Somente o servidor de páginas foi recarregado para ativar a decoração HTML. Banco e registros não foram editados diretamente. Treinador da V3 manteve o mesmo PID e continuou em execução. Fontes registrados dos experimentos permanecem preservados. Nada foi publicado no site hospedado.
