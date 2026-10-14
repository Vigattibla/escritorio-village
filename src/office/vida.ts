import { OUT, rect as r, type C2D } from './base'
import { reduzMovimento } from './clima'
import type { Dir } from '../types'

/** Pequenas cenas dos bonecos de quem está fora (cozinha, banheiro, café): objetos na mão e papel no sapato. Tudo em pixel, sem estado. */
export type Prop = 'caneca' | 'copo' | 'louca' | 'lavaCaneca' | 'desentupidor'

/** ícone que acompanha o balão do que o boneco está fazendo */
export const ICONE: Partial<Record<Prop, string>> = { caneca: '☕', copo: '💧', louca: '🍽️', lavaCaneca: '🧼' }

/** objeto na mão. (x, y) = pé do boneco; dir = pra onde olha */
export function drawProp(c: C2D, prop: Prop, x: number, y: number, dir: Dir, t: number) {
  const hx = Math.round(x + (dir === 'left' ? -8 : dir === 'right' ? 4 : 3)), hy = Math.round(y - 11)
  if (prop === 'caneca' || prop === 'lavaCaneca') {
    r(c, OUT, hx, hy, 5, 5); r(c, '#f7f1e6', hx + 1, hy + 1, 3, 3); r(c, OUT, hx + 5, hy + 1, 1, 3); r(c, '#6b3f26', hx + 1, hy + 1, 3, 1)
    if (prop === 'caneca' && !reduzMovimento) { const p = (t / 700) % 1; r(c, `rgba(255,255,255,${0.9 - p})`, hx + 1 + Math.round(Math.sin(p * 6)), hy - 2 - Math.round(p * 4), 1, 1) }
  } else if (prop === 'copo') {
    r(c, OUT, hx + 1, hy, 4, 6); r(c, '#cfeaff', hx + 2, hy + 1, 2, 4); r(c, '#6fb6ee', hx + 2, hy + 3, 2, 2)
  } else if (prop === 'louca') {
    r(c, OUT, hx - 1, hy + 1, 8, 4); r(c, '#fbfbf8', hx, hy + 2, 6, 2); r(c, '#cfd3dd', hx + 1, hy + 2, 4, 1)
  } else if (prop === 'desentupidor') {
    // cabo + ventosa vermelha
    const cx = dir === 'left' ? hx + 1 : hx + 2
    r(c, OUT, cx, hy - 10, 2, 11); r(c, '#c8964f', cx, hy - 9, 1, 9); r(c, OUT, cx - 2, hy + 1, 6, 4); r(c, '#e05a47', cx - 1, hy + 2, 4, 2)
  }
  // espuma sobe da pia quando lava
  if ((prop === 'louca' || prop === 'lavaCaneca') && !reduzMovimento) {
    for (let k = 0; k < 3; k++) { const p = ((t / 900) + k / 3) % 1; r(c, k % 2 ? '#dff3fb' : '#fff', Math.round(x - 4 + k * 4 + Math.sin(p * 6 + k) * 1.5), Math.round(y - 14 - p * 9), 2, 2) }
  }
}

/** papel higiênico grudado no sapato: fita que balança atrás do boneco enquanto anda */
export function drawPapel(c: C2D, x: number, y: number, dir: Dir, t: number) {
  const sx = dir === 'left' ? 1 : dir === 'right' ? -1 : 0, bal = reduzMovimento ? 0 : Math.round(Math.sin(t / 110))
  if (dir === 'up' || dir === 'down') {
    r(c, '#fbfbf8', Math.round(x + 2), Math.round(y - 1), 1, 3); r(c, '#fbfbf8', Math.round(x + 2 + bal), Math.round(y + 2), 1, 2); r(c, '#cfd3dd', Math.round(x + 2 + bal), Math.round(y + 4), 1, 1)
  } else {
    for (let k = 0; k < 4; k++) r(c, k === 3 ? '#cfd3dd' : '#fbfbf8', Math.round(x + sx * (2 + k * 2)), Math.round(y - 1 + (k > 1 ? bal : 0)), 2, 1)
  }
}

/** pulinho de susto: altura (px) nos primeiros 500 ms depois de `desde` */
export const pulo = (agora: number, desde: number) => (reduzMovimento || agora - desde > 500 || agora < desde ? 0 : Math.round(Math.sin(((agora - desde) / 500) * Math.PI) * 4))
