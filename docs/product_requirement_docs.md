# PRD — Escritório Village

## Objetivo
Escritório virtual da equipe Village Resort, estilo Gather + Trello: cada pessoa tem um personagem chibi em pixel e uma mesa com as tarefas do dia; a equipe vê o que cada um está fazendo, conversa e faz pedidos entre si.

## Requisitos
- Criar conta e entrar na equipe (e-mail + senha).
- Montar o personagem: pele, cabelo, roupa e cores; rosto em pixel ou foto do rosto (opcional, recortada em círculo).
- Escritório 2D em pixel: andar (teclado ou clique), mesas fixas por pessoa, ver quem está online.
- Mesa pessoal: A fazer / Fazendo agora / Feito hoje, prazo, arrastar entre colunas.
- Ver a mesa dos colegas e a tarefa em andamento de cada um.
- Chat: canal Geral + mensagens diretas.
- Pedidos: criar tarefa na mesa de outra pessoa.
- Gamificação: XP por tarefa (+bônus em pedido), níveis, sequência de dias, meta diária, ranking.
- Mascote "Vila" fora da página: janela Picture-in-Picture + notificações do sistema.

## Decisões
- Web: Vite + React + TS, canvas próprio (sem engine).
- Backend: Supabase grátis (auth, Postgres+RLS, realtime, storage). Modo demo local quando sem chaves.
- Sem build de servidor: hospedagem estática.

## Futuro
- IA (resumo do dia, sugestões de tarefas).
- Reuniões dentro do escritório (sala com vídeo/áudio por proximidade).
- Importação automática de calendário e afins: a IA lê o calendário/arquivo, interpreta e cria eventos e tarefas.

## Jogos — atualização 20/10/2026
- Teto aprovado para implementar: 60 cafezinhos por pessoa/dia somando os desafios de todos os jogos.
- Planta sem sala de reunião, lateral incorporada ao salão; arcade, sinuca/cartas e cassino organizados com circulação livre.
- Sala do gerente e bingo preservados; novos jogos e recompensa ficam com o responsável pelos jogos.


- Bingo deve iniciar com uma pessoa (uma ou mais cartelas); rodada sem participantes continua cancelada. Mover o bingo para outra sala é proposta pendente.


## Base executável dos jogos — 20/10
- Sinuca 8-ball: duas pessoas no mesmo aparelho, com mira, força, física, grupos e bola 8.
- Cartas estilo UNO: humano versus computador, ações e escolha de cor.
- Entrada visível por Escritório -> Jogar e conta do cassino; mesas abrem os jogos respectivos.
- Resultados locais não dão cafezinhos nem alteram ranking mensal; multiplayer online, coop e desafios diários até 60 cafezinhos seguem pendentes.


## 20/10 — Sinuca, UNO e baralho com pessoas e bots
- Sinuca 8-ball e UNO: partidas online para duas contas, cada pessoa no próprio aparelho, e modo contra bot. Sinuca mantém opção no mesmo aparelho.
- Baralho: Mau-Mau com 52 cartas/quatro naipes, cinco cartas iniciais, contra bot ou outra conta online; regras resumidas na tela.
- Mesas persistidas no servidor, validação de turno/versão, cálculo de tacadas no servidor, projeção privada das mãos, retomada e saída. Sem aposta ou recompensa nesta etapa.
- Desafios diários com teto total de 60 cafezinhos continuam pendentes.

## Desafios diários nos jogos — 20/10
- Definição executada: um desafio diário em cada um dos sete jogos; 6 cafezinhos por jogo clássico e 12 por vitória online em sinuca, UNO e Mau-Mau. Soma máxima: 60 por pessoa/dia, fuso de São Paulo.
- Jogos clássicos só pagam pontuação positiva validada pelas funções de partida. Jogos online pagam só ao vencedor; abandono não conta. Bot/local em sinuca, UNO e baralho não paga desafio.
- Crédito é idempotente por pessoa, dia e jogo, inserido no extrato por função protegida; demo implementa o mesmo limite. Painel diário mostra sete objetivos, valores e total recebido.
