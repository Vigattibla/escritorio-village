import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { canAssign, rankName, rankOf } from '../game/ranks'
import { dayKey } from '../game/xp'
import {
  acceptRequest, addTask, canEditTask, canMove, canReassign, declineRequest, involved, placeTask, reassign, run, setStatus, setUi, useStore,
} from '../store'
import type { Profile, Task, TaskStatus } from '../types'
import MiniAvatar from './MiniAvatar'

type Group = 'etapa' | 'pessoa'
type Due = '' | 'late' | 'today' | 'week' | 'none'

interface List { key: string; title: string; hint?: string; head?: ReactNode; cards: Task[]; status?: TaskStatus; owner?: string; canAdd: boolean }

const STAGES: { id: TaskStatus; label: string; hint?: string }[] = [
  { id: 'inbox', label: 'Pedidos', hint: 'Esperando a pessoa aceitar' },
  { id: 'todo', label: 'A fazer' },
  { id: 'doing', label: 'Fazendo' },
  { id: 'done', label: 'Feito', hint: 'Últimos 7 dias' },
]
const STAGE_LABEL: Record<TaskStatus, string> = { inbox: 'Pedido', todo: 'A fazer', doing: 'Fazendo', done: 'Feito', declined: 'Recusado' }
const STAGE_ORDER: Record<TaskStatus, number> = { doing: 0, todo: 1, inbox: 2, done: 3, declined: 4 }
const DONE_DAYS = 7

function load<T>(k: string, def: T): T {
  try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : def } catch { return def }
}
function save(k: string, v: unknown) {
  try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* sem armazenamento */ }
}
const addDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return dayKey(d) }
const shortDate = (d: string) => new Date(d + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')
const first = (p: Profile | undefined) => p?.name.split(' ')[0] ?? 'Alguém'
const byPos = (a: Task, b: Task) => a.position - b.position
const byDone = (a: Task, b: Task) => (b.done_at ?? '').localeCompare(a.done_at ?? '')
const byStage = (a: Task, b: Task) => STAGE_ORDER[a.status] - STAGE_ORDER[b.status] || byPos(a, b)

/** Índice onde o cartão vai cair, pela altura do mouse sobre os outros cartões da lista. */
function dropIndex(e: React.DragEvent, list: HTMLElement) {
  const cards = [...list.querySelectorAll<HTMLElement>('.tcard:not(.dragging)')]
  const i = cards.findIndex(c => { const r = c.getBoundingClientRect(); return e.clientY < r.top + r.height / 2 })
  return i < 0 ? cards.length : i
}

/** Quadro estilo Trello: listas por etapa ou por pessoa, arrastar para mover, adicionar rápido no fim da lista. */
export default function Quadro() {
  const meId = useStore(s => s.meId)!
  const profiles = useStore(s => s.profiles)
  const tasksMap = useStore(s => s.tasks)
  const notes = useStore(s => s.notes)
  const online = useStore(s => s.online)
  const [group, setGroup] = useState<Group>(() => load('ev:q:group', 'etapa'))
  const [mine, setMine] = useState<boolean>(() => load('ev:q:mine', false))
  const [who, setWho] = useState<string[]>([])
  const [due, setDue] = useState<Due>('')
  const [q, setQ] = useState('')
  const [drag, setDrag] = useState<string | null>(null)
  const [over, setOver] = useState<{ list: string; index: number } | null>(null)
  const [adding, setAdding] = useState<string | null>(null)
  const search = useRef<HTMLInputElement>(null)

  useEffect(() => save('ev:q:group', group), [group])
  useEffect(() => save('ev:q:mine', mine), [mine])
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (e.ctrlKey || e.metaKey || e.altKey || el.closest?.('input, textarea, select, [contenteditable]') || document.querySelector('.modal-bg, .overlay')) return
      if (e.key === '/') { e.preventDefault(); search.current?.focus() }
      else if (e.key === 'q') setMine(v => !v)
      else if (e.key === 'n') { e.preventDefault(); setAdding(group === 'etapa' ? 'todo' : meId) }
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [group, meId])

  const noteCount = useMemo(() => {
    const m: Record<string, number> = {}
    for (const n of notes) m[n.task_id] = (m[n.task_id] ?? 0) + 1
    return m
  }, [notes])

  const people = Object.values(profiles).sort((a, b) =>
    a.id === meId ? -1 : b.id === meId ? 1 : rankOf(b) - rankOf(a) || a.name.localeCompare(b.name))
  const today = dayKey(new Date())
  const week = addDays(7)
  const since = addDays(-DONE_DAYS)
  const term = q.trim().toLowerCase()
  const filtered = mine || who.length > 0 || !!due || !!term

  const shown = Object.values(tasksMap).filter(t => {
    if (t.status === 'declined') return false
    if (t.status === 'done' && (!t.done_at || dayKey(t.done_at) < since)) return false
    if (mine && !involved(t, meId)) return false
    if (who.length && !who.some(id => t.owner_id === id || t.collaborators.includes(id))) return false
    if (term && !`${t.title} ${t.notes}`.toLowerCase().includes(term)) return false
    if (due === 'none') return !t.due
    if (due) {
      if (!t.due || t.status === 'done') return false
      if (due === 'late') return t.due < today
      if (due === 'today') return t.due === today
      return t.due <= week
    }
    return true
  })

  const lists: List[] = group === 'etapa'
    ? STAGES.map(s => ({
        key: s.id, title: s.label, hint: s.hint, status: s.id, canAdd: s.id !== 'done',
        cards: shown.filter(t => t.status === s.id).sort(s.id === 'done' ? byDone : byPos),
      }))
    : people
        .filter(p => !who.length || who.includes(p.id))
        .map(p => ({
          key: p.id, owner: p.id, title: p.id === meId ? `${p.name} (você)` : p.name, hint: p.role || rankName(p), canAdd: true,
          head: <span className="qhead-av"><MiniAvatar avatar={p.avatar} photo={p.photo} size={28} dim={!online.has(p.id)} />{online.has(p.id) && <i />}</span>,
          cards: shown.filter(t => t.owner_id === p.id && (t.status !== 'done' || dayKey(t.done_at!) === today)).sort(byStage),
        }))
        .filter(l => l.owner === meId || !(mine || term || due) || l.cards.length > 0)

  const dragged = drag ? tasksMap[drag] : undefined
  const accepts = (l: List) => {
    const t = dragged
    if (!t) return false
    if (l.owner) return t.owner_id === l.owner || canReassign(t, l.owner)
    if (l.status === t.status) return l.status !== 'done' && canEditTask(t)
    return l.status !== 'inbox' && canMove(t)
  }
  /** posição entre os vizinhos (sem contar o próprio cartão arrastado) */
  const posAt = (cards: Task[], index: number) => {
    const rest = cards.filter(c => c.id !== drag)
    const before = rest[index - 1]?.position, after = rest[index]?.position
    if (before === undefined && after === undefined) return Date.now()
    if (before === undefined) return after! - 1000
    if (after === undefined) return Math.max(before + 1000, Date.now())
    return (before + after) / 2
  }
  const drop = (l: List, index: number) => {
    const t = dragged
    setDrag(null); setOver(null)
    if (!t || !accepts(l)) return
    if (l.owner) { if (t.owner_id !== l.owner) run(reassign(t.id, l.owner)); return }
    const pos = posAt(l.cards, index)
    if (t.status !== l.status) run(setStatus(t.id, l.status!, pos))
    else run(placeTask(t.id, pos))
  }
  const toggleWho = (id: string) => setWho(w => (w.includes(id) ? w.filter(x => x !== id) : [...w, id]))
  const clear = () => { setMine(false); setWho([]); setDue(''); setQ('') }

  return (
    <div className="quadro">
      <div className="qbar">
        <div className="qseg" role="tablist" aria-label="Agrupar por">
          <button className={group === 'etapa' ? 'on' : ''} onClick={() => setGroup('etapa')}>Etapas</button>
          <button className={group === 'pessoa' ? 'on' : ''} onClick={() => setGroup('pessoa')}>Pessoas</button>
        </div>
        <input
          ref={search} className="qsearch" type="search" placeholder="Buscar cartões   /" value={q}
          onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setQ(''); e.currentTarget.blur() } }}
        />
        <div className="qwho" aria-label="Filtrar por pessoa">
          {people.map(p => (
            <button key={p.id} className={who.includes(p.id) ? 'on' : ''} onClick={() => toggleWho(p.id)} title={`Só de ${p.name}`}>
              <MiniAvatar avatar={p.avatar} photo={p.photo} size={26} />
            </button>
          ))}
        </div>
        <button className={'qchip' + (mine ? ' on' : '')} onClick={() => setMine(v => !v)} title="Só as que tenho ou participo (atalho Q)">Só minhas</button>
        <select className={'qchip' + (due ? ' on' : '')} value={due} onChange={e => setDue(e.target.value as Due)} aria-label="Prazo">
          <option value="">Prazo: todos</option>
          <option value="late">Atrasadas</option>
          <option value="today">Vencem hoje</option>
          <option value="week">Até 7 dias</option>
          <option value="none">Sem prazo</option>
        </select>
        {filtered && <button className="qclear" onClick={clear}>Limpar filtros</button>}
        <span className="grow" />
        <button className="btn primary sm" onClick={() => setAdding(group === 'etapa' ? 'todo' : meId)} title="Atalho N">+ Nova tarefa</button>
      </div>

      <div className="qlists">
        {lists.map(l => {
          const ok = !!drag && accepts(l)
          const at = over?.list === l.key ? over.index : -1
          return (
            <section
              key={l.key}
              className={'qlist' + (at >= 0 ? ' over' : '') + (drag && !ok ? ' no' : '')}
              onDragOver={e => {
                if (!ok) return
                e.preventDefault()
                const i = l.owner ? 0 : dropIndex(e, e.currentTarget)
                if (at !== i) setOver({ list: l.key, index: i })
              }}
              onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null) }}
              onDrop={e => { e.preventDefault(); drop(l, dropIndex(e, e.currentTarget)) }}
            >
              <header className="qlist-head">
                {l.head}
                <div className="grow"><b>{l.title}</b>{l.hint && <small>{l.hint}</small>}</div>
                <span className="qcount">{l.cards.length}</span>
              </header>
              <div className="qcards">
                {l.cards.map((t, i) => (
                  <Card
                    key={t.id} t={t} byStage={group === 'pessoa'} meId={meId} profiles={profiles} notes={noteCount[t.id] ?? 0}
                    dragging={drag === t.id} onDrag={setDrag} drop={!l.owner && at === i && drag !== t.id}
                  />
                ))}
                {!l.owner && at === l.cards.filter(c => c.id !== drag).length && <div className="tdrop" />}
                {!l.cards.length && adding !== l.key && <p className="qempty">{l.status === 'inbox' ? 'Nenhum pedido esperando.' : 'Nada aqui.'}</p>}
              </div>
              {l.canAdd && (adding === l.key
                ? <Composer list={l} meId={meId} profiles={profiles} people={people} onClose={() => setAdding(null)} />
                : <button className="qadd" onClick={() => setAdding(l.key)}>+ {l.status === 'inbox' ? 'Pedir a alguém' : 'Adicionar cartão'}</button>)}
            </section>
          )
        })}
      </div>
    </div>
  )
}

function Card({ t, byStage, meId, profiles, notes, dragging, onDrag, drop }: {
  t: Task; byStage: boolean; meId: string; profiles: Record<string, Profile>; notes: number
  dragging: boolean; onDrag: (id: string | null) => void; drop: boolean
}) {
  const today = dayKey(new Date())
  const done = t.status === 'done'
  const dueCls = done ? 'ok' : !t.due ? '' : t.due < today ? 'late' : t.due <= addDays(1) ? 'soon' : ''
  const dueTip = done ? 'Concluída' : t.due && t.due < today ? 'Atrasada' : t.due === today ? 'Vence hoje' : 'Prazo'
  const req = t.created_by !== t.owner_id
  const ownReq = t.status === 'inbox' && t.owner_id === meId
  const crew = [t.owner_id, ...t.collaborators]
  const open = () => setUi({ task: t.id })
  const stop = (f: () => void) => (e: React.MouseEvent) => { e.stopPropagation(); f() }

  return (
    <>
      {drop && <div className="tdrop" />}
      <article
        className={'tcard' + (dragging ? ' dragging' : '') + (done ? ' done' : '')}
        draggable={canEditTask(t)}
        onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', t.id); onDrag(t.id) }}
        onDragEnd={() => onDrag(null)}
        onClick={open}
        onKeyDown={e => e.key === 'Enter' && open()}
        tabIndex={0}
      >
        {byStage && <span className={'tc-stage ' + t.status}>{STAGE_LABEL[t.status]}</span>}
        <div className="tc-title">{t.title}</div>
        <div className="tc-meta">
          {(t.due || done) && <span className={'tc-due ' + dueCls} title={dueTip}>{done ? '✓' : '🕑'} {t.due ? shortDate(t.due) : 'Feito'}</span>}
          {t.notes.trim() && <span title="Tem descrição">☰</span>}
          {notes > 0 && <span title="Comentários">💬 {notes}</span>}
          {t.attachments.length > 0 && <span title="Anexos">📎 {t.attachments.length}</span>}
          {req && <span className="tc-from" title={`Pedido por ${profiles[t.created_by]?.name ?? 'alguém'}`}>↩ {t.created_by === meId ? 'você' : first(profiles[t.created_by])}</span>}
          <span className="grow" />
          <span className="tc-crew">
            {crew.slice(0, 3).map(id => (
              <span key={id} title={profiles[id]?.name + (id === t.owner_id ? ' · responsável' : ' · colabora')}>
                <MiniAvatar avatar={profiles[id]?.avatar ?? null} photo={profiles[id]?.photo ?? null} size={24} />
              </span>
            ))}
            {crew.length > 3 && <b>+{crew.length - 3}</b>}
          </span>
        </div>
        {ownReq && (
          <div className="tc-ask">
            <button className="btn primary sm" onClick={stop(() => run(acceptRequest(t.id)))}>Aceitar</button>
            <button className="btn ghost sm" onClick={stop(() => run(declineRequest(t.id)))}>Recusar</button>
          </div>
        )}
        {!done && t.status !== 'inbox' && canMove(t) && (
          <button className="tc-check" onClick={stop(() => run(setStatus(t.id, 'done')))} title="Concluir" aria-label="Concluir">✓</button>
        )}
      </article>
    </>
  )
}

function Composer({ list, meId, profiles, people, onClose }: {
  list: List; meId: string; profiles: Record<string, Profile>; people: Profile[]; onClose: () => void
}) {
  const ask = list.status === 'inbox'
  const [title, setTitle] = useState('')
  const [owner, setOwner] = useState(list.owner ?? (ask ? '' : meId))
  const [due, setDue] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => ref.current?.focus(), [])
  const asRequest = !!owner && (ask || !canAssign(profiles[meId], profiles[owner]))
  const submit = () => {
    const name = title.trim()
    if (!name || !owner) return
    run(addTask(owner, name, due || null, '', list.status ?? 'todo'))
    setTitle('')
    ref.current?.focus()
  }

  return (
    <form className="composer" onSubmit={e => { e.preventDefault(); submit() }} onKeyDown={e => e.key === 'Escape' && onClose()}>
      <textarea
        ref={ref} rows={2} maxLength={200} placeholder="O que precisa ser feito?" value={title}
        onChange={e => setTitle(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }}
      />
      <div className="composer-opts">
        {!list.owner && (
          <select value={owner} onChange={e => setOwner(e.target.value)} aria-label="Responsável" required>
            {ask && <option value="">Pedir para…</option>}
            {people.filter(p => !ask || p.id !== meId).map(p => <option key={p.id} value={p.id}>{p.id === meId ? 'Eu' : p.name}</option>)}
          </select>
        )}
        <input type="date" value={due} min={dayKey(new Date())} onChange={e => setDue(e.target.value)} aria-label="Prazo" title="Prazo" />
      </div>
      {asRequest && <small className="muted">Vai como pedido: {first(profiles[owner])} precisa aceitar.</small>}
      <div className="row gap">
        <button className="btn primary sm" disabled={!title.trim() || !owner}>Adicionar</button>
        <button type="button" className="btn ghost sm" onClick={onClose} aria-label="Fechar">✕</button>
        <small className="muted grow right">Enter adiciona · Esc fecha</small>
      </div>
    </form>
  )
}
