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
