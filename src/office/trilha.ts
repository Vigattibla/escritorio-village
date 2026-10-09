import { backend } from '../data'
import { dayKey } from '../game/xp'
import { deptOf } from '../game/ranks'
import type { Profile } from '../types'
import { deskIds, deskOf, doorSpot, findPath, FW, getRooms, HY0, MH, roomOfId, T } from './world'

/** trilha do dia: [segundo do dia, x, y, segundo, x, y, ...] */
export type Pts = number[]
const MAX = 6000 // pontos por dia (cada um são 3 números)
const ANDANDO = 2 // s entre pontos enquanto anda
const PARADO = 300 // s entre pontos parado (sem isso parece que a pessoa saiu)

let buf: { me: string; dia: string; pts: Pts } | null = null
let parado: [number, number, number] | null = null
let lastSec = -1, dirty = false, lastFlush = 0, ligado = false, limpou = false

const chave = (me: string, dia: string) => `ev:trilha:${dia}:${me}`
const segundo = (d: Date) => d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds()

function enviar() {
  if (!buf || !dirty) return
  dirty = false; lastFlush = Date.now()
  backend.saveTrail(buf.me, buf.dia, buf.pts).catch(() => { dirty = true })
  if (!limpou) { limpou = true; backend.pruneTrails(buf.me, dayKey(new Date(Date.now() - 30 * 864e5))).catch(() => {}) }
}

/** chamado a cada quadro do jogo com a minha posição; grava só quando muda (e guarda no aparelho + no banco a cada minuto) */
export function gravar(me: string, x: number, y: number) {
  const d = new Date(), sec = segundo(d)
  if (sec === lastSec) return
  lastSec = sec
  const dia = dayKey(d)
  if (!buf || buf.dia !== dia || buf.me !== me) {
    if (buf) enviar()
    let pts: Pts = []
    try { pts = JSON.parse(localStorage.getItem(chave(me, dia)) ?? '[]') } catch { /* começa vazio */ }
    buf = { me, dia, pts }; parado = null
  }
  if (!ligado) { ligado = true; addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && enviar()); addEventListener('pagehide', enviar) }
  const p = buf.pts, n = p.length, px = Math.round(x), py = Math.round(y)
  if (n >= MAX * 3) return
  const ls = n ? p[n - 3] : -1e9
  const moveu = !n || Math.hypot(px - p[n - 2], py - p[n - 1]) >= 3
  if (moveu) {
    if (sec - ls < ANDANDO) return
    // voltou a andar: marca o fim da parada pra não "escorregar" no replay
    if (parado && parado[0] > ls) p.push(...parado)
    p.push(sec, px, py); parado = null
  } else if (sec - ls >= PARADO) p.push(sec, px, py)
  else { parado = [sec, px, py]; return }
  dirty = true
  try { localStorage.setItem(chave(me, dia), JSON.stringify(p)) } catch { /* sem espaço: segue só no banco */ }
  if (Date.now() - lastFlush > 60_000) enviar()
}

/** onde a pessoa estava no segundo `sec` (null = fora do escritório) */
export function posEm(p: Pts, sec: number) {
  const n = p.length / 3
  if (!n || sec < p[0]) return null
  if (sec >= p[(n - 1) * 3]) return sec - p[(n - 1) * 3] < PARADO + 120 ? { x: p[n * 3 - 2], y: p[n * 3 - 1], dx: 0, dy: 0 } : null
  let lo = 0, hi = n - 1
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (p[m * 3] <= sec) lo = m; else hi = m }
  const t0 = p[lo * 3], t1 = p[hi * 3], x0 = p[lo * 3 + 1], y0 = p[lo * 3 + 2], x1 = p[hi * 3 + 1], y1 = p[hi * 3 + 2]
  // buraco grande = fechou o app nesse tempo
  if (t1 - t0 > PARADO + 120) return sec - t0 < 120 ? { x: x0, y: y0, dx: 0, dy: 0 } : null
  const k = (sec - t0) / (t1 - t0)
  return { x: x0 + (x1 - x0) * k, y: y0 + (y1 - y0) * k, dx: x1 - x0, dy: y1 - y0 }
}

/** metros andados (1 tile ≈ 1 m) */
export function metros(p: Pts) {
  let d = 0
  for (let i = 3; i < p.length; i += 3) if (p[i] - p[i - 3] <= PARADO + 120) d += Math.hypot(p[i + 1] - p[i - 2], p[i + 2] - p[i - 1])
  return Math.round(d / T)
}

/** modo demonstração: inventa um dia de idas e vindas pra quem não tem trilha */
export function trilhaDeMentira(p: Profile, ate: number): Pts {
  const r = roomOfId(deptOf(p))
  if (!r) return []
  let seed = [...p.id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7)
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32)
  const ids = deskIds(r), mesa = deskOf(r, ids.includes(p.desk) ? p.desk : ids[0] ?? 0)
  const salas = getRooms().filter(x => x.id)
  const dentro = (x: typeof r) => { const d = doorSpot(x); return { tx: d.tx, ty: x.top ? x.oy + MH - 2 : x.oy + 2 } }
  const destinos = () => {
    const q = rnd()
    if (q < 0.45) return { tx: Math.floor(FW / 2 + (rnd() - 0.5) * 10), ty: HY0 + 2 }
    const o = salas[Math.floor(rnd() * salas.length)]
    return dentro(o)
  }
  const out: Pts = []
  let sec = 8 * 3600 + Math.floor(rnd() * 3600), x = mesa.seat.x, y = mesa.seat.y
  out.push(sec, Math.round(x), Math.round(y))
  const andar = (pts: { x: number; y: number }[]) => {
    for (const q of pts) {
      const dt = Math.hypot(q.x - x, q.y - y) / 72
      sec += Math.max(1, Math.round(dt)); x = q.x; y = q.y
      out.push(sec, Math.round(x), Math.round(y))
    }
  }
  while (sec < ate - 1800 && out.length < MAX * 3 - 600) {
    // na mesa um tempo (ponto a cada 5 min)
    const fica = 900 + Math.floor(rnd() * 3600)
    for (let t = 300; t < fica; t += 300) out.push(sec + t, Math.round(x), Math.round(y))
    sec += fica
    if (sec > ate) break
    const g = destinos(), ida = findPath(x, y, g.tx, g.ty)
    if (!ida) continue
    andar(ida)
    const espera = 60 + Math.floor(rnd() * 600)
    sec += espera; out.push(sec, Math.round(x), Math.round(y))
    const volta = findPath(x, y, mesa.tx, mesa.ty - 1)
    if (volta) andar([...volta, mesa.seat])
  }
  return out.filter((_, i, a) => a[i - (i % 3)] <= ate)
}
