import { useEffect, useRef, useState } from 'react'
import { drawAvatar, onPhotoLoad, SPRITE_H } from '../chibi/sprite'
import { backend } from '../data'
import { deptOf, managerOf } from '../game/ranks'
import { DOOR_X, drawDoor, drawExit, exitX, HALL, hallSala, inkOn, SLOTS } from '../office/andar'
import { addMark, boardMarks, takeErrands, type Errand } from '../office/errands'
import { drawAnim, plateFill, PLATE_CV } from '../office/anim'
import { drawChair } from '../office/props'
import { drawFurniture, kd, parseSala } from '../office/sala'
import { blocked, boardSpot, BOSS_DESK, deskAtTile, deskIds, deskOf, drawBoardMarks, drawCarry, drawDesk, findPath, furniture, hasDesk, layoutVersion, MAX_DESKS, MH, MW, pathToSeat, renderBackground, setLayout, shelfSpot, T, wallObjs } from '../office/world'
import { bubbles, canDoor, canEnter, deptName, doorOpen, getState, goTo, knock, myDept, positions, roomOf, run, setDoor, setUi, slotDept, useStore } from '../store'
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
const deskIdx = (p: Profile) => {
  if (managerOf(getState().profiles, deptOf(p))?.id === p.id && hasDesk(BOSS_DESK)) return BOSS_DESK
  if (p.desk >= 0 && p.desk < MAX_DESKS && hasDesk(p.desk)) return p.desk
  return deskIds().find(i => i !== BOSS_DESK) ?? 0
}
/** onde o boneco está manda no mapa: a sala salva (troca quando alguém salva) ou o corredor (portas abertas viram passagem) */
let roomSeen: unknown = undefined
/** tile da esquerda da porta de saída da sala atual */
let exitAt = 14
/** portas por onde dá pra passar no corredor */
const hallOpen = (s = getState()) => DOOR_X.map((_, k) => { const d = slotDept(k, s); return !!d && canEnter(d.id, s) })
export function syncRoom() {
  const s = getState()
  if (s.here === HALL) {
    const open = hallOpen(s), key = 'andar:' + open.join()
    if (key === roomSeen) return
    roomSeen = key
    setLayout(hallSala(), DOOR_X.flatMap((x, k): [number, number][] => (open[k] ? [[x, 1], [x + 1, 1]] : [])))
    return
  }
  const r = roomOf(s, s.here), key = r ?? 'sala:' + s.here
  if (key === roomSeen) return
  roomSeen = key
  const sala = parseSala(r?.data)
  exitAt = exitX(sala)
  setLayout(sala, [[exitAt, MH - 1], [exitAt + 1, MH - 1]])
}
const slotAt = (tx: number) => DOOR_X.findIndex(x => tx === x || tx === x + 1)
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
  const [doorUi, setDoorUi] = useState<{ slot: number; x: number; y: number } | null>(null)
  const goSeat = useRef<() => void>(() => {})
  const here = useStore(s => s.here)
  useStore(s => s.rows.depts)

  useEffect(() => { zoomRef.current = cine ? 3 : zoom; if (!cine) localStorage.setItem('ev:zoom', String(zoom)) }, [zoom, cine])

  useEffect(() => {
    const canvas = cv.current!, box = wrap.current!
    const ctx = canvas.getContext('2d')!
    syncRoom()
    let bg = renderBackground(), bgVer = layoutVersion()
    const meId = getState().meId!
    const keys = new Set<string>()
    const shown = new Map<string, Shown>()
    const jobs = new Map<string, Job>()
    const waiting = new Map<string, Errand[]>()
    let path: { x: number; y: number }[] = []
    let cam = { x: 0, y: 0 }
    let W = 0, H = 0, dpr = 1
    let raf = 0, last = performance.now(), lastSent = 0, lastSaved = 0, sentKey = ''
    /** sala em que o boneco está (muda ao passar por uma porta) · voltando pra própria mesa por várias portas · escurecida da troca */
    let at = getState().here, homing = false, fade = 0, bumped = -1

    const myProfile = () => getState().profiles[meId]
    const saved = (() => { try { return JSON.parse(localStorage.getItem(`ev:pos:${meId}`) ?? 'null') as Pos | null } catch { return null } })()
    const start = saved && (saved.room ?? at) === at && !blocked(saved.x, saved.y) ? saved
      : at === HALL ? { x: 15 * T, y: 8 * T, dir: 'down' as Dir } : { ...seatOf(myProfile()), dir: 'down' as Dir, moving: false }
    const meS: Shown = { x: start.x, y: start.y, dir: start.dir, moving: false, anim: 0 }
    shown.set(meId, meS)
    /** próximo trecho até a minha mesa: na minha sala, a mesa; no corredor, a porta dela; em outra sala, a saída */
    const route = () => {
      const s = getState(), mine = deptOf(myProfile())
      let p: { x: number; y: number }[] | null = null
      if (s.here === mine) { homing = false; p = pathToSeat(meS.x, meS.y, deskIdx(myProfile())) }
      else if (s.here === HALL) { const k = s.rows.depts[mine]?.slot ?? -1; p = k >= 0 && k < SLOTS ? findPath(meS.x, meS.y, DOOR_X[k], 1) : null }
      else p = findPath(meS.x, meS.y, exitAt, MH - 1)
      path = p ?? []
      if (!p) homing = false
    }
    goSeat.current = () => { homing = true; jobs.delete(meId); route() }
    /** chegou em outra sala (pela porta, ou a Chefe abriu outra sala): entra pela porta de lá */
    const arrive = (from: string) => {
      const s = getState()
      at = s.here
      syncRoom(); bg = renderBackground(); bgVer = layoutVersion()
      if (at === HALL) {
        const k = s.rows.depts[from]?.slot ?? -1
        meS.x = ((k >= 0 && k < SLOTS ? DOOR_X[k] : 14) + 1) * T; meS.y = 2 * T + 10; meS.dir = 'down'
      } else { meS.x = (exitAt + 1) * T; meS.y = (MH - 2) * T + 8; meS.dir = 'up' }
      for (const id of [...shown.keys()]) if (id !== meId) shown.delete(id)
      jobs.delete(meId)
      path = []
      if (homing) route()
      fade = performance.now(); lastSent = 0; bumped = -1
      setDoorUi(null)
    }
    const cross = (where: string) => { const from = at; goTo(where); arrive(from) }
    /** porta do corredor fechada ou vazia: mostra o aviso em cima dela */
    const doorAsk = (k: number) => {
      const z = zoomRef.current
      setDoorUi({ slot: k, x: ((DOOR_X[k] + 1) * T - cam.x) * z, y: (2 * T - cam.y) * z + 6 })
    }

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
      if (e.type === 'keydown') { keys.add(k); path = []; homing = false; jobs.delete(meId); setDoorUi(null) } else keys.delete(k)
    }
    const onBlur = () => keys.clear()
    const onClick = (e: MouseEvent) => {
      if (cine) return setUi({ view: 'escritorio', drawer: false, viewing: focusRef.current })
      homing = false; setDoorUi(null)
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
      // porta do corredor que não abre pra mim: chega perto e mostra o aviso
      const k = getState().here === HALL && ty <= 1 ? slotAt(tx) : -1
      if (k >= 0 && !hallOpen()[k]) {
        doorAsk(k)
        const p = findPath(meS.x, meS.y, DOOR_X[k], 2)
        if (p) { path = p; jobs.delete(meId) }
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
      const tx = Math.floor(w.x / T), ty = Math.floor(w.y / T)
      const door = getState().here === HALL ? ty <= 1 && slotAt(tx) >= 0 : ty === MH - 1 && (tx === exitAt || tx === exitAt + 1)
      canvas.style.cursor = id || door || deskAtTile(tx, ty) !== null ? 'pointer' : 'default'
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
        const spot = e.kind === 'write' ? boardSpot() : shelfSpot()
        const route = spot && findPath(o.x, o.y, spot.tx, spot.ty)
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
      } else if (at === deptOf(myProfile())) moving = runJob(meId, meS, myProfile(), dt, tnow)
      meS.moving = moving
      meS.anim = moving ? meS.anim + dt : 0

      // portas: ninguém é teletransportado, passa pela porta e sai do outro lado
      {
        const s = getState()
        if (s.here !== at) arrive(at)
        else if (at === HALL) {
          const k = slotAt(Math.floor(meS.x / T)), d = k >= 0 ? slotDept(k, s) : undefined
          if (meS.y < 2 * T - 2 && d && canEnter(d.id, s)) cross(d.id)
          // trombou numa porta fechada (ou de sala vazia) andando pra cima
          else if (k >= 0 && meS.y < 2 * T + 8 && (keys.has('w') || keys.has('arrowup')) && !hallOpen(s)[k]) { if (bumped !== k) { bumped = k; doorAsk(k) } }
          else if (meS.y >= 2 * T + 8) bumped = -1
        } else if (meS.y >= (MH - 1) * T + 3) cross(HALL)
        else if (at !== deptOf(myProfile()) && !canEnter(at, s)) {
          bubbles.set(meId, { text: 'A porta foi fechada', until: Date.now() + 3000 })
          cross(HALL)
        }
      }

      const now = performance.now()
      const mine: Pos = { x: Math.round(meS.x * 10) / 10, y: Math.round(meS.y * 10) / 10, dir: meS.dir, moving, room: at }
      const key = `${mine.x},${mine.y},${mine.dir},${moving},${at}`
      positions.set(meId, mine)
      if ((key !== sentKey && now - lastSent > 100) || now - lastSent > 2500) {
        backend.sendPos(meId, mine); lastSent = now; sentKey = key
      }
      if (now - lastSaved > 1000) { localStorage.setItem(`ev:pos:${meId}`, JSON.stringify(mine)); lastSaved = now }

      // demais pessoas: só quem está no mesmo lugar que eu (online: onde o boneco dela está; fora: na sala dela)
      const s = getState()
      for (const p of Object.values(s.profiles)) {
        if (p.id === meId || !p.avatar) continue
        const online = s.online.has(p.id)
        if (((online && positions.get(p.id)?.room) || deptOf(p)) !== at) { shown.delete(p.id); continue }
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
      syncRoom()
      if (bgVer !== layoutVersion()) { bg = renderBackground(); bgVer = layoutVersion() }
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
      for (const o of wallObjs()) drawFurniture(ctx, o, t)
      if (at === s.sala) drawBoardMarks(ctx, boardMarks, writing(performance.now()))
      if (at === HALL) DOOR_X.forEach((x, k) => { const d = slotDept(k, s); drawDoor(ctx, x, !d ? 'vazia' : doorOpen(d.id, s) ? 'aberta' : 'fechada', d?.color ?? '#a3a8b3') })
      else drawExit(ctx, exitAt, doorOpen(at, s))

      const tasks = Object.values(s.tasks)
      const byDesk = new Map<number, Profile>()
      for (const p of Object.values(s.profiles)) if (p.avatar && deptOf(p) === at && !byDesk.has(deskIdx(p))) byDesk.set(deskIdx(p), p)
      const items: { key: number; draw: () => void }[] = []
      for (const i of deskIds()) {
        const owner = byDesk.get(i), d = deskOf(i), gear = owner?.avatar?.gear
        const pile = owner ? tasks.filter(x => x.owner_id === owner.id && OPEN.has(x.status)).length : 0
        const inbox = owner ? tasks.some(x => x.owner_id === owner.id && x.status === 'inbox') : false
        const busy = !!owner && s.online.has(owner.id) && !!doingOf(tasks, owner.id)
        items.push({ key: d.ty * T + 15, draw: () => drawDesk(ctx, i, { pile, inbox, busy, owned: !!owner, t }, gear) })
        // cadeira vai com a mesa; sem ninguém sentado ela fica puxada pra trás
        const o = owner && shown.get(owner.id)
        const seated = !!o && Math.hypot(o.x - d.seat.x, o.y - d.seat.y) < 2
        const cy = d.seat.y - (seated ? 0 : 9)
        items.push({ key: cy - 0.5, draw: () => drawChair(ctx, gear?.cadeira, d.seat.x, cy, i === BOSS_DESK) })
      }
      for (const o of furniture()) {
        const k = kd(o)
        items.push({ key: k.passa ? o.y * T : (o.y + k.h) * T - 1, draw: () => drawFurniture(ctx, o, t) })
      }
      for (const [id, o] of shown) {
        const p = s.profiles[id]
        if (!p?.avatar) continue
        if (p.photo && !watched.has(p.photo)) { watched.add(p.photo); offPhotos.push(onPhotoLoad(p.photo, () => {})) }
        const job = jobs.get(id)
        const away = id !== meId && !s.online.has(id) && !job
        items.push({
          key: o.y, draw: () => {
            ctx.fillStyle = 'rgba(0,0,0,.18)'
            ctx.beginPath(); ctx.ellipse(o.x, o.y, 6, 2, 0, 0, Math.PI * 2); ctx.fill()
            // fora da sala: boneco opaco e desbotado (transparente deixava a cadeira aparecer pela cabeça)
            if (away) ctx.filter = 'saturate(.3) brightness(.9)'
            drawAvatar(ctx, p.avatar!, p.photo, Math.round(o.x - 8), Math.round(o.y - SPRITE_H + 1), o.dir, frameOf(o))
            if (away) ctx.filter = 'none'
            if (job?.carry && o.dir !== 'up') drawCarry(ctx, Math.round(o.x + (o.dir === 'left' ? -9 : 2)), Math.round(o.y - 11))
            if (!away) drawAnim(ctx, p.avatar!.gear?.animacao, Math.round(o.x), Math.round(o.y - SPRITE_H + 1), t)
          },
        })
      }
      items.sort((a, b) => a.key - b.key).forEach(i => i.draw())

      // rótulos em espaço de tela (texto nítido)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const now = Date.now()
      if (hasDesk(BOSS_DESK)) {
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
      // placas das portas: nome da sala na cor dela; cinza = sala sem setor
      const plate = (wx: number, wy: number, text: string, bgc: string, fg: string) => {
        ctx.font = '700 10px "Pixelify Sans", Inter, sans-serif'
        const w = ctx.measureText(text).width + 14, px = Math.round((wx - cam.x) * z - w / 2), py = Math.round((wy - cam.y) * z)
        ctx.fillStyle = bgc; roundRect(ctx, px, py, w, 15, 7.5); ctx.fill()
        ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText(text, px + w / 2, py + 8)
        ctx.textAlign = 'left'
      }
      if (at === HALL) DOOR_X.forEach((x, k) => {
        const d = slotDept(k, s)
        if (!d) plate((x + 1) * T, 0.5, 'Sala vazia', '#8a8f98', '#fff')
        else plate((x + 1) * T, 0.5, d.name.toUpperCase() + (doorOpen(d.id, s) ? '' : ' · FECHADA'), d.color, inkOn(d.color))
      })
      else plate((exitAt + 1) * T, (MH - 1) * T + 3, 'CORREDOR', 'rgba(20,24,40,.82)', '#fff')
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
        const pk = p.avatar.gear?.plaquinha, pl = pk ? PLATE_CV[pk] : undefined
        ctx.fillStyle = plateFill(ctx, pk, lx, total, t) ?? (id === meId ? 'rgba(11,35,93,.92)' : 'rgba(20,24,40,.78)')
        if (pl?.glow) { ctx.shadowColor = pl.glow; ctx.shadowBlur = 6 }
        roundRect(ctx, lx, ly, total, 17, 8.5); ctx.fill()
        ctx.shadowBlur = 0
        if (id === meId && pl) { ctx.strokeStyle = '#0B235D'; ctx.lineWidth = 1.5; ctx.stroke() }
        ctx.fillStyle = away ? '#8a90a3' : '#45d483'
        ctx.beginPath(); ctx.arc(lx + pad + 3, ly + 8.5, 3, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = pl?.fg ?? '#fff'
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
      // troca de sala: escurece e clareia
      const fa = fade ? 1 - (performance.now() - fade) / 380 : 0
      if (fa > 0) { ctx.fillStyle = `rgba(13,16,30,${fa.toFixed(3)})`; ctx.fillRect(0, 0, W, H) } else fade = 0
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
  const mine = myDept(s), away = here !== mine
  const hp = hover ? s.profiles[hover.id] : null
  const dd = doorUi ? slotDept(doorUi.slot, s) : undefined
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
      {doorUi && (
        <div className="game-door" style={{ left: doorUi.x, top: doorUi.y }}>
          <button className="x" onClick={() => setDoorUi(null)} aria-label="Fechar"><Icon n="x" size={13} /></button>
          {dd ? <>
            <b><i style={{ background: dd.color }} />{dd.name}</b>
            <span className="muted">{doorOpen(dd.id, s) ? 'Porta aberta' : 'Porta fechada'}</span>
            {!canEnter(dd.id, s) && <button className="primary" onClick={() => run(knock(dd.id).then(() => { bubbles.set(s.meId!, { text: 'Toc, toc! Avisei quem está lá dentro.', until: Date.now() + 3500 }); setDoorUi(null) }))}>Bater na porta</button>}
            {canDoor(dd.id, s) && <button onClick={() => run(setDoor(dd.id, !doorOpen(dd.id, s)))}>{doorOpen(dd.id, s) ? 'Fechar a porta' : 'Abrir a porta'}</button>}
          </> : <>
            <b><i style={{ background: '#a3a8b3' }} />Sala vazia</b>
            <span className="muted">Sem setor atribuído — não dá pra entrar.</span>
            {s.meId && s.profiles[s.meId]?.is_admin && <span className="muted small">Monte a sala em Contas → Salas do andar.</span>}
          </>}
        </div>
      )}
      <div className="game-ctrl">
        <span className="game-where" title={here === HALL ? 'Você está no corredor do andar' : away ? 'Você está visitando esta sala' : 'Sua sala'}>
          <i style={{ background: here === HALL ? '#8a8f98' : s.rows.depts[here]?.color ?? '#0B235D' }} />
          {here === HALL ? '1º andar · Corredor' : deptName(here, s) + (away ? ' · visita' : '')}
        </span>
        <span className="sep" />
        <button onClick={() => goSeat.current()} title={away ? 'Andar de volta até a sua sala, pelas portas' : 'Andar até a sua mesa'}><Icon n="locate" size={15} />{away ? 'Voltar pra minha sala' : 'Ir para minha mesa'}</button>
        {here !== HALL && canDoor(here, s) && <button onClick={() => run(setDoor(here, !doorOpen(here, s)))} title="Quem está fora só entra se a porta estiver aberta (ou batendo)">{doorOpen(here, s) ? 'Fechar a porta' : 'Abrir a porta'}</button>}
        <span className="sep" />
        <button className="sq" onClick={() => setZoom(z => Math.max(ZMIN, z - 1))} aria-label="Afastar" title="Afastar"><Icon n="minus" size={15} /></button>
        <button className="sq" onClick={() => setZoom(z => Math.min(ZMAX, z + 1))} aria-label="Aproximar" title="Aproximar"><Icon n="plus" size={15} /></button>
      </div>
      <div className="game-help">{here === HALL ? 'Ande até uma porta para entrar · porta cinza: sala sem setor' : 'Clique no chão para andar (ou WASD/setas) · saia pela porta de baixo para o corredor'}</div>
      </>}
    </div>
  )
}

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath()
  c.roundRect(x, y, w, h, r)
}
