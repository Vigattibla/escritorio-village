import { drawAvatar, shade, SPRITE_H } from '../chibi/sprite'
import type { Avatar, Dir } from '../types'
import { OUT, rect as r, type C2D } from './base'

// ---- bichos de estimação, montarias e ações a dois (comprados no Almoxarifado) ----
// Tudo é desenhado olhando pra direita, com o chão em y = 0; virado() espelha pra esquerda.

type Part = [string, number, number, number, number]
/** desenha as peças com um contorno único (todos os contornos antes, depois os recheios) */
function pecas(c: C2D, ps: Part[]) {
  for (const [, x, y, w, h] of ps) r(c, OUT, x - 1, y - 1, w + 2, h + 2)
  for (const [col, x, y, w, h] of ps) r(c, col, x, y, w, h)
}
function virado(c: C2D, x: number, y: number, esq: boolean, f: () => void) {
  c.save(); c.translate(Math.round(x), Math.round(y)); if (esq) c.scale(-1, 1); f(); c.restore()
}

interface Quad {
  L: number; H: number; leg: number; hw: number; hh: number; pesc?: number
  a: string; b: string; v: string
  ear: 'ponta' | 'caida' | 'longa' | 'redonda' | 'nenhuma'
  tail: 'fina' | 'fofa' | 'curta' | 'enrolada' | 'crina' | 'nenhuma'
  focinho?: boolean; crina?: string; chifre?: string; asas?: boolean; sela?: string
}
/** quadrúpede genérico: gato, cachorro, cavalo... (mov = andando) */
function quad(c: C2D, q: Quad, t: number, mov: boolean) {
  const s = mov ? (Math.floor(t / 140) % 2 ? 1 : -1) : 0
  const bx = -Math.floor(q.L / 2), top = -q.leg - q.H
  const hx = bx + q.L - 2, hy = top - q.hh + 2 - (q.pesc ?? 0)
  const ps: Part[] = []
  // pernas do outro lado (mais escuras), corpo, pernas da frente
  ps.push([q.b, bx + 1 - s, -q.leg, 2, q.leg], [q.b, bx + q.L - 3 + s, -q.leg, 2, q.leg])
  if (q.tail === 'fina') ps.push([q.a, bx - 1, top - 2, 1, 3], [q.a, bx - 2, top - 3, 1, 2])
  if (q.tail === 'fofa') ps.push([q.a, bx - 3, top - 1, 3, 3])
  if (q.tail === 'curta') ps.push([q.a, bx - 1, top, 1, 2])
  if (q.tail === 'enrolada') ps.push([q.a, bx - 2, top + 1, 1, 1], [q.a, bx - 3, top, 2, 1])
  if (q.tail === 'crina') ps.push([q.crina ?? q.b, bx - 2, top, 2, q.H + 1])
  ps.push([q.a, bx, top, q.L, q.H])
  if (q.sela) ps.push([q.sela, -6, top, 12, 3])
  if (q.pesc) ps.push([q.a, hx, hy + q.hh - 1, 3, q.pesc + 2])
  ps.push([q.a, hx, hy, q.hw, q.hh])
  if (q.focinho) ps.push([q.v, hx + q.hw, hy + q.hh - 3, 2, 3])
  if (q.ear === 'ponta') ps.push([q.a, hx + 1, hy - 2, 1, 2], [q.a, hx + q.hw - 2, hy - 2, 1, 2])
  if (q.ear === 'longa') ps.push([q.a, hx + 1, hy - 5, 1, 5], [q.a, hx + 3, hy - 5, 1, 5])
  if (q.ear === 'redonda') ps.push([q.a, hx, hy - 1, 2, 1], [q.a, hx + q.hw - 2, hy - 1, 2, 1])
  ps.push([q.a, bx + 2 + s, -q.leg, 2, q.leg], [q.a, bx + q.L - 2 - s, -q.leg, 2, q.leg])
  pecas(c, ps)
  // detalhes sem contorno
  r(c, q.v, bx + 2, top + q.H - 1, q.L - 4, 1)
  if (q.tail === 'fofa') r(c, q.v, bx - 3, top - 1, 1, 1)
  if (q.ear === 'caida') { r(c, OUT, hx - 1, hy, 3, 4); r(c, q.b, hx, hy + 1, 1, 3) }
  if (q.ear === 'longa') { r(c, q.v, hx + 1, hy - 4, 1, 3) }
  if (q.crina) { r(c, q.crina, hx - 1, hy, 2, q.hh + (q.pesc ?? 0)); r(c, q.crina, hx, hy - 1, 2, 1) }
  if (q.chifre) { r(c, OUT, hx + q.hw - 3, hy - 4, 3, 4); r(c, q.chifre, hx + q.hw - 2, hy - 3, 1, 3) }
  r(c, OUT, hx + q.hw - 2, hy + 1, 1, 1)
  if (q.focinho) r(c, OUT, hx + q.hw + 1, hy + q.hh - 3, 1, 1)
  else r(c, '#e8508a', hx + q.hw - 1, hy + q.hh - 2, 1, 1)
}
/** quadrúpede visto de frente (ou de costas): corpo largo atrás das pernas do cavaleiro; de frente o pescoço e a cabeça cobrem o colo */
function quadFrente(c: C2D, q: Quad, layer: 'atras' | 'frente', costas: boolean, t: number, mov: boolean) {
  const s = mov ? (Math.floor(t / 140) % 2 ? 1 : 0) : 0
  const W = q.H + 8, top = -q.leg - q.H, x0 = -Math.floor(W / 2)
  if (layer === 'atras') {
    // lombo inteiro (com a manta) e as pernas de trás saindo pelos lados
    pecas(c, [[q.b, x0 + 1, -q.leg + s, 2, q.leg - s], [q.b, x0 + W - 3, -q.leg + 1 - s, 2, q.leg - 1 + s], [q.a, x0, top, W, q.H]])
    if (q.sela) { r(c, OUT, x0 - 1, top + 1, W + 2, 4); r(c, q.sela, x0, top + 1, W, 3) }
    return
  }
  if (costas) {
    // garupa redonda no meio, pernas de trás e o rabo caindo por cima
    pecas(c, [[q.a, -5, top + 1, 10, q.H], [q.a, -4, -q.leg, 3, q.leg - s], [q.a, 1, -q.leg, 3, q.leg - 1 + s]])
    r(c, q.b, -1, top + 3, 2, q.H - 2)
    const tc = q.tail === 'crina' ? q.crina ?? q.b : q.a
    if (q.tail === 'crina') pecas(c, [[tc, -1, top + 1, 2, q.H + 3]])
    else if (q.tail !== 'nenhuma') pecas(c, [[tc, -1, top + 1, 2, 3]])
    return
  }
  // de frente: peito e pernas da frente entre as canelas do cavaleiro, pescoço e cabeça cobrindo o colo
  const hw = q.hw + 1, hh = q.hh + 3, hx = -Math.floor(hw / 2)
  const hy = top - hh + 8
  const ps: Part[] = [[q.a, -4, top, 8, q.H], [q.a, -4, -q.leg, 3, q.leg - s], [q.a, 1, -q.leg, 3, q.leg - 1 + s]]
  ps.push([q.a, hx, hy, hw, hh])
  if (q.ear === 'ponta') ps.push([q.a, hx, hy - 2, 2, 2], [q.a, hx + hw - 2, hy - 2, 2, 2])
  if (q.ear === 'redonda') ps.push([q.a, hx - 1, hy, 2, 2], [q.a, hx + hw - 1, hy, 2, 2])
  if (q.focinho) ps.push([q.v, hx + 1, hy + hh - 3, hw - 2, 3])
  pecas(c, ps)
  r(c, q.v, -3, top + q.H - 1, 6, 1)
  if (q.crina) { r(c, q.crina, -1, hy - 1, 2, 3) }
  if (q.chifre) { r(c, OUT, -1, hy - 5, 3, 5); r(c, q.chifre, 0, hy - 4, 1, 4) }
  // olhos nas laterais da cara e narinas no focinho
  r(c, OUT, hx + 1, hy + 2, 1, 2); r(c, OUT, hx + hw - 2, hy + 2, 1, 2)
  if (q.focinho) { r(c, OUT, hx + 2, hy + hh - 2, 1, 1); r(c, OUT, hx + hw - 3, hy + hh - 2, 1, 1) }
  else r(c, '#e8508a', -1, hy + hh - 1, 2, 1)
}
/** passarinho em pé */
function ave(c: C2D, a: string, b: string, bico: string, t: number, mov: boolean, extra?: (c: C2D) => void) {
  const h = mov && Math.floor(t / 150) % 2 ? -1 : 0
  r(c, bico, -1, -2, 1, 2); r(c, bico, 1, -2, 1, 2)
  pecas(c, [[a, -4, -7 + h, 1, 2], [a, -3, -7 + h, 6, 5], [a, 0, -10 + h, 4, 4]])
  r(c, b, -2, -6 + h, 3, 2)
  r(c, OUT, 2, -9 + h, 1, 1)
  pecas(c, [[bico, 4, -8 + h, 2, 1]])
  extra?.(c)
}

export const PETS: Record<string, (c: C2D, t: number, mov: boolean) => void> = {
  gato: (c, t, m) => quad(c, { L: 8, H: 4, leg: 2, hw: 5, hh: 4, a: '#8a8f99', b: '#6c707a', v: '#d9dce2', ear: 'ponta', tail: 'fina' }, t, m),
  'gato-laranja': (c, t, m) => quad(c, { L: 8, H: 4, leg: 2, hw: 5, hh: 4, a: '#f0a04b', b: '#c97a2e', v: '#fde3c2', ear: 'ponta', tail: 'fina' }, t, m),
  caramelo: (c, t, m) => quad(c, { L: 9, H: 4, leg: 3, hw: 5, hh: 4, a: '#c98a4b', b: '#9c6634', v: '#f1d3a8', ear: 'caida', tail: 'fina', focinho: true }, t, m),
  coelho: (c, t, m) => quad(c, { L: 6, H: 4, leg: 1, hw: 4, hh: 4, a: '#f4f4f4', b: '#d8d8de', v: '#f9c6d6', ear: 'longa', tail: 'fofa' }, t, m),
  hamster: (c, t, m) => quad(c, { L: 5, H: 3, leg: 1, hw: 3, hh: 3, a: '#e0a55a', b: '#b8823f', v: '#fff1d6', ear: 'redonda', tail: 'nenhuma' }, t, m),
  porquinho: (c, t, m) => quad(c, { L: 8, H: 5, leg: 2, hw: 5, hh: 4, a: '#f7b2c4', b: '#e08ba3', v: '#f9c6d6', ear: 'ponta', tail: 'enrolada', focinho: true }, t, m),
  raposa: (c, t, m) => quad(c, { L: 9, H: 4, leg: 2, hw: 5, hh: 4, a: '#e2763a', b: '#b85a26', v: '#fff6ea', ear: 'ponta', tail: 'fofa', focinho: true }, t, m),
  capivara: (c, t, m) => {
    quad(c, { L: 10, H: 5, leg: 2, hw: 5, hh: 4, a: '#9b7652', b: '#7a5a3c', v: '#b08a63', ear: 'redonda', tail: 'nenhuma', focinho: true }, t, m)
    // a laranjinha na cabeça
    r(c, OUT, 3, -14, 4, 3); r(c, '#f39c35', 4, -13, 2, 1); r(c, '#3fa66b', 5, -15, 1, 1)
  },
  pato: (c, t, m) => ave(c, '#f6d84a', '#e8bf2c', '#f39c35', t, m),
  pinguim: (c, t, m) => ave(c, '#2d2d33', '#17171c', '#f39c35', t, m, c => { r(c, '#f4f4f4', 1, -6, 2, 4); r(c, '#f4f4f4', 1, -9, 2, 2) }),
  galinha: (c, t, m) => ave(c, '#f4f4f4', '#d8d8de', '#f2c230', t, m, c => { r(c, OUT, 0, -13, 4, 3); r(c, '#e05a47', 1, -12, 2, 1); r(c, '#e05a47', 4, -7, 1, 2) }),
  tartaruga: (c, t, m) => {
    const s = m && Math.floor(t / 300) % 2 ? 1 : 0
    pecas(c, [['#8cc96b', -3 + s, -2, 2, 2], ['#8cc96b', 2 - s, -2, 2, 2], ['#8cc96b', 4, -5, 3, 3], ['#3d7a3a', -4, -5, 8, 4], ['#3d7a3a', -3, -6, 6, 1]])
    r(c, '#5ea35a', -2, -5, 2, 2); r(c, '#5ea35a', 1, -4, 2, 2); r(c, OUT, 5, -4, 1, 1)
  },
  peixe: (c, t) => {
    // aquário que flutua do lado
    const y = -15 + Math.round(Math.sin(t / 500)), fx = Math.round(Math.sin(t / 700) * 2)
    r(c, OUT, -4, y - 4, 9, 1); r(c, OUT, -5, y - 3, 1, 6); r(c, OUT, 5, y - 3, 1, 6); r(c, OUT, -4, y + 3, 9, 1)
    r(c, 'rgba(159,216,245,.55)', -4, y - 2, 9, 5); r(c, 'rgba(255,255,255,.7)', -3, y - 3, 7, 1)
    r(c, '#f39c35', fx - 1, y, 3, 2); r(c, '#f39c35', fx - 2 + (Math.sin(t / 700) > 0 ? 0 : 4), y, 1, 2); r(c, OUT, fx + 1, y, 1, 1)
  },
  papagaio: () => { /* fica no ombro: desenhado por drawPet */ },
  fantasma: (c, t) => {
    const y = -16 + Math.round(Math.sin(t / 450) * 1.5)
    c.globalAlpha = 0.85
    pecas(c, [['#f4f4fb', -3, y, 7, 7], ['#f4f4fb', -2, y - 1, 5, 1]])
    const k = Math.floor(t / 250) % 2
    r(c, '#f4f4fb', -3 + k, y + 7, 1, 1); r(c, '#f4f4fb', -1 + k, y + 7, 1, 1); r(c, '#f4f4fb', 1 + k, y + 7, 1, 1)
    r(c, OUT, 0, y + 2, 1, 2); r(c, OUT, 2, y + 2, 1, 2); r(c, '#f9b3cc', -1, y + 4, 1, 1)
    c.globalAlpha = 1
  },
  dragao: (c, t, m) => {
    const y = -5 + Math.round(Math.sin(t / 350) * 1.5), aberta = Math.floor(t / 180) % 2
    c.save(); c.translate(0, y)
    quad(c, { L: 8, H: 4, leg: 2, hw: 5, hh: 4, a: '#8e5bd6', b: '#6a3fb0', v: '#c7a8f2', ear: 'ponta', tail: 'fina', chifre: '#FBC222' }, t, m)
    pecas(c, [['#c7a8f2', -2, aberta ? -11 : -8, 4, aberta ? 4 : 2]])
    c.restore()
    if (m || Math.floor(t / 900) % 3 === 0) { r(c, '#f39c35', 9, y - 8, 2, 1); r(c, '#FBC222', 11, y - 8, 1, 1) }
  },
}
export const PETS_NO_AR = new Set(['peixe', 'fantasma', 'papagaio'])

/** bicho seguindo o dono: x, y = pés do dono */
export function drawPet(c: C2D, kind: string | undefined, x: number, y: number, dir: Dir, t: number, mov: boolean) {
  if (!kind || !PETS[kind]) return
  if (kind === 'papagaio') {
    // no ombro do dono
    const esq = dir === 'left', bob = mov && Math.floor(t / 200) % 2 ? -1 : 0
    virado(c, x + (esq ? 3 : -3), y - 14 + bob, esq, () => ave(c, '#3fa66b', '#2c7d4f', '#FBC222', t, false, c => { r(c, '#e05a47', 0, -10, 2, 1); r(c, '#3a6fd8', -4, -6, 1, 3) }))
    return
  }
  const atras = dir === 'right' ? -1 : dir === 'left' ? 1 : dir === 'down' ? 1 : -1
  const esq = dir === 'left' || dir === 'up'
  virado(c, x + atras * 12, y + (dir === 'up' ? -2 : 1), esq, () => PETS[kind](c, t, mov))
}

// ---- montarias: o boneco sobe `alt` pixels ----
export interface Montaria {
  alt: number; sentado: boolean; atras: (c: C2D, t: number, mov: boolean) => void; frente?: (c: C2D, t: number, mov: boolean) => void; flutua?: boolean
  /** visto de frente/costas (dir down/up): sem isso usa o desenho de lado */
  frontal?: (c: C2D, layer: 'atras' | 'frente', costas: boolean, t: number, mov: boolean) => void
}
const cavalo = (q: Partial<Quad>): Quad => ({ L: 22, H: 7, leg: 7, hw: 7, hh: 5, pesc: 5, sela: '#b5452f', a: '#8b5a2b', b: '#6b4220', v: '#5a3a1d', ear: 'ponta', tail: 'crina', focinho: true, crina: '#2b1d16', ...q })
/** o cavaleiro senta afundado 2px no lombo */
const montQuad = (q: (t: number) => Quad, q0 = q(0)): Montaria => ({
  alt: q0.leg + q0.H - 3, sentado: true,
  atras: (c, t, m) => quad(c, q(t), t, m),
  frontal: (c, layer, costas, t, m) => quadFrente(c, q(t), layer, costas, t, m),
})
const roda = (c: C2D, x: number, y: number) => { r(c, OUT, x, y, 2, 2); r(c, '#9aa0a6', x, y, 1, 1) }
export const MONTARIAS: Record<string, Montaria> = {
  'cavalinho-pau': {
    alt: 0, sentado: false, atras: () => {},
    frente: c => {
      for (let k = 0; k < 10; k++) r(c, '#8b5a2b', -6 + k, -2 - k, 1, 1)
      pecas(c, [['#f4f4f4', 3, -15, 5, 4], ['#f4f4f4', 8, -13, 2, 2]])
      r(c, '#e05a47', 2, -16, 2, 5); r(c, OUT, 6, -14, 1, 1); roda(c, -7, -2)
    },
  },
  skate: { alt: 3, sentado: false, atras: c => { pecas(c, [['#e05a47', -6, -3, 12, 1]]); roda(c, -5, -1); roda(c, 3, -1) } },
  patinete: {
    alt: 3, sentado: false,
    atras: c => { pecas(c, [['#3a6fd8', -6, -3, 11, 1]]); roda(c, -6, -1); roda(c, 4, -1) },
    frente: c => { pecas(c, [['#9aa0a6', 5, -17, 1, 14]]); pecas(c, [['#2d2d33', 3, -18, 5, 1]]) },
  },
  cadeira: {
    alt: 5, sentado: true,
    atras: c => {
      pecas(c, [['#2d2d33', -7, -19, 2, 11], ['#9aa0a6', -1, -6, 2, 3], ['#2d2d33', -6, -8, 11, 2]])
      r(c, OUT, -5, -3, 10, 1); roda(c, -6, -2); roda(c, 4, -2)
    },
  },
  cavalo: montQuad(() => cavalo({})),
  ponei: montQuad(() => cavalo({ L: 18, H: 6, leg: 6, hw: 6, pesc: 4, sela: '#3a6fd8', a: '#f4f4f4', b: '#d8d8de', v: '#e8c9d3', crina: '#f28cb1' })),
  unicornio: montQuad(t => cavalo({
    L: 18, H: 6, leg: 6, hw: 6, pesc: 4, sela: '#8e5bd6', a: '#fbf6ff', b: '#ddd3ee', v: '#f2d9ec', chifre: '#FBC222',
    crina: ['#e05a47', '#f39c35', '#FBC222', '#3fa66b', '#3a6fd8', '#8e5bd6'][Math.floor(t / 200) % 6],
  })),
  'capivara-gigante': montQuad(() => ({ L: 22, H: 8, leg: 4, hw: 8, hh: 6, a: '#9b7652', b: '#7a5a3c', v: '#b08a63', ear: 'redonda', tail: 'nenhuma', focinho: true })),
  'boia-flamingo': {
    alt: 4, sentado: true,
    atras: c => { pecas(c, [['#f28cb1', -8, -6, 15, 4]]); r(c, '#f9c6d6', -7, -6, 13, 1) },
    frente: c => { pecas(c, [['#f28cb1', 6, -14, 2, 9], ['#f28cb1', 6, -16, 4, 3]]); r(c, OUT, 10, -15, 1, 2); r(c, OUT, 8, -15, 1, 1) },
    frontal: (c, layer, costas) => {
      const pescoco = () => { pecas(c, [['#f28cb1', -1, -14, 2, 9], ['#f28cb1', -2, -17, 4, 3]]); if (!costas) { r(c, OUT, -1, -16, 1, 1); r(c, OUT, 1, -16, 1, 1); r(c, OUT, -1, -14, 2, 2) } }
      if (layer === 'atras') { pecas(c, [['#f28cb1', -8, -6, 16, 4]]); r(c, '#f9c6d6', -7, -6, 14, 1); if (costas) pescoco() }
      else if (!costas) pescoco()
    },
  },
  tapete: {
    alt: 7, sentado: true, flutua: true,
    atras: (c, t) => {
      for (let k = 0; k < 18; k++) {
        const y = -4 + Math.round(Math.sin(t / 220 + k / 3))
        r(c, OUT, -9 + k, y - 1, 1, 4); r(c, k % 4 < 2 ? '#b5452f' : '#8f2b26', -9 + k, y, 1, 2)
      }
      r(c, '#FBC222', -10, -4, 1, 2); r(c, '#FBC222', 9, -4, 1, 2)
    },
  },
  nuvem: {
    alt: 7, sentado: true, flutua: true,
    atras: (c, t) => {
      const y = Math.round(Math.sin(t / 400))
      pecas(c, [['#f4f8ff', -9, -6 + y, 18, 4], ['#f4f8ff', -6, -8 + y, 6, 2], ['#f4f8ff', 1, -9 + y, 6, 3]])
      r(c, '#dbe6f7', -8, -3 + y, 16, 1)
    },
  },
}
export const montariaDe = (k?: string) => (k ? MONTARIAS[k] : undefined)
/** sobe/desce de leve quando a montaria flutua */
export const altDe = (m: Montaria | undefined, t: number) => (m ? m.alt + (m.flutua ? Math.round(Math.sin(t / 400)) : 0) : 0)
export function drawMontaria(c: C2D, m: Montaria | undefined, layer: 'atras' | 'frente', x: number, y: number, dir: Dir, t: number, mov: boolean) {
  if (m?.frontal && (dir === 'down' || dir === 'up')) { virado(c, x, y, false, () => m.frontal!(c, layer, dir === 'up', t, mov)); return }
  const f = m?.[layer]
  if (!f) return
  virado(c, x, y, dir === 'left' || dir === 'up', () => f(c, t, mov))
}

// ---- ações a dois ----
export interface Acao { k: string; com: string; ate: number }
export const ACOES: Record<string, { nome: string; ms: number; icone: string; fala: string }> = {
  colo: { nome: 'Pegar no colo', ms: 20e3, icone: '🤲', fala: 'te pegou no colo!' },
  cavalinho: { nome: 'Levar de cavalinho', ms: 20e3, icone: '🐎', fala: 'te levou de cavalinho!' },
  abraco: { nome: 'Dar um abraço', ms: 4e3, icone: '🤗', fala: 'te deu um abraço!' },
  toca: { nome: 'Toca aqui', ms: 2.5e3, icone: '✋', fala: 'bateu na sua mão!' },
  danca: { nome: 'Dancinha a dois', ms: 8e3, icone: '💃', fala: 'chamou você pra dançar!' },
}
/** onde a outra pessoa aparece durante a ação, em relação aos pés de quem fez */
export function lugarNaAcao(k: string, dir: Dir, t: number) {
  const lado = dir === 'left' ? -1 : 1
  if (k === 'colo') return { dx: 3 * lado, dy: -8, dir, frente: true, frame: 0 as const }
  if (k === 'cavalinho') return { dx: -4 * lado, dy: -9, dir, frente: false, frame: 0 as const }
  const vira: Dir = lado > 0 ? 'left' : 'right'
  if (k === 'danca') return { dx: 12 * lado, dy: -Math.max(0, Math.round(Math.sin(t / 160 + 1.5) * 3)), dir: vira, frente: true, frame: (Math.floor(t / 320) % 2 ? 1 : 2) as 1 | 2 }
  return { dx: (k === 'abraco' ? 7 : 11) * lado, dy: 0, dir: vira, frente: true, frame: 0 as const }
}
/** efeito em volta do par (cx = meio entre os dois, top = altura das cabeças) */
export function drawEfeitoAcao(c: C2D, k: string, cx: number, top: number, t: number, ini: number) {
  const p = (t - ini)
  if (k === 'abraco') for (let i = 0; i < 3; i++) {
    const q = ((p / 1400) + i / 3) % 1, x = Math.round(cx - 4 + i * 4), y = Math.round(top - q * 10)
    r(c, '#e8508a', x, y, 1, 1); r(c, '#e8508a', x + 2, y, 1, 1); r(c, '#e8508a', x - 1, y + 1, 5, 1); r(c, '#e8508a', x, y + 2, 3, 1); r(c, '#e8508a', x + 1, y + 3, 1, 1)
  }
  if (k === 'toca' && p % 1200 < 500) {
    const s = 2 + Math.floor((p % 1200) / 120)
    for (let i = 0; i < 8; i++) { const a = i * 0.785; r(c, i % 2 ? '#FBC222' : '#fff3c4', Math.round(cx + Math.cos(a) * s), Math.round(top + 8 + Math.sin(a) * s), 1, 1) }
  }
  if (k === 'danca') for (let i = 0; i < 3; i++) {
    const q = ((p / 1800) + i / 3) % 1, x = Math.round(cx - 6 + i * 6 + Math.sin(q * 6) * 2), y = Math.round(top + 2 - q * 12)
    r(c, OUT, x, y, 2, 2); r(c, OUT, x + 1, y - 4, 1, 4); r(c, OUT, x + 2, y - 4, 1, 1)
  }
}

const SENTA = 4
/** pernas de quem está montado (o sprite sentado perde as pernas): de lado uma perna dobrada pra frente, de frente/costas as duas abertas */
function pernas(c: C2D, av: Avatar, fx: number, hy: number, dir: Dir, largo = false) {
  const p = av.bottom, P = shade(av.bottom), h = av.shoes
  if (dir === 'down' || dir === 'up') {
    // de frente/costas: coxas curtas abertas e canelas finas pendendo dos lados (mais abertas no lombo de bicho)
    const o = largo ? 6 : 4
    c.save(); c.translate(Math.round(fx), Math.round(hy))
    r(c, OUT, -o - 1, -1, 2 * o + 2, 4); r(c, OUT, -o - 1, 0, 4, 7); r(c, OUT, o - 2, 0, 4, 7)
    r(c, p, -o, 0, 2 * o, 2); r(c, p, -o, 0, 2, 5); r(c, p, o - 1, 0, 2, 5); r(c, P, -o, 3, 2, 1); r(c, P, o - 1, 3, 2, 1)
    r(c, h, -o, 5, 2, 1); r(c, h, o - 1, 5, 2, 1)
    c.restore()
    return
  }
  // de lado: coxa curta pra frente e canela fina descendo
  virado(c, fx, hy, dir === 'left', () => {
    r(c, OUT, -1, -1, 6, 4); r(c, OUT, 2, 0, 4, 7); r(c, OUT, 2, 5, 5, 3)
    r(c, p, 0, 0, 4, 2); r(c, p, 3, 0, 2, 5); r(c, P, 3, 3, 2, 1)
    r(c, h, 3, 5, 3, 2)
  })
}
/** boneco completo com montaria e bichinho; fx, fy = pés. Devolve quanto subiu (pra nome e balão). */
export function drawBoneco(c: C2D, av: Avatar, photo: string | null | undefined, fx: number, fy: number, dir: Dir, frame: 0 | 1 | 2, t: number, mov: boolean, pulo = 0) {
  const m = montariaDe(av.gear?.montaria)
  const alt = altDe(m, t)
  if (dir === 'up') drawPet(c, av.gear?.pet, fx, fy, dir, t, mov)
  drawMontaria(c, m, 'atras', fx, fy, dir, t, mov)
  const ax = Math.round(fx - 8), ay = Math.round(fy - SPRITE_H + 1 - alt - pulo)
  if (m?.sentado) {
    // sentado: some a perna (5 linhas de baixo) e o tronco desce até a sela
    c.save(); c.beginPath(); c.rect(ax - 4, ay - 40 + SENTA, 24, 40 + SPRITE_H - 5); c.clip()
    drawAvatar(c, av, photo ?? null, ax, ay + SENTA, dir, 0)
    c.restore()
    pernas(c, av, fx, fy - alt - pulo, dir, !!m.frontal)
  } else drawAvatar(c, av, photo ?? null, ax, ay, dir, m ? 0 : frame)
  drawMontaria(c, m, 'frente', fx, fy, dir, t, mov)
  if (dir !== 'up') drawPet(c, av.gear?.pet, fx, fy, dir, t, mov)
  return m?.sentado ? alt - SENTA : alt
}
