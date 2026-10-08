import { baseArt, tintOf } from '../shop/catalog'
import type { Avatar, Dir, HairStyle, Outfit } from '../types'

export const SKINS = ['#ffe3cc', '#f6c9a3', '#e2aa7e', '#c4864f', '#8d5a3b', '#5c3923']
export const HAIR_COLORS = ['#2b1d16', '#5a3825', '#8b5a2b', '#d9a441', '#f2d16b', '#b5452f', '#9aa0a6', '#7b5cd6', '#2f7de1', '#e86fa6']
export const TOPS = ['#0B235D', '#FBC222', '#e05a47', '#3fa66b', '#4a90d9', '#8e5bd6', '#f28cb1', '#f4f4f4', '#2d2d33', '#f39c35']
export const BOTTOMS = ['#2c3e66', '#1f1f24', '#7a5a3a', '#5a6b7a', '#c9b48a', '#3d5a3a', '#8e5bd6']
export const SHOES = ['#1f1f24', '#f4f4f4', '#7a4a2a', '#c0392b', '#2f7de1', '#FBC222']
export const HAIR_STYLES: { id: HairStyle; label: string }[] = [
  { id: 'curto', label: 'Curto' },
  { id: 'longo', label: 'Longo' },
  { id: 'coque', label: 'Coque' },
  { id: 'cacheado', label: 'Cacheado' },
  { id: 'raspado', label: 'Raspado' },
]
export const OUTFITS: { id: Outfit; label: string }[] = [
  { id: 'camiseta', label: 'Camiseta' },
  { id: 'moletom', label: 'Moletom' },
  { id: 'social', label: 'Social' },
  { id: 'vestido', label: 'Vestido' },
  { id: 'terno', label: 'Terno' },
]

export const DEFAULT_AVATAR: Avatar = {
  skin: SKINS[1],
  hair: 'curto',
  hairColor: HAIR_COLORS[1],
  outfit: 'camiseta',
  top: '#0B235D',
  bottom: BOTTOMS[0],
  shoes: SHOES[0],
  face: 'pixel',
  pixelPhoto: true,
}

export const SPRITE_W = 16
export const SPRITE_H = 27
const HEAD_Y = 3
const BODY_Y = 15
const OUT = '#1d1a2b'

export function shade(hex: string, f = 0.78) {
  const n = parseInt(hex.slice(1), 16)
  const r = Math.round(((n >> 16) & 255) * f)
  const g = Math.round(((n >> 8) & 255) * f)
  const b = Math.round((n & 255) * f)
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)
}

// Templates são meias-linhas (8 colunas) espelhadas para 16.
const HEAD = [
  '....oooo',
  '..oossss',
  '.ossssss',
  'osssssss',
  'osssssss',
  'osssssss',
  'osssssss',
  'osssssss',
  'osssssss',
  '.ossssss',
  '..oossss',
  '....oooo',
]

// Linha de 8 = meia linha espelhada; linha de 16 = desenho inteiro (peças assimétricas).
type Art = { yo: number; rows: string[] }
/** nape: no boneco de costas, a cabeça fica pele a partir desta linha (raspado/careca) */
type Hair = Art & { nape?: number }
const HAIR: Record<string, Hair> = {
  curto: { yo: 0, rows: ['....oooo', '..oorrrr', '.orrrrrr', 'orrrrrrr', 'orrrRrrr', 'orr..rrr', 'or......'] },
  longo: {
    yo: 0,
    rows: ['....oooo', '..oorrrr', '.orrrrrr', 'orrrrrrr', 'orrrRrrr', 'orrr.rrr', 'orr.....', 'orr.....', 'orr.....', 'orR.....', 'orr.....', 'orr.....', 'orR.....', '.or.....', '..o.....'],
  },
  coque: { yo: -3, rows: ['......oo', '.....orr', '.....oRr', '....oooo', '..oorrrr', '.orrrrrr', 'orrrRrrr', 'orrr..rr', 'or......'] },
  cacheado: {
    yo: -2,
    rows: ['...ooooo', '..orrrrr', '.orrRrrr', 'orrrrrRr', 'orRrrrrr', 'orrrrRrr', 'orrrrrrr', 'orr.rr.r', 'orr.....', 'oRr.....', 'orr.....', '.oo.....'],
  },
  raspado: { yo: 0, nape: 4, rows: ['....oooo', '..ooRRRR', '.oRRRRRR', 'oR......'] },
  // ---- Almoxarifado ----
  franja: { yo: 0, rows: ['....oooo', '..oorrrr', '.orrrrrr', 'orrrrrrr', 'orrrrrrr', 'orRrRrRr', 'or......', 'or......'] },
  rabo: {
    yo: -3,
    rows: ['.........ooo....', '........orRo....', '.......oolo.....', '....oooooooo....', '..oorrrrrrrroo..', '.orrrrrrrrrrrro.', 'orrrrrrrrrrrrrro', 'orrrRrrrrrrRrrro', 'orr..........rro', 'or............ro'],
  },
  chanel: { yo: 0, rows: ['....oooo', '..oorrrr', '.orrrrrr', 'orrrrrrr', 'orrrrrrr', 'orRrrrrr', 'orr.....', 'orr.....', 'orr.....', 'orR.....', '.oo.....'] },
  topete: { yo: -2, rows: ['....oooo', '..oorrrr', '.orrrRrr', 'orrrrrRr', 'orrrrrrr', 'orrRrrrr', 'or......', 'or......'] },
  ondulado: {
    yo: 0,
    rows: ['....oooo', '..oorrrr', '.orrrrrr', 'orrrRrrr', 'orRrrrrr', 'orrr..rr', 'orr.....', 'oRr.....', '.orr....', 'orr.....', 'oRr.....', '.oo.....'],
  },
  careca: { yo: 1, nape: 0, rows: ['................', '....ww..........', '...w............'] },
  moicano: { yo: -3, rows: ['......oo', '.....orr', '.....oRr', '....oorr', '.....orr', '.....orr', '......rr', '......Rr'] },
  tranca: {
    yo: 0,
    rows: ['....oooooooo....', '..oorrrrrrrroo..', '.orrrrrrrrrrrro.', 'orrrrrrrrrrrrrro', 'orrRrrrrrrrrRrro', 'orr..rrrrrr..rro', 'orr...........ro', 'oRr.............', 'orR.............', 'oRr.............', 'orR.............', 'oRo.............', 'olo.............', '.ro.............', '.o..............'],
  },
  black: {
    yo: -3,
    rows: ['...ooooo', '.oorrrrr', 'orrrRrrr', 'orRrrrrr', 'orrrrrRr', 'orrRrrrr', 'orrrrrrr', 'orrRrrrr', 'orr.....', 'orr.....', 'oRr.....', 'orr.....', '.oo.....'],
  },
  chiquinha: { yo: -2, rows: ['.oo.....', 'orro....', 'orRooooo', '.oolrrrr', '.orrrrrr', 'orrrrrrr', 'orrrRrrr', 'orr..rrr', 'or......'] },
  espetado: { yo: -3, rows: ['.o....o.', 'oro..oro', 'orroorrr', 'orrrrrrr', 'orrrRrrr', 'orrrrrrr', 'orrrrRrr', 'orRrrrrr', 'or.rr.rr', 'or......'] },
  mullet: {
    yo: 0,
    rows: ['....oooo', '..oorrrr', '.orrrrrr', 'orrrrrrr', 'orrRrrrr', 'orr..rrr', 'or......', 'or......', 'orr.....', 'orR.....', 'orr.....', 'oRrr....', '.orr....', '..oo....'],
  },
  samurai: { yo: -3, rows: ['......oo', '.....orr', '......oz', '....oooo', '..oorrrr', '.orrrrrr', 'orrrrrrr', 'orrrrrrr', 'or......', 'or......'] },
  dread: {
    yo: 0,
    rows: ['....oooo', '..oorrrr', '.orRrRrr', 'oRrRrRrR', 'orRrRrRr', 'oRr..RrR', 'orRo....', 'oRro....', 'orRo....', 'oRro....', 'orRo....', 'oRro....', 'orRo....', '.oRo....', '.oo.....'],
  },
}

const CAMISETA = [
  '......os',
  '...ooccc',
  '..occccc',
  '.oCccccc',
  '.oCccccc',
  '.oCccccc',
  '.ossCccc',
  '..oppppp',
  '...opppo',
  '...opppo',
  '..ohhhho',
  '..oooooo',
]
const LEGS = CAMISETA.slice(7)

/** back: troca de letra no boneco de costas (detalhe da frente some); backRows: desenho próprio das costas */
type Fit = { rows: string[]; back?: Record<string, string>; backRows?: string[]; lift?: number }
const BASIC_BACK = { w: 'c', t: 'c', T: 'c', a: 'c' }
const BODY: Record<string, Fit> = {
  camiseta: { rows: CAMISETA, back: BASIC_BACK },
  moletom: { back: BASIC_BACK, rows: ['.....oCs', '...oocac', '..occcac', '.oCccccc', '.oCcCCCC', '.oCcCCCC', '.ossCccc', ...LEGS] },
  social: { back: BASIC_BACK, rows: ['......ow', '...oocwt', '..occcwt', '.oCcccwt', '.oCcccwt', '.oCcccwt', '.ossCccc', ...LEGS] },
  // corpo mais redondo (barriga até a borda), paletó aberto em V, camisa branca e gravata
  terno: {
    back: BASIC_BACK,
    lift: 9,
    rows: ['.....oos', '...oocwT', '.oocccwt', 'oCccccwt', 'oCccccct', 'oCcccccc', 'oCcccccc', 'ossCcccc', '.ooCCCCC', '...opppo', '..ohhhho', '..oooooo'],
  },
  vestido: { back: BASIC_BACK, rows: [...CAMISETA.slice(0, 7), '..oCcccc', '.oCccccc', '.oCCCCCC', '...osso.', '...ohho.'] },
  // ---- Almoxarifado ----
  regata: { rows: ['......os', '...ooscc', '..ossccc', '.osScccc', '.osScccc', '.osScccc', '.ossCccc', ...LEGS] },
  polo: { rows: ['......os', '...ooxxs', '..occcxC', '.oCccccC', '.oCccccc', '.oCccccc', '.ossCccc', ...LEGS], back: { C: 'c' } },
  listrada: { rows: ['......os', '...ooccc', '..oXXXXX', '.oCccccc', '.oXXXXXX', '.oCccccc', '.ossXXXX', ...LEGS] },
  avental: {
    rows: ['......os', '...ooccw', '..occcww', '.oCccwww', '.oCccwww', '.oCcwwww', '.ossWwww', '..opaaaa', '...opppo', '...opppo', '..ohhhho', '..oooooo'],
    back: { w: 'c', W: 'C', a: 'p' },
  },
  xadrez: { rows: ['......os', '...oocKc', '..oKKKKK', '.oCcKccK', '.oCcKccK', '.oKKKKKK', '.ossKccK', ...LEGS] },
  jaqueta: { rows: ['......os', '...oouuc', '..ouuuuc', '.oUuuuuc', '.oUuuuUc', '.oUuuuuc', '.ossUuuc', ...LEGS], back: { c: 'u' } },
  colete: { rows: ['......ow', '...oowcw', '..owcccw', '.oWwcccc', '.oWwcccc', '.oWwcccC', '.ossCccc', ...LEGS], back: { C: 'c' } },
  uniforme: { rows: ['......os', '...ooEyy', '..oEEEEy', '.oFEEEEE', '.oyyyyyy', '.oFEEEEE', '.ossFEEE', ...LEGS], back: { y: 'E' } },
  jardineira: { rows: ['......os', '...ooccp', '..occcpc', '.oCccppp', '.oCccppp', '.oCcpppp', '.ossPppp', ...LEGS] },
  cardiga: { rows: ['......os', '...oocCw', '..occcCg', '.oCcccCw', '.oCcccCg', '.oCCCcCw', '.ossCcCg', ...LEGS], back: { w: 'c', g: 'c', C: 'c' } },
  time: {
    rows: ['......os', '...ooXXX', '..oXcccc', '.oXXcccc', '.oCccccc', '.oCccccc', '.ossCccc', ...LEGS],
    backRows: ['......osso......', '...ooXXXXXXoo...', '..occXXccXXXco..', '.oCcccXccXcXcCo.', '.oCcccXccXcXcCo.', '.oCcccXccXXXcCo.', '.ossCccccccCsso.', ...LEGS],
  },
  macacao: { rows: ['......os', '...ooccc', '..occccC', '.oCccccC', '.oCCCCCC', '.oCccccC', '.ossCccC', '..occccc', '...occco', '...occco', '..ohhhho', '..oooooo'] },
  havaiana: {
    rows: ['......osso......', '...ooxccccxoo...', '..ocyccclccyco..', '.oCcclcccycccCo.', '.oCyccclcccycCo.', '.oCcclccyccclCo.', '.ossCylccycCsso.', ...LEGS],
  },
  blazer: { rows: ['......os', '...oocww', '..occCww', '.oCcyCww', '.oCcccCw', '.oCccccC', '.ossCccc', ...LEGS], back: { w: 'c', y: 'c', C: 'c' } },
  salvavidas: {
    rows: ['......os', '...ooszz', '..osszzz', '.osSzzzw', '.osSzwww', '.osSzzzw', '.ossZzzz', '..ozzzzz', '...ozzzo', '...ossso', '..ohhhho', '..oooooo'],
    back: { w: 'z' },
  },
  chef: { rows: ['......ow', '...oowww', '..owwwww', '.oWwwkww', '.oWwwwww', '.oWwwkww', '.ossWwww', ...LEGS], back: { k: 'w' } },
}

/** chapéus e afins (A/B = cor da peça) */
const HATS: Record<string, Art> = {
  bone: { yo: -1, rows: ['....oooo', '..ooAAAA', '.oAAAAAA', 'oAAAAAAw', 'oBBBBBBB', 'oooooooo'] },
  gorro: { yo: -3, rows: ['......oo', '.....oww', '....oooo', '..ooAAAA', '.oAAAAAA', 'oAAAAAAA', 'oBABABAB', 'oBBBBBBB', 'oooooooo'] },
  laco: { yo: -1, rows: ['.........oo.oo..', '........oAAoAAo.', '........oAABAAo.', '.........oo.oo..'] },
  viseira: { yo: 2, rows: ['.ooooooo', 'oAAAAAAA', 'oBBBBBBB', 'oooooooo'] },
  bandana: { yo: 0, rows: ['....oooo', '..oozzzz', '.ozzwzzz', 'ozzzzzwz', 'oZZZZZZZ', 'oooooooo'] },
  palha: { yo: -1, rows: ['....oooo', '...odddd', '...ozzzz', 'oddddddd', 'oDdDdDdD', 'oooooooo'] },
  flores: { yo: 1, rows: ['..oylvwl', '.ovlyvlv'] },
  fone: { yo: -1, rows: ['....oooo', '..ooAAAA', '.oAo....', 'oAo.....', 'oAo.....', 'oAo.....', 'oooo....', 'oAAo....', 'oAAo....', 'oBAo....', 'oooo....'] },
  capacete: { yo: -1, rows: ['....oooo', '..ooyyyY', '.oyyyyyY', 'oyyyyyyY', 'oYYYYYYY', 'oooooooo'] },
  gato: { yo: -2, rows: ['..o.....', '.oAo....', '.olAo...', 'oAAAo...'] },
  antena: { yo: -3, rows: ['..ooo...', '..ovo...', '...o....', '....o...'] },
  cozinheiro: { yo: -3, rows: ['..oooooo', '.owwwwww', '.owwWwwW', '..owwwww', '..oWWWWW', '..oooooo'] },
  cartola: { yo: -3, rows: ['...ooooo', '...okkkk', '...okkkk', '...ozzzz', 'oKKKKKKK', 'oooooooo'] },
  cowboy: { yo: -2, rows: ['...ooooo', '...onNnn', '...onnnn', 'oo.oNNNN', 'onnnnnnn', '.ooooooo'] },
  helice: {
    yo: -3,
    rows: ['...zzzzoyyyy....', '.......oo.......', '....oooooooo....', '..ooAAAAAAAAoo..', '.oAAAAAAAAAAAAo.', 'oBBBBBBBBBBBBBBo', 'oooooooooooooooo'],
  },
  coroa: { yo: -2, rows: ['..o....o', '..ogo.og', '..oggogg', '..oggzgg', '..oGGGGG', '..oooooo'] },
}

/** rosto: só de frente, acompanha o olhar quando vira pra direita */
const FACE: Record<string, Art> = {
  'oculos-redondo': { yo: 5, rows: ['....ooo.', '...o...o', '...o...o', '....ooo.'] },
  'oculos-quadrado': { yo: 5, rows: ['...ooooo', '...o...o', '...o...o', '...oooo.'] },
  'oculos-escuro': { yo: 5, rows: ['..oooooo', '...kkkko', '...kWkk.', '....kk..'] },
  'oculos-3d': { yo: 5, rows: ['...oooooooooo...', '...ozzzooiiio...', '...ozzzooiiio...', '...oooooooooo...'] },
  monoculo: { yo: 5, rows: ['.........ggg....', '........g...g...', '........g...g...', '.........ggg....', '............g...', '.............g..', '.............g..'] },
  bigode: { yo: 8, rows: ['.....rrr', '....r...'] },
  cavanhaque: { yo: 9, rows: ['......r.', '......rr', '......Rr'] },
  barba: { yo: 7, rows: ['or......', 'orr.....', 'orrRrr..', '.orrrrrr', '..orRrrr', '....oooo'] },
  pirata: { yo: 2, rows: ['.............kk.', '...........kk...', '.........kk.....', 'kkkkkkkkk.......', '....kKk.........', '....kkk.........', '.....k..........'] },
  sardas: { yo: 8, rows: ['..f.f...', '...f....'] },
  mascara: { yo: 5, rows: ['.kkkkkkk', 'kkkkw.wk', 'kkkkw.wk', '.kkkkkk.'] },
}

const FIX: Record<string, string> = {
  k: '#2d2d33', K: '#17171c', g: '#f2c230', G: '#b8901c', n: '#8a5a36', N: '#5e3b22', y: '#FBC222', Y: '#c99412',
  z: '#e05a47', Z: '#a33a2c', i: '#bfe6ff', I: '#7fb7da', q: '#9aa0a6', Q: '#6b7078', v: '#3fa66b', V: '#2a7349',
  l: '#f28cb1', L: '#c9618a', u: '#3a6fd8', U: '#26489a', j: '#f39c35', d: '#e8c873', D: '#c49a45', E: '#0B235D',
  F: '#071640', W: '#d8dbe2', f: '#c98b5f',
}
function mix(hex: string, to: string, f: number) {
  const a = parseInt(hex.slice(1), 16), b = parseInt(to.slice(1), 16)
  const ch = (s: number) => Math.round(((a >> s) & 255) * (1 - f) + ((b >> s) & 255) * f)
  return '#' + ((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1)
}
function lum(hex: string) {
  const n = parseInt(hex.slice(1), 16)
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255
}
function palette(av: Avatar): Record<string, string> {
  const tint = (av.gear?.chapeu && tintOf('chapeu', av.gear.chapeu)) || '#3a6fd8'
  return {
    ...FIX, o: OUT, s: av.skin, S: shade(av.skin), c: av.top, C: shade(av.top), p: av.bottom, P: shade(av.bottom),
    h: av.shoes, w: '#ffffff', t: '#c8403a', T: '#8f2b26', a: '#f4f4f4', r: av.hairColor, R: shade(av.hairColor, 0.72),
    e: OUT, b: '#f4a3a0', m: '#8a3b3b', x: mix(av.top, '#ffffff', 0.35), X: lum(av.top) > 0.55 ? shade(av.top, 0.5) : '#f4f4f4',
    A: tint, B: shade(tint),
  }
}

const cache = new Map<string, HTMLCanvasElement>()

function cell(half: string, c: number) {
  return c < 8 ? half[c] : half[15 - c]
}
const at = (row: string, c: number) => (row.length > 8 ? row[c] : cell(row, c))
type Px = (x: number, y: number, ch: string) => void
function paint(px: Px, art: Art, dx = 0) {
  art.rows.forEach((row, r) => {
    for (let c = 0; c < 16; c++) {
      const ch = at(row, c)
      if (!ch || ch === '.' || c + dx > 15) continue
      px(c + dx, HEAD_Y + art.yo + r, ch)
    }
  })
}
const hatOf = (av: Avatar) => (av.gear?.chapeu ? HATS[baseArt(av.gear.chapeu)] : undefined)

function canvasFor(key: string, draw: (px: Px) => void, pal: Record<string, string>) {
  const cv = document.createElement('canvas')
  cv.width = SPRITE_W
  cv.height = SPRITE_H
  const ctx = cv.getContext('2d')!
  draw((x, y, ch) => {
    const col = pal[ch]
    if (!col) return
    ctx.fillStyle = col
    ctx.fillRect(x, y, 1, 1)
  })
  cache.set(key, cv)
  return cv
}
function mirrored(key: string, src: HTMLCanvasElement) {
  const cv = document.createElement('canvas')
  cv.width = SPRITE_W
  cv.height = SPRITE_H
  const ctx = cv.getContext('2d')!
  ctx.translate(SPRITE_W, 0)
  ctx.scale(-1, 1)
  ctx.drawImage(src, 0, 0)
  cache.set(key, cv)
  return cv
}

/** Corpo (e cabeça pixel, se withHead) num canvas 16x27, cacheado. */
export function bodySprite(av: Avatar, dir: Dir, frame: 0 | 1 | 2, withHead: boolean): HTMLCanvasElement {
  const key = [av.skin, av.hair, av.hairColor, av.outfit, av.top, av.bottom, av.shoes, av.gear?.chapeu, av.gear?.rosto, dir, frame, withHead].join('|')
  const hit = cache.get(key)
  if (hit) return hit
  if (dir === 'left') return mirrored(key, bodySprite(av, 'right', frame, withHead))

  const back = dir === 'up'
  return canvasFor(key, px => {
    const fit = BODY[av.outfit] ?? BODY.camiseta
    const swap = back ? fit.back ?? {} : {}
    ;(back && fit.backRows ? fit.backRows : fit.rows).forEach((row, r) => {
      for (let c = 0; c < 16; c++) {
        let ch = at(row, c)
        if (ch === '.') continue
        ch = swap[ch] ?? ch
        const lift = r >= (fit.lift ?? 8) && ((frame === 1 && c < 8) || (frame === 2 && c >= 8)) ? 1 : 0
        px(c, BODY_Y + r - lift, ch)
      }
    })
    if (!withHead) return
    const hs = HAIR[av.hair] ?? HAIR.curto
    HEAD.forEach((half, r) => {
      for (let c = 0; c < 16; c++) {
        let ch = cell(half, c)
        if (ch === '.') continue
        if (back && ch === 's') ch = hs.nape !== undefined && r >= hs.nape ? 's' : 'r'
        px(c, HEAD_Y + r, ch)
      }
    })
    const dx = dir === 'right' ? 1 : 0
    if (!back) {
      for (const ex of [5, 10]) {
        px(ex + dx, HEAD_Y + 6, 'e')
        px(ex + dx, HEAD_Y + 7, 'e')
      }
      px(3 + dx, HEAD_Y + 8, 'b')
      px(12 + dx, HEAD_Y + 8, 'b')
      px(7 + dx, HEAD_Y + 9, 'm')
      px(8 + dx, HEAD_Y + 9, 'm')
    }
    paint(px, hs)
    const face = av.gear?.rosto ? FACE[av.gear.rosto] : undefined
    if (face && !back) paint(px, face, dx)
    const hat = hatOf(av)
    if (hat) paint(px, hat)
  }, palette(av))
}

/** Só o chapéu (por cima da foto, quando o rosto é foto) */
function hatSprite(av: Avatar, dir: Dir): HTMLCanvasElement | null {
  const hat = hatOf(av)
  if (!hat) return null
  const key = ['hat', av.gear!.chapeu, dir].join('|')
  const hit = cache.get(key)
  if (hit) return hit
  if (dir === 'left') return mirrored(key, hatSprite(av, 'right')!)
  return canvasFor(key, px => paint(px, hat), palette(av))
}

// ---- fotos ----
interface PhotoEntry { img: HTMLImageElement; pix: HTMLCanvasElement | null; ready: boolean; subs: Set<() => void> }
const photos = new Map<string, PhotoEntry>()

function photo(url: string): PhotoEntry {
  let e = photos.get(url)
  if (e) return e
  const img = new Image()
  e = { img, pix: null, ready: false, subs: new Set() }
  const entry = e
  img.onload = () => {
    const pix = document.createElement('canvas')
    pix.width = pix.height = 20
    const c = pix.getContext('2d')!
    c.imageSmoothingEnabled = true
    c.imageSmoothingQuality = 'high'
    c.drawImage(img, 0, 0, 20, 20)
    entry.pix = pix
    entry.ready = true
    entry.subs.forEach(f => f())
  }
  img.src = url
  photos.set(url, e)
  return e
}

export function onPhotoLoad(url: string, cb: () => void) {
  const e = photo(url)
  e.subs.add(cb)
  return () => { e.subs.delete(cb) }
}

/** Desenha o personagem com o topo-esquerdo em (x, y), em unidades lógicas. */
export function drawAvatar(ctx: CanvasRenderingContext2D, av: Avatar, photoUrl: string | null, x: number, y: number, dir: Dir, frame: 0 | 1 | 2) {
  const usePhoto = av.face === 'foto' && !!photoUrl && dir !== 'up'
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(bodySprite(av, dir, frame, !usePhoto), x, y)
  if (!usePhoto) return
  const hat = hatSprite(av, dir)
  const e = photo(photoUrl!)
  const cx = x + 8 + (dir === 'right' ? 0.5 : dir === 'left' ? -0.5 : 0)
  const cy = y + HEAD_Y + 6
  const r = 7.5
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  if (e.ready) {
    ctx.clip()
    if (av.pixelPhoto && e.pix) {
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(e.pix, cx - r, cy - r, r * 2, r * 2)
    } else {
      ctx.imageSmoothingEnabled = true
      ctx.drawImage(e.img, cx - r, cy - r, r * 2, r * 2)
    }
  } else {
    ctx.fillStyle = av.skin
    ctx.fill()
  }
  ctx.restore()
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.lineWidth = 0.8
  ctx.strokeStyle = OUT
  ctx.stroke()
  ctx.imageSmoothingEnabled = false
  if (hat) ctx.drawImage(hat, x, y)
}
