/** Bandeira da porta: flâmula na cor da sala com um emblema em pixel que o setor escolhe. */
import { OUT, rect as r, type C2D } from './base'

/** emblemas 5×5 (# = pixel aceso) */
export const EMBLEMAS: Record<string, { label: string; px: string[] }> = {
  estrela: { label: 'Estrela', px: ['..#..', '#####', '.###.', '.#.#.', '#...#'] },
  coracao: { label: 'Coração', px: ['.#.#.', '#####', '#####', '.###.', '..#..'] },
  raio: { label: 'Raio', px: ['...#.', '..#..', '.###.', '..#..', '.#...'] },
  megafone: { label: 'Megafone', px: ['....#', '..###', '#####', '..###', '....#'] },
  cifrao: { label: 'Cifrão', px: ['.###.', '#.#..', '.###.', '..#.#', '.###.'] },
  casa: { label: 'Casa', px: ['..#..', '.###.', '#####', '.#.#.', '.###.'] },
  folha: { label: 'Folha', px: ['...##', '..###', '.###.', '###..', '#....'] },
  sol: { label: 'Sol', px: ['#.#.#', '.###.', '#####', '.###.', '#.#.#'] },
  balao: { label: 'Conversa', px: ['.###.', '#####', '#####', '.##..', '.#...'] },
  visto: { label: 'Visto', px: ['....#', '...#.', '#.#..', '.#...', '.....'] },
}
export const EMBLEMA_KEYS = Object.keys(EMBLEMAS)

const darker = (hex: string, k: number) => {
  const n = parseInt(hex.slice(1), 16)
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * k))).toString(16).padStart(2, '0')
  return '#' + f(n >> 16) + f((n >> 8) & 255) + f(n & 255)
}
const light = (hex: string) => {
  const n = parseInt(hex.slice(1), 16)
  return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 150
}

/** flâmula pendurada (9×13) com ponta em V embaixo; (x, y) = canto de cima */
export function drawBanner(c: C2D, x: number, y: number, color: string, flag?: string | null) {
  const w = 9, h = 13, cx = x + 4, shade = darker(color, 0.82)
  r(c, OUT, x - 2, y - 1, w + 4, 1) // varão
  r(c, '#e0b65a', x - 2, y - 1, 1, 1); r(c, '#e0b65a', x + w + 1, y - 1, 1, 1)
  for (let k = 0; k < h; k++) {
    const g = k - (h - 4) // > 0: linha da ponta em V
    const fill = k === 0 ? shade : color
    if (g <= 0) {
      r(c, OUT, x - 1, y + k, w + 2, 1); r(c, fill, x, y + k, w, 1); r(c, shade, x + w - 1, y + k, 1, 1)
      continue
    }
    r(c, OUT, x - 1, y + k, 1, 1); r(c, fill, x, y + k, cx - g + 1 - x, 1); r(c, OUT, cx - g + 1, y + k, 1, 1)
    r(c, OUT, cx + g - 1, y + k, 1, 1); r(c, fill, cx + g, y + k, x + w - cx - g, 1); r(c, OUT, x + w, y + k, 1, 1)
    r(c, shade, x + w - 1, y + k, 1, 1)
  }
  r(c, OUT, x - 1, y + h, cx - 2 - x + 2, 1); r(c, OUT, cx + 2, y + h, x + w - cx - 1, 1)
  const e = flag ? EMBLEMAS[flag] : undefined
  if (!e) return
  const ink = light(color) ? '#1b2240' : '#ffffff'
  e.px.forEach((row, j) => { for (let i = 0; i < 5; i++) if (row[i] === '#') r(c, ink, x + 2 + i, y + 2 + j, 1, 1) })
}
