# Contexto ativo

## Estado (2026-10-07)
- Núcleo jogável pronto e testado no navegador em modo demo: cadastro, criador, escritório, tarefa→XP, chat, pedido entre abas em tempo real, Vila.
- Supabase `escritorio-village` (ref dfqcdyjovwncpvdwvioo) criado; `schema.sql` rodou com sucesso em 07/10/2026; `.env.local` preenchido (publishable key). REST anônimo devolve [] (RLS ok).
- 07/10: mesa aberta (DeskView: cena pixel → 🗂 pasta = Board, 🖥 computador = pedidos), cargos (rank 1-4, set_rank, first_is_boss), status inbox/declined. Testado em demo (`?demo` força modo local).
- Git: repo público Vigattibla/escritorio-village, Pages via Actions (vars VITE_SUPABASE_*), URL https://vigattibla.github.io/escritorio-village/.
- 07/10 (2): detalhe da tarefa (TaskDetail: descrição, início/prazo, colaboradores, anexos no bucket privado `anexos` até 20 MB, notas `task_notes`), rank 4 = Chefe com aba 👑 Geral (Overview). Testado em demo. SQL v3 no fim do `schema.sql`.
- 07/10: crnk.me agora é Vercel; CNAME do user site removido → app em https://vigattibla.github.io/escritorio-village/ (testado, modo real).
- 07/10: SQL v2+v3 rodado no Supabase (conferido via REST); Site URL + Redirect = github.io. Conta atual mantida (mais antiga vira Chefe).

## Próximo
1. Decidir Auth: confirmar e-mail (hoje ligado) e Site URL (padrão localhost:3000 → trocar). Testar com 2 contas reais.
2. Rodar v2+v3 SQL (sem v3, salvar tarefa quebra: colunas start/collaborators/attachments); Site URL + Redirect = URL do Pages; usuário apaga a própria conta e recria (vira Chefe).
3. Depois: IA, reuniões, sons, mais mapas/decoração.

## Conhecido
- Atribuição de mesa pode colidir se duas pessoas entrarem no mesmo instante.
- Notificações do sistema dependem de permissão do navegador; PiP só em Chrome/Edge.
