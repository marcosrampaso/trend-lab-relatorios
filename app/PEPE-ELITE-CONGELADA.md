# Elite congelada: piloto pareado de preservação

A G332 da V3 apresentou média de −R$72,98 por carteira simulada de R$1.000: um agente positivo, 182 negativos, 67 sem operações e 180 atingindo o limite global. Entre os 50 possíveis pais havia 49 sem operações. O melhor histórico continuava sendo G91/agente245, arquivado; os membros da população continuavam recebendo treino. Os parâmetros declarativos `eliteFraction` e `anchorEveryGenerations` não produziam preservação imutável dentro do coordenador V3.

Esse diagnóstico motivou uma hipótese específica: preservar os pesos aceitos e treinar descendentes em cópias pode evitar regressões. Não demonstra que os descendentes passarão a lucrar. A V3 e sua meta de 1.000 gerações continuam intactas.

## Protocolo antes do primeiro resultado

- Dois pais: campeão contínuo da V3 recuperado no momento do registro e pai inicial da V3. Cópias imutáveis verificadas por SHA-256 e evidência original. Reavaliação inicial precisa reproduzir score, PNL, drawdown e número de posições arquivados.
- Três sementes por pai; seis pares, total de 12 filhos. Dez rodadas, 1.024 passos por filho/rodada. Mesmos hiperparâmetros, sementes pareadas, ambiente, recompensa, custos de estresse, calendário e regras da V3. Sem mutação nesta ablação.
- **Controle contínuo:** cada filho prossegue dos pesos treinados na rodada anterior, mesmo se regrediu.
- **Protegido:** cada filho treina uma cópia do último modelo aceito. Só adota o candidato se o score da auditoria trimestral superar estritamente o anterior; caso contrário conserva os pesos anteriores, inclusive estado do otimizador. Pesos rejeitados e suas avaliações não são apagados.
- Pais nunca recebem `learn`. São reavaliados em cada rodada; mudança nos tensores ou no score interrompe o estudo. Primeira rodada pareada deve produzir tensores idênticos nos dois braços; divergência invalida a comparação.
- Risco de 1%, limite diário de 3%, global de 10%, escolha 10×/15×, 38 observações e dez ações válidas preservados. Nenhuma ordem real ou alteração automática da V3.

## Calendários e interpretação

Treino usa junho/2023–setembro/2024, excluindo agosto/2024 conforme os dados da V3. Auditoria de desenvolvimento contínua em outubro–dezembro/2024, sempre com carteira independente de R$1.000. CDI bruto vem da mesma referência já reconciliada para esse trimestre. Não compor carteiras entre rodadas nem comparar lucro trimestral com CDI de outro período.

A prioridade são as médias e medianas dos **candidatos brutos**, incluindo rejeitados e agentes sem operações. Também registrar diferenças pareadas por semente/pai, proporção positiva, paralisações por perda, custos e drawdown. O score dos protegidos retidos é monotônico por construção da seleção; isso não prova melhora do aprendizado, e o PNL pode cair se o drawdown melhorar o suficiente no score. A retenção é mostrada separadamente.

Seis pares dependentes de dois pais selecionados são um piloto descritivo. O mesmo trimestre já foi muito usado em seleção; esta rodada não gera validação independente, intervalo de confiança confiável ou prova de lucro futuro. Nenhum dado do antigo teste é aberto. Um teste final novo segue bloqueado. Não haverá busca de parâmetros até obter um resultado desejado, escala automática para 250 nem promoção financeira automática.

## Execução e evidência

Uma faixa adicional de CPU, duas threads. Quando a V3 pedir mais de três workers ou a memória livre ficar abaixo de 20%, o estudo termina o trabalho em andamento, fecha seu worker e aguarda; não pausa a V3. Pausa manual e disco abaixo de10GiB impedem novos trabalhos. `caffeinate` mantém o Mac acordado somente enquanto o coordenador do piloto existir; não altera preferências permanentes ou impede suspensão pela tampa fechada.

Protocolo e inscrição com hashes: `work/pepe-elite-study-v1/`. Resultados por trabalho, recibos de treino, modelos candidatos, evidências dos pais e resumos por rodada são imutáveis. Checkpoint só avança após todos os trabalhos da rodada. Uma retomada reutiliza recibos e resultados verificados, sem treinar novamente um candidato concluído.

- Registrar: `.venv-rl/bin/python scripts/prepare-pepe-elite.py`
- Iniciar/retomar: `node scripts/local-pepe-elite.mjs resume`
- Estado: `node scripts/local-pepe-elite.mjs status`
- Pausar com progresso: `node scripts/local-pepe-elite.mjs pause`
- Painel: http://127.0.0.1:4173/pesquisa-genetica/elite-congelada.html

Testes cobrem rejeição sem alterar o pai, promoção estrita, retenção de regressões no controle, média com caixa/rejeitados, pareamento e respeito à capacidade da V3. A primeira auditoria real verifica a reprodução dos pais antes de aprender com os filhos.
