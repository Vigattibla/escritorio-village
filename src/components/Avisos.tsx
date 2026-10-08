import { useEffect, useState } from 'react'
import { setUi, useStore, type Notice } from '../store'
import Icon from './Icon'
import MiniAvatar from './MiniAvatar'

const SHOW_MS = 6000
const ago = (t: number) => {
  const m = Math.round((Date.now() - t) / 60000)
  return m < 1 ? 'agora' : m < 60 ? `há ${m} min` : `há ${Math.round(m / 60)} h`
}
const go = (n: Notice) => { window.focus(); setUi({ ...n.go, bellOpen: false }) }
const SEEN = 'ev:seen'
const readSeen = () => { try { return Number(localStorage.getItem(SEEN)) || 0 } catch { return 0 } }

/** Último aviso no canto, some sozinho. */
export function Toast() {
  const n = useStore(s => s.notices[0])
  const from = useStore(s => (n?.from ? s.profiles[n.from] : null))
  const [, force] = useState(0)
  const live = !!n && Date.now() - n.at < SHOW_MS
  useEffect(() => {
    if (!live) return
    const id = setTimeout(() => force(x => x + 1), SHOW_MS - (Date.now() - n!.at) + 50)
    return () => clearTimeout(id)
  }, [live, n])
  if (!live) return null
  return (
    <button className="toast" onClick={() => go(n!)}>
      {from ? <MiniAvatar avatar={from.avatar} photo={from.photo} name={from.name} size={28} /> : <span className="toast-dot" />}
      <span>{n!.text}</span>
    </button>
  )
}

/** Sino com contador; abre a lista de avisos num balão. */
export function Bell() {
  const open = useStore(s => s.bellOpen)
  const notices = useStore(s => s.notices)
  const [seen, setSeen] = useState(readSeen)
  const n = notices.filter(x => x.at > seen).length
  useEffect(() => {
    if (!open) return
    const t = Date.now()
    setSeen(t)
    try { localStorage.setItem(SEEN, String(t)) } catch { /* sem storage */ }
  }, [open, notices.length])
  return (
    <div className="bell">
      <button className={'icon-btn' + (open ? ' on' : '')} onClick={() => setUi({ bellOpen: !open })} title="Avisos" aria-label={`Avisos${n ? ` (${n} novos)` : ''}`}>
        <Icon n="bell" size={18} />{n > 0 && <i className="dot-n">{n > 9 ? '9+' : n}</i>}
      </button>
      {open && <><div className="pop-bg" onClick={() => setUi({ bellOpen: false })} /><div className="pop"><Avisos /></div></>}
    </div>
  )
}

export default function Avisos() {
  const notices = useStore(s => s.notices)
  const profiles = useStore(s => s.profiles)
  const [perm, setPerm] = useState(() => ('Notification' in window ? Notification.permission : 'denied'))
  return (
    <div className="avisos">
      <header className="pop-head">
        <b className="grow">Avisos</b>
        {perm === 'default' && <button className="btn ghost sm" onClick={() => Notification.requestPermission().then(setPerm)}>Ativar notificações</button>}
        <button className="icon-btn" onClick={() => setUi({ bellOpen: false })} aria-label="Fechar"><Icon n="x" /></button>
      </header>
      <ul className="inbox">
        {notices.map(n => {
          const p = n.from ? profiles[n.from] : null
          return (
            <li key={n.id} onClick={() => go(n)}>
              {p ? <MiniAvatar avatar={p.avatar} photo={p.photo} name={p.name} size={28} /> : <span className="toast-dot" />}
              <span className="grow">{n.text}</span>
              <small>{ago(n.at)}</small>
            </li>
          )
        })}
        {notices.length === 0 && <li className="muted">Nada novo. Pedidos, mensagens e aprovações aparecem aqui.</li>}
      </ul>
    </div>
  )
}
