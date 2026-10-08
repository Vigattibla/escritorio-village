/** Constantes da sala e pincéis de pixel art compartilhados. */
export const T = 16
export const MW = 24
export const MH = 16
export const MAX_DESKS = 12
/** Mesa do Gerente (fila de baixo, centralizada) — fora do sorteio de mesas */
export const BOSS_DESK = MAX_DESKS
export const DESKS = MAX_DESKS + 1

// ---------- arte ----------
export const OUT = '#1d1a2b'
export type C2D = CanvasRenderingContext2D

export function rect(c: C2D, color: string, x: number, y: number, w: number, h: number) {
  c.fillStyle = color
  c.fillRect(x, y, w, h)
}
export function disc(c: C2D, cx: number, cy: number, r: number, color: string) {
  for (let dy = -r; dy <= r; dy++) {
    const h = Math.round(Math.sqrt((r + 0.4) ** 2 - dy * dy))
    rect(c, color, cx - h, cy + dy, 2 * h + 1, 1)
  }
}
/** Caixa com contorno de 1px */
export function box(c: C2D, color: string, x: number, y: number, w: number, h: number) {
  rect(c, OUT, x - 1, y - 1, w + 2, h + 2)
  rect(c, color, x, y, w, h)
}

const PLANK = ['#dcb68b', '#d5ad81', '#e1bd93']
export const WALL = '#3b302c', WALL_HI = '#5a4840'
export const PAPER = '#f1e6d2', PAPER_2 = '#e9dbc3'
export const WAIN = '#a8774c', WAIN_D = '#8e6240', WAIN_HI = '#bd8c5f', BASE = '#5e3f2a'
export const SHADOW = 'rgba(70,40,20,.2)'
export const BOOKS = ['#d9694a', '#e0b04a', '#7a8b3a', '#5b6e8f', '#f1e6d2', '#8a6bc8', '#c0643b']

/** Piso de tábuas corridas na horizontal, emenda desencontrada e tom variando por tábua */
export function wood(c: C2D, x: number, y: number) {
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
export function tiles(c: C2D, x: number, y: number) {
  rect(c, '#efe6d6', x, y, T, T)
  rect(c, '#e5d9c4', x, y, 8, 8)
  rect(c, '#e5d9c4', x + 8, y + 8, 8, 8)
  rect(c, '#d9cbb3', x, y, T, 1)
  rect(c, '#d9cbb3', x, y, 1, T)
}
/** Parede alta: a linha 0 é a metade de cima (papel de parede), a linha 1 tem lambri e rodapé */
export function upperWall(c: C2D, x: number, y: number) {
  rect(c, WALL, x, y, T, 4)
  rect(c, WALL_HI, x, y + 4, T, 1)
  rect(c, PAPER, x, y + 5, T, 11)
  for (let i = 2; i < T; i += 4) rect(c, PAPER_2, x + i, y + 5, 1, 11)
}
export function wallFace(c: C2D, x: number, y: number) {
  rect(c, PAPER, x, y, T, 7)
  for (let i = 2; i < T; i += 4) rect(c, PAPER_2, x + i, y, 1, 7)
  rect(c, '#d9bf98', x, y + 7, T, 1)
  rect(c, WAIN, x, y + 8, T, 6)
  rect(c, WAIN_HI, x, y + 8, T, 1)
  rect(c, WAIN_D, x + 7, y + 9, 1, 5)
  rect(c, WAIN_D, x + 15, y + 9, 1, 5)
  rect(c, BASE, x, y + 14, T, 2)
}

export function plant(c: C2D, x: number, y: number) {
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

export function frame(c: C2D, x: number, y: number, w: number, h: number) {
  box(c, '#8a5a36', x, y, w, h)
  rect(c, '#a8774c', x, y, w, 1)
  rect(c, PAPER, x + 1, y + 1, w - 2, h - 2)
}
