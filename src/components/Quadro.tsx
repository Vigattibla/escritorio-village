import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { canAssign, rankName, rankOf } from '../game/ranks'
import { dayKey } from '../game/xp'
import {
  acceptRequest, addTask, canUseAI, approverOf, canApprove, canCreateProject, canEditProject, canEditTask, canMove, canReassign, declineRequest, involved,
  placeTask, reassign, run, setStatus, setUi, teamOf, useStore,
} from '../store'
import type { Profile, Project, Task, TaskStatus } from '../types'
import MiniAvatar from './MiniAvatar'

type Group = 'etapa' | 'raias' | 'pessoa'
type Due = '' | 'late' | 'today' | 'week' | 'none'

interface List { key: string; title: string; hint?: string; head?: ReactNode; cards: Task[]; status?: TaskStatus; owner?: string; canAdd: boolean }

export const STAGES: { id: TaskStatus; label: string; icon: string; hint?: string }[] = [
  { id: 'inbox', label: 'Pedidos', icon: '📨', hint: 'Esperando a pessoa aceitar' },
  { id: 'todo', label: 'A fazer', icon: '📋' },
  { id: 'doing', label: 'Fazendo', icon: '⚡' },
  { id: 'review', label: 'Aprovação', icon: '⏳', hint: 'Esperando o mestre do projeto' },
  { id: 'done', label: 'Feito', icon: '✅', hint: 'Últimos 7 dias' },
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
  const filtered = mine || who.length > 0 || !!due || !!term
  const projList = Object.values(projects).filter(p => !p.archived || p.id === project).sort((a, b) => a.name.localeCompare(b.name))

  const shown = Object.values(tasksMap).filter(t => {
    if (t.status === 'declined') return false
    if (t.status === 'done' && (!t.done_at || dayKey(t.done_at) < since)) return false
    if (project === NONE ? !!t.project_id : project && t.project_id !== project) return false
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
  const sortFor = (st: TaskStatus) => (st === 'done' ? byDone : byPos)
  const lanePeople = people.filter(p => !who.length || who.includes(p.id))
  const personHead = (p: Profile, size = 28) => (
    <span className="qhead-av"><MiniAvatar avatar={p.avatar} photo={p.photo} size={size} dim={!online.has(p.id)} />{online.has(p.id) && <i />}</span>
  )

  const lists: List[] = group === 'etapa'
    ? STAGES.map(s => ({
        key: s.id, title: s.label, hint: s.hint, status: s.id, canAdd: s.id !== 'done' && s.id !== 'review',
        head: <span className="qst-ic">{s.icon}</span>,
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
  const clear = () => { setMine(false); setWho([]); setDue(''); setQ('') }

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
          : <button className="qadd" onClick={() => setAdding(l.key)}>+ {group === 'raias' ? 'Adicionar' : l.status === 'inbox' ? 'Pedir a alguém' : 'Adicionar cartão'}</button>)}
      </section>
    )
  }

  return (
    <div className="quadro">
      <div className="qbar">
        <div className="qseg" role="tablist" aria-label="Agrupar por">
          <button className={group === 'etapa' ? 'on' : ''} onClick={() => setGroup('etapa')} title="Colunas por etapa">Etapas</button>
          <button className={group === 'raias' ? 'on' : ''} onClick={() => setGroup('raias')} title="Uma linha por pessoa, separada por etapa">Raias</button>
          <button className={group === 'pessoa' ? 'on' : ''} onClick={() => setGroup('pessoa')} title="Uma coluna por pessoa">Pessoas</button>
        </div>
        <select
          className={'qchip qproj-sel' + (project ? ' on' : '')} value={project} aria-label="Projeto"
          onChange={e => e.target.value === '+' ? setUi({ projectEdit: 'new' }) : setUi({ project: e.target.value })}
        >
          <option value="">🗂 Todos os projetos</option>
          {projList.map(p => <option key={p.id} value={p.id}>● {p.name}{p.archived ? ' (arquivado)' : ''}</option>)}
          <option value={NONE}>Sem projeto</option>
          {canCreateProject() && <option value="+">＋ Novo projeto…</option>}
        </select>
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
        {canUseAI() && <button className="btn ghost sm" onClick={() => setUi({ aiOpen: true })} title="O Claude propõe quem faz o quê">✨ Distribuir com IA</button>}
        <button className="btn primary sm" onClick={() => setAdding(defAdd)} title="Atalho N">+ Nova tarefa</button>
      </div>

      {proj && <ProjectBar p={proj} profiles={profiles} tasks={Object.values(tasksMap).filter(t => t.project_id === proj.id)} />}

      {group === 'raias' ? (
        <div className="qlanes">
          <div className="qlane qlane-top">
            <div className="qlane-who" />
            {STAGES.map(s => (
              <div key={s.id} className={'qlane-st st-' + s.id}>
                <span>{s.icon} {s.label}</span>
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

function Card({ t, mode, meId, profiles, projects, showProj, notes, dragging, onDrag, drop }: {
  t: Task; mode: Group; meId: string; profiles: Record<string, Profile>; projects: Record<string, Project>; showProj: boolean; notes: number
  dragging: boolean; onDrag: (id: string | null) => void; drop: boolean
}) {
  const today = dayKey(new Date())
  const done = t.status === 'done'
  const dueCls = done ? 'ok' : !t.due ? '' : t.due < today ? 'late' : t.due <= addDays(1) ? 'soon' : ''
  const dueTip = done ? 'Concluída' : t.due && t.due < today ? 'Atrasada' : t.due === today ? 'Vence hoje' : 'Prazo'
  const req = t.created_by !== t.owner_id && !t.project_id
  const ownReq = t.status === 'inbox' && t.owner_id === meId
  const owner = profiles[t.owner_id]
  const proj = t.project_id ? projects[t.project_id] : undefined
  const appr = approverOf(t)
  const last = t.reviews.at(-1)
  const redo = last?.ok === false && (t.status === 'todo' || t.status === 'doing')
  const open = () => setUi({ task: t.id })
  const stop = (f: () => void) => (e: React.MouseEvent) => { e.stopPropagation(); f() }
  const sendsToReview = !!appr && !canApprove(t)

  return (
    <>
      {drop && <div className="tdrop" />}
      <article
        className={'tcard' + (dragging ? ' dragging' : '') + (done ? ' done' : '') + (redo ? ' redo' : '')}
        style={proj ? { '--pc': proj.color } as React.CSSProperties : undefined}
        draggable={canEditTask(t) || canApprove(t)}
        onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', t.id); onDrag(t.id) }}
        onDragEnd={() => onDrag(null)}
        onClick={open}
        onKeyDown={e => e.key === 'Enter' && open()}
        tabIndex={0}
      >
        {(mode === 'pessoa' || (proj && showProj) || redo) && (
          <div className="tc-tags">
            {mode === 'pessoa' && <span className={'tc-stage ' + t.status}>{STAGE_LABEL[t.status]}</span>}
            {proj && showProj && <span className="tc-proj" title={`Projeto ${proj.name}`}>{proj.name}</span>}
            {redo && <span className="tc-redo" title={last!.reason}>↺ reprovada</span>}
          </div>
        )}
        <div className="tc-title">{t.title}</div>
        {t.status === 'review' && appr && <div className="tc-wait">⏳ aguardando {appr === meId ? 'você' : first(profiles[appr])}</div>}
        <div className="tc-meta">
          {(t.due || done) && <span className={'tc-due ' + dueCls} title={dueTip}>{done ? '✓' : '🕑'} {t.due ? shortDate(t.due) : 'Feito'}</span>}
          {t.notes.trim() && <span title="Tem descrição">☰</span>}
          {notes > 0 && <span title="Comentários">💬 {notes}</span>}
          {t.attachments.length > 0 && <span title="Anexos">📎 {t.attachments.length}</span>}
          {t.collaborators.length > 0 && <span title={'Colabora: ' + t.collaborators.map(c => profiles[c]?.name).join(', ')}>🤝 {t.collaborators.length}</span>}
          {req && <span className="tc-from" title={`Pedido por ${profiles[t.created_by]?.name ?? 'alguém'}`}>↩ {t.created_by === meId ? 'você' : first(profiles[t.created_by])}</span>}
          <span className="grow" />
          {mode !== 'etapa'
            ? null
            : <span className={'tc-owner' + (t.owner_id === meId ? ' me' : '')} title={`Responsável: ${owner?.name ?? '—'}`}>
                <MiniAvatar avatar={owner?.avatar ?? null} photo={owner?.photo ?? null} size={20} />{t.owner_id === meId ? 'Você' : first(owner)}
              </span>}
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

function Composer({ list, meId, profiles, people, project, onClose }: {
  list: List; meId: string; profiles: Record<string, Profile>; people: Profile[]; project: string | null; onClose: () => void
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
    run(addTask(owner, name, due || null, '', list.status ?? 'todo', project))
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
