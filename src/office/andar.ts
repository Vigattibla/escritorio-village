/** O andar: corredor com as portas das salas. Ninguém é teletransportado: sai pela porta da sala e entra pela do vizinho. */
import { MH, MW, OUT, rect as r, T, type C2D } from './base'
import { solidGrid, type Obj, type Piso, type Sala } from './sala'

export const HALL = 'andar'
export const SLOTS = 4
/** tile da esquerda de cada porta (2 de largura) na parede de cima do corredor */
export const DOOR_X = [3, 10, 17, 24]
export type DoorState = 'vazia' | 'aberta' | 'fechada'

/** corredor: carpete, plantas entre as portas e um cantinho de espera no meio (não é editável) */
export function hallSala(): Sala {
  const piso = Array.from({ length: MH }, (_, y) => Array.from({ length: MW }, () => (y < 5 ? 'madeira' : 'carpete') as Piso))
  const div = Array.from({ length: MH }, () => Array<boolean>(MW).fill(false))
  let id = 1
  const objs: Obj[] = []
  const add = (k: string, x: number, y: number) => objs.push({ id: id++, k, x, y })
  for (const [x, y] of [[1, 2], [7, 2], [21, 2], [28, 2], [1, 18], [28, 18], [9, 12], [20, 12]]) add('planta', x, y)
  add('bebedouro', 14, 2)
  add('tapete-chefe', 12, 10)
  add('sofa', 12, 13)
  add('sofa', 5, 17); add('sofa', 21, 17)
  add('quadro-paisagem', 6, 0); add('relogio', 14, 0); add('cartaz', 21, 0)
  return { piso, div, objs }
}

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
export function drawDoor(c: C2D, tx: number, st: DoorState, color: string) {
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
  // bandeira: mastro + flâmula na cor da sala
  const fx = x + w + 1, fy = 6
  r(c, OUT, fx, fy, 1, 22)
  r(c, '#c9c2b4', fx, fy, 1, 1)
  for (let k = 0; k < 9; k++) { const len = 10 - Math.abs(k - 4) * 2; r(c, OUT, fx + 1, fy + 1 + k, len + 1, 1) }
  for (let k = 1; k < 8; k++) { const len = 9 - Math.abs(k - 4) * 2; r(c, k < 4 ? color : darker(color, 0.82), fx + 1, fy + 1 + k, len, 1) }
}

/** porta de saída na parede de baixo da sala (tile tx, 2 de largura) */
export function drawExit(c: C2D, tx: number, open: boolean) {
  const x = tx * T, y = (MH - 1) * T
  r(c, OUT, x, y, 2 * T, T)
  r(c, '#6b4a33', x + 1, y + 1, 2 * T - 2, T - 1)
  if (open) { r(c, '#2a2238', x + 3, y + 3, 2 * T - 6, T - 3); r(c, '#3a3150', x + 6, y + 5, 2 * T - 12, T - 5) }
  else { r(c, '#b07a4f', x + 3, y + 3, 2 * T - 6, T - 3); r(c, '#c99566', x + 3, y + 3, 2 * T - 6, 1); r(c, '#FBC222', x + 2 * T - 9, y + 8, 2, 2) }
  // capacho
  r(c, OUT, x + 4, y - 6, 2 * T - 8, 5); r(c, '#8a6a4a', x + 5, y - 5, 2 * T - 10, 3); r(c, '#a8835c', x + 7, y - 4, 2 * T - 14, 1)
}
