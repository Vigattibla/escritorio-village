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

const HAIR: Record<HairStyle, { yo: number; rows: string[] }> = {
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
  raspado: { yo: 0, rows: ['....oooo', '..ooRRRR', '.oRRRRRR', 'oR......'] },
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

const BODY: Record<Outfit, string[]> = {
  camiseta: CAMISETA,
  moletom: [
    '.....oCs',
    '...oocac',
    '..occcac',
    '.oCccccc',
    '.oCcCCCC',
    '.oCcCCCC',
    '.ossCccc',
    ...CAMISETA.slice(7),
  ],
  social: [
    '......ow',
    '...oocwt',
    '..occcwt',
    '.oCcccwt',
    '.oCcccwt',
    '.oCcccwt',
    '.ossCccc',
    ...CAMISETA.slice(7),
  ],
  vestido: [
    ...CAMISETA.slice(0, 7),
    '..oCcccc',
    '.oCccccc',
    '.oCCCCCC',
    '...osso.',
    '...ohho.',
  ],
}

const cache = new Map<string, HTMLCanvasElement>()

function cell(half: string, c: number) {
  return c < 8 ? half[c] : half[15 - c]
}

/** Corpo (e cabeça pixel, se withHead) num canvas 16x27, cacheado. */
export function bodySprite(av: Avatar, dir: Dir, frame: 0 | 1 | 2, withHead: boolean): HTMLCanvasElement {
  const key = [av.skin, av.hair, av.hairColor, av.outfit, av.top, av.bottom, av.shoes, dir, frame, withHead].join('|')
  const hit = cache.get(key)
  if (hit) return hit

  const cv = document.createElement('canvas')
  cv.width = SPRITE_W
  cv.height = SPRITE_H
  const ctx = cv.getContext('2d')!

  if (dir === 'left') {
    ctx.translate(SPRITE_W, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(bodySprite(av, 'right', frame, withHead), 0, 0)
    cache.set(key, cv)
    return cv
  }

  const back = dir === 'up'
  const pal: Record<string, string> = {
    o: OUT, s: av.skin, S: shade(av.skin), c: av.top, C: shade(av.top), p: av.bottom, P: shade(av.bottom),
    h: av.shoes, w: '#ffffff', t: '#c8403a', a: '#f4f4f4', r: av.hairColor, R: shade(av.hairColor, 0.72),
    e: OUT, b: '#f4a3a0', m: '#8a3b3b',
  }
  const px = (x: number, y: number, ch: string) => {
    ctx.fillStyle = pal[ch]
    ctx.fillRect(x, y, 1, 1)
  }

  BODY[av.outfit].forEach((half, r) => {
    for (let c = 0; c < 16; c++) {
      let ch = cell(half, c)
      if (ch === '.') continue
      if (back && 'wta'.includes(ch)) ch = 'c'
      const lift = r >= 8 && ((frame === 1 && c < 8) || (frame === 2 && c >= 8)) ? 1 : 0
      px(c, BODY_Y + r - lift, ch)
    }
  })

  if (withHead) {
    HEAD.forEach((half, r) => {
      for (let c = 0; c < 16; c++) {
        let ch = cell(half, c)
        if (ch === '.') continue
        if (back && ch === 's') ch = av.hair === 'raspado' && r > 3 ? 's' : 'r'
        px(c, HEAD_Y + r, ch)
      }
    })
    if (!back) {
      const dx = dir === 'right' ? 1 : 0
      for (const ex of [5, 10]) {
        px(ex + dx, HEAD_Y + 6, 'e')
        px(ex + dx, HEAD_Y + 7, 'e')
      }
      px(3 + dx, HEAD_Y + 8, 'b')
      px(12 + dx, HEAD_Y + 8, 'b')
      px(7 + dx, HEAD_Y + 9, 'm')
      px(8 + dx, HEAD_Y + 9, 'm')
    }
    const hs = HAIR[av.hair]
    hs.rows.forEach((half, r) => {
      for (let c = 0; c < 16; c++) {
        const ch = cell(half, c)
        if (ch === '.') continue
        px(c, HEAD_Y + hs.yo + r, ch)
      }
    })
  }

  cache.set(key, cv)
  return cv
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
}
