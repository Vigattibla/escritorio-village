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
