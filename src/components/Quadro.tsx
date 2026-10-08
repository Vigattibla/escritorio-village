import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { canAssign, rankName, rankOf } from '../game/ranks'
import { dayKey } from '../game/xp'
import {
  acceptRequest, addTask, canUseAI, approverOf, canApprove, canCreateProject, canEditProject, canEditTask, canMove, canReassign, declineRequest, involved,
  placeTask, reassign, run, setStatus, setUi, teamOf, toApprove, useStore,
} from '../store'
import type { Priority, Profile, Project, Task, TaskStatus } from '../types'
import { Bell } from './Avisos'
import Icon, { Ph } from './Icon'
import MiniAvatar from './MiniAvatar'

type Group = 'etapa' | 'raias' | 'pessoa'
type Due = '' | 'late' | 'today' | 'week' | 'none'

interface List { key: string; title: string; hint?: string; head?: ReactNode; cards: Task[]; status?: TaskStatus; owner?: string; canAdd: boolean }

export const STAGES: { id: TaskStatus; label: string; hint?: string }[] = [
  { id: 'inbox', label: 'Pedidos', hint: 'Esperando a pessoa aceitar' },
  { id: 'todo', label: 'A fazer' },
  { id: 'doing', label: 'Fazendo' },
  { id: 'review', label: 'Aprovação', hint: 'Esperando o mestre do projeto' },
  { id: 'done', label: 'Feito', hint: 'Últimos 7 dias' },
]
const STAGE_LABEL: Record<TaskStatus, string> = { inbox: 'Pedido', todo: 'A fazer', doing: 'Fazendo', review: 'Em aprovação', done: 'Feito', declined: 'Recusado' }
const STAGE_ORDER: Record<TaskStatus, number> = { doing: 0, review: 1, todo: 2, inbox: 3, done: 4, declined: 5 }
const DONE_DAYS = 7
/** filtro de projeto: '' todos · '-' sem projeto · id */
const NONE = '-'

function load<T>(k: string, def: T): T {
  try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : def } catch { return def }
}
function save(k: string, v: unknown) {
  try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* sem armazenamento */ }
}
const addDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return dayKey(d) }
const shortDate = (d: string) => new Date(d + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')
/** semana corrente, segunda a domingo: "5–11 out" */
function weekLabel() {
  const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  const e = new Date(d); e.setDate(d.getDate() + 6)
  const m = (x: Date) => x.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')
  return d.getMonth() === e.getMonth() ? `${d.getDate()}–${e.getDate()} ${m(e)}` : `${d.getDate()} ${m(d)} – ${e.getDate()} ${m(e)}`
}
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

/** Quadro estilo Trello: etapas, raias (pessoa × etapa) ou pessoas; arrastar para mover; filtro por projeto. */
export default function Quadro() {
  const meId = useStore(s => s.meId)!
  const profiles = useStore(s => s.profiles)
  const tasksMap = useStore(s => s.tasks)
  const projects = useStore(s => s.projects)
  const project = useStore(s => s.project)
  const notes = useStore(s => s.notes)
  const online = useStore(s => s.online)
  const qApprove = useStore(s => s.qApprove)
  const apprN = useStore(s => toApprove(s).length)
  const [group, setGroup] = useState<Group>(() => load('ev:q:group', 'etapa'))
  const [mine, setMine] = useState<boolean>(() => load('ev:q:mine', false))
  const [who, setWho] = useState<string[]>([])
  const [due, setDue] = useState<Due>('')
  const [q, setQ] = useState('')
  const [drag, setDrag] = useState<string | null>(null)
  const [over, setOver] = useState<{ list: string; index: number } | null>(null)
  const [adding, setAdding] = useState<string | null>(null)
  const [extra, setExtra] = useState<string[]>([])
  const search = useRef<HTMLInputElement>(null)
  const proj = project && project !== NONE ? projects[project] : undefined
  const defAdd = group === 'etapa' ? 'todo' : group === 'raias' ? `${meId}:todo` : meId

  useEffect(() => save('ev:q:group', group), [group])
  useEffect(() => save('ev:q:mine', mine), [mine])
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (e.ctrlKey || e.metaKey || e.altKey || el.closest?.('input, textarea, select, [contenteditable]') || document.querySelector('.modal-bg, .overlay')) return
      if (e.key === '/') { e.preventDefault(); search.current?.focus() }
      else if (e.key === 'q') setMine(v => !v)
      else if (e.key === 'n') { e.preventDefault(); setAdding(defAdd) }
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [defAdd])

  const noteCount = useMemo(() => {
    const m: Record<string, number> = {}
    for (const n of notes) m[n.task_id] = (m[n.task_id] ?? 0) + 1
    return m
  }, [notes])

  const team = proj ? teamOf(proj.id) : null
  const everyone = Object.values(profiles)
    .sort((a, b) => a.id === meId ? -1 : b.id === meId ? 1 : rankOf(b) - rankOf(a) || a.name.localeCompare(b.name))
  // com projeto aberto: só quem está no time (mestre, donos, ajudantes) + quem eu acabei de colocar
  const people = everyone.filter(p => !team || team.has(p.id) || p.id === meId || extra.includes(p.id))
  const outside = team ? everyone.filter(p => !people.includes(p)) : []
  const today = dayKey(new Date())
  const week = addDays(7)
  const since = addDays(-DONE_DAYS)
  const term = q.trim().toLowerCase()
  const filtered = mine || qApprove || who.length > 0 || !!due || !!term
  const projList = Object.values(projects).filter(p => !p.archived || p.id === project).sort((a, b) => a.name.localeCompare(b.name))

  const shown = Object.values(tasksMap).filter(t => {
    if (t.status === 'declined') return false
    if (t.status === 'done' && (!t.done_at || dayKey(t.done_at) < since)) return false
    if (project === NONE ? !!t.project_id : project && t.project_id !== project) return false
    if (mine && !involved(t, meId)) return false
    if (qApprove && !(t.status === 'review' && canApprove(t))) return false
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
  // números do topo: respeitam o projeto aberto, não os outros filtros
  const inProj = Object.values(tasksMap).filter(t => t.status !== 'declined' && (project === NONE ? !t.project_id : !project || t.project_id === project))
  const open = inProj.filter(t => t.status !== 'done')
  const lateN = open.filter(t => t.due && t.due < today).length
  const weekDone = inProj.filter(t => t.status === 'done' && t.done_at && dayKey(t.done_at) >= since).length
  const sortFor = (st: TaskStatus) => (st === 'done' ? byDone : byPos)
  const lanePeople = people.filter(p => !who.length || who.includes(p.id))
  const personHead = (p: Profile, size = 28) => (
    <span className="qhead-av"><MiniAvatar avatar={p.avatar} photo={p.photo} size={size} dim={!online.has(p.id)} />{online.has(p.id) && <i />}</span>
  )

  const lists: List[] = group === 'etapa'
    ? STAGES.map(s => ({
        key: s.id, title: s.label, hint: s.hint, status: s.id, canAdd: s.id === 'todo' || s.id === 'doing',
        head: <span className="qdot" />,
        cards: shown.filter(t => t.status === s.id).sort(sortFor(s.id)),
      }))
    : group === 'pessoa'
      ? lanePeople
          .map(p => ({
            key: p.id, owner: p.id, title: p.id === meId ? `${p.name} (você)` : p.name, hint: p.role || rankName(p), canAdd: true,
            head: personHead(p),
            cards: shown.filter(t => t.owner_id === p.id && (t.status !== 'done' || dayKey(t.done_at!) === today)).sort(byStage),
          }))
          .filter(l => l.owner === meId || !(mine || term || due) || l.cards.length > 0)
      : []

  // raias: uma linha por pessoa, uma coluna por etapa
  const lanes = group !== 'raias' ? [] : lanePeople
    .map(p => ({
      p,
      cells: STAGES.map<List>(s => ({
        key: `${p.id}:${s.id}`, title: s.label, owner: p.id, status: s.id, canAdd: s.id === 'todo',
        cards: shown.filter(t => t.owner_id === p.id && t.status === s.id).sort(sortFor(s.id)),
      })),
    }))
    .filter(l => l.p.id === meId || extra.includes(l.p.id) || !(mine || term || due || proj) || l.cells.some(c => c.cards.length > 0))

  const dragged = drag ? tasksMap[drag] : undefined
  /** a etapa aceita o cartão? (aprovação só com aprovador; sair da aprovação: dono retira, aprovador aprova) */
  const stageOk = (t: Task, st: TaskStatus) => {
    if (st === t.status) return st !== 'done' && canEditTask(t)
    if (st === 'inbox') return false
    if (t.status === 'review') return st === 'done' ? canApprove(t) : t.owner_id === meId
    if (st === 'review') return !!approverOf(t) && canMove(t)
    return canMove(t)
  }
  const accepts = (l: List) => {
    const t = dragged
    if (!t) return false
    if (l.owner && t.owner_id !== l.owner && !canReassign(t, l.owner)) return false
    return l.status ? stageOk(t, l.status) : !!l.owner
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
    const pos = l.status ? posAt(l.cards, index) : Date.now()
    run((async () => {
      if (l.owner && t.owner_id !== l.owner) await reassign(t.id, l.owner, pos)
      if (l.status && t.status !== l.status) await setStatus(t.id, l.status, pos)
      else if (l.status && (!l.owner || t.owner_id === l.owner)) await placeTask(t.id, pos)
    })())
  }
  const toggleWho = (id: string) => setWho(w => (w.includes(id) ? w.filter(x => x !== id) : [...w, id]))
  const clear = () => { setMine(false); setWho([]); setDue(''); setQ(''); setUi({ qApprove: false }) }

  /** área que recebe cartões (coluna inteira ou célula da raia) */
  const zone = (l: List, cls: string, header?: ReactNode) => {
    const ok = !!drag && accepts(l)
    const at = over?.list === l.key ? over.index : -1
    const ordered = !!l.status
    return (
      <section
        key={l.key}
        className={cls + (l.status ? ' st-' + l.status : '') + (at >= 0 ? ' over' : '') + (drag && !ok ? ' no' : '')}
        onDragOver={e => {
          if (!ok) return
          e.preventDefault()
          const i = ordered ? dropIndex(e, e.currentTarget) : 0
          if (at !== i) setOver({ list: l.key, index: i })
        }}
        onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null) }}
        onDrop={e => { e.preventDefault(); drop(l, dropIndex(e, e.currentTarget)) }}
      >
        {header}
        <div className="qcards">
          {l.cards.map((t, i) => (
            <Card
              key={t.id} t={t} mode={group} meId={meId} profiles={profiles} projects={projects} showProj={!proj} notes={noteCount[t.id] ?? 0}
              dragging={drag === t.id} onDrag={setDrag} drop={ordered && at === i && drag !== t.id}
            />
          ))}
          {ordered && at === l.cards.filter(c => c.id !== drag).length && <div className="tdrop" />}
          {!l.cards.length && adding !== l.key && group !== 'raias' && <p className="qempty">{l.status === 'inbox' ? 'Nenhum pedido esperando.' : l.status === 'review' ? 'Nada esperando aprovação.' : 'Nada aqui.'}</p>}
        </div>
        {l.canAdd && (adding === l.key
          ? <Composer list={l} meId={meId} profiles={profiles} people={everyone} project={proj?.id ?? null} onClose={() => setAdding(null)} />
          : <button className="qadd" onClick={() => setAdding(l.key)}><Icon n="plus" size={15} />Nova tarefa</button>)}
      </section>
    )
  }

  return (
    <div className="quadro">
      <div className="qbar">
        <label className="qsearch">
          <Ph n="magnifying-glass" size={18} />
          <input
            ref={search} type="search" placeholder="Buscar tarefa…" value={q} aria-label="Buscar cartões (atalho /)"
            onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setQ(''); e.currentTarget.blur() } }}
          />
          <kbd>/</kbd>
        </label>
        <span className="grow" />
        {canUseAI() && <button className="btn soft" onClick={() => setUi({ aiOpen: true })} title="O Claude propõe quem faz o quê"><Ph n="sparkle" size={18} />Distribuir com IA</button>}
        <Bell />
        <button className="btn accent" onClick={() => setAdding(defAdd)} title="Nova tarefa (atalho N)"><Ph n="plus" size={18} fill />Nova tarefa</button>
      </div>
      <div className="qhead">
        <div>
          <h1>{proj ? proj.name : 'Quadro da equipe'}</h1>
          <div className="sub"><Icon n="folder" size={14} />{proj ? 'Projeto' : project === NONE ? 'Sem projeto' : 'Todos os projetos'} · Semana {weekLabel()}</div>
        </div>
        <div className="stats">
          <div className="stat"><small>Abertas</small><b>{open.length}</b></div>
          <div className="stat"><small>Para aprovar</small><b>{apprN}</b></div>
          <div className={'stat' + (lateN ? ' warn' : '')}><small>Atrasadas</small><b>{lateN}</b></div>
          <div className="stat"><small>Feitas · 7 dias</small><b>{weekDone}</b></div>
        </div>
      </div>
      <div className="qtabs">
        <div className="seg" role="tablist" aria-label="Visão">
          <button className={group === 'etapa' ? 'on' : ''} onClick={() => setGroup('etapa')} title="Colunas por etapa"><Ph n="kanban" size={18} fill={group === 'etapa'} />Etapas</button>
          <button className={group === 'raias' ? 'on' : ''} onClick={() => setGroup('raias')} title="Uma linha por pessoa, separada por etapa"><Icon n="rows" />Raias</button>
          <button className={group === 'pessoa' ? 'on' : ''} onClick={() => setGroup('pessoa')} title="Uma coluna por pessoa"><Ph n="users-three" size={18} fill={group === 'pessoa'} />Pessoas</button>
        </div>
      </div>
      <div className="qfilters">
        <label className={'qchip' + (project ? ' on' : '')}>
          <Icon n="folder" size={14} />
          <select
            value={project} aria-label="Projeto"
            onChange={e => e.target.value === '+' ? setUi({ projectEdit: 'new' }) : setUi({ project: e.target.value })}
          >
            <option value="">Todos os projetos</option>
            {projList.map(p => <option key={p.id} value={p.id}>{p.name}{p.archived ? ' (arquivado)' : ''}</option>)}
            <option value={NONE}>Sem projeto</option>
            {canCreateProject() && <option value="+">＋ Novo projeto…</option>}
          </select>
        </label>
        <button className={'qchip' + (mine ? ' on' : '')} onClick={() => setMine(v => !v)} title="Só as que tenho ou participo (atalho Q)"><Icon n="user" size={14} />Minhas</button>
        <label className={'qchip' + (due ? ' on' : '')}>
          <Icon n="calendar" size={14} />
          <select value={due} onChange={e => setDue(e.target.value as Due)} aria-label="Prazo">
            <option value="">Qualquer prazo</option>
            <option value="late">Atrasadas</option>
            <option value="today">Vencem hoje</option>
            <option value="week">Até 7 dias</option>
            <option value="none">Sem prazo</option>
          </select>
        </label>
        {(apprN > 0 || qApprove) && (
          <button className={'qchip appr' + (qApprove ? ' on' : '')} onClick={() => setUi({ qApprove: !qApprove })} title="Tarefas esperando a sua aprovação">
            <Icon n="check" size={14} />Para eu aprovar<i>{apprN}</i>
          </button>
        )}
        <div className="qwho" aria-label="Filtrar por pessoa">
          {people.map(p => (
            <button key={p.id} className={who.includes(p.id) ? 'on' : ''} onClick={() => toggleWho(p.id)} title={`Só de ${p.name}`}>
              <MiniAvatar avatar={p.avatar} photo={p.photo} size={22} />
            </button>
          ))}
        </div>
        {filtered && <button className="qclear" onClick={clear}><Icon n="x" size={14} />Limpar</button>}
      </div>

      {proj && <ProjectBar p={proj} profiles={profiles} tasks={Object.values(tasksMap).filter(t => t.project_id === proj.id)} />}

      {group === 'raias' ? (
        <div className="qlanes">
          <div className="qlane qlane-top">
            <div className="qlane-who" />
            {STAGES.map(s => (
              <div key={s.id} className={'qlane-st st-' + s.id}>
                <span><i className="qdot" />{s.label}</span>
                <span className="qcount">{lanes.reduce((n, l) => n + l.cells.find(c => c.status === s.id)!.cards.length, 0)}</span>
              </div>
            ))}
          </div>
          {lanes.map(({ p, cells }) => (
            <div key={p.id} className={'qlane' + (p.id === meId ? ' me' : '')}>
              <div className="qlane-who">
                {personHead(p, 34)}
                <div><b>{p.id === meId ? `${first(p)} (você)` : p.name}</b><small>{p.role || rankName(p)}</small>
                  <small className="qlane-n">{cells.reduce((n, c) => n + (c.status === 'done' ? 0 : c.cards.length), 0)} abertas</small>
                </div>
              </div>
              {cells.map(c => zone(c, 'qcell'))}
            </div>
          ))}
          {!lanes.length && <p className="qempty pad">Ninguém com tarefas aqui.</p>}
          {outside.length > 0 && (
            <select className="qchip qlane-add" value="" onChange={e => e.target.value && setExtra(x => [...x, e.target.value])} aria-label="Colocar alguém no projeto">
              <option value="">＋ Colocar alguém no projeto…</option>
              {outside.map(p => <option key={p.id} value={p.id}>{p.name} · {p.role || rankName(p)}</option>)}
            </select>
          )}
        </div>
      ) : (
        <div className="qlists">
          {lists.map(l => zone(l, 'qlist', (
            <header className="qlist-head">
              {l.head}
              <div className="grow"><b>{l.title}</b>{l.hint && <small>{l.hint}</small>}</div>
              <span className="qcount">{l.cards.length}</span>
            </header>
          )))}
        </div>
      )}
    </div>
  )
}

/** Faixa do projeto aberto: mestre, critérios, andamento por pessoa. */
function ProjectBar({ p, profiles, tasks }: { p: Project; profiles: Record<string, Profile>; tasks: Task[] }) {
  const [crit, setCrit] = useState(false)
  const m = profiles[p.master_id]
  const live = tasks.filter(t => t.status !== 'declined')
  const done = live.filter(t => t.status === 'done').length
  const wait = live.filter(t => t.status === 'review').length
  const pct = live.length ? Math.round((done / live.length) * 100) : 0
  return (
    <div className="qproj" style={{ '--pc': p.color } as React.CSSProperties}>
      <span className="qproj-dot" />
      <div className="qproj-name"><b>{p.name}</b><small>{done}/{live.length} feitas · {pct}%</small><div className="bar"><i style={{ width: `${pct}%` }} /></div></div>
      <div className="qproj-master" title="Mestre do projeto: aprova as entregas">
        <MiniAvatar avatar={m?.avatar ?? null} photo={m?.photo ?? null} size={28} />
        <div><small>Mestre</small><b>{m?.name ?? '—'}</b></div>
      </div>
      {wait > 0 && <button className="qproj-wait" onClick={() => setUi({ tab: 'aprovar' })}>⏳ {wait} em aprovação</button>}
      <button className="qchip" onClick={() => setCrit(v => !v)} title="Critérios de aprovação">📏 Critérios ({p.criteria.length})</button>
      {canEditProject(p) && <button className="qchip" onClick={() => setUi({ projectEdit: p.id })}>✎ Editar</button>}
      {crit && (
        <ul className="qproj-crit">
          {p.criteria.length ? p.criteria.map((c, i) => <li key={i}>{c}</li>) : <li className="muted">Sem critérios definidos.</li>}
        </ul>
      )}
    </div>
  )
}

const PRIO: Record<Priority, { label: string; cls: string }> = {
  alta: { label: 'Alta', cls: 'red' }, media: { label: 'Média', cls: 'amber' }, baixa: { label: 'Baixa', cls: 'gray' },
}

function Card({ t, mode, meId, profiles, projects, showProj, notes, dragging, onDrag, drop }: {
  t: Task; mode: Group; meId: string; profiles: Record<string, Profile>; projects: Record<string, Project>; showProj: boolean; notes: number
  dragging: boolean; onDrag: (id: string | null) => void; drop: boolean
}) {
  const today = dayKey(new Date())
  const done = t.status === 'done'
  const late = !done && !!t.due && t.due < today
  const hot = !done && t.due === today
  const dark = t.status === 'review' && canApprove(t)
  const dueTip = done ? 'Concluída' : late ? 'Atrasada' : hot ? 'Vence hoje' : 'Prazo'
  const req = t.created_by !== t.owner_id && !t.project_id
  const ownReq = t.status === 'inbox' && t.owner_id === meId
  const proj = t.project_id ? projects[t.project_id] : undefined
  const appr = approverOf(t)
  const last = t.reviews.at(-1)
  const redo = last?.ok === false && (t.status === 'todo' || t.status === 'doing')
  const open = () => setUi({ task: t.id })
  const stop = (f: () => void) => (e: React.MouseEvent) => { e.stopPropagation(); f() }
  const sendsToReview = !!appr && !canApprove(t)
  const ck = t.checklist.filter(c => c.done).length
  const pct = t.checklist.length ? Math.round((ck / t.checklist.length) * 100) : 0
  const faces = [...(mode === 'etapa' ? [t.owner_id] : []), ...t.collaborators].map(id => profiles[id]).filter(Boolean)
  const prio = t.priority ? PRIO[t.priority] : null

  return (
    <>
      {drop && <div className="tdrop" />}
      <article
        className={'tcard' + (dragging ? ' dragging' : '') + (done ? ' done' : '') + (redo ? ' redo' : '') + (dark ? ' dark' : hot ? ' hot' : '')}
        style={proj ? { '--pc': proj.color } as React.CSSProperties : undefined}
        draggable={canEditTask(t) || canApprove(t)}
        onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', t.id); onDrag(t.id) }}
        onDragEnd={() => onDrag(null)}
        onClick={open}
        onKeyDown={e => e.key === 'Enter' && open()}
        tabIndex={0}
      >
        {(mode === 'pessoa' || (proj && showProj) || redo || (prio && !done) || dark) && (
          <div className="tc-tags">
            {dark && <span className="tag lilac"><Icon n="check" size={13} />Você aprova</span>}
            {prio && !done && <span className={'tag ' + prio.cls} title="Prioridade"><Icon n="flag" size={13} />{prio.label}</span>}
            {mode === 'pessoa' && <span className={'tc-stage ' + t.status}>{STAGE_LABEL[t.status]}</span>}
            {proj && showProj && <span className="tc-proj" title={`Projeto ${proj.name}`}>{proj.name}</span>}
            {redo && <span className="tag red" title={last!.reason}>↺ reprovada</span>}
          </div>
        )}
        <div className="tc-title">{t.title}</div>
        {t.status === 'review' && appr && !dark && <div className="tc-wait"><Icon n="clock" size={13} />aguardando {first(profiles[appr])}</div>}
        {t.checklist.length > 0 && (
          <div className="tc-prog">
            <div className="row">Checklist {ck}/{t.checklist.length}<b>{pct}%</b></div>
            <div className="bar"><i style={{ width: `${pct}%` }} /></div>
          </div>
        )}
        <div className="tc-meta">
          {faces.length > 0 && (
            <span className="tc-faces" title={faces.map(p => p.name).join(', ')}>
              {faces.slice(0, 4).map(p => <MiniAvatar key={p.id} avatar={p.avatar} photo={p.photo} size={24} />)}
            </span>
          )}
          {req && <span className="tc-from" title={`Pedido por ${profiles[t.created_by]?.name ?? 'alguém'}`}>↩ {t.created_by === meId ? 'você' : first(profiles[t.created_by])}</span>}
          <span className="grow" />
          {(t.due || done) && <span className={'tc-due' + (late ? ' late' : done ? ' ok' : '')} title={dueTip}><Icon n={done ? 'tick' : 'clock'} size={13} />{t.due ? (hot ? 'Hoje' : shortDate(t.due)) : 'Feito'}</span>}
          {t.remind_at && !done && <span className="cnt-pill" title={'Lembrete ' + new Date(t.remind_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}><Icon n="alarm" size={13} /></span>}
          {t.notes.trim() && <span className="cnt-pill" title="Tem descrição"><Icon n="list" size={13} /></span>}
          {t.attachments.length > 0 && <span className="cnt-pill" title="Anexos"><Icon n="clip" size={13} />{t.attachments.length}</span>}
          {notes > 0 && <span className="cnt-pill" title="Comentários"><Icon n="chat" size={13} />{notes}</span>}
        </div>
        {ownReq && (
          <div className="tc-ask">
            <button className="btn primary sm" onClick={stop(() => run(acceptRequest(t.id)))}>Aceitar</button>
            <button className="btn ghost sm" onClick={stop(() => run(declineRequest(t.id)))}>Recusar</button>
          </div>
        )}
        {!done && t.status !== 'inbox' && t.status !== 'review' && canMove(t) && (
          <button
            className="tc-check" onClick={stop(() => run(setStatus(t.id, 'done')))}
            title={sendsToReview ? 'Enviar para aprovação' : 'Concluir'} aria-label={sendsToReview ? 'Enviar para aprovação' : 'Concluir'}
          >{sendsToReview ? '↑' : '✓'}</button>
        )}
      </article>
    </>
  )
}

/** sexta-feira que vem (hoje, se já for sexta) */
const friday = () => { const d = new Date(); d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7)); return dayKey(d) }

type Tool = 'owner' | 'prio' | 'due' | 'remind'

/** Criar tarefa no jeito Trello: um cartão com o título; o resto em ícones que abrem um painelzinho. */
function Composer({ list, meId, profiles, people, project, onClose }: {
  list: List; meId: string; profiles: Record<string, Profile>; people: Profile[]; project: string | null; onClose: () => void
}) {
  const ask = list.status === 'inbox'
  const [title, setTitle] = useState('')
  const [owner, setOwner] = useState(list.owner ?? (ask ? '' : meId))
  const [due, setDue] = useState('')
  const [prio, setPrio] = useState<Priority | null>(null)
  const [remind, setRemind] = useState('')
  const [pop, setPop] = useState<Tool | null>(ask && !list.owner ? 'owner' : null)
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => ref.current?.focus(), [])
  const today = dayKey(new Date())
  const asRequest = !!owner && (ask || !canAssign(profiles[meId], profiles[owner]))
  const quick = [{ l: 'Hoje', d: today }, { l: 'Amanhã', d: addDays(1) }, { l: 'Sexta', d: friday() }]
  const remindLabel = remind && new Date(remind).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).replace('.', '')
  const toggle = (k: Tool) => setPop(p => (p === k ? null : k))
  const pick = (f: () => void) => { f(); setPop(null); ref.current?.focus() }
  const submit = () => {
    const name = title.trim()
    if (!name) return
    if (!owner) { setPop('owner'); return }
    run(addTask(owner, name, due || null, '', list.status ?? 'todo', project, { priority: prio, remind_at: remind ? new Date(remind).toISOString() : null }))
    setTitle(''); setPrio(null); setDue(''); setRemind(''); setPop(null)
    ref.current?.focus()
  }
  const tools: { k: Tool; ic: 'user' | 'flag' | 'calendar' | 'alarm'; tip: string; on: boolean }[] = [
    ...(!list.owner ? [{ k: 'owner' as Tool, ic: 'user' as const, tip: 'Quem faz', on: !!owner && owner !== meId }] : []),
    { k: 'prio', ic: 'flag', tip: 'Prioridade', on: !!prio },
    { k: 'due', ic: 'calendar', tip: 'Prazo', on: !!due },
    { k: 'remind', ic: 'alarm', tip: 'Lembrete', on: !!remind },
  ]
  const ownerP = owner ? profiles[owner] : undefined

  return (
    <form
      className="composer" onSubmit={e => { e.preventDefault(); submit() }}
      onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); if (pop) setPop(null); else onClose() } }}
    >
      <div className={'tcard cmp-card' + (due === today ? ' hot' : '')}>
        {(prio || due || remind) && (
          <div className="tc-tags">
            {prio && <button type="button" className={'tag ' + PRIO[prio].cls} onClick={() => toggle('prio')}><Icon n="flag" size={13} />{PRIO[prio].label}</button>}
            {due && <button type="button" className="tag gray" onClick={() => toggle('due')}><Icon n="clock" size={13} />{due === today ? 'Hoje' : shortDate(due)}</button>}
            {remind && <button type="button" className="tag lilac" onClick={() => toggle('remind')}><Icon n="alarm" size={13} />{remindLabel}</button>}
          </div>
        )}
        <textarea
          ref={ref} rows={2} maxLength={200} placeholder="Digite um título para esta tarefa…" value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }}
        />
        {ownerP && owner !== meId && (
          <div className="tc-meta">
            <span className="tc-faces"><MiniAvatar avatar={ownerP.avatar} photo={ownerP.photo} size={24} /></span>
            <span>{asRequest ? `pedido para ${first(ownerP)}` : `para ${first(ownerP)}`}</span>
          </div>
        )}
      </div>

      {pop && (
        <div className="cmp-pop" role="dialog" aria-label={tools.find(t => t.k === pop)?.tip}>
          <header><b>{tools.find(t => t.k === pop)?.tip}</b><button type="button" className="icon-btn" onClick={() => setPop(null)} aria-label="Fechar"><Icon n="x" size={14} /></button></header>
          {pop === 'owner' && (
            <div className="cmp-people">
              {people.filter(p => !ask || p.id !== meId).map(p => (
                <button key={p.id} type="button" className={owner === p.id ? 'on' : ''} onClick={() => pick(() => setOwner(p.id))}>
                  <MiniAvatar avatar={p.avatar} photo={p.photo} size={28} /><span>{p.id === meId ? 'Eu' : p.name}</span>
                  {owner === p.id && <Icon n="tick" size={14} />}
                </button>
              ))}
            </div>
          )}
          {pop === 'prio' && (
            <div className="cmp-opts">
              {(Object.keys(PRIO) as Priority[]).map(k => (
                <button key={k} type="button" className={'tag ' + PRIO[k].cls + (prio === k ? ' on' : '')} onClick={() => pick(() => setPrio(k))}><Icon n="flag" size={13} />{PRIO[k].label}</button>
              ))}
              {prio && <button type="button" className="cmp-clear" onClick={() => pick(() => setPrio(null))}>Tirar</button>}
            </div>
          )}
          {pop === 'due' && (
            <>
              <div className="cmp-opts">
                {quick.map(q => <button key={q.l} type="button" className={'tag gray' + (due === q.d ? ' on' : '')} onClick={() => pick(() => setDue(q.d))}>{q.l}</button>)}
              </div>
              <input type="date" value={due} min={today} onChange={e => setDue(e.target.value)} aria-label="Escolher data" />
              {due && <button type="button" className="cmp-clear" onClick={() => pick(() => setDue(''))}>Tirar prazo</button>}
            </>
          )}
          {pop === 'remind' && (
            <>
              <small className="muted">Avisa quem faz neste horário.</small>
              <input type="datetime-local" value={remind} onChange={e => setRemind(e.target.value)} aria-label="Lembrete" />
              {remind && <button type="button" className="cmp-clear" onClick={() => pick(() => setRemind(''))}>Tirar lembrete</button>}
            </>
          )}
        </div>
      )}

      <div className="cmp-actions">
        <button className="btn primary sm" disabled={!title.trim()}>Adicionar cartão</button>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar" title="Fechar (Esc)"><Icon n="x" /></button>
        <span className="grow" />
        {tools.map(t => (
          <button key={t.k} type="button" className={'cmp-tool' + (t.on ? ' set' : '') + (pop === t.k ? ' on' : '')} onClick={() => toggle(t.k)} title={t.tip} aria-label={t.tip} aria-expanded={pop === t.k}>
            <Icon n={t.ic} size={16} />
          </button>
        ))}
      </div>
    </form>
  )
}
