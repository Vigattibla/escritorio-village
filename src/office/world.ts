import { BOSS_DESK, MH, MW, OUT, rect, SHADOW, T, WALL, WALL_HI, type C2D } from './base'
import { exitX, glassDoorX, glassStrip, glassWall } from './andar'
import { drawArquivo, drawDecor, drawFloor, drawNotebook, MESA, mesaExtra, type DeskLook } from './props'
import { defaultDesk, deskFrom, deskSides, dimOf, isDesk, kd, parseComodo, renderRoom, solidGrid, type Desk, type Obj, type Sala } from './sala'
import { COMODOS, comodoOf, type Kind } from './comodos'
import type { JogoCassino } from '../cassino/regras'

export * from './base'

/** O andar inteiro num mapa só: uma fileira de salas em cima, corredor no meio, outra embaixo (frente a frente).
 *  Cada sala tem o tamanho da própria planta; as de cima encostam no corredor por baixo. */
export let FW = 2 * MW
/** linhas do corredor (globais) */
export const HY0 = MH, HY1 = MH + 4
export const FH = HY1 + 1 + MH
/** coisas do corredor (tiles globais): sofá e bancos encostados no vidro de cima, plantas e canteiros embaixo */
function hallObjs(): [string, number, number][] {
  const o: [string, number, number][] = [['elevador', 1, HY0], ['planta', FW - 2, HY0], ['planta', 1, HY1], ['planta', FW - 2, HY1]]
  for (const r of rooms) {
    // na emenda entre duas salas: um sofá (em cima) ou uma planta (embaixo); bebedouro já tem dentro das salas
    if (r.ox > 0) o.push(r.top ? ['sofa', r.ox - 2, HY0] : ['planta', r.ox, HY1])
    if (r.w >= 16) o.push([r.top ? 'banco-madeira' : 'canteiro', r.slot % 2 ? r.ox + r.w - 7 : r.ox + 5, r.top ? HY0 : HY1])
  }
  return o
}

export interface Room {
  slot: number
  kind: Kind
  /** setor (só na sala do setor; cômodos e sala do gerente = null) */
  id: string | null
  /** setor do andar a que a sala pertence (sala do setor e do gerente) */
  dept: string | null
  sala: Sala
  /** origem em tiles no andar e tamanho (o da planta da sala) */
  ox: number; oy: number; w: number; h: number
  /** de cima do corredor (vidro embaixo) ou de baixo (vidro em cima) */
  top: boolean
  /** tile da esquerda da porta (local, 2 de largura) */
  door: number
  solid: boolean[][]
  /** sala de vendas: mesas coladas viram bancada com telefone */
  baia: boolean
  deskTile: (number | null)[][]
}

let rooms: Room[] = []
let passable: boolean[] = []
let version = 0
let hall: Obj[] = []
let hallSolid = new Set<number>()

export const floorVersion = () => version
export const getRooms = () => rooms
export const roomOfId = (id: string) => rooms.find(r => r.id === id)
export const roomOfKind = (k: Kind) => rooms.find(r => r.kind === k)
/** sala com mesa de trabalho (do setor ou do gerente) */
export const workRoom = (r: Room | undefined): r is Room => r?.kind === 'dept' || r?.kind === 'gerente' || r?.kind === 'cassino'

export function emptySala(w = MW, h = MH): Sala {
  return { piso: Array.from({ length: h }, () => Array.from({ length: w }, () => 'madeira' as const)), div: Array.from({ length: h }, () => Array<boolean>(w).fill(false)), objs: [] }
}

/** monta o andar: specs[k] = sala do slot k; a primeira metade fica em cima do corredor, a outra embaixo */
export function setFloor(specs: { kind: Kind; dept?: string | null; sala: Sala; baia?: boolean }[]) {
  const n = Math.max(1, Math.ceil(specs.length / 2))
  const rows = [specs.slice(0, n), specs.slice(n)].map(row => row.map(p => ({ ...p })))
  const width = (row: typeof rows[0]) => row.reduce((a, p) => a + dimOf(p.sala).w, 0)
  FW = Math.max(...rows.map(width))
  // fileira mais curta: a sala vazia do fim estica até fechar a largura
  for (const row of rows) {
    const last = row[row.length - 1], falta = FW - width(row)
    if (last?.kind === 'vaga' && falta > 0) { const { w, h } = dimOf(last.sala); last.sala = emptySala(w + falta, h) }
    else if (last && falta > 0) last.sala = { ...last.sala, piso: last.sala.piso.map(l => [...l, ...Array(falta).fill(l[l.length - 1])]), div: last.sala.div.map(l => [...l, ...Array<boolean>(falta).fill(false)]) }
  }
  rooms = rows.flatMap((row, ri) => {
    let x = 0
    return row.map(({ kind, dept = null, sala, baia = false }, i) => {
      const top = ri === 0, { w, h } = dimOf(sala), ox = x
      x += w
      const deskTile = Array.from({ length: h }, () => Array<number | null>(w).fill(null))
      for (const o of sala.objs) if (isDesk(o.k) && o.d !== undefined) for (let k = 0; k < kd(o).w; k++) deskTile[o.y][o.x + k] = o.d
      return { slot: ri * n + i, kind, id: kind === 'dept' ? dept : null, dept, sala, ox, oy: top ? HY0 - h : HY1 + 1, w, h, top, door: top ? exitX(sala) : glassDoorX(sala), solid: solidGrid(sala), baia, deskTile }
    })
  })
  // nada do corredor pode ficar na frente de uma porta
  const front = new Set(rooms.flatMap(r => [0, 1].map(k => (r.top ? HY0 : HY1) * FW + r.ox + r.door + k)))
  const tilesOf = (o: Obj) => Array.from({ length: kd(o).w }, (_, k) => o.y * FW + o.x + k)
  hall = hallObjs().map(([k, x, y], i) => ({ id: -1 - i, k, x, y })).filter(o => !tilesOf(o).some(t => front.has(t)))
  hallSolid = new Set(hall.filter(o => !kd(o).passa).flatMap(tilesOf))
  version++
}
/** por quais portas eu passo (por slot) */
export function setPassable(open: boolean[]) { passable = open }

/** -1 = corredor, -2 = fora das salas (sobra ao lado de sala mais baixa); senão o slot da sala (porta conta como sala) */
export function regionAt(gx: number, gy: number) {
  if (gy >= HY0 && gy <= HY1) return -1
  const r = rooms.find(r => gx >= r.ox && gx < r.ox + r.w && gy >= r.oy && gy < r.oy + r.h)
  return r ? r.slot : -2
}
export const regionOfPx = (x: number, y: number) => regionAt(Math.floor(x / T), Math.floor(y / T))

const isDoor = (r: Room, lx: number, ly: number) => (lx === r.door || lx === r.door + 1) && (r.top ? ly === r.h - 1 : ly >= 0 && ly <= 1)
/** slot da porta nesse tile global, ou -1 */
export function doorAtTile(gx: number, gy: number) {
  const k = gx >= 0 && gy >= 0 && gx < FW && gy < FH ? regionAt(gx, gy) : -1, r = k >= 0 ? rooms[k] : undefined
  return r && isDoor(r, gx - r.ox, gy - r.oy) ? k : -1
}
/** centro da porta (px global, na borda com o corredor) e o tile do corredor bem na frente dela */
export function doorSpot(r: Room) {
  const x = (r.ox + r.door + 1) * T
  return r.top ? { x, y: HY0 * T, tx: r.ox + r.door, ty: HY0 } : { x, y: (HY1 + 1) * T, tx: r.ox + r.door, ty: HY1 }
}

function tileSolid(gx: number, gy: number) {
  if (gx < 0 || gy < 0 || gx >= FW || gy >= FH) return true
  const k = regionAt(gx, gy)
  if (k === -1) return gx < 1 || gx >= FW - 1 || hallSolid.has(gy * FW + gx)
  const r = rooms[k]
  if (!r) return true
  const lx = gx - r.ox, ly = gy - r.oy
  if (isDoor(r, lx, ly)) return r.kind === 'vaga' || !passable[k]
  if (r.kind === 'vaga' || lx < 1 || ly < 2 || lx >= r.w - 1 || ly >= r.h - 1) return true
  return r.sala.div[ly][lx] || r.solid[ly][lx]
}

/** pixel bloqueado? Na mesa de trabalho só a metade da frente bloqueia (a cadeira fica atrás) */
export function blocked(x: number, y: number) {
  const gx = Math.floor(x / T), gy = Math.floor(y / T), k = gx >= 0 && gy >= 0 && gx < FW && gy < FH ? regionAt(gx, gy) : -1
  const r = k >= 0 ? rooms[k] : undefined
  if (r && r.deskTile[gy - r.oy]?.[gx - r.ox] != null) return y - gy * T >= 9
  return tileSolid(gx, gy)
}

const desks = (r: Room) => r.sala.objs.filter(o => isDesk(o.k) && o.d !== undefined)
export const deskIds = (r: Room) => desks(r).map(o => o.d!)
export const hasDesk = (r: Room, i: number) => desks(r).some(o => o.d === i)
/** na baia: quem está colado à esquerda/direita (null = sala normal) */
export function deskSidesOf(r: Room, i: number) {
  const o = r.baia && desks(r).find(o => o.d === i)
  return o ? deskSides(r.sala.objs, o) : undefined
}
/** mesa em coordenadas da sala */
export function deskLocal(r: Room, i: number): Desk {
  const o = desks(r).find(o => o.d === i)
  return o ? deskFrom(o) : defaultDesk(i)
}
/** mesa em coordenadas do andar */
export function deskOf(r: Room, i: number): Desk {
  const d = deskLocal(r, i)
  return { tx: d.tx + r.ox, ty: d.ty + r.oy, w: d.w, seat: { x: d.seat.x + r.ox * T, y: d.seat.y + r.oy * T } }
}

export function deskAtTile(gx: number, gy: number): { r: Room; i: number } | null {
  const k = gx >= 0 && gy >= 0 && gx < FW && gy < FH ? regionAt(gx, gy) : -1, r = k >= 0 ? rooms[k] : undefined
  if (!workRoom(r)) return null
  const lx = gx - r.ox, ly = gy - r.oy
  for (const o of desks(r)) if (lx >= o.x && lx < o.x + kd(o).w && (ly === o.y || ly === o.y - 1)) return { r, i: o.d! }
  return null
}

const walkable = (tx: number, ty: number) => !tileSolid(tx, ty)

/** custo de pisar no tile: no corredor o caminho é pela passadeira do meio; nas salas, longe de parede e móvel */
function stepCost(tx: number, ty: number) {
  if (ty >= HY0 && ty <= HY1) { const m = (HY0 + HY1) / 2, d = Math.abs(ty - m); return d < 1 ? 2 : d < 2 ? 3 : 8 }
  let c = 2
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (tileSolid(tx + dx, ty + dy) && doorAtTile(tx + dx, ty + dy) < 0) c++
  return c
}

/** porta de 2 tiles: quem passa por ela (ou logo antes/depois) anda pelo meio dela, não pela lateral */
function doorCenterX(tx: number, ty: number) {
  for (const r of rooms) {
    if (tx !== r.ox + r.door && tx !== r.ox + r.door + 1) continue
    const y0 = r.top ? r.oy + r.h - 2 : HY1 - 1, y1 = r.top ? HY0 + 1 : r.oy + 2
    if (ty < y0 || ty > y1) continue
    if (walkable(r.ox + r.door, ty) && walkable(r.ox + r.door + 1, ty)) return (r.ox + r.door + 1) * T
  }
  return null
}

/** Dijkstra em tiles (custo prefere o meio); devolve centros dos tiles do caminho (sem o inicial). */
export function findPath(sx: number, sy: number, gx: number, gy: number): { x: number; y: number }[] | null {
  const s = [Math.floor(sx / T), Math.floor(sy / T)]
  if (!walkable(gx, gy)) return null
  const key = (x: number, y: number) => y * FW + x, sk = key(s[0], s[1]), gk = key(gx, gy)
  const prev = new Map<number, number>([[sk, -1]]), dist = new Map<number, number>([[sk, 0]])
  // fila por custo (custos inteiros pequenos: baldes)
  const buckets: number[][] = [[sk]]
  for (let c = 0; c < buckets.length; c++) {
    const b = buckets[c]
    if (!b) continue
    for (let i = 0; i < b.length; i++) {
      const k = b[i]
      if (dist.get(k) !== c) continue
      if (k === gk) { c = buckets.length; break }
      const x = k % FW, y = Math.floor(k / FW)
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy
        if (!walkable(nx, ny)) continue
        const nk = key(nx, ny), nd = c + stepCost(nx, ny)
        if (nd >= (dist.get(nk) ?? Infinity)) continue
        dist.set(nk, nd); prev.set(nk, k);
        (buckets[nd] ??= []).push(nk)
      }
    }
  }
  if (!prev.has(gk)) return null
  const out: { x: number; y: number }[] = []
  for (let k = gk; k !== sk && k !== -1; k = prev.get(k)!) {
    const tx = k % FW, ty = Math.floor(k / FW)
    out.unshift({ x: doorCenterX(tx, ty) ?? (tx + 0.5) * T, y: (ty + 0.5) * T })
  }
  return out
}

export function pathToSeat(px: number, py: number, r: Room, desk: number) {
  const d = deskOf(r, desk)
  const p = findPath(px, py, d.tx, d.ty - 1)
  if (!p) return null
  return [...p, { x: d.seat.x, y: (d.ty - 0.5) * T }, d.seat]
}

/** tile livre mais perto de (tx,ty), olhando em volta; null se não tem */
function near(tx: number, ty: number) {
  for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [2, 0], [-2, 0], [1, 1], [-1, 1], [0, 2]]) if (walkable(tx + dx, ty + dy)) return { tx: tx + dx, ty: ty + dy }
  return null
}
/** onde o boneco para pra escrever no quadro (null = sala sem quadro) */
export function boardSpot(r: Room) { const q = r.sala.objs.find(o => o.k === 'quadro-branco'); return q ? near(r.ox + q.x + 1, r.oy + 2) : null }
/** onde o boneco mexe na estante (null = sala sem estante) */
/** painel de quartos da sala de vendas (coordenadas da sala) */
export const PAINEIS = { 'painel-quartos': 5, 'painel-placar': 4 } as Record<string, number>
export const paineisOf = (r: Room) => (r.baia ? r.sala.objs.filter(o => o.k in PAINEIS) : [])
/** clique num painel (tile do mundo, conta a parte que sobe 2 tiles) */
export function painelAt(gx: number, gy: number) {
  for (const r of rooms) for (const o of paineisOf(r))
    if (gx >= r.ox + o.x && gx < r.ox + o.x + PAINEIS[o.k] && gy >= r.oy + o.y - 2 && gy <= r.oy + o.y) return o.k
  return null
}
/** jogos da sala de jogos: o móvel que abre cada um e o balão de onde o boneco joga (cassino abre o jogo de aposta) */
export type Jogo = 'cobrinha' | 'penalti' | 'memoria' | 'reflexo'
type Maq = { jogo?: Jogo; cassino?: JogoCassino; act: string }
const MAQUINAS: Record<string, Maq> = {
  fliperama: { jogo: 'cobrinha', act: 'No fliperama' }, pebolim: { jogo: 'penalti', act: 'No pebolim' }, 'mesa-jantar': { jogo: 'memoria', act: 'Jogo de tabuleiro' },
  console: { jogo: 'reflexo', act: 'No videogame' }, 'tapete-gamer': { jogo: 'reflexo', act: 'No videogame' },
  'caca-niquel': { cassino: 'caca', act: 'No caça-níquel' }, 'mesa-roleta': { cassino: 'roleta', act: 'Na roleta' }, 'mesa-cartas': { cassino: 'blackjack', act: 'No blackjack' },
  'totem-crash': { cassino: 'crash', act: 'No crash' }, 'totem-minas': { cassino: 'minas', act: 'Nas minas' }, 'caixa-fichas': { cassino: 'caca', act: 'No caça-níquel' },
}
/** clique num móvel de jogo (tile do mundo): qual jogo e o lugar livre mais perto pra jogar */
/** elevador no fim do corredor (clique): onde ele está e onde o boneco espera na frente */
export function elevadorAt(gx: number, gy: number) {
  const o = hall.find(h => h.k === 'elevador')
  if (!o || gx < o.x || gx >= o.x + 2 || gy < o.y - 2 || gy > o.y) return null
  return elevadorSpot()
}
export const elevadorSpot = () => ({ x: 2 * T, y: (HY0 + 1) * T, tx: 1, ty: HY0 + 1 })

/** sala de jogos do andar: a arrumada (rooms 'jogos-<setor>') ou a original; com o gerente do cassino no andar, ganha a mesa dele */
export function salaJogos(data: unknown, gerente: boolean): Sala {
  const s = parseComodo(data, COMODOS.jogos.sala())
  // a mesa do gerente do cassino agora fica na sala dele (gerência do cassino); some daqui se ficou salva
  return gerente ? { ...s, objs: s.objs.filter(o => o.d !== BOSS_DESK) } : s
}

export function jogoAt(gx: number, gy: number) {
  for (const r of rooms) {
    if (r.kind !== 'jogos') continue
    for (const o of r.sala.objs) {
      const m = MAQUINAS[o.k], d = kd(o)
      if (!m || !d || gx < r.ox + o.x || gx >= r.ox + o.x + d.w || gy < r.oy + o.y - (d.up ?? 0) || gy >= r.oy + o.y + d.h) continue
      const sp = (comodoOf('jogos')?.spots ?? []).filter(s => s.act === m.act)
        .sort((a, b) => Math.hypot(a.x - o.x, a.y - o.y) - Math.hypot(b.x - o.x, b.y - o.y))[0]
      return { jogo: m.jogo, cassino: m.cassino, tx: r.ox + (sp?.x ?? o.x), ty: r.oy + (sp?.y ?? o.y + d.h) }
    }
  }
  return null
}
/** clique num móvel do salão de bingo: abre o bingo e vai pra mesa livre mais perto */
const BINGO_MOVEIS = new Set(['mesa-bingo', 'globo-bingo', 'banca-cartelas', 'painel-bingo', 'letreiro-bingo'])
export function bingoAt(gx: number, gy: number) {
  for (const r of rooms) {
    if (r.kind !== 'bingo') continue
    for (const o of r.sala.objs) {
      const d = kd(o)
      if (!BINGO_MOVEIS.has(o.k) || !d) continue
      const parede = d.camada === 'parede', y0 = parede ? 0 : o.y - (d.up ?? 0), y1 = parede ? 2 : o.y + d.h
      if (gx < r.ox + o.x || gx >= r.ox + o.x + d.w || gy < r.oy + y0 || gy >= r.oy + y1) continue
      const sp = (comodoOf('bingo')?.spots ?? []).filter(s => s.act === 'Jogando bingo')
        .sort((a, b) => Math.hypot(a.x - o.x, a.y - o.y) - Math.hypot(b.x - o.x, b.y - o.y))[0]
      return { tx: r.ox + (sp?.x ?? o.x), ty: r.oy + (sp?.y ?? o.y + d.h) }
    }
  }
  return null
}
export function shelfSpot(r: Room) { const e = r.sala.objs.find(o => o.k === 'estante'); return e ? near(r.ox + e.x + 1, r.oy + e.y + 1) : null }

/** fundo do andar inteiro (estático): salas, vidros, corredor, salas vazias em cinza */
export function renderFloor() {
  const cv = document.createElement('canvas'); cv.width = FW * T; cv.height = FH * T
  const c = cv.getContext('2d')!
  for (const r of rooms) {
    c.save(); c.translate(r.ox * T, r.oy * T)
    c.drawImage(renderRoom(r.sala, false, r.top), 0, 0)
    if (r.top) glassStrip(c, r.sala); else glassWall(c, r.sala)
    if (r.kind === 'vaga') vacant(c, r.w, r.h)
    c.restore()
  }
  // corredor: piso de pedra clara, passadeira da marca no meio, parede nas pontas
  for (let ty = HY0; ty <= HY1; ty++) for (let tx = 0; tx < FW; tx++) {
    if (tx < 1 || tx >= FW - 1) { rect(c, WALL, tx * T, ty * T, T, T); rect(c, WALL_HI, tx < 1 ? T - 2 : tx * T, ty * T, 2, T); continue }
    hallTile(c, tx, ty)
  }
  const rx = 3 * T, rw = (FW - 6) * T, ry = (HY0 + 1) * T + 3, rh = (HY1 - HY0 - 1) * T - 6, mid = ry + (rh >> 1)
  rect(c, 'rgba(40,30,20,.18)', rx, ry + rh, rw, 2)
  rect(c, OUT, rx - 1, ry - 1, rw + 2, rh + 2); rect(c, '#26324F', rx, ry, rw, rh)
  rect(c, '#FFC600', rx + 3, ry + 3, rw - 6, 1); rect(c, '#FFC600', rx + 3, ry + rh - 4, rw - 6, 1)
  rect(c, '#2f3d63', rx + 6, ry + 6, rw - 12, rh - 12)
  for (let k = rx + 20; k < rx + rw - 16; k += 28) { rect(c, '#46578a', k, mid - 3, 1, 7); rect(c, '#46578a', k - 3, mid, 7, 1); rect(c, '#FFC600', k, mid, 1, 1) }
  rect(c, SHADOW, T, HY0 * T, (FW - 2) * T, 3)
  return cv
}
/** ladrilho de pedra clara do corredor, com rejunte e pintinhas */
function hallTile(c: C2D, tx: number, ty: number) {
  const x = tx * T, y = ty * T
  rect(c, (tx + ty) % 2 ? '#e3dccf' : '#ddd5c6', x, y, T, T)
  rect(c, '#cdc3b1', x, y, T, 1); rect(c, '#cdc3b1', x, y, 1, T)
  for (const [a, b] of [[4, 5], [11, 9], [7, 13]]) rect(c, '#d0c6b3', x + 1 + ((a + tx * 3) % 14), y + 1 + ((b + ty * 5) % 14), 1, 1)
}
/** caixa de papelão fechada; (x, y) = canto de cima */
function caixa(c: C2D, x: number, y: number, w: number, h: number) {
  rect(c, OUT, x - 1, y - 1, w + 2, h + 2); rect(c, '#c4925a', x, y, w, h); rect(c, '#d9aa72', x, y, w, 4)
  rect(c, '#a8784a', x, y + 4, w, 1); rect(c, '#efdcae', x + (w >> 1) - 1, y, 3, 5)
}
/** móvel coberto com lençol; (x, y) = canto de cima */
function coberto(c: C2D, x: number, y: number, w: number, h: number) {
  rect(c, SHADOW, x + 1, y + h, w, 3)
  rect(c, OUT, x - 1, y, w + 2, h); rect(c, OUT, x, y - 1, w, h + 2)
  rect(c, '#eceae4', x, y, w, h); rect(c, '#f7f6f2', x + 1, y + 1, w - 2, 4)
  for (let k = 6; k < w - 3; k += 9) rect(c, '#d3d0c7', x + k, y + 5, 1, h - 6)
  rect(c, '#d3d0c7', x, y + h - 2, w, 2)
}
/** escada de pintor aberta; (x, y) = topo */
function escada(c: C2D, x: number, y: number) {
  rect(c, SHADOW, x - 1, y + 25, 14, 3)
  for (const dx of [0, 10]) { rect(c, OUT, x + dx - 1, y - 1, 4, 28); rect(c, '#b9bec7', x + dx, y, 2, 26) }
  for (let k = 5; k < 25; k += 6) { rect(c, OUT, x + 1, k + y - 1, 10, 3); rect(c, '#dfe3e8', x + 2, y + k, 8, 1) }
  rect(c, OUT, x - 1, y - 2, 14, 4); rect(c, '#8e95a1', x, y - 1, 12, 2)
}
/** lata de tinta; (x, y) = canto de cima */
function lata(c: C2D, x: number, y: number, tinta: string) {
  rect(c, SHADOW, x, y + 10, 10, 2)
  rect(c, OUT, x - 1, y - 1, 11, 12); rect(c, '#c8ccd3', x, y, 9, 10); rect(c, tinta, x, y + 3, 9, 4)
  rect(c, '#e9ecf0', x + 1, y, 7, 2); rect(c, tinta, x + 2, y, 5, 1)
}
/** sala sem setor: caixas de mudança, móveis cobertos e material de pintura, um pouco apagada */
function vacant(c: C2D, rw: number, rh: number) {
  // posições pensadas numa sala 24x16; em outra medida, espalha na mesma proporção
  const X = (tx: number) => Math.round(tx * rw / MW) * T, Y = (ty: number) => Math.round(ty * rh / MH) * T
  rect(c, 'rgba(255,255,255,.07)', T, 2 * T, (rw - 2) * T, (rh - 2) * T)
  coberto(c, X(9), Y(6), 3 * T, 22); if (rw >= 18) coberto(c, X(14), Y(6) + 4, 2 * T + 6, 20)
  coberto(c, X(3), Y(11), 2 * T + 8, 24)
  const boxes: [number, number, number, number][] = [
    [X(3), Y(4), 15, 12], [X(3) + 16, Y(4) + 4, 12, 9], [X(3) + 4, Y(4) - 9, 12, 9],
    [X(18), Y(10), 16, 12], [X(18) + 18, Y(10) + 4, 12, 9], [X(18) + 6, Y(10) - 9, 12, 9],
    [X(11), Y(11) + 4, 13, 10], [X(9), Y(12), 15, 12],
  ]
  for (const [x, y, w, h] of boxes) { rect(c, SHADOW, x, y + h + 1, w + 1, 3); caixa(c, x, y, w, h) }
  escada(c, X(19) + 4, Y(4)); lata(c, X(17) + 6, Y(5) + 10, '#7fb2d8'); lata(c, X(21), Y(5) + 12, '#FFC600')
  c.fillStyle = 'rgba(120,126,140,.22)'; c.fillRect(T, 0, (rw - 2) * T, rh * T)
}
/** coisas do corredor, pra entrar na ordem de profundidade */
export const hallDecor = (): Obj[] => hall

/** móveis que não são mesa de trabalho, pra entrar na ordem de profundidade do jogo */
export const furniture = (r: Room): Obj[] => r.sala.objs.filter(o => !isDesk(o.k) && !kd(o).camada)
/** coisas da parede (na sala de baixo a parede é de vidro: janela não entra) */
export const wallObjs = (r: Room): Obj[] => r.sala.objs.filter(o => kd(o).camada === 'parede' && (r.top || o.k !== 'janela'))

const NOTE_COLORS = ['#FBC222', '#7ed6a5', '#f59ab5', '#8ecbf5']
const PILE = 7

/** Pilha de folhas crescendo para cima a partir de (x, y) */
function pile(c: C2D, x: number, y: number, n: number, sticky: boolean) {
  for (let k = 0; k < n; k++) {
    const dx = (k * 5) % 3 - 1, yy = y - k * 2
    rect(c, OUT, x + dx, yy, 8, 2)
    rect(c, k % 3 === 2 ? '#e9ebf0' : '#fbfbf8', x + dx + 1, yy, 6, 1)
  }
  if (sticky && n) rect(c, NOTE_COLORS[0], x + 2, y - (n - 1) * 2, 3, 1)
}

/** Riscos no quadro branco (coordenadas da sala); o último pode estar sendo escrito (0..1, -1 = ninguém escrevendo) */
export function drawBoardMarks(c: C2D, sala: Sala, marks: string[], writing: number) {
  const q = sala.objs.find(o => o.k === 'quadro-branco')
  if (!q || (!marks.length && writing < 0)) return
  const x0 = q.x * T + 1, y0 = T + 2
  rect(c, '#fbfbf8', x0, y0, 3 * T - 2, 8)
  const all = (writing >= 0 ? [...marks, '#2b3556'] : marks).slice(-8)
  all.forEach((col, i) => {
    const full = 18 - ((i * 7) % 3) * 4
    const len = writing >= 0 && i === all.length - 1 ? Math.max(1, Math.round(full * writing)) : full
    rect(c, col, x0 + 2 + (i % 2) * 24, y0 + 1 + Math.floor(i / 2) * 2, len, 1)
  })
}

/** Pasta que o boneco carrega na mão */
export function drawCarry(c: C2D, x: number, y: number) {
  rect(c, OUT, x, y, 7, 5)
  rect(c, '#e2b25a', x + 1, y + 1, 5, 3)
  rect(c, '#fbfbf8', x + 2, y, 3, 1)
}

const BANCADA = { top: '#d8d1c2', hi: '#ece6da', front: '#6f7a91' }
/** telefone de mesa (canto esquerdo da bancada); tocando = luz piscando */
function drawPhone(c: C2D, x: number, y: number, ring: boolean) {
  rect(c, OUT, x, y, 7, 6)
  rect(c, '#2f3442', x + 1, y + 1, 5, 4)
  rect(c, '#9aa3b5', x + 2, y + 3, 3, 1)
  rect(c, OUT, x - 1, y - 2, 9, 3)
  rect(c, '#3c4254', x, y - 1, 7, 1)
  rect(c, ring ? '#e5483a' : '#5fd28a', x + 5, y + 1, 1, 1)
}

/** mesa d (nas coordenadas de quem chama) */
export function drawDesk(c: C2D, d: Desk, boss: boolean, info: { pile: number; inbox: boolean; busy: boolean; owned: boolean; t: number; baia?: { l: boolean; r: boolean } }, look?: DeskLook) {
  const { tx, ty, w: wt } = d
  const x = tx * T, y = ty * T, w = wt * T, m = x + w / 2
  const g = look ?? {}, bx = info.baia
  const col = MESA[g.mesa ?? ''] ?? (boss ? { top: '#6b3f22', hi: '#8a5530', front: '#4a2a16' } : bx ? BANCADA : { top: '#b07a4f', hi: '#c99566', front: '#8a5a36' })
  // baia: lado colado no vizinho sem contorno nem perna, a bancada segue direto
  const el = bx?.l ? 0 : 1, er = bx?.r ? 0 : 1
  rect(c, OUT, x - el, y + 1, w + el + er, 15)
  rect(c, col.top, x, y + 2, w, 8)
  rect(c, col.hi, x, y + 2, w, 1)
  rect(c, col.front, x, y + 10, w, 5)
  mesaExtra(c, g.mesa, x, y, w, info.t)
  if (el) rect(c, '#6e4529', x + 1, y + 15, 2, 1)
  if (er) rect(c, '#6e4529', x + w - 3, y + 15, 2, 1)
  if (bx) {
    // divisória baixa entre um lugar e outro + telefone do lado
    if (bx.l) { rect(c, OUT, x - 2, y - 7, 4, 13); rect(c, '#b9c4dc', x - 1, y - 6, 2, 11); rect(c, '#dfe5f1', x - 1, y - 6, 1, 11) }
    drawPhone(c, x + (bx.l ? 3 : 2), y + 3, info.owned && info.inbox && Math.sin(info.t / 160) > 0)
  }
  if (boss) {
    // plaquinha na frente da mesa + luminária
    rect(c, OUT, m - 9, y + 10, 18, 5)
    rect(c, '#3b2a20', m - 8, y + 11, 16, 3)
    rect(c, '#FBC222', m - 6, y + 12, 12, 1)
    rect(c, OUT, x + 6, y - 4, 1, 8); rect(c, '#FBC222', x + 4, y - 5, 5, 2)
  }
  if (!info.owned) {
    rect(c, '#9aa3b5', m - 4, y + 4, 8, 4)
    return
  }
  // notebook (tampa virada pra câmera)
  const glow = info.busy ? (Math.sin(info.t / 300) > -0.3 ? '#FBC222' : '#ffd965') : '#9aa3b5'
  drawNotebook(c, g.notebook, m, y - 1, glow, info.t)
  if (g.enfeite) drawDecor(c, g.enfeite, x + 1 + (boss ? 10 : 0), y + 6, info.t)
  if (g.chao) drawFloor(c, g.chao, x + w + 3, y + 16, info.t)
  // pedido esperando: luz vermelha piscando no notebook
  if (info.inbox && Math.sin(info.t / 220) > 0) { rect(c, OUT, m + 4, y - 3, 4, 4); rect(c, '#e5483a', m + 5, y - 2, 2, 2) }
  // folhas: quanto mais demanda aberta, mais a mesa enche (direita → esquerda → chão)
  const n = info.pile, off = boss ? 10 : 0
  if (bx) { /* o canto esquerdo é do telefone */ }
  else if (n > PILE) pile(c, x + 1 + off, y + 7, Math.min(n - PILE, PILE), false)
  else { rect(c, '#ffffff', x + 3 + off, y + 4, 3, 4); rect(c, '#ffffff', x + 6 + off, y + 5, 1, 2) }
  pile(c, x + w - 9 - (boss ? 4 : 0), y + 7, Math.min(n, PILE), info.inbox)
  // com armário de pastas, o que iria pro chão fica guardado nele (do lado esquerdo da mesa)
  if (g.arquivo) { drawArquivo(c, g.arquivo, x - 15, y + 16, Math.max(0, n - 2 * PILE), info.t); return }
  for (let k = 0; k < Math.min(n - 2 * PILE, 6); k++) {
    const fx = x + 1 + ((k * 11) % (w - 8)), fy = y + 17 + (k % 2) * 3
    rect(c, OUT, fx, fy, 7, 3)
    rect(c, '#fbfbf8', fx + 1, fy + 1, 5, 1)
  }
}
