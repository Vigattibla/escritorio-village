import { useState } from 'react'
import { canAssign, rankName } from '../game/ranks'
import { dayKey, DAILY_GOAL, doneToday, level, levelTitle, taskXp } from '../game/xp'
import { addTask, removeTask, renameTask, run, setStatus, setUi, useStore } from '../store'
import type { Task, TaskStatus } from '../types'
import MiniAvatar from './MiniAvatar'

const SECTIONS: { id: TaskStatus; label: string }[] = [
  { id: 'doing', label: 'Fazendo agora' },
  { id: 'todo', label: 'A fazer' },
  { id: 'done', label: 'Feito hoje' },
]

function dueChip(due: string | null, done: boolean) {
  if (!due || done) return null
  const today = dayKey(new Date())
  const cls = due < today ? 'late' : due === today ? 'today' : ''
  const txt = due < today ? 'Atrasada' : due === today ? 'Hoje' : new Date(due + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  return <span className={'chip due ' + cls}>📅 {txt}</span>
}

/** Tarefas de uma pessoa. `bare` = dentro da pasta da mesa aberta (sem cabeçalho). */
export default function Board({ ownerId, bare = false }: { ownerId?: string; bare?: boolean }) {
  const meId = useStore(s => s.meId)!
  const viewing = useStore(s => ownerId ?? s.viewing) ?? meId
  const profiles = useStore(s => s.profiles)
  const tasksMap = useStore(s => s.tasks)
  const online = useStore(s => s.online)
  const owner = profiles[viewing] ?? profiles[meId]
  const mine = owner?.id === meId
  const assign = canAssign(profiles[meId], owner)
  const [title, setTitle] = useState('')
  const [due, setDue] = useState('')
  const [drag, setDrag] = useState<string | null>(null)
  const [over, setOver] = useState<TaskStatus | null>(null)
  if (!owner) return null

  const all = Object.values(tasksMap)
  const today = dayKey(new Date())
  const tasks = all.filter(t => t.owner_id === owner.id)
  const list = (st: TaskStatus) =>
    tasks
      .filter(t => t.status === st && (st !== 'done' || (t.done_at && dayKey(t.done_at) === today)))
      .sort((a, b) => (st === 'todo' ? a.position - b.position : b.position - a.position))
  const doneCount = doneToday(all, owner.id)
  const totalDone = tasks.filter(t => t.status === 'done').length

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    run(addTask(owner.id, title, due || null))
    setTitle('')
    setDue('')
  }

  return (
    <div className={'board' + (bare ? ' bare' : '')}>
      {!bare && <header className="board-head">
        <MiniAvatar avatar={owner.avatar} photo={owner.photo} size={52} />
        <div className="grow">
          <h2>{mine ? 'Minha mesa' : `Mesa de ${owner.name}`}</h2>
          <div className="muted">
            {owner.role || rankName(owner)} · Nv {level(owner.xp)} {levelTitle(owner.xp)}
            {!mine && <> · <span className={online.has(owner.id) ? 'on' : 'off'}>{online.has(owner.id) ? 'no escritório' : 'fora'}</span></>}
          </div>
          <div className="goal" title="Meta do dia">
            <div className="goal-bar"><i style={{ width: `${Math.min(100, (doneCount / DAILY_GOAL) * 100)}%` }} /></div>
            <span>{doneCount}/{DAILY_GOAL} hoje</span>
          </div>
        </div>
        <div className="col">
          <button className="btn primary sm" onClick={() => setUi({ desk: owner.id, deskView: 'pasta' })}>🗂 Abrir mesa</button>
          {!mine && !assign && <button className="btn ghost sm" onClick={() => setUi({ requestTo: owner.id })}>📌 Pedir algo</button>}
          {!mine && <button className="btn ghost sm" onClick={() => setUi({ viewing: meId })}>← Minha mesa</button>}
        </div>
      </header>}

      {assign && (
        <form className="add" onSubmit={submit}>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder={mine ? 'Nova tarefa do dia…' : `Nova tarefa para ${owner.name}…`} maxLength={140} />
          <input type="date" value={due} onChange={e => setDue(e.target.value)} title="Prazo (opcional)" />
          <button className="btn primary" disabled={!title.trim()}>Adicionar</button>
        </form>
      )}

      {SECTIONS.map(sec => {
        const items = list(sec.id)
        return (
          <section
            key={sec.id}
            className={'sec ' + sec.id + (over === sec.id ? ' over' : '')}
            onDragOver={e => { if (mine && drag) { e.preventDefault(); setOver(sec.id) } }}
            onDragLeave={() => setOver(null)}
            onDrop={() => { if (drag) run(setStatus(drag, sec.id)); setDrag(null); setOver(null) }}
          >
            <h3>{sec.label} <span className="count">{items.length}</span></h3>
            {items.length === 0 && (
              <p className="empty">
                {sec.id === 'doing' ? (mine ? 'Arraste uma tarefa pra cá ou toque em ▶ pra começar.' : 'Nada em andamento.') :
                  sec.id === 'todo' ? (mine ? 'Tudo em dia. Adicione o que vem a seguir.' : 'Sem tarefas pendentes.') : 'Nenhuma concluída hoje ainda.'}
              </p>
            )}
            {items.map(t => <Card key={t.id} t={t} mine={mine} meId={meId} onDrag={setDrag} />)}
          </section>
        )
      })}
      {totalDone > 0 && <p className="muted small center">{totalDone} tarefa(s) concluída(s) no total</p>}
    </div>
  )
}

function Card({ t, mine, meId, onDrag }: { t: Task; mine: boolean; meId: string; onDrag: (id: string | null) => void }) {
  const profiles = useStore(s => s.profiles)
  const [edit, setEdit] = useState(false)
  const [val, setVal] = useState(t.title)
  const done = t.status === 'done'
  const req = t.created_by !== t.owner_id
  const boss = req && canAssign(profiles[t.created_by], profiles[t.owner_id])
  const canDelete = mine || (t.created_by === meId && !done)
  const save = () => { setEdit(false); run(renameTask(t.id, val)) }

  return (
    <div className={'card' + (done ? ' done' : '') + (req ? ' req' : '')} draggable={mine && !edit} onDragStart={() => onDrag(t.id)} onDragEnd={() => onDrag(null)}>
      <button
        className={'check' + (done ? ' on' : '')}
        disabled={!mine}
        onClick={() => run(setStatus(t.id, done ? 'todo' : 'done'))}
        title={done ? 'Desfazer' : `Concluir (+${taskXp(t)} XP)`}
      >{done ? '✓' : ''}</button>
      <div className="grow">
        {edit ? (
          <input autoFocus value={val} onChange={e => setVal(e.target.value)} onBlur={save} onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setVal(t.title); setEdit(false) } }} />
        ) : (
          <div className="title" onDoubleClick={() => mine && !done && setEdit(true)}>{t.title}</div>
        )}
        <div className="meta">
          {req && <span className="chip req">{boss ? '🗂' : '📌'} {t.created_by === meId ? (boss ? 'você passou' : 'seu pedido') : `${boss ? 'passada' : 'pedido'} por ${profiles[t.created_by]?.name ?? 'alguém'}`}</span>}
          {dueChip(t.due, done)}
          {t.notes && <span className="chip note" title={t.notes}>📝 nota</span>}
        </div>
      </div>
      <div className="acts">
        {mine && t.status === 'todo' && <button onClick={() => run(setStatus(t.id, 'doing'))} title="Começar">▶</button>}
        {mine && t.status === 'doing' && <button onClick={() => run(setStatus(t.id, 'todo'))} title="Pausar">⏸</button>}
        {canDelete && <button onClick={() => run(removeTask(t.id))} title="Excluir">🗑</button>}
      </div>
    </div>
  )
}
