import assert from 'node:assert/strict'
import { createServer } from 'vite'
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
try {
  const c = await server.ssrLoadModule('/src/jogos/cartas.ts')
  const { rankingJogos } = await server.ssrLoadModule('/src/jogos/catalogo.ts')
  const pool = await server.ssrLoadModule('/src/jogos/sinuca.ts')
  let checks = 0
  const check = (v, text) => { assert.ok(v, text); checks++ }
  let seed = 42
  const random = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296)
  let s = c.novaMesa(random)
  const cards = [...s.maos[0], ...s.maos[1], ...s.monte, ...s.descarte]
  check(cards.length === 108 && new Set(cards.map(x => x.id)).size === 108, 'Baralho completo e sem duplicatas')
  check(s.maos.every(m => m.length === 7), 'Sete cartas iniciais')
  const original = JSON.stringify(s)
  check(c.jogarCarta(s, -1) === s && c.jogarCarta(s, NaN) === s, 'Jogada inválida recusada')
  const bad = s.maos[0].findIndex(card => !c.podeJogar(s, card))
  if (bad >= 0) check(c.jogarCarta(s, bad) === s, 'Carta incompatível recusada')
  const drew = c.comprarCarta(s)
  check(drew.maos[0].length === 8 && drew.vez === 1 && JSON.stringify(s) === original, 'Compra passa vez sem mutar estado anterior')
  for (const value of ['+2', '+4', 'pular', 'inverter']) {
    const state = { ...c.novaMesa(random), vez: 0, cor: 'vermelho', maos: [[{ id: 1000, cor: value === '+4' ? null : 'vermelho', valor: value }, { id: 1001, cor: 'azul', valor: 1 }], [{ id: 1002, cor: 'azul', valor: 2 }]] }
    const next = c.jogarCarta(state, 0, 'verde')
    check(next.vez === 0, `${value} pula adversário em partida de duas pessoas`)
    check(next.maos[1].length === 1 + (value === '+2' ? 2 : value === '+4' ? 4 : 0), `${value} compra correta`)
    if (value === '+4') check(next.cor === 'verde', 'Coringa respeita cor escolhida')
  }
  const win = { ...c.novaMesa(random), vez: 0, cor: 'azul', maos: [[{ id: 1, cor: 'azul', valor: 5 }], [{ id: 2, cor: 'verde', valor: 5 }]] }
  const end = c.jogarCarta(win, 0)
  check(end.vencedor === 0 && c.comprarCarta(end) === end, 'Vitória encerra a partida')
  for (let step = 0; step < 700 && s.vencedor === null; step++) {
    const ix = s.maos[s.vez].findIndex(card => c.podeJogar(s, card))
    s = ix < 0 ? c.comprarCarta(s) : c.jogarCarta(s, ix, c.melhorCor(s.maos[s.vez]))
    const all = [...s.maos[0], ...s.maos[1], ...s.monte, ...s.descarte]
    check(all.length === 108 && new Set(all.map(x => x.id)).size === 108, 'Cartas conservadas durante partida e reciclagem')
  }
  const row = { user_id: 'a', jogo: 'memoria', mes: '2026-10', dept: 'm', pontos: 100 }
  const rows = [row, { ...row, pontos: 90 }, { ...row, jogo: 'reflexo', pontos: 30 }, { ...row, jogo: 'sinuca', pontos: 9999 }, { ...row, mes: '2026-09', pontos: 999 }, { ...row, dept: 'outro', pontos: 999 }, { ...row, pontos: NaN }]
  check(JSON.stringify(rankingJogos(rows, '2026-10', 'm')) === JSON.stringify([['a', 130]]), 'Ranking soma só melhor resultado por jogo, mês e setor')
  check(rankingJogos(rows, '2026-10', 'm', 'memoria')[0][1] === 100, 'Placar individual não duplica registros')
  check(rankingJogos(rows, '2026-10', 'm', 'sinuca').length === 0, 'Partida local não contamina placar mensal')
  const balls = pool.montarMesa(), shot = { encacapadas: [], primeiro: null }
  check(balls.length === 16 && new Set(balls.map(b => b.id)).size === 16, 'Sinuca: branca e quinze bolas únicas')
  balls[0].vx = pool.MAX_V
  let steps = 0
  while (pool.emMovimento(balls) && steps++ < 5000) pool.avancar(balls, shot)
  check(!pool.emMovimento(balls) && shot.primeiro !== null, 'Tacada colide e para em tempo finito')
  check(balls.every(b => [b.x, b.y, b.vx, b.vy].every(Number.isFinite)), 'Física sem NaN')
  const pocket = [{ id: 1, x: 0, y: 0, vx: 0, vy: 0, fora: false }], event = { encacapadas: [], primeiro: null }
  pool.avancar(pocket, event); pool.avancar(pocket, event)
  check(pocket[0].fora && event.encacapadas.length === 1, 'Caçapa registra bola só uma vez')
  const first = pool.resolverTacada(0, [null, null], { encacapadas: [1], primeiro: 1 }, [1, 2, 8, 9])
  check(first.grupos[0] === 'lisas' && first.grupos[1] === 'listradas' && first.vez === 0, 'Grupo atribuído pela primeira bola e conserva vez')
  const foul = pool.resolverTacada(0, ['lisas', 'listradas'], { encacapadas: [0], primeiro: 1 }, [1, 8, 9])
  check(foul.falta && foul.vez === 1, 'Branca encaçapada troca turno com falta')
  const early = pool.resolverTacada(0, ['lisas', 'listradas'], { encacapadas: [8], primeiro: 8 }, [1, 8, 9])
  check(early.fim?.vencedor === 1, 'Bola 8 prematura perde')
  const won = pool.resolverTacada(0, ['lisas', 'listradas'], { encacapadas: [8], primeiro: 8 }, [8, 9])
  check(won.fim?.vencedor === 0, 'Bola 8 depois do grupo vence')
  console.log(`${checks} verificações passaram: cartas, física/regras da sinuca e ranking.`)
} finally { await server.close() }
