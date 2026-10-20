# Controle rápido de CPU da V3

Disponível no cabeçalho de todas as páginas locais: **CPU · Turbo/Leve**. Abrir o menu e escolher:

- **Notebook livre · Turbo**: até três workers existentes, duas threads de cálculo por worker, conforme o protocolo registrado.
- **Estou usando · Modo leve**: até um worker; trabalhos em andamento terminam normalmente.

O controle usa a API local existente em `127.0.0.1:4175/api/mask`, exclusivamente com ações `boost` e `eco`. Não muda agentes, número de gerações, risco, critérios, pesos ou protocolo. Não inicia, reinicia ou retoma uma execução parada/pausada a partir do botão. A leitura inicial e as atualizações periódicas não enviam ações.

Os workers consultam o modo antes de retirar cada trabalho da fila. No modo leve, as outras faixas encerram após seu trabalho atual. Ao pedir turbo depois disso, voltam na próxima geração; se ainda estavam ativas, podem pegar trabalhos antes. O painel informa a capacidade solicitada, sem inventar medição instantânea de threads ocupadas. O protocolo atual limita a três workers; esse botão não cria cinco, sete ou dez treinos novos.

A V3 já estava em turbo ao implantar esse controle. Nenhum benchmark ou novo treino foi iniciado e o modo real foi preservado. A mudança só cria uma forma mais acessível de voltar ao modo leve e liberar CPU depois. Mais paralelismo não garante velocidade proporcional nem melhora de lucro.

Fontes: `web/ui/training-speed.js`, `web/ui/shell.js` e estilos em `web/ui/shell.css`. Funciona somente nas origens locais autorizadas; cópias publicadas/abertas por arquivo não consultam o serviço privado. O componente confirma a identidade do serviço, relê o estado antes de escrever e bloqueia mudanças para treino inativo. Comandos de risco, pausa, reinício e retomada não são expostos por este componente.

Validação: seis testes específicos, incluindo integração HTTP com serviço simulado, clique do usuário, idempotência, recusa de treino parado e de origem externa. Conferência no navegador real em leitura, com turbo já selecionado e modo leve disponível. Nenhum comando foi enviado à execução real durante a conferência.
