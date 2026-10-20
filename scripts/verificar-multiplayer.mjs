import assert from 'node:assert/strict'
import { createServer } from 'vite'
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
try {
  const m = await server.ssrLoadModule('/supabase/functions/_shared/jogos/mesa.ts')
  const c = await server.ssrLoadModule('/src/jogos/cartas.ts')
  const p = await server.ssrLoadModule('/src/jogos/sinuca.ts')
  let checks = 0
  const ok = (v, label) => { assert.ok(v, label); checks++ }
  const fail = (fn, label) => { assert.throws(fn, undefined, label); checks++ }
  for (const jogo of ['cartas', 'baralho', 'sinuca']) {
    let room = m.criarMesa('mesa-' + jogo, jogo, 'a')
    ok(room.estado === 'espera' && room.convidado === null, 'Criação espera segundo jogador')
    ok(m.entrarMesa(room, 'a').convidado === null, 'Criador não ocupa segunda vaga')
    fail(() => m.visaoMesa(room, 'intruso'), 'Estranho não lê estado privado')
    room = m.entrarMesa(room, 'b')
    ok(room.estado === 'jogando' && room.versao === 1 && room.convidado === 'b', 'Segundo jogador inicia')
    fail(() => m.entrarMesa(room, 'c'), 'Terceiro jogador recusado')
    fail(() => m.acaoMesa(room, 'a', 0, { tipo: 'comprar' }), 'Versão antiga recusada')
    fail(() => m.acaoMesa(room, 'b', 1, { tipo: 'comprar' }), 'Vez do adversário recusada')
    if (jogo === 'sinuca') {
      fail(() => m.acaoMesa(room, 'a', 1, { tipo: 'tacada', angulo: NaN, forca: 80 }), 'Mira inválida recusada')
      fail(() => m.acaoMesa(room, 'a', 1, { tipo: 'tacada', angulo: 0, forca: 9000 }), 'Força impossível recusada')
      const old = JSON.stringify(room)
      const shot = p.tacadaBot(room.dados.sinuca.bolas, null)
      ok(Number.isFinite(shot.angulo) && shot.forca >= 5 && shot.forca <= 100, 'Bot produz tacada válida sem IA')
      const next = m.acaoMesa(room, 'a', 1, { tipo: 'tacada', ...shot, bolas: [] })
      ok(next.versao === 2 && next.dados.sinuca.bolas.length === 16, 'Servidor simula e ignora snapshot do cliente')
      ok(next.dados.sinuca.bolas.every(b => b.vx === 0 && b.vy === 0 && Number.isFinite(b.x) && Number.isFinite(b.y)), 'Snapshot final consistente')
      ok(JSON.stringify(room) === old, 'Tacada não muta versão antiga')
      fail(() => m.acaoMesa(next, 'a', 1, { tipo: 'tacada', ...shot }), 'Repetição de tacada com versão antiga recusada')
      room = next
    } else {
      const a = m.visaoMesa(room, 'a'), b = m.visaoMesa(room, 'b')
      ok(!('dados' in a) && !('maos' in a.cartas) && !Array.isArray(a.cartas.monte), 'Vista não expõe mãos nem baralho completo')
      ok(a.cartas.mao.length === (jogo === 'baralho' ? 5 : 7), 'Quantidade inicial correta')
      ok(!a.cartas.mao.some(x => b.cartas.mao.some(y => x.id === y.id)), 'Mãos privadas e disjuntas')
      fail(() => m.acaoMesa(room, 'a', 1, { tipo: 'jogar', carta: b.cartas.mao[0].id }), 'Não pode usar carta do adversário')
      const snapshot = JSON.stringify(room)
      const next = m.acaoMesa(room, 'a', 1, { tipo: 'comprar' })
      ok(next.dados.cartas.vez === 1 && next.dados.cartas.maos[0].length === a.cartas.mao.length + 1, 'Compra sincroniza mão e troca vez')
      ok(JSON.stringify(room) === snapshot, 'Ação mantém estado anterior intacto')
      fail(() => m.acaoMesa(next, 'a', 1, { tipo: 'comprar' }), 'Pedido duplicado não compra duas vezes')
      room = next
      for (let i = 0; i < 500 && room.estado === 'jogando'; i++) {
        const state = room.dados.cartas, player = state.vez === 0 ? 'a' : 'b'
        const card = state.maos[state.vez].find(x => c.podeJogar(state, x))
        room = m.acaoMesa(room, player, room.versao, card ? { tipo: 'jogar', carta: card.id, cor: c.melhorCor(state.maos[state.vez]) } : { tipo: 'comprar' })
        const all = [...room.dados.cartas.maos[0], ...room.dados.cartas.maos[1], ...room.dados.cartas.monte, ...room.dados.cartas.descarte]
        ok(all.length === (jogo === 'baralho' ? 52 : 108) && new Set(all.map(x => x.id)).size === all.length, 'Conservação do baralho em partida online')
      }
    }
    const ended = m.sairMesa(room, 'a')
    ok(ended.estado === 'fim', 'Saída encerra sala sem prêmios')
    ok(m.sairMesa(ended, 'a') === ended, 'Saída repetida é idempotente')
    fail(() => m.acaoMesa(ended, 'a', ended.versao, { tipo: 'comprar' }), 'Mesa encerrada não aceita jogadas')
  }
  console.log(`${checks} verificações passaram: duas pessoas, privacidade, turno, versões, bot e baralho de 52 cartas.`)
} finally { await server.close() }
