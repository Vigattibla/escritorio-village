import { OUT, rect as r, type C2D } from './base'

// ---- animação em volta do boneco (cx = centro, top = topo da cabeça) ----
export function drawAnim(c: C2D, kind: string | undefined, cx: number, top: number, t: number) {
  if (!kind) return
  const loop = (n: number, ms: number, f: (p: number, k: number) => void) => { for (let k = 0; k < n; k++) f(((t / ms) + k / n) % 1, k) }
  const heart = (x: number, y: number, col: string) => { r(c, col, x, y, 1, 1); r(c, col, x + 2, y, 1, 1); r(c, col, x - 1, y + 1, 5, 1); r(c, col, x, y + 2, 3, 1); r(c, col, x + 1, y + 3, 1, 1) }
  const plus = (x: number, y: number, col: string, s = 1) => { r(c, col, x - s, y, 2 * s + 1, 1); r(c, col, x, y - s, 1, 2 * s + 1) }
  if (kind === 'folhas') loop(4, 3000, (p, k) => r(c, k % 2 ? '#3fa66b' : '#7cc96b', cx - 12 + k * 7 + Math.round(Math.sin(p * 6 + k) * 2), top - 6 + p * 34, 2, 1))
  if (kind === 'bolhas') loop(4, 2600, (p, k) => { const x = cx - 10 + k * 6 + Math.round(Math.sin(p * 5 + k) * 2), y = top + 26 - p * 32; c.strokeStyle = '#9fd8f5'; c.lineWidth = 0.6; c.beginPath(); c.arc(x, y, 1.6, 0, 7); c.stroke() })
  if (kind === 'vapor') loop(3, 1800, (p, k) => r(c, `rgba(255,255,255,${0.9 - p})`, cx - 2 + k * 2 + Math.round(Math.sin(p * 7 + k) * 1.5), top - 2 - p * 10, 1, 1))
  if (kind === 'coracoes') loop(3, 2400, (p, k) => heart(cx - 9 + k * 7, top + 2 - p * 14, p > 0.7 ? '#f9b3cc' : '#e8508a'))
  if (kind === 'estrelas') loop(5, 1600, (p, k) => { if (p < 0.6) plus(cx - 12 + ((k * 13) % 25), top - 4 + ((k * 7) % 14), '#FBC222', p < 0.3 ? 1 : 0) })
  if (kind === 'notas') loop(3, 2200, (p, k) => { const x = cx + 7 + k * 3 + Math.round(Math.sin(p * 6) * 2), y = top + 4 - p * 14; r(c, OUT, x, y, 2, 2); r(c, OUT, x + 1, y - 4, 1, 4); r(c, OUT, x + 2, y - 4, 1, 1) })
  if (kind === 'faiscas') loop(6, 900, (p, k) => { const a = k * 1.05 + t / 700, d = 9 + p * 6; r(c, k % 2 ? '#f39c35' : '#FBC222', Math.round(cx + Math.cos(a) * d), Math.round(top + 12 + Math.sin(a) * d), 1, 1) })
  if (kind === 'nuvem' || kind === 'raio') {
    const y = top - 8
    r(c, OUT, cx - 7, y, 14, 5); r(c, '#9aa0a6', cx - 6, y + 1, 12, 3); r(c, '#b6bcc4', cx - 3, y - 1, 6, 2); r(c, OUT, cx - 4, y - 2, 8, 1)
    if (kind === 'nuvem') loop(4, 700, (p, k) => r(c, '#7fb7da', cx - 5 + k * 3, y + 5 + p * 6, 1, 2))
    else if (Math.floor(t / 250) % 4 === 0) { r(c, '#FBC222', cx, y + 4, 2, 2); r(c, '#FBC222', cx - 1, y + 6, 2, 2); r(c, '#FBC222', cx, y + 8, 2, 1) }
  }
  if (kind === 'borboletas') loop(2, 4000, (p, k) => { const a = p * 6.28 + k * 3, x = Math.round(cx + Math.cos(a) * 12), y = Math.round(top + 10 + Math.sin(a * 2) * 6), o = Math.floor(t / 150) % 2; r(c, k ? '#f39c35' : '#8e5bd6', x - 2 + o, y, 2 - o, 2); r(c, k ? '#f39c35' : '#8e5bd6', x + 1, y, 2 - o, 2); r(c, OUT, x, y, 1, 2) })
  if (kind === 'arco') ['#e05a47', '#f39c35', '#FBC222', '#3fa66b', '#3a6fd8', '#8e5bd6'].forEach((col, k) => { c.strokeStyle = col; c.lineWidth = 1; c.beginPath(); c.arc(cx, top + 8, 14 - k, Math.PI * 1.08, Math.PI * 1.92); c.stroke() })
  if (kind === 'aureola') { const y = top - 4 + Math.round(Math.sin(t / 400)); r(c, '#c99412', cx - 5, y, 10, 2); r(c, '#ffe27a', cx - 4, y, 8, 1); if (Math.floor(t / 300) % 3 === 0) plus(cx + 6, y - 2, '#fff3c4', 0) }
}


/** plaquinha do nome no jogo: fundo (lista = degradê que corre) e cor do texto */
export const PLATE_CV: Record<string, { bg: string | string[]; fg: string; glow?: string }> = {
  amarela: { bg: '#FBC222', fg: '#1d1a2b' }, verde: { bg: '#3fa66b', fg: '#fff' }, rosa: { bg: '#f28cb1', fg: '#1d1a2b' },
  roxa: { bg: '#8e5bd6', fg: '#fff' }, laranja: { bg: '#f39c35', fg: '#1d1a2b' },
  dourada: { bg: ['#b8901c', '#ffe27a', '#b8901c'], fg: '#3b2a10' },
  neon: { bg: '#17171c', fg: '#5ff2ff', glow: '#5ff2ff' },
  arco: { bg: ['#e05a47', '#f39c35', '#FBC222', '#3fa66b', '#3a6fd8', '#8e5bd6', '#e05a47'], fg: '#fff' },
}
export function plateFill(c: C2D, kind: string | undefined, x: number, w: number, t: number): string | CanvasGradient | null {
  const p = kind ? PLATE_CV[kind] : undefined
  if (!p) return null
  if (typeof p.bg === 'string') return p.bg
  const off = ((t / 2000) % 1) * w, g = c.createLinearGradient(x - off, 0, x - off + 2 * w, 0)
  const n = p.bg.length * 2 - 1
  for (let k = 0; k <= n; k++) g.addColorStop(k / n, p.bg[k % p.bg.length])
  return g
}
