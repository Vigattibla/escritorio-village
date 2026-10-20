import assert from 'node:assert/strict'
import { createServer } from 'vite'
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
try {
  const world = await server.ssrLoadModule('/src/office/world.ts')
  const { COMODOS } = await server.ssrLoadModule('/src/office/comodos.ts')
  const { kd, original } = await server.ssrLoadModule('/src/office/sala.ts')
  // Planta legada de 28 tiles, incluindo segunda mesa de cartas e gerência antiga.
  const saved = { ...world.emptySala(28, 16), objs: [
  {
    "k": "tv-grande",
    "x": 2,
    "y": 0,
    "id": 1
  },
  {
    "k": "letreiro-cassino",
    "x": 18,
    "y": 0,
    "id": 2
  },
  {
    "k": "tapete-gamer",
    "x": 1,
    "y": 3,
    "id": 3
  },
  {
    "k": "console",
    "x": 2,
    "y": 2,
    "id": 4
  },
  {
    "k": "pufe",
    "x": 4,
    "y": 4,
    "id": 5
  },
  {
    "k": "sofa",
    "x": 1,
    "y": 6,
    "id": 6
  },
  {
    "k": "estante",
    "x": 8,
    "y": 2,
    "id": 7
  },
  {
    "k": "pebolim",
    "x": 8,
    "y": 5,
    "id": 8
  },
  {
    "k": "sinuca",
    "x": 3,
    "y": 9,
    "id": 9
  },
  {
    "k": "mesa-jantar",
    "x": 8,
    "y": 11,
    "id": 10
  },
  {
    "k": "cadeira-reuniao",
    "x": 8,
    "y": 13,
    "id": 11
  },
  {
    "k": "cadeira-reuniao",
    "x": 11,
    "y": 13,
    "id": 12
  },
  {
    "k": "fliperama",
    "x": 2,
    "y": 13,
    "id": 13
  },
  {
    "k": "fliperama",
    "x": 4,
    "y": 13,
    "id": 14
  },
  {
    "k": "tapete-cassino",
    "x": 17,
    "y": 5,
    "id": 15
  },
  {
    "k": "caca-niquel",
    "x": 23,
    "y": 2,
    "id": 16
  },
  {
    "k": "caca-niquel",
    "x": 24,
    "y": 2,
    "id": 17
  },
  {
    "k": "caca-niquel",
    "x": 25,
    "y": 2,
    "id": 18
  },
  {
    "k": "mesa-roleta",
    "x": 20,
    "y": 6,
    "id": 19
  },
  {
    "k": "mesa-cartas",
    "x": 23,
    "y": 10,
    "id": 20
  },
  {
    "k": "totem-crash",
    "x": 26,
    "y": 6,
    "id": 21
  },
  {
    "k": "totem-minas",
    "x": 26,
    "y": 9,
    "id": 22
  },
  {
    "k": "caixa-fichas",
    "x": 21,
    "y": 14,
    "id": 23
  },
  {
    "k": "maquina-refri",
    "x": 26,
    "y": 13,
    "id": 24
  },
  {
    "k": "planta",
    "x": 1,
    "y": 11,
    "id": 25
  },
  {
    "k": "planta",
    "x": 1,
    "y": 9,
    "id": 26
  },
  {
    "d": 12,
    "k": "mesa-chefe",
    "x": 19,
    "y": 3,
    "id": 27
  },
  {
    "k": "mesa-cartas",
    "x": 18,
    "y": 10,
    "id": 30
  }
] }
  const snapshot = JSON.stringify(saved)
  let checks = 0
  const check = (v, text) => { assert.ok(v, text); checks++ }
  for (const width of [44, 58]) {
    const s = world.salaJogos(saved, true, width)
    const kinds = ['dept', 'cozinha', 'banheiro', ...(width === 58 ? ['cassino'] : []), 'jogos', 'bingo']
    world.setFloor(kinds.map(kind => ({ kind, sala: kind === 'dept' ? original() : kind === 'jogos' ? s : COMODOS[kind].sala() })))
    const rooms = world.getRooms(), r = rooms.find(r => r.kind === 'jogos')
    world.setPassable(rooms.map(() => true))
    const start = world.elevadorSpot()
    check(r.w === width, 'Largura final calculada antes da adaptação')
    check(s.objs.filter(o => o.k === 'mesa-cartas').length === 2, 'As duas mesas blackjack salvas continuam')
    check(s.objs.some(o => o.k === 'estante'), 'Móvel personalizado preservado')
    check(!s.objs.some(o => o.k === 'mesa-chefe'), 'Mesa do gerente fica na gerência')
    check(s.objs.some(o => o.k === 'sinuca' && o.x === 14), 'Sinuca ocupa a área incorporada')
    check(s.objs.some(o => o.k === 'mesa-social' && o.x === 23), 'Cartas ocupam o centro')
    if (width === 58) check(s.objs.some(o => o.k === 'sinuca' && o.x === 30), 'Lateral ampliada também tem jogos')
    for (const o of s.objs) {
      const k = kd(o)
      check(o.x >= 0 && o.y >= 0 && o.x + k.w <= r.w && o.y + k.h <= r.h, `Dentro: ${o.k}`)
      if (k.camada || k.passa) continue
      check(!s.objs.some(p => p.id !== o.id && !kd(p).camada && !kd(p).passa && o.x < p.x + kd(p).w && p.x < o.x + k.w && o.y < p.y + kd(p).h && p.y < o.y + k.h), `Sem sobreposição: ${o.k}`)
      const hit = world.jogoAt(r.ox + o.x, r.oy + o.y)
      if (hit) check(world.findPath(start.x, start.y, hit.tx, hit.ty), `Jogo alcançável: ${o.k}`)
    }
    check(new Set(s.objs.map(o => o.id)).size === s.objs.length, 'Ids únicos')
    check(JSON.stringify(world.salaJogos(s, true, width)) === JSON.stringify(s), 'Reabrir mantém a arrumação')
  }
  check(JSON.stringify(saved) === snapshot, 'Registro original permanece intacto')
  console.log(`${checks} verificações passaram com a planta legada de produção (sem dados de usuários), nas larguras 44 e 58.`)
} finally { await server.close() }
