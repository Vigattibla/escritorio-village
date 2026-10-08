import { useEffect, useRef, useState } from 'react'
import { drawAvatar, onPhotoLoad, SPRITE_H } from '../chibi/sprite'
import { backend } from '../data'
import { managerOf } from '../game/ranks'
import { addMark, boardMarks, takeErrands, type Errand } from '../office/errands'
import { blocked, BOARD_SPOT, BOSS_DESK, deskAtTile, deskOf, drawBoardMarks, drawCarry, drawDesk, DESKS, findPath, MAX_DESKS, MH, MW, pathToSeat, renderBackground, SHELF_SPOT, T } from '../office/world'
import { bubbles, getState, positions, setUi } from '../store'
import type { Dir, Pos, Profile, Task } from '../types'
import Icon from './Icon'

const SPEED = 72
const ACT_MS = { write: 2600, fetch: 1400, store: 1400 }
const ACT_TEXT = { write: 'Anotando no quadro', fetch: 'Pegando arquivo', store: 'Guardando arquivo' }
const OPEN = new Set(['inbox', 'todo', 'doing', 'review'])

/** Ida ao quadro/estante e volta para a mesa */
interface Job { e: Errand; phase: 'go' | 'act' | 'back'; path: { x: number; y: number }[]; until: number; carry: boolean }
const ZMIN = 2, ZMAX = 5
const typing = () => { const el = document.activeElement; return !!el && /INPUT|TEXTAREA|SELECT/.test(el.tagName) }

interface Shown { x: number; y: number; dir: Dir; moving: boolean; anim: number }
interface Hover { id: string; sx: number; sy: number }

/** Mesa de alguém: o Gerente vai para a mesa dele, o resto usa a sorteada */
const deskIdx = (p: Profile) =>
  managerOf(getState().profiles)?.id === p.id ? BOSS_DESK : p.desk >= 0 && p.desk < MAX_DESKS ? p.desk : 0
function seatOf(p: Profile) {
  const s = deskOf(deskIdx(p)).seat
  return { x: s.x, y: s.y }
}
const frameOf = (s: { moving: boolean; anim: number }): 0 | 1 | 2 => (s.moving ? ([1, 0, 2, 0] as const)[Math.floor(s.anim * 8) % 4] : 0)
const doingOf = (tasks: Task[], id: string) => tasks.filter(t => t.owner_id === id && t.status === 'doing').sort((a, b) => b.position - a.position)[0]
const dirTo = (dx: number, dy: number): Dir => (Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down')

/** Anda pelo caminho; devolve true se andou neste quadro */
function walk(o: Shown, path: { x: number; y: number }[], dt: number) {
  if (!path.length) return false
  const target = path[0], dx = target.x - o.x, dy = target.y - o.y, dist = Math.hypot(dx, dy), d = SPEED * dt
  if (dist <= d) { o.x = target.x; o.y = target.y; path.shift() }
  else { o.x += (dx / dist) * d; o.y += (dy / dist) * d }
  if (dist > 0.5) o.dir = dirTo(dx, dy)
  return true
}

/** cine: recorte do escritório no Quadro — câmera passeia por quem está, sem controles; clique abre o escritório */
export default function Game({ cine = false, focus = null }: { cine?: boolean; focus?: string | null }) {
  const focusRef = useRef(focus)
  useEffect(() => { focusRef.current = focus }, [focus])
  const wrap = useRef<HTMLDivElement>(null)
  const cv = useRef<HTMLCanvasElement>(null)
  const [zoom, setZoom] = useState(() => Number(localStorage.getItem('ev:zoom')) || 3)
  const zoomRef = useRef(zoom)
  const [hover, setHover] = useState<Hover | null>(null)
  const goSeat = useRef<() => void>(() => {})

  useEffect(() => { zoomRef.current = cine ? 3 : zoom; if (!cine) localStorage.setItem('ev:zoom', String(zoom)) }, [zoom, cine])

  useEffect(() => {
    const canvas = cv.current!, box = wrap.current!
    const ctx = canvas.getContext('2d')!
    const bg = renderBackground()
    const meId = getState().meId!
    const keys = new Set<string>()
    const shown = new Map<string, Shown>()
    const jobs = new Map<string, Job>()
    const waiting = new Map<string, Errand[]>()
    let path: { x: number; y: number }[] = []
    let cam = { x: 0, y: 0 }
    let W = 0, H = 0, dpr = 1
    let raf = 0, last = performance.now(), lastSent = 0, lastSaved = 0, sentKey = ''

    const myProfile = () => getState().profiles[meId]
    const saved = (() => { try { return JSON.parse(localStorage.getItem(`ev:pos:${meId}`) ?? 'null') as Pos | null } catch { return null } })()
    const start = saved && !blocked(saved.x, saved.y) ? saved : { ...seatOf(myProfile()), dir: 'down' as Dir, moving: false }
    const meS: Shown = { x: start.x, y: start.y, dir: start.dir, moving: false, anim: 0 }
    shown.set(meId, meS)
    goSeat.current = () => { const p = pathToSeat(meS.x, meS.y, deskIdx(myProfile())); if (p) path = p }

    const resize = () => {
      dpr = window.devicePixelRatio || 1
      W = box.clientWidth; H = box.clientHeight
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr)
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px'
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(box)

    const toWorld = (cx: number, cy: number) => {
      const r = canvas.getBoundingClientRect(), z = zoomRef.current
      return { x: (cx - r.left) / z + cam.x, y: (cy - r.top) / z + cam.y }
    }
    const avatarAt = (wx: number, wy: number) => {
      let hit: string | null = null, best = -1
      for (const [id, s] of shown) {
        if (wx >= s.x - 8 && wx <= s.x + 8 && wy >= s.y - SPRITE_H + 1 && wy <= s.y + 1 && s.y > best) { hit = id; best = s.y }
      }
      return hit
    }

    const onKey = (e: KeyboardEvent) => {
      if (typing()) return
      const k = e.key.toLowerCase()
      if (!['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) return
      e.preventDefault()
      if (e.type === 'keydown') { keys.add(k); path = []; jobs.delete(meId) } else keys.delete(k)
    }
    const onBlur = () => keys.clear()
    const onClick = (e: MouseEvent) => {
      if (cine) return setUi({ view: 'escritorio', drawer: false, viewing: focusRef.current })
      const w = toWorld(e.clientX, e.clientY)
      const id = avatarAt(w.x, w.y)
      if (id) return setUi({ tab: 'mesa', viewing: id })
      const tx = Math.floor(w.x / T), ty = Math.floor(w.y / T)
      const desk = deskAtTile(tx, ty)
      if (desk !== null) {
        const owner = Object.values(getState().profiles).find(p => p.avatar && deskIdx(p) === desk)
        if (owner) setUi({ viewing: owner.id })
        if (owner?.id === meId) goSeat.current()
        return
      }
      const p = findPath(meS.x, meS.y, tx, ty)
      if (p) { path = p; jobs.delete(meId) }
    }
    const onMove = (e: MouseEvent) => {
      if (cine) { canvas.style.cursor = 'pointer'; return }
      const w = toWorld(e.clientX, e.clientY)
      const id = avatarAt(w.x, w.y)
      const r = canvas.getBoundingClientRect()
      canvas.style.cursor = id || deskAtTile(Math.floor(w.x / T), Math.floor(w.y / T)) !== null ? 'pointer' : 'default'
      setHover(h => (id ? { id, sx: e.clientX - r.left, sy: e.clientY - r.top } : h ? null : h))
    }
    const onLeave = () => setHover(null)
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      setZoom(z => Math.min(ZMAX, Math.max(ZMIN, z + (e.deltaY < 0 ? 1 : -1))))
    }

    if (!cine) {
      window.addEventListener('keydown', onKey)
      window.addEventListener('keyup', onKey)
      window.addEventListener('blur', onBlur)
    }
    canvas.addEventListener('click', onClick)
    canvas.addEventListener('mousemove', onMove)
    canvas.addEventListener('mouseleave', onLeave)
    if (!cine) canvas.addEventListener('wheel', onWheel, { passive: false })
    const offPhotos: (() => void)[] = []
    const watched = new Set<string>()

    /** Avança a tarefa automática de alguém (ida → ação → volta). Devolve true se andou. */
    const runJob = (id: string, o: Shown, p: Profile, dt: number, now: number) => {
      let j = jobs.get(id)
      if (!j) {
        const e = waiting.get(id)?.shift()
        if (!e) return false
        const spot = e.kind === 'write' ? BOARD_SPOT : SHELF_SPOT
        const route = findPath(o.x, o.y, spot.tx, spot.ty)
        if (!route) return false
        j = { e, phase: 'go', path: route, until: 0, carry: e.kind === 'store' }
        jobs.set(id, j)
      }
      if (j.phase === 'act') {
        o.dir = 'up'
        if (now < j.until) return false
        if (j.e.kind === 'write') addMark()
        j.carry = j.e.kind === 'fetch'
        j.path = pathToSeat(o.x, o.y, deskIdx(p)) ?? []
        j.phase = 'back'
      }
      if (walk(o, j.path, dt)) return true
      if (j.phase === 'go') {
        j.phase = 'act'; j.until = now + ACT_MS[j.e.kind]; o.dir = 'up'
        const label = j.e.label.length > 24 ? j.e.label.slice(0, 23) + '…' : j.e.label
        bubbles.set(id, { text: `${ACT_TEXT[j.e.kind]}: ${label}`, until: Date.now() + ACT_MS[j.e.kind] + 800 })
      } else { jobs.delete(id); o.dir = 'down' }
      return false
    }
    const writing = (now: number) => {
      for (const j of jobs.values()) if (j.phase === 'act' && j.e.kind === 'write') return 1 - (j.until - now) / ACT_MS.write
      return -1
    }

    const step = (dt: number) => {
      // tarefas automáticas novas: eu faço as minhas; quem está fora é simulado aqui (quem está online faz no PC dele)
      {
        const s = getState()
        for (const e of takeErrands()) {
          if (!s.profiles[e.who]?.avatar || (e.who !== meId && s.online.has(e.who))) continue
          waiting.set(e.who, [...(waiting.get(e.who) ?? []), e].slice(-4))
        }
      }
      const tnow = performance.now()
      // movimento local
      let vx = 0, vy = 0
      if (keys.has('a') || keys.has('arrowleft')) vx--
      if (keys.has('d') || keys.has('arrowright')) vx++
      if (keys.has('w') || keys.has('arrowup')) vy--
      if (keys.has('s') || keys.has('arrowdown')) vy++
      let moving = false
      if (vx || vy) {
        const len = Math.hypot(vx, vy), d = SPEED * dt
        const nx = meS.x + (vx / len) * d, ny = meS.y + (vy / len) * d
        const free = (x: number, y: number) => !blocked(x - 4, y) && !blocked(x + 4, y) && !blocked(x - 4, y - 3) && !blocked(x + 4, y - 3)
        if (free(nx, meS.y)) meS.x = nx
        if (free(meS.x, ny)) meS.y = ny
        meS.dir = dirTo(vx, vy)
        moving = true
      } else if (path.length) {
        moving = walk(meS, path, dt)
        if (!path.length) meS.dir = 'down'
      } else moving = runJob(meId, meS, myProfile(), dt, tnow)
      meS.moving = moving
      meS.anim = moving ? meS.anim + dt : 0

      const now = performance.now()
      const mine: Pos = { x: Math.round(meS.x * 10) / 10, y: Math.round(meS.y * 10) / 10, dir: meS.dir, moving }
      const key = `${mine.x},${mine.y},${mine.dir},${moving}`
      positions.set(meId, mine)
      if ((key !== sentKey && now - lastSent > 100) || now - lastSent > 2500) {
        backend.sendPos(meId, mine); lastSent = now; sentKey = key
      }
      if (now - lastSaved > 1000) { localStorage.setItem(`ev:pos:${meId}`, JSON.stringify(mine)); lastSaved = now }

      // demais pessoas
      const s = getState()
      for (const p of Object.values(s.profiles)) {
        if (p.id === meId || !p.avatar) continue
        const online = s.online.has(p.id)
        const tgt = (online && positions.get(p.id)) || { ...seatOf(p), dir: 'down' as Dir, moving: false }
        let o = shown.get(p.id)
        if (!o) { o = { x: tgt.x, y: tgt.y, dir: tgt.dir, moving: false, anim: 0 }; shown.set(p.id, o) }
        if (!online && (jobs.has(p.id) || waiting.get(p.id)?.length)) {
          o.moving = runJob(p.id, o, p, dt, tnow)
          o.anim = o.moving ? o.anim + dt : 0
          continue
        }
        const k = Math.min(1, dt * 12)
        if (Math.hypot(tgt.x - o.x, tgt.y - o.y) > 200) { o.x = tgt.x; o.y = tgt.y }
        o.x += (tgt.x - o.x) * k; o.y += (tgt.y - o.y) * k
        o.dir = tgt.dir; o.moving = tgt.moving
        o.anim = o.moving ? o.anim + dt : 0
      }
      for (const id of shown.keys()) if (!s.profiles[id]) shown.delete(id)
    }

    const render = (t: number) => {
      const s = getState(), z = zoomRef.current
      const f = (cine && focusRef.current && shown.get(focusRef.current)) || meS
      const vw = W / z, vh = H / z
      const mapW = MW * T, mapH = MH * T
      cam = {
        x: vw >= mapW ? (mapW - vw) / 2 : Math.min(mapW - vw, Math.max(0, f.x - vw / 2)),
        y: vh >= mapH ? (mapH - vh) / 2 : Math.min(mapH - vh, Math.max(0, f.y - 12 - vh / 2)),
      }
      cam.x = Math.round(cam.x * z) / z; cam.y = Math.round(cam.y * z) / z
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.fillStyle = '#1d2238'
      ctx.fillRect(0, 0, W, H)
      ctx.setTransform(dpr * z, 0, 0, dpr * z, -cam.x * dpr * z, -cam.y * dpr * z)
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(bg, 0, 0)
      drawBoardMarks(ctx, boardMarks, writing(performance.now()))

      const tasks = Object.values(s.tasks)
      const byDesk = new Map<number, Profile>()
      for (const p of Object.values(s.profiles)) if (p.avatar && !byDesk.has(deskIdx(p))) byDesk.set(deskIdx(p), p)
      const items: { key: number; draw: () => void }[] = []
      for (let i = 0; i < DESKS; i++) {
        const owner = byDesk.get(i)
        const pile = owner ? tasks.filter(x => x.owner_id === owner.id && OPEN.has(x.status)).length : 0
        const inbox = owner ? tasks.some(x => x.owner_id === owner.id && x.status === 'inbox') : false
        const busy = !!owner && s.online.has(owner.id) && !!doingOf(tasks, owner.id)
        items.push({ key: deskOf(i).ty * T + 15, draw: () => drawDesk(ctx, i, { pile, inbox, busy, owned: !!owner, t }) })
      }
      for (const [id, o] of shown) {
        const p = s.profiles[id]
        if (!p?.avatar) continue
        if (p.photo && !watched.has(p.photo)) { watched.add(p.photo); offPhotos.push(onPhotoLoad(p.photo, () => {})) }
        const job = jobs.get(id)
        const away = id !== meId && !s.online.has(id) && !job
        items.push({
          key: o.y, draw: () => {
            ctx.globalAlpha = away ? 0.55 : 1
            ctx.fillStyle = 'rgba(0,0,0,.18)'
            ctx.beginPath(); ctx.ellipse(o.x, o.y, 6, 2, 0, 0, Math.PI * 2); ctx.fill()
            drawAvatar(ctx, p.avatar!, p.photo, Math.round(o.x - 8), Math.round(o.y - SPRITE_H + 1), o.dir, frameOf(o))
            if (job?.carry && o.dir !== 'up') drawCarry(ctx, Math.round(o.x + (o.dir === 'left' ? -9 : 2)), Math.round(o.y - 11))
            ctx.globalAlpha = 1
          },
        })
      }
      items.sort((a, b) => a.key - b.key).forEach(i => i.draw())

      // rótulos em espaço de tela (texto nítido)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const now = Date.now()
      {
        // placa da mesa do Gerente
        const d = deskOf(BOSS_DESK)
        const bx = (d.seat.x - cam.x) * z, by = ((d.ty + 1) * T + 2 - cam.y) * z
        ctx.font = '700 10px "Pixelify Sans", Inter, sans-serif'
        const bw = ctx.measureText('GERENTE').width + 14
        ctx.fillStyle = 'rgba(11,35,93,.92)'
        roundRect(ctx, Math.round(bx - bw / 2), Math.round(by), bw, 15, 7.5); ctx.fill()
        ctx.fillStyle = '#FBC222'
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText('GERENTE', Math.round(bx), Math.round(by) + 8)
        ctx.textAlign = 'left'
      }
      for (const [id, o] of shown) {
        const p = s.profiles[id]
        if (!p?.avatar) continue
        const sx = (o.x - cam.x) * z, sy = (o.y - SPRITE_H - cam.y) * z
        if (sx < -100 || sx > W + 100 || sy < -60 || sy > H + 60) continue
        const away = id !== meId && !s.online.has(id) && !jobs.has(id)
        const label = `${p.name}`
        ctx.font = '600 12px "Pixelify Sans", Inter, sans-serif'
        const lw = ctx.measureText(label).width
        const pad = 6, total = lw + pad * 2 + 10
        const lx = Math.round(sx - total / 2), ly = Math.round(sy - 18)
        ctx.fillStyle = id === meId ? 'rgba(11,35,93,.92)' : 'rgba(20,24,40,.78)'
        roundRect(ctx, lx, ly, total, 17, 8.5); ctx.fill()
        ctx.fillStyle = away ? '#8a90a3' : '#45d483'
        ctx.beginPath(); ctx.arc(lx + pad + 3, ly + 8.5, 3, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = '#fff'
        ctx.textBaseline = 'middle'
        ctx.fillText(label, lx + pad + 10, ly + 9)
        if (away) {
          ctx.font = '700 11px "Pixelify Sans", sans-serif'
          ctx.fillStyle = '#c8cde0'
          const bob = Math.sin(t / 500) * 2
          ctx.fillText('z', sx + 12, sy + 4 + bob)
          ctx.fillText('Z', sx + 18, sy - 4 - bob)
        }
        const b = bubbles.get(id)
        if (b && b.until > now) {
          const text = b.text.length > 42 ? b.text.slice(0, 40) + '…' : b.text
          ctx.font = '500 12px Inter, sans-serif'
          const tw = Math.min(240, ctx.measureText(text).width) + 16
          const bx = Math.round(sx - tw / 2), by = ly - 30
          ctx.fillStyle = '#fff'
          ctx.strokeStyle = '#0B235D'
          ctx.lineWidth = 1.5
          roundRect(ctx, bx, by, tw, 24, 8); ctx.fill(); ctx.stroke()
          ctx.beginPath(); ctx.moveTo(sx - 5, by + 24); ctx.lineTo(sx, by + 30); ctx.lineTo(sx + 5, by + 24); ctx.fill()
          ctx.fillStyle = '#1b2240'
          ctx.fillText(text, bx + 8, by + 12.5, 240)
        }
      }
      ctx.textBaseline = 'alphabetic'
    }

    const loop = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000)
      last = t
      step(dt)
      render(t)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      offPhotos.forEach(f => f())
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKey)
      window.removeEventListener('blur', onBlur)
      canvas.removeEventListener('click', onClick)
      canvas.removeEventListener('mousemove', onMove)
      canvas.removeEventListener('mouseleave', onLeave)
      canvas.removeEventListener('wheel', onWheel)
    }
  }, [cine])

  const s = getState()
  const hp = hover ? s.profiles[hover.id] : null
  const doing = hp ? doingOf(Object.values(s.tasks), hp.id) : null

  return (
    <div className={'game' + (cine ? ' cine' : '')} ref={wrap}>
      <canvas ref={cv} />
      {!cine && <>
      {hp && hover && (
        <div className="game-tip" style={{ left: hover.sx + 14, top: hover.sy + 10 }}>
          <b>{hp.name}</b>{hp.role && <span> · {hp.role}</span>}
          <div className="muted">{s.online.has(hp.id) || hp.id === s.meId ? (doing ? `Fazendo: ${doing.title}` : 'Sem tarefa em andamento') : 'Fora do escritório'}</div>
          <div className="muted small">Clique para ver a mesa</div>
        </div>
      )}
      <div className="game-ctrl">
        <button onClick={() => goSeat.current()} title="Andar até a sua mesa"><Icon n="locate" size={15} />Ir para minha mesa</button>
        <span className="sep" />
        <button className="sq" onClick={() => setZoom(z => Math.max(ZMIN, z - 1))} aria-label="Afastar" title="Afastar"><Icon n="minus" size={15} /></button>
        <button className="sq" onClick={() => setZoom(z => Math.min(ZMAX, z + 1))} aria-label="Aproximar" title="Aproximar"><Icon n="plus" size={15} /></button>
      </div>
      <div className="game-help">Clique no chão para andar (ou WASD/setas) · clique numa pessoa ou mesa para ver as tarefas</div>
      </>}
    </div>
  )
}

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath()
  c.roundRect(x, y, w, h, r)
}
