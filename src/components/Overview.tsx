import { useState } from 'react'
import { rankName } from '../game/ranks'
import { dayKey } from '../game/xp'
import { setUi, useStore } from '../store'
import type { Task } from '../types'
import MiniAvatar from './MiniAvatar'

type Filter = 'abertas' | 'doing' | 'todo' | 'late' | 'inbox' | 'done'
const LABEL: Record<Filter, string> = { abertas: 'Tudo em aberto', doing: 'Fazendo agora', todo: 'A fazer', late: 'Atrasadas', inbox: 'Pedidos esperando', done: 'Feitas hoje' }
const ST: Record<Task['status'], string> = { inbox: 'aguardando', todo: 'a fazer', doing: 'fazendo', done: 'feita', declined: 'recusada' }
const OPEN = new Set<Task['status']>(['inbox', 'todo', 'doing'])

/** Só o Chefe vê: o que o time inteiro está fazendo. */
export default function Overview() {
  const profiles = useStore(s => s.profiles)
  const tasksMap = useStore(s => s.tasks)
  const online = useStore(s => s.online)
  const notes = useStore(s => s.notes)
  const [f, setF] = useState<Filter>('abertas')
  const [who, setWho] = useState('')
  const today = dayKey(new Date())
  const tasks = Object.values(tasksMap)
  const late = (t: Task) => OPEN.has(t.status) && !!t.due && t.due < today
  const doneToday = (t: Task) => t.status === 'done' && !!t.done_at && dayKey(t.done_at) === today
  const test: Record<Filter, (t: Task) => boolean> = {
    abertas: t => OPEN.has(t.status), doing: t => t.status === 'doing', todo: t => t.status === 'todo',
    late, inbox: t => t.status === 'inbox', done: doneToday,
  }
  const people = Object.values(profiles).sort((a, b) => b.rank - a.rank || a.name.localeCompare(b.name))
  const list = tasks
    .filter(t => test[f](t) && (!who || t.owner_id === who || t.collaborators.includes(who)))
    .sort((a, b) => Number(late(b)) - Number(late(a)) || (a.due ?? '9').localeCompare(b.due ?? '9') || b.position - a.position)
  const nNotes = (id: string) => notes.filter(n => n.task_id === id).length
  const date = (d: string) => new Date(d + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

  return (
    <div className="overview">
      <div className="ov-stats">
        {(['doing', 'todo', 'late', 'inbox', 'done'] as Filter[]).map(k => (
          <button key={k} className={'ov-stat ' + k + (f === k ? ' on' : '')} onClick={() => setF(f === k ? 'abertas' : k)}>
            <b>{tasks.filter(test[k]).length}</b><span>{LABEL[k]}</span>
          </button>
        ))}
      </div>

      <section>
        <h3>Time agora</h3>
        {people.map(p => {
          const mine = tasks.filter(t => t.owner_id === p.id)
          const doing = mine.filter(t => t.status === 'doing')
          const here = online.has(p.id)
          return (
            <button key={p.id} className={'ov-person' + (who === p.id ? ' on' : '')} onClick={() => setWho(who === p.id ? '' : p.id)} title="Filtrar a lista por essa pessoa">
              <span className="av"><MiniAvatar avatar={p.avatar} photo={p.photo} size={34} /><i className={here ? 'on' : ''} /></span>
              <span className="grow">
                <b>{p.name}</b> <small className="muted">{p.role || rankName(p)}</small>
                <span className="now">{doing.length ? '▶ ' + doing.map(t => t.title).join(' · ') : <em>nada em andamento</em>}</span>
              </span>
              <span className="nums">
                <span title="A fazer">📋 {mine.filter(t => t.status === 'todo').length}</span>
                {mine.some(late) && <span className="late" title="Atrasadas">⏰ {mine.filter(late).length}</span>}
                <span title="Feitas hoje">✅ {mine.filter(doneToday).length}</span>
              </span>
            </button>
          )
        })}
      </section>

      <section>
        <div className="row gap">
          <h3 className="grow">{LABEL[f]}{who && ` · ${profiles[who]?.name}`} <span className="count">{list.length}</span></h3>
          {(who || f !== 'abertas') && <button className="btn ghost sm" onClick={() => { setWho(''); setF('abertas') }}>Limpar filtro</button>}
        </div>
        {list.length === 0 && <p className="empty">Nada por aqui.</p>}
        {list.map(t => (
          <button key={t.id} className={'ov-task' + (late(t) ? ' late' : '')} onClick={() => setUi({ task: t.id })}>
            <MiniAvatar avatar={profiles[t.owner_id]?.avatar ?? null} photo={profiles[t.owner_id]?.photo ?? null} size={26} />
            <span className="grow">
              <span className="title">{t.title}</span>
              <span className="meta">
                <span className={'chip st ' + t.status}>{ST[t.status]}</span>
                <span className="chip">{profiles[t.owner_id]?.name ?? '?'}</span>
                {t.due && <span className={'chip due' + (late(t) ? ' late' : t.due === today ? ' today' : '')}>📅 {date(t.due)}</span>}
                {t.collaborators.length > 0 && <span className="chip">🤝 {t.collaborators.length}</span>}
                {t.attachments.length > 0 && <span className="chip">📎 {t.attachments.length}</span>}
                {nNotes(t.id) > 0 && <span className="chip">💬 {nNotes(t.id)}</span>}
              </span>
            </span>
          </button>
        ))}
      </section>
    </div>
  )
}
