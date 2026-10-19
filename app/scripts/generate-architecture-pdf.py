"""Render the verified architecture and clearly separate proposed risk research."""
from pathlib import Path
import json
from datetime import datetime
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor,Color
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'output/pdf/arquitetura-trend-lab.pdf'
r=json.loads((ROOT/'web/data/pepe-finrl.json').read_text())
W,H=1080,756
C={'bg':'#0c1725','panel':'#132338','line':'#344c65','text':'#eef4fa','muted':'#acbed1','blue':'#8fbdff','green':'#82dfbd','gold':'#f2c26e','purple':'#c4a5ff'}
c=canvas.Canvas(str(OUT),pagesize=(W,H));c.setTitle('Trend Lab - arquitetura, treinamento e proposta Naive Bayes');c.setAuthor('Trend Lab / Marcos')
styles={}
for name,size,col in [('body',12,'text'),('small',10,'muted'),('caption',11,'muted'),('head',16,'text'),('mini',9,'muted')]:
 styles[name]=ParagraphStyle(name,fontName='Helvetica',fontSize=size,leading=size*1.35,textColor=HexColor(C[col]),spaceAfter=0)
def text(x,y,s,style='body',width=940):
 p=Paragraph(s,styles[style]);ww,hh=p.wrap(width,H);p.drawOn(c,x,y-hh);return hh
def line(x1,y1,x2,y2,color='line',dash=False,arrow=False):
 c.setStrokeColor(HexColor(C[color]));c.setFillColor(HexColor(C[color]));c.setLineWidth(1.4);c.setDash(4,3)if dash else c.setDash();c.line(x1,y1,x2,y2)
 if arrow:
  import math
  a=__import__('math').atan2(y2-y1,x2-x1);size=6;p=c.beginPath();p.moveTo(x2,y2);p.lineTo(x2-size*math.cos(a-.45),y2-size*math.sin(a-.45));p.lineTo(x2-size*math.cos(a+.45),y2-size*math.sin(a+.45));p.close();c.drawPath(p,fill=1,stroke=0)
 c.setDash()
def card(x,y,w,h,title,body,accent='blue',tag=None,dashed=False):
 c.setFillColor(HexColor(C['panel']));c.setStrokeColor(HexColor(C[accent]));c.setLineWidth(1);c.setDash(5,3)if dashed else c.setDash();c.roundRect(x,y-h,w,h,10,fill=1,stroke=1);c.setDash()
 text(x+15,y-14,title,'head',w-30)
 if tag:text(x+15,y-40,tag,'mini',w-30)
 text(x+15,y-(59 if tag else 43),body,'body',w-30)
def page(n,kicker,title,sub):
 c.setFillColor(HexColor(C['bg']));c.rect(0,0,W,H,fill=1,stroke=0)
 c.setFillColor(HexColor(C['green']));c.setFont('Helvetica-Bold',10);c.drawString(40,H-35,kicker.upper())
 c.setFillColor(HexColor(C['text']));c.setFont('Helvetica-Bold',29);c.drawString(40,H-78,title)
 text(40,H-95,sub,'caption',1000)
 line(40,43,W-40,43)
 text(40,31,'TREND LAB  /  19 OUT 2026  /  Pesquisa local, somente simulação  /  Foto do estado no momento da geração','mini',930)
 c.setFillColor(HexColor(C['muted']));c.setFont('Helvetica',10);c.drawRightString(W-40,23,f'{n} / 3')
def done():c.showPage()
def bullet(x,y,title,body,w=290):
 text(x,y,'<b>'+title+'</b>','body',w);text(x,y-25,body,'caption',w)
page(1,'01 / Mapa do sistema','Um decisor por experimento; risco com poder de veto.','Linha sólida: implementação atual. Caixa pontilhada: proposta. Ramos antigos ficam separados para comparação; não são votos extras no PPO.')
card(40,603,223,132,'1. Dados públicos','Binance: preço e mark price de 1 minuto + funding.<br/>PEPE, sem chaves de conta.','blue','IMPLEMENTADO / ARQUIVOS LOCAIS')
card(295,603,223,132,'2. Contexto causal','Candles fechados de 5m.<br/>Tendência 1h e 4h.<br/>15 variáveis de mercado.','blue','IMPLEMENTADO / SEM FUTURO')
card(550,603,223,132,'3. PPO / FinRL','38 observações:<br/>15 de mercado + 23 da carteira.<br/>Dez ações disponíveis.','green','IMPLEMENTADO / PESOS PRÓPRIOS')
card(805,603,235,132,'4. Regras de risco','Risco planejado 1%.<br/>Limite diário 3%, global 10%.<br/>Stops só podem apertar.','gold','OBRIGATÓRIO / NÃO APRENDE')
for x in [263,518,773]:line(x,537,x+32,537,'blue',arrow=True)
# Execution returns on the second row; explicit labels clarify the feedback loop.
card(805,427,235,141,'5. Simulador de futuros','Ação na abertura seguinte (1m).<br/>Taxas, slippage, ticks, funding e liquidação estimada.<br/>Sem fills em minuto sem volume.','blue','IMPLEMENTADO / SEM ORDEM REAL')
line(922,471,922,427,'gold',arrow=True)
card(550,427,223,141,'6. Livro de posições','Patrimônio marcado, drawdown,<br/>custos, parciais e stop móvel.<br/>Melhores e piores pelo líquido.','blue','IMPLEMENTADO / AUDITÁVEL')
line(805,357,773,357,'blue',arrow=True)
card(295,427,223,141,'7. Painel local','Gerações, checkpoints, curvas e ordens.<br/>Botões boost, eco e pausa.<br/>127.0.0.1:4173','blue','CONTROLE AUXILIAR: PORTA4174')
line(550,357,518,357,'blue',arrow=True)
card(40,427,223,141,'Naive Bayes de risco','Observar oportunidades e estimar risco baixo / moderado / alto.<br/><b>Ainda não treinado ou conectado.</b>','gold','PROPOSTA / SEM VETO AO PPO',True)
line(406,471,406,449,'gold',dash=True);line(406,449,151,449,'gold',dash=True);line(151,449,151,427,'gold',dash=True,arrow=True)
text(48,464,'Cópia dos sinais, somente observação','mini',350)
# Wallet feedback known at next decision, not a future-return input.
line(662,286,662,264,'green');line(662,264,1060,264,'green');line(1060,264,1060,621,'green');line(1060,621,662,621,'green');line(662,621,662,603,'green',arrow=True)
text(697,279,'Carteira atual retorna na próxima observação','mini',310)
card(40,234,480,153,'Ramos históricos ETH / BTC','G151: modelos de árvores + seleção genética; estudos de saídas.<br/>Donchian: regras de tendência / day trade + genética.<br/>Notícias + DistilRoBERTa e contexto BTC: módulos separados.<br/><b>Notícias e BTC não alimentam este PPO PEPE.</b>','purple','EXISTENTES / REFERÊNCIAS E OUTROS EXPERIMENTOS')
card(550,234,490,153,'Comparador - não envia ordens ao PPO','CDI histórico + G151 + Donchian + PEPE final.<br/>R$1.000, calendário comum jul/2025-ago/2026, custos base/elevados.<br/>ETH com 10× ou 15× fixo; PEPE com escolha por entrada.<br/>A curva PEPE só aparece depois da seleção congelada.','purple','SAÍDA DE AVALIAÇÃO / ANTES DE IMPOSTOS')
line(520,158,550,158,'purple',arrow=True)
done()
page(2,'02 / Aprendizado e controle','O PPO aprende; o PBT administra a população.','PBT = herdar pesos e alterar parâmetros de aprendizado. É uma adaptação síncrona de Population Based Training, não uma prova de que 250 é um tamanho ideal.')
card(40,600,240,133,'População: 250','Agentes lógicos em fila.<br/>Rede 64×64; pesos PEPE novos.<br/>1.024 passos por membro / geração.','green','META / 1.000 GERAÇÕES')
card(310,600,240,133,'Aprender e medir','PPO treina em episódios de 7 dias.<br/>Todos enfrentam a mesma sondagem de 2 dias por geração.','blue','SOMENTE TREINO + DESENVOLVIMENTO')
card(580,600,220,133,'Selecionar e mutar','Maturação mínima: 5 gerações.<br/>Substituir até os 20% piores.<br/>Novos aleatórios e mutações.','blue','SEM ALTERAR RISCO')
card(830,600,210,133,'Auditoria fixa','Trimestre completo na G1 e a cada 50 gerações.<br/>Arquivar pesos e hashes.','purple','OUT-DEZ/2024')
for a,b in [(280,310),(550,580),(800,830)]:line(a,536,b,536,'green',arrow=True)
line(690,467,690,448,'green');line(690,448,160,448,'green');line(160,448,160,467,'green',arrow=True)
text(285,444,'Herdar pesos; mutar learning rate, entropia, gamma e clip. Nunca escolher pelo teste final.','mini',700)
text(40,410,'Separação no tempo','head')
stages=[('TREINO','jun/2023-set/2024','blue'),('DESENVOLVIMENTO','out-dez/2024','green'),('VALIDAÇÃO','jan-jun/2025','purple'),('TESTE FINAL','jul/2025-ago/2026','gold')]
for i,(title,dates,col)in enumerate(stages):
 x=40+i*255;c.setFillColor(HexColor(C[col]));c.roundRect(x,338,235,39,5,fill=1,stroke=0);c.setFillColor(HexColor(C['bg']));c.setFont('Helvetica-Bold',11);c.drawString(x+12,352,title);text(x,328,dates,'body',235)
text(40,291,'Agosto/2024 fora dos episódios financeiros: dois minutos de mark price ausentes. Setembro/2026 está baixado, mas permanece reservado.','caption',1000)
card(40,253,480,150,'Escolha antes de abrir o teste','Após a G1000: até dez finalistas do desenvolvimento.<br/>Uma comparação na validação: lucro líquido - 0,25 × DD máximo × capital.<br/>Salvar o hash do vencedor; só então avaliar o período final.<br/>Não ajustar novamente olhando esse teste.','purple','MODELO CONGELADO / TESTE NÃO É FITNESS')
card(550,253,490,150,'Estado verificado deste registro',f"Estado: <b>{r['status']}</b>; {r['generation']} gerações completas.<br/>{r['jobsCompleted']}/250 trabalhos da próxima; {r['completedSteps']:,} passos registrados.<br/>Modo eco: 1 worker. Boost: até 3, com 2 threads cada.<br/>Pausa com checkpoint; limite preventivo de 48 horas ativas.",'green','ALVO 1.000 ≠ 1.000 CONCLUÍDAS')
text(40,83,'A tentativa V1 falhou na representação de barras sem volume e foi preservada. A V2 corrigiu as observações e não herda esses pesos. Resultados de desenvolvimento não demonstram lucro futuro.','caption',1000)
done()
page(3,'03 / Proposta de risco','Naive Bayes faz sentido como hipótese mensurável.','Para sinais numéricos, GaussianNB é um ponto de partida. O exemplo de reviews usa outro tipo de entrada; classificação de texto não demonstra desempenho em scalping.')
card(40,600,230,130,'A. Definir a pergunta','Exemplo a registrar:<br/>“Qual a chance de atingir o stop inicial antes de H minutos?”<br/>Separar compra e venda.','gold','PROPOSTA / H AINDA NÃO FIXADO',True)
card(300,600,230,130,'B. Criar rótulos','Guardar cada oportunidade.<br/>Esperar o horizonte terminar.<br/>Rotular com o que ocorreu depois, sem usar esse futuro na entrada.','gold','NÃO TREINAR SÓ NOS GANHADORES',True)
card(560,600,230,130,'C. Ajustar e calibrar','GaussianNB vs regressão logística e regra simples de volatilidade.<br/>Treino no passado; calibração em período posterior separado.','gold','SEM EMBARALHAR O TEMPO',True)
card(820,600,220,130,'D. Observar em sombra','Salvar previsão, probabilidade e resultado.<br/>Sem bloquear ordens, mudar a alavancagem ou o risco do PPO.','gold','NÃO IMPLEMENTADO / NÃO TREINADO',True)
for a,b in [(270,300),(530,560),(790,820)]:line(a,536,b,536,'gold',True,True)
text(40,430,'O que ele pode receber','head',460)
bullet(40,398,'Poucas variáveis com funções diferentes','Volatilidade/ATR, volume relativo, alinhamento 1h/4h, distância da VWAP e direção candidata. Features só do instante da decisão.',450)
bullet(40,309,'O que não podemos inferir dos candles','Não observamos intenção de baleias ou manipulação diretamente. Sem livro histórico, spread e profundidade não viram medidas inventadas.',450)
text(550,430,'O que precisamos medir','head',470)
bullet(550,398,'Probabilidade confiável, não apenas acurácia','Brier score, log loss, curva de calibração e erros por classe. RSI, EMA e MACD correlacionados podem gerar excesso de confiança no Naive Bayes.',470)
bullet(550,309,'Baixo / moderado / alto risco','Faixas e horizonte definidos antes da avaliação. “Baixo” não significa seguro, nem prevê lucro. Risco de stop e retorno líquido são perguntas diferentes.',470)
card(40,206,1000,69,'Se funcionar, abrir um experimento novo','Comparar PPO com e sem esse filtro em período posterior não usado na decisão. Não acrescentar uma variável ao registro atual no meio do treinamento.','green')
text(40,119,'Fontes técnicas e evidências locais','small',1000)
links=[('scikit-learn: Naive Bayes','https://scikit-learn.org/stable/modules/naive_bayes.html'),('scikit-learn: calibração','https://scikit-learn.org/stable/modules/calibration.html'),('PBT: Jaderberg et al., 2017','https://arxiv.org/abs/1711.09846'),('FinRL: implementação oficial','https://github.com/AI4Finance-Foundation/FinRL')]
for i,(label,url)in enumerate(links):
 x=40+(i%2)*505;y=99-(i//2)*18;text(x,y,f'<link href="{url}" color="#8fbdff">{label}</link>','mini',490)
text(40,61,'Base local: pepe-finrl-protocol.json; scripts/pepe_finrl_env.py; scripts/finrl-futures-engine.mjs; web/data/pepe-finrl.json.','mini',1000)
done();c.save();print(OUT)
