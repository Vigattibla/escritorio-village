import { useEffect, useRef, useState } from 'react'
import { drawAvatar, onPhotoLoad, SPRITE_H } from '../chibi/sprite'
import { backend } from '../data'
import { managerOf } from '../game/ranks'
import { level } from '../game/xp'
import { blocked, BOSS_DESK, deskAtTile, deskOf, drawDesk, DESKS, findPath, MAX_DESKS, MH, MW, pathToSeat, renderBackground, T } from '../office/world'
import { bubbles, getState, positions, setUi } from '../store'
import type { Dir, Pos, Profile, Task } from '../types'

const SPEED = 72
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

export default function Game() {
  const wrap = useRef<HTMLDivElement>(null)
  const cv = useRef<HTMLCanvasElement>(null)
  const [zoom, setZoom] = useState(() => Number(localStorage.getItem('ev:zoom')) || 3)
  const zoomRef = useRef(zoom)
  const [hover, setHover] = useState<Hover | null>(null)
  const goSeat = useRef<() => void>(() => {})

  useEffect(() => { zoomRef.current = zoom; localStorage.setItem('ev:zoom', String(zoom)) }, [zoom])

  useEffect(() => {
    const canvas = cv.current!, box = wrap.current!
    const ctx = canvas.getContext('2d')!
    const bg = renderBackground()
    const meId = getState().meId!
    const keys = new Set<string>()
    const shown = new Map<string, Shown>()
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
      if (e.type === 'keydown') { keys.add(k); path = [] } else keys.delete(k)
    }
    const onBlur = () => keys.clear()
    const onClick = (e: MouseEvent) => {
      const w = toWorld(e.clientX, e.clientY)
      const id = avatarAt(w.x, w.y)
      if (id) return setUi({ tab: 'mesa', viewing: id })
      const tx = Math.floor(w.x / T), ty = Math.floor(w.y / T)
      const desk = deskAtTile(tx, ty)
      if (desk !== null) {
        const owner = Object.values(getState().profiles).find(p => p.avatar && deskIdx(p) === desk)
        if (owner) setUi({ desk: owner.id, deskView: 'pasta', viewing: owner.id })
        if (owner?.id === meId) goSeat.current()
        return
      }
      const p = findPath(meS.x, meS.y, tx, ty)
      if (p) path = p
    }
    const onMove = (e: MouseEvent) => {
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

    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKey)
    window.addEventListener('blur', onBlur)
    canvas.addEventListener('click', onClick)
    canvas.addEventListener('mousemove', onMove)
    canvas.addEventListener('mouseleave', onLeave)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    const offPhotos: (() => void)[] = []
    const watched = new Set<string>()

    const step = (dt: number) => {
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
        meS.dir = Math.abs(vx) > Math.abs(vy) ? (vx < 0 ? 'left' : 'right') : vy < 0 ? 'up' : 'down'
        moving = true
      } else if (path.length) {
        const target = path[0], dx = target.x - meS.x, dy = target.y - meS.y, dist = Math.hypot(dx, dy), d = SPEED * dt
        if (dist <= d) { meS.x = target.x; meS.y = target.y; path.shift() }
        else { meS.x += (dx / dist) * d; meS.y += (dy / dist) * d }
        if (dist > 0.5) meS.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down'
        moving = true
        if (!path.length) meS.dir = 'down'
      }
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
      const vw = W / z, vh = H / z
      const mapW = MW * T, mapH = MH * T
      cam = {
        x: vw >= mapW ? (mapW - vw) / 2 : Math.min(mapW - vw, Math.max(0, meS.x - vw / 2)),
        y: vh >= mapH ? (mapH - vh) / 2 : Math.min(mapH - vh, Math.max(0, meS.y - 12 - vh / 2)),
      }
      cam.x = Math.round(cam.x * z) / z; cam.y = Math.round(cam.y * z) / z
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.fillStyle = '#1d2238'
      ctx.fillRect(0, 0, W, H)
      ctx.setTransform(dpr * z, 0, 0, dpr * z, -cam.x * dpr * z, -cam.y * dpr * z)
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(bg, 0, 0)

      const tasks = Object.values(s.tasks)
      const byDesk = new Map<number, Profile>()
      for (const p of Object.values(s.profiles)) if (p.avatar && !byDesk.has(deskIdx(p))) byDesk.set(deskIdx(p), p)
      const items: { key: number; draw: () => void }[] = []
      for (let i = 0; i < DESKS; i++) {
        const owner = byDesk.get(i)
        const notes = owner ? tasks.filter(x => x.owner_id === owner.id && x.status === 'todo').length : 0
        const inbox = owner ? tasks.some(x => x.owner_id === owner.id && x.status === 'inbox') : false
        const busy = !!owner && s.online.has(owner.id) && !!doingOf(tasks, owner.id)
        items.push({ key: deskOf(i).ty * T + 15, draw: () => drawDesk(ctx, i, { notes, inbox, busy, owned: !!owner, t }) })
      }
      for (const [id, o] of shown) {
        const p = s.profiles[id]
        if (!p?.avatar) continue
        if (p.photo && !watched.has(p.photo)) { watched.add(p.photo); offPhotos.push(onPhotoLoad(p.photo, () => {})) }
        const away = id !== meId && !s.online.has(id)
        items.push({
          key: o.y, draw: () => {
            ctx.globalAlpha = away ? 0.55 : 1
            ctx.fillStyle = 'rgba(0,0,0,.18)'
            ctx.beginPath(); ctx.ellipse(o.x, o.y, 6, 2, 0, 0, Math.PI * 2); ctx.fill()
            drawAvatar(ctx, p.avatar!, p.photo, Math.round(o.x - 8), Math.round(o.y - SPRITE_H + 1), o.dir, frameOf(o))
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
        const away = id !== meId && !s.online.has(id)
        const label = `${p.name}`
        ctx.font = '600 12px "Pixelify Sans", Inter, sans-serif'
        const lw = ctx.measureText(label).width
        const badge = `${level(p.xp)}`
        const bw = 16, pad = 6, total = lw + bw + pad * 2 + 10
        const lx = Math.round(sx - total / 2), ly = Math.round(sy - 18)
        ctx.fillStyle = id === meId ? 'rgba(11,35,93,.92)' : 'rgba(20,24,40,.78)'
        roundRect(ctx, lx, ly, total, 17, 8.5); ctx.fill()
        ctx.fillStyle = away ? '#8a90a3' : '#45d483'
        ctx.beginPath(); ctx.arc(lx + pad + 3, ly + 8.5, 3, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = '#fff'
        ctx.textBaseline = 'middle'
        ctx.fillText(label, lx + pad + 10, ly + 9)
        ctx.fillStyle = '#FBC222'
        roundRect(ctx, lx + pad + 10 + lw + 4, ly + 3, bw - 2, 11, 3); ctx.fill()
        ctx.fillStyle = '#0B235D'
        ctx.font = '700 9px "Pixelify Sans", Inter, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(badge, lx + pad + 10 + lw + 4 + (bw - 2) / 2, ly + 9)
        ctx.textAlign = 'left'
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
  }, [])

  const s = getState()
  const hp = hover ? s.profiles[hover.id] : null
  const doing = hp ? doingOf(Object.values(s.tasks), hp.id) : null

  return (
    <div className="game" ref={wrap}>
      <canvas ref={cv} />
      {hp && hover && (
        <div className="game-tip" style={{ left: hover.sx + 14, top: hover.sy + 10 }}>
          <b>{hp.name}</b>{hp.role && <span> · {hp.role}</span>}
          <div className="muted">{s.online.has(hp.id) || hp.id === s.meId ? (doing ? `Fazendo: ${doing.title}` : 'Sem tarefa em andamento') : 'Fora do escritório'}</div>
          <div className="muted small">Clique para ver a mesa</div>
        </div>
      )}
      <div className="game-ctrl">
        <button onClick={() => goSeat.current()} title="Andar até a sua mesa">🪑 Minha mesa</button>
        <button onClick={() => setZoom(z => Math.max(ZMIN, z - 1))} aria-label="Afastar">−</button>
        <button onClick={() => setZoom(z => Math.min(ZMAX, z + 1))} aria-label="Aproximar">+</button>
      </div>
      <div className="game-help">WASD/setas ou clique para andar · clique numa mesa para abrir</div>
    </div>
  )
}

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath()
  c.roundRect(x, y, w, h, r)
}
