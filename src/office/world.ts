import { MH, MW, OUT, rect, SHADOW, T, WALL, WALL_HI, type C2D } from './base'
import { exitX, glassDoorX, glassStrip, glassWall } from './andar'
import { drawDecor, drawFloor, drawNotebook, MESA, mesaExtra, type DeskLook } from './props'
import { defaultDesk, deskFrom, isDesk, kd, PISOS, renderRoom, solidGrid, type Desk, type Obj, type Sala } from './sala'

export * from './base'

/** O andar inteiro num mapa só: 2 salas em cima, corredor no meio, 2 salas embaixo (frente a frente). */
export const FW = 2 * MW
/** linhas do corredor (globais) */
export const HY0 = MH, HY1 = MH + 5
export const FH = HY1 + 1 + MH
const HALL_DECOR: [number, number][] = [[1, HY0], [FW - 2, HY0], [1, HY1], [FW - 2, HY1], [MW - 1, HY0], [MW, HY0], [MW - 1, HY1], [MW, HY1]]

export interface Room {
  slot: number
  /** setor dono da sala; null = sala vazia (cinza, não entra) */
  id: string | null
  sala: Sala
  /** origem em tiles no andar */
  ox: number; oy: number
  /** de cima do corredor (vidro embaixo) ou de baixo (vidro em cima) */
  top: boolean
  /** tile da esquerda da porta (local, 2 de largura) */
  door: number
  solid: boolean[][]
  deskTile: (number | null)[][]
}

let rooms: Room[] = []
let passable: boolean[] = []
let version = 0
const hallSolid = new Set<number>(HALL_DECOR.map(([x, y]) => y * FW + x))

export const floorVersion = () => version
export const getRooms = () => rooms
export const roomOfId = (id: string) => rooms.find(r => r.id === id)

export function emptySala(): Sala {
  return { piso: Array.from({ length: MH }, () => Array.from({ length: MW }, () => 'madeira' as const)), div: Array.from({ length: MH }, () => Array<boolean>(MW).fill(false)), objs: [] }
}

/** monta o andar: specs[k] = sala do slot k (id null = vazia) */
export function setFloor(specs: { id: string | null; sala: Sala }[]) {
  rooms = specs.map(({ id, sala }, slot) => {
    const top = slot < 2
    const deskTile = Array.from({ length: MH }, () => Array<number | null>(MW).fill(null))
    for (const o of sala.objs) if (isDesk(o.k) && o.d !== undefined) for (let k = 0; k < kd(o).w; k++) deskTile[o.y][o.x + k] = o.d
    return { slot, id, sala, ox: (slot % 2) * MW, oy: top ? 0 : HY1 + 1, top, door: top ? exitX(sala) : glassDoorX(sala), solid: solidGrid(sala), deskTile }
  })
  version++
}
/** por quais portas eu passo (por slot) */
export function setPassable(open: boolean[]) { passable = open }

/** -1 = corredor; senão o slot da sala (porta conta como sala) */
export function regionAt(gx: number, gy: number) {
  if (gy >= HY0 && gy <= HY1) return -1
  return (gx >= MW ? 1 : 0) + (gy > HY1 ? 2 : 0)
}
export const regionOfPx = (x: number, y: number) => regionAt(Math.floor(x / T), Math.floor(y / T))

const isDoor = (r: Room, lx: number, ly: number) => (lx === r.door || lx === r.door + 1) && (r.top ? ly === MH - 1 : ly >= 0 && ly <= 1)
/** slot da porta nesse tile global, ou -1 */
export function doorAtTile(gx: number, gy: number) {
  const k = gx >= 0 && gy >= 0 && gx < FW && gy < FH ? regionAt(gx, gy) : -1, r = k >= 0 ? rooms[k] : undefined
  return r && isDoor(r, gx - r.ox, gy - r.oy) ? k : -1
}
/** centro da porta (px global, na borda com o corredor) e o tile do corredor bem na frente dela */
export function doorSpot(r: Room) {
  const x = (r.ox + r.door + 1) * T
  return r.top ? { x, y: MH * T, tx: r.ox + r.door, ty: HY0 } : { x, y: (HY1 + 1) * T, tx: r.ox + r.door, ty: HY1 }
}

function tileSolid(gx: number, gy: number) {
  if (gx < 0 || gy < 0 || gx >= FW || gy >= FH) return true
  const k = regionAt(gx, gy)
  if (k < 0) return gx < 1 || gx >= FW - 1 || hallSolid.has(gy * FW + gx)
  const r = rooms[k]
  if (!r) return true
  const lx = gx - r.ox, ly = gy - r.oy
  if (isDoor(r, lx, ly)) return !r.id || !passable[k]
  if (!r.id || lx < 1 || ly < 2 || lx >= MW - 1 || ly >= MH - 1) return true
  return r.sala.div[ly][lx] || r.solid[ly][lx]
}

/** pixel bloqueado? Na mesa de trabalho só a metade da frente bloqueia (a cadeira fica atrás) */
export function blocked(x: number, y: number) {
  const gx = Math.floor(x / T), gy = Math.floor(y / T), k = gx >= 0 && gy >= 0 && gx < FW && gy < FH ? regionAt(gx, gy) : -1
  const r = k >= 0 ? rooms[k] : undefined
  if (r?.id && r.deskTile[gy - r.oy]?.[gx - r.ox] != null) return y - gy * T >= 9
  return tileSolid(gx, gy)
}

const desks = (r: Room) => r.sala.objs.filter(o => isDesk(o.k) && o.d !== undefined)
export const deskIds = (r: Room) => desks(r).map(o => o.d!)
export const hasDesk = (r: Room, i: number) => desks(r).some(o => o.d === i)
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
  if (!r?.id) return null
  const lx = gx - r.ox, ly = gy - r.oy
  for (const o of desks(r)) if (lx >= o.x && lx < o.x + kd(o).w && (ly === o.y || ly === o.y - 1)) return { r, i: o.d! }
  return null
}

const walkable = (tx: number, ty: number) => !tileSolid(tx, ty)

/** BFS em tiles; devolve centros dos tiles do caminho (sem o inicial). */
export function findPath(sx: number, sy: number, gx: number, gy: number): { x: number; y: number }[] | null {
  const s = [Math.floor(sx / T), Math.floor(sy / T)]
  if (!walkable(gx, gy)) return null
  const key = (x: number, y: number) => y * FW + x
  const prev = new Map<number, number>([[key(s[0], s[1]), -1]])
  const q = [[s[0], s[1]]]
  for (let h = 0; h < q.length; h++) {
    const [x, y] = q[h]
    if (x === gx && y === gy) break
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy
      if (!walkable(nx, ny) || prev.has(key(nx, ny))) continue
      prev.set(key(nx, ny), key(x, y))
      q.push([nx, ny])
    }
  }
  if (!prev.has(key(gx, gy))) return null
  const out: { x: number; y: number }[] = []
  for (let k = key(gx, gy); k !== key(s[0], s[1]) && k !== -1; k = prev.get(k)!) {
    out.unshift({ x: (k % FW + 0.5) * T, y: (Math.floor(k / FW) + 0.5) * T })
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
export function shelfSpot(r: Room) { const e = r.sala.objs.find(o => o.k === 'estante'); return e ? near(r.ox + e.x + 1, r.oy + e.y + 1) : null }

/** fundo do andar inteiro (estático): salas, vidros, corredor, salas vazias em cinza */
export function renderFloor() {
  const cv = document.createElement('canvas'); cv.width = FW * T; cv.height = FH * T
  const c = cv.getContext('2d')!
  for (const r of rooms) {
    c.save(); c.translate(r.ox * T, r.oy * T)
    c.drawImage(renderRoom(r.sala, false, r.top), 0, 0)
    if (r.top) glassStrip(c, r.sala); else glassWall(c, r.sala)
    if (!r.id) { c.fillStyle = 'rgba(150,155,165,.55)'; c.fillRect(T, 0, (MW - 2) * T, MH * T) }
    c.restore()
  }
  // corredor: carpete entre as salas, parede nas pontas
  for (let ty = HY0; ty <= HY1; ty++) for (let tx = 0; tx < FW; tx++) {
    if (tx < 1 || tx >= FW - 1) { rect(c, WALL, tx * T, ty * T, T, T); rect(c, WALL_HI, tx < 1 ? T - 2 : tx * T, ty * T, 2, T); continue }
    PISOS.carpete.draw(c, tx * T, ty * T)
  }
  rect(c, SHADOW, T, HY0 * T, (FW - 2) * T, 3)
  return cv
}
/** plantas do corredor, pra entrar na ordem de profundidade */
export const hallDecor = (): Obj[] => HALL_DECOR.map(([x, y], i) => ({ id: -1 - i, k: 'planta', x, y }))

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

/** mesa d (nas coordenadas de quem chama) */
export function drawDesk(c: C2D, d: Desk, boss: boolean, info: { pile: number; inbox: boolean; busy: boolean; owned: boolean; t: number }, look?: DeskLook) {
  const { tx, ty, w: wt } = d
  const x = tx * T, y = ty * T, w = wt * T, m = x + w / 2
  const g = look ?? {}
  const col = MESA[g.mesa ?? ''] ?? (boss ? { top: '#6b3f22', hi: '#8a5530', front: '#4a2a16' } : { top: '#b07a4f', hi: '#c99566', front: '#8a5a36' })
  rect(c, OUT, x - 1, y + 1, w + 2, 15)
  rect(c, col.top, x, y + 2, w, 8)
  rect(c, col.hi, x, y + 2, w, 1)
  rect(c, col.front, x, y + 10, w, 5)
  mesaExtra(c, g.mesa, x, y, w, info.t)
  rect(c, '#6e4529', x + 1, y + 15, 2, 1)
  rect(c, '#6e4529', x + w - 3, y + 15, 2, 1)
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
  if (n > PILE) pile(c, x + 1 + off, y + 7, Math.min(n - PILE, PILE), false)
  else { rect(c, '#ffffff', x + 3 + off, y + 4, 3, 4); rect(c, '#ffffff', x + 6 + off, y + 5, 1, 2) }
  pile(c, x + w - 9 - (boss ? 4 : 0), y + 7, Math.min(n, PILE), info.inbox)
  for (let k = 0; k < Math.min(n - 2 * PILE, 6); k++) {
    const fx = x + 1 + ((k * 11) % (w - 8)), fy = y + 17 + (k % 2) * 3
    rect(c, OUT, fx, fy, 7, 3)
    rect(c, '#fbfbf8', fx + 1, fy + 1, 5, 1)
  }
}
