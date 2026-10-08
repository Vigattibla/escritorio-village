import { useState } from 'react'
import { drawAvatar } from '../chibi/sprite'
import { drawAnim } from '../office/anim'
import { drawChair, drawDecor, drawFloor, drawNotebook, MESA, mesaExtra } from '../office/props'
import { ITEMS, SLOTS, TIER_NAME, type Item, type Slot } from '../shop/catalog'
import { DAY, FINAL, MAX_GOALS, PHASE, REASON, WELCOME } from '../shop/economy'
import { buyItem, equip, itemName, owns, run, useStore } from '../store'
import type { Avatar, CoffeeLine, Gear } from '../types'
import { Bell } from './Avisos'
import { Ph } from './Icon'
import { Px } from './Px'

type C2D = CanvasRenderingContext2D
const OUT = '#1d1a2b'
const r = (c: C2D, col: string, x: number, y: number, w: number, h: number) => { c.fillStyle = col; c.fillRect(x, y, w, h) }

const PLATE: Record<string, React.CSSProperties> = {
  amarela: { background: '#FBC222', color: '#1d1a2b' }, verde: { background: '#3fa66b', color: '#fff' }, rosa: { background: '#f28cb1', color: '#1d1a2b' },
  roxa: { background: '#8e5bd6', color: '#fff' }, laranja: { background: '#f39c35', color: '#1d1a2b' },
  dourada: { background: 'linear-gradient(90deg,#b8901c,#ffe27a,#b8901c)', color: '#3b2a10', animation: 'lj-shine 2s linear infinite', backgroundSize: '200% 100%' },
  neon: { background: '#17171c', color: '#5ff2ff', boxShadow: '0 0 6px #5ff2ff, inset 0 0 4px #5ff2ff' },
  arco: { background: 'linear-gradient(90deg,#e05a47,#f39c35,#FBC222,#3fa66b,#3a6fd8,#8e5bd6,#e05a47)', backgroundSize: '200% 100%', animation: 'lj-shine 3s linear infinite', color: '#fff', textShadow: '0 1px 0 #0006' },
}
const Plate = ({ kind, name }: { kind?: string; name: string }) =>
  <span className="lj-plate" style={kind ? PLATE[kind] : { background: '#fff', color: '#1d1a2b' }}>{name}</span>

function wear(av: Avatar, slot: Slot, art: string): Avatar {
  if (slot === 'cabelo') return { ...av, hair: art as Avatar['hair'] }
  if (slot === 'roupa') return { ...av, outfit: art as Avatar['outfit'] }
  return { ...av, gear: { ...av.gear, [slot]: art } }
}

function mesaTop(c: C2D, mesa: string | undefined, x: number, y: number, w: number, t: number) {
  const m = MESA[mesa ?? ''] ?? { top: '#b07a4f', hi: '#c99566', front: '#8a5a36' }
  r(c, OUT, x - 1, y + 1, w + 2, 15); r(c, m.top, x, y + 2, w, 8); r(c, m.hi, x, y + 2, w, 1); r(c, m.front, x, y + 10, w, 5)
  mesaExtra(c, mesa, x, y, w, t)
}

/** mesa completa: cadeira atrás, boneco sentado, tampo, notebook, enfeite e item do chão */
function deskScene(c: C2D, av: Avatar, t: number, ox: number, oy: number) {
  const g: Gear = av.gear ?? {}, w = 40, x = ox + 20, y = oy + 30, m = x + w / 2
  drawChair(c, g.cadeira, m, y + 6, false)
  drawAvatar(c, av, null, m - 8, y - 20, 'down', 0)
  mesaTop(c, g.mesa, x, y, w, t)
  drawNotebook(c, g.notebook, m, y - 1, '#FBC222', t)
  if (g.enfeite) drawDecor(c, g.enfeite, x + 1, y + 6, t)
  if (g.chao) drawFloor(c, g.chao, x + w + 3, y + 16, t)
}

function Thumb({ it, av, name }: { it: Item; av: Avatar; name: string }) {
  if (it.slot === 'plaquinha') return <div className="lj-thumb"><Plate kind={it.art} name={name} /></div>
  if (it.slot === 'cadeira') return <div className="lj-thumb"><Px w={24} h={42} s={1.6} draw={c => drawChair(c, it.art, 12, 40, false)} /></div>
  const full = wear({ ...av, gear: {} }, it.slot, it.art)
  const draw = (c: C2D, t: number) => {
    if (it.slot === 'cabelo' || it.slot === 'chapeu' || it.slot === 'rosto') { c.translate(4, 6); drawAvatar(c, full, null, 0, 0, 'down', 0) }
    else if (it.slot === 'roupa') { c.translate(4, -2); drawAvatar(c, full, null, 0, 0, 'down', 0) }
    else if (it.slot === 'animacao') { drawAvatar(c, full, null, 4, 4, 'down', 0); drawAnim(c, it.art, 12, 7, t) }
    else if (it.slot === 'mesa') mesaTop(c, it.art, 2, 6, 20, t)
    else if (it.slot === 'notebook') drawNotebook(c, it.art, 12, 12, '#FBC222', t)
    else if (it.slot === 'enfeite') drawDecor(c, it.art, 8, 18, t)
    else if (it.slot === 'chao') drawFloor(c, it.art, 5, 22, t)
  }
  return <div className="lj-thumb"><Px w={24} h={24} s={3} draw={draw} /></div>
}

const when = (iso: string) => {
  const d = new Date(iso), today = new Date()
  const y = new Date(today); y.setDate(y.getDate() - 1)
  const hm = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  if (d.toDateString() === today.toDateString()) return `hoje ${hm}`
  if (d.toDateString() === y.toDateString()) return 'ontem'
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function why(l: CoffeeLine, goalTitle: (id: string) => string | undefined) {
  if (l.reason === 'compra') return `Comprou ${itemName(l.ref)}`
  if (l.reason === 'dia') return 'Bateu o ponto'
  if (l.reason === 'boasvindas') return 'Boas-vindas ao escritório'
  const [, gid, i] = l.ref.split(':'), t = goalTitle(gid)
  return l.reason === 'meta' ? `Meta${t ? ` “${t}”` : ''} batida` : `${REASON.fase} ${i}${t ? ` de “${t}”` : ''}`
}

export default function Loja() {
  const wallet = useStore(s => s.wallet)
  const goals = useStore(s => s.rows.goals)
  const p = useStore(s => (s.meId ? s.profiles[s.meId] : undefined))
  const [slot, setSlot] = useState<Slot>('chapeu')
  const [trying, setTrying] = useState<Item | null>(null)
  const [mine, setMine] = useState(false)
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState<{ text: string; err?: boolean } | null>(null)
  if (!p?.avatar) return null
  const av = p.avatar, gear = av.gear ?? {}, first = p.name.split(' ')[0]
  const coins = wallet?.balance ?? 0
  const prev = trying ? wear(av, trying.slot, trying.art) : av

  const using = (i: Item) => i.slot === 'cabelo' ? av.hair === i.art : i.slot === 'roupa' ? av.outfit === i.art : gear[i.slot as keyof Gear] === i.art
  const list = ITEMS.filter(i => i.slot === slot && (!mine || owns(i.id, wallet)))
  const act = (id: string, f: () => Promise<unknown>, ok?: string) => {
    setBusy(id); setMsg(null)
    run(f().then(() => { if (ok) setMsg({ text: ok }) }).catch(e => { setMsg({ text: (e as Error).message, err: true }) }).finally(() => setBusy('')))
  }
  const toggle = (i: Item) => {
    setTrying(null)
    const off = using(i) && i.slot !== 'cabelo' && i.slot !== 'roupa'
    act(i.id, () => equip(i.slot, off ? null : i.art))
  }
  const buy = (i: Item) => {
    if (coins < i.price) { setMsg({ text: `Faltam ${i.price - coins} cafezinhos para ${i.name}.`, err: true }); return }
    act(i.id, async () => { await buyItem(i.id); await equip(i.slot, i.art); setTrying(null) }, `Comprou ${i.name}! Já está usando.`)
  }

  return (
    <div className="quadro loja">
      <div className="qbar"><span className="grow" /><Bell /></div>
      <div className="qhead"><div><h1>Almoxarifado</h1><div className="sub">Troque cafezinhos por coisas pro seu boneco e pra sua mesa. Só o servidor credita; ninguém transfere.</div></div></div>

      <div className="lj-shop panel">
        <aside className="lj-prev">
          <div className="lj-coins"><Ph n="coffee" size={20} fill /> <b>{wallet ? coins : '…'}</b> cafezinhos</div>
          <div className="lj-stage">
            <Px w={40} h={44} s={5} draw={(c, t) => { drawAvatar(c, prev, null, 12, 12, 'down', Math.floor(t / 400) % 3 === 1 ? 1 : 0); drawAnim(c, prev.gear?.animacao, 20, 15, t) }} />
            <Plate kind={prev.gear?.plaquinha} name={first} />
          </div>
          <Px w={90} h={60} s={3} className="lj-desk" draw={(c, t) => deskScene(c, prev, t, 6, 4)} />
          {trying && !owns(trying.id, wallet)
            ? <div className="lj-try">Provando <b>{trying.name}</b>
              <div><button className="btn accent" disabled={!!busy} onClick={() => buy(trying)}>{busy === trying.id ? 'Comprando…' : `Comprar · ☕ ${trying.price}`}</button>
                <button className="btn" onClick={() => setTrying(null)}>Tirar</button></div></div>
            : <small className="muted lj-hint">Clique num item para provar. O que é seu, clique para usar ou tirar.</small>}
          {msg && <div className={'lj-msg' + (msg.err ? ' err' : '')}>{msg.text}</div>}
        </aside>
        <section className="lj-list">
          <div className="lj-tabs">
            <span className="lj-grp">Eu</span>
            {SLOTS.filter(s => s.who === 'eu').map(s => <button key={s.id} className={slot === s.id ? 'on' : ''} onClick={() => { setSlot(s.id); setTrying(null) }}>{s.label}</button>)}
            <span className="lj-grp">Minha mesa</span>
            {SLOTS.filter(s => s.who === 'mesa').map(s => <button key={s.id} className={slot === s.id ? 'on' : ''} onClick={() => { setSlot(s.id); setTrying(null) }}>{s.label}</button>)}
            <label className="lj-mine"><input type="checkbox" checked={mine} onChange={e => setMine(e.target.checked)} /> só os meus</label>
          </div>
          {!list.length && <div className="muted lj-empty">Nada seu aqui ainda.</div>}
          <div className="lj-grid">
            {list.map(i => {
              const have = owns(i.id, wallet), on = using(i)
              return <button key={i.id} disabled={busy === i.id} className={`lj-card t${i.tier}${trying?.id === i.id ? ' sel' : ''}${on ? ' use' : ''}`}
                onClick={() => have ? toggle(i) : setTrying(i)}>
                <Thumb it={i} av={av} name={first} />
                <b>{i.name}</b>
                <span className="lj-tier">{TIER_NAME[i.tier]}</span>
                <span className="lj-price">{busy === i.id ? '…' : on ? '✓ Usando' : have ? 'Seu' : `☕ ${i.price}`}</span>
              </button>
            })}
          </div>
        </section>
      </div>

      <div className="lj-row">
        <div className="panel lj-box">
          <h4>Extrato</h4>
          <small className="muted">Só você vê o seu.</small>
          {!wallet?.log.length && <div className="muted lj-empty">Nada ainda.</div>}
          {wallet?.log.slice(0, 40).map((l, k) => <div key={k} className="lj-log"><span>{when(l.created_at)}</span><span>{why(l, id => goals[id]?.title)}</span><b className={l.amount > 0 ? 'pos' : 'neg'}>{l.amount > 0 ? '+' : ''}{l.amount}</b></div>)}
        </div>
        <div className="panel lj-box">
          <h4>Como ganhar</h4>
          <div className="lj-how">
            <div><Ph n="gift" size={18} /> <span><b>+{WELCOME}</b> na primeira vez que entra, uma vez por pessoa</span></div>
            <div><Ph n="coffee" size={18} /> <span><b>+{DAY}</b> por dia que você abre o escritório</span></div>
            <div><Ph n="target" size={18} /> <span><b>+{PHASE}</b> a cada fase da meta (25%, 50%, 75%) e <b>+{FINAL}</b> quando bate. Até {MAX_GOALS} metas por mês.</span></div>
          </div>
          <ul className="lj-rules">
            <li>Todo mundo da equipe ganha o mesmo, Chefe incluída.</li>
            <li>Meta criada não muda mais. Fase que já estava batida no dia da criação não paga.</li>
            <li>Card só conta se outra pessoa participou: pediu, aprovou ou é mestre do projeto.</li>
            <li>Meta manual: só a Chefe atualiza o número.</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
