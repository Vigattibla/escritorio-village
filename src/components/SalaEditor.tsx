import { useEffect, useMemo, useRef, useState } from 'react'
import { drawAvatar } from '../chibi/sprite'
import { managerOf, rankOf } from '../game/ranks'
import { drawChair } from '../office/props'
import { at, bbox, check, defaultDesk, hitTest, isDesk, KINDS, kd, original, parseSala, PISOS, reach, renderRoom, solidGrid, TEMAS, type Kind, type Obj, type Piso, type Sala, type Tema } from '../office/sala'
import { BOSS_DESK, drawDesk, MAX_DESKS, MH, MW, T, upperWall, wallFace } from '../office/world'
import { dropRow, me, putRow, roomOf, team, useStore } from '../store'
import type { Profile } from '../types'
import { Px } from './Px'

type C2D = CanvasRenderingContext2D
type Tool = 'mover' | 'piso' | 'parede' | 'carpinteiro'
const S = 2
const SHADOW_OK = 'rgba(63,166,107,.22)', SHADOW_BAD = 'rgba(229,72,58,.28)'

/** pode arrumar o escritório: Gerência/Chefe, ou carpinteiro com prazo valendo */
export function canEditOffice(p: Profile | undefined, carpenters: Record<string, { until: string }>) {
  if (!p) return false
  if (rankOf(p) >= 3) return true
  const c = carpenters[p.id]
  return !!c && new Date(c.until).getTime() > Date.now()
}

const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

function KindThumb({ k, id }: { k: Kind; id: string }) {
  const up = k.up ?? 0, w = k.w * T, h = k.camada === 'parede' ? 2 * T : (k.h + up) * T
  const z = Math.min(2, 58 / Math.max(w, h))
  return <Px w={w} h={h} s={1} z={z} draw={(c, t) => {
    if (k.camada === 'parede') { for (let i = 0; i < k.w; i++) { upperWall(c, i * T, 0); wallFace(c, i * T, T) } k.draw(c, 0, 0, t); return }
    if (isDesk(id)) {
      const tpl = id === 'mesa-chefe' ? BOSS_DESK : 0, d0 = defaultDesk(tpl)
      c.translate(-d0.tx * T, (up - d0.ty) * T)
      drawChair(c, undefined, d0.seat.x, d0.seat.y - 9, tpl === BOSS_DESK)
      drawDesk(c, d0, tpl === BOSS_DESK, { pile: 0, inbox: false, busy: false, owned: false, t })
      return
    }
    c.translate(0, up * T); k.draw(c, 0, 0, t)
  }} />
}

export default function SalaEditor({ onClose }: { onClose: () => void }) {
  const s = { rows: useStore(x => x.rows), profiles: useStore(x => x.profiles), sala: useStore(x => x.sala) }
  const meP = me()
  const saved = roomOf(s)
  const [sala, setSala] = useState<Sala>(() => parseSala(saved?.data))
  const [hist, setHist] = useState<Sala[]>([])
  const [dirty, setDirty] = useState(false)
  const [sel, setSel] = useState<number | null>(null)
  const [tool, setTool] = useState<Tool>('mover')
  const [tema, setTema] = useState<Tema>('Escritório')
  const [pal, setPal] = useState<string | null>(null)
  const [piso, setPiso] = useState<Piso>('carpete')
  const [people, setPeople] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ t: string; bad?: boolean } | null>(null)
  useEffect(() => { if (!msg) return; const id = setTimeout(() => setMsg(null), 3500); return () => clearTimeout(id) }, [msg])
  const bg = useMemo(() => renderRoom(sala), [sala])
  const ui = useRef<{ drag?: { id: number; ox: number; oy: number; o: Obj; err: string | null; moved: boolean }; hover?: { x: number; y: number }; paint?: { x0: number; y0: number; x1: number; y1: number }; wall?: boolean }>({})
  const nextId = useRef(Math.max(0, ...sala.objs.map(o => o.id)) + 1)

  const chief = rankOf(meP) >= 3
  const can = canEditOffice(meP, s.rows.carpenters)
  const myCarp = meP && !chief ? s.rows.carpenters[meP.id] : undefined

  // quem senta em cada mesa (mesma regra do jogo: chefia na mesa grande)
  const boss = managerOf(s.profiles, s.sala)
  const sitter = useMemo(() => {
    const m = new Map<number, Profile>()
    for (const p of team(s.profiles, s)) {
      if (!p.avatar) continue
      if (boss?.id === p.id) m.set(BOSS_DESK, p)
      else if (p.desk >= 0 && p.desk < MAX_DESKS && !m.has(p.desk)) m.set(p.desk, p)
    }
    return m
  }, [s.profiles, boss])
  const person = (o: Obj) => o.d === undefined ? undefined : sitter.get(o.d)
  const nameOf = (d: number) => sitter.get(d)?.name.split(' ')[0] ?? null
  const deskLabel = (o: Obj) => { const p = person(o); return o.d === BOSS_DESK ? 'da chefia' : p ? 'de ' + p.name.split(' ')[0] : 'vaga' }

  function drawObj(c: C2D, o: Obj, t: number, withPeople: boolean) {
    const k = kd(o)
    if (!isDesk(o.k)) { k.draw(c, o.x * T, k.camada === 'parede' ? 0 : o.y * T, t); return }
    // mesa + cadeira são uma peça só: a cadeira anda junto
    const tpl = o.k === 'mesa-chefe' ? BOSS_DESK : 0, d0 = defaultDesk(tpl), p = person(o), gear = p?.avatar?.gear
    c.save(); c.translate((o.x - d0.tx) * T, (o.y - d0.ty) * T)
    const seated = withPeople && !!p
    drawChair(c, gear?.cadeira, d0.seat.x, d0.seat.y - (seated ? 0 : 9), tpl === BOSS_DESK)
    if (seated && p.avatar) drawAvatar(c, p.avatar, p.photo, d0.seat.x - 8, d0.seat.y - 26, 'down', 0)
    drawDesk(c, d0, tpl === BOSS_DESK, { pile: 0, inbox: false, busy: false, owned: !!p, t }, gear)
    c.restore()
  }

  function drawScene(c: C2D, t: number, grid: boolean, lift?: Obj) {
    c.drawImage(bg, 0, 0)
    const objs = lift ? sala.objs.map(o => o.id === lift.id ? lift : o) : sala.objs
    if (grid) { c.globalAlpha = 0.1; c.fillStyle = '#000'; for (let x = 1; x < MW; x++) c.fillRect(x * T, 2 * T, 0.5, (MH - 3) * T); for (let y = 2; y < MH; y++) c.fillRect(T, y * T, (MW - 2) * T, 0.5); c.globalAlpha = 1 }
    for (const o of objs) if (kd(o).camada === 'parede') drawObj(c, o, t, people)
    const rest = objs.filter(o => !kd(o).camada).sort((a, b) => (a.y + kd(a).h) - (b.y + kd(b).h) || a.x - b.x)
    for (const o of rest) drawObj(c, o, t, people)
  }

  const commit = (next: Sala, o?: Obj): boolean => {
    const err = (o && check(next, o, nameOf)) || reach(next, nameOf)
    if (err) { setMsg({ t: err, bad: true }); return false }
    setHist(h => [...h.slice(-30), sala]); setSala(next); setDirty(true); return true
  }
  const moveTo = (o: Obj, x: number, y: number) => { const n = { ...o, x, y: kd(o).camada === 'parede' ? 0 : y }; return commit({ ...sala, objs: sala.objs.map(p => p.id === o.id ? n : p) }, n) }
  const remove = (o: Obj) => {
    if (o.k === 'mesa-chefe') { setMsg({ t: 'A mesa da chefia fica. Dá pra mudar ela de lugar.', bad: true }); return }
    const p = person(o)
    if (isDesk(o.k) && p) { setMsg({ t: `A mesa de ${p.name.split(' ')[0]} está ocupada. Mude a pessoa de mesa antes.`, bad: true }); return }
    commit({ ...sala, objs: sala.objs.filter(q => q.id !== o.id) }); setSel(null)
  }
  const selObj = sala.objs.find(o => o.id === sel) ?? null

  /** nova peça; mesa ganha o menor número livre */
  function place(id: string, tx: number, ty: number) {
    const k = KINDS[id]
    const o: Obj = { id: nextId.current, k: id, x: tx - Math.floor((k.w - 1) / 2), y: k.camada === 'parede' ? 0 : ty }
    if (id === 'mesa-chefe') {
      if (sala.objs.some(q => q.k === 'mesa-chefe')) { setMsg({ t: 'Já tem a mesa da chefia. Arraste ela pra onde quiser.', bad: true }); return }
      o.d = BOSS_DESK
    } else if (id === 'mesa') {
      const used = new Set(sala.objs.filter(q => q.k === 'mesa').map(q => q.d))
      const d = [...Array(MAX_DESKS).keys()].find(i => !used.has(i))
      if (d === undefined) { setMsg({ t: `Limite de ${MAX_DESKS} mesas`, bad: true }); return }
      o.d = d
    }
    if (commit({ ...sala, objs: [...sala.objs, o] }, o)) { nextId.current++; setSel(o.id); setMsg({ t: `Pronto: ${k.nome}. Clique de novo pra pôr outro, Esc pra parar.` }) }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.key === 'Escape') { setPal(null); setSel(null); return }
      if (!selObj || tool !== 'mover') return
      const d = ({ ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] } as Record<string, number[]>)[e.key]
      if (d) { e.preventDefault(); moveTo(selObj, selObj.x + d[0], selObj.y + d[1]) }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); remove(selObj) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // o mapa pode estar encolhido pelo CSS: escala real = largura na tela / largura em pixels
  const tileOf = (e: React.PointerEvent) => {
    const b = e.currentTarget.getBoundingClientRect(), z = b.width / (MW * T)
    const mx = (e.clientX - b.left) / z, my = (e.clientY - b.top) / z
    return { mx, my, tx: Math.floor(mx / T), ty: Math.floor(my / T) }
  }
  const down = (e: React.PointerEvent) => {
    if (!can) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const { mx, my, tx, ty } = tileOf(e)
    if (tool === 'piso') { ui.current.paint = { x0: tx, y0: ty, x1: tx, y1: ty }; return }
    if (tool === 'parede') {
      if (tx < 1 || ty < 2 || tx >= MW - 1 || ty >= MH - 1) return
      const v = !sala.div[ty][tx]
      if (v && solidGrid(sala)[ty][tx]) { setMsg({ t: 'Tem móvel aí', bad: true }); return }
      if (commit({ ...sala, div: at(sala.div, tx, ty, v) })) ui.current.wall = v
      return
    }
    if (tool !== 'mover') return
    if (pal) { place(pal, tx, ty); return }
    const o = hitTest(sala, mx, my)
    setSel(o?.id ?? null)
    if (o) ui.current.drag = { id: o.id, ox: tx - o.x, oy: ty - o.y, o, err: null, moved: false }
  }
  const move = (e: React.PointerEvent) => {
    const { tx, ty } = tileOf(e)
    ui.current.hover = { x: tx, y: ty }
    const pt = ui.current.paint
    if (pt) { pt.x1 = tx; pt.y1 = ty; return }
    if (tool === 'parede' && ui.current.wall !== undefined && e.buttons) {
      const w = ui.current.wall
      if (tx < 1 || ty < 2 || tx >= MW - 1 || ty >= MH - 1 || sala.div[ty][tx] === w || (w && solidGrid(sala)[ty][tx])) return
      const next = { ...sala, div: at(sala.div, tx, ty, w) }
      if (!reach(next, nameOf)) { setSala(next); setDirty(true) }
      return
    }
    const d = ui.current.drag
    if (!d) return
    const base = sala.objs.find(o => o.id === d.id)!
    const nx = tx - d.ox, ny = kd(base).camada === 'parede' ? 0 : ty - d.oy
    if (nx === d.o.x && ny === d.o.y) return
    d.moved = true; d.o = { ...base, x: nx, y: ny }
    const next = { ...sala, objs: sala.objs.map(o => o.id === d.id ? d.o : o) }
    d.err = check(next, d.o, nameOf) || reach(next, nameOf)
  }
  const up = () => {
    const pt = ui.current.paint
    if (pt) {
      const [x0, x1] = [Math.max(1, Math.min(pt.x0, pt.x1)), Math.min(MW - 2, Math.max(pt.x0, pt.x1))], [y0, y1] = [Math.max(2, Math.min(pt.y0, pt.y1)), Math.min(MH - 2, Math.max(pt.y0, pt.y1))]
      commit({ ...sala, piso: sala.piso.map((row, y) => row.map((c, x) => x >= x0 && x <= x1 && y >= y0 && y <= y1 ? piso : c)) })
      ui.current.paint = undefined; return
    }
    if (ui.current.wall !== undefined) { ui.current.wall = undefined; return }
    const d = ui.current.drag
    ui.current.drag = undefined
    if (!d || !d.moved) return
    if (d.err) { setMsg({ t: d.err, bad: true }); return }
    moveTo(sala.objs.find(o => o.id === d.id)!, d.o.x, d.o.y)
  }

  async function save() {
    if (!meP || !canEditOffice(meP, s.rows.carpenters)) { setMsg({ t: 'Seu tempo de carpinteiro acabou. Peça mais pra chefia.', bad: true }); return }
    const err = reach(sala, nameOf)
    if (err) { setMsg({ t: err, bad: true }); return }
    setBusy(true)
    try {
      await putRow('rooms', { id: s.sala, data: sala, created_by: meP.id, created_at: new Date().toISOString() })
      setDirty(false); setMsg({ t: 'Sala salva — todo mundo vê a mudança na hora.' })
    } catch (e) {
      setMsg({ t: `Não salvou: ${e instanceof Error ? e.message : 'erro'}`, bad: true })
    } finally { setBusy(false) }
  }
  const close = () => { if (!dirty || confirm('Sair sem salvar as mudanças da sala?')) onClose() }

  // ---------- carpinteiro ----------
  const now = Date.now()
  const crew = team(s.profiles, s).filter(p => p.avatar && rankOf(p) < 3).sort((a, b) => a.name.localeCompare(b.name))
  async function grant(p: Profile, min: number) {
    if (!meP) return
    const cur = s.rows.carpenters[p.id], from = cur && new Date(cur.until).getTime() > now ? new Date(cur.until).getTime() : now
    const until = new Date(Math.min(from + min * 60000, now + 4 * 3600000 - 5000)).toISOString()
    try { await putRow('carpenters', { id: p.id, until, created_by: meP.id, created_at: cur?.created_at ?? new Date().toISOString() }); setMsg({ t: `${p.name.split(' ')[0]} pode arrumar a sala até ${hhmm(until)}.` }) }
    catch (e) { setMsg({ t: `Não deu: ${e instanceof Error ? e.message : 'erro'}`, bad: true }) }
  }
  async function revoke(p: Profile) {
    try { await dropRow('carpenters', p.id); setMsg({ t: `${p.name.split(' ')[0]} não é mais carpinteiro.` }) }
    catch (e) { setMsg({ t: `Não deu: ${e instanceof Error ? e.message : 'erro'}`, bad: true }) }
  }

  const kinds = Object.entries(KINDS).filter(([, k]) => k.tema === tema)
  const nDesks = sala.objs.filter(o => isDesk(o.k)).length, vagas = sala.objs.filter(o => isDesk(o.k) && !person(o)).length
  const tools: [Tool, string][] = [['mover', '✋ Móveis'], ['piso', '🖌 Piso'], ['parede', '🧱 Paredes']]
  if (chief) tools.push(['carpinteiro', '🪚 Carpinteiro'])

  return <div className="sl">
    <div className="sl-bar">
      <div className="sl-tools">
        {tools.map(([t, l]) => <button key={t} className={tool === t ? 'on' : ''} onClick={() => { setTool(t); setPal(null) }}>{l}</button>)}
      </div>
      <label><input type="checkbox" checked={people} onChange={e => setPeople(e.target.checked)} /> mostrar a turma</label>
      <span className="muted">{nDesks} mesas · {vagas} vagas</span>
      {myCarp && <span className="sl-carp">🪚 carpinteiro até {hhmm(myCarp.until)}</span>}
      <span className="sl-sp" />
      <button className="btn ghost sm" disabled={!hist.length} onClick={() => { setSala(hist[hist.length - 1]); setHist(hist.slice(0, -1)); setSel(null); setDirty(true) }}>↶ Desfazer</button>
      <button className="btn ghost sm" onClick={() => { if (!confirm('Voltar a sala pro jeito original? (só vale depois de salvar)')) return; const next = original(); const err = reach(next, nameOf); if (err) { setMsg({ t: err, bad: true }); return } setHist([...hist, sala]); setSala(next); setSel(null); setDirty(true) }}>Voltar ao original</button>
      <button className="btn ghost sm" onClick={close}>Fechar</button>
      <button className="btn primary sm" disabled={!dirty || busy || !can} onClick={() => void save()}>{busy ? 'Salvando…' : 'Salvar sala'}</button>
    </div>
    <div className="sl-main">
      <div className="sl-wrap">
        <div className="sl-map" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={() => { ui.current.hover = undefined }}
          style={{ cursor: tool === 'mover' && !pal ? 'grab' : 'crosshair' }}>
          <Px w={MW * T} h={MH * T} s={S} draw={(c, t) => {
            const d = ui.current.drag
            drawScene(c, t, tool !== 'mover' || !!pal || !!d?.moved, d?.moved ? d.o : undefined)
            if (d?.moved) { const b = bbox(d.o); c.fillStyle = d.err ? SHADOW_BAD : SHADOW_OK; c.fillRect(b.x, b.y, b.w, b.h) }
            const so = d?.moved ? d.o : selObj
            if (so && !d?.err) { const b = bbox(so); c.strokeStyle = '#FBC222'; c.lineWidth = 1; c.setLineDash([2, 2]); c.strokeRect(b.x - 1.5, b.y - 1.5, b.w + 3, b.h + 3); c.setLineDash([]) }
            const h = ui.current.hover
            if (pal && h) {
              const k = KINDS[pal], o: Obj = { id: -1, k: pal, x: h.x - Math.floor((k.w - 1) / 2), y: k.camada === 'parede' ? 0 : h.y, d: pal === 'mesa-chefe' ? BOSS_DESK : pal === 'mesa' ? -1 : undefined }
              c.globalAlpha = 0.65; drawObj(c, o, t, false); c.globalAlpha = 1
              const b = bbox(o), bad = check({ ...sala, objs: [...sala.objs, o] }, o, nameOf)
              c.fillStyle = bad ? SHADOW_BAD : SHADOW_OK; c.fillRect(b.x, b.y, b.w, b.h)
            }
            const pt = ui.current.paint
            if (pt) { const x0 = Math.min(pt.x0, pt.x1), y0 = Math.min(pt.y0, pt.y1); c.fillStyle = 'rgba(251,194,34,.3)'; c.fillRect(x0 * T, y0 * T, (Math.abs(pt.x1 - pt.x0) + 1) * T, (Math.abs(pt.y1 - pt.y0) + 1) * T) }
            if (tool === 'parede' && h) { c.strokeStyle = '#FBC222'; c.lineWidth = 1; c.strokeRect(h.x * T + 0.5, h.y * T + 0.5, T - 1, T - 1) }
          }} />
          {msg && <div className={`sl-msg${msg.bad ? ' bad' : ''}`}>{msg.t}</div>}
        </div>
      </div>
      <aside className="sl-side">
        {!can && <div className="sl-sel"><b>Só olhando</b><small className="muted">Quem arruma a sala é a Gerência, a Chefia ou quem estiver de carpinteiro.</small></div>}
        {tool === 'mover' && <>
          <div className="sl-temas">{TEMAS.map(t => <button key={t} className={tema === t ? 'on' : ''} onClick={() => { setTema(t); setPal(null) }}>{t}</button>)}</div>
          <div className="sl-pal">
            {kinds.map(([id, k]) => <button key={id} className={pal === id ? 'on' : ''} disabled={!can} onClick={() => { setPal(pal === id ? null : id); setSel(null) }} title={k.camada === 'parede' ? 'vai na parede do fundo' : k.camada === 'chao' ? 'tapete: fica por baixo, dá pra pisar' : ''}>
              <span className="sl-th"><KindThumb k={k} id={id} /></span><span>{k.nome}</span>
            </button>)}
          </div>
          {selObj ? <div className="sl-sel">
            <b>{kd(selObj).nome}</b>
            {isDesk(selObj.k) && <small>Mesa {deskLabel(selObj)} · a cadeira anda junto</small>}
            <small className="muted">Arraste, ou use as setas. Delete remove.</small>
            <button className="btn ghost sm" disabled={!can} onClick={() => remove(selObj)}>🗑 Remover</button>
          </div> : <small className="muted">{pal ? 'Clique na sala pra colocar. Esc para.' : 'Clique num móvel pra mexer, ou escolha um da lista pra adicionar.'}</small>}
        </>}
        {tool === 'piso' && <>
          <small className="muted">Escolha o piso e arraste um retângulo na sala.</small>
          <div className="sl-pal">{(Object.keys(PISOS) as Piso[]).map(p => <button key={p} className={piso === p ? 'on' : ''} onClick={() => setPiso(p)}>
            <span className="sl-th"><Px w={32} h={32} s={1} z={1.6} draw={c => { for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) PISOS[p].draw(c, i * T, j * T) }} /></span><span>{PISOS[p].nome}</span></button>)}</div>
        </>}
        {tool === 'parede' && <small className="muted">Clique (ou arraste) pra levantar ou derrubar divisória. Não deixa fechar ninguém pra fora da mesa.</small>}
        {tool === 'carpinteiro' && chief && <>
          <small className="muted">Dê o cargo de carpinteiro pra alguém arrumar a sala por um tempo (até 4 h). Depois volta sozinho.</small>
          <div className="sl-crew">
            {crew.length === 0 && <small className="muted">Ninguém da equipe ainda.</small>}
            {crew.map(p => {
              const c = s.rows.carpenters[p.id], on = !!c && new Date(c.until).getTime() > now
              return <div key={p.id} className={'sl-who' + (on ? ' on' : '')}>
                <b>{p.name}</b>
                {on && <small>🪚 até {hhmm(c.until)}</small>}
                <div className="sl-dur">
                  {[15, 30, 60, 240].map(m => <button key={m} onClick={() => void grant(p, m)}>+{m < 60 ? m + ' min' : m / 60 + ' h'}</button>)}
                  {on && <button className="x" onClick={() => void revoke(p)}>Tirar</button>}
                </div>
              </div>
            })}
          </div>
        </>}
      </aside>
    </div>
  </div>
}
