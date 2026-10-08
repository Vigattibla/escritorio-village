import { useEffect, useRef, useState } from 'react'
import { isChief, rankName } from '../game/ranks'
import {
  acceptRequest, addNote, approverOf, attachFiles, canApprove, canEditTask, canMove, canReassign, declineRequest, reassign, fileUrl, removeAttachment, removeNote, removeTask, run,
  setCriteria, setProject, setStatus, setUi, updateTask, useStore,
} from '../store'
import type { Attachment, CheckItem, Priority, Task } from '../types'
import MiniAvatar from './MiniAvatar'
import { ReviewBox, ReviewHistory } from './Revisao'

const STATUS: Record<Task['status'], string> = { inbox: 'pedido aguardando', todo: 'a fazer', doing: 'fazendo', review: 'em aprovação ⏳', done: 'feita ✅', declined: 'recusada' }
/** ISO → valor de input datetime-local (hora local) */
const localDT = (iso: string | null) => { if (!iso) return ''; const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16) }
const size = (n: number) => (n < 1048576 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1048576).toFixed(1).replace('.', ',')} MB`)
const when = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
const isImg = (a: Attachment) => a.type.startsWith('image/')
const ext = (name: string) => (name.includes('.') ? name.split('.').pop()!.slice(0, 4).toUpperCase() : 'ARQ')

function useUrl(a: Attachment | null) {
  const [url, setUrl] = useState<string | null>(null)
  const path = a?.path
  useEffect(() => {
    let live = true
    setUrl(null)
    if (a) fileUrl(a).then(u => live && setUrl(u)).catch(() => {})
    return () => { live = false }
  }, [path]) // eslint-disable-line react-hooks/exhaustive-deps
  return url
}

/** Abre numa aba nova (ou baixa). A aba abre antes do await pra não cair no bloqueador de pop-up. */
async function openFile(a: Attachment, download = false) {
  const w = download ? null : window.open('', '_blank')
  try {
    let url = await fileUrl(a, download)
    if (url.startsWith('data:')) url = URL.createObjectURL(await (await fetch(url)).blob())
    if (w) { w.location.href = url; return }
    const link = document.createElement('a')
    link.href = url
    link.download = a.name
    link.click()
  } catch (e) {
    w?.close()
    throw e
  }
}

function Thumb({ a, onZoom, onDel }: { a: Attachment; onZoom: (url: string) => void; onDel?: () => void }) {
  const url = useUrl(isImg(a) ? a : null)
  return (
    <div className="att">
      {isImg(a)
        ? <button className="att-box" onClick={() => url && onZoom(url)} title="Ver imagem">{url ? <img src={url} alt={a.name} /> : <span className="muted">…</span>}</button>
        : <button className="att-box file" onClick={() => run(openFile(a))} title="Abrir"><b>{ext(a.name)}</b></button>}
      <div className="att-name" title={a.name}>{a.name}</div>
      <div className="att-meta">
        <span>{size(a.size)}</span>
        <button onClick={() => run(openFile(a, true))} title="Baixar">⬇</button>
        {onDel && <button onClick={onDel} title="Remover">✕</button>}
      </div>
    </div>
  )
}

export default function TaskDetail() {
  const id = useStore(s => s.task)!
  const t = useStore(s => s.tasks[id])
  const profiles = useStore(s => s.profiles)
  const meId = useStore(s => s.meId)!
  const allNotes = useStore(s => s.notes)
  const projects = useStore(s => s.projects)
  const [crit, setCrit] = useState('')
  const [item, setItem] = useState('')
  const [zoom, setZoom] = useState<string | null>(null)
  const [sending, setSending] = useState(0)
  const [note, setNote] = useState('')
  const [over, setOver] = useState(false)
  const [sure, setSure] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const thread = useRef<HTMLDivElement>(null)
  const close = () => setUi({ task: null })

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') (zoom ? setZoom(null) : close()) }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [zoom])
  const notes = allNotes.filter(n => n.task_id === id)
  useEffect(() => { thread.current?.scrollTo(0, thread.current.scrollHeight) }, [notes.length])
  if (!t) return null

  const me = profiles[meId]
  const edit = canEditTask(t)
  const own = t.owner_id === meId
  const move = canMove(t)
  const targets = Object.values(profiles).filter(p => canReassign(t, p.id)).sort((a, b) => a.name.localeCompare(b.name))
  const chief = isChief(me)
  const canDelete = own || chief || (t.created_by === meId && t.status !== 'done')
  const name = (uid: string) => profiles[uid]?.name ?? 'Alguém'
  const proj = t.project_id ? projects[t.project_id] : undefined
  const appr = approverOf(t)
  const approve = canApprove(t)
  const toReview = !!appr && !approve
  const last = t.reviews.at(-1)
  const setList = (checklist: CheckItem[]) => run(updateTask(t.id, { checklist }))
  const addItem = () => { if (item.trim()) { setList([...t.checklist, { id: crypto.randomUUID(), text: item.trim(), done: false }]); setItem('') } }
  const addCrit = () => { if (crit.trim()) { run(setCriteria(t.id, [...t.criteria, crit])); setCrit('') } }
  const free = Object.values(profiles).filter(p => p.id !== t.owner_id && !t.collaborators.includes(p.id)).sort((a, b) => a.name.localeCompare(b.name))

  const upload = (files: File[]) => {
    if (!files.length || !edit) return
    setSending(files.length)
    run(attachFiles(t.id, files).finally(() => setSending(0)))
  }
  const send = () => {
    if (!note.trim()) return
    run(addNote(t.id, note))
    setNote('')
  }
  const person = (uid: string, tag: string, del?: () => void) => (
    <span key={uid + tag} className="who">
      <MiniAvatar avatar={profiles[uid]?.avatar ?? null} photo={profiles[uid]?.photo ?? null} size={22} />
      {name(uid)}<small>{tag}</small>
      {del && <button onClick={del} title="Tirar da tarefa">✕</button>}
    </span>
  )

  return (
    <div className="modal-bg" onMouseDown={e => e.target === e.currentTarget && close()}>
      <div
        className="task-modal"
        onPaste={e => { const f = [...e.clipboardData.files]; if (f.length && edit) { e.preventDefault(); upload(f) } }}
      >
        <header className="task-top">
          <span className={'chip st ' + t.status}>{STATUS[t.status]}</span>
          <span className="muted small grow">
            Pasta de <b>{name(t.owner_id)}</b> · criada por {t.created_by === meId ? 'você' : name(t.created_by)} em {when(t.created_at)}
          </span>
          <button className="btn ghost sm" onClick={close} aria-label="Fechar">✕</button>
        </header>

        {last && !last.ok && t.status !== 'done' && t.status !== 'review' && (
          <div className="rvbanner">
            <b>↺ Reprovada por {name(last.by)}:</b> {last.reason}
            {last.failed.length > 0 && <div className="rvfail">{last.failed.map(c => <span key={c}>✕ {c}</span>)}</div>}
          </div>
        )}
        {t.status === 'review' && (approve
          ? <div className="rvpanel"><h3>Sua aprovação</h3><ReviewBox t={t} /></div>
          : <div className="rvbanner wait">⏳ Esperando a aprovação de <b>{appr ? name(appr) : 'alguém'}</b>.</div>)}

        <div className="task-body">
          <input
            key={'t' + t.title}
            className="task-title"
            defaultValue={t.title}
            readOnly={!edit}
            maxLength={140}
            onBlur={e => run(updateTask(t.id, { title: e.target.value }))}
            onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
          />

          <label>
            Descrição / legenda
            <textarea
              key={'n' + t.notes}
              defaultValue={t.notes}
              readOnly={!edit}
              rows={3}
              maxLength={4000}
              placeholder={edit ? 'O que precisa ser feito, links, detalhes…' : 'Sem descrição.'}
              onBlur={e => run(updateTask(t.id, { notes: e.target.value }))}
            />
          </label>

          <div className="row gap wrap">
            <label className="grow">Início
              <input type="date" value={t.start ?? ''} disabled={!edit} max={t.due ?? undefined} onChange={e => run(updateTask(t.id, { start: e.target.value || null }))} />
            </label>
            <label className="grow">Prazo
              <input type="date" value={t.due ?? ''} disabled={!edit} min={t.start ?? undefined} onChange={e => run(updateTask(t.id, { due: e.target.value || null }))} />
            </label>
          </div>

          <div className="row gap wrap">
            <label className="grow">Prioridade
              <select value={t.priority ?? ''} disabled={!edit} onChange={e => run(updateTask(t.id, { priority: (e.target.value || null) as Priority | null }))}>
                <option value="">Sem prioridade</option>
                <option value="alta">Alta</option>
                <option value="media">Média</option>
                <option value="baixa">Baixa</option>
              </select>
            </label>
            <label className="grow">Lembrete
              <input type="datetime-local" value={localDT(t.remind_at)} disabled={!edit} onChange={e => run(updateTask(t.id, { remind_at: e.target.value ? new Date(e.target.value).toISOString() : null }))} />
            </label>
          </div>

          <div className="field">
            <h3>Checklist{t.checklist.length > 0 && <span className="muted small"> · {t.checklist.filter(c => c.done).length}/{t.checklist.length}</span>}</h3>
            <ul className="checklist">
              {t.checklist.map(c => (
                <li key={c.id} className={c.done ? 'done' : ''}>
                  <label><input type="checkbox" checked={c.done} disabled={!edit} onChange={() => setList(t.checklist.map(x => (x.id === c.id ? { ...x, done: !x.done } : x)))} />{c.text}</label>
                  {edit && <button className="icon" onClick={() => setList(t.checklist.filter(x => x.id !== c.id))} title="Tirar item">✕</button>}
                </li>
              ))}
              {!t.checklist.length && !edit && <li className="muted">Sem checklist.</li>}
            </ul>
            {edit && (
              <input value={item} maxLength={140} placeholder="+ item (Enter)" onChange={e => setItem(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addItem() } }} />
            )}
          </div>

          <div className="field">
            <h3>Projeto e critérios</h3>
            <div className="row gap wrap">
              <select
                className="add-person" value={t.project_id ?? ''} disabled={!edit || t.status === 'review'}
                onChange={e => run(setProject(t.id, e.target.value || null))}
                style={proj ? { borderColor: proj.color } : undefined}
              >
                <option value="">Sem projeto (sem aprovação)</option>
                {Object.values(projects).filter(p => !p.archived || p.id === t.project_id).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              {proj && <span className="muted small">Mestre: <b>{name(proj.master_id)}</b>{appr ? ' · aprova a entrega' : ' · você é o mestre'}</span>}
            </div>
            <ul className="critlist">
              {proj?.criteria.map((c, i) => <li key={'p' + i} className="fixed" title="Critério do projeto">📏 {c}</li>)}
              {t.criteria.map((c, i) => (
                <li key={'t' + i}>☐ {c}
                  {edit && <button className="icon" onClick={() => run(setCriteria(t.id, t.criteria.filter((_, j) => j !== i)))} title="Tirar critério">✕</button>}
                </li>
              ))}
              {!proj?.criteria.length && !t.criteria.length && <li className="muted">Nenhum critério.</li>}
            </ul>
            {edit && (
              <div className="row gap">
                <input className="grow" value={crit} maxLength={140} placeholder="+ critério só desta tarefa (Enter)" onChange={e => setCrit(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCrit() } }} />
              </div>
            )}
            {t.reviews.length > 0 && <><h3 className="mt">Histórico de aprovação</h3><ReviewHistory t={t} /></>}
          </div>

          <div className="field">
            <h3>Pessoas</h3>
            <div className="people">
              {person(t.owner_id, 'responsável')}
              {targets.length > 0 && (
                <select className="add-person" value="" onChange={e => e.target.value && run(reassign(t.id, e.target.value))} title="Trocar o responsável">
                  <option value="">⇄ passar para…</option>
                  {targets.map(p => <option key={p.id} value={p.id}>{p.name} · {p.role || rankName(p)}</option>)}
                </select>
              )}
              {t.created_by !== t.owner_id && person(t.created_by, 'pediu')}
              {t.collaborators.map(uid => person(uid, 'colabora', edit ? () => run(updateTask(t.id, { collaborators: t.collaborators.filter(x => x !== uid) })) : undefined))}
              {edit && free.length > 0 && (
                <select className="add-person" value="" onChange={e => e.target.value && run(updateTask(t.id, { collaborators: [...t.collaborators, e.target.value] }))}>
                  <option value="">+ colaborador</option>
                  {free.map(p => <option key={p.id} value={p.id}>{p.name} · {p.role || rankName(p)}</option>)}
                </select>
              )}
            </div>
          </div>

          <div
            className={'field drop' + (over ? ' over' : '')}
            onDragOver={e => { if (edit && e.dataTransfer.types.includes('Files')) { e.preventDefault(); setOver(true) } }}
            onDragLeave={() => setOver(false)}
            onDrop={e => { e.preventDefault(); setOver(false); upload([...e.dataTransfer.files]) }}
          >
            <h3>Arquivos e imagens <span className="count">{t.attachments.length}</span></h3>
            <div className="atts">
              {t.attachments.map(a => (
                <Thumb key={a.id} a={a} onZoom={setZoom} onDel={edit && (a.by === meId || own || chief) ? () => run(removeAttachment(t.id, a.id)) : undefined} />
              ))}
              {sending > 0 && <div className="att"><div className="att-box sending">⏳</div><div className="att-name">enviando {sending}…</div></div>}
              {edit && (
                <button className="att add" onClick={() => fileRef.current?.click()} disabled={sending > 0}>
                  <span>＋</span><small>Arraste, cole (Ctrl+V) ou clique</small>
                </button>
              )}
            </div>
            {!edit && t.attachments.length === 0 && <p className="empty">Nenhum arquivo.</p>}
            <input ref={fileRef} type="file" multiple hidden onChange={e => { upload([...(e.target.files ?? [])]); e.target.value = '' }} />
          </div>

          <div className="field">
            <h3>Notas <span className="count">{notes.length}</span></h3>
            <div className="thread" ref={thread}>
              {notes.length === 0 && <p className="empty">Ninguém comentou ainda.</p>}
              {notes.map(n => (
                <div key={n.id} className={'note' + (n.author_id === meId ? ' me' : '')}>
                  <MiniAvatar avatar={profiles[n.author_id]?.avatar ?? null} photo={profiles[n.author_id]?.photo ?? null} size={26} />
                  <div className="grow">
                    <div className="muted small"><b>{name(n.author_id)}</b> · {when(n.created_at)}
                      {(n.author_id === meId || chief) && <button className="icon" onClick={() => run(removeNote(n.id))} title="Apagar nota">🗑</button>}
                    </div>
                    <p>{n.body}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="row gap">
              <textarea
                className="grow"
                rows={1}
                value={note}
                maxLength={2000}
                placeholder="Escreva uma nota… (Enter envia)"
                onChange={e => setNote(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              />
              <button className="btn primary" onClick={send} disabled={!note.trim()}>Enviar</button>
            </div>
          </div>
        </div>

        <footer className="task-foot">
          {own && t.status === 'inbox' && <>
            <button className="btn primary sm" onClick={() => run(acceptRequest(t.id))}>Aceitar</button>
            <button className="btn ghost sm" onClick={() => run(declineRequest(t.id))}>Recusar</button>
          </>}
          {move && t.status === 'todo' && <button className="btn primary sm" onClick={() => run(setStatus(t.id, 'doing'))}>▶ Começar</button>}
          {move && t.status === 'doing' && <button className="btn ghost sm" onClick={() => run(setStatus(t.id, 'todo'))}>⏸ Pausar</button>}
          {move && (t.status === 'todo' || t.status === 'doing') && <button className="btn primary sm" onClick={() => run(setStatus(t.id, 'done'))}>{toReview ? '↑ Enviar para aprovação' : '✓ Concluir'}</button>}
          {own && t.status === 'review' && <button className="btn ghost sm" onClick={() => run(setStatus(t.id, 'doing'))}>↩ Retirar da aprovação</button>}
          {move && t.status === 'done' && <button className="btn ghost sm" onClick={() => run(setStatus(t.id, 'todo'))}>Reabrir</button>}
          <span className="grow" />
          {canDelete && (sure
            ? <button className="btn danger sm" onClick={() => run(removeTask(t.id))} onBlur={() => setSure(false)}>Confirmar exclusão</button>
            : <button className="btn ghost sm" onClick={() => setSure(true)}>🗑 Excluir</button>)}
        </footer>
      </div>
      {zoom && <div className="zoom" onMouseDown={() => setZoom(null)}><img src={zoom} alt="" /></div>}
    </div>
  )
}
