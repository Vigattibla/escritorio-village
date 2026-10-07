export const T = 16
export const MW = 30
export const MH = 20
export const MAX_DESKS = 12
/** Mesa do Gerente (fila de baixo, centralizada) — fora do sorteio de mesas */
export const BOSS_DESK = MAX_DESKS
export const DESKS = MAX_DESKS + 1

// '#' parede  'f' face da parede  'w' janela  'B' quadro  '.' piso  ',' carpete  '_' piso copa
// '|' '-' divisórias  'P' planta  'T' mesa  'S' sofá  'K' balcão  'R' estante  'D' mesa de trabalho
export type Cell = '#' | 'f' | 'w' | 'B' | '.' | ',' | '_' | '|' | '-' | 'P' | 'T' | 'S' | 'K' | 'R' | 'D'
const SOLID = new Set<Cell>(['#', 'f', 'w', 'B', '|', '-', 'P', 'T', 'S', 'K', 'R'])

export function deskOf(i: number) {
  if (i === BOSS_DESK) return { tx: 7, ty: 17, w: 3, seat: { x: 8 * T + 8, y: 17 * T + 8 } }
  const col = i % 4
  const row = Math.floor(i / 4)
  const tx = 2 + col * 4
  const ty = 4 + row * 5
  return { tx, ty, w: 2, seat: { x: (tx + 1) * T, y: ty * T + 8 } }
}

function build(): Cell[][] {
  const g: Cell[][] = Array.from({ length: MH }, () => Array<Cell>(MW).fill('.'))
  const set = (x: number, y: number, c: Cell) => { g[y][x] = c }
  for (let x = 0; x < MW; x++) { set(x, 0, '#'); set(x, 1, 'f'); set(x, MH - 1, '#') }
  for (let y = 0; y < MH; y++) { set(0, y, '#'); set(MW - 1, y, '#') }
  for (const x of [3, 4, 8, 9, 22, 23, 26, 27]) set(x, 1, 'w')
  for (const x of [13, 14, 15]) set(x, 1, 'B')
  // sala de reunião (topo direita) e copa (baixo direita)
  for (let y = 2; y <= 9; y++) for (let x = 20; x <= 28; x++) set(x, y, ',')
  for (let y = 11; y <= 18; y++) for (let x = 20; x <= 28; x++) set(x, y, '_')
  for (let y = 2; y < MH - 1; y++) if (![5, 6, 14, 15].includes(y)) set(19, y, '|')
  for (let x = 19; x <= 28; x++) if (![23, 24].includes(x)) set(x, 10, '-')
  for (let y = 4; y <= 7; y++) for (let x = 22; x <= 26; x++) set(x, y, 'T')
  for (let x = 21; x <= 24; x++) set(x, 17, 'S')
  for (let x = 25; x <= 27; x++) set(x, 11, 'K')
  for (const x of [5, 6, 7]) set(x, 2, 'R')
  for (const [x, y] of [[1, 2], [18, 2], [1, 18], [18, 18], [28, 2], [20, 9], [28, 18], [20, 11]]) set(x, y, 'P')
  for (let i = 0; i < DESKS; i++) { const d = deskOf(i); for (let k = 0; k < d.w; k++) set(d.tx + k, d.ty, 'D') }
  return g
}

export const grid = build()

export function cellAt(tx: number, ty: number): Cell {
  if (tx < 0 || ty < 0 || tx >= MW || ty >= MH) return '#'
  return grid[ty][tx]
}

export function blocked(x: number, y: number) {
  const tx = Math.floor(x / T)
  const ty = Math.floor(y / T)
  const c = cellAt(tx, ty)
  if (c === 'D') return y - ty * T >= 9
  return SOLID.has(c)
}

export function deskAtTile(tx: number, ty: number): number | null {
  for (let i = 0; i < DESKS; i++) {
    const d = deskOf(i)
    if (tx >= d.tx && tx < d.tx + d.w && (ty === d.ty || ty === d.ty - 1)) return i
  }
  return null
}

const walkable = (tx: number, ty: number) => { const c = cellAt(tx, ty); return !SOLID.has(c) && c !== 'D' }

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

// ---------- arte ----------
const OUT = '#1d1a2b'
type C2D = CanvasRenderingContext2D

function rect(c: C2D, color: string, x: number, y: number, w: number, h: number) {
  c.fillStyle = color
  c.fillRect(x, y, w, h)
}

function wood(c: C2D, x: number, y: number) {
  rect(c, '#e6c7a1', x, y, T, T)
  for (let r = 0; r < 4; r++) {
    rect(c, '#d8b48a', x, y + r * 4 + 3, T, 1)
    rect(c, '#d8b48a', x + ((x / T + r) % 2 ? 4 : 11), y + r * 4, 1, 3)
  }
}
function carpet(c: C2D, x: number, y: number) {
  rect(c, '#6d86bf', x, y, T, T)
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if ((i + j) % 2 === 0) rect(c, '#7891c9', x + i * 4 + 1, y + j * 4 + 1, 1, 1)
}
function tiles(c: C2D, x: number, y: number) {
  rect(c, '#efe9dc', x, y, T, T)
  rect(c, '#e2dac7', x, y, 8, 8)
  rect(c, '#e2dac7', x + 8, y + 8, 8, 8)
}
function wallFace(c: C2D, x: number, y: number) {
  rect(c, '#3d4a75', x, y, T, 11)
  rect(c, '#44527f', x + 3, y, 1, 11)
  rect(c, '#44527f', x + 11, y, 1, 11)
  rect(c, '#f0e8db', x, y + 11, T, 4)
  rect(c, '#c9b9a0', x, y + 15, T, 1)
}
function floorFor(c: C2D, x: number, y: number, tx: number, ty: number) {
  const left = cellAt(tx - 1, ty)
  if (tx >= 20 && ty >= 11) tiles(c, x, y)
  else if (tx >= 20 && ty <= 9) carpet(c, x, y)
  else if (left === ',' ) carpet(c, x, y)
  else wood(c, x, y)
}

export function renderBackground(): HTMLCanvasElement {
  const cv = document.createElement('canvas')
  cv.width = MW * T
  cv.height = MH * T
  const c = cv.getContext('2d')!
  for (let ty = 0; ty < MH; ty++) {
    for (let tx = 0; tx < MW; tx++) {
      const x = tx * T, y = ty * T
      const cell = grid[ty][tx]
      const same = (dx: number, dy: number) => cellAt(tx + dx, ty + dy) === cell
      switch (cell) {
        case '#':
          rect(c, '#2b3556', x, y, T, T)
          if (ty === MH - 1 || tx === 0 || tx === MW - 1) rect(c, '#36426a', x, y, T, 2)
          break
        case 'f': wallFace(c, x, y); break
        case 'w':
          wallFace(c, x, y)
          rect(c, '#f5efe6', x + 1, y + 1, 14, 9)
          rect(c, '#a8dcf5', x + 2, y + 2, 12, 7)
          rect(c, '#d6f0fb', x + 3, y + 3, 2, 5)
          rect(c, '#f5efe6', x + 7, y + 2, 1, 7)
          break
        case 'B':
          wallFace(c, x, y)
          rect(c, '#9aa3b5', x, y + 1, T, 10)
          rect(c, '#fbfbf8', same(-1, 0) ? x : x + 1, y + 2, (same(-1, 0) ? 0 : -1) + (same(1, 0) ? 16 : 15), 8)
          if (tx === 13) { rect(c, '#e05a47', x + 3, y + 4, 7, 1); rect(c, '#e05a47', x + 3, y + 6, 4, 1) }
          if (tx === 14) { rect(c, '#4a90d9', x + 2, y + 4, 9, 1); rect(c, '#3fa66b', x + 2, y + 6, 6, 1); rect(c, '#3fa66b', x + 2, y + 8, 3, 1) }
          if (tx === 15) { rect(c, '#FBC222', x + 2, y + 3, 5, 5); rect(c, '#f59ab5', x + 8, y + 5, 4, 4) }
          break
        case '.': wood(c, x, y); break
        case ',': carpet(c, x, y); break
        case '_': tiles(c, x, y); break
        case '|':
          floorFor(c, x, y, tx, ty)
          rect(c, '#55628f', x + 6, y, 4, T)
          rect(c, '#3d4a75', x + 9, y, 1, T)
          break
        case '-':
          tiles(c, x, y)
          rect(c, '#55628f', x, y, T, 4)
          rect(c, '#3d4a75', x, y + 4, T, 8)
          rect(c, '#f0e8db', x, y + 12, T, 4)
          break
        case 'P':
          floorFor(c, x, y, tx, ty)
          rect(c, '#2f8a56', x + 3, y + 1, 10, 9)
          rect(c, '#3fa66b', x + 4, y + 0, 8, 8)
          rect(c, '#5cc283', x + 5, y + 1, 3, 3)
          rect(c, '#2f8a56', x + 1, y + 4, 3, 4)
          rect(c, '#2f8a56', x + 12, y + 4, 3, 4)
          rect(c, '#c0643b', x + 4, y + 10, 8, 6)
          rect(c, '#d97b4f', x + 3, y + 9, 10, 2)
          break
        case 'T':
          carpet(c, x, y)
          rect(c, '#bf8a5c', x, y, T, T)
          if (!same(0, -1)) rect(c, '#d6a273', x, y, T, 2)
          if (!same(0, 1)) rect(c, '#87583a', x, y + 12, T, 4)
          if (!same(-1, 0)) rect(c, OUT, x, y, 1, T)
          if (!same(1, 0)) rect(c, OUT, x + 15, y, 1, T)
          if (!same(0, -1)) rect(c, OUT, x, y, T, 1)
          if (!same(0, 1)) rect(c, OUT, x, y + 15, T, 1)
          break
        case 'S':
          tiles(c, x, y)
          rect(c, '#c9604a', x, y + 1, T, 7)
          rect(c, '#ee9a80', x, y + 8, T, 6)
          rect(c, '#c9604a', x, y + 14, T, 2)
          if (!same(-1, 0)) rect(c, '#b4513d', x, y + 3, 3, 13)
          if (!same(1, 0)) rect(c, '#b4513d', x + 13, y + 3, 3, 13)
          rect(c, '#d97d65', x + 15, y + 8, 1, 6)
          break
        case 'K':
          tiles(c, x, y)
          rect(c, '#8d96a8', x, y + 6, T, 10)
          rect(c, '#d9dde5', x, y + 2, T, 5)
          rect(c, '#bfc5d1', x, y + 6, T, 1)
          if (tx === 25) { rect(c, '#2d2d33', x + 4, y - 4, 8, 9); rect(c, '#e05a47', x + 9, y - 2, 1, 1); rect(c, '#555', x + 6, y + 2, 4, 2) }
          if (tx === 26) { rect(c, '#fff', x + 3, y + 1, 3, 4); rect(c, '#fff', x + 8, y + 1, 3, 4); rect(c, '#FBC222', x + 8, y + 1, 3, 1) }
          break
        case 'R':
          wood(c, x, y)
          rect(c, '#8a5a36', x, y - 4, T, 18)
          rect(c, '#6e4529', x, y + 4, T, 1)
          rect(c, '#6e4529', x, y + 13, T, 1)
          ;['#e05a47', '#4a90d9', '#FBC222', '#3fa66b', '#8e5bd6', '#f4f4f4'].forEach((col, i) => {
            rect(c, col, x + 1 + i * 2 + (tx % 2), y - 2 + (i % 2), 2, 6 - (i % 2))
            rect(c, col, x + 2 + i * 2, y + 6 + ((i + 1) % 2), 2, 7 - ((i + 1) % 2))
          })
          break
        case 'D': wood(c, x, y); break
      }
    }
  }
  // tapete do Gerente (vinho com friso dourado)
  {
    const x0 = 6 * T + 6, y0 = 15 * T + 10, w = 4 * T + 4, h = 3 * T + 2
    rect(c, '#5a1f2c', x0, y0, w, h)
    rect(c, '#7a2e3a', x0 + 2, y0 + 2, w - 4, h - 4)
    rect(c, '#FBC222', x0 + 4, y0 + 4, w - 8, 1); rect(c, '#FBC222', x0 + 4, y0 + h - 5, w - 8, 1)
    rect(c, '#FBC222', x0 + 4, y0 + 4, 1, h - 8); rect(c, '#FBC222', x0 + w - 5, y0 + 4, 1, h - 8)
  }
  // cadeiras das mesas (ficam atrás do personagem)
  for (let i = 0; i < DESKS; i++) {
    const { seat } = deskOf(i)
    if (i === BOSS_DESK) {
      // cadeira executiva: encosto alto de couro azul
      rect(c, OUT, seat.x - 9, seat.y - 31, 18, 20)
      rect(c, '#0B235D', seat.x - 8, seat.y - 30, 16, 18)
      rect(c, '#1d3a85', seat.x - 6, seat.y - 28, 12, 3)
      rect(c, '#07163d', seat.x - 1, seat.y - 24, 2, 10)
      rect(c, '#FBC222', seat.x - 2, seat.y - 30, 4, 1)
      rect(c, OUT, seat.x - 11, seat.y - 18, 3, 7); rect(c, OUT, seat.x + 8, seat.y - 18, 3, 7)
      continue
    }
    rect(c, '#3d4457', seat.x - 6, seat.y - 22, 12, 10)
    rect(c, '#525a70', seat.x - 5, seat.y - 21, 10, 2)
  }
  // cadeiras da sala de reunião
  for (let x = 22; x <= 26; x++) {
    rect(c, '#3d4457', x * T + 4, 3 * T + 6, 8, 8)
    rect(c, '#3d4457', x * T + 4, 8 * T + 2, 8, 8)
  }
  return cv
}

const NOTE_COLORS = ['#FBC222', '#7ed6a5', '#f59ab5', '#8ecbf5']

export function drawDesk(c: C2D, i: number, info: { notes: number; inbox: boolean; busy: boolean; owned: boolean; t: number }) {
  const { tx, ty, w: wt } = deskOf(i)
  const x = tx * T, y = ty * T, w = wt * T, m = x + w / 2
  const boss = i === BOSS_DESK
  rect(c, OUT, x - 1, y + 1, w + 2, 15)
  rect(c, boss ? '#6b3f22' : '#b07a4f', x, y + 2, w, 8)
  rect(c, boss ? '#8a5530' : '#c99566', x, y + 2, w, 1)
  rect(c, boss ? '#4a2a16' : '#8a5a36', x, y + 10, w, 5)
  rect(c, '#6e4529', x + 1, y + 15, 2, 1)
  rect(c, '#6e4529', x + w - 3, y + 15, 2, 1)
  if (boss) {
    // plaquinha na frente da mesa + luminária
    rect(c, OUT, m - 9, y + 10, 18, 5)
    rect(c, '#0B235D', m - 8, y + 11, 16, 3)
    rect(c, '#FBC222', m - 6, y + 12, 12, 1)
    rect(c, OUT, x + 6, y - 4, 1, 8); rect(c, '#FBC222', x + 4, y - 5, 5, 2)
  }
  if (!info.owned) {
    rect(c, '#9aa3b5', m - 4, y + 4, 8, 4)
    return
  }
  // notebook (tampa virada pra câmera)
  rect(c, OUT, m - 7, y - 1, 14, 8)
  rect(c, '#c9ced8', m - 6, y, 12, 6)
  const glow = info.busy ? (Math.sin(info.t / 300) > -0.3 ? '#FBC222' : '#ffd965') : '#9aa3b5'
  rect(c, glow, m - 1, y + 2, 2, 2)
  rect(c, '#9aa3b5', m - 7, y + 7, 14, 1)
  // pedido esperando: luz vermelha piscando no notebook
  if (info.inbox && Math.sin(info.t / 220) > 0) { rect(c, OUT, m + 4, y - 3, 4, 4); rect(c, '#e5483a', m + 5, y - 2, 2, 2) }
  // caneca
  rect(c, '#ffffff', x + 3, y + 4, 3, 4)
  rect(c, '#ffffff', x + 6, y + 5, 1, 2)
  // pasta de tarefas (folhas aparecendo = tarefas a fazer)
  const fx = x + w - 8 - (boss ? 4 : 0)
  for (let n = 0; n < Math.min(info.notes, 3); n++) rect(c, NOTE_COLORS[n], fx + 1 + n, y + 2 - n, 5, 2)
  rect(c, OUT, fx, y + 3, 8, 6)
  rect(c, '#e2b25a', fx + 1, y + 4, 6, 4)
  rect(c, '#c8963f', fx + 1, y + 4, 2, 1)
}
