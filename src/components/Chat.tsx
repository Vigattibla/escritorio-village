import { useEffect, useRef, useState } from 'react'
import { canEditGroup, deleteGroup, dmChannel, dmPeer, GROUP_ICONS, groupChannel, groupOf, inChannel, joinGroup, markRead, run, saveGroup, send, setUi, unread, useStore } from '../store'
import type { Group } from '../types'
import MiniAvatar from './MiniAvatar'
import { Ph } from './Icon'
import type { PhName } from './ph'

const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

/** fixed: janelinha solta de uma conversa só (sem a lista de canais) */
export default function Chat({ fixed, onPop, onGone }: { fixed?: string; onPop?: (ch: string) => void; onGone?: () => void } = {}) {
  const s = useStore(x => x)
  const ch = fixed ?? s.channel
  const meId = s.meId!
  const [text, setText] = useState('')
  /** formulário de grupo aberto: 'new' ou o grupo em edição */
  const [form, setForm] = useState<Group | 'new' | null>(null)
  const end = useRef<HTMLDivElement>(null)
  const msgs = s.messages.filter(m => m.channel === ch)
  const peers = Object.values(s.profiles).filter(p => p.id !== meId && p.avatar)
  const group = groupOf(ch, s)
  const joined = inChannel(ch, s)
  const groups = Object.values(s.rows.groups)
    .filter(g => g.open || g.members.includes(meId))
    .sort((a, b) => +b.members.includes(meId) - +a.members.includes(meId) || a.name.localeCompare(b.name))
  const title = ch === 'geral' ? '# Geral' : group ? group.name : ch.startsWith('g:') ? 'Grupo' : s.profiles[dmPeer(ch, meId)]?.name ?? 'Conversa'

  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }) }, [msgs.length, ch])
  useEffect(() => { markRead(ch) }, [ch, msgs.length])
  // grupo apagado ou fui tirado de um fechado: volta pro Geral
  useEffect(() => { if (ch.startsWith('g:') && (!group || (!group.open && !joined))) (fixed ? onGone?.() : setUi({ channel: 'geral' })) }, [ch, group, joined])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    run(send(ch, text))
    setText('')
  }

  const chan = (id: string, label: React.ReactNode) => {
    const n = unread(s, id)
    return (
      <button key={id} className={'chan' + (ch === id ? ' on' : '')} onClick={() => setUi({ channel: id })}>
        {label}{n > 0 && <span className="badge">{n}</span>}
      </button>
    )
  }

  return (
    <div className={'chat' + (fixed ? ' solo' : '')}>
      {!fixed && <nav className="chans">
        {chan('geral', <span># Geral</span>)}
        <div className="chans-sec"><span>Grupos</span><button className="icon-btn xs" onClick={() => setForm('new')} title="Novo grupo" aria-label="Novo grupo"><Ph n="plus" size={14} /></button></div>
        {groups.map(g => chan(groupChannel(g.id), <><Ph n={g.icon as PhName} size={18} /><span className={g.members.includes(meId) ? '' : 'out'}>{g.name}</span></>))}
        {groups.length === 0 && <button className="chan ghost" onClick={() => setForm('new')}><Ph n="plus" size={16} /><span>Criar grupo</span></button>}
        <div className="chans-sec"><span>Pessoas</span></div>
        {peers.map(p => chan(dmChannel(meId, p.id), <><MiniAvatar avatar={p.avatar} photo={p.photo} name={p.name} size={20} dim={!s.online.has(p.id)} /><span>{p.name}</span></>))}
      </nav>}
      {form ? <GroupForm g={form === 'new' ? null : form} close={() => setForm(null)} /> : <>
      <div className="msgs">
        <div className="chat-title">
          {group ? <span className="gtitle"><Ph n={group.icon as PhName} size={18} />{group.name}<small className="muted">{group.open ? 'Aberto' : 'Só convidados'} · {group.members.length} {group.members.length === 1 ? 'pessoa' : 'pessoas'}</small></span> : title}
          {onPop && !fixed && <button className="icon-btn xs pop-out" onClick={() => onPop(ch)} title="Soltar esta conversa numa janelinha" aria-label="Soltar conversa"><Ph n="corners-out" size={15} /></button>}
          {group && joined && (
            <span className="gacts">
              {canEditGroup(group) && <button className="icon-btn xs" onClick={() => setForm(group)} title="Editar grupo" aria-label="Editar grupo"><Ph n="gear-six" size={15} /></button>}
              <button className="btn ghost xs" onClick={() => run(joinGroup(group.id, false))}>Sair</button>
            </span>
          )}
        </div>
        {msgs.length === 0 && <p className="empty">Nenhuma mensagem ainda. Diga oi! 👋</p>}
        {msgs.map((m, i) => {
          const p = s.profiles[m.sender_id]
          const grouped = i > 0 && msgs[i - 1].sender_id === m.sender_id && +new Date(m.created_at) - +new Date(msgs[i - 1].created_at) < 300000
          return (
            <div key={m.id} className={'msg' + (m.sender_id === meId ? ' mine' : '') + (grouped ? ' grouped' : '')}>
              {!grouped ? <MiniAvatar avatar={p?.avatar ?? null} photo={p?.photo ?? null} name={p?.name} size={30} /> : <span className="av-space" />}
              <div>
                {!grouped && <div className="who"><b>{p?.name ?? 'Alguém'}</b> <span className="muted small">{hhmm(m.created_at)}</span></div>}
                <div className="body">{m.body}</div>
              </div>
            </div>
          )
        })}
        <div ref={end} />
      </div>
      {group && !joined ? (
        <div className="send gjoin"><span className="muted">Você ainda não está nesse grupo.</span><button className="btn primary" onClick={() => run(joinGroup(group.id, true))}>Entrar no grupo</button></div>
      ) : (
        <form className="send" onSubmit={submit}>
          <input value={text} onChange={e => setText(e.target.value)} placeholder={`Mensagem para ${title}`} maxLength={1000} />
          <button className="btn primary" disabled={!text.trim()}>Enviar</button>
        </form>
      )}
      </>}
    </div>
  )
}

/** Criar ou editar grupo: nome, ícone, aberto/fechado e quem participa. */
function GroupForm({ g, close }: { g: Group | null; close: () => void }) {
  const s = useStore(x => x)
  const meId = s.meId!
  const [name, setName] = useState(g?.name ?? '')
  const [icon, setIcon] = useState(g?.icon ?? GROUP_ICONS[0])
  const [open, setOpen] = useState(g?.open ?? true)
  const [members, setMembers] = useState<string[]>(g?.members ?? [meId])
  const people = Object.values(s.profiles).filter(p => p.avatar).sort((a, b) => +(b.id === meId) - +(a.id === meId) || a.name.localeCompare(b.name))
  const toggle = (id: string) => setMembers(m => (m.includes(id) ? m.filter(x => x !== id) : [...m, id]))
  const save = async () => {
    const r = await saveGroup({ id: g?.id, name, icon, open, members: members.includes(meId) || g ? members : [...members, meId] })
    setUi({ channel: groupChannel(r.id) }); close()
  }
  const del = () => { if (g && confirm(`Apagar o grupo “${g.name}”? As mensagens dele somem da lista.`)) { run(deleteGroup(g.id)); close() } }
  return (
    <form className="gform" onSubmit={e => { e.preventDefault(); run(save()) }}>
      <b className="gform-t">{g ? 'Editar grupo' : 'Novo grupo'}</b>
      <input autoFocus value={name} maxLength={40} placeholder="Ex.: Day Use Verão" onChange={e => setName(e.target.value)} aria-label="Nome do grupo" />
      <div className="gicons" role="radiogroup" aria-label="Ícone">
        {GROUP_ICONS.map(i => <button type="button" key={i} role="radio" aria-checked={icon === i} className={'gicon' + (icon === i ? ' on' : '')} onClick={() => setIcon(i)}><Ph n={i} size={18} /></button>)}
      </div>
      <div className="seg">
        <button type="button" className={open ? 'on' : ''} onClick={() => setOpen(true)}><Ph n="globe-simple" size={15} />Aberto</button>
        <button type="button" className={!open ? 'on' : ''} onClick={() => setOpen(false)}><Ph n="users-three" size={15} />Só convidados</button>
      </div>
      <small className="muted">{open ? 'Todo mundo vê o grupo e pode entrar.' : 'Só quem você marcar vê e participa.'}</small>
      <div className="gpeople">
        {people.map(p => (
          <label key={p.id} className={'gperson' + (members.includes(p.id) ? ' on' : '')}>
            <input type="checkbox" checked={members.includes(p.id)} disabled={p.id === meId && !g} onChange={() => toggle(p.id)} />
            <MiniAvatar avatar={p.avatar} photo={p.photo} name={p.name} size={22} /><span>{p.id === meId ? 'Você' : p.name}</span>
          </label>
        ))}
      </div>
      <div className="row gap">
        <button className="btn primary sm" disabled={!name.trim()}>{g ? 'Salvar' : 'Criar grupo'}</button>
        <button type="button" className="btn ghost sm" onClick={close}>Cancelar</button>
        {g && <button type="button" className="btn ghost sm danger" onClick={del} style={{ marginLeft: 'auto' }}>Apagar</button>}
      </div>
    </form>
  )
}
