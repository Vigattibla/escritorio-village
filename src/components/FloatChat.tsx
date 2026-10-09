import { useEffect, useRef, useState } from 'react'
import { dmChannel, dmPeer, floatChans, groupOf, setUi, useStore, type State } from '../store'
import Chat from './Chat'
import Icon, { Ph } from './Icon'
import { MeoEncostado } from './Meo'
import { TENANT } from '../tenant'
import MiniAvatar from './MiniAvatar'
import type { PhName } from './ph'

type XY = { x: number; y: number }
type Float = XY & { ch: string }

const B = 58 // tamanho da bolinha
const M = 16 // margem da borda
const narrow = () => window.matchMedia('(max-width: 900px)').matches
const load = <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) as T : d } catch { return d } }
const save = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* sem armazenamento: só não lembra */ } }
const clamp = (p: XY, w: number, h: number): XY => ({
  x: Math.min(Math.max(M, p.x), Math.max(M, innerWidth - w - M)),
  y: Math.min(Math.max(M, p.y), Math.max(M, innerHeight - h - M)),
})

export function channelTitle(ch: string, s: State) {
  if (ch === 'geral') return { label: 'Geral', icon: 'chat-circle-dots' as PhName }
  const g = groupOf(ch, s)
  if (g) return { label: g.name, icon: g.icon as PhName }
  const p = s.profiles[dmPeer(ch, s.meId!)]
  return { label: p?.name ?? 'Conversa', who: p }
}

/** arrasto por ponteiro; devolve se andou (pra não confundir com clique) */
function drag(e: React.PointerEvent, from: XY, onMove: (p: XY) => void, onEnd: (p: XY, moved: boolean) => void) {
  if (e.button !== 0) return
  const sx = e.clientX, sy = e.clientY
  let moved = false, last = from
  const mv = (ev: PointerEvent) => {
    const dx = ev.clientX - sx, dy = ev.clientY - sy
    if (!moved && Math.hypot(dx, dy) < 5) return
    moved = true
    last = { x: from.x + dx, y: from.y + dy }
    onMove(last)
  }
  const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); onEnd(last, moved) }
  addEventListener('pointermove', mv)
  addEventListener('pointerup', up)
}

/** Janela de chat que se arrasta pelo cabeçalho e muda de tamanho pelo canto. */
function Win({ id, at, onAt, title, onClose, children, solo, above }: {
  /** celular: a janela fica em cima da bolinha (y da bolinha) */
  above?: number
  id: string; at: XY; onAt: (p: XY) => void; title: React.ReactNode; onClose: () => void; children: React.ReactNode; solo?: boolean
}) {
  const el = useRef<HTMLElement>(null)
  const [p, setP] = useState(at)
  const [moving, setMoving] = useState(false)
  useEffect(() => setP(at), [at.x, at.y]) // eslint-disable-line react-hooks/exhaustive-deps
  // lembra o tamanho que a pessoa deixou
  useEffect(() => {
    const n = el.current
    if (!n || narrow()) return
    const sz = load<{ w: number; h: number } | null>('ev:cwin-size2:' + id, null)
    if (sz) { n.style.width = sz.w + 'px'; n.style.height = sz.h + 'px' }
    let t = 0
    const ro = new ResizeObserver(() => { clearTimeout(t); t = window.setTimeout(() => save('ev:cwin-size2:' + id, { w: n.offsetWidth, h: n.offsetHeight }), 300) })
    ro.observe(n)
    return () => { ro.disconnect(); clearTimeout(t) }
  }, [id])
  const down = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button') || narrow()) return
    const n = el.current!
    setMoving(true)
    drag(e, p, q => setP(clamp(q, n.offsetWidth, 48)), (q, moved) => { setMoving(false); if (moved) onAt(clamp(q, n.offsetWidth, 48)) })
  }
  return (
    <section ref={el} className={'cwin' + (solo ? ' solo' : '') + (moving ? ' moving' : '')} style={above !== undefined && narrow() ? { bottom: innerHeight - above + 10, height: Math.min(560, above - 24) } : { left: p.x, top: p.y }} aria-label="Chat">
      <header className="cwin-hd" onPointerDown={down}>
        {title}
        <button className="icon-btn" onClick={onClose} aria-label="Fechar"><Icon n="x" /></button>
      </header>
      {children}
    </section>
  )
}

/** Chat como bolinha solta na tela: arrasta pra qualquer canto, encosta na borda, avisa quando chega mensagem. */
export default function FloatChat({ unread }: { unread: number }) {
  const s = useStore(x => x)
  const open = s.chatOpen
  const [bp, setBp] = useState<XY>(() => clamp(load('ev:bubble', { x: innerWidth - B - 20, y: innerHeight - B - (narrow() ? 150 : 20) }), B, B))
  const [dragging, setDragging] = useState(false)
  const [wp, setWp] = useState<XY | null>(() => load<XY | null>('ev:cwin', null))
  const [floats, setFloats] = useState<Float[]>(() => load<Float[]>('ev:floats', []))
  const [peek, setPeek] = useState<{ id: string; from: string; body: string } | null>(null)
  const [ping, setPing] = useState(0)
  /** o balãozinho do gato: "Miau! Falar com quem?" */
  const [miau, setMiau] = useState(false)
  const seen = useRef(s.messages.at(-1)?.id ?? '')

  // conversas soltas contam como "vistas" pro aviso
  useEffect(() => {
    floatChans.clear(); floats.forEach(f => floatChans.add(f.ch))
    save('ev:floats', floats)
  }, [floats])

  // mensagem nova de outra pessoa: a bolinha pula e mostra uma espiadinha
  const last = s.messages.at(-1)
  useEffect(() => {
    if (!last) return
    if (seen.current === last.id) return
    seen.current = last.id
    if (Date.now() - Date.parse(last.created_at) > 60_000) return // histórico chegando, não é novidade
    const viewing = (open && s.channel === last.channel) || floatChans.has(last.channel)
    if (last.sender_id === s.meId || viewing || (last.channel.startsWith('g:') && !groupOf(last.channel, s)?.members.includes(s.meId!))) return
    setPeek({ id: last.id, from: last.sender_id, body: last.body })
    setPing(n => n + 1)
    const t = setTimeout(() => setPeek(null), 5000)
    return () => clearTimeout(t)
  }, [last?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // a janela cabe na tela se ela mudar de tamanho
  useEffect(() => {
    const on = () => { setBp(p => clamp(p, B, B)); setWp(p => (p ? clamp(p, 300, 48) : p)); setFloats(fs => fs.map(f => ({ ...f, ...clamp(f, 300, 48) }))) }
    addEventListener('resize', on)
    return () => removeEventListener('resize', on)
  }, [])

  const right = bp.x + B / 2 > innerWidth / 2
  // janela mudou de tamanho (ou abriu escondida): o gato continua encostado no mesmo lado
  const lado = useRef(right); lado.current = right
  useEffect(() => {
    const fit = () => setBp(p => clamp({ x: lado.current ? innerWidth - B - M : M, y: load<XY | null>('ev:bubble', null) ? p.y : innerHeight - B - (narrow() ? 150 : 20) }, B, B))
    addEventListener('resize', fit)
    return () => removeEventListener('resize', fit)
  }, [])
  const down = (e: React.PointerEvent) => {
    e.preventDefault()
    drag(e, bp, q => { setDragging(true); setBp(clamp(q, B, B)) }, (q, moved) => {
      setDragging(false)
      if (!moved) return tap()
      // encosta na borda mais perto
      const c = clamp(q, B, B)
      const snap = { x: c.x + B / 2 > innerWidth / 2 ? innerWidth - B - M : M, y: c.y }
      setBp(snap); save('ev:bubble', snap)
    })
  }
  const tap = () => {
    if (open) return setUi({ chatOpen: false })
    if (peek) { setPeek(null); return setUi({ chatOpen: true, channel: last!.channel }) }
    setMiau(!miau)
  }
  const falar = (channel?: string) => { setMiau(false); setUi(channel ? { chatOpen: true, channel } : { chatOpen: true }) }
  const gente = Object.values(s.profiles).filter(p => p.id !== s.meId && p.avatar)
    .sort((a, b) => Number(s.online.has(b.id)) - Number(s.online.has(a.id)) || a.name.localeCompare(b.name)).slice(0, 8)
  // primeira vez: a janela abre do lado da bolinha
  const winAt = wp ?? clamp({ x: right ? bp.x - 700 + B : bp.x, y: bp.y - 640 }, 700, 620)
  const pop = (ch: string) => {
    if (floats.some(f => f.ch === ch)) return
    const n = floats.length
    setFloats([...floats, { ch, ...clamp({ x: winAt.x - 376 - n * 28, y: winAt.y + 60 + n * 28 }, 360, 48) }])
    if (s.channel === ch) setUi({ chatOpen: false, channel: 'geral' }) // a conversa saiu da janela principal
  }
  const head = (ch: string) => {
    const t = channelTitle(ch, s)
    return <span className="cwin-t">{t.who ? <MiniAvatar avatar={t.who.avatar} photo={t.who.photo} name={t.who.name} size={22} /> : <Ph n={t.icon!} size={18} />}<b>{t.label}</b></span>
  }

  return (
    <>
      <div className={'gato-wrap' + (right ? ' right' : ' left') + (bp.y < innerHeight / 2 ? ' cima' : ' baixo')} style={{ top: bp.y }}>
        <button
          className={'gato' + (open ? ' on' : '') + (dragging ? ' dragging' : '') + (unread ? ' has' : '') + (miau ? ' miau' : '')}
          key={ping} /* reinicia o pulinho */
          onPointerDown={down}
          onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && tap()}
          title="Chat da equipe (arraste pra cima ou pra baixo, ou pro outro lado)"
          aria-label={`Chat${unread ? ` (${unread} novas)` : ''}`}
          aria-expanded={open || miau}
        >
          <span className="gato-corpo"><MeoEncostado cabeca size={48} color={TENANT.acc} mood={open || miau ? 'feliz' : unread ? 'chamando' : 'idle'} /></span>
          {!open && unread > 0 && <i className="gato-n">{unread > 9 ? '9+' : unread}</i>}
        </button>
        {peek && !open && !miau && (
          <button className="gato-balao gato-peek" onClick={() => { setPeek(null); setUi({ chatOpen: true, channel: last!.channel }) }}>
            <MiniAvatar avatar={s.profiles[peek.from]?.avatar ?? null} photo={s.profiles[peek.from]?.photo ?? null} name={s.profiles[peek.from]?.name} size={28} />
            <span><b>{s.profiles[peek.from]?.name ?? 'Alguém'}</b>{peek.body.slice(0, 80)}</span>
          </button>
        )}
        {miau && !open && <>
          <div className="more-veil" onClick={() => setMiau(false)} />
          <div className="gato-balao gato-pop" role="dialog" aria-label="Falar com quem?">
            <b className="gato-t">Miau! Falar com quem?</b>
            <div className="gato-gente">
              {gente.map(p => (
                <button key={p.id} onClick={() => falar(dmChannel(s.meId!, p.id))} title={p.name}>
                  <span className={'gato-av' + (s.online.has(p.id) ? ' on' : '')}><MiniAvatar avatar={p.avatar} photo={p.photo} name={p.name} size={40} /></span>
                  <small>{p.name.split(' ')[0]}</small>
                </button>
              ))}
            </div>
            <div className="gato-acts">
              <button onClick={() => falar('geral')}><Ph n="chat-circle-dots" size={18} />Geral da equipe</button>
              <button onClick={() => falar()}><Ph n="users-three" size={18} />Todas as conversas</button>
            </div>
          </div>
        </>}
      </div>

      {open && (
        <Win id="main" at={winAt} above={bp.y} onAt={p => { setWp(p); save('ev:cwin', p) }} onClose={() => setUi({ chatOpen: false })}
          title={<span className="cwin-t"><Icon n="chat" /><b>Chat</b><small className="muted">arraste pra mover</small></span>}>
          <Chat onPop={narrow() ? undefined : pop} />
        </Win>
      )}

      {!narrow() && floats.map(f => (
        <Win key={f.ch} id={'f:' + f.ch} solo at={f} title={head(f.ch)}
          onAt={p => setFloats(fs => fs.map(x => (x.ch === f.ch ? { ...x, ...p } : x)))}
          onClose={() => setFloats(fs => fs.filter(x => x.ch !== f.ch))}>
          <Chat fixed={f.ch} onGone={() => setFloats(fs => fs.filter(x => x.ch !== f.ch))} />
        </Win>
      ))}
    </>
  )
}
