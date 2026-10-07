import { useEffect, useRef, useState } from 'react'
import { dmChannel, dmPeer, markRead, run, send, setUi, unread, useStore } from '../store'
import MiniAvatar from './MiniAvatar'

const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

export default function Chat() {
  const s = useStore(x => x)
  const meId = s.meId!
  const [text, setText] = useState('')
  const end = useRef<HTMLDivElement>(null)
  const msgs = s.messages.filter(m => m.channel === s.channel)
  const peers = Object.values(s.profiles).filter(p => p.id !== meId && p.avatar)
  const title = s.channel === 'geral' ? '# Geral' : s.profiles[dmPeer(s.channel, meId)]?.name ?? 'Conversa'

  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }) }, [msgs.length, s.channel])
  useEffect(() => { markRead(s.channel) }, [s.channel, msgs.length])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    run(send(s.channel, text))
    setText('')
  }

  const chan = (id: string, label: React.ReactNode) => {
    const n = unread(s, id)
    return (
      <button key={id} className={'chan' + (s.channel === id ? ' on' : '')} onClick={() => setUi({ channel: id })}>
        {label}{n > 0 && <span className="badge">{n}</span>}
      </button>
    )
  }

  return (
    <div className="chat">
      <nav className="chans">
        {chan('geral', <span># Geral</span>)}
        {peers.map(p => chan(dmChannel(meId, p.id), <><MiniAvatar avatar={p.avatar} photo={p.photo} size={20} dim={!s.online.has(p.id)} /><span>{p.name}</span></>))}
      </nav>
      <div className="msgs">
        <div className="chat-title">{title}</div>
        {msgs.length === 0 && <p className="empty">Nenhuma mensagem ainda. Diga oi! 👋</p>}
        {msgs.map((m, i) => {
          const p = s.profiles[m.sender_id]
          const grouped = i > 0 && msgs[i - 1].sender_id === m.sender_id && +new Date(m.created_at) - +new Date(msgs[i - 1].created_at) < 300000
          return (
            <div key={m.id} className={'msg' + (m.sender_id === meId ? ' mine' : '') + (grouped ? ' grouped' : '')}>
              {!grouped ? <MiniAvatar avatar={p?.avatar ?? null} photo={p?.photo ?? null} size={30} /> : <span className="av-space" />}
              <div>
                {!grouped && <div className="who"><b>{p?.name ?? 'Alguém'}</b> <span className="muted small">{hhmm(m.created_at)}</span></div>}
                <div className="body">{m.body}</div>
              </div>
            </div>
          )
        })}
        <div ref={end} />
      </div>
      <form className="send" onSubmit={submit}>
        <input value={text} onChange={e => setText(e.target.value)} placeholder={`Mensagem para ${title}`} maxLength={1000} />
        <button className="btn primary" disabled={!text.trim()}>Enviar</button>
      </form>
    </div>
  )
}
