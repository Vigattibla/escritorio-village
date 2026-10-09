# Contexto ativo

## Estado (2026-10-07)
- Núcleo jogável pronto e testado no navegador em modo demo: cadastro, criador, escritório, tarefa→XP, chat, pedido entre abas em tempo real, Vila.
- Supabase `escritorio-village` (ref dfqcdyjovwncpvdwvioo) criado; `schema.sql` rodou com sucesso em 07/10/2026; `.env.local` preenchido (publishable key). REST anônimo devolve [] (RLS ok).
- 07/10: mesa aberta (DeskView: cena pixel → 🗂 pasta = Board, 🖥 computador = pedidos), cargos (rank 1-4, set_rank, first_is_boss), status inbox/declined. Testado em demo (`?demo` força modo local).
- Git: repo público Vigattibla/escritorio-village, Pages via Actions (vars VITE_SUPABASE_*), URL https://vigattibla.github.io/escritorio-village/.
- 07/10 (2): detalhe da tarefa (TaskDetail: descrição, início/prazo, colaboradores, anexos no bucket privado `anexos` até 20 MB, notas `task_notes`), rank 4 = Chefe com aba 👑 Geral (Overview). Testado em demo. SQL v3 no fim do `schema.sql`.
- 07/10: crnk.me agora é Vercel; CNAME do user site removido → app em https://vigattibla.github.io/escritorio-village/ (testado, modo real).
- 07/10: SQL v2+v3 rodado no Supabase (conferido via REST); Site URL + Redirect = github.io. Conta atual mantida (mais antiga vira Chefe).

- 07/10 (v4): F0+F1 feitos e commitados local (68f8a6b), NÃO publicados: barra preta Phosphor (bottom tabbar no celular), paleta quente, cartão com prioridade/checklist/rostos/contadores (hot = vence hoje, dark = você aprova), criar tarefa estilo Trello (título + ícones quem faz/prioridade/prazo/lembrete → etiquetas), TaskDetail edita prioridade/lembrete/checklist, lembretes client-side a cada 20s (ev:lembretes:uid), PWA instalável (manifest + ícones, sem service worker). Migração 202610072359_tarefas_f1.sql.

- 08/10: Quadro — caixa de novo cartão não vaza mais da coluna (ec471db, publicado). Backup diário criptografado (backup.yml + scripts/backup.mjs; abrir com scripts/abrir-backup.sh; chave privada em D:\Backups\escritorio-village). Primeiro backup rodou e abriu ok. Anexos do Storage fora do backup. Loja (Almoxarifado) publicada em 84e5dac (ver seção 08/10 loja).

- 09/10: identidade Turmeo aplicada e publicada (b34886f): src/turmeo.css (tokens Recreio por cima, Bricolage forçada, Pixelify só no jogo), src/tenant.ts (nome/logo/acc #26324F/acc2 #FFC600 do cliente), barra lateral branca com TIcon (classe `tic`; `.ti` e `.tcard` colidiam), InicioDesk.tsx = Início desktop (sala ao vivo no topo + Meu dia/Agenda/Pedidos/faixa do Quadro), Início vira padrão também no desktop, Meo na bolha do chat (escondida no celular; chat fica no topo). Backlog funcional: pedidos entre setores, permissões do Drive por setor/cargo, "entregar na mesa".

## Próximo
- 08/10: fila do andar concluída. Nomenclatura por setor + bandeira da porta (cc7d038). Polimento (dcf87bb): sala 24×16 (base.ts MW/MH; parseSala reencaixa layout salvo 30×20 via fitSala), corredor de pedra + passadeira #26324F/#FFC600 + sofá/bancos/canteiros (HALL_OBJS em world.ts, nada na frente de porta), sala sem setor com caixas/móveis cobertos/escada (vacant), capacho na cor (drawMat), placa da porta navy com bolinha + cadeado, popups .game-tip/.game-door novos. Marketing em produção ainda tem layout antigo reencaixado: ajustar em "Arrumar sala" se quiser. Não testado visualmente: popup "Bater na porta" (demo é Chefe, entra em tudo).
0. Usuário aprovar e push (migrate aplica a migração F1). Depois: F2+ do mockup v4.
1. Decidir Auth: confirmar e-mail (hoje ligado) e Site URL (padrão localhost:3000 → trocar). Testar com 2 contas reais.
2. Rodar v2+v3 SQL (sem v3, salvar tarefa quebra: colunas start/collaborators/attachments); Site URL + Redirect = URL do Pages; usuário apaga a própria conta e recria (vira Chefe).
3. Depois: IA, reuniões, sons, mais mapas/decoração.

## Conhecido
- Atribuição de mesa pode colidir se duas pessoas entrarem no mesmo instante.
- Notificações do sistema dependem de permissão do navegador; PiP só em Chrome/Edge.
- 07/10 (3): sem cadastro por e-mail. Login = usuário (vira usuario@escritorio.village) ou e-mail antigo. Chefe cria contas/troca senhas na aba Equipe (Accounts.tsx, RPC admin_create_user/admin_set_password, SQL v4 no fim do schema.sql). Testado no demo. Commit a54d2b3 local.
- 07/10 (4): Adm separado do Chefe. Flag `is_admin` (só servidor grava): adm cria contas, troca senhas e define qualquer cargo. Chefe (rank 4) é outra pessoa. Gustavo = adm, rank 1. SQL v4+v5 rodados (conferido: is_admin true, rank 1; RPC anon = 401). Commit 72556a3 no ar.
- 07/10 (5): banco zerado a pedido (delete from auth.users, rodado pelo Humano). SQL v6: `needs_setup`/`setup_admin` (anon, só com zero perfis) + `create_login` interno. Tela de login mostra 'Primeiro acesso' e a 1ª conta vira adm. Commit 62fe161 no ar (conferido: needs_setup=true, create_login anon=401).
- Gotcha: push em main não disparou o Actions em 07/10; publicar com `gh workflow run "Publicar no GitHub Pages" --ref main` e conferir `gh run list`.
- 07/10 (6): Quadro estilo Trello vira a tela principal (Quadro.tsx). 📋 Quadro / 🏢 Escritório no topo (salvo em ev:view); o escritório fica só para ver. Duas formas de agrupar: Etapas (Pedidos/A fazer/Fazendo/Feito 7d) ou Pessoas. Arrastar muda a etapa, a ordem ou o responsável (canMove/canReassign seguem o guard_task). Atalhos: n = nova, / = busca, q = só minhas. Filtros de pessoa e prazo. Equipe/chat/geral abrem numa gaveta à direita. Na tarefa: '⇄ passar para…'. putTask desfaz a mudança se o servidor recusar. Testado no demo (desktop e celular).
- PENDENTE: Gustavo criar a conta adm no primeiro acesso, depois a da Chefe no painel 🔑; desligar 'Allow new users to sign up' no Supabase (pedir antes); arquivos órfãos no Storage, se houver.
- 07/10 (7): Projetos com mestre (ProjectModal; cria quem é rank≥2 ou adm). Tarefa no projeto → ✓ vira 'review' (⏳ Aprovação) se o dono não é o mestre. Aba ✅ Aprovação (Aprovacoes.tsx): aprovar, ou reprovar com justificativa obrigatória + critérios desmarcados (Revisao.tsx); histórico em `tasks.reviews`. Time do projeto é notificado nas duas decisões. Critérios = do projeto + extras da tarefa. Quadro: etapas coloridas, Raias (pessoa × etapa), barra do projeto, '＋ Colocar alguém no projeto'. Mapa: mesa do Gerente (BOSS_DESK=12, 1º rank 3 em ordem alfabética, tapete, cadeira executiva, placa). Testado no demo em 2 abas (enviar → reprovar → reenviar → aprovar + avisos). SQL v7 no fim do schema.sql. Commit a99ffb0 local.
- v7 rodado em produção em 07/10. Conhecido: o insert de tarefa não barra criar já 'done' num projeto.
- 07/10 (8): IA do Gerente. Botão '✨ Distribuir com IA' no Quadro (rank≥3 ou adm) abre Distribuir.tsx: pedido livre → proposta editável (responsável, prazo, projeto, motivo) → 'Distribuir' chama addTask para cada item. Sem API key: o app grava em `ai_requests` e a ponte no PC (`ponte/ia.mjs`, `npm run ia` ou `ponte/iniciar.ps1`) roda `claude -p --json-schema` com a assinatura e devolve `structured_output`. Batimento em `ai_bridge` (id 'pc') a cada 30 s mostra IA online/offline. Prompt do distribuidor em ponte/distribuidor.md. `node ponte/ia.mjs --teste` roda sem Supabase (sonnet ~10 s). Demo: stub sem Claude. SQL v8 no fim do schema.sql.
- PENDENTE v8: Humano rodar o SQL v8; colar a service_role em ponte/.env.local (modelo: .env.example); deixar a ponte ligada no PC (atalho no Startup só se pedir). Sem a ponte: o app espera 45 s e avisa que o PC está desligado.
- 07/10 (9): roupa 'terno' no avatar (corpo redondo, gravata; pernas 3 linhas, lift a partir da linha 9). Publicado 31b102b.

## 07/10 (10) — IA roda no PC do gerente
- Ponte agora roda no PC de quem usa, logada como a própria pessoa (chave pública + sessão; sem service_role em lugar nenhum).
- Arquivos em public/ponte (publicados): instalar.ps1 (irm | iex), iniciar.ps1 (oculto, atalho na Inicialização), ia.mjs, distribuidor.md; build gera ponte/config.json.
- Sessão em %LOCALAPPDATA%\EscritorioVillage\sessao.json; log ponte.log. Login perdido → código 2, para de religar.
- RLS v8 alterado (update/delete dos próprios pedidos; ai_bridge por usuário). PENDENTE: usuário rodar o v8 novo.
- App: caixa "Ligar a IA neste PC" com o comando quando offline.

## 07/10 (11) — adm edita e exclui contas
- Contas da equipe (adm) → "Editar conta": nome, função, usuário de login, nova senha, cargo, adm. "Excluir conta…" com confirmação e herdeiro (tarefas/projetos vão pra ele; mensagens/notas/pedidos de IA somem).
- SQL v9: admin_logins, admin_update_user, admin_delete_user; guard_task deixa passar a operação interna (set_config ev.admin_op local à transação). Adm não tira o próprio adm nem se exclui.
- Realtime: DELETE de profiles → profileDeleted. Testado na demo; publicado. Pendente: usuário rodar SQL v8+v9 no Supabase.

## 07/10 (12) — redesign etapa 1 (commit 52a125d, local)
- Visual estilo Notion: menu lateral (Quadro, Minha mesa, Aprovação, Avisos, Chat, Equipe, Visão geral p/ chefe; Escritório em "Espaços"). Abre sempre no Quadro.
- Saíram da tela: nível/XP, sequência, meta do dia, ranking, selo de nível no mapa, aviso "subiu de nível" (o XP continua sendo contado no banco).
- Mascote (Vila) fora: `Mascot.tsx` mantido, sem uso. Avisos viraram toast no canto + página Avisos.
- Etapa 2 pendente: escritório reage sozinho (tarefa nova → vai ao quadro e escreve; arquivo → estante; muita demanda → mesa com pilha de folhas), e cada um ainda anda com o próprio boneco.
- Migrações (3596e08) também só local; aguardando "sobe".

## 07/10 (13) — etapa 2 + varredura UI (local, aguardando "sobe")
- Etapa 2 (eeaae5c): `office/errands.ts` observa o quadro → boneco vai ao quadro e escreve (tarefa nova), pega na estante (anexo), guarda na estante (concluída); mesa enche de folhas conforme demanda aberta. Andar com o próprio boneco cancela o trabalho. Testado no ?demo.
- Varredura UI: menu = Quadro · Escritório · Equipe (+ Visão geral p/ chefe). Saíram Minha mesa, Aprovação, Avisos, Chat e o logo V.
- Avisos = sino no topo (popover, contador de não vistos `ev:seen`). Chat = botão flutuante embaixo à direita (dock).
- Aprovação = coluna "Em revisão" + filtro "Para eu aprovar" no quadro (`qApprove`); `setUi({tab:'aprovar'|'chat'|'avisos'})` antigo é convertido.
- Adicionar estilo Trello/Notion: "+ Nova tarefa" só em A fazer/Fazendo; cartão inline com pílulas Quem faz / Prazo. Ícones Lucide em `components/Icon.tsx`.
- Escritório (14): painel lateral sem abas Mesa/Equipe → faixa de pessoas (eu, na sala, fora) e a mesa de quem está selecionado; mesa com ícones e "+ Nova tarefa" inline em A fazer; controles do mapa numa barra branca (Ir para minha mesa · − +); dica do mapa some após 9s.

## 07/10 (15) — redesign v2 (plano aprovado)
- Pedido: visual mais moderno; calendário editorial; metas + recompensas; lembretes; jeito melhor de dar tarefa; etiquetas/ícones/cores novos; mural colaborativo (notas + nós: mapa mental ou sequência); telas de conta/gerência; sala, mesas, personagens e animações refeitos.
- Decisões: cor = MARCA DOMINANTE (navy #0B235D + amarelo #FBC222 fortes; pastel só em etiquetas). Recompensas = selos + comemoração (sem XP/nível) E prêmio real cadastrado pelo gerente ligado a meta. Calendário = posts de rede social (canal, formato, status, aprovação) + prazos/eventos da equipe, com filtro.
- Ordem: F0 sistema visual (mockup p/ aprovar) → F1 tarefas (cartão: prioridade, progresso/checklist, avatares, contadores; dar tarefa com lembrete) → F2 calendário + lembretes → F3 metas/recompensas → F4 mural → F5 conta/gerência → F6 escritório.
- Tabelas novas (F2–F4) via supabase/migrations.

## 07/10 (16) — F0 v3 (design/mockup-v3.html, aguardando aprovação)
- Barra lateral NÃO azul: preta (#141519) ou branca — usuário escolhe. Azul #0B235D só em cartões de marca (meta, "você aprova").
- Paleta: neutros quentes (#F6F5F1 fundo, #E9E7E1 linhas), amarelo #FBC222 único destaque; pastel só em etiquetas.
- Ícones de área: Phosphor (duotone; fill no ativo). Status (Lucide) mantidos — aprovados.
- Início: faixa "Escritório agora" com cada pessoa animada (digitando, puxando arquivo, aprovando, pegando papel, fora).
- Mural vira adesivos: gerente escolhe adesivo, pessoa e posição na tela dela; pessoa fecha/guarda.
- Agenda = aba própria (mês/semana/lista, filtros posts/prazos/eventos + canais, detalhe com aprovar e lembrete).
- Sequência vira Fluxos: nós com responsável e prazo; "Enviar N tarefas" cria uma tarefa por nó.
- Meta animada: anel + contador + marcos + recompensa no fim.
- Gerador: scratchpad build_v3.py (v2 base + v3_tpl + ph.json).

## Mockup v4 (2026-10-07) — aprovado, ajustes no ar
- `design/mockup-v4.html` (build: scratchpad build_v4.py + v4_parts.py, inline office-kit.js).
- Sem azul-marinho e sem verde: paleta quente + oliva (#5C6E22) para feito/aprovado; pulso âmbar.
- Escritório em filme: bonecos pixel reais andando no mapa, câmera em você primeiro e depois em cada um, deslize suave com fade (cena 6,5 s, transição 1,4 s); abas de pessoas clicáveis.
- Rostos pixelados no lugar das iniciais; abas com indicador que desliza; entrada escalonada; barras crescem.
- Celular: Início (filme + barras de story), Agenda da semana, Nova tarefa em folha de baixo.
- Datas corrigidas: Qua 7 / Qui 8 out; semana 5–11.
- Ajustes 07/10 (noite): sala refeita em world.ts (assoalho em tábuas, parede alta com janelas/quadros/relógio, sombras, contorno 1px, estante e plantas encostadas na parede, cadeira do chefe vinho); balão do filme agora é pixel art no canvas (ícones 9x8 em v4_parts.py, some ao andar); pílulas do calendário ocupam a célula com reticências; chat da equipe no painel lateral + botão de chat no celular.
- Decidido 07/10: barra lateral PRETA. Próximo: F0+F1 no app.

## 07/10 (17) — mockup v4 inteiro no app (local, aguardando "sobe")
- DeskView removido. Menu: Quadro · Agenda · Metas · Fluxos · Escritório · Equipe (+ Geral p/ chefe).
- Quadro: "Escritório agora" em filme + coluna Seu dia / Meta / Chat. Adesivos (rank ≥ 2, botão na Equipe).
- Agenda mês/semana/lista com posts (channel + publish_at), Metas com "Meta batida!", Fluxos em canvas.
- Celular: Início + barra de baixo (Início, Agenda, +, Metas, Escritório) + folha "Nova tarefa".
- CSS novo em src/v4.css (depois do index.css). Push exige rodar migration 202610080900_v4_agenda_metas.sql.

## 2026-10-07 — revisão de layout contra o mockup v4 (commit 769b767, local)
Corrigido em todas as telas, desktop e celular. Quadro: filtros numa linha só, colunas cabem na tela, card mostra canal, nota e "Aprovado". Celular: menu "mais" único. Fluxos: objetivo vira nó, Sequência/Mapa, zoom.
Pendente: push (precisa da migration 202610080900_v4_agenda_metas.sql e do secret SUPABASE_ACCESS_TOKEN).

- 2026-10-07: coluna da direita do Quadro refeita (Seu dia com lembrete no cabeçalho, Meta compacta com barra, chat agrupado ocupando o resto). Commit efa4d5e publicado (run 37719134491).

## 2026-10-08 — fase 2 (parte 1) NO AR (deploy 37788439366, 4ac2866)
- Etapas personalizadas no Quadro (tabela `stages`, tipo fixo todo/doing/review/done; migração 202610081000).
- Grupos no chat (`groups`, RPC `group_join`, canal `g:<uuid>`, aberto ou só convidados; migração 202610081100).
- Chat flutuante: `FloatChat.tsx` — bolinha arrastável que encosta na borda, pula + espiadinha na mensagem nova; janela principal e conversas soltas (`Chat fixed=`) arrastáveis/redimensionáveis; posições em localStorage `ev:bubble`, `ev:cwin`, `ev:floats`, `ev:cwin-size:*`. `floatChans` (store) conta conversa solta como vista.
- Lateral: mini chat trocado por `TeamNow` (quem está aqui, no que mexe, feitas hoje; toque abre DM).
- Conhecido: no celular, bolinha arrastada pro topo → janela pode passar da borda de cima.
- Próximo (plano aprovado): 4) lembretes inteligentes no Seu dia; 5) visão do chefe mobile; 6) cafezinhos + Almoxarifado.
- Ideia futura do usuário: importar calendário (e outros) automaticamente com IA interpretando e criando eventos/tarefas.
- 08/10: Drive — aba Arquivos + função `drive` + backup pro Drive prontos no código; falta o usuário criar o OAuth no Google Cloud e colar os secrets no Supabase. Depois: anexar do Drive no TaskDetail.
- 08/10: Drive no ar. Commit 20df898 (main, falta push): pasta do Drive em tarefa/projeto (`drive` jsonb, tarefa herda do projeto; DriveLink guarda crumbs desde a raiz porque a função valida o caminho), FolderBox com miniaturas + envio no TaskDetail, FolderPicker no Composer e no ProjectModal, stepper `.etapas` no topo do cartão (classe `.steps` já existia no Side). Modal da tarefa = Modelo B (commit 403f9d6): `.td2` 1040px, `.td2-main` (título, descrição, checklist c/ barra, pasta Drive, anexos, critérios) | `.td2-side` 320px (`.prop` linhas: pessoas, datas, prioridade, projeto, canal + Conversa); ≤900px vira 1 coluna. No ar desde 08/10 18:35 (run 37825349949).
- 08/10 19h: composer com ícones numa linha própria (125a2e1); card sem projeto pode ir para Aprovação — aprova quem pediu, senão cargo acima (`CHEFIA` em store.ts + migration 202610082000_aprovacao_raia no guard_task) (f112c2b). No ar (run 37828354584). Falta: teste logado do aprovador; "Novo post" no alto da tela não reproduzido (aguardando print).

## 08/10 — Almoxarifado + editor da sala (84e5dac, no ar)
- Cafezinhos: +60 boas-vindas, +10/dia, metas em fases 5/5/5/20 (alvo < 4 só +20); preços 30/60/120/250. Só o servidor credita (migração 202610090900_loja_cafezinhos.sql); máx. 3 metas pagas/mês; meta congelada na criação; card só conta com outra pessoa envolvida; meta manual só o Chefe.
- Editor da sala (SalaEditor.tsx, botão '🪚 Arrumar sala' no escritório, some ≤860px): móveis temáticos, piso, paredes, desfazer, voltar ao original; salva em rooms/escritorio e o jogo troca na hora (syncRoom). Limite 12 mesas + chefia; mesa ocupada/da chefia não sai.
- Quem edita: rank ≥ 3 ou carpinteiro (tabela carpenters, até 4h, dado por rank ≥ 3; can_edit_office no servidor).
- Cadeira inteira vai junto com a mesa (puxada pra trás quando vazia).
- Backup do WIP antigo do main: `git stash list` → 'backup WIP loja antes do merge 84e5dac' (versão velha da mesma loja; pode descartar quando quiser).
- Não testado com 2 contas reais: crédito diário, fases de meta e carpinteiro em produção.

## 08/10 — Salas do andar, fase 1 NO AR (e6d838d, deploy 37852664892)
- Migration `202610091200_departamentos.sql`: tabela `depts` (andar/slot), `dept` em perfis/tarefas/projetos/eventos/metas/etapas/fluxos; RLS por sala; `outranks(a,b)` = Chefe ou cargo maior na mesma sala; `admin_set_dept` move pessoa + tarefas abertas; canal `sala:<id>`; layout `rooms[<sala>]` (Marketing herdou 'escritorio'); cafezinho/metas contam só a sala.
- Store: `state.sala`; tarefas/projetos/linhas filtrados na entrada (`keepTask/keepProject/keepRow`); `team()`, `roomOf()`, `openSala()` (só Chefe), `setDept()`, `saveDept()`, `freeDesk()`. `<Office key={sala}>` remonta ao trocar.
- UI: Contas → "Salas do andar" (criar/renomear/cor, máx. 4) + select Sala em Editar conta; Chefe troca de sala no menu do avatar (banner azul pra voltar); chat ganha "# <sala>" quando há 2+ salas.
- Falta: fase 2 (tela do andar + visita na mesa), fase 3 (pedido entre salas, projeto compartilhado), fase 4 (andar 2/elevador). Segunda área: o adm cria e dá o nome.
