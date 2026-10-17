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

- 12/10: andar só do setor (no ar, cfc6061; migrate aplica 202610121200_sala_gerente.sql). 6 vagas [setor, cozinha, banheiro, gerente|vaga, jogos, vaga] em src/office/comodos.ts; corredor no meio. Salas com tamanho próprio: dimOf(sala) pelo piso (cozinha 22x16, banheiro 14x12, jogos 28x16, gerente 16x14, setor 24x16); de cima ancoram no corredor (oy = HY0-h), fila curta estica a vaga final. Quem está fora no turno passeia pelos cômodos (idle→go→stay→back); offline à noite >60 min = foi embora. Gerente liga/desliga sala própria (mesa dele sai do setor). Testado no ?demo: 30 pontos alcançáveis, toggle gerente ok. Lint: erros de hooks pré-existentes em Office.tsx/TaskDetail.tsx (não mexidos).
- 12/10 (2): sala de jogos jogável (no ar, 787cb1e; migrate aplica 202610121400_jogos.sql). src/components/Jogos.tsx: Cobrinha (fliperama), Pênalti (pebolim), Memória (mesa-jantar), Reflexo (console/tapete); clique na máquina = jogoAt (world.ts) → boneco anda até o spot + setUi({jogo}). Tabela jogos_pontos id=user:jogo:aaaa-mm, recorde só sobe (gatilho), setor vem do perfil, RLS vê o próprio setor (Chefe/admin veem tudo). Ranking do mês do setor do andar: por jogo e Geral (soma dos recordes). Fix: stopWander apaga balão do cômodo quando o passeio é interrompido.
- 12/10 (3): Plano de marketing (no ar, f91a1c4; migrate aplicou 202610121600_plano.sql). Aba "Plano" (nav após Agenda): src/components/Plano.tsx + src/plano/{xlsx,importar,datas}.ts + plano.css (prefixo pl-). Importa o .xlsx do plano macro no navegador (planilha não vai pro repo): núcleos × meses, faixas do mês (temática/campanha/oferta/persona), legenda de siglas → Responsáveis (sigla → sala + pessoas). Visões Ano (matriz) e Mês (hero editável, estratégia, "Mandar N pro quadro" → addTask no quadro de quem executa, com início/prazo da coluna D via parseDia, id salvo em plano_acoes.tarefas). Edita: adm, Chefe, sala marketing (edita_plano); todos veem. Testado no ?demo: 12 meses, 23 núcleos, 700 ações, 15 siglas; 375px sem overflow.
- 12/10 (4): 5814281 (no ar). Dialogo.tsx: confirmar()/pedirTexto() substituem confirm/prompt do navegador em todo o app (Plano, Quadro, Chat, Fluxos, SalaEditor, Arquivos, DriveFolder). Plano: agrupar "Por quem faz" (padrão, localStorage pl-agrupa) | "Por núcleo"; Mês = colunas por sigla (chave(): sigla inteira se está na legenda, senão a 1ª; cor fixa corSig), equipe editável no cabeçalho, progresso, Mandar N, arrastar cartão livre troca resp; Ano = linhas por responsável (cabeçalho sticky) após datas; filtro responsável / Só as minhas; Legenda em grade de cartões.
- 12/10 (5): Plano na Agenda + Equipes (no ar, b57c8c6; migrate aplicou 202610121800_plano_agenda.sql). src/plano/core.ts (membros/candidatos/distribuir/cargaSemana/comecar), AgendaPlano.tsx (PChip fantasma tracejado, SemDia, PlanoPainel/Modal, VisaoEquipe, VisaoEstrategia, useAutoPlano em Office.tsx), agenda.css. Ação com dia aparece na Agenda; dono auto = sigla → equipes/pessoas → menor carga da semana; arrastar muda dia (plano_acoes.data), carinha troca dono (plano_acoes.dono); texto original intocado; vira tarefa sozinha na semana dela ou pelo Começar (RPC plano_reservar evita duplicar). Modos Mês/Semana/Lista/Equipe/Estratégia (12 meses, faixa de datas, raias por stakeholder com cor/ícone, menu ⋯ fixo fora da grade, zoom do mês). Equipes (tabela equipes, Equipes.tsx): gerente da sala/Chefe/adm marcam; sigla aponta pra equipes (plano_resp.equipes); Quadro filtra por equipe e mostra etiqueta na raia. Testado no ?demo 1440 e 375.
- Futuro (pedido 12/10, não começar sem pedir): competição mensal — maior Geral do mês ganha cafezinhos (dados por mês já existem em jogos_pontos).

- 15/10: elevador no canto esquerdo do corredor (6d35bef): KIND 'elevador' (sala.ts), elevadorAt/elevadorSpot (world.ts), lista de setores → openSala(id, true) chega na frente do elevador (chegada.elevador em andar.ts); openSala deixa qualquer um ir pra sala aberta (antes só Chefe). Portas sem placas de nome e sem bandeiras (pedido do usuário). Ctrl+B (2b242f3): listener global em textarea envolve seleção com **…**; <Negrito> (components/Negrito.tsx) mostra na descrição (TaskDetail mostra renderizado e vira textarea ao clicar), cards, Início, pedidos, Redes, Relatório.

- 16/10: Abas do setor (051e1b8; migrate aplica 202610261200_abas_parcerias.sql). Perfil → "Abas do setor" (AbasSetor.tsx; gerente da sala/Chefe/adm): liga/desliga Agenda/Plano/Publicações/Arquivos/Pedidos/Legendas (depts.abas; padrão Marketing=todas, outros=agenda/arquivos/pedidos; Início/Quadro/Escritório fixas). Parceria (tabela parcerias, RPC parceria pedir/aceitar/recusar/sair, devolve a linha): setor pede pra acompanhar agenda/plano/redes de outro; gerente de lá aceita; itens do parceiro em state.parc (fora do Quadro), só leitura, marcados com a cor/nome do setor na Agenda (ParcCard + "Mandar pedido") e em Publicações. RLS de tasks/events usa parceiro(). Testado no ?demo (pedir→aceitar→item do Comercial na Agenda do Marketing). Sem gerente no setor dono → botão de pedido some (demo Comercial não tem).

- 17/10: poderes da semana (fe6ed97; migrate aplicou 202610281000_poderes.sql; Escudo virou Mesada), montagens (33ae727), pedido sem gerente (7365f64), UI por tipo de setor (379bb9b, src/setor/tipos.ts). Salas por tipo (9d46e30): MODELOS/MODELO_DO_TIPO em sala.ts (padrao, central, ilhas, obra, oficina, rouparia, aberto) + móveis quadro-kanban/painel-tela/mural-ocupacao/planta-obra/mesa-planta/bancada-ferramentas/carrinho-rouparia/cone-obra; editor tem select "Montar modelo". Andar (36b9375): 'reuniao' no lugar da vaga (sem sala de gerente), menos plantas nos cômodos/corredor. Próximo: APK casca WebView abrindo o site (atualiza com push), depois varredura de UI/UX.

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

## 09/10 — Turmeo rodada 2 (no ar: 15aeaa5, 8ab3997)
- Início em grade fixa, sala com "Bater na porta", logo do cliente (upload), Mais recolhível, Meo encostado na borda no lugar da bolinha do chat ("Miau! Falar com quem?").
- `src/prefs.ts`: preferências por aparelho (localStorage `ev:prefs`): `dev` (padrão off) e `destaque` (padrão on).
- Modo desenvolvedor (menu do perfil / menu Mais no celular): mostra Equipe, Geral, Salas do andar e troca de logo. Desligado = ocultos.
- Quadro: chip "Destacar minhas" (cartão amarelo claro + contorno acc2); botão Relatório.
- Relatório da semana (`components/Relatorio.tsx`): por pessoa, concluídas/ajudou/em aberto/atrasadas/refeitas, navega semanas, imprime/PDF.
- Arquivamento: coluna Feito mostra só a semana atual (desde segunda); semanas anteriores ficam só no Relatório. Sem migration, nada apagado.
- Nav: só a página atual ganha a pílula navy; chat aberto = fundo leve (`.aberto`).
- Pendente: remake do chat (Chat.tsx/tc-*), remake de Arquivos.
- 12/10 (6): modal Equipes via portal + feedback Pablo (canto, ordem por data, nome em pé, exemplos de equipe) — no ar (a4c0c87).
- 12/10 (7): todas as janelas (.modal-bg) via portal Fundo.tsx + altura por % do fundo (sem vh/dvh, Opera espremia); nome em pé quebra linha.
- 12/10 (8): cartão do plano na cor da sigla (quem faz); hover na sigla mostra o significado; nota na Legenda.
- 12/10 (9): 06d0fcb Fundo mede e corrige em px (top/left/width/height) quando a caixa do fixed não bate com a tela (Opera GX do usuário espremia; GX limpo ok). Modal do plano usa Fundo. No ar (run 38294571811). Falta usuário confirmar no GX.
- 12/10 (10): causa real das janelas espremidas = extensão FastSave injeta .modal{position:fixed;top:0;height:0vh;overflow:hidden}. Classe modal→jan. Nunca usar nomes genéricos (modal, popup…) em classe.
- 12/10 (10) no ar (run 38295299498: build/deploy/migrate ok; job functions falhou 2x com erro 500 interno do Supabase, sem mudança em functions).
- 12/10 (11): src/avisos.ts (checagens no checkReminders, a cada 20s): datas comemorativas a 7 dias e véspera (quem edita o plano); ação do plano sem tarefa a 7 e ≤2 dias; tarefa minha amanhã/hoje/atrasada (até 3 dias). Dedupe em localStorage ev:avisos:<id>, máx. 4 por rodada.
- 12/10 (12): Pessoas (plano/ui) mostra só o setor (sala da ação/equipe ou o meu); demais em "Outros setores (n)", agrupados por sala.
- 12/10 (13): Relatório individual: abas por pessoa (abre em mim) + "Equipe toda"; cada tarefa concluída vira card com a descrição (notes) e itens do checklist feitos; sem descrição, quem pode editar escreve ali (salva em notes). Imprimir sai só da pessoa escolhida.
- 12/10 (14): b87d014 + 778c931 + 6e37e42 no ar (run 38297037593, todos os jobs ok).
- 12/10 (15): c753e17 avisos com tipo (kind no Notice: rótulo+ícone Phosphor+cor em Avisos.tsx TIPOS), toast "+N avisos" p/ lote, sino com Novos/Anteriores + Limpar; aceitar pedido → doing.
- 12/10 (16): Relatório individual > "Texto do relatório": pessoa escreve resumo livre, Gemini junta com tarefas/descrições (supabase/functions/relatorio-ia, deploy no job functions; src/data/ia.ts; demo devolve texto de exemplo). Secret GEMINI_API_KEY (usuário grava; nunca no site), GEMINI_MODEL opcional (padrão gemini-flash-latest). Texto editável, Copiar, sai na impressão.
- 12/10 (17): Impressão do relatório cabe em 1 folha (0ab9bc1): com texto da IA, tarefas viram 2 colunas só com título; beforeprint aplica zoom = 273mm / altura. Tamanho do texto pelo volume (função tam: 120–480 palavras); maxOutputTokens 8192 + erro se MAX_TOKENS (texto cortava no meio). Deploy manual ok. Push no main liberado sem pedir.
- 12/10 (18): Relatório: ícone calendário nas setas abre de/até (per; "em aberto/atrasadas" só na semana atual). Último texto da IA salvo por pessoa no localStorage (rel-ia:<id>), "Último relatório salvo … Abrir" leva ao período dele (95d41a3). Só no navegador; se quiserem entre PCs → tabela no Supabase.
- 12/10 (19): Agenda mês: dia mostra tudo com rolagem (.mitens.rola, 8cf41f7); "Também no dia" rola >4 (.ag-outros). Equipes sugeridas = lista do Pablo: Comercial, Agentes de viagem, Edição de vídeo, Design, Performance (Tráfego Pago), Social Media (3aa46b0). Marcas citadas por ele: Casa de Campo, Meu Destino, Village Convention, Village Resort (destino ainda não definido).
- 12/10 (20): Colaborador vê a tarefa como dele: comigo(t,uid) em store.ts (dono ou collaborators). Quadro por pessoa/raias (tag "Colabora" com hand-heart; arrastar na própria linha não reatribui), Meu dia (InicioDesk), Início celular, lateral. Pedidos/concluídas hoje seguem só do dono (dd9ae5c).
- 12/10 (21): Último relatório da IA no banco: tabela `relatorios` (1 linha por pessoa, sobrescreve; migration 202610122000), grava a própria pessoa, quem está acima ou adm (`grava_relatorio`). Relatorio.tsx usa o mais novo entre banco e localStorage; putRow com 1,5 s de espera (c649cdd). Pendente: marcas = produtos (Casa de Campo, Meu Destino, Village Convention, Village Resort) → proposta campo Produto na tarefa + filtro.
- 12/10 (22): Conta criada pelo adm caía no Marketing (default da coluna dept). Agora o form Contas tem select Sala (adm; padrão = sala aberta) → admin_create_user(..., p_dept) (migration 202610122100, 7e69881). Quem já entrou errado: adm muda em Contas → Sala.
- 13/10 (23): Fotos do Drive (adm): botão em Arquivos → Acervo.tsx. Função drive ganhou acervo (fotos/pastas do Drive todo, 1000 por página, allDrives) e athumb, só is_admin. Organiza por produto (regex no caminho), ano (EXIF ou criação), pasta; repetidas por md5. Índice no IndexedDB do navegador. Só leitura (b38ec5f). Próximo: usuário escolhe o que liberar pra equipe.
- 13/10 (24): Pablo: etapas padrão A fazer · Em andamento · Aprovação · Reprovado · Aprovado · Concluído (reprovar/aprovar mandam pra etapa pelo nome). Quadro = Kanban do setor: equipe abre na de quem entra; inclui tarefas do plano cuja sigla liga à equipe (resp.equipes ou nome igual); filtro Plano + gerais / só plano / só gerais. Conta nova ganhou Setor. Futuro: pedido entre setores cai no funil da equipe + notificação de entrega.
- 13/10 (25) Funil do setor (c941c15): migration 202610132000_funil_setor (tasks.equipe, tasks.avisar, guard_task deixa gestor repassar dentro da sala). Quadro com setor escolhido → botão Pedir ao setor (requestTo 'eq:<id>') → tarefa inbox no gestorDe(equipe); card mostra Passar para… (repassar → todo). Avisar quando aprovado: chips no pedido + campo Avisar no detalhe; notify no onTask ao virar done (só quem está com o site aberto).

## 13/10 — LinkedIn + funil por setor
- 220bd26 LinkedIn: canal 'linkedin'; tarefa aprovada (última revisão ok + done) entra em `postagens` e sai na data (pg_cron 5 min / pg_net na hora). Função `linkedin` (conectar OAuth, /callback, /tick, agora). Tokens cifrados em social_tokens. Caixa LinkedInBox no TaskDetail.
  - Pendente humano: app no LinkedIn, redirect `https://dfqcdyjovwncpvdwvioo.supabase.co/functions/v1/linkedin/callback`, secrets LINKEDIN_CLIENT_ID/SECRET; depois da aprovação do Community Management: LINKEDIN_MODO=empresa.
- b98b74d Funil por setor: pedido ao setor fica na faixa "Funil · Equipe" no topo do quadro; qualquer um da equipe "Pegar pra mim", gestor "Passar para…". Tarefas do plano seguem iguais. Migration 202610141000_funil_pegar (na_equipe, policies, guard_task).

### 13/10 (tarde) — aba Redes + funil por setor
- Aba **Redes** (src/components/Redes.tsx): conta LinkedIn, "Novo post" (tarefa canal linkedin), colunas produção/aprovação/agendado/publicado/não saiu.
- Funil: a tarefa puxada continua no funil da equipe ("Fazendo: nome", feitas da semana); por padrão só o setor da pessoa, botão "Todos os setores" (pref funilTodos). Sem setor ou com filtro de equipe: vê tudo.
- Não testado no navegador.

### 13/10 (noite) — aba Redes vira Publicações
- Menu e cabeçalho "Publicações" (id interno continua `redes`). Lista todo post com canal; filtro por rede (Instagram=feed/reels/stories, Facebook, LinkedIn, Site) com contagem.
- Contas por rede: LinkedIn conecta e publica sozinho; demais "Postagem manual" (concluída com data futura = Agendado, senão Publicado). Coluna "Não saiu" só aparece se houver.
- Novo post = cartão inline no topo de Em produção, com escolha do canal. Cards com capa (1ª imagem) ou capa vazia na cor da rede.
- Visual segue referência limpa (Sinta, enviada pelo usuário 13/10): capa no topo, corpo cinza claro, botão com borda escura. Só nesta aba por enquanto.
- Testado no ?demo (desktop e 375px sem overflow).

## 13/10 — LinkedIn: app criado, modo empresa aguardando aprovação
- App 1 "Escritório Village" (264982645): Share + OpenID liberados, callback salvo. Secrets LINKEDIN_CLIENT_ID/SECRET são DESTE app.
- Usuário NÃO quer postar no perfil pessoal: conexão pessoal apagada (redes/social_tokens), LINKEDIN_MODO=empresa.
- App 2 "Escritório Village - Página" (264986610), página Village Resort verificada; pedido Community Management API (Development Tier) enviado 13/10 — aguarda e-mail da LinkedIn/Microsoft Vetting no e-mail corporativo.
- Quando aprovar: callback no Auth do app 2, trocar LINKEDIN_CLIENT_ID/SECRET pro app 2, adm da página conecta em Publicações.
- Bug visto: após OAuth a aba mostrou "Não conectado" com linha já gravada em redes (provável tela sem recarregar) — conferir no próximo conectar.

## 13/10 — Cassino dos cafezinhos (2352339)
- Migration 202610142000_cassino: tabela cassino_rodadas + RPCs SECURITY DEFINER cassino_jogar (caça-níquel/roleta/crash), cassino_abrir/cassino_acao/cassino_estado (blackjack/minas). Lança no coffee_log com reason 'aposta'/'premio'; saldo via cafe_saldo(). Aposta 1–100.
- Regras: caça-níquel 7 símbolos com pesos (3 iguais 4x–100x, 2 iguais 1x–8x); roleta europeia (número 36x, cor/par/metade 2x, dúzia 3x); crash alvo 1,01–100x, 3% da casa; blackjack paga 2,5x no natural, banca para em 17, dobrar; minas 1–24 em 5×5, mult com 3% da casa, sacar.
- Telas: src/components/Cassino.tsx + cs-* no index.css; motor espelho da demo em src/cassino/regras.ts (classe Mesa). Rodada aberta de blackjack/minas é retomada.
- Entradas: menu do avatar, Mais (MoreMenu) e botão "Apostar no cassino" na Loja.
- Testado: demo nos 5 jogos (desktop + 375px), migration em begin…rollback no Supabase real. Aviso na tela: só diversão, cafezinho não vale dinheiro.
- Sala de jogos (7beb42e): 28x16 com canto do cassino (tapete, 4 caça-níqueis, roleta, blackjack, totens crash/minas, caixa de fichas, letreiro, máquina de latinhas) + lanchonete. Clicar na máquina abre o Cassino no jogo certo (MAQUINAS.cassino em world.ts → ui.cassino string). Pendente: loja de latinhas (roupas/animações/tacar papel), elevador, roupas iniciais/loja.
- Bolão + latinhas ⚡ (9439209, migration 202610150900): pote = 30 + ganho líquido da casa na semana + 15/bilhete comprado + acumulado; sorteio sexta 17h Brasília, preguiçoso (bolao_estado dispara bolao_sortear com trava); 1º sorteio 16/10. Bilhetes: fase 1, meta 2, compra 15 (máx 5). Prêmio: pote + min(10, 3+pote/50) latinhas + 1º raro que não tem (trevo, pote-ouro, trono-sortudo; compra de 0). Latinhas: latinha_log, troca 150 → 1 (2/semana). UI: aba 🍀 Bolão no Cassino (Bolao.tsx, bl-*), roleta de nomes, aviso via checarBolao() no store (localStorage ev:bolao:visto), Loja mostra ⚡ e "Só no bolão". Espelho demo: src/cassino/bolao.ts (BolaoDemo).

## Próximo (14/10)
- Abas Conversa/Peças + Vídeo & Motion são do Estúdio CRNK (D:/Projetos/estudio), não do Turmeo; plano em `docs/plano-estudio-abas.md`. Chat do Estúdio no Turmeo só com modo desenvolvedor.

## 14/10 — Conectar IA + barra do jogo
- Conectar IA no ar (7a38b76): chaves pessoais, função `tarefas` (MCP /, webhook /nova, e-mail /email?t=). Falta teste ponta a ponta com chave real e escolher serviço de e-mail de entrada.
- c410a4b: barra de cima do jogo removida (zoom = roda do mouse; porta/cortina/sala do gerente no popup da porta); bolão/bingo viraram lembrete rápido no canto.
- Próximo sugerido: link de tarefa pré-preenchida (`?nova=...&para=...&prazo=...`) pra qualquer IA, mesmo fraca, gerar; o humano clica e confirma logado.

## 14/10 — Pedidos ao gerente + menus enxutos
- Pedidos (Mais → Pedidos): material / folga / outro; material pode ser lista coletiva do setor (cada um põe seus itens, data de fechamento opcional); +1 "Eu também". Gerente da sala (rank 3), Chefe e admin aprovam, recusam (com motivo), marcam entregue e reabrem; quem pediu cancela. Histórico só o servidor escreve, sem delete. Folga só autor + gerente veem.
- Tabela `requisicoes` + RPC `requisicao_mudar` (migration 202610211000). Criar = insert direto; o resto só via RPC. Avisos no store (`avisoReq`).
- Menus: o perfil fica só com o essencial. Metas, Fluxos, Cassino e Bingo foram para "Mais" (recolhido). No celular, a aba Metas virou Quadro.
- Pendente: testar aprovação com um gerente de verdade depois que o migrate rodar.
- 817ac40: o Chat virou bolinha no canto (o gato saiu). Metas, Fluxos, Cassino e Bingo saíram do Mais (Cassino segue no Almoxarifado e no jogo).
- 14/10 5d87261: Pedidos pessoais só autor+gerente; coletivo para a sala; +1 só coletivo (migration 202610221000).

### 14/10 — Estúdio vira painel dentro de Publicações (7f188a4 + 8f5cbc5)
- Aba Estúdio saiu do menu; Publicações ganhou botão "Pedir arte" (badge amarelo = peças pra aprovar) que abre painel lateral (abas Aprovar / Pedir arte / Conversa se dev). Coluna "Em aprovação" avisa peças do Estúdio esperando. Página 'estudio' antiga abre Publicações com o painel.
- Permissão igual: painel só adm ou rank ≥2. Abaixo de 900px vira folha de baixo com fundo escuro (toque fora fecha). Estado aberto/aba em localStorage `rd-estudio`.
- Pendente: no menu do celular não há item Publicações (só pela barra lateral do desktop) — decidir com o usuário.

## 14/10 — Anti-robô no login (defbafc)
- Turnstile (Captcha.tsx) + captchaToken no signInWithPassword; liga só com var VITE_TURNSTILE_SITEKEY.
- Ordem: 1) var no GitHub + deploy  2) só depois ligar captcha no Supabase (senão ninguém entra).

## 14/10 — Vigia dos jogos (anti-automação)
- Migration 202610231000_jogos_vigia.sql: trigger before insert em jogos_partidas, cassino_rodadas, bingo_cartelas → tabela jogos_vigia.
- Regras: 25 partidas/60s → 1h; partida em 100 dos últimos 120 min → 3h; 240 min no dia → até 06h. Bloqueio derivado do log (raise desfaz a transação, então nada é gravado no erro).
- Erro `BLOQUEIO_JOGOS|ate|motivo` → store.vigiado → BloqueioJogos.tsx (alertdialog com aviso explícito pra IA, PT+EN). RPC jogos_bloqueio() checada ao abrir jogo/cassino/bingo. Espelho demo: src/game/vigia.ts (ev:vigia:<id>).
- 15/10: Raias também editam etapas (a752cc9): ⋯ no cabeçalho da coluna (renomear/mover/excluir vazia) e chip ＋ Nova etapa ao lado de 'Colocar alguém'; só canEditStages (rank≥2 ou adm). Testado no demo.

- 15/10 (1b1a3a9): etapas do Quadro editáveis por rank>=2 — ⋯ nome/tipo/critérios/mover/excluir, ＋ Nova etapa no fim (direita); critérios = checklist ao entrar (entrada.ts + conferir no Dialogo); coluna stages.criteria.
- 15/10 (af4afa4): Publicações → LinkedIn mostra calendário editorial (src/data/calendarios.ts, 15 posts 19/10–19/11); botão rank>=2 cria posts em Em produção com publish_at 9h e briefing no checklist (legenda vazia, porque LinkedIn publica sozinho após aprovação). Outras redes: novo item em CALENDARIOS.

- 15/10: Legendas com IA (0641380, publicado; functions/migrate/build/deploy ok). Mais → Legendas: vídeo vira 12 quadros JPEG + áudio WAV 16 kHz (≤120 s) no navegador; função `legenda` manda inline pro Gemini (GEMINI_API_KEY já existia) com o guia da tabela `marcas_voz` (seed meudestino, migration 202610251000). 3 opções + hashtags, copiar, ajuste/outra versão; formatos reel/carrossel/stories/post. Guia editável por rank≥3/adm (botão "Identidade da marca"). Nova marca = insert em marcas_voz. Testado no demo; teste real com Gemini pendente (pessoa logada).
- 16/10: Quadro alinhado no topo, colunas altura cheia (soltar em qualquer ponto), filtros Entrega/Criação/Prioridade.

## 16/10 — 2f511c0
- Armário de pastas: slot `arquivo` (aço 400 / madeira 450, preço próprio no catalog Row[4]); migration 202610261000. Desenhado à esquerda da mesa (drawArquivo em props.ts); folhas além de 2*PILE vão pra dentro em vez do chão.
- Montarias sentadas: `pernas()` em bichos.ts desenha coxas/sapatos (antes era só tronco).
- Relógio de parede (sala.ts `relogio`): hora/minuto/segundo reais de Brasília.
- clima.ts `tempoReal()`: Open-Meteo Jaboticatubas (-19.51,-43.75), a cada 15 min; chuva/nublado reais; sem rede cai no sorteio.

## 16/10 (tarde)
- Bolão: bilhete 1 ☕ (22c5ca4, migration 202610261300). Bingo: cartela 1 ☕ + casa põe 10 no pote (026ec87, 202610261310).
- Montarias redesenhadas (582eb7d): bicho maior com manta, de frente cabeça no colo, pernas do cavaleiro finas.
- Pendente: habilidade temporária "roguelike" (semanal/evento); spec anterior não achada; proposta enviada ao usuário.

## 17/10 — setores personalizados + app celular (no ar)
- APK: 5f2eef2 (site/app/escritorio.apk) · escritorio-celular 1c401f3 (WebView do site publicado; atualiza sozinho).
- c7702a2: módulos novos por setor + menu "Da sala" no celular. Escudo virou Mesada.
- 85d1fb5: demo com Obras/Governança/Recepção/A&B (andar 2), emblemas martelo/cama/sino/xícara/chave/livro, obra mostra % do orçamento gasto (alerta quando passa do avanço), abas do hero rolam e centralizam a sala atual, Semana rola até hoje.
- Próximo: varredura UI/UX restante (Grade no celular, Escala A&B), remontar layout dos andares.

### 17/10 (cont.) — salas por tipo de setor
- c45a47a: modelo `cozinha` (A&B: fogão industrial, bancada inox, geladeira, lousa do cardápio) e `reuniao` (RH: mesa de reunião + sofá). MODELO_DO_TIPO agora cobre todos os tipos menos geral.
- Modelo só vale pra sala sem layout salvo (parseSala cai no original(modelo)); sala já arrumada mantém o que tem.
- Próximo: conferir sala RH num setor real; varredura de UI no celular (Grade/Quadro).
- Pente fino celular: Mais → "Da sala" lista os módulos da sala atual (abasDe) menos o 1º, que vai na barra de baixo — vale pra todo tipo de setor, sem mudança.
- f5bb675: barra do celular encurta nome de módulo longo ("Cardápio da semana" → "Cardápio"); seedSetores não duplica registros ao semear de novo; escala A&B cobre seg–dom.
- Conferido no celular (demo): Quartos (grade), Escala, Obras (kanban rola na horizontal com a próxima coluna à vista) — ok.
- 9e1fd0d: demo ganha 3º andar (seedAndar3, guarda `!depts.reservas`): Central de reservas, RH, Manutenção, Recreação com registros em todos os módulos; compras de obras com status válido (pedido). Semana (.md-sem) cabe inteira no desktop (minmax 108, coluna minmax(0,1fr), data dd/mm).
- 9f27f1d: kanban dos módulos minmax(210px) → 4 colunas cabem em 1280.
- Conferido: Reservas (kanban), Contratações (celular), Programação, Chamados, sala central (fileiras de mesas).
- 0a3bd26: no Quadro a câmera "Escritório agora" começa recolhida (botão Ver câmera/Recolher, guarda em `ev:live:aberto`; recolhida não roda o ciclo de pessoas) — quadro aparece sem rolar. Adesivo do demo nasce no canto (x/y 0.95). Sala oficina (Manutenção) conferida.
- 4a29313 + b07e85b: módulos com entrada/saída (Chegadas, reservas, grupos) têm faixa Hoje (chegam/saem/na casa/amanhã, clicável como filtro); módulos kanban com prazo (Obras, Compras, Chamados, Contas, Funil) têm faixa de prazos (atrasados com valor, hoje, 7 dias, sem data) — some quando não há nada a mostrar.
- 074b0c3 + 9f26ffb: kanbans de chamado (Manutenção, TI) têm faixa Fila (em aberto, urgentes, parados 3+ dias, resolvidos hoje); Pedidos do hóspede têm (em aberto, passou do horário, sem ninguém, atendidos hoje) — vermelho quando há algo a resolver.
- ff81ec2: Eventos tem faixa Agenda (em 7/30 dias, em negociação, fechados, com valor); faixa de prazos vale também em listas (Retornos); demo semeia a sala Comercial (funil, eventos, retornos) via chave ev:seed:comercial.
- 7b95bb2 + cfe9b0b: faixas próprias por módulo via FAIXAS (Modulo.tsx) — Contratações (em processo, entrevistar, começam em 7 dias, contratados no mês) e Férias (fora hoje, saem em 7 dias, esperando resposta, sem quem cobre). Semana (programação/escala/cardápio) ganhou barra "N hoje · A seguir" que abre o item.
- ad4b5d7: FAIXAS.achados (guardados, +30 dias em alerta, sem dono, devolvidos no mês) + seedAchados na demo (recepção). Faixas novas conferidas a 375px sem rolagem lateral.
- 43d5b60 + 4afc8f0: modelos de sala novos em sala.ts — Recepção de hotel (balcão em 2 fileiras + lobby com sofás) e Sala da recreação (bancadas + roda de pufes); MODELO_DO_TIPO recepcao/recreacao apontam pra eles. Vale só pra sala sem layout salvo (ou Arrumar sala → Montar modelo).
- a9bda6b: modelo Sala de TI (bancada de monitores + 4 racks com LED piscando + telão) e objeto novo rack-servidor no catálogo; MODELO_DO_TIPO ti → ti. Financeiro segue no Open office.
- e6418d5: modelo Sala do financeiro (bancadas de 2 em 3 fileiras, 4 arquivos na parede, calendário); MODELO_DO_TIPO financeiro → financeiro. Agora todo tipo de setor tem sala própria (geral = clássico).
