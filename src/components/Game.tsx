import { useEffect, useRef, useState } from 'react'
import { gravar } from '../office/trilha'
import { drawAvatar, onPhotoLoad, SPRITE_H } from '../chibi/sprite'
import { backend } from '../data'
import { deptOf, isChief, managerOf } from '../game/ranks'
import { COMODOS, comodoOf, type Kind, type Spot } from '../office/comodos'
import { drawCurtain, drawDoor, drawExit, drawMat, HALL, inkOn } from '../office/andar'
import { Emblema, FlagPicker } from './Bandeira'
import { addMark, boardMarks, takeErrands, type Errand } from '../office/errands'
import { drawAnim, plateFill, PLATE_CV } from '../office/anim'
import { drawChair } from '../office/props'
import { drawFurniture, kd, parseSala, type Obj } from '../office/sala'
import { blocked, boardSpot, BOSS_DESK, deskAtTile, deskIds, deskOf, deskSidesOf, doorAtTile, doorSpot, drawBoardMarks, drawCarry, drawDesk, emptySala, FH, findPath, floorVersion, furniture, FW, getRooms, hallDecor, hasDesk, roomOfKind, HY0, MAX_DESKS, painelAt, paineisOf, pathToSeat, regionOfPx, renderFloor, roomOfId, setFloor, setPassable, shelfSpot, T, wallObjs, type Room } from '../office/world'
import { bubbles, canDoor, canEnter, curtainsOpen, deptName, doorOpen, getState, goTo, knock, myDept, positions, roomOf, run, setCurtains, setDoor, setSalaGerente, setUi, useStore, type State } from '../store'
import type { Dir, Pos, Profile, Task } from '../types'
import Icon from './Icon'
import { addDia, CFG0, hoje, livres, mesDe, placar, ve } from '../game/vendas'

const SPEED = 72
const ACT_MS = { write: 2600, fetch: 1400, store: 1400 }
const ACT_TEXT = { write: 'Anotando no quadro', fetch: 'Pegando arquivo', store: 'Guardando arquivo' }
const OPEN = new Set(['inbox', 'todo', 'doing', 'review'])

/** Ida ao quadro/estante e volta para a mesa */
interface Job { e: Errand; phase: 'go' | 'act' | 'back'; path: { x: number; y: number }[]; until: number; carry: boolean }
const ZMIN = 1, ZMAX = 5
const typing = () => { const el = document.activeElement; return !!el && /INPUT|TEXTAREA|SELECT/.test(el.tagName) }

interface Shown { x: number; y: number; dir: Dir; moving: boolean; anim: number }
interface Hover { id: string; sx: number; sy: number }

/** Mesa de alguém na sala do setor dela: o Gerente vai para a mesa dele, o resto usa a sorteada */
const deskIdx = (p: Profile, r: Room) => {
  if (managerOf(getState().profiles, deptOf(p))?.id === p.id && hasDesk(r, BOSS_DESK)) return BOSS_DESK
  if (p.desk >= 0 && p.desk < MAX_DESKS && hasDesk(r, p.desk)) return p.desk
  return deskIds(r).find(i => i !== BOSS_DESK) ?? 0
}
/** o andar é só do setor aberto: em cima a sala dele, cozinha e banheiro; embaixo a sala do gerente (se ele quiser), jogos e uma vaga.
 *  Pra crescer: troca uma 'vaga' por um cômodo novo de comodos.ts. */
const ANDAR = (gerente: boolean): Kind[] => ['dept', 'cozinha', 'banheiro', gerente ? 'gerente' : 'vaga', 'jogos', 'vaga']
let floorSeen: unknown[] = []
/** dá pra passar pela porta: vaga nunca, cômodos sempre, sala do setor/gerente pela regra da porta */
const enterable = (r: Room | undefined, s: State = getState()) => !!r && r.kind !== 'vaga' && (!r.dept || canEnter(r.dept, s))
export function syncFloor() {
  const s = getState(), id = s.sala, d = s.rows.depts[id], ger = !!d?.sala_gerente, data = roomOf(s, id)
  const seen = [id, !!d?.vendas, ger, data]
  if (seen.length !== floorSeen.length || seen.some((v, i) => v !== floorSeen[i])) {
    floorSeen = seen
    const mine = parseSala(data?.data, !!d?.vendas)
    // com sala própria, a mesa do gerente (e o tapete dela) sai da sala do setor
    const dept = ger ? { ...mine, objs: mine.objs.filter(o => o.d !== BOSS_DESK && o.k !== 'tapete-chefe') } : mine
    setFloor(ANDAR(ger).map(k => (k === 'dept' ? { kind: k, dept: id, sala: dept, baia: !!d?.vendas } : k === 'vaga' ? { kind: k, sala: emptySala(16) } : { kind: k, dept: k === 'gerente' ? id : null, sala: COMODOS[k].sala() })))
  }
  setPassable(getRooms().map(r => enterable(r, s)))
}
/** sala de trabalho de alguém neste andar: o gerente vai pra sala dele se ela existir (undefined = não é deste andar) */
function homeRoom(p: Profile | undefined) {
  const s = getState()
  if (!p || deptOf(p) !== s.sala) return undefined
  const g = roomOfKind('gerente')
  return g && managerOf(s.profiles, s.sala)?.id === p.id ? g : roomOfKind('dept')
}
/** assento de alguém no andar (null = não é deste andar) */
function seatOf(p: Profile) {
  const r = homeRoom(p)
  return r ? deskOf(r, deskIdx(p, r)).seat : null
}
/** turno: dias úteis, 8h às 19h. Fora dele, quem sumiu faz tempo foi pra casa */
const turno = (d = new Date()) => d.getDay() > 0 && d.getDay() < 6 && d.getHours() >= 8 && d.getHours() < 19
const FOI_EMBORA = 60 * 60e3
const rand = (a: number, b: number) => a + Math.random() * (b - a)
/** boneco de quem está fora, no turno: fica na mesa, às vezes vai na cozinha, banheiro ou jogos */
interface Wander { phase: 'idle' | 'go' | 'stay' | 'back'; until: number; path: { x: number; y: number }[]; spot?: Spot }
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
  const [doorUi, setDoorUi] = useState<{ slot: number; x: number; y: number; up: boolean } | null>(null)
  const [comodo, setComodo] = useState<{ nome: string; cor: string } | null>(null)
  const goSeat = useRef<() => void>(() => {})
  const here = useStore(s => s.here)
  useStore(s => s.rows.depts)

  useEffect(() => { zoomRef.current = cine ? 3 : zoom; if (!cine) localStorage.setItem('ev:zoom', String(zoom)) }, [zoom, cine])

  useEffect(() => {
    const canvas = cv.current!, box = wrap.current!
    const ctx = canvas.getContext('2d')!
    syncFloor()
    let bg = renderFloor(), bgVer = floorVersion()
    const meId = getState().meId!
    const keys = new Set<string>()
    const shown = new Map<string, Shown>()
    const jobs = new Map<string, Job>()
    const waiting = new Map<string, Errand[]>()
    const wander = new Map<string, Wander>()
    /** última vez que vi cada um online (ms); começa pelo fim da trilha de hoje */
    const lastOn = new Map<string, number>()
    {
      const d0 = new Date(), dia = d0.toISOString().slice(0, 10), meia = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate()).getTime()
      void backend.loadTrails(dia).then(ts => { for (const t of ts) { const sec = t.pts[t.pts.length - 3]; if (sec !== undefined && !lastOn.has(t.user_id)) lastOn.set(t.user_id, meia + sec * 1000) } }).catch(() => {})
    }
    const gone = (id: string) => !turno() && Date.now() - (lastOn.get(id) ?? 0) > FOI_EMBORA
    let atK = -2
    let path: { x: number; y: number }[] = []
    let cam = { x: 0, y: 0 }
    let W = 0, H = 0, dpr = 1
    let raf = 0, last = performance.now(), lastSent = 0, lastSaved = 0, sentKey = ''
    /** onde eu estava no último quadro (sala/corredor) · porta em que já trombei */
    let at = getState().here, bumped = -1

    const myProfile = () => getState().profiles[meId]
    const myRoom = () => homeRoom(myProfile())
    const hallMid = () => ({ x: FW * T / 2, y: (HY0 + 2) * T + 8 })
    /** ponto logo depois da porta, do lado de dentro da sala */
    const inside = (r: Room) => { const d = doorSpot(r); return { x: d.x, y: r.top ? (r.oy + r.h - 2) * T + 8 : (r.oy + 2) * T + 8 } }
    const saved = (() => { try { return JSON.parse(localStorage.getItem(`ev:pos:${meId}`) ?? 'null') as Pos | null } catch { return null } })()
    const start = (() => {
      const s = getState()
      if (s.here !== deptOf(myProfile()) && s.here !== HALL) { const r = roomOfId(s.here); if (r) return inside(r) }
      if (saved?.f === 1 && !blocked(saved.x, saved.y)) return saved
      return seatOf(myProfile()) ?? hallMid()
    })()
    const meS: Shown = { x: start.x, y: start.y, dir: 'down', moving: false, anim: 0 }
    shown.set(meId, meS)
    goSeat.current = () => {
      const r = myRoom()
      jobs.delete(meId)
      path = (r && pathToSeat(meS.x, meS.y, r, deskIdx(myProfile(), r))) ?? []
    }
    /** porta que não abre pra mim (ou de sala vazia): aviso em cima/embaixo dela */
    const doorAsk = (k: number) => {
      const r = getRooms()[k], z = zoomRef.current
      if (!r) return
      const d = doorSpot(r)
      setDoorUi({ slot: k, x: (d.x - cam.x) * z, y: (d.y - cam.y) * z + (r.top ? 6 : -2 * T * z - 6), up: !r.top })
    }
    /** cortina fechada: quem está fora da sala não vê dentro (vale pra todo mundo, até a Chefe) */
    const hidden = (r: Room | undefined, s = getState()) => !!r?.dept && !curtainsOpen(r.dept, s) && regionOfPx(meS.x, meS.y) !== r.slot
    const hiddenAt = (x: number, y: number) => { const k = regionOfPx(x, y); return k >= 0 && hidden(getRooms()[k]) }

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
        if (id !== meId && hiddenAt(s.x, s.y)) continue
        if (wx >= s.x - 8 && wx <= s.x + 8 && wy >= s.y - SPRITE_H + 1 && wy <= s.y + 1 && s.y > best) { hit = id; best = s.y }
      }
      return hit
    }

    const onKey = (e: KeyboardEvent) => {
      if (typing()) return
      const k = e.key.toLowerCase()
      if (!['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) return
      e.preventDefault()
      if (e.type === 'keydown') { keys.add(k); path = []; jobs.delete(meId); setDoorUi(null) } else keys.delete(k)
    }
    const onBlur = () => keys.clear()
    const onClick = (e: MouseEvent) => {
      if (cine) return setUi({ view: 'escritorio', drawer: false, viewing: focusRef.current })
      setDoorUi(null)
      const w = toWorld(e.clientX, e.clientY)
      const id = avatarAt(w.x, w.y)
      if (id) return setUi({ tab: 'mesa', viewing: id })
      const tx = Math.floor(w.x / T), ty = Math.floor(w.y / T)
      const desk = hiddenAt(w.x, w.y) ? null : deskAtTile(tx, ty)
      if (desk) {
        const owner = Object.values(getState().profiles).find(p => p.avatar && homeRoom(p) === desk.r && deskIdx(p, desk.r) === desk.i)
        if (owner) setUi({ viewing: owner.id })
        if (owner?.id === meId) goSeat.current()
        return
      }
      // painel de quartos: abre o quadro de Quartos
      const pq = hiddenAt(w.x, w.y) ? null : painelAt(tx, ty), s = getState()
      if (pq && ve(s.profiles[meId], s)) return pq === 'painel-placar' ? setUi({ view: 'placar', drawer: false }) : setUi({ lousa: true })
      // porta que não abre pra mim: chega perto e mostra o aviso
      const k = doorAtTile(tx, ty)
      if (k >= 0) {
        if (!enterable(getRooms()[k], s)) {
          doorAsk(k)
          const sp = doorSpot(getRooms()[k]), p = findPath(meS.x, meS.y, sp.tx, sp.ty)
          if (p) { path = p; jobs.delete(meId) }
          return
        }
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
      canvas.style.cursor = id || doorAtTile(tx, ty) >= 0 || (!hiddenAt(w.x, w.y) && painelAt(tx, ty)) || (!hiddenAt(w.x, w.y) && deskAtTile(tx, ty)) ? 'pointer' : 'default'
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

    /** Avança a tarefa automática de alguém (ida → ação → volta), na sala do setor dela. Devolve true se andou. */
    const runJob = (id: string, o: Shown, p: Profile, dt: number, now: number) => {
      const r = homeRoom(p)
      if (!r) { jobs.delete(id); waiting.delete(id); return false }
      let j = jobs.get(id)
      if (!j) {
        const e = waiting.get(id)?.shift()
        if (!e) return false
        const spot = e.kind === 'write' ? boardSpot(r) : shelfSpot(r)
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
        j.path = pathToSeat(o.x, o.y, r, deskIdx(p, r)) ?? []
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
      syncFloor()
      // tarefas automáticas novas: eu faço as minhas; quem está fora é simulado aqui (quem está online faz no PC dele)
      {
        const s = getState()
        for (const e of takeErrands()) {
          if (!s.profiles[e.who]?.avatar || (e.who !== meId && s.online.has(e.who))) continue
          waiting.set(e.who, [...(waiting.get(e.who) ?? []), e].slice(-4))
        }
      }
      const tnow = performance.now()
      // a Chefe abriu outra sala por fora do mapa: aparece na porta de dentro dela
      {
        const s = getState()
        if (s.here !== at) {
          const r = s.here === HALL ? undefined : roomOfId(s.here)
          const p = r ? inside(r) : hallMid()
          meS.x = p.x; meS.y = p.y; meS.dir = r?.top === false ? 'down' : 'up'
          path = []; jobs.delete(meId); at = s.here; setDoorUi(null)
        }
      }
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
        // trombou numa porta fechada (ou de sala vazia): mostra o aviso uma vez
        const k = doorAtTile(Math.floor((meS.x + vx * 9) / T), Math.floor((meS.y - 2 + vy * 9) / T))
        if (k >= 0 && !enterable(getRooms()[k])) { if (bumped !== k) { bumped = k; doorAsk(k) } }
        else bumped = -1
      } else if (path.length) {
        moving = walk(meS, path, dt)
        if (!path.length) meS.dir = 'down'
      } else if (regionOfPx(meS.x, meS.y) === myRoom()?.slot) moving = runJob(meId, meS, myProfile(), dt, tnow)
      meS.moving = moving
      meS.anim = moving ? meS.anim + dt : 0

      // onde estou: ninguém é teletransportado, a sala muda quando o boneco passa da porta
      {
        const s = getState(), k = regionOfPx(meS.x, meS.y), r = k >= 0 ? getRooms()[k] : undefined
        if (r && r.dept !== deptOf(myProfile()) && !enterable(r, s)) {
          // fecharam a porta comigo dentro: volto pro corredor, na frente dela
          const d = doorSpot(r)
          meS.x = (d.tx + 1) * T; meS.y = (d.ty + 0.5) * T; path = []
          bubbles.set(meId, { text: 'A porta foi fechada', until: Date.now() + 3000 })
        }
        const k2 = regionOfPx(meS.x, meS.y), r2 = k2 >= 0 ? getRooms()[k2] : undefined, where = r2?.dept || HALL
        if (where !== s.here) { at = where; goTo(where) }
        // cômodo onde estou, pra barra de baixo
        if (k2 !== atK) { atK = k2; const c = r2 && comodoOf(r2.kind); setComodo(c ? { nome: c.nome, cor: c.cor } : null) }
      }

      const now = performance.now(), here = getState().here
      const mine: Pos = { x: Math.round(meS.x * 10) / 10, y: Math.round(meS.y * 10) / 10, dir: meS.dir, moving, room: here, a: getState().sala, f: 1 }
      const key = `${mine.x},${mine.y},${mine.dir},${moving},${here}`
      positions.set(meId, mine)
      if (!cine) gravar(meId, mine.x, mine.y)
      if ((key !== sentKey && now - lastSent > 100) || now - lastSent > 2500) {
        backend.sendPos(meId, mine); lastSent = now; sentKey = key
      }
      if (now - lastSaved > 1000) { localStorage.setItem(`ev:pos:${meId}`, JSON.stringify(mine)); lastSaved = now }

      // demais pessoas deste andar (online: onde o boneco dela está; fora, no turno: mesa e cômodos; fora de noite faz tempo: foi pra casa)
      const s = getState(), wall = Date.now()
      const busySpots = new Set([...wander.values()].filter(w => w.spot && w.phase !== 'idle').map(w => w.spot!))
      for (const p of Object.values(s.profiles)) {
        if (p.id === meId || !p.avatar) continue
        const online = s.online.has(p.id), live0 = online ? positions.get(p.id) : undefined
        const live = live0?.f === 1 && (live0.a ?? s.sala) === s.sala ? live0 : undefined
        if (online) lastOn.set(p.id, wall)
        const seat = seatOf(p)
        // visita de outro setor só aparece enquanto está aqui
        if (!live && !seat) { shown.delete(p.id); wander.delete(p.id); continue }
        if (!online && gone(p.id) && !jobs.has(p.id)) { shown.delete(p.id); wander.delete(p.id); continue }
        const tgt = live ?? { ...seat!, dir: 'down' as Dir, moving: false }
        let o = shown.get(p.id)
        if (!o) { o = { x: tgt.x, y: tgt.y, dir: tgt.dir, moving: false, anim: 0 }; shown.set(p.id, o) }
        if (online) wander.delete(p.id)
        if (!online && (jobs.has(p.id) || waiting.get(p.id)?.length)) {
          wander.delete(p.id)
          o.moving = runJob(p.id, o, p, dt, tnow)
          o.anim = o.moving ? o.anim + dt : 0
          continue
        }
        if (!online && seat) {
          let w = wander.get(p.id)
          if (!w) { w = { phase: 'idle', until: tnow + rand(8e3, 60e3), path: [] }; wander.set(p.id, w) }
          let moved = false
          if (w.phase === 'idle') {
            if (tnow > w.until) {
              // sorteia um cômodo e um lugar livre nele
              const rs = getRooms().filter(r => comodoOf(r.kind)?.spots.length)
              const r = rs[Math.floor(Math.random() * rs.length)], c = r && comodoOf(r.kind)
              const free = c ? c.spots.filter(x => !busySpots.has(x)) : []
              const sp = free[Math.floor(Math.random() * free.length)]
              const route = sp && findPath(o.x, o.y, r.ox + sp.x, r.oy + sp.y)
              if (route) { w.phase = 'go'; w.path = route; w.spot = sp; busySpots.add(sp) }
              else w.until = tnow + rand(20e3, 60e3)
            }
            if (w.phase === 'idle') {
              const k = Math.min(1, dt * 12)
              if (Math.hypot(seat.x - o.x, seat.y - o.y) > 200) { o.x = seat.x; o.y = seat.y }
              o.x += (seat.x - o.x) * k; o.y += (seat.y - o.y) * k; o.dir = 'down'
            }
          } else if (w.phase === 'go' || w.phase === 'back') {
            moved = walk(o, w.path, dt)
            if (!moved && w.phase === 'go' && w.spot) {
              w.phase = 'stay'; w.until = tnow + rand(...w.spot.ms); o.dir = w.spot.dir
              if (!w.spot.some) bubbles.set(p.id, { text: w.spot.act, until: wall + (w.until - tnow) })
            } else if (!moved && w.phase === 'back') { w.phase = 'idle'; w.spot = undefined; w.until = tnow + rand(40e3, 150e3); o.dir = 'down' }
          } else if (tnow > w.until) {
            const r = homeRoom(p)
            w.phase = 'back'; w.path = (r && pathToSeat(o.x, o.y, r, deskIdx(p, r))) ?? []
            bubbles.delete(p.id)
          } else if (w.spot) o.dir = w.spot.dir
          o.moving = moved
          o.anim = moved ? o.anim + dt : 0
          continue
        }
        const k = Math.min(1, dt * 12)
        if (Math.hypot(tgt.x - o.x, tgt.y - o.y) > 200) { o.x = tgt.x; o.y = tgt.y }
        o.x += (tgt.x - o.x) * k; o.y += (tgt.y - o.y) * k
        o.dir = tgt.dir; o.moving = tgt.moving
        o.anim = o.moving ? o.anim + dt : 0
      }
      for (const id of wander.keys()) if (!shown.has(id)) wander.delete(id)
      for (const id of shown.keys()) if (!s.profiles[id]) shown.delete(id)
    }

    const render = (t: number) => {
      const s = getState(), z = zoomRef.current
      if (bgVer !== floorVersion()) { bg = renderFloor(); bgVer = floorVersion() }
      const rooms = getRooms()
      const f = (cine && focusRef.current && shown.get(focusRef.current)) || meS
      const vw = W / z, vh = H / z
      const mapW = FW * T, mapH = FH * T
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
      const shift = (r: Room, o: Obj): Obj => ({ ...o, x: o.x + r.ox, y: o.y + r.oy })
      const hid = rooms.map(r => hidden(r, s))
      for (const r of rooms) {
        const d = r.dept ? s.rows.depts[r.dept] : undefined, c = comodoOf(r.kind), cor = d?.color ?? c?.cor
        if (!hid[r.slot] && r.kind !== 'vaga') for (const o of wallObjs(r)) drawFurniture(ctx, shift(r, o), t)
        ctx.save(); ctx.translate(r.ox * T, r.oy * T)
        if (!hid[r.slot] && r.id === s.sala) drawBoardMarks(ctx, r.sala, boardMarks, writing(performance.now()))
        if (hid[r.slot]) { ctx.fillStyle = 'rgba(20,22,36,.88)'; ctx.fillRect(T, 2 * T, (r.w - 2) * T, (r.h - 3) * T) }
        if (d && !curtainsOpen(d.id, s)) drawCurtain(ctx, r.top, r.door, d.color, r.w, r.h)
        // banheiro: vidro sempre fosco
        if (r.kind === 'banheiro') drawCurtain(ctx, r.top, r.door, '#dcebf0', r.w, r.h)
        const st = d ? (doorOpen(d.id, s) ? 'aberta' : 'fechada') : c ? 'aberta' : 'vazia'
        if (r.top) drawExit(ctx, r.door, r.h, st, cor, d?.flag); else drawDoor(ctx, r.door, st, cor ?? '#a3a8b3', d?.flag)
        if (cor) drawMat(ctx, r.door * T + 3, r.top ? r.h * T + 4 : -T + 4, cor)
        ctx.restore()
      }

      const tasks = Object.values(s.tasks)
      const items: { key: number; draw: () => void }[] = []
      for (const r of rooms) {
        if (r.kind === 'vaga' || hid[r.slot]) continue
        const byDesk = new Map<number, Profile>()
        for (const p of Object.values(s.profiles)) if (p.avatar && homeRoom(p) === r && !byDesk.has(deskIdx(p, r))) byDesk.set(deskIdx(p, r), p)
        for (const i of deskIds(r)) {
          const owner = byDesk.get(i), d = deskOf(r, i), gear = owner?.avatar?.gear, baia = deskSidesOf(r, i)
          const pile = owner ? tasks.filter(x => x.owner_id === owner.id && OPEN.has(x.status)).length : 0
          const inbox = owner ? tasks.some(x => x.owner_id === owner.id && x.status === 'inbox') : false
          const busy = !!owner && s.online.has(owner.id) && !!doingOf(tasks, owner.id)
          items.push({ key: d.ty * T + 15, draw: () => drawDesk(ctx, d, i === BOSS_DESK, { pile, inbox, busy, owned: !!owner, t, baia }, gear) })
          // cadeira vai com a mesa; sem ninguém sentado ela fica puxada pra trás
          const o = owner && shown.get(owner.id)
          const seated = !!o && Math.hypot(o.x - d.seat.x, o.y - d.seat.y) < 2
          const cy = d.seat.y - (seated ? 0 : 9)
          items.push({ key: cy - 0.5, draw: () => drawChair(ctx, gear?.cadeira, d.seat.x, cy, i === BOSS_DESK) })
        }
        for (const o0 of furniture(r)) {
          const o = shift(r, o0), k = kd(o)
          items.push({ key: k.passa ? o.y * T : (o.y + k.h) * T - 1, draw: () => drawFurniture(ctx, o, t) })
        }
      }
      for (const o of hallDecor()) items.push({ key: (o.y + kd(o).h) * T - 1, draw: () => drawFurniture(ctx, o, t) })
      const seen = new Set<string>()
      for (const [id, o] of shown) {
        const p = s.profiles[id]
        if (!p?.avatar || (id !== meId && hiddenAt(o.x, o.y))) continue
        // na cabine do banheiro: some de vista
        const w = wander.get(id)
        if (w?.phase === 'stay' && w.spot?.some) continue
        seen.add(id)
        if (p.photo && !watched.has(p.photo)) { watched.add(p.photo); offPhotos.push(onPhotoLoad(p.photo, () => {})) }
        const job = jobs.get(id)
        const away = id !== meId && !s.online.has(id) && !job
        items.push({
          key: o.y, draw: () => {
            ctx.fillStyle = 'rgba(0,0,0,.18)'
            ctx.beginPath(); ctx.ellipse(o.x, o.y, 6, 2, 0, 0, Math.PI * 2); ctx.fill()
            // fora do escritório: boneco opaco e desbotado (transparente deixava a cadeira aparecer pela cabeça)
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
      // painel de quartos: livres hoje e nos próximos 4 dias, texto nítido em espaço de tela
      const qs = Object.values(s.rows.quartos).filter(q => q.ativo).sort((a, b) => a.pos - b.pos || a.nome.localeCompare(b.nome)).slice(0, 3)
      if (z >= 2) for (const r of rooms) {
        if (hid[r.slot]) continue
        for (const o of paineisOf(r)) {
        const fx = (r.ox + o.x) * T + 4, fy = (r.oy + o.y) * T - 22, sx = (wx: number) => Math.round((fx + wx - cam.x) * z), sy = (wy: number) => Math.round((fy + wy - cam.y) * z)
        ctx.textBaseline = 'middle'
        if (o.k === 'painel-placar') {
          // placar do mês: quem está na frente nos pontos
          const pl = Object.values(placar(Object.values(s.rows.vendas), mesDe(new Date().toISOString()), s.rows.vendas_cfg.cfg ?? CFG0)).sort((a, b) => b.pts - a.pts).slice(0, 3)
          ctx.font = `700 ${Math.round(2.6 * z)}px "Pixelify Sans", Inter, sans-serif`; ctx.fillStyle = '#fff'; ctx.textAlign = 'left'
          ctx.fillText('PLACAR · ' + new Date().toLocaleDateString('pt-BR', { month: 'long' }).toUpperCase(), sx(16), sy(-4.5))
          ctx.fillStyle = '#fbfbf8'; ctx.fillRect(sx(0), sy(0), Math.round(56 * z), Math.round(25 * z))
          if (!pl.length) { ctx.fillStyle = '#8a8a92'; ctx.font = `600 ${Math.round(2.4 * z)}px Inter, sans-serif`; ctx.textAlign = 'center'; ctx.fillText('nenhuma venda no mês', sx(28), sy(12.5)) }
          pl.forEach((p, k) => {
            const cy = 4.5 + k * 8
            ctx.fillStyle = ['#E8B400', '#9AA3B5', '#C98A4B'][k]; ctx.beginPath(); ctx.arc(sx(5), sy(cy), 2.4 * z, 0, Math.PI * 2); ctx.fill()
            ctx.fillStyle = k === 1 ? '#101014' : '#fff'; ctx.textAlign = 'center'; ctx.font = `800 ${Math.round(2.8 * z)}px Inter, sans-serif`; ctx.fillText(String(k + 1), sx(5), sy(cy) + 0.5)
            ctx.fillStyle = '#101014'; ctx.textAlign = 'left'; ctx.font = `${k ? 600 : 800} ${Math.round(3 * z)}px Inter, sans-serif`
            ctx.fillText(s.profiles[p.id]?.name.split(' ')[0] ?? 'Alguém', sx(9.5), sy(cy), 28 * z)
            ctx.fillStyle = '#EDE6D8'; roundRect(ctx, sx(39), sy(cy - 3), Math.round(15 * z), Math.round(6 * z), z); ctx.fill()
            ctx.fillStyle = '#26324F'; ctx.textAlign = 'center'; ctx.font = `800 ${Math.round(2.8 * z)}px Inter, sans-serif`; ctx.fillText(`${p.pts} pts`, sx(46.5), sy(cy) + 0.5)
          })
          continue
        }
        const vs = Object.values(s.rows.vendas), d0 = hoje(), dias = [0, 1, 2, 3, 4].map(n => addDia(d0, n))
        ctx.textBaseline = 'middle'
        ctx.font = `700 ${Math.round(2.6 * z)}px "Pixelify Sans", Inter, sans-serif`; ctx.fillStyle = '#fff'; ctx.textAlign = 'left'
        ctx.fillText('QUARTOS LIVRES', sx(16), sy(-4.5))
        ctx.fillStyle = '#26324F'; ctx.fillRect(sx(0), sy(0), Math.round(72 * z), Math.round(25 * z))
        ctx.fillStyle = '#fbfbf8'; ctx.fillRect(sx(0), sy(4.5), Math.round(72 * z), Math.round(20.5 * z))
        ctx.font = `600 ${Math.round(2.4 * z)}px Inter, sans-serif`; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'
        dias.forEach((d, j) => ctx.fillText(j ? d.slice(8) : 'hoje', sx(31.5 + j * 9), sy(2.3)))
        if (!qs.length) { ctx.fillStyle = '#8a8a92'; ctx.fillText('sem quartos cadastrados', sx(36), sy(14)) }
        const rh = 20 / Math.max(1, qs.length)
        qs.forEach((q, k) => {
          const cy = 5 + k * rh + rh / 2
          ctx.fillStyle = q.cor; ctx.beginPath(); ctx.arc(sx(3.5), sy(cy), 1.3 * z, 0, Math.PI * 2); ctx.fill()
          ctx.font = `600 ${Math.round(2.6 * z)}px Inter, sans-serif`; ctx.textAlign = 'left'; ctx.fillStyle = '#101014'
          ctx.fillText(q.nome, sx(6), sy(cy), 20 * z)
          dias.forEach((d, j) => {
            const n = livres(q, d, vs, s.rows.ajustes[`${q.id}:${d}`]), pouco = n <= Math.max(1, Math.ceil(q.total * 0.25))
            ctx.fillStyle = n === 0 ? '#FF7A1A' : pouco ? '#FFE14D' : '#EDE6D8'
            const ch = Math.min(rh - 1.2, 6)
            roundRect(ctx, sx(27.5 + j * 9), sy(cy - ch / 2), Math.round(8 * z), Math.round(ch * z), z); ctx.fill()
            ctx.fillStyle = n === 0 ? '#fff' : '#101014'; ctx.textAlign = 'center'
            ctx.font = `800 ${Math.round(Math.min(3.4, ch * 0.62) * z)}px Inter, sans-serif`
            ctx.fillText(String(n), sx(31.5 + j * 9), sy(cy) + 0.5)
          })
        })
        }
      }
      /** placa em (wx, wy) do mundo; ax/ay = qual ponto da placa fica ali (0 = esquerda/topo, 1 = direita/base) */
      const plate = (wx: number, wy: number, text: string, o: { bg: string; fg: string; dot?: string; lock?: boolean; ax?: number; ay?: number }) => {
        ctx.font = '700 10px "Pixelify Sans", Inter, sans-serif'
        const lead = o.dot ? 12 : 0, tail = o.lock ? 12 : 0, h = 17
        const w = Math.round(ctx.measureText(text).width + 16 + lead + tail)
        const px = Math.round((wx - cam.x) * z - w * (o.ax ?? 0.5)), py = Math.round((wy - cam.y) * z - h * (o.ay ?? 0))
        ctx.shadowColor = 'rgba(10,12,30,.35)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2
        ctx.fillStyle = o.bg; roundRect(ctx, px, py, w, h, 5); ctx.fill()
        ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0
        if (o.dot) { ctx.fillStyle = o.dot; ctx.beginPath(); ctx.arc(px + 11.5, py + h / 2, 3.5, 0, Math.PI * 2); ctx.fill() }
        ctx.fillStyle = o.fg; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
        ctx.fillText(text, px + 8 + lead, py + h / 2 + 1)
        if (o.lock) {
          const lx = px + w - 16, ly = py + 4
          ctx.fillStyle = '#FBC222'; ctx.fillRect(lx, ly + 4, 8, 6)
          ctx.strokeStyle = '#FBC222'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(lx + 4, ly + 4, 2.6, Math.PI, 0); ctx.stroke()
        }
      }
      const NAVY = 'rgba(20,26,51,.95)'
      for (const r of rooms) {
        const d = r.dept ? s.rows.depts[r.dept] : undefined, c = comodoOf(r.kind)
        // placa do Gerente, na mesa dele
        if (d && !hid[r.slot] && hasDesk(r, BOSS_DESK)) { const b = deskOf(r, BOSS_DESK); plate(b.seat.x, (b.ty + 1) * T + 2, 'GERENTE', { bg: NAVY, fg: '#FBC222' }) }
        if (d && hid[r.slot]) plate((r.ox + r.w / 2) * T, (r.oy + r.h / 2) * T, 'CORTINA FECHADA', { bg: NAVY, fg: '#fff', dot: d.color, ay: 0.5 })
        // placa da porta, na parede ao lado dela (a bandeira fica do outro lado): nome + bolinha da cor; cadeado = fechada
        const px = (r.ox + r.door) * T - 3, py = r.top ? (r.oy + r.h - 1) * T + 7 : r.oy * T + 17
        if (d) plate(px, py, r.kind === 'gerente' ? 'SALA DO GERENTE' : d.name.toUpperCase(), { bg: NAVY, fg: '#fff', dot: d.color, lock: !doorOpen(d.id, s), ax: 1, ay: 0.5 })
        else if (c) plate(px, py, c.nome.toUpperCase(), { bg: NAVY, fg: '#fff', dot: c.cor, ax: 1, ay: 0.5 })
        else plate(px, py, 'DISPONÍVEL', { bg: 'rgba(96,101,116,.92)', fg: '#eef0f4', ax: 1, ay: 0.5 })
      }
      for (const [id, o] of shown) {
        const p = s.profiles[id]
        if (!p?.avatar || !seen.has(id)) continue
        const sx = (o.x - cam.x) * z, sy = (o.y - SPRITE_H - cam.y) * z
        if (sx < -100 || sx > W + 100 || sy < -60 || sy > H + 60) continue
        const away = id !== meId && !s.online.has(id) && !jobs.has(id)
        const passeando = away && (wander.get(id)?.phase ?? 'idle') !== 'idle'
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
        if (away && !passeando) {
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
  const mine = myDept(s), away = here !== mine
  const hp = hover ? s.profiles[hover.id] : null
  const dr = doorUi ? getRooms()[doorUi.slot] : undefined, dd = dr?.dept ? s.rows.depts[dr.dept] : undefined
  const dSala = s.rows.depts[s.sala], me = s.meId ? s.profiles[s.meId] : undefined
  const podeGerente = !!dSala && (!!me?.is_admin || isChief(me) || managerOf(s.profiles, s.sala)?.id === me?.id)
  const doing = hp ? doingOf(Object.values(s.tasks), hp.id) : null
  const hpOn = !!hp && (s.online.has(hp.id) || hp.id === s.meId)

  return (
    <div className={'game' + (cine ? ' cine' : '')} ref={wrap}>
      <canvas ref={cv} />
      {!cine && <>
      {hp && hover && (
        <div className="game-tip" style={{ left: hover.sx + 14, top: hover.sy + 10, ['--c' as string]: s.rows.depts[deptOf(hp)]?.color ?? '#0B235D' }}>
          <div className="gt-head">
            {hp.photo ? <img src={hp.photo} alt="" /> : <span className="gt-ini">{hp.name.slice(0, 1)}</span>}
            <div><b>{hp.name}</b>{hp.role && <small>{hp.role}</small>}</div>
          </div>
          <div className={'gt-st' + (hpOn ? ' on' : '')}><i />{hpOn ? (doing ? 'Fazendo agora' : 'No escritório, sem tarefa em andamento') : 'Fora do escritório'}</div>
          {hpOn && doing && <div className="gt-doing">{doing.title}</div>}
          <div className="gt-hint">Clique para ver a mesa</div>
        </div>
      )}
      {doorUi && (
        <div className={'game-door' + (doorUi.up ? ' up' : '')} style={{ left: doorUi.x, top: doorUi.y, ['--c' as string]: dd?.color ?? '#a3a8b3' }}>
          <button className="x" onClick={() => setDoorUi(null)} aria-label="Fechar"><Icon n="x" size={13} /></button>
          {dd ? <>
            <div className="gd-head">
              <span className="gd-flag">{dd.flag && <Emblema k={dd.flag} size={12} color={inkOn(dd.color)} />}</span>
              <div><b>{dd.name}</b><span className={'gd-st' + (doorOpen(dd.id, s) ? ' on' : '')}>{doorOpen(dd.id, s) ? 'Porta aberta' : 'Porta fechada'}{curtainsOpen(dd.id, s) ? '' : ' · cortina fechada'}</span></div>
            </div>
            {!canEnter(dd.id, s) && <button className="primary" onClick={() => run(knock(dd.id).then(() => { bubbles.set(s.meId!, { text: 'Toc, toc! Avisei quem está lá dentro.', until: Date.now() + 3500 }); setDoorUi(null) }))}>Bater na porta</button>}
            {canDoor(dd.id, s) && <div className="gd-row">
              <button onClick={() => run(setDoor(dd.id, !doorOpen(dd.id, s)))}>{doorOpen(dd.id, s) ? 'Fechar a porta' : 'Abrir a porta'}</button>
              <button onClick={() => run(setCurtains(dd.id, !curtainsOpen(dd.id, s)))}>{curtainsOpen(dd.id, s) ? 'Fechar a cortina' : 'Abrir a cortina'}</button>
            </div>}
            {canDoor(dd.id, s) && <div className="gd-sec"><span>Bandeira da porta</span><FlagPicker d={dd} /></div>}
          </> : <>
            <div className="gd-head">
              <span className="gd-flag" />
              <div><b>Espaço livre</b><span className="gd-st">Ainda vazio — em breve vira um cômodo novo do andar</span></div>
            </div>
          </>}
        </div>
      )}
      <div className="game-ctrl">
        <span className="game-where" title={comodo ? 'Cômodo do andar, de todo mundo' : here === HALL ? 'Você está no corredor do andar' : away ? 'Você está visitando esta sala' : 'Sua sala'}>
          <i style={{ background: comodo?.cor ?? (here === HALL ? '#8a8f98' : s.rows.depts[here]?.color ?? '#0B235D') }} />
          {comodo ? comodo.nome : here === HALL ? 'Andar ' + deptName(s.sala, s) + ' · Corredor' : deptName(here, s) + (away ? ' · visita' : '')}
        </span>
        <span className="sep" />
        <button onClick={() => goSeat.current()} title={away ? 'Andar de volta até a sua sala, pelas portas' : 'Andar até a sua mesa'}><Icon n="locate" size={15} />{away ? 'Voltar pra minha sala' : 'Ir para minha mesa'}</button>
        {here !== HALL && canDoor(here, s) && <button onClick={() => run(setDoor(here, !doorOpen(here, s)))} title="Quem está fora só entra se a porta estiver aberta (ou batendo)">{doorOpen(here, s) ? 'Fechar a porta' : 'Abrir a porta'}</button>}
        {here !== HALL && canDoor(here, s) && <button onClick={() => run(setCurtains(here, !curtainsOpen(here, s)))} title="Cortina fechada: quem está no corredor não vê o que acontece aqui dentro">{curtainsOpen(here, s) ? 'Fechar a cortina' : 'Abrir a cortina'}</button>}
        {podeGerente && <button onClick={() => run(setSalaGerente(s.sala, !dSala!.sala_gerente))} title="Sala só do gerente, do outro lado do corredor (a mesa dele sai da sala do setor)">{dSala!.sala_gerente ? 'Tirar sala do gerente' : 'Sala do gerente'}</button>}
        <span className="sep" />
        <button className="sq" onClick={() => setZoom(z => Math.max(ZMIN, z - 1))} aria-label="Afastar" title="Afastar"><Icon n="minus" size={15} /></button>
        <button className="sq" onClick={() => setZoom(z => Math.min(ZMAX, z + 1))} aria-label="Aproximar" title="Aproximar"><Icon n="plus" size={15} /></button>
      </div>
      <div className="game-help">Clique no chão para andar (ou WASD/setas) · cozinha, banheiro e jogos são de todo mundo · quem está fora no horário passeia pelo andar · cortina fechada: só quem está dentro vê</div>
      </>}
    </div>
  )
}

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath()
  c.roundRect(x, y, w, h, r)
}
