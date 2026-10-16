import { OUT, rect as r, type C2D } from './base'

/** Céu das janelas pela hora real de Brasília e o tempo real de Jaboticatubas-MG: gradiente do dia, estrelas, chuva e visitas (gato, passarinho, pombo, folhas). Sem timers: tudo sai do relógio. */
export const reduzMovimento = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: 'numeric', minute: 'numeric', day: 'numeric', hour12: false })
let cache = { at: -1e9, h: 12, dia: 1 }
/** hora (fracionária) e dia do mês em São Paulo; recalcula no máximo a cada 5 s */
export function horaSP(now = Date.now()) {
  if (now - cache.at > 5000) {
    const p = Object.fromEntries(fmt.formatToParts(new Date(now)).map(x => [x.type, x.value]))
    cache = { at: now, h: (Number(p.hour) % 24) + Number(p.minute) / 60, dia: Number(p.day) }
  }
  return cache
}

// [hora, topo, base] do céu
const CEU: [number, string, string][] = [
  [0, '#0b1230', '#18204a'], [5, '#16204a', '#3a3f7a'], [6.2, '#5b6fb0', '#f0a77a'], [7.5, '#86c3ee', '#f7e2b4'],
  [12, '#5fb0ee', '#cfeaff'], [16.5, '#79b3ea', '#f8e0b0'], [18.2, '#c9739a', '#f5a35c'], [19.4, '#2b2d6a', '#c9604a'], [20.8, '#0b1230', '#18204a'], [24, '#0b1230', '#18204a'],
]
const hex = (s: string) => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16))
const rgb = (v: number[]) => `rgb(${v.map(Math.round).join(',')})`
const mixV = (A: number[], B: number[], k: number) => A.map((v, i) => v + (B[i] - v) * k)
function ceuEm(h: number) {
  let i = 0
  while (i < CEU.length - 2 && h >= CEU[i + 1][0]) i++
  const [h0, t0, b0] = CEU[i], [h1, t1, b1] = CEU[i + 1], k = Math.min(1, Math.max(0, (h - h0) / (h1 - h0)))
  return { top: mixV(hex(t0), hex(t1), k), base: mixV(hex(b0), hex(b1), k) }
}
/** escuridão: 1 = noite fechada, 0 = dia */
const noite = (h: number) => (h < 5 ? 1 : h < 6.5 ? 1 - (h - 5) / 1.5 : h < 18.5 ? 0 : h < 20.5 ? (h - 18.5) / 2 : 1)

/** Tempo de verdade em Jaboticatubas-MG (Open-Meteo, sem chave). Busca a cada 15 min; sem rede, cai no sorteio. */
export interface TempoReal { at: number; chuva: boolean; nublado: boolean; temp: number }
let tempo: TempoReal | null = null, buscando = 0
const URL_TEMPO = 'https://api.open-meteo.com/v1/forecast?latitude=-19.5136&longitude=-43.7453&current=temperature_2m,weather_code,cloud_cover,precipitation&timezone=America%2FSao_Paulo'
export function tempoReal(now = Date.now()): TempoReal | null {
  if (typeof fetch === 'function' && now - buscando > 15 * 60e3) {
    buscando = now
    fetch(URL_TEMPO).then(r => r.ok ? r.json() : null).then(j => {
      const cur = j?.current
      if (!cur) return
      const w = Number(cur.weather_code)
      tempo = {
        at: Date.now(), temp: Math.round(Number(cur.temperature_2m)),
        chuva: (w >= 51 && w <= 67) || (w >= 80 && w <= 82) || w >= 95 || Number(cur.precipitation) > 0.1,
        nublado: w === 3 || w === 45 || w === 48 || Number(cur.cloud_cover) >= 75,
      }
    }).catch(() => { buscando = now - 13 * 60e3 })
  }
  return tempo && now - tempo.at < 3 * 3600e3 ? tempo : null
}

/** chuva de verdade de Jaboticatubas; sem dado, ~14% das horas (sorteio fixo por dia+hora, igual pra todo mundo) */
export function chovendo(now = Date.now()) {
  const real = tempoReal(now)
  if (real) return real.chuva
  const { h, dia } = horaSP(now)
  let x = Math.imul(dia * 24 + Math.floor(h), 2654435761) >>> 0
  x ^= x >>> 15; x = Math.imul(x, 2246822519) >>> 0; x ^= x >>> 13
  return (x >>> 0) % 100 < 14
}

/** visita da vez: muda a cada 40 s e aparece numa de cada 4 janelas */
type Visita = 'gato' | 'passaro' | 'pombo' | 'folhas' | null
const VISITAS: Visita[] = ['passaro', null, 'gato', null, 'folhas', 'pombo', null, 'passaro', null, 'pombo', 'folhas', null]
function visita(t: number, x: number): { v: Visita; p: number } {
  if (reduzMovimento) return { v: null, p: 0 }
  const slot = Math.floor(t / 40000), p = (t % 40000) / 40000
  if ((Math.floor(x / 16) + slot * 7) % 4 !== 0) return { v: null, p: 0 }
  return { v: VISITAS[slot % VISITAS.length], p }
}

/** vidro da janela em (gx, gy), gw x gh: céu, astros, chuva e passarinho/folhas voando. Chame ANTES das molduras internas. */
export function drawSky(c: C2D, gx: number, gy: number, gw: number, gh: number, t: number, seed: number) {
  const h = horaSP().h, { top, base } = ceuEm(h), chuva = chovendo(), n = noite(h), s = Math.floor(seed / 16)
  // 4 faixas pra manter o jeito pixel
  for (let b = 0; b < 4; b++) r(c, rgb(mixV(top, base, b / 3)), gx, gy + Math.floor((gh * b) / 4), gw, Math.ceil(gh / 4))
  const nublado = !chuva && !!tempoReal()?.nublado
  if (chuva || nublado) { c.globalAlpha = chuva ? 0.45 : 0.3; r(c, '#5c6575', gx, gy, gw, gh); c.globalAlpha = 1 }
  if (n > 0.4 && !chuva && !nublado) for (let k = 0; k < 5; k++) r(c, '#fff6cf', gx + 2 + ((s * 3 + k * 11) % (gw - 4)), gy + 1 + ((k * 5 + s) % (gh - 5)), 1, 1)
  if (n > 0.5 && !chuva && !nublado) { r(c, '#f4f1dc', gx + gw - 8, gy + 2, 4, 4); r(c, rgb(top), gx + gw - 7, gy + 2, 2, 2) }
  else if (n < 0.3 && !chuva && !nublado) { const sy = gy + 8 - Math.round(Math.sin(Math.min(1, Math.max(0, (h - 6) / 12)) * Math.PI) * 6); r(c, '#ffe27a', gx + gw - 9, sy - 3, 5, 5); r(c, '#fff3b0', gx + gw - 8, sy - 2, 3, 3) }
  // nuvem devagar
  const cx = reduzMovimento ? 4 : ((t / 900 + s * 5) % (gw + 12)) - 8, nuvem = chuva ? '#7b8393' : n > 0.5 ? '#2b3466' : '#fff'
  r(c, nuvem, gx + cx, gy + 3, 7, 2); r(c, nuvem, gx + cx + 2, gy + 2, 4, 1)
  if (nublado) { const c2 = (cx + gw / 2) % (gw + 12) - 8; r(c, n > 0.5 ? '#2b3466' : '#dfe3ea', gx + c2, gy + 7, 9, 2); r(c, n > 0.5 ? '#2b3466' : '#dfe3ea', gx + c2 + 2, gy + 6, 5, 1) }
  if (chuva) for (let k = 0; k < 7; k++) {
    const q = reduzMovimento ? (k * 0.37) % 1 : (t / 420 + k * 0.31 + s * 0.1) % 1
    r(c, '#bfd7ee', gx + 1 + ((k * 4 + s) % (gw - 2)), gy + Math.floor(q * (gh - 2)), 1, 2)
  }
  const { v, p } = visita(t, seed)
  if (v === 'passaro' && p < 0.17) {
    const q = p / 0.17, x = Math.round(gx - 4 + q * (gw + 8)), y = gy + 3 + Math.round(Math.sin(q * 9)), up = Math.floor(t / 130) % 2
    r(c, OUT, x, y + (up ? 0 : 1), 2, 1); r(c, OUT, x + 2, y + 1, 1, 1); r(c, OUT, x + 3, y + (up ? 0 : 1), 2, 1)
  } else if (v === 'folhas' && p < 0.3) {
    for (let k = 0; k < 3; k++) { const q = (p / 0.3 + k / 3) % 1; r(c, k % 2 ? '#7cc96b' : '#c98a3a', gx + 2 + Math.round(q * (gw - 6) + Math.sin(q * 9 + k) * 2), gy + 1 + Math.round(q * (gh - 4)), 2, 1) }
  }
}

/** bicho no parapeito (gato ou pombo), desenhado depois da moldura. sx = x do pixel da janela, sill = y do parapeito */
export function drawParapeito(c: C2D, sx: number, sill: number, t: number) {
  const { v, p } = visita(t, sx)
  if ((v !== 'gato' && v !== 'pombo') || p > 0.45) return
  const x = sx + 20
  if (v === 'gato') {
    const rabo = Math.floor(t / 500) % 2
    r(c, OUT, x - 1, sill - 8, 8, 8); r(c, '#e08a3c', x, sill - 7, 6, 7); r(c, OUT, x, sill - 10, 1, 3); r(c, OUT, x + 5, sill - 10, 1, 3)
    r(c, '#e08a3c', x, sill - 9, 6, 3); r(c, OUT, x + 1, sill - 8, 1, 1); r(c, OUT, x + 4, sill - 8, 1, 1); r(c, '#f6c28a', x + 2, sill - 6, 2, 2)
    r(c, OUT, x + 7 + rabo, sill - 3 - rabo, 2, 1); r(c, '#e08a3c', x + 7 + rabo, sill - 2 - rabo, 2, 1)
  } else {
    const bob = Math.floor(t / 280) % 2
    r(c, OUT, x - 1, sill - 6, 8, 6); r(c, '#9aa3b5', x, sill - 5, 6, 5); r(c, '#6d7690', x + 1, sill - 3, 3, 2)
    r(c, OUT, x + 5, sill - 8 + bob, 4, 4); r(c, '#9aa3b5', x + 5, sill - 7 + bob, 3, 3); r(c, '#2c8a6a', x + 4, sill - 5, 2, 1); r(c, '#f39c35', x + 8, sill - 6 + bob, 2, 1); r(c, OUT, x + 6, sill - 7 + bob, 1, 1)
  }
}
