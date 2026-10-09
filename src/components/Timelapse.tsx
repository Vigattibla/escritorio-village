import { useEffect, useMemo, useRef, useState } from 'react'
import { drawAvatar, SPRITE_H } from '../chibi/sprite'
import { backend } from '../data'
import { dayKey } from '../game/xp'
import { drawChair } from '../office/props'
import { drawFurniture, kd, type Obj } from '../office/sala'
import { metros, posEm, trilhaDeMentira, type Pts } from '../office/trilha'
import { BOSS_DESK, deskIds, deskOf, drawDesk, FH, furniture, FW, getRooms, hallDecor, renderFloor, T, wallObjs, type Room } from '../office/world'
import { useStore } from '../store'
import type { Dir } from '../types'
import MiniAvatar from './MiniAvatar'
import { Ph } from './Icon'

const DURA = 40 // s pra passar o dia inteiro no 1×
const RASTRO = 45 * 60 // quanto do caminho fica desenhado atrás de cada um
const CORES = ['#2440FF', '#FF7A1A', '#1F9D55', '#E0479E', '#7A4DF0', '#C99700', '#0E9AA7', '#D9442B']
const hhmm = (s: number) => `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}`
const dirOf = (dx: number, dy: number): Dir => (Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down')

/** Timelapse do dia: todo mundo andando pelo andar, acelerado, com o rastro de cada um */
export default function Timelapse({ onClose }: { onClose: () => void }) {
  const s = useStore(x => x)
  const [off, setOff] = useState(0) // 0 = hoje, -1 = ontem...
  const dia = dayKey(new Date(Date.now() + off * 864e5))
  const [trilhas, setTrilhas] = useState<Record<string, Pts> | null>(null)
  const [t, setT] = useState(0)
  const [play, setPlay] = useState(true)
  const [vel, setVel] = useState(1)
  const cv = useRef<HTMLCanvasElement>(null), box = useRef<HTMLDivElement>(null)
  const tRef = useRef(0)

  useEffect(() => {
    let vivo = true
    setTrilhas(null)
    backend.loadTrails(dia).then(rows => {
      if (!vivo) return
      const m: Record<string, Pts> = {}
      for (const r of rows) if (s.profiles[r.user_id]?.avatar && r.pts.length >= 6) m[r.user_id] = r.pts
      if (backend.mode === 'demo') {
        const ate = off === 0 ? Math.min(18 * 3600, new Date().getHours() * 3600 + new Date().getMinutes() * 60) : 18 * 3600
        for (const p of Object.values(s.profiles)) if (p.avatar && !(m[p.id]?.length > 60)) m[p.id] = trilhaDeMentira({ ...p, id: p.id + dia }, ate)
      }
      setTrilhas(m)
    })
    return () => { vivo = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dia])

  const gente = useMemo(() => Object.entries(trilhas ?? {}).filter(([, p]) => p.length >= 6)
    .map(([id, p]) => ({ id, p, prof: s.profiles[id]!, m: metros(p) }))
    .sort((a, b) => b.m - a.m).map((g, i) => ({ ...g, cor: CORES[i % CORES.length] })), [trilhas, s.profiles, s.rows.depts])
  const ini = gente.length ? Math.max(0, Math.min(...gente.map(g => g.p[0])) - 300) : 8 * 3600
  const fim = gente.length ? Math.min(86399, Math.max(...gente.map(g => g.p[g.p.length - 3])) + 60) : 18 * 3600

  useEffect(() => { tRef.current = ini; setT(ini); setPlay(true) }, [ini, gente.length])

  // relógio: o dia inteiro em DURA segundos (vezes a velocidade)
  useEffect(() => {
    if (!play || !gente.length) return
    let raf = 0, last = performance.now(), shown = 0
    const tick = (now: number) => {
      const dt = (now - last) / 1000; last = now
      tRef.current = Math.min(fim, tRef.current + dt * vel * (fim - ini) / DURA)
      if (now - shown > 100) { shown = now; setT(tRef.current) }
      if (tRef.current >= fim) { setT(fim); setPlay(false); return }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [play, vel, ini, fim, gente.length])

  // desenho
  useEffect(() => {
    const c = cv.current, b = box.current
    if (!c || !b) return
    const ctx = c.getContext('2d')!
    const bg = renderFloor()
    let raf = 0
    const shift = (r: Room, o: Obj): Obj => ({ ...o, x: o.x + r.ox, y: o.y + r.oy })
    const draw = (now: number) => {
      const dpr = devicePixelRatio || 1, W = b.clientWidth, H = b.clientHeight
      if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) {
        c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); c.style.width = W + 'px'; c.style.height = H + 'px'
      }
      const mapW = FW * T, mapH = FH * T, z = Math.min(W / mapW, H / mapH)
      const ox = (W - mapW * z) / 2, oy = (H - mapH * z) / 2
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.fillStyle = '#1d2238'; ctx.fillRect(0, 0, W, H)
      ctx.setTransform(dpr * z, 0, 0, dpr * z, ox * dpr, oy * dpr)
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(bg, 0, 0)
      const rooms = getRooms(), items: { key: number; draw: () => void }[] = []
      for (const r of rooms) if (r.id) for (const o of wallObjs(r)) drawFurniture(ctx, shift(r, o), now)
      for (const r of rooms) {
        if (!r.id) continue
        for (const i of deskIds(r)) {
          const d = deskOf(r, i)
          items.push({ key: d.ty * T + 15, draw: () => drawDesk(ctx, d, i === BOSS_DESK, { pile: 0, inbox: false, busy: false, owned: true, t: now }) })
          items.push({ key: d.seat.y - 0.5, draw: () => drawChair(ctx, undefined, d.seat.x, d.seat.y, i === BOSS_DESK) })
        }
        for (const o0 of furniture(r)) { const o = shift(r, o0), k = kd(o); items.push({ key: k.passa ? o.y * T : (o.y + k.h) * T - 1, draw: () => drawFurniture(ctx, o, now) }) }
      }
      for (const o of hallDecor()) items.push({ key: (o.y + kd(o).h) * T - 1, draw: () => drawFurniture(ctx, o, now) })
      const sec = tRef.current, nomes: { x: number; y: number; n: string; cor: string }[] = []
      // rastros por baixo de tudo
      ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = 2
      for (const g of gente) {
        const p = g.p
        ctx.strokeStyle = g.cor
        let prev: [number, number] | null = null
        for (let i = 0; i < p.length; i += 3) {
          if (p[i] > sec) break
          if (p[i] < sec - RASTRO) continue
          const a = 1 - (sec - p[i]) / RASTRO
          if (prev && p[i] - p[i - 3] < 420) {
            ctx.globalAlpha = 0.15 + a * 0.55
            ctx.beginPath(); ctx.moveTo(prev[0], prev[1] - 2); ctx.lineTo(p[i + 1], p[i + 2] - 2); ctx.stroke()
          }
          prev = [p[i + 1], p[i + 2]]
        }
        ctx.globalAlpha = 1
        const q = posEm(p, sec)
        if (!q || !g.prof.avatar) continue
        const andando = Math.hypot(q.dx, q.dy) > 2
        const fr = andando ? ([1, 0, 2, 0] as const)[Math.floor(now / 110) % 4] : 0
        items.push({ key: q.y, draw: () => {
          ctx.fillStyle = 'rgba(0,0,0,.18)'
          ctx.beginPath(); ctx.ellipse(q.x, q.y, 6, 2, 0, 0, Math.PI * 2); ctx.fill()
          drawAvatar(ctx, g.prof.avatar!, g.prof.photo, Math.round(q.x - 8), Math.round(q.y - SPRITE_H + 1), andando ? dirOf(q.dx, q.dy) : 'down', fr)
        } })
        nomes.push({ x: q.x, y: q.y - SPRITE_H - 2, n: g.prof.name.split(' ')[0], cor: g.cor })
      }
      items.sort((a, b) => a.key - b.key).forEach(i => i.draw())
      // nomes em tamanho de tela (não crescem com o zoom)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.font = '700 12px Bricolage Grotesque, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'
      for (const n of nomes) {
        const x = ox + n.x * z, y = oy + n.y * z, w = ctx.measureText(n.n).width + 12
        ctx.fillStyle = n.cor; ctx.beginPath(); ctx.roundRect(x - w / 2, y - 18, w, 18, 9); ctx.fill()
        ctx.fillStyle = '#fff'; ctx.fillText(n.n, x, y - 3)
      }
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [gente])

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); if (e.key === ' ') { e.preventDefault(); setPlay(v => !v) } }
    addEventListener('keydown', k)
    return () => removeEventListener('keydown', k)
  }, [onClose])

  const pular = (v: number) => { tRef.current = v; setT(v) }
  const tocar = () => { if (tRef.current >= fim) pular(ini); setPlay(!play) }
  const nomeDia = off === 0 ? 'Hoje' : off === -1 ? 'Ontem' : new Date(Date.now() + off * 864e5).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'numeric' })

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="tl" onClick={e => e.stopPropagation()} role="dialog" aria-label="Timelapse do dia">
        <header className="tl-top">
          <h2>Timelapse do dia</h2>
          <span className="rel-sem">
            <button className="btn ghost sm" onClick={() => setOff(off - 1)} aria-label="Dia anterior"><Ph n="caret-left" size={16} /></button>
            <b>{nomeDia}</b>
            <button className="btn ghost sm" onClick={() => setOff(off + 1)} disabled={off >= 0} aria-label="Próximo dia"><Ph n="caret-right" size={16} /></button>
          </span>
          <span className="grow" />
          <button className="btn ghost sm" onClick={onClose} aria-label="Fechar"><Ph n="x" size={18} /></button>
        </header>
        <div className="tl-palco" ref={box}>
          <canvas ref={cv} />
          {trilhas && !gente.length && <p className="tl-vazio">Ninguém andou pelo escritório {off === 0 ? 'hoje' : 'nesse dia'} ainda.</p>}
          {!trilhas && <p className="tl-vazio">Juntando os caminhos de todo mundo…</p>}
          {gente.length > 0 && <b className="tl-hora">{hhmm(t)}</b>}
        </div>
        <footer className="tl-ctrl">
          <button className="tl-play" onClick={tocar} disabled={!gente.length} aria-label={play ? 'Pausar' : 'Tocar'}><Ph n={play ? 'pause' : 'play'} size={20} fill /></button>
          <input type="range" min={ini} max={fim} step={30} value={t} onChange={e => { setPlay(false); pular(+e.target.value) }} disabled={!gente.length} aria-label="Hora do dia" />
          <span className="tl-vel">
            {[1, 2, 4].map(v => <button key={v} className={'qchip' + (vel === v ? ' on' : '')} onClick={() => setVel(v)}>{v}×</button>)}
          </span>
        </footer>
        {gente.length > 0 && <ul className="tl-gente">
          {gente.map(g => (
            <li key={g.id} style={{ '--c': g.cor } as React.CSSProperties}>
              <MiniAvatar avatar={g.prof.avatar} photo={g.prof.photo} name={g.prof.name} size={28} />
              <span><b>{g.prof.name.split(' ')[0]}</b><small>≈ {g.m} m andados</small></span>
            </li>
          ))}
        </ul>}
      </div>
    </div>
  )
}
