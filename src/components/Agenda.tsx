import { useMemo, useState } from 'react'
import { dayKey } from '../game/xp'
import { addTask, approverOf, canApprove, getState, putRow, review, run, setUi, updateTask, useStore } from '../store'
import type { CalEvent, Channel, Task } from '../types'
import { Bell } from './Avisos'
import Icon, { Ph } from './Icon'
import MiniAvatar from './MiniAvatar'
import { CHANNEL_KEYS, CHANNELS, first, hm, localDay } from './v4'

type Mode = 'mes' | 'semana' | 'lista'
type Item = { kind: 'post' | 'prazo'; t: Task; day: string } | { kind: 'evento'; e: CalEvent; day: string }

const STATUS: Record<string, { label: string; tag: string; ic: 'eye' | 'check' | 'circle-dashed' | 'pencil-simple-line' | 'paper-plane-tilt' }> = {
  inbox: { label: 'Pedido', tag: 'gray', ic: 'paper-plane-tilt' },
  todo: { label: 'A fazer', tag: 'gray', ic: 'circle-dashed' },
  doing: { label: 'Fazendo', tag: 'amber', ic: 'pencil-simple-line' },
  review: { label: 'Em revisão', tag: 'lilac', ic: 'eye' },
  done: { label: 'Aprovado', tag: 'green', ic: 'check' },
}
const WD = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom']
const key = (d: Date) => dayKey(d)
const addD = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
const monday = (d: Date) => addD(d, -((d.getDay() + 6) % 7))
const longDay = (k: string) => { const s = new Date(k + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).replace('-feira', ''); return s[0].toUpperCase() + s.slice(1) }
const itemId = (i: Item) => (i.kind === 'evento' ? i.e.id : i.t.id)
const itemTitle = (i: Item) => (i.kind === 'evento' ? i.e.title : i.t.title)
const itemTime = (i: Item) => (i.kind === 'evento' ? i.e.time ?? '' : i.kind === 'post' && i.t.publish_at ? hm(i.t.publish_at) : '')

export default function Agenda() {
  const meId = useStore(s => s.meId)!
  const tasks = useStore(s => s.tasks)
  const events = useStore(s => s.rows.events)
  const profiles = useStore(s => s.profiles)
  const [cur, setCur] = useState(() => new Date())
  const [mode, setMode] = useState<Mode>(() => (window.matchMedia('(max-width: 900px)').matches ? 'semana' : 'mes'))
  const [show, setShow] = useState({ post: true, prazo: true, evento: true })
  const [off, setOff] = useState<Channel[]>([])
  const [q, setQ] = useState('')
  const today = key(new Date())
  const [day, setDay] = useState(today)
  const [sel, setSel] = useState<string | null>(null)
  const [form, setForm] = useState<'post' | 'evento' | null>(null)

  const items = useMemo(() => {
    const out: Item[] = []
    for (const t of Object.values(tasks)) {
      if (t.status === 'declined') continue
      if (t.publish_at) out.push({ kind: 'post', t, day: localDay(t.publish_at) })
      else if (t.due && t.status !== 'done') out.push({ kind: 'prazo', t, day: t.due })
    }
    for (const e of Object.values(events)) out.push({ kind: 'evento', e, day: e.day })
    return out.sort((a, b) => a.day.localeCompare(b.day) || itemTime(a).localeCompare(itemTime(b)))
  }, [tasks, events])
  const vis = items.filter(i => show[i.kind] && (i.kind !== 'post' || !i.t.channel || !off.includes(i.t.channel)) && (!q || itemTitle(i).toLowerCase().includes(q.toLowerCase())))
  const byDay = (k: string) => vis.filter(i => i.day === k)
  const postN = items.filter(i => i.kind === 'post' && i.day.startsWith(key(cur).slice(0, 7))).length

  const move = (n: number) => {
    if (mode === 'semana') { const d = addD(new Date(day + 'T12:00'), n * 7); setDay(key(d)); setCur(d) }
    else setCur(c => new Date(c.getFullYear(), c.getMonth() + n, 1))
  }
  const label = mode === 'semana'
    ? (() => { const m = monday(new Date(day + 'T12:00')); const e = addD(m, 6); return `${m.getDate()}–${e.getDate()} ${e.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}` })()
    : cur.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).replace(' de ', ' ')
  const pick = (i: Item) => { setSel(itemId(i)); setDay(i.day) }
  const selItem = vis.find(i => itemId(i) === sel) ?? items.find(i => itemId(i) === sel)

  const chip = (i: Item) => {
    const cls = i.kind === 'evento' ? 'ev evt' : i.kind === 'prazo' ? 'ev due' : 'ev tag ' + (i.t.channel ? CHANNELS[i.t.channel].tag : 'gray')
    return (
      <button key={itemId(i)} className={cls + (sel === itemId(i) ? ' on' : '')} onClick={e => { e.stopPropagation(); pick(i) }} title={itemTitle(i)}>
        {i.kind === 'post' && i.t.channel && <Ph n={CHANNELS[i.t.channel].ic} size={12} />}
        {i.kind === 'evento' && <Ph n="star" size={12} fill />}
        {i.kind === 'prazo' && <Ph n="flag-banner" size={12} />}
        <span>{itemTime(i) && <em>{itemTime(i)}</em>}{itemTitle(i)}</span>
      </button>
    )
  }

  const month = () => {
    const start = monday(new Date(cur.getFullYear(), cur.getMonth(), 1))
    const last = new Date(cur.getFullYear(), cur.getMonth() + 1, 0)
    const n = Math.ceil(((last.getTime() - start.getTime()) / 864e5 + 1) / 7) * 7
    return (
      <div className="month">
        {WD.map(w => <div key={w} className="mwd">{w}</div>)}
        {Array.from({ length: n }, (_, k) => {
          const d = addD(start, k); const kd = key(d); const list = byDay(kd)
          return (
            <div key={kd} className={'mcell' + (d.getMonth() !== cur.getMonth() ? ' out' : '') + (kd === today ? ' today' : '') + (kd === day ? ' sel' : '')} onClick={() => { setDay(kd); setSel(null) }}>
              <span className="mnum">{d.getDate()}</span>
              {list.slice(0, 3).map(chip)}
              {list.length > 3 && <small className="more">+{list.length - 3}</small>}
            </div>
          )
        })}
      </div>
    )
  }

  const week = () => {
    const m = monday(new Date(day + 'T12:00'))
    const list = byDay(day)
    return (
      <div className="wk">
        <div className="week">
          {Array.from({ length: 7 }, (_, k) => {
            const d = addD(m, k); const kd = key(d); const n = byDay(kd).length
            return (
              <button key={kd} className={'wd' + (kd === day ? ' on' : '') + (kd === today ? ' today' : '')} onClick={() => { setDay(kd); setSel(null) }}>
                <small>{WD[k]}</small><b>{d.getDate()}</b>{n > 0 && <i className="dots">{Array.from({ length: Math.min(n, 3) }, (_, j) => <span key={j} />)}</i>}
              </button>
            )
          })}
        </div>
        <div className="tl">
          {list.length === 0 && <p className="qempty">Nada marcado para {longDay(day).toLowerCase()}.</p>}
          {list.map(i => (
            <button key={itemId(i)} className={'ti ' + i.kind + (sel === itemId(i) ? ' on' : '')} onClick={() => pick(i)}>
              <time>{itemTime(i) || (i.kind === 'prazo' ? 'prazo' : 'dia todo')}</time>
              <span className="tc">{chip(i)}{i.kind !== 'evento' && <small>{first(profiles[i.t.owner_id])} · {STATUS[i.t.status]?.label}</small>}</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  const list = () => {
    const ym = key(cur).slice(0, 7)
    const days = [...new Set(vis.filter(i => i.day.startsWith(ym)).map(i => i.day))]
    return (
      <div className="alist">
        {!days.length && <p className="qempty">Nada neste mês.</p>}
        {days.map(d => (
          <section key={d}><h4 className={d === today ? 'today' : ''}>{longDay(d)}</h4>{byDay(d).map(i => (
            <button key={itemId(i)} className={'post' + (sel === itemId(i) ? ' on' : '')} onClick={() => pick(i)}>
              <i className={'bar-l ' + (i.kind === 'post' && i.t.channel ? CHANNELS[i.t.channel].tag : i.kind)} />
              <div className="grow"><b>{itemTitle(i)}</b><small>{itemTime(i) || (i.kind === 'prazo' ? 'fim do dia' : 'dia todo')}{i.kind !== 'evento' && ` · ${first(profiles[i.t.owner_id])}`}</small></div>
              {i.kind !== 'evento' && <StatusTag t={i.t} />}
            </button>
          ))}</section>
        ))}
      </div>
    )
  }

  const others = byDay(day).filter(i => itemId(i) !== sel)
  return (
    <div className="qgrid agenda">
      <div className="quadro">
        <div className="qbar">
          <label className="qsearch"><Ph n="magnifying-glass" size={18} /><input type="search" placeholder="Buscar post, evento…" value={q} onChange={e => setQ(e.target.value)} /></label>
          <span className="grow" />
          <Bell />
          <button className="btn soft" onClick={() => setForm('evento')}><Ph n="star" size={18} />Evento</button>
          <button className="btn accent" onClick={() => setForm('post')}><Ph n="plus" size={18} fill />Novo post</button>
        </div>
        <div className="ag-head">
          <div><h1>Agenda</h1><div className="sub">Posts, prazos e eventos da equipe</div></div>
          <div className="mnav">
            <button onClick={() => move(-1)} aria-label="Anterior"><Ph n="caret-left" size={18} /></button>
            <span>{label[0].toUpperCase() + label.slice(1)}</span>
            <button onClick={() => move(1)} aria-label="Próximo"><Ph n="caret-right" size={18} /></button>
          </div>
          <button className="btn ghost sm" onClick={() => { setCur(new Date()); setDay(today) }}>Hoje</button>
          <span className="grow" />
          <div className="seg">
            {(['mes', 'semana', 'lista'] as Mode[]).map(m => <button key={m} className={mode === m ? 'on' : ''} onClick={() => setMode(m)}>{m === 'mes' ? 'Mês' : m === 'semana' ? 'Semana' : 'Lista'}</button>)}
          </div>
        </div>
        <div className="ag-filters">
          <button className={'qchip' + (show.post ? ' on' : '')} onClick={() => setShow(s => ({ ...s, post: !s.post }))}><Ph n="megaphone" size={15} />Posts<i>{postN}</i></button>
          <button className={'qchip' + (show.prazo ? ' on' : '')} onClick={() => setShow(s => ({ ...s, prazo: !s.prazo }))}><Ph n="flag-banner" size={15} />Prazos</button>
          <button className={'qchip' + (show.evento ? ' on' : '')} onClick={() => setShow(s => ({ ...s, evento: !s.evento }))}><Ph n="star" size={15} />Eventos</button>
          <span className="sep" />
          {CHANNEL_KEYS.map(c => (
            <button key={c} className={'tag ' + CHANNELS[c].tag + (off.includes(c) ? ' off' : '')} onClick={() => setOff(o => (o.includes(c) ? o.filter(x => x !== c) : [...o, c]))}>
              <Ph n={CHANNELS[c].ic} size={13} />{CHANNELS[c].label}
            </button>
          ))}
        </div>
        {mode === 'mes' ? month() : mode === 'semana' ? week() : list()}
      </div>

      <aside className="qside">
        {selItem && selItem.kind !== 'evento' ? <PostCard t={selItem.t} meId={meId} /> : selItem && selItem.kind === 'evento' ? (
          <div className="panel">
            <div className="eyebrow">{longDay(selItem.e.day)}{selItem.e.time ? ` · ${selItem.e.time}` : ''}</div>
            <h3 className="ev-title"><Ph n="star" size={18} fill />{selItem.e.title}</h3>
            <small className="muted">Evento criado por {first(profiles[selItem.e.created_by])}</small>
          </div>
        ) : (
          <div className="panel">
            <div className="eyebrow">{day === today ? 'Hoje' : longDay(day)}</div>
            <p className="muted small">{byDay(day).length ? 'Escolha um item para ver os detalhes.' : 'Nada marcado neste dia.'}</p>
            <div className="row gap"><button className="btn soft sm" onClick={() => setForm('post')}><Ph n="plus" size={14} />Post neste dia</button><button className="btn ghost sm" onClick={() => setForm('evento')}><Ph n="star" size={14} />Evento</button></div>
          </div>
        )}
        {others.length > 0 && (
          <div className="panel">
            <div className="eyebrow">{selItem ? `Também no dia ${Number(day.slice(8))}` : 'No dia'}</div>
            {others.map(i => (
              <button key={itemId(i)} className="post" onClick={() => pick(i)}>
                <i className={'bar-l ' + (i.kind === 'post' && i.t.channel ? CHANNELS[i.t.channel].tag : i.kind)} />
                <div className="grow"><b>{itemTitle(i)}</b><small>{itemTime(i) || (i.kind === 'prazo' ? 'fim do dia' : 'dia todo')}{i.kind !== 'evento' && ` · ${first(profiles[i.t.owner_id])}`}</small></div>
                {i.kind !== 'evento' && <StatusTag t={i.t} />}
              </button>
            ))}
          </div>
        )}
      </aside>
      {form === 'post' && <PostForm day={day} onClose={() => setForm(null)} onDone={id => { setSel(id) }} />}
      {form === 'evento' && <EventForm day={day} onClose={() => setForm(null)} />}
    </div>
  )
}

export function StatusTag({ t }: { t: Task }) {
  const s = STATUS[t.status]
  if (!s) return null
  return <span className={'tag ' + s.tag}><Ph n={s.ic} size={12} />{s.label}</span>
}

/** Cartão do post: canal, status, quem faz, quem aprova, aprovar/pedir ajuste, lembrete 1 dia antes. */
function PostCard({ t, meId }: { t: Task; meId: string }) {
  const profiles = useStore(s => s.profiles)
  const [fix, setFix] = useState<string | null>(null)
  const who = profiles[t.owner_id]
  const appr = approverOf(t)
  const ap = appr ? profiles[appr] : undefined
  const when = t.publish_at ? new Date(t.publish_at) : t.due ? new Date(t.due + 'T12:00') : null
  const ch = t.channel ? CHANNELS[t.channel] : null
  const dayBefore = t.publish_at ? new Date(new Date(t.publish_at).getTime() - 864e5).toISOString() : null
  const reminding = !!t.remind_at
  const can = canApprove(t, meId) && t.status === 'review'
  return (
    <div className="panel post-card">
      <div className="eyebrow">{when ? longDay(key(when)) : 'Sem data'}{t.publish_at ? ` · ${hm(t.publish_at)}` : ''}</div>
      <div className={'thumb ' + (ch?.tag ?? 'gray')}>
        <span className="fmt">{ch ? ch.label : 'Prazo'}{t.attachments.length ? ` · ${t.attachments.length} arquivo${t.attachments.length > 1 ? 's' : ''}` : ''}</span>
        <Ph n={ch?.ic ?? 'flag-banner'} size={40} />
      </div>
      <h3>{t.title}</h3>
      <div className="kv">
        <span>Canal</span><div>{ch ? <span className={'tag ' + ch.tag}><Ph n={ch.ic} size={12} />{ch.label}</span> : <span className="muted">—</span>}</div>
        <span>Status</span><div><StatusTag t={t} /></div>
        <span>Quem faz</span><div className="person"><MiniAvatar avatar={who?.avatar ?? null} photo={who?.photo ?? null} size={22} />{who?.name ?? '—'}</div>
        <span>Aprova</span><div className="person">{ap ? <><MiniAvatar avatar={ap.avatar} photo={ap.photo} size={22} />{ap.name}</> : <span className="muted">—</span>}</div>
        {t.attachments.length > 0 && <><span>Arquivos</span><div className="person"><Ph n="paperclip" size={14} />{t.attachments.length}</div></>}
      </div>
      {fix !== null ? (
        <form className="fixf" onSubmit={e => { e.preventDefault(); run(review(t.id, false, fix.trim())); setFix(null) }}>
          <textarea autoFocus rows={2} placeholder="O que precisa mudar?" value={fix} onChange={e => setFix(e.target.value)} maxLength={400} />
          <div className="row gap"><button className="btn primary sm" disabled={!fix.trim()}>Mandar ajuste</button><button type="button" className="btn ghost sm" onClick={() => setFix(null)}>Cancelar</button></div>
        </form>
      ) : (
        <div className="acts">
          {can && <button className="btn accent" onClick={() => run(review(t.id, true))}><Icon n="tick" />Aprovar</button>}
          {can && <button className="btn soft" onClick={() => setFix('')}>Pedir ajuste</button>}
          <button className={can ? 'btn ghost' : 'btn soft'} onClick={() => setUi({ task: t.id })}>Abrir cartão</button>
        </div>
      )}
      {dayBefore && t.status !== 'done' && (
        <button className="remind" onClick={() => run(updateTask(t.id, { remind_at: reminding ? null : dayBefore }))}>
          <Ph n="bell" size={18} /><div>Avisar {t.owner_id === meId ? 'você' : first(who)} <b>1 dia antes</b></div><span className={'toggle' + (reminding ? ' on' : '')} />
        </button>
      )}
    </div>
  )
}

function PostForm({ day, onClose, onDone }: { day: string; onClose: () => void; onDone: (id: string) => void }) {
  const profiles = useStore(s => s.profiles)
  const meId = useStore(s => s.meId)!
  const people = Object.values(profiles).filter(p => p.avatar)
  const [title, setTitle] = useState('')
  const [ch, setCh] = useState<Channel>('feed')
  const [d, setD] = useState(day)
  const [h, setH] = useState('12:00')
  const [owner, setOwner] = useState(meId)
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const at = new Date(`${d}T${h}`).toISOString()
    run(addTask(owner, `${CHANNELS[ch].label} · ${title.trim()}`, d, '', 'todo', (getState().project && getState().project !== '-' ? getState().project : null), { channel: ch, publish_at: at }).then(t => { if (t) onDone(t.id) }))
    onClose()
  }
  return (
    <div className="modal-bg" onMouseDown={e => e.target === e.currentTarget && onClose()} onKeyDown={e => e.key === 'Escape' && onClose()}>
      <form className="modal" onSubmit={submit}>
        <h2>Novo post</h2>
        <label>Assunto<input autoFocus required maxLength={120} value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex.: Promo Day Use" /></label>
        <div className="opts">
          {CHANNEL_KEYS.map(c => <button type="button" key={c} className={'tag ' + CHANNELS[c].tag + (ch === c ? ' on' : ' off')} onClick={() => setCh(c)}><Ph n={CHANNELS[c].ic} size={13} />{CHANNELS[c].label}</button>)}
        </div>
        <div className="row gap"><label className="grow">Dia<input type="date" required value={d} onChange={e => setD(e.target.value)} /></label><label>Hora<input type="time" required value={h} onChange={e => setH(e.target.value)} /></label></div>
        <label>Quem faz
          <select value={owner} onChange={e => setOwner(e.target.value)}>{people.map(p => <option key={p.id} value={p.id}>{p.id === meId ? `${p.name} (você)` : p.name}</option>)}</select>
        </label>
        <footer className="row gap end"><button type="button" className="btn ghost" onClick={onClose}>Cancelar</button><button className="btn primary" disabled={!title.trim()}>Agendar post</button></footer>
      </form>
    </div>
  )
}

function EventForm({ day, onClose }: { day: string; onClose: () => void }) {
  const meId = useStore(s => s.meId)!
  const [title, setTitle] = useState('')
  const [d, setD] = useState(day)
  const [h, setH] = useState('')
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    run(putRow('events', { id: crypto.randomUUID(), title: title.trim(), day: d, time: h || null, created_by: meId, created_at: new Date().toISOString() }))
    onClose()
  }
  return (
    <div className="modal-bg" onMouseDown={e => e.target === e.currentTarget && onClose()} onKeyDown={e => e.key === 'Escape' && onClose()}>
      <form className="modal" onSubmit={submit}>
        <h2>Novo evento</h2>
        <label>Nome<input autoFocus required maxLength={120} value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex.: Reunião de pauta" /></label>
        <div className="row gap"><label className="grow">Dia<input type="date" required value={d} onChange={e => setD(e.target.value)} /></label><label>Hora (opcional)<input type="time" value={h} onChange={e => setH(e.target.value)} /></label></div>
        <footer className="row gap end"><button type="button" className="btn ghost" onClick={onClose}>Cancelar</button><button className="btn primary" disabled={!title.trim()}>Salvar</button></footer>
      </form>
    </div>
  )
}
