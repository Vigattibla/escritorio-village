import { useEffect, useRef, useState } from 'react'
import { canEditGroup, deleteGroup, deptList, deptName, dmChannel, dmPeer, GROUP_ICONS, groupChannel, groupOf, inChannel, joinGroup, markRead, run, salaChannel, saveGroup, send, setUi, unread, useStore } from '../store'
import type { Group, Message } from '../types'
import { deptOf } from '../game/ranks'
import MiniAvatar from './MiniAvatar'
import { Ph } from './Icon'
import type { PhName } from './ph'

const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
const diaKey = (iso: string) => new Date(iso).toDateString()
function diaLabel(iso: string) {
  const d = new Date(iso), hoje = new Date()
  const ontem = new Date(hoje); ontem.setDate(hoje.getDate() - 1)
  if (d.toDateString() === hoje.toDateString()) return 'Hoje'
  if (d.toDateString() === ontem.toDateString()) return 'Ontem'
  return d.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' }).replace('.', '')
}
/** só emoji (até 3): mostra grandão, sem balão */
const soEmoji = (t: string) => /^(\p{Extended_Pictographic}|\p{Emoji_Modifier}|️|‍|\s)+$/u.test(t) && [...t.replace(/\s/g, '')].filter(c => /\p{Extended_Pictographic}/u.test(c)).length <= 3
export const CUTUCA = '👉 cutucou você!'
const EMOJIS = ['😀', '😂', '😍', '🥳', '😅', '🤔', '👍', '🙏', '👀', '🔥', '✅', '🎉', '☕', '❤️', '🙌', '💪']
const RAPIDAS = ['Bom dia! ☀️', 'Já vejo 👀', 'Feito ✅', 'Valeu! 🙌', 'Pode deixar 👍']
const PRIMEIRAS = ['Oi! 👋', 'Bom dia! ☀️', 'Tem um minutinho?']

/** fixed: janelinha solta de uma conversa só (sem a lista de canais) */
export default function Chat({ fixed, onPop, onGone }: { fixed?: string; onPop?: (ch: string) => void; onGone?: () => void } = {}) {
  const s = useStore(x => x)
  const ch = fixed ?? s.channel
  const meId = s.meId!
  const [text, setText] = useState('')
  const [busca, setBusca] = useState('')
  const [emojis, setEmojis] = useState(false)
  const [cutucou, setCutucou] = useState(0)
  /** formulário de grupo aberto: 'new' ou o grupo em edição */
  const [form, setForm] = useState<Group | 'new' | null>(null)
  const end = useRef<HTMLDivElement>(null)
  const inp = useRef<HTMLInputElement>(null)
  const msgs = s.messages.filter(m => m.channel === ch)
  // só anima o que chega depois de abrir a conversa
  const vistos = useRef({ ch: '', ids: new Set<string>() })
  if (vistos.current.ch !== ch) vistos.current = { ch, ids: new Set(msgs.map(m => m.id)) }
  const ultima = new Map<string, Message>()
  for (const m of s.messages) ultima.set(m.channel, m)
  const peers = Object.values(s.profiles).filter(p => p.id !== meId && p.avatar)
    .sort((a, b) => +s.online.has(b.id) - +s.online.has(a.id) || (ultima.get(dmChannel(meId, b.id))?.created_at ?? '').localeCompare(ultima.get(dmChannel(meId, a.id))?.created_at ?? '') || a.name.localeCompare(b.name))
  const group = groupOf(ch, s)
  const joined = inChannel(ch, s)
  const groups = Object.values(s.rows.groups)
    .filter(g => g.open || g.members.includes(meId))
    .sort((a, b) => +b.members.includes(meId) - +a.members.includes(meId) || a.name.localeCompare(b.name))
  const salas = deptList(s).length > 1
  const peer = ch.startsWith('dm:') ? s.profiles[dmPeer(ch, meId)] : undefined
  const title = ch === 'geral' ? 'Geral' : ch.startsWith('sala:') ? deptName(ch.slice(5), s) : group ? group.name : ch.startsWith('g:') ? 'Grupo' : peer?.name ?? 'Conversa'
  const q = busca.trim().toLowerCase()
  const bate = (t: string) => !q || t.toLowerCase().includes(q)

  useEffect(() => { end.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }) }, [msgs.length, ch])
  useEffect(() => { markRead(ch) }, [ch, msgs.length])
  useEffect(() => { setEmojis(false); setCutucou(0) }, [ch])
  // grupo apagado ou fui tirado de um fechado: volta pro Geral
  useEffect(() => { if (ch.startsWith('g:') && (!group || (!group.open && !joined))) (fixed ? onGone?.() : setUi({ channel: 'geral' })) }, [ch, group, joined])

  const enviar = (t: string) => { run(send(ch, t)); setText(''); setEmojis(false) }
  const submit = (e: React.FormEvent) => { e.preventDefault(); enviar(text) }
  const poeEmoji = (em: string) => {
    const el = inp.current, a = el?.selectionStart ?? text.length, b = el?.selectionEnd ?? text.length
    setText(text.slice(0, a) + em + text.slice(b))
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(a + em.length, a + em.length) })
  }
  const cutucar = () => { if (Date.now() - cutucou < 30000) return; setCutucou(Date.now()); run(send(ch, CUTUCA)) }

  const prever = (id: string) => {
    const m = ultima.get(id)
    if (!m) return null
    const quem = m.sender_id === meId ? 'Você: ' : id.startsWith('dm:') ? '' : (s.profiles[m.sender_id]?.name.split(' ')[0] ?? 'Alguém') + ': '
    return quem + (m.body === CUTUCA ? '👉 cutucada' : m.body)
  }
  const item = (id: string, ico: React.ReactNode, nome: string, extra = '') => {
    if (!bate(nome)) return null
    const n = unread(s, id), pv = prever(id)
    return (
      <button key={id} className={'tc-item' + (ch === id ? ' on' : '') + (n ? ' novo' : '') + extra} onClick={() => setUi({ channel: id })} title={nome}>
        <span className="tc-ico">{ico}</span>
        <span className="tc-txt"><b>{nome}</b>{pv && <small>{pv}</small>}</span>
        {n > 0 && <span className="tc-n">{n > 9 ? '9+' : n}</span>}
      </button>
    )
  }

  const hdIco = peer ? <span className={'tc-av' + (s.online.has(peer.id) ? ' on' : '')}><MiniAvatar avatar={peer.avatar} photo={peer.photo} name={peer.name} size={38} /></span>
    : <span className="tc-tile"><Ph n={group ? group.icon as PhName : ch.startsWith('sala:') ? 'building-office' : 'chat-circle-dots'} size={20} /></span>
  const hdSub = peer ? (s.online.has(peer.id) ? 'no escritório agora' : 'fora do escritório') + ' · ' + deptName(deptOf(peer), s)
    : group ? `${group.open ? 'Aberto' : 'Só convidados'} · ${group.members.length} ${group.members.length === 1 ? 'pessoa' : 'pessoas'}`
    : ch === 'geral' ? (salas ? 'o andar todo' : 'a equipe toda') + ` · ${s.online.size} online` : 'quem está nessa sala'

  return (
    <div className="tc-box"><div className={'chat tc' + (fixed ? ' solo' : '')}>
      {!fixed && <nav className="tc-side">
        <label className="tc-busca"><Ph n="magnifying-glass" size={15} /><input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar conversa" aria-label="Buscar conversa" /></label>
        <div className="tc-list">
          <div className="tc-sec">Canais</div>
          {item('geral', <span className="tc-tile sm"><Ph n="chat-circle-dots" size={16} /></span>, 'Geral')}
          {salas && item(salaChannel(s.sala), <span className="tc-tile sm alt"><Ph n="building-office" size={16} /></span>, deptName(s.sala, s))}
          <div className="tc-sec">Grupos<button className="tc-mais" onClick={() => setForm('new')} title="Novo grupo" aria-label="Novo grupo"><Ph n="plus" size={13} /></button></div>
          {groups.map(g => item(groupChannel(g.id), <span className="tc-tile sm g"><Ph n={g.icon as PhName} size={16} /></span>, g.name, g.members.includes(meId) ? '' : ' fora'))}
          {groups.length === 0 && !q && <button className="tc-item ghost" onClick={() => setForm('new')}><span className="tc-ico"><span className="tc-tile sm ghost"><Ph n="plus" size={16} /></span></span><span className="tc-txt"><b>Criar grupo</b></span></button>}
          <div className="tc-sec">Pessoas<small>{peers.filter(p => s.online.has(p.id)).length} online</small></div>
          {peers.map(p => item(dmChannel(meId, p.id), <span className={'tc-av' + (s.online.has(p.id) ? ' on' : '')}><MiniAvatar avatar={p.avatar} photo={p.photo} name={p.name} size={30} /></span>, p.name))}
        </div>
      </nav>}
      {form ? <GroupForm g={form === 'new' ? null : form} close={() => setForm(null)} /> : <div className="tc-main">
        <header className="tc-hd">
          {hdIco}
          <div className="tc-hd-t"><b>{title}</b><small>{hdSub}</small></div>
          {peer && <button className={'tc-cutucar' + (Date.now() - cutucou < 30000 ? ' foi' : '')} onClick={cutucar} title={`Cutucar ${peer.name.split(' ')[0]}`}>👉 <span>{Date.now() - cutucou < 30000 ? 'Cutucou!' : 'Cutucar'}</span></button>}
          {group && joined && canEditGroup(group) && <button className="icon-btn xs" onClick={() => setForm(group)} title="Editar grupo" aria-label="Editar grupo"><Ph n="gear-six" size={16} /></button>}
          {group && joined && <button className="btn ghost xs" onClick={() => run(joinGroup(group.id, false))}>Sair</button>}
          {onPop && !fixed && <button className="icon-btn xs" onClick={() => onPop(ch)} title="Soltar esta conversa numa janelinha" aria-label="Soltar conversa"><Ph n="corners-out" size={16} /></button>}
        </header>
        <div className="tc-msgs">
          {msgs.length === 0 && <div className="tc-vazio"><span>{peer ? '👋' : '💬'}</span><b>{peer ? `Comece a conversa com ${peer.name.split(' ')[0]}` : 'Nada por aqui ainda'}</b><small>Manda um oi — aparece no balãozinho em cima do seu boneco também.</small></div>}
          {msgs.map((m, i) => {
            const p = s.profiles[m.sender_id], mine = m.sender_id === meId, prev = msgs[i - 1], next = msgs[i + 1]
            const novoDia = !prev || diaKey(prev.created_at) !== diaKey(m.created_at)
            const junto = (a?: Message, b?: Message) => !!a && !!b && a.sender_id === b.sender_id && a.body !== CUTUCA && b.body !== CUTUCA && diaKey(a.created_at) === diaKey(b.created_at) && Math.abs(+new Date(b.created_at) - +new Date(a.created_at)) < 300000
            const topo = !junto(prev, m), fim = !junto(m, next)
            const anim = vistos.current.ids.has(m.id) ? '' : ' chega'
            const dia = novoDia && <div className="tc-dia" key={'d' + m.id}><span>{diaLabel(m.created_at)}</span></div>
            if (m.body === CUTUCA) return [dia, <div key={m.id} className={'tc-cutucada' + anim}><span>👉</span><b>{mine ? 'Você' : p?.name.split(' ')[0] ?? 'Alguém'}</b> cutucou {mine ? (peer?.name.split(' ')[0] ?? 'a turma') : 'você'} · {hhmm(m.created_at)}</div>]
            const big = soEmoji(m.body)
            return [dia,
              <div key={m.id} className={'tc-msg' + (mine ? ' mine' : '') + (topo ? ' topo' : '') + (fim ? ' fim' : '') + (big ? ' big' : '') + anim}>
                {!mine && (fim ? <span className="tc-msg-av"><MiniAvatar avatar={p?.avatar ?? null} photo={p?.photo ?? null} name={p?.name} size={30} /></span> : <span className="tc-msg-av" />)}
                <div className="tc-col">
                  {topo && !mine && !peer && <b className="tc-quem" style={{ color: `hsl(${[...m.sender_id].reduce((a, c) => a + c.charCodeAt(0), 0) % 360} 55% 38%)` }}>{p?.name ?? 'Alguém'}</b>}
                  <div className="tc-bal">{m.body}<time>{hhmm(m.created_at)}</time></div>
                </div>
              </div>]
          })}
          <div ref={end} />
        </div>
        {group && !joined ? (
          <div className="tc-join"><span>Você ainda não está nesse grupo.</span><button className="btn primary sm" onClick={() => run(joinGroup(group.id, true))}>Entrar no grupo</button></div>
        ) : <>
          {emojis && <div className="tc-emojis" role="listbox" aria-label="Emojis">{EMOJIS.map(e => <button type="button" key={e} onClick={() => poeEmoji(e)}>{e}</button>)}</div>}
          {!text && !emojis && <div className="tc-rapidas">{(msgs.length ? RAPIDAS : PRIMEIRAS).map(r => <button type="button" key={r} onClick={() => enviar(r)}>{r}</button>)}</div>}
          <form className="tc-send" onSubmit={submit}>
            <button type="button" className={'tc-emo' + (emojis ? ' on' : '')} onClick={() => setEmojis(v => !v)} aria-label="Emojis" title="Emojis"><Ph n="smiley" size={20} /></button>
            <input ref={inp} value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Escape' && setEmojis(false)} placeholder={peer ? `Mensagem para ${peer.name.split(' ')[0]}…` : `Escrever em ${title}…`} maxLength={1000} />
            <button className="tc-go" disabled={!text.trim()} aria-label="Enviar" title="Enviar (Enter)"><Ph n="paper-plane-tilt" size={18} fill /></button>
          </form>
        </>}
      </div>}
    </div></div>
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
