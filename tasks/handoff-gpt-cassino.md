# Handoff: conta do cassino (Dudu) — 20/10/2026

Repo: D:\Projetos\escritorio-village (React/TS/Vite/Supabase). Typecheck: `npx tsc -b`. Demo: http://localhost:5180/?demo com sessionStorage `ev:session`=`demo-bruno` (conta do cassino).

## Já feito (não commitado)
1. **Presente do gerente do cassino**: 3 presentes/dia, até 30 ☕ cada (teto 90 ☕/dia), ou item do Almoxarifado.
   - `supabase/migrations/202610291300_cassino_presente.sql` (RPC `cassino_presente`, reason 'presente').
   - types.ts, data/supabase.ts, data/demo.ts (espelho), shop/economy.ts, store.ts, Loja.tsx (`why()`), ContaCassino.tsx (seção Presente), v4.css (`.cc-nota`).
   - Testado na demo: presente de 10 ☕ pra Ana ok.
2. **Sala própria do Dudu no andar do marketing** ("Gerência do cassino", só ele):
   - `src/office/comodos.ts`: Kind `'cassino'` + cômodo 14x14 com `mesa-chefe` BOSS_DESK.
   - `src/office/world.ts`: `workRoom` inclui 'cassino'; `salaJogos` tira a mesa BOSS_DESK.
   - `src/components/Game.tsx`: `ANDAR(gerente, cassino)` põe 'cassino' na fileira de cima; `homeRoom` → `roomOfKind('cassino')`.
   - ContaCassino.tsx: botão "🎰 Andar" e "🪚 Arrumar sala de jogos".
   - A sala aparece no andar. **Pendente**: na demo o Bruno não entrou na sala ao clicar (anda no corredor e para na porta). Investigar `blocked()`/`findPath`/`passable` (world.ts ~l.48, 94, 123, 129) e `enterable` (Game.tsx). Pode ser bug antigo (clique em cozinha também falhou) — testar com outra conta (demo-ana) antes de mexer.

## Próximos passos
1. Resolver/confirmar o problema de entrar na sala; conferir o Dudu sentado na mesa da gerência.
2. `npx tsc -b`.
3. Commit SÓ destes arquivos (nunca `git add -A`; NÃO commitar src/components/Widget.tsx nem src/turmeo.css, são de outra sessão). Mensagem termina com `Co-Authored-By: ...`.
4. Push no main publica (avisar o usuário); migrate workflow aplica a migration.

## Ideia nova do usuário (ainda não decidida — só propor, não codar)
- **Impeachment**: pessoas podem contestar o gerente do cassino se ele abusar dos presentes.
- **"Rei do mês"**: pessoa ativa eleita/escolhida no mês; pode dar presentes, mudar algumas regras de quantidade de café, outros poderes leves (nada absurdo, nada crítico: Quadro, Plano, ranking, contas, poderes ficam de fora).
- Precisa de decisões: como escolhe (votação? mais ativo?), quais regras ele mexe e limites, como funciona o impeachment (quórum, prazo).

## Regras
Conta do cassino nunca acessa coisa crítica. Sem service_role. Não criar contas reais nem digitar senha em produção. Vigia dos jogos intacto. Nada de aba nova sem perguntar.

## Continuação Codex — 20/10/2026 (sem commit/push)

### Feito
- Passo 1: corrigido `src/components/Game.tsx`, no clique de porta aberta. Antes o destino era o próprio tile da porta, então o boneco terminava o trajeto na soleira; agora o destino fica dentro do cômodo. Portas fechadas continuam levando ao corredor e exibindo o aviso.
- Validação por execução dos módulos reais via Vite SSR: 110 verificações passaram, cobrindo entrada/saída de todos os cômodos, bloqueio de portas fechadas, andares com/sem cassino e com/sem sala do gerente. O caminho até BOSS_DESK termina exatamente no assento da gerência do cassino, dentro da sala e sem colisão no ponto do assento. Script temporário removido.
- Passo 2: `npx tsc -b` passou. `npx oxlint src/components/Game.tsx` sem erros; aviso preexistente `react(only-export-components)` em syncFloor.
- Alterações anteriores preservadas, incluindo Widget.tsx e turmeo.css de outra sessão. Sem commit, push, publicação ou aplicação de migration.

### O que falta
- Conferência visual na demo com demo-bruno (cassino) e demo-ana: clicar na porta da cozinha e da gerência, entrar/sair e clicar na própria mesa para sentar. Não havia navegador/aba disponível nesta sessão; nenhuma aba foi criada. A rota/posição do assento foi validada por execução, mas o Dudu sentado na tela ainda não foi conferido.
- Commit/publicação/migration continuam pendentes, fora da autorização desta rodada.
- Vault e painel externo não atualizados: escrita permitida apenas no workspace. Consulta de lições não executou: python ausente do PATH. Contexto desta rodada registrado neste handoff e em tasks/active_context.md.

### Ideia nova — proposta para decisão, sem código
- Rei do mês: mandato de um mês, escolhido por votação entre pessoas ativas, com um voto por conta humana. Definir o que conta como atividade; não usar volume de partidas ou presentes como critério. Empate exige nova votação entre os empatados.
- Poderes sugeridos: presentes dentro do teto já existente (3/dia, até 30 cafés cada), escolher tema de evento e propor ajustes de café para o mês seguinte. Sem acumular uma segunda cota de presentes se também for gerente do cassino.
- Alterações de quantidade de café: somente parâmetros recreativos explicitamente autorizados, dentro de limites previamente aprovados pelo responsável. Não alterar saldo manualmente, preço de itens, economia global ou permissões; regras expiram ao fim do mandato.
- Impeachment: abertura por duas pessoas distintas, motivo obrigatório e histórico dos presentes visível aos votantes. Janela sugerida de 48 horas; quórum de metade das contas humanas ativas e aprovação por dois terços dos votos válidos. Acusado não vota no próprio caso; grupos pequenos precisam de regra específica antes da implementação.
- Resultado sugerido: revogar apenas os poderes recreativos do mandato, preservar conta/cargo de trabalho e eleger substituto. Quadro, Plano, ranking, contas, poderes semanais e Vigia dos jogos permanecem fora desse mecanismo.
- A decidir: eleitorado/atividade mínima, elegibilidade, desempate, alcance sobre o gerente permanente do cassino, limites ajustáveis, quórum em equipe pequena e quem assume após destituição. Proposta não implementada.

## 20/10 — Expansão dos jogos solicitada pelo usuário
- Outra pessoa/agente ficará responsável pelo cassino e jogos em geral; coordenar arquivos antes de implementar. Esta rodada registra briefing, sem alterar jogos.
- Pedido: desafios diários em cada jogo, com cafezinhos como recompensa diária.
- Pedido: adicionar sinuca 8-ball (bola 8), jogos cooperativos e versus, incluindo jogos de cartas e UNO ou semelhante.
- Proposta técnica para quem implementar: objetivos e progresso por pessoa/jogo/dia; conclusão e crédito validados no servidor; recompensa única e idempotente por desafio; mesma interface Backend para demo e Supabase.
- Proposta de produto: mostrar objetivo, progresso e recompensa no jogo; aproveitar a Sala de jogos existente. Competitivos devem lidar com turno, abandono e reconexão; cooperativos devem registrar contribuição individual.
- Pendências: valor dos prêmios, teto diário, horário/fuso de renovação, objetivos de cada jogo, prioridade dos novos jogos e regras das salas multiplayer. Não tratar propostas como regras aprovadas.
- Critérios propostos: atualizar a página ou repetir requisição não duplica prêmio; dia novo renova desafios; placar/recompensa não aceitam resultado arbitrário do cliente; partidas multiplayer mantêm estado consistente entre participantes.
- Status: briefing preparado; implementação pendente com responsável pelos jogos.

### 20/10 — Proposta de teto e organização da sala
- Usuário sugeriu máximo de 60 cafezinhos em desafios diários e pediu organizar melhor a sala de jogos.
- Recomendação pendente de confirmação: teto global de 60 por pessoa/dia somando todos os jogos; desafios por jogo continuam disponíveis, mas crédito respeita o saldo diário restante. Prêmios e quantidade de desafios ainda não definidos.
- Direção proposta: desafios do dia com progresso 0/60; catálogo por modo Solo, Versus e Cooperativo, com filtro de cartas/sinuca/cassino; salas multiplayer mostram participantes e vagas. Cassino tem identificação própria por envolver apostas.
- Pergunta enviada: reorganizar espaço físico de móveis/máquinas, painel de jogos ou ambos. Nenhuma UI ou regra econômica alterada.

## 20/10 — Salão ampliado (local, sem commit/push)
- Usuário aprovou teto global proposto de 60 cafezinhos por pessoa/dia para desafios; implementação econômica continua com responsável pelos jogos.
- Pedido executado na planta: retirar reunião e usar a lateral no salão. Game.tsx remove reunião da composição; world.ts mantém cada cômodo no lado correto do corredor e entrega a sobra ao salão, sem aumentar o bingo.
- Salão padrão 44x16 (antes 28x16); com gerência do cassino e sem sala do gerente do setor chega a 58x16. Gerências e bingo preservados.
- Áreas: arcade à esquerda; sinuca e mesas sociais no centro; cassino vinho à direita, máquinas nas bordas e corredores livres. Novos móveis/placas e piso em sala.ts; montagem em comodos.ts.
- Sinucas são móveis: 8-ball, UNO, coop/versus e desafios NÃO foram implementados nesta rodada. Mesa social abre Memória existente até integração do outro responsável.
- Layouts salvos são ampliados em memória, preservando objetos; sem gravação automática no banco. Layout já personalizado mantém arrumação. Voltar ao original no editor aplica a nova organização e mantém a largura atual.
- Corrigido alvo de interação do caixa/móveis: personagem para junto ao objeto, em tile livre. Spots acompanham largura do salão.
- Verificação: build passou; 503 verificações via módulos reais/Vite SSR (quatro combinações, portas, caminhos, sobreposições, máquinas e reabertura de layout); oxlint sem erros, avisos preexistentes; detector Impeccable sem achados.
- Prévia desktop inspecionada nos tamanhos 44 e 58. Celular não validado: comando de viewport travou e extensão perdeu conexão com a aba; não declarar QA móvel concluído.
- Prévia e verificador temporários ignorados pelo Git: .cassino.local/preview.html e verificar.mjs. Dev local 127.0.0.1:5180.
- Pesquisa: https://qasiknow.com/casino-design-layout/ e https://www.designgroup.net.au/layout-of-casino-games/ — agrupamento de máquinas, mesas centrais, visibilidade e circulação.
- Arquivos desta rodada: src/office/comodos.ts, sala.ts, world.ts; src/components/Game.tsx e SalaEditor.tsx. Widget.tsx, turmeo.css e função drive de outras sessões preservados.
- Próximo: revisão humana da prévia, QA móvel e confirmação antes de push/publicação (AGENTS.md). Nenhuma migration ou publicação realizada.

## Publicação autorizada + bingo solo (20/10)
- Usuário autorizou push/publicação e pediu bingo para uma pessoa. Ajustados motor demo, texto e migration 202610291400_bingo_solo.sql. Sem alterar prêmios, custos, horário, locks ou idempotência.
- 23 verificações de bingo e 503 de planta passaram. Teste inicial foi corrigido para normalizar CRLF e respeitar arredondamento existente nos empates; sem alteração na regra de prêmio.
- Mover o bingo para outra sala foi levantado como possibilidade; posição atual preservada até definição.
- Subir apenas salão + bingo; mudanças de Widget, CSS e acervo de outras sessões ficam fora.


## 20/10 — Publicado: salão ampliado + bingo solo
- Autorização explícita do usuário: push/publicação; em seguida pediu bingo com uma pessoa. Possível mudança de sala ficou como proposta.
- Commit 9049a7f enviado para origin/main. Publicação GitHub Pages concluída com sucesso: https://github.com/Vigattibla/escritorio-village/actions/runs/39497708474 (jobs migrate/functions/build/deploy passaram).
- Site: https://vigattibla.github.io/escritorio-village/ — HTTP 200; bundle publicado main-DekCqSNL.js contém a sala nova (placa-mesas/carpete-vinho) e o texto de bingo solo.
- Migration 202610291400_bingo_solo.sql: mínimo passa de duas para uma pessoa; demo acompanha e texto corrigido. Mesmos prêmios, preços, horário e idempotência. Sem cartelas cancela. Não houve aposta nem compra de cartela em conta real nesta validação.
- Validação: 503 verificações da planta e 23 do bingo; build em worktree isolado do commit exato passou. Primeiro teste de bingo precisou normalizar CRLF e respeitar arredondamento já existente nas múltiplas cartelas; produto não alterou cálculo de prêmio.
- Bingo continua no salão próprio atual. Novos jogos, coop/versus, 8-ball/UNO e desafios ainda com o outro responsável; teto de desafios de 60 é requisito, não implementação desta rodada.
- Limite conhecido: QA móvel da planta não foi concluído por timeout da extensão (desktop conferido anteriormente).
- Mudanças alheias de Widget.tsx, turmeo.css e acervo ficaram fora do commit. Worktree de verificação em .cassino.local/publicacao-9049a7f (ignorado); sem alterações posteriores de código nesta rodada.

## Correção da sala salva — 20/10
- Usuário reportou salão vazio após 9049a7f. Consulta somente de leitura confirmou jogos-marketing salvo em 28x16 com 28 objetos; migração anterior inseria vazio central e mantinha jogos nos cantos. Prévia anterior tinha conferido modelo de fábrica, não a planta salva: falha de validação reconhecida.
- world.ts remonta planta legada no novo modelo, reaproveita ids, preserva estante e segunda mesa de blackjack; registro do banco não é alterado. Game.tsx calcula largura final (44/58) antes de adaptar.
- 184 verificações passaram com planta legada real, incluindo distribuição, objetos personalizados, sobreposições, acesso e reabertura. Prévia renderizada dessa planta inspecionada.
- Regressão permanente em scripts/verificar-sala-jogos.mjs (somente configuração de móveis, sem dados de usuários); GitHub Pages passa a executá-la antes do build.


## 20/10 — Correção publicada (c39d02c)
- GitHub Pages concluído: https://github.com/Vigattibla/escritorio-village/actions/runs/39500380999 . Teste permanente da planta salva, build e deploy passaram.
- Site HTTP 200 com bundle main-1MyrHmlb.js. Código de remontagem legado->mesa-social e bingo solo confirmados no bundle publicado.
- Sala jogos-marketing de produção foi consultada somente em leitura (28x16, 28 objetos); arrumação antiga ficava nas extremidades após alargamento. Corrigido o adaptador e cálculo antecipado da largura. Dados originais do banco permanecem intactos.
- Validado visualmente o renderer com a planta salva real; 184 verificações cobrem larguras 44/58, acesso aos jogos, sem sobreposição, duas mesas blackjack, estante e reabertura. Teste é executado no CI antes do build.
- Lição repetida registrada: validar layout com estado salvo real, não apenas modelo novo. Mudanças alheias preservadas. Usuário pode recarregar o site para obter a correção.

## Jogos executáveis e placar — 20/10
- Usuário pediu base por Codex e Claude só para concluir com mínimo de gasto. Claude Sonnet/baixo esforço concluiu quatro arquivos por CLI; uso estimado relatado USD 0.7278618 (não é comprovante de cobrança).
- Entregue: sinuca 8-ball para duas pessoas no mesmo aparelho, com física/grupos/faltas/bola 8; cartas estilo UNO vs computador, com ações/coringas/compra. Sem multiplayer online nem coop nesta rodada. Jogos locais sem recompensa/placar mensal.
- Base Codex: catálogo, motor puro de cartas, integração das mesas/canvas, botão Jogar visível e atalho na conta cassino. Placar mensal usa só melhor resultado por jogo/mês/setor; respostas de partidas antigas são ignoradas. Texto dos pontos no painel limitado à largura do visor.
- Conferência: fluxo real da demo Escritório -> Jogar -> Sinuca abriu; tacada e troca de turno conferidas no componente integrado; cartas/coringa/cor escolhida/resposta do bot e pontos humanos conferidos. Física usa tempo decorrido para não prender turno em taxa de quadros baixa.
- 45 verificações de física/cartas/ranking e 189 da sala salva passaram; TypeScript passou; detector sem achados; warnings de lint não bloqueantes. Ambos verificadores de jogo executados no CI antes da publicação.
- Desafios diários até 60 cafezinhos e multiplayer online continuam pendentes; não anunciar como implementados.


## 20/10 — Publicados os jogos executáveis
- Commits 8cf732d e b2a0f15 no ar. Workflow final https://github.com/Vigattibla/escritorio-village/actions/runs/39503401243 concluído com sucesso (testes/build/deploy).
- Site HTTP 200; main-B1K2zr-R.js contém sinuca real (Tacada), cartas (escolha de cor) e bingo solo; main-D1PAeSip.css contém correções móveis.
- Uso: Escritório -> Jogar (botão visível no canvas) -> Sinuca 8-ball ou Cartas. Conta cassino também ganha entrada Jogos; mesas físicas conectadas. Sinuca é VS local no mesmo dispositivo; cartas é VS bot. Coop/multiplayer online e desafios diários de até 60 cafezinhos não entregues nesta etapa.
- Placar: guarda de sessão para ignorar respostas antigas, melhor resultado único por jogo/mês/setor, resultados locais separados de ranking/cafezinhos; pontos do painel cabem no visor.
- Claude encerrou quatro arquivos por uma única chamada limitada: física/regras, Sinuca.tsx, Cartas.tsx, mesas.css; custo estimado relatado USD 0.7278618. Codex fez motor de cartas, catálogo, integração, revisão e ajustes finais.
- 45 verificações de física/cartas/ranking + 189 da planta, TypeScript e CI passaram. No navegador: tacada/troca de turno, coringa/cor, resposta do bot e pontuação; fluxo de entrada pelo app completo conferido. Em 390px, modal acima da navegação e força na largura da mesa confirmados.
- Mudanças alheias em Widget/CSS/acervo preservadas. Nenhuma nova migration nesta etapa.

## 20/10 — Evolução online/bots
- Nova etapa substitui a limitação local acima: sinuca/UNO/Mau-Mau com duas contas online, retomada e saída; os três têm bot local. Sinuca mantém revezamento no aparelho.
- Estado e versão validados na edge, mãos privadas, sinuca calculada no servidor, CAS contra duplicação. Interface Backend implementada em demo e Supabase. Migration mesas_online e função mesas publicadas junto com o cliente pelo CI.
- Claude finalizou apenas SQL/endpoint (estimativa USD 0.316093); Codex fez base, UI, regras/bots e verificações.
- Desafios diários de até 60 cafezinhos continuam pendentes; sem recompensas automáticas nas mesas.
