import { BOSS_DESK, MH, MW, OUT, rect, T, type C2D } from './base'
import { drawDecor, drawFloor, drawNotebook, MESA, mesaExtra, type DeskLook } from './props'
import { defaultDesk, deskFrom, isDesk, kd, original, renderRoom, solidGrid, type Desk, type Obj, type Sala } from './sala'

export * from './base'

/** A sala atual (vem de rooms/escritorio). Tudo que é posição sai daqui. */
let layout: Sala | null = null
let version = 0
let solid: boolean[][] | null = null
let deskTile: (number | null)[][] | null = null
/** tiles de parede que viram passagem (portas abertas) */
let doors = new Set<number>()

const L = () => (layout ??= original())
export const getLayout = () => L()
export const layoutVersion = () => version
export function setLayout(s: Sala, open: [number, number][] = []) { layout = s; doors = new Set(open.map(([x, y]) => y * MW + x)); version++; solid = null; deskTile = null }

const desks = () => L().objs.filter(o => isDesk(o.k) && o.d !== undefined)
export const deskIds = () => desks().map(o => o.d!)
export const hasDesk = (i: number) => desks().some(o => o.d === i)
export function deskOf(i: number): Desk {
  const o = desks().find(o => o.d === i)
  return o ? deskFrom(o) : defaultDesk(i)
}

function grids() {
  if (!solid || !deskTile) {
    solid = solidGrid(L())
    deskTile = Array.from({ length: MH }, () => Array<number | null>(MW).fill(null))
    for (const o of desks()) for (let k = 0; k < kd(o).w; k++) deskTile[o.y][o.x + k] = o.d!
  }
  return { solid, deskTile }
}

const tileSolid = (tx: number, ty: number) => {
  if (tx >= 0 && tx < MW && doors.has(ty * MW + tx)) return false
  if (tx < 1 || ty < 2 || tx >= MW - 1 || ty >= MH - 1) return true
  return L().div[ty][tx] || grids().solid[ty][tx]
}

/** pixel bloqueado? Na mesa de trabalho só a metade da frente bloqueia (a cadeira fica atrás) */
export function blocked(x: number, y: number) {
  const tx = Math.floor(x / T), ty = Math.floor(y / T)
  if (tx >= 0 && ty >= 0 && tx < MW && ty < MH && grids().deskTile[ty][tx] !== null) return y - ty * T >= 9
  return tileSolid(tx, ty)
}

export function deskAtTile(tx: number, ty: number): number | null {
  for (const o of desks()) if (tx >= o.x && tx < o.x + kd(o).w && (ty === o.y || ty === o.y - 1)) return o.d!
  return null
}

const walkable = (tx: number, ty: number) => !tileSolid(tx, ty)

/** BFS em tiles; devolve centros dos tiles do caminho (sem o inicial). */
export function findPath(sx: number, sy: number, gx: number, gy: number): { x: number; y: number }[] | null {
  const s = [Math.floor(sx / T), Math.floor(sy / T)]
  if (!walkable(gx, gy)) return null
  const key = (x: number, y: number) => y * MW + x
  const prev = new Map<number, number>([[key(s[0], s[1]), -1]])
  const q = [[s[0], s[1]]]
  while (q.length) {
    const [x, y] = q.shift()!
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
    out.unshift({ x: (k % MW + 0.5) * T, y: (Math.floor(k / MW) + 0.5) * T })
  }
  return out
}

export function pathToSeat(px: number, py: number, desk: number) {
  const d = deskOf(desk)
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
export function boardSpot() { const q = L().objs.find(o => o.k === 'quadro-branco'); return q ? near(q.x + 1, 2) : null }
/** onde o boneco mexe na estante (null = sala sem estante) */
export function shelfSpot() { const e = L().objs.find(o => o.k === 'estante'); return e ? near(e.x + 1, e.y + 1) : null }

export const renderBackground = () => renderRoom(L())

/** móveis que não são mesa de trabalho, pra entrar na ordem de profundidade do jogo */
export const furniture = (): Obj[] => L().objs.filter(o => !isDesk(o.k) && !kd(o).camada)
export const wallObjs = (): Obj[] => L().objs.filter(o => kd(o).camada === 'parede')

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

/** Riscos no quadro branco; o último pode estar sendo escrito (0..1, -1 = ninguém escrevendo) */
export function drawBoardMarks(c: C2D, marks: string[], writing: number) {
  const q = L().objs.find(o => o.k === 'quadro-branco')
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

export function drawDesk(c: C2D, i: number, info: { pile: number; inbox: boolean; busy: boolean; owned: boolean; t: number }, look?: DeskLook) {
  const { tx, ty, w: wt } = deskOf(i)
  const x = tx * T, y = ty * T, w = wt * T, m = x + w / 2
  const boss = i === BOSS_DESK
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
