# Auditoria retrospectiva G830

Registro consolidado: agente191, +R$330,49 líquidos em12-14nov2024UTC,1 posição15x, encerrada no fim do recorte. Média da população: -R$7,02. Esse agente não é o agente3 que acabou escolhido e ficou inativo no teste final.

Falha de desenho identificada: os pesos de picos fora das auditorias de50 gerações não tinham snapshot imutável. O arquivo originalG830 não foi encontrado. Uma reprodução isolada da linhagem de7 treinos (G824..830) coincidiu com todas as métricas e contagens preservadas. Isso não é recuperação criptográfica dos pesos originais.

Reprodução no trimestre out-dez2024: -R$100,71,13 posições; limite global10% atingido em7out, permanecendo em caixa antes da janela lucrativa de novembro. Auditoria pós-hoc do desenvolvimento, não novo holdout. Não usamos o período final2025/2026 nem alteramos checkpoints, regras ou scores originais.

Relatório: `../../app/web/pesquisa-genetica/pepe-g830.html`. Código de reprodução e geração em `../../app/scripts/`. Os pesos locais reconstruídos ficam excluídos do Git, assim como os dados brutos.
