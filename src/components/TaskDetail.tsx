import { useEffect, useRef, useState } from 'react'
import { isChief, rankName } from '../game/ranks'
import {
  acceptRequest, addNote, approverOf, attachFiles, canApprove, canAskReview, canFinish, CHEFIA, canEditTask, canMove, canReassign, declineRequest, reassign, fileUrl, removeAttachment, removeNote, removeTask, run,
  setCriteria, setProject, setStatus, setUi, stageList, stageOf, updateTask, useStore,
} from '../store'
import { hasCanais } from '../store'
import type { Attachment, Channel, CheckItem, Priority, Task } from '../types'
import { CHANNEL_KEYS, CHANNELS } from './v4'
import { FolderBox } from './DriveFolder'
import { Ph } from './Icon'
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

/** Etapas do quadro em fila: clicar move o cartão. Muitas etapas → rola para o lado. */
function Etapas({ t, can }: { t: Task; can: boolean }) {
  const rows = useStore(s => s.rows.stages)
  const list = stageList(rows)
  const cur = stageOf(t, list)
  const at = list.findIndex(s => s.id === cur)
  const box = useRef<HTMLDivElement>(null)
  const [edge, setEdge] = useState({ l: false, r: false })
  const look = () => { const b = box.current; if (b) setEdge({ l: b.scrollLeft > 4, r: b.scrollLeft + b.clientWidth < b.scrollWidth - 4 }) }
  useEffect(() => {
    box.current?.querySelector<HTMLElement>('.on')?.scrollIntoView({ block: 'nearest', inline: 'center' })
    look()
  }, [cur, list.length])
  if (t.status === 'inbox' || t.status === 'declined') return null
  const go = (d: number) => box.current?.scrollBy({ left: d * box.current.clientWidth * .7, behavior: 'smooth' })
  return (
    <div className="etapas">
      {edge.l && <button className="etapas-arrow l" onClick={() => go(-1)} aria-label="Etapas anteriores">‹</button>}
      <div className="etapas-row" ref={box} onScroll={look}>
        {list.map((s, i) => (
          <button key={s.id} className={'etapa k-' + s.kind + (s.id === cur ? ' on' : i < at ? ' past' : '')} disabled={!can || s.id === cur}
            title={can ? (s.id === cur ? 'Etapa atual' : 'Mover para ' + s.label) : 'Só quem é responsável (ou um cargo acima) muda a etapa'}
            onClick={() => run(setStatus(t.id, s.kind, Date.now(), s.id))}>
            <i>{i < at ? '✓' : i + 1}</i>{s.label}
          </button>
        ))}
      </div>
      {edge.r && <button className="etapas-arrow r" onClick={() => go(1)} aria-label="Próximas etapas">›</button>}
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
      <MiniAvatar avatar={profiles[uid]?.avatar ?? null} photo={profiles[uid]?.photo ?? null} name={profiles[uid]?.name} size={22} />
      {name(uid)}{tag && <small>{tag}</small>}
      {del && <button onClick={del} title="Tirar da tarefa">✕</button>}
    </span>
  )

  return (
    <div className="modal-bg" onMouseDown={e => e.target === e.currentTarget && close()}>
      <div
        className="task-modal td2"
        onPaste={e => { const f = [...e.clipboardData.files]; if (f.length && edit) { e.preventDefault(); upload(f) } }}
      >
        <header className="task-top">
          <span className={'chip st ' + t.status}>{STATUS[t.status]}</span>
          <span className="muted small grow">
            Pasta de <b>{name(t.owner_id)}</b> · criada por {t.created_by === meId ? 'você' : name(t.created_by)} em {when(t.created_at)}
          </span>
          <button className="btn ghost sm" onClick={close} aria-label="Fechar">✕</button>
        </header>

        <Etapas t={t} can={move || approve || canFinish(t)} />

        {last && !last.ok && t.status !== 'done' && t.status !== 'review' && (
          <div className="rvbanner">
            <b>↺ Reprovada por {name(last.by)}:</b> {last.reason}
            {last.failed.length > 0 && <div className="rvfail">{last.failed.map(c => <span key={c}>✕ {c}</span>)}</div>}
          </div>
        )}
        {t.status === 'review' && (approve
          ? <div className="rvpanel"><h3>Sua aprovação</h3><ReviewBox t={t} /></div>
          : <div className="rvbanner wait">⏳ Esperando a aprovação {appr === CHEFIA ? <>de <b>um cargo acima</b>{t.owner_id === meId && <> — opcional: você mesmo pode levar para <b>Feito</b></>}</> : <>de <b>{appr ? name(appr) : 'alguém'}</b></>}.</div>)}

        <div className="task-body td2-body">
          <div className="td2-main">
            <input
              key={'t' + t.title}
              className="task-title"
              defaultValue={t.title}
              readOnly={!edit}
              maxLength={140}
              onBlur={e => run(updateTask(t.id, { title: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
            />

            <textarea
              key={'n' + t.notes}
              className="td2-desc"
              defaultValue={t.notes}
              readOnly={!edit}
              rows={3}
              maxLength={4000}
              aria-label="Descrição / legenda"
              placeholder={edit ? 'Descrição, legenda, links, detalhes…' : 'Sem descrição.'}
              onBlur={e => run(updateTask(t.id, { notes: e.target.value }))}
            />

            <div className="field">
              <h3>Checklist{t.checklist.length > 0 && <span className="muted small"> · {t.checklist.filter(c => c.done).length}/{t.checklist.length}</span>}</h3>
              {t.checklist.length > 0 && <i className="td2-bar"><i style={{ width: Math.round(100 * t.checklist.filter(c => c.done).length / t.checklist.length) + '%' }} /></i>}
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

            <FolderBox
              link={t.drive ?? proj?.drive ?? null} own={!!t.drive} edit={edit} suggest={t.title} base={proj?.drive ?? null}
              onLink={l => run(updateTask(t.id, { drive: l }))} onZoom={setZoom}
            />

            <div
              className={'field td-anexos' + (over ? ' over' : '')}
              onDragOver={e => { if (edit && e.dataTransfer.types.includes('Files')) { e.preventDefault(); setOver(true) } }}
              onDragLeave={() => setOver(false)}
              onDrop={e => { e.preventDefault(); setOver(false); upload([...e.dataTransfer.files]) }}
            >
              <div className="td-anexos-h">
                <h3>Anexos{t.attachments.length > 0 && <span className="count">{t.attachments.length}</span>}</h3>
                {edit && t.attachments.length > 0 && <button type="button" className="td-anexos-mais" onClick={() => fileRef.current?.click()} disabled={sending > 0}><Ph n="plus" size={13} />Anexar</button>}
              </div>
              {(t.attachments.length > 0 || sending > 0) && <div className="atts">
                {t.attachments.map(a => (
                  <Thumb key={a.id} a={a} onZoom={setZoom} onDel={edit && (a.by === meId || own || chief) ? () => run(removeAttachment(t.id, a.id)) : undefined} />
                ))}
                {sending > 0 && <div className="att"><div className="att-box sending">⏳</div><div className="att-name">enviando {sending}…</div></div>}
              </div>}
              {t.attachments.length === 0 && sending === 0 && (edit
                ? <button type="button" className="td-anexos-vazio" onClick={() => fileRef.current?.click()}>
                    <span className="td-anexos-ic"><Ph n="paperclip" size={18} /></span>
                    <span><b>Anexar arquivo</b><small>Clique, arraste pra cá ou cole com Ctrl+V</small></span>
                  </button>
                : <p className="td-anexos-nada">Nenhum arquivo.</p>)}
              {over && <div className="td-anexos-solta"><Ph n="upload-simple" size={22} />Solte pra anexar</div>}
              <input ref={fileRef} type="file" multiple hidden onChange={e => { upload([...(e.target.files ?? [])]); e.target.value = '' }} />
            </div>

            <div className="field">
              <h3>Critérios de aprovação</h3>
              <ul className="critlist">
                {proj?.criteria.map((c, i) => <li key={'p' + i} className="fixed" title="Critério do projeto">📏 {c}</li>)}
                {t.criteria.map((c, i) => (
                  <li key={'t' + i}>☐ {c}
                    {edit && <button className="icon" onClick={() => run(setCriteria(t.id, t.criteria.filter((_, j) => j !== i)))} title="Tirar critério">✕</button>}
                  </li>
                ))}
                {!proj?.criteria.length && !t.criteria.length && <li className="muted">Nenhum critério{proj ? '' : ' · sem projeto, a aprovação é opcional'}.</li>}
              </ul>
              {edit && (
                <input value={crit} maxLength={140} placeholder="+ critério só desta tarefa (Enter)" onChange={e => setCrit(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCrit() } }} />
              )}
              {t.reviews.length > 0 && <><h3 className="mt">Histórico de aprovação</h3><ReviewHistory t={t} /></>}
            </div>
          </div>

          <aside className="td2-side">
            <div className="td2-props">
              <div className="prop"><span>Responsável</span>
                <div className="people">
                  {person(t.owner_id, '')}
                  {targets.length > 0 && (
                    <select className="add-person swap" value="" onChange={e => e.target.value && run(reassign(t.id, e.target.value))} title="Passar para outra pessoa">
                      <option value="">⇄</option>
                      {targets.map(p => <option key={p.id} value={p.id}>{p.name} · {p.role || rankName(p)}</option>)}
                    </select>
                  )}
                </div>
              </div>
              {t.created_by !== t.owner_id && <div className="prop"><span>Pediu</span><div className="people">{person(t.created_by, '')}</div></div>}
              <div className="prop"><span>Colaboram</span>
                <div className="people">
                  {t.collaborators.map(uid => person(uid, '', edit ? () => run(updateTask(t.id, { collaborators: t.collaborators.filter(x => x !== uid) })) : undefined))}
                  {edit && free.length > 0 && (
                    <select className="add-person" value="" onChange={e => e.target.value && run(updateTask(t.id, { collaborators: [...t.collaborators, e.target.value] }))}>
                      <option value="">+ pessoa</option>
                      {free.map(p => <option key={p.id} value={p.id}>{p.name} · {p.role || rankName(p)}</option>)}
                    </select>
                  )}
                  {!edit && !t.collaborators.length && <small className="muted">—</small>}
                </div>
              </div>
              <label className="prop"><span>Início</span>
                <input type="date" value={t.start ?? ''} disabled={!edit} max={t.due ?? undefined} onChange={e => run(updateTask(t.id, { start: e.target.value || null }))} />
              </label>
              <label className="prop"><span>Prazo</span>
                <input type="date" value={t.due ?? ''} disabled={!edit} min={t.start ?? undefined} onChange={e => run(updateTask(t.id, { due: e.target.value || null }))} />
              </label>
              <label className="prop"><span>Prioridade</span>
                <select value={t.priority ?? ''} disabled={!edit} onChange={e => run(updateTask(t.id, { priority: (e.target.value || null) as Priority | null }))}>
                  <option value="">—</option>
                  <option value="alta">Alta</option>
                  <option value="media">Média</option>
                  <option value="baixa">Baixa</option>
                </select>
              </label>
              <label className="prop"><span>Lembrete</span>
                <input type="datetime-local" value={localDT(t.remind_at)} disabled={!edit} onChange={e => run(updateTask(t.id, { remind_at: e.target.value ? new Date(e.target.value).toISOString() : null }))} />
              </label>
              <label className="prop"><span>Projeto</span>
                <select value={t.project_id ?? ''} disabled={!edit || t.status === 'review'} onChange={e => run(setProject(t.id, e.target.value || null))}
                  style={proj ? { color: proj.color, fontWeight: 600 } : undefined}>
                  <option value="">Sem projeto</option>
                  {Object.values(projects).filter(p => !p.archived || p.id === t.project_id).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
              {!proj && appr && <div className="prop"><span>Aprova</span><small>{appr === CHEFIA ? 'Cargo acima' : name(appr)}</small></div>}
              {proj && <div className="prop"><span>Aprova</span><small>{name(proj.master_id)}{appr ? '' : ' (você)'}</small></div>}
              {(hasCanais(t.dept || 'marketing') || t.channel) && <label className="prop"><span>Canal</span>
                <select value={t.channel ?? ''} disabled={!edit} onChange={e => run(updateTask(t.id, { channel: (e.target.value || null) as Channel | null, ...(!e.target.value ? { publish_at: null } : {}) }))}>
                  <option value="">Não é post</option>
                  {CHANNEL_KEYS.map(c => <option key={c} value={c}>{CHANNELS[c].label}</option>)}
                </select>
              </label>}
              {t.channel && <label className="prop"><span>Publicar em</span>
                <input type="datetime-local" value={localDT(t.publish_at)} disabled={!edit} onChange={e => run(updateTask(t.id, { publish_at: e.target.value ? new Date(e.target.value).toISOString() : null }))} />
              </label>}
            </div>

            <div className="field td2-chat">
              <h3>Conversa <span className="count">{notes.length}</span></h3>
              <div className="thread" ref={thread}>
                {notes.length === 0 && <p className="empty">Ninguém comentou ainda.</p>}
                {notes.map(n => (
                  <div key={n.id} className={'note' + (n.author_id === meId ? ' me' : '')}>
                    <MiniAvatar avatar={profiles[n.author_id]?.avatar ?? null} photo={profiles[n.author_id]?.photo ?? null} name={profiles[n.author_id]?.name} size={26} />
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
                  placeholder="Escreva… (Enter envia)"
                  onChange={e => setNote(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                />
                <button className="btn primary sm" onClick={send} disabled={!note.trim()}>Enviar</button>
              </div>
            </div>
          </aside>
        </div>

        <footer className="task-foot">
          {own && t.status === 'inbox' && <>
            <button className="btn primary sm" onClick={() => run(acceptRequest(t.id))}>Aceitar</button>
            <button className="btn ghost sm" onClick={() => run(declineRequest(t.id))}>Recusar</button>
          </>}
          {move && t.status === 'todo' && <button className="btn primary sm" onClick={() => run(setStatus(t.id, 'doing'))}>▶ Começar</button>}
          {move && t.status === 'doing' && <button className="btn ghost sm" onClick={() => run(setStatus(t.id, 'todo'))}>⏸ Pausar</button>}
          {move && (t.status === 'todo' || t.status === 'doing') && <button className="btn primary sm" onClick={() => run(setStatus(t.id, 'done'))}>{toReview ? '↑ Enviar para aprovação' : '✓ Concluir'}</button>}
          {move && (t.status === 'todo' || t.status === 'doing') && canAskReview(t) && <button className="btn ghost sm" onClick={() => run(setStatus(t.id, 'review'))} title={t.created_by !== t.owner_id ? 'Quem pediu aprova' : 'Um cargo acima aprova'}>↑ Pedir aprovação</button>}
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
