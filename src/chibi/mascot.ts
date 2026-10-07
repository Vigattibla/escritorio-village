// Vila, o mascote: pintinho amarelo Village, 16x16.
const ROWS = [
  '.......o',
  '......oy',
  '....oooo',
  '...oyyyy',
  '..oyyyyy',
  '.oyyyyyy',
  '.oyyeyyy',
  '.oyyeyyy',
  'oybyyyyk',
  'oyyyyyyk',
  'oYyyyyyy',
  'oYyyyyyy',
  '.oYyyyyy',
  '..oYYYYY',
  '...ooooo',
  '....kk..',
]
const PAL: Record<string, string> = { o: '#0B235D', y: '#FBC222', Y: '#e0a800', e: '#0B235D', b: '#f59ab5', k: '#f28c28', m: '#7a2e2e' }

export type MascotFrame = 'idle' | 'blink' | 'talk'
const cache = new Map<MascotFrame, HTMLCanvasElement>()

export function mascotSprite(f: MascotFrame) {
  const hit = cache.get(f)
  if (hit) return hit
  const cv = document.createElement('canvas')
  cv.width = cv.height = 16
  const ctx = cv.getContext('2d')!
  ROWS.forEach((half, r) => {
    for (let c = 0; c < 16; c++) {
      let ch = c < 8 ? half[c] : half[15 - c]
      if (ch === '.') continue
      if (f === 'blink' && r === 6 && ch === 'e') ch = 'y'
      if (f === 'talk' && r === 9 && ch === 'k') ch = 'm'
      ctx.fillStyle = PAL[ch]
      ctx.fillRect(c, r, 1, 1)
    }
  })
  cache.set(f, cv)
  return cv
}
