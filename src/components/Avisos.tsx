import { useEffect, useState } from 'react'
import { setUi, useStore, type Notice } from '../store'
import MiniAvatar from './MiniAvatar'

const SHOW_MS = 6000
const ago = (t: number) => {
  const m = Math.round((Date.now() - t) / 60000)
  return m < 1 ? 'agora' : m < 60 ? `há ${m} min` : `há ${Math.round(m / 60)} h`
}
const go = (n: Notice) => { window.focus(); if (n.go) setUi(n.go) }

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
      {from ? <MiniAvatar avatar={from.avatar} photo={from.photo} size={28} /> : <span className="toast-dot" />}
      <span>{n!.text}</span>
    </button>
  )
}

export default function Avisos() {
  const notices = useStore(s => s.notices)
  const profiles = useStore(s => s.profiles)
  const [perm, setPerm] = useState(() => ('Notification' in window ? Notification.permission : 'denied'))
  return (
    <div className="page-pad">
      <header className="page-head">
        <h1>Avisos</h1>
        {perm === 'default' && <button className="btn ghost sm" onClick={() => Notification.requestPermission().then(setPerm)}>Ativar notificações</button>}
      </header>
      <ul className="inbox">
        {notices.map(n => {
          const p = n.from ? profiles[n.from] : null
          return (
            <li key={n.id} onClick={() => go(n)}>
              {p ? <MiniAvatar avatar={p.avatar} photo={p.photo} size={28} /> : <span className="toast-dot" />}
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
