/** O andar: 2 salas em cima, corredor, 2 salas embaixo, frente a frente; paredes de vidro pro corredor, com cortina. */
import { MH, MW, OUT, rect as r, T, type C2D } from './base'
import { drawBanner } from './bandeira'
import { kd, PISOS, solidGrid, type Sala } from './sala'

export const HALL = 'andar'
export const SLOTS = 4
export type DoorState = 'vazia' | 'aberta' | 'fechada'

/** porta de saída da sala: meio da parede de baixo; se tiver móvel na frente, a porta anda pro lado */
export function exitX(s: Sala) {
  const solid = solidGrid(s), y = MH - 2
  const free = (x: number) => x >= 1 && x < MW - 1 && !s.div[y][x] && !solid[y][x]
  for (let k = 0; k < 13; k++) {
    const x = 14 + (k % 2 ? -(k + 1) / 2 : k / 2)
    if (free(x) && free(x + 1)) return x
  }
  return 14
}

/** porta das salas de baixo: na parede de vidro de cima, onde não tem quadro na parede e a frente está livre */
export function glassDoorX(s: Sala) {
  const solid = solidGrid(s)
  const wall = (x: number) => s.objs.some(o => kd(o).camada === 'parede' && o.k !== 'janela' && x >= o.x && x < o.x + kd(o).w)
  const free = (x: number) => x >= 1 && x < MW - 1 && !wall(x) && !s.div[2][x] && !solid[2][x]
  for (let k = 0; k < 25; k++) {
    const x = 14 + (k % 2 ? -(k + 1) / 2 : k / 2)
    if (free(x) && free(x + 1)) return x
  }
  return 14
}

const darker = (hex: string, k: number) => {
  const n = parseInt(hex.slice(1), 16)
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * k))).toString(16).padStart(2, '0')
  return '#' + f(n >> 16) + f((n >> 8) & 255) + f(n & 255)
}
/** texto claro ou escuro em cima da cor */
export const inkOn = (hex: string) => {
  const n = parseInt(hex.slice(1), 16)
  return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) > 150 ? '#1b2240' : '#ffffff'
}

/** porta na parede de cima do corredor (tile tx, 2 de largura); bandeira com a cor da sala do lado */
export function drawDoor(c: C2D, tx: number, st: DoorState, color: string, flag?: string | null) {
  const x = tx * T, y = 5, w = 2 * T, h = 2 * T - y
  const empty = st === 'vazia'
  r(c, OUT, x + 1, y, w - 2, h)
  r(c, empty ? '#a3a8b3' : '#6b4a33', x + 2, y + 1, w - 4, h - 1)
  const ix = x + 4, iy = y + 3, iw = w - 8, ih = h - 3
  if (st === 'aberta') {
    r(c, '#2a2238', ix, iy, iw, ih)
    r(c, '#3a3150', ix + 4, iy + 2, iw - 8, ih - 2)
    r(c, 'rgba(255,236,190,.28)', ix + 3, iy + ih - 6, iw - 6, 6)
    // folha aberta, vista de lado
    r(c, OUT, ix, iy, 4, ih); r(c, '#b07a4f', ix + 1, iy, 2, ih)
  } else {
    const leaf = empty ? '#c3c7cf' : '#b07a4f', hi = empty ? '#d3d6dc' : '#c99566'
    r(c, leaf, ix, iy, iw, ih)
    r(c, hi, ix + 2, iy + 2, iw / 2 - 3, ih / 2 - 3); r(c, hi, ix + iw / 2 + 1, iy + 2, iw / 2 - 3, ih / 2 - 3)
    r(c, hi, ix + 2, iy + ih / 2 + 1, iw / 2 - 3, ih / 2 - 3); r(c, hi, ix + iw / 2 + 1, iy + ih / 2 + 1, iw / 2 - 3, ih / 2 - 3)
    r(c, OUT, ix + iw - 5, iy + ih / 2, 3, 2); r(c, empty ? '#8a8f98' : '#FBC222', ix + iw - 4, iy + ih / 2, 1, 1)
    if (!empty) r(c, color, ix, iy + ih / 2 - 1, iw, 2)
    if (empty) { r(c, '#8a8f98', ix + 3, iy + 3, iw - 6, 1); r(c, '#8a8f98', ix + 3, iy + ih - 4, iw - 6, 1) }
  }
  if (empty) return
  drawBanner(c, x + w + 4, 7, color, flag)
}

/** porta de saída na parede de baixo da sala (tile tx, 2 de largura) */
export function drawExit(c: C2D, tx: number, st: DoorState, color = '#a3a8b3', flag?: string | null) {
  const x = tx * T, y = (MH - 1) * T, open = st === 'aberta'
  r(c, OUT, x, y, 2 * T, T)
  r(c, st === 'vazia' ? '#a3a8b3' : '#6b4a33', x + 1, y + 1, 2 * T - 2, T - 1)
  if (st === 'vazia') { r(c, '#c3c7cf', x + 3, y + 3, 2 * T - 6, T - 3); return }
  if (open) { r(c, '#2a2238', x + 3, y + 3, 2 * T - 6, T - 3); r(c, '#3a3150', x + 6, y + 5, 2 * T - 12, T - 5) }
  else { r(c, '#b07a4f', x + 3, y + 3, 2 * T - 6, T - 3); r(c, '#c99566', x + 3, y + 3, 2 * T - 6, 1); r(c, '#FBC222', x + 2 * T - 9, y + 8, 2, 2) }
  // capacho
  r(c, OUT, x + 4, y - 6, 2 * T - 8, 5); r(c, '#8a6a4a', x + 5, y - 5, 2 * T - 10, 3); r(c, '#a8835c', x + 7, y - 4, 2 * T - 14, 1)
  drawBanner(c, x + 2 * T + 4, y + 2, color, flag)
}

// ---------- vidro e cortina ----------
const FRAME = '#8794a8', FRAME_D = '#5d6b80', TINT = 'rgba(170,215,238,.42)', GLINT = 'rgba(255,255,255,.55)'

/** vidro da sala de cima: faixa fina na parede de baixo (linha MH-1), de lx0 a lx1 (exclusive) */
export function glassStrip(c: C2D, s: Sala) {
  const y = (MH - 1) * T
  for (let tx = 1; tx < MW - 1; tx++) PISOS[s.piso[MH - 2][tx]].draw(c, tx * T, y)
  const x = T, w = (MW - 2) * T
  r(c, TINT, x, y, w, 12)
  r(c, FRAME_D, x, y, w, 1); r(c, GLINT, x, y + 1, w, 1)
  for (let tx = 1; tx < MW - 1; tx++) {
    if ((tx - 1) % 4 === 0 && tx > 1) { r(c, OUT, tx * T - 1, y, 1, 12); r(c, FRAME, tx * T, y, 2, 12) }
    if (tx % 3 === 0) for (let k = 0; k < 6; k++) r(c, GLINT, tx * T + 4 + k, y + 9 - k, 1, 1)
  }
  r(c, OUT, x, y + 12, w, 1); r(c, '#a9b4c4', x, y + 13, w, 2); r(c, FRAME_D, x, y + 15, w, 1)
}

/** vidro da sala de baixo: a parede alta de cima (linhas 0-1) vira painéis de vidro */
export function glassWall(c: C2D, s: Sala) {
  for (let tx = 1; tx < MW - 1; tx++) for (const ty of [0, 1]) PISOS[s.piso[2][tx]].draw(c, tx * T, ty * T)
  const x = T, w = (MW - 2) * T
  r(c, OUT, x, 0, w, 1); r(c, FRAME, x, 1, w, 3); r(c, '#a9b4c4', x, 1, w, 1)
  r(c, TINT, x, 4, w, 24)
  for (let tx = 1; tx < MW - 1; tx++) {
    if ((tx - 1) % 2 === 0 && tx > 1) { r(c, OUT, tx * T - 2, 4, 1, 24); r(c, FRAME, tx * T - 1, 4, 2, 24); r(c, OUT, tx * T + 1, 4, 1, 24) }
    if (tx % 2 === 0) { for (let k = 0; k < 12; k++) r(c, GLINT, tx * T - 10 + k, 22 - k, 1, 1); for (let k = 0; k < 6; k++) r(c, GLINT, tx * T - 4 + k, 22 - k, 1, 1) }
  }
  r(c, OUT, x, 28, w, 1); r(c, FRAME, x, 29, w, 2); r(c, FRAME_D, x, 31, w, 1)
}

/** cortina fechada na cor da sala, deixando o vão da porta (tile dx, 2 de largura) */
export function drawCurtain(c: C2D, top: boolean, dx: number, color: string) {
  const y0 = top ? (MH - 1) * T + 1 : 4, h = top ? 11 : 24, dk = darker(color, 0.78), hi = darker(color, 1.15)
  const seg = (a: number, b: number) => {
    if (b <= a) return
    r(c, color, a, y0, b - a, h)
    for (let x = a + 1; x < b; x += 4) { r(c, dk, x, y0, 1, h); r(c, hi, x + 2, y0, 1, h) }
    r(c, dk, a, y0 + h - 1, b - a, 1)
    if (!top) { r(c, OUT, a, y0 - 1, b - a, 1); r(c, '#3a3a48', a, y0, b - a, 1) }
  }
  seg(T, dx * T); seg((dx + 2) * T, (MW - 1) * T)
}
