import { useEffect, useRef, useState } from 'react'
import { canAssign, rankName } from '../game/ranks'
import { dayKey } from '../game/xp'
import { addTask, approverOf, dmChannel, removeTask, run, setStatus, setUi, useStore } from '../store'
import type { Task, TaskStatus } from '../types'
import Icon from './Icon'
import MiniAvatar from './MiniAvatar'

const SECTIONS: { id: TaskStatus; label: string }[] = [
  { id: 'doing', label: 'Fazendo agora' },
  { id: 'todo', label: 'A fazer' },
  { id: 'review', label: 'Em aprovação' },
  { id: 'done', label: 'Feito hoje' },
]

function dueChip(due: string | null, done: boolean) {
  if (!due || done) return null
  const today = dayKey(new Date())
  const cls = due < today ? 'late' : due === today ? 'today' : ''
  const txt = due < today ? 'Atrasada' : due === today ? 'Hoje' : new Date(due + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  return <span className={'chip due ' + cls}><Icon n="calendar" size={12} />{txt}</span>
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
  const [adding, setAdding] = useState(false)
  const [drag, setDrag] = useState<string | null>(null)
  const [over, setOver] = useState<TaskStatus | null>(null)
  if (!owner) return null

  const all = Object.values(tasksMap)
  const today = dayKey(new Date())
  // na pasta entram as próprias e as que a pessoa ajuda
  const tasks = all.filter(t => t.owner_id === owner.id || t.collaborators.includes(owner.id))
  const list = (st: TaskStatus) =>
    tasks
      .filter(t => t.status === st && (st !== 'done' || (t.done_at && dayKey(t.done_at) === today)))
      .sort((a, b) => (st === 'todo' ? a.position - b.position : b.position - a.position))
  const totalDone = tasks.filter(t => t.status === 'done' && t.owner_id === owner.id).length

  return (
    <div className={'board' + (bare ? ' bare' : '')}>
      {!bare && <header className="board-head">
        <MiniAvatar avatar={owner.avatar} photo={owner.photo} name={owner.name} size={40} />
        <div className="grow">
          <h2>{mine ? 'Minha mesa' : owner.name}</h2>
          <div className="muted small">
            {owner.role || rankName(owner)}
            {!mine && <> · <span className={online.has(owner.id) ? 'on' : 'off'}>{online.has(owner.id) ? 'no escritório' : 'fora'}</span></>}
          </div>
        </div>
        {!mine && <button className="icon-btn" onClick={() => setUi({ chatOpen: true, channel: dmChannel(meId, owner.id) })} title={`Mensagem para ${owner.name}`}><Icon n="chat" /></button>}
        {!mine && !assign && <button className="icon-btn" onClick={() => setUi({ requestTo: owner.id })} title="Pedir algo"><Icon n="send" /></button>}
      </header>}

      {SECTIONS.map(sec => {
        const items = list(sec.id)
        if (sec.id === 'review' && !items.length) return null
        return (
          <section
            key={sec.id}
            className={'sec ' + sec.id + (over === sec.id ? ' over' : '')}
            onDragOver={e => { if (drag) { e.preventDefault(); setOver(sec.id) } }}
            onDragLeave={() => setOver(null)}
            onDrop={() => { if (drag) run(setStatus(drag, sec.id)); setDrag(null); setOver(null) }}
          >
            <h3>{sec.label} <span className="count">{items.length}</span></h3>
            {items.length === 0 && !(sec.id === 'todo' && assign) && (
              <p className="empty">
                {sec.id === 'doing' ? (mine ? 'Arraste uma tarefa pra cá ou toque em ▶ pra começar.' : 'Nada em andamento.') :
                  sec.id === 'todo' ? (mine ? 'Tudo em dia. Adicione o que vem a seguir.' : 'Sem tarefas pendentes.') : 'Nenhuma concluída hoje ainda.'}
              </p>
            )}
            {items.map(t => <Card key={t.id} t={t} meId={meId} boardOwner={owner.id} onDrag={setDrag} />)}
            {sec.id === 'todo' && assign && (adding
              ? <MiniComposer ownerId={owner.id} onClose={() => setAdding(false)} />
              : <button className="qadd" onClick={() => setAdding(true)}><Icon n="plus" size={15} />Nova tarefa</button>)}
          </section>
        )
      })}
      {totalDone > 0 && <p className="muted small center">{totalDone} tarefa(s) concluída(s) no total</p>}
    </div>
  )
}

function Card({ t, meId, boardOwner, onDrag }: { t: Task; meId: string; boardOwner: string; onDrag: (id: string | null) => void }) {
  const profiles = useStore(s => s.profiles)
  const nNotes = useStore(s => s.notes.filter(n => n.task_id === t.id).length)
  const mine = t.owner_id === meId
  const done = t.status === 'done'
  const req = t.created_by !== t.owner_id
  const boss = req && canAssign(profiles[t.created_by], profiles[t.owner_id])
  const helping = t.owner_id !== boardOwner
  const canDelete = mine || (t.created_by === meId && !done)
  const open = () => setUi({ task: t.id })

  return (
    <div className={'card' + (done ? ' done' : '') + (req ? ' req' : '') + (helping ? ' help' : '')} draggable={mine} onDragStart={() => onDrag(t.id)} onDragEnd={() => onDrag(null)}>
      <button
        className={'check' + (done ? ' on' : '')}
        disabled={!mine || t.status === 'review'}
        onClick={() => run(setStatus(t.id, done ? 'todo' : 'done'))}
        title={t.status === 'review' ? 'Esperando aprovação' : done ? 'Desfazer' : approverOf(t) ? 'Enviar para aprovação' : 'Concluir'}
      >{done ? <Icon n="tick" size={13} /> : t.status === 'review' ? <Icon n="clock" size={13} /> : null}</button>
      <div className="grow open" onClick={open} title="Abrir detalhes">
        <div className="title">{t.title}</div>
        {t.notes && <div className="desc">{t.notes}</div>}
        <div className="meta">
          {helping && <span className="chip help"><Icon n="users" size={12} />com {profiles[t.owner_id]?.name ?? 'alguém'}</span>}
          {req && !helping && <span className="chip req"><Icon n={boss ? 'folder' : 'send'} size={12} />{t.created_by === meId ? (boss ? 'você passou' : 'seu pedido') : `${boss ? 'passada' : 'pedido'} por ${profiles[t.created_by]?.name ?? 'alguém'}`}</span>}
          {dueChip(t.due, done)}
          {t.collaborators.length > 0 && !helping && <span className="chip" title={t.collaborators.map(id => profiles[id]?.name).join(', ')}><Icon n="users" size={12} />{t.collaborators.length}</span>}
          {t.attachments.length > 0 && <span className="chip"><Icon n="clip" size={12} />{t.attachments.length}</span>}
          {nNotes > 0 && <span className="chip"><Icon n="chat" size={12} />{nNotes}</span>}
        </div>
      </div>
      <div className="acts">
        {mine && t.status === 'todo' && <button onClick={() => run(setStatus(t.id, 'doing'))} title="Começar" className="icon-btn"><Icon n="play" size={14} /></button>}
        {mine && t.status === 'doing' && <button onClick={() => run(setStatus(t.id, 'todo'))} title="Pausar" className="icon-btn"><Icon n="pause" size={14} /></button>}
        {canDelete && <button onClick={() => run(removeTask(t.id))} title="Excluir" className="icon-btn"><Icon n="trash" size={14} /></button>}
      </div>
    </div>
  )
}

function MiniComposer({ ownerId, onClose }: { ownerId: string; onClose: () => void }) {
  const [title, setTitle] = useState('')
  const [due, setDue] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => ref.current?.focus(), [])
  const submit = () => {
    if (!title.trim()) return
    run(addTask(ownerId, title.trim(), due || null))
    setTitle('')
    ref.current?.focus()
  }
  return (
    <form className="composer tcard" onSubmit={e => { e.preventDefault(); submit() }} onKeyDown={e => e.key === 'Escape' && onClose()}>
      <textarea
        ref={ref} rows={2} maxLength={140} placeholder="Digite um título…" value={title}
        onChange={e => setTitle(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }}
      />
      <div className="composer-opts row gap">
        <label className="pill" title="Prazo">
          <Icon n="calendar" size={14} />
          <input type="date" value={due} min={dayKey(new Date())} onChange={e => setDue(e.target.value)} aria-label="Prazo" />
        </label>
      </div>
      <div className="row gap">
        <button className="btn primary sm" disabled={!title.trim()}>Adicionar</button>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar"><Icon n="x" /></button>
        <small className="muted grow right">Enter adiciona · Esc fecha</small>
      </div>
    </form>
  )
}
