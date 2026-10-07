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

/** Onde o boneco para para escrever no quadro / mexer na estante (tile) */
export const BOARD_SPOT = { tx: 14, ty: 2 }
export const SHELF_SPOT = { tx: 6, ty: 3 }

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
function disc(c: C2D, cx: number, cy: number, r: number, color: string) {
  for (let dy = -r; dy <= r; dy++) {
    const h = Math.round(Math.sqrt((r + 0.4) ** 2 - dy * dy))
    rect(c, color, cx - h, cy + dy, 2 * h + 1, 1)
  }
}
/** Caixa com contorno de 1px */
function box(c: C2D, color: string, x: number, y: number, w: number, h: number) {
  rect(c, OUT, x - 1, y - 1, w + 2, h + 2)
  rect(c, color, x, y, w, h)
}

const PLANK = ['#dcb68b', '#d5ad81', '#e1bd93']
const WALL = '#3b302c', WALL_HI = '#5a4840'
const PAPER = '#f1e6d2', PAPER_2 = '#e9dbc3'
const WAIN = '#a8774c', WAIN_D = '#8e6240', WAIN_HI = '#bd8c5f', BASE = '#5e3f2a'
const SHADOW = 'rgba(70,40,20,.2)'
const BOOKS = ['#d9694a', '#e0b04a', '#7a8b3a', '#5b6e8f', '#f1e6d2', '#8a6bc8', '#c0643b']

/** Piso de tábuas corridas na horizontal, emenda desencontrada e tom variando por tábua */
function wood(c: C2D, x: number, y: number) {
  for (let r = 0; r < 4; r++) {
    const R = y / 4 + r, o = (R * 13) % 40, py = y + r * 4
    let px = x
    while (px < x + T) {
      const seg = Math.floor((px + o) / 40), end = Math.min(x + T, (seg + 1) * 40 - o)
      rect(c, PLANK[(seg * 7 + R * 5) % 3], px, py, end - px, 3)
      rect(c, '#c49a6c', px, py + 3, end - px, 1)
      if ((px + o) % 40 === 0) rect(c, '#b48a5f', px, py, 1, 3)
      px = end
    }
  }
}
function tiles(c: C2D, x: number, y: number) {
  rect(c, '#efe6d6', x, y, T, T)
  rect(c, '#e5d9c4', x, y, 8, 8)
  rect(c, '#e5d9c4', x + 8, y + 8, 8, 8)
  rect(c, '#d9cbb3', x, y, T, 1)
  rect(c, '#d9cbb3', x, y, 1, T)
}
/** Parede alta: a linha 0 é a metade de cima (papel de parede), a linha 1 tem lambri e rodapé */
function upperWall(c: C2D, x: number, y: number) {
  rect(c, WALL, x, y, T, 4)
  rect(c, WALL_HI, x, y + 4, T, 1)
  rect(c, PAPER, x, y + 5, T, 11)
  for (let i = 2; i < T; i += 4) rect(c, PAPER_2, x + i, y + 5, 1, 11)
}
function wallFace(c: C2D, x: number, y: number) {
  rect(c, PAPER, x, y, T, 7)
  for (let i = 2; i < T; i += 4) rect(c, PAPER_2, x + i, y, 1, 7)
  rect(c, '#d9bf98', x, y + 7, T, 1)
  rect(c, WAIN, x, y + 8, T, 6)
  rect(c, WAIN_HI, x, y + 8, T, 1)
  rect(c, WAIN_D, x + 7, y + 9, 1, 5)
  rect(c, WAIN_D, x + 15, y + 9, 1, 5)
  rect(c, BASE, x, y + 14, T, 2)
}

function plant(c: C2D, x: number, y: number) {
  const blobs = [[x + 3, y - 6, 10, 13], [x + 1, y - 2, 14, 7], [x + 5, y - 9, 6, 4]]
  for (const [bx, by, bw, bh] of blobs) rect(c, OUT, bx - 1, by - 1, bw + 2, bh + 2)
  for (const [bx, by, bw, bh] of blobs) rect(c, '#2f7a4f', bx, by, bw, bh)
  rect(c, '#3f9a62', x + 4, y - 7, 8, 10); rect(c, '#3f9a62', x + 2, y - 1, 5, 4); rect(c, '#3f9a62', x + 10, y - 2, 4, 4)
  rect(c, '#6cc08a', x + 6, y - 7, 3, 2); rect(c, '#6cc08a', x + 4, y - 4, 2, 2); rect(c, '#6cc08a', x + 11, y - 1, 2, 1)
  rect(c, OUT, x + 2, y + 6, 12, 4)
  rect(c, '#d97b4f', x + 3, y + 7, 10, 2)
  rect(c, OUT, x + 3, y + 9, 10, 7)
  rect(c, '#c0643b', x + 4, y + 9, 8, 6)
  rect(c, '#a8532f', x + 4, y + 13, 8, 2)
}

function frame(c: C2D, x: number, y: number, w: number, h: number) {
  box(c, '#8a5a36', x, y, w, h)
  rect(c, '#a8774c', x, y, w, 1)
  rect(c, PAPER, x + 1, y + 1, w - 2, h - 2)
}

const WINDOWS = [3, 8, 22, 26]

export function renderBackground(): HTMLCanvasElement {
  const cv = document.createElement('canvas')
  cv.width = MW * T
  cv.height = MH * T
  const c = cv.getContext('2d')!
  // 1) piso
  for (let ty = 1; ty < MH - 1; ty++) for (let tx = 1; tx < MW - 1; tx++) {
    if (tx >= 20 && ty >= 10) tiles(c, tx * T, ty * T)
    else wood(c, tx * T, ty * T)
  }
  // 2) tapetes: reunião (oliva) e Gerente (vinho com friso dourado)
  {
    const x0 = 20 * T + 10, y0 = 2 * T + 14, w = 8 * T - 4, h = 7 * T - 8
    rect(c, '#7f8655', x0, y0, w, h)
    rect(c, '#9aa06a', x0 + 2, y0 + 2, w - 4, h - 4)
    rect(c, '#c9b98a', x0 + 4, y0 + 4, w - 8, 1); rect(c, '#c9b98a', x0 + 4, y0 + h - 5, w - 8, 1)
    rect(c, '#c9b98a', x0 + 4, y0 + 4, 1, h - 8); rect(c, '#c9b98a', x0 + w - 5, y0 + 4, 1, h - 8)
    for (let yy = y0 + 8; yy < y0 + h - 8; yy += 6) for (let xx = x0 + 8 + ((yy - y0) % 12 ? 3 : 0); xx < x0 + w - 8; xx += 6) rect(c, '#a8ae79', xx, yy, 1, 1)
  }
  {
    const x0 = 6 * T + 6, y0 = 15 * T + 10, w = 4 * T + 4, h = 3 * T + 2
    rect(c, '#5a1f2c', x0, y0, w, h)
    rect(c, '#7a2e3a', x0 + 2, y0 + 2, w - 4, h - 4)
    rect(c, '#FBC222', x0 + 4, y0 + 4, w - 8, 1); rect(c, '#FBC222', x0 + 4, y0 + h - 5, w - 8, 1)
    rect(c, '#FBC222', x0 + 4, y0 + 4, 1, h - 8); rect(c, '#FBC222', x0 + w - 5, y0 + 4, 1, h - 8)
  }
  // 3) luz das janelas e sombras no chão
  for (const wx of WINDOWS) {
    c.fillStyle = 'rgba(255,248,225,.22)'
    for (let k = 0; k < 22; k++) c.fillRect(wx * T + 3 + Math.floor(k / 2), 2 * T + k, 26, 1)
  }
  rect(c, SHADOW, T, 2 * T, (MW - 2) * T, 3)
  rect(c, SHADOW, T, 2 * T, 3, (MH - 3) * T)
  for (let x = 19; x <= 28; x++) if (![23, 24].includes(x)) rect(c, SHADOW, x * T, 11 * T, T, 3)
  for (let i = 0; i < DESKS; i++) { const d = deskOf(i); rect(c, SHADOW, d.tx * T, (d.ty + 1) * T, d.w * T, 3) }
  rect(c, SHADOW, 22 * T + 2, 8 * T, 5 * T, 3)
  rect(c, SHADOW, 21 * T + 1, 18 * T, 4 * T, 2)
  rect(c, SHADOW, 25 * T, 12 * T, 3 * T, 3)
  for (let ty = 0; ty < MH; ty++) for (let tx = 0; tx < MW; tx++) if (grid[ty][tx] === 'P') rect(c, SHADOW, tx * T + 2, ty * T + 15, 13, 3)
  // 4) paredes e móveis
  for (let ty = 0; ty < MH; ty++) {
    for (let tx = 0; tx < MW; tx++) {
      const x = tx * T, y = ty * T
      switch (grid[ty][tx]) {
        case '#':
          if (ty === 0 && tx > 0 && tx < MW - 1) { upperWall(c, x, y); break }
          rect(c, WALL, x, y, T, T)
          if (tx === 0) rect(c, WALL_HI, x + T - 2, y, 2, T)
          if (tx === MW - 1) rect(c, WALL_HI, x, y, 2, T)
          if (ty === MH - 1 && tx > 0 && tx < MW - 1) rect(c, WALL_HI, x, y, T, 2)
          break
        case 'f': case 'w': case 'B': wallFace(c, x, y); break
        case '|':
          rect(c, OUT, x + 5, y, 6, T)
          rect(c, '#6e5446', x + 6, y, 4, T)
          rect(c, '#8a6c5a', x + 6, y, 1, T)
          if (cellAt(tx, ty - 1) !== '|') rect(c, '#9c7d69', x + 6, y, 4, 2)
          rect(c, 'rgba(70,40,20,.16)', x + 11, y, 3, T)
          break
        case '-':
          rect(c, WALL, x, y, T, 3)
          rect(c, WALL_HI, x, y + 3, T, 1)
          rect(c, PAPER, x, y + 4, T, 5)
          rect(c, WAIN, x, y + 9, T, 5)
          rect(c, WAIN_HI, x, y + 9, T, 1)
          rect(c, BASE, x, y + 14, T, 2)
          break
        case 'P': plant(c, x, y); break
        case 'T':
          if (tx === 22 && ty === 4) {
            const w = 5 * T, h = 4 * T
            box(c, '#c08b5c', x, y, w, h - 4)
            rect(c, '#d6a273', x, y, w, 2)
            for (let k = 10; k < h - 6; k += 9) rect(c, '#b47f52', x + 4, y + k, w - 8, 1)
            rect(c, OUT, x - 1, y + h - 5, w + 2, 5)
            rect(c, '#87583a', x, y + h - 5, w, 4)
            // papéis, notebook e canecas
            box(c, '#fbfbf8', x + 10, y + 12, 9, 11); rect(c, '#c9b98a', x + 12, y + 15, 5, 1); rect(c, '#c9b98a', x + 12, y + 18, 4, 1)
            box(c, '#c9ced8', x + 34, y + 20, 14, 9); rect(c, '#9aa3b5', x + 35, y + 27, 12, 1)
            box(c, '#fbfbf8', x + 60, y + 14, 4, 4); rect(c, '#6e4529', x + 61, y + 15, 2, 2)
            box(c, '#FBC222', x + 22, y + 38, 4, 4)
            box(c, '#fbfbf8', x + 58, y + 34, 10, 8); rect(c, '#d9694a', x + 58, y + 34, 10, 2)
          }
          break
        case 'S':
          if (tx === 21) {
            const w = 4 * T
            box(c, '#b4513d', x, y, w, 15)
            rect(c, '#c9604a', x + 3, y + 1, w - 6, 5)
            for (let k = 0; k < 3; k++) { rect(c, '#e08a6e', x + 4 + k * 19, y + 7, 18, 6); rect(c, '#ec9f84', x + 4 + k * 19, y + 7, 18, 1) }
            rect(c, '#9c4433', x, y + 13, w, 2)
            box(c, '#FBC222', x + 6, y + 3, 6, 5); box(c, '#f1e6d2', x + w - 12, y + 3, 6, 5)
          }
          break
        case 'K':
          if (tx === 25) {
            const w = 3 * T
            box(c, '#a8774c', x, y + 3, w, 13)
            rect(c, '#ece5d8', x - 1, y, w + 2, 5); rect(c, OUT, x - 1, y - 1, w + 2, 1); rect(c, '#d9cbb3', x - 1, y + 4, w + 2, 1)
            for (let k = 1; k < 3; k++) rect(c, WAIN_D, x + k * T, y + 5, 1, 11)
            for (let k = 0; k < 3; k++) rect(c, '#e0c38c', x + k * T + 7, y + 8, 2, 1)
            // cafeteira, xícaras e fruteira
            box(c, '#2d2d33', x + 4, y - 7, 8, 9); rect(c, '#e05a47', x + 9, y - 5, 1, 1); rect(c, '#555', x + 6, y - 1, 4, 2)
            box(c, '#fbfbf8', x + T + 3, y - 2, 3, 3); box(c, '#fbfbf8', x + T + 8, y - 2, 3, 3); rect(c, '#FBC222', x + T + 8, y - 2, 3, 1)
            box(c, '#f1e6d2', x + 2 * T + 2, y - 1, 11, 3); rect(c, '#e0b04a', x + 2 * T + 3, y - 3, 3, 2); rect(c, '#d9694a', x + 2 * T + 7, y - 3, 3, 2)
          }
          break
        case 'R':
          if (tx === 5) {
            // estante encostada na parede, subindo sobre o lambri
            const w = 3 * T, y0 = y - 13
            box(c, '#8a5a36', x, y0, w, 29)
            rect(c, '#a8774c', x, y0, w, 2)
            for (let s = 0; s < 3; s++) {
              const sy = y0 + 3 + s * 8
              rect(c, '#5e3f2a', x + 2, sy, w - 4, 6)
              let bx = x + 3
              for (let k = 0; bx < x + w - 5; k++) {
                const bw = 2 + ((k + s) % 3 === 0 ? 1 : 0), bh = 5 - ((k * 3 + s) % 2)
                if ((k + s * 2) % 7 === 5) { bx += 3; continue }
                rect(c, BOOKS[(k * 3 + s * 2) % BOOKS.length], bx, sy + 6 - bh, bw, bh)
                bx += bw + 1
              }
            }
            rect(c, OUT, x, y + 15, w, 1)
            // vasinho e troféu em cima
            box(c, '#c0643b', x + 5, y0 - 4, 4, 3); rect(c, '#3f9a62', x + 4, y0 - 8, 6, 4)
            box(c, '#FBC222', x + w - 10, y0 - 5, 4, 4); rect(c, '#e0b04a', x + w - 9, y0 - 2, 2, 1)
          }
          break
      }
    }
  }
  // 5) parede: janelas, quadro e decoração
  for (const wx of WINDOWS) {
    const x0 = wx * T + 2, y0 = 6, w = 2 * T - 4, h = 17
    box(c, '#f7f1e6', x0, y0, w, h)
    rect(c, '#bfe3f2', x0 + 2, y0 + 2, w - 4, h - 4)
    rect(c, '#a6d6ec', x0 + 2, y0 + 9, w - 4, h - 11)
    rect(c, '#e3f4fb', x0 + 4, y0 + 4, 2, 2); rect(c, '#e3f4fb', x0 + 6, y0 + 3, 2, 1); rect(c, '#e3f4fb', x0 + 17, y0 + 4, 2, 1)
    rect(c, '#f7f1e6', x0 + w / 2 - 1, y0, 2, h)
    rect(c, '#f7f1e6', x0, y0 + 8, w, 1)
    rect(c, OUT, x0 - 2, y0 + h + 1, w + 4, 3); rect(c, '#efe3cf', x0 - 1, y0 + h + 1, w + 2, 2)
  }
  {
    const x0 = 13 * T, y0 = 7, w = 3 * T, h = 21
    box(c, '#c8ccd3', x0, y0, w, h)
    rect(c, '#fbfbf8', x0 + 1, y0 + 1, w - 2, h - 2)
    rect(c, '#e05a47', x0 + 4, y0 + 4, 12, 1); rect(c, '#5b6e8f', x0 + 20, y0 + 4, 10, 1); rect(c, '#7a8b3a', x0 + 20, y0 + 7, 6, 1)
    box(c, '#FBC222', x0 + w - 13, y0 + 2, 5, 5); box(c, '#f59ab5', x0 + w - 7, y0 + 3, 4, 4)
    rect(c, OUT, x0 + 4, y0 + h + 1, w - 8, 2); rect(c, '#9aa1ad', x0 + 5, y0 + h + 1, w - 10, 1)
    rect(c, '#e05a47', x0 + 8, y0 + h, 3, 1); rect(c, '#5b6e8f', x0 + 13, y0 + h, 3, 1)
  }
  // quadros: paisagem, cartaz amarelo, foto da piscina, relógio, calendário, arte e TV da reunião
  frame(c, T + 5, 9, 22, 13)
  rect(c, '#f3c98b', T + 6, 10, 20, 6); disc(c, T + 20, 13, 2, '#fbe3a0'); rect(c, '#8a9a5b', T + 6, 16, 20, 5); rect(c, '#7a8b3a', T + 6, 18, 9, 3)
  frame(c, 10 * T + 4, 8, 11, 15)
  rect(c, '#FBC222', 10 * T + 5, 9, 9, 13); disc(c, 10 * T + 9, 14, 2, '#fbfbf8'); rect(c, '#3b302c', 10 * T + 6, 19, 7, 1)
  frame(c, 11 * T + 6, 10, 19, 12)
  rect(c, '#7cc4d8', 11 * T + 7, 15, 17, 6); rect(c, '#e3f4fb', 11 * T + 9, 17, 4, 1); rect(c, '#8a9a5b', 11 * T + 7, 11, 17, 4)
  disc(c, 17 * T + 12, 13, 6, OUT); disc(c, 17 * T + 12, 13, 5, '#fbfbf8')
  rect(c, OUT, 17 * T + 12, 9, 1, 5); rect(c, OUT, 17 * T + 12, 13, 3, 1); rect(c, '#e05a47', 17 * T + 12, 13, 1, 1)
  box(c, '#fbfbf8', 16 * T + 2, 10, 8, 10); rect(c, '#d9694a', 16 * T + 2, 10, 8, 3)
  for (let k = 0; k < 6; k++) rect(c, '#c9b98a', 16 * T + 3 + (k % 3) * 2, 14 + Math.floor(k / 3) * 3, 1, 1)
  frame(c, 20 * T + 5, 8, 18, 15)
  disc(c, 20 * T + 11, 14, 4, '#d9694a'); rect(c, '#f4a259', 20 * T + 14, 15, 7, 6); rect(c, '#5b6e8f', 20 * T + 7, 19, 6, 2)
  box(c, '#2b2a33', 24 * T + 1, 7, 30, 17)
  rect(c, '#3a3944', 24 * T + 2, 8, 28, 15)
  for (const [k, hgt, col] of [[0, 5, '#7a8b3a'], [1, 9, '#e0b04a'], [2, 7, '#7a8b3a'], [3, 11, '#FBC222']] as const) rect(c, col, 24 * T + 7 + k * 5, 21 - hgt, 3, hgt)
  rect(c, OUT, 24 * T + 14, 25, 4, 2)
  // 6) cadeiras das mesas (ficam atrás do personagem)
  for (let i = 0; i < DESKS; i++) {
    const { seat } = deskOf(i)
    if (i === BOSS_DESK) {
      // cadeira executiva: encosto alto de couro vinho
      rect(c, OUT, seat.x - 9, seat.y - 31, 18, 20)
      rect(c, '#7a2e3a', seat.x - 8, seat.y - 30, 16, 18)
      rect(c, '#93404a', seat.x - 6, seat.y - 28, 12, 3)
      rect(c, '#5a1f2c', seat.x - 1, seat.y - 24, 2, 10)
      rect(c, '#FBC222', seat.x - 2, seat.y - 30, 4, 1)
      rect(c, OUT, seat.x - 11, seat.y - 18, 3, 7); rect(c, OUT, seat.x + 8, seat.y - 18, 3, 7)
      continue
    }
    rect(c, OUT, seat.x - 7, seat.y - 23, 14, 12)
    rect(c, '#4a4048', seat.x - 6, seat.y - 22, 12, 10)
    rect(c, '#605560', seat.x - 5, seat.y - 21, 10, 2)
  }
  // cadeiras da sala de reunião
  for (let x = 22; x <= 26; x++) {
    box(c, '#4a4048', x * T + 4, 3 * T + 6, 8, 8); rect(c, '#605560', x * T + 4, 3 * T + 6, 8, 2)
    box(c, '#4a4048', x * T + 4, 8 * T + 2, 8, 8); rect(c, '#605560', x * T + 4, 8 * T + 2, 8, 2)
  }
  return cv
}

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
  if (!marks.length && writing < 0) return
  const x0 = 13 * T + 1, y0 = T + 2
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

export function drawDesk(c: C2D, i: number, info: { pile: number; inbox: boolean; busy: boolean; owned: boolean; t: number }) {
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
    rect(c, '#3b2a20', m - 8, y + 11, 16, 3)
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
