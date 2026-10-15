import { useEffect, useState } from 'react'
import { clearNotices, setUi, unread, useStore, type Notice, type NoticeKind } from '../store'
import Icon, { Ph } from './Icon'
import MiniAvatar from './MiniAvatar'
import type { PhName } from './ph'

/** cada tipo de aviso com nome, ícone e cor, pra bater o olho e saber o que é */
const TIPOS: Record<NoticeKind, [string, PhName, string]> = {
  data: ['Data comemorativa', 'calendar-dots', '#C2189B'],
  plano: ['Plano de marketing', 'megaphone', '#7B4DFF'],
  prazo: ['Prazo', 'flag-banner', '#E8620C'],
  lembrete: ['Lembrete', 'bell-simple', '#B88A00'],
  pedido: ['Pedido', 'paper-plane-tilt', '#2440FF'],
  colab: ['Colaboração', 'hand-heart', '#0E8FA8'],
  aprov: ['Aprovação', 'seal-check', '#1F9D55'],
  msg: ['Mensagem', 'chat-circle-dots', '#2440FF'],
  adesivo: ['Adesivo', 'sticker', '#C2189B'],
  loja: ['Cafezinhos', 'coffee', '#8A5A2B'],
  time: ['Equipe', 'users-three', '#5A5A66'],
}
const tipo = (n: Notice) => TIPOS[n.kind ?? 'msg'] ?? TIPOS.msg
/** tira emoji do começo/fim (o ícone já diz o que é) */
const limpo = (t: string) => t.replace(/^[\p{Extended_Pictographic}\uFE0F\s]+/u, '').replace(/[\s\uFE0F]*[\p{Extended_Pictographic}\uFE0F]+$/u, '')

/** ícone do tipo; com remetente, o rosto dele com o ícone no canto */
function Marca({ n, size = 34 }: { n: Notice; size?: number }) {
  const p = useStore(s => (n.from ? s.profiles[n.from] : null))
  const [, ic, cor] = tipo(n)
  return (
    <span className="nt-m" style={{ ['--nc' as string]: cor, width: size, height: size }}>
      {p ? <><MiniAvatar avatar={p.avatar} photo={p.photo} name={p.name} size={size} /><i className="nt-badge"><Ph n={ic} size={11} fill /></i></>
        : <i className="nt-ic"><Ph n={ic} size={Math.round(size * .5)} fill /></i>}
    </span>
  )
}

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
  const notices = useStore(s => s.notices)
  const n = notices[0]
  const [, force] = useState(0)
  const [fechado, setFechado] = useState<string | null>(null)
  const live = !!n && n.id !== fechado && Date.now() - n.at < SHOW_MS
  useEffect(() => {
    if (!live) return
    const id = setTimeout(() => force(x => x + 1), SHOW_MS - (Date.now() - n!.at) + 50)
    return () => clearTimeout(id)
  }, [live, n])
  if (!live) return null
  // chegou um monte junto: mostra o último e avisa quantos mais
  const juntos = notices.filter(x => n.at - x.at < 5000).length
  const [nome, , cor] = tipo(n)
  return (
    <div className="toast" role="status" style={{ ['--nc' as string]: cor }}>
      <button type="button" className="toast-c" onClick={() => go(n)}>
        <Marca n={n} />
        <span className="toast-tx"><small>{nome}</small><span>{limpo(n.text)}</span></span>
      </button>
      {juntos > 1 && <button type="button" className="toast-mais" onClick={() => setUi({ bellOpen: true })}>+{juntos - 1} aviso{juntos > 2 ? 's' : ''}</button>}
      <button type="button" className="toast-x" onClick={() => setFechado(n.id)} aria-label="Fechar aviso"><Ph n="x" size={14} /></button>
    </div>
  )
}

/** Sino com contador; abre a lista de avisos num balão. */
/** chat da equipe: abre a janela do chat; fica ao lado do sino em toda barra de cima */
function ChatBtn() {
  const open = useStore(s => s.chatOpen)
  const n = useStore(s => [...new Set(s.messages.map(m => m.channel))].reduce((k, ch) => k + unread(s, ch), 0))
  return (
    <div className="bell">
      <button className={'icon-btn' + (open ? ' on' : '')} onClick={() => setUi({ chatOpen: !open, bellOpen: false })} title="Chat da equipe" aria-label={`Chat${n ? ` (${n} novas)` : ''}`} aria-expanded={open}>
        <Ph n="chat-circle-dots" size={20} />{n > 0 && <i className="dot-n">{n > 9 ? '9+' : n}</i>}
      </button>
    </div>
  )
}

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
  return (<>
    <ChatBtn />
    <div className="bell">
      <button className={'icon-btn' + (open ? ' on' : '')} onClick={() => setUi({ bellOpen: !open })} title="Avisos" aria-label={`Avisos${n ? ` (${n} novos)` : ''}`}>
        <Icon n="bell" size={18} />{n > 0 && <i className="dot-n">{n > 9 ? '9+' : n}</i>}
      </button>
      {open && <><div className="pop-bg" onClick={() => setUi({ bellOpen: false })} /><div className="pop"><Avisos /></div></>}
    </div>
  </>)
}

export default function Avisos() {
  const notices = useStore(s => s.notices)
  const [desde] = useState(readSeen)
  const [perm, setPerm] = useState(() => ('Notification' in window ? Notification.permission : 'denied'))
  return (
    <div className="avisos">
      <header className="pop-head">
        <b className="grow">Avisos</b>
        {notices.length > 0 && <button className="btn ghost sm" onClick={clearNotices}>Limpar</button>}
        {perm === 'default' && <button className="btn ghost sm" onClick={() => Notification.requestPermission().then(setPerm)}>Ativar notificações</button>}
        <button className="icon-btn" onClick={() => setUi({ bellOpen: false })} aria-label="Fechar"><Icon n="x" /></button>
      </header>
      <ul className="inbox">
        {notices.map((n, i) => {
          const novo = n.at > desde
          const sep = i === 0 ? (novo ? 'Novos' : 'Anteriores') : !novo && notices[i - 1].at > desde ? 'Anteriores' : null
          const [nome, , cor] = tipo(n)
          return (
            <li key={n.id} className={novo ? 'novo' : ''} style={{ ['--nc' as string]: cor }}>
              {sep && <b className="inbox-sep">{sep}</b>}
              <button type="button" onClick={() => go(n)}>
                <Marca n={n} size={32} />
                <span className="inbox-tx"><small><b>{nome}</b> · {ago(n.at)}</small><span>{limpo(n.text)}</span></span>
              </button>
            </li>
          )
        })}
        {notices.length === 0 && <li className="muted inbox-vazio">Nada novo. Datas, prazos, pedidos e mensagens aparecem aqui.</li>}
      </ul>
    </div>
  )
}
