import { useEffect, useRef, useState } from 'react'
import { canAssign, rankName } from '../game/ranks'
import { acceptRequest, addTask, declineRequest, removeTask, run, setUi, useStore, type DeskView as View } from '../store'
import type { Task } from '../types'
import Board from './Board'
import MiniAvatar from './MiniAvatar'

const SW = 200, SH = 72
const OUT = '#1b2240'
type R = (c: string, x: number, y: number, w: number, h: number) => void

/** Cena da mesa vista de frente: computador (pedidos) e pasta (tarefas). */
function drawScene(c: CanvasRenderingContext2D, o: { view: View; inbox: number; todo: number; t: number }) {
  const r: R = (col, x, y, w, h) => { c.fillStyle = col; c.fillRect(x, y, w, h) }
  const frame = (x: number, y: number, w: number, h: number) => { r('#FBC222', x, y, w, 2); r('#FBC222', x, y + h - 2, w, 2); r('#FBC222', x, y, 2, h); r('#FBC222', x + w - 2, y, 2, h) }
  // parede + rodapé da janela
  r('#e9e4d8', 0, 0, SW, 46)
  r('#ddd6c6', 0, 40, SW, 6)
  r(OUT, 14, 6, 30, 22); r('#9fd3f0', 15, 7, 28, 20); r('#c8e8f8', 15, 7, 28, 6); r(OUT, 28, 7, 1, 20); r(OUT, 15, 16, 28, 1)
  r(OUT, 152, 8, 18, 18); r('#fff', 153, 9, 16, 16); r(OUT, 160, 12, 1, 6); r(OUT, 161, 17, 4, 1) // relógio
  // tampo
  r(OUT, 0, 45, SW, 1)
  r('#c99566', 0, 46, SW, 3)
  r('#b07a4f', 0, 49, SW, 11)
  r('#8a5a36', 0, 60, SW, 12)
  r('#6e4529', 0, 60, SW, 1)
  // caneca e planta
  r(OUT, 20, 36, 10, 12); r('#fff', 21, 37, 8, 10); r('#FBC222', 21, 39, 8, 2); r(OUT, 30, 39, 3, 6); r('#fff', 30, 40, 2, 4)
  const sway = Math.sin(o.t / 900) > 0 ? 1 : 0
  r(OUT, 179, 37, 14, 11); r('#c9643c', 180, 38, 12, 9)
  r('#3fa66b', 181 + sway, 26, 4, 12); r('#57c283', 186, 22, 4, 16); r('#3fa66b', 190 - sway, 28, 3, 10)

  // computador
  const pcOn = o.view === 'pc'
  r(OUT, 54, 5, 60, 40)
  r('#c9ced8', 55, 6, 58, 38)
  r(OUT, 58, 9, 52, 30)
  r(pcOn ? '#1a3478' : '#24305a', 59, 10, 50, 28)
  r('#FBC222', 59, 10, 50, 4)
  for (let i = 0; i < 4; i++) r(pcOn ? '#8ecbf5' : '#5d6c99', 62, 17 + i * 5, 24 + ((i * 7) % 18), 2)
  if (o.inbox > 0) {
    const blink = Math.sin(o.t / 260) > -0.2
    r(OUT, 100, 15, 8, 8); r(blink ? '#e5483a' : '#b23427', 101, 16, 6, 6)
  }
  if (pcOn) frame(51, 2, 66, 46)
  r('#9aa3b5', 80, 44, 8, 3); r(OUT, 74, 47, 20, 2)
  r(OUT, 62, 52, 44, 6); r('#e3e6ef', 63, 53, 42, 4)
  for (let i = 0; i < 10; i++) r('#c9ced8', 64 + i * 4, 54, 3, 2)

  // pasta
  const fOn = o.view === 'pasta'
  const papers = Math.min(o.todo, 4)
  for (let i = 0; i < papers; i++) r(i % 2 ? '#fff' : '#f4f5f9', 132 + i * 2, 26 + (3 - i), 26, 10)
  r(OUT, 128, 27, 14, 4); r('#d9a54e', 129, 28, 12, 3) // aba
  r(OUT, 128, 30, 38, 22)
  r('#e2b25a', 129, 31, 36, 20)
  r('#f0c674', 129, 31, 36, 2)
  r('#c8963f', 129, 49, 36, 2)
  r(OUT, 140, 38, 14, 6); r('#fff', 141, 39, 12, 4); r('#9aa3b5', 142, 41, 8, 1) // etiqueta
  if (fOn) frame(124, 23, 46, 32)
}

function Scene({ view, inbox, todo }: { view: View; inbox: number; todo: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const st = useRef({ view, inbox, todo })
  st.current = { view, inbox, todo }
  useEffect(() => {
    const c = ref.current!.getContext('2d')!
    let raf = 0
    const loop = (t: number) => { drawScene(c, { ...st.current, t }); raf = requestAnimationFrame(loop) }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])
  const pick = (v: View) => setUi({ deskView: v })
  return (
    <div className="desk-scene">
      <canvas ref={ref} width={SW} height={SH} />
      <button className={'hot pc' + (view === 'pc' ? ' on' : '')} onClick={() => pick('pc')}>
        <span>🖥 Solicitações{inbox > 0 && <b className="badge">{inbox}</b>}</span>
      </button>
      <button className={'hot pasta' + (view === 'pasta' ? ' on' : '')} onClick={() => pick('pasta')}>
        <span>🗂 Tarefas{todo > 0 && <b className="count">{todo}</b>}</span>
      </button>
    </div>
  )
}

const STATUS: Record<Task['status'], string> = { inbox: 'aguardando', todo: 'na pasta', doing: 'fazendo', done: 'feito ✅', declined: 'recusado' }
const recent = (t: Task) => t.status !== 'done' || (!!t.done_at && Date.now() - new Date(t.done_at).getTime() < 3 * 864e5)
const dueTxt = (d: string | null) => (d ? ' · 📅 ' + new Date(d + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '')

function Computer({ ownerId }: { ownerId: string }) {
  const meId = useStore(s => s.meId)!
  const profiles = useStore(s => s.profiles)
  const tasks = Object.values(useStore(s => s.tasks))
  const owner = profiles[ownerId]
  const mine = ownerId === meId
  const [title, setTitle] = useState('')
  const [due, setDue] = useState('')
  const [notes, setNotes] = useState('')
  const name = (id: string) => profiles[id]?.name ?? 'Alguém'

  const inbox = tasks.filter(t => t.owner_id === meId && t.status === 'inbox').sort((a, b) => b.position - a.position)
  const sent = tasks
    .filter(t => t.created_by === meId && t.owner_id !== meId && (mine || t.owner_id === ownerId) && recent(t))
    .sort((a, b) => b.position - a.position)
  const direct = canAssign(profiles[meId], owner)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    run(addTask(ownerId, title, due || null, notes.trim()))
    setTitle(''); setDue(''); setNotes('')
  }

  return (
    <div className="pc-screen">
      <div className="pc-bar"><i /><i /><i /><span>{mine ? 'Solicitações' : `Falar com ${owner?.name}`}</span></div>
      <div className="pc-body">
        {mine && (
          <section>
            <h3>Caixa de entrada <span className="count">{inbox.length}</span></h3>
            {inbox.length === 0 && <p className="empty">Nenhum pedido esperando. 🎉</p>}
            {inbox.map(t => (
              <div key={t.id} className="mail">
                <MiniAvatar avatar={profiles[t.created_by]?.avatar ?? null} photo={profiles[t.created_by]?.photo ?? null} size={34} />
                <div className="grow">
                  <div className="muted small">{name(t.created_by)} pediu{dueTxt(t.due)}</div>
                  <b>{t.title}</b>
                  {t.notes && <p className="small">{t.notes}</p>}
                </div>
                <div className="col">
                  <button className="btn primary sm" onClick={() => run(acceptRequest(t.id))}>Aceitar</button>
                  <button className="btn ghost sm" onClick={() => run(declineRequest(t.id))}>Recusar</button>
                </div>
              </div>
            ))}
          </section>
        )}
        {!mine && owner && (
          <form className="pc-form" onSubmit={submit}>
            <h3>{direct ? `Passar tarefa para ${owner.name}` : `Pedir algo para ${owner.name}`}</h3>
            <p className="muted small">
              {direct ? 'Seu cargo é maior: vai direto para a pasta da pessoa.' : 'Chega como solicitação — a pessoa aceita ou recusa.'}
            </p>
            <input required value={title} onChange={e => setTitle(e.target.value)} maxLength={140} placeholder="O que precisa ser feito?" />
            <div className="row gap">
              <input type="date" value={due} onChange={e => setDue(e.target.value)} title="Prazo (opcional)" />
              <input className="grow" value={notes} onChange={e => setNotes(e.target.value)} maxLength={600} placeholder="Detalhes (opcional)" />
            </div>
            <button className="btn primary" disabled={!title.trim()}>{direct ? 'Colocar na pasta' : 'Enviar pedido'}</button>
          </form>
        )}
        <section>
          <h3>{mine ? 'Enviados por você' : `Seus pedidos para ${owner?.name}`} <span className="count">{sent.length}</span></h3>
          {sent.length === 0 && <p className="empty">Nada enviado{mine ? '' : ' ainda'}.</p>}
          {sent.map(t => (
            <div key={t.id} className={'mail sent ' + t.status}>
              <div className="grow">
                {mine && <div className="muted small">para {name(t.owner_id)}{dueTxt(t.due)}</div>}
                <b>{t.title}</b>
              </div>
              <span className={'chip st ' + t.status}>{STATUS[t.status]}</span>
              {(t.status === 'inbox' || t.status === 'declined') && (
                <button className="icon" title={t.status === 'inbox' ? 'Cancelar pedido' : 'Limpar'} onClick={() => run(removeTask(t.id))}>🗑</button>
              )}
            </div>
          ))}
        </section>
      </div>
    </div>
  )
}

export default function DeskView() {
  const id = useStore(s => s.desk)!
  const view = useStore(s => s.deskView)
  const meId = useStore(s => s.meId)!
  const profiles = useStore(s => s.profiles)
  const tasksMap = useStore(s => s.tasks)
  const online = useStore(s => s.online)
  const owner = profiles[id]
  const close = () => setUi({ desk: null })
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [])
  if (!owner) return null
  const tasks = Object.values(tasksMap)
  const mine = id === meId
  const inbox = mine ? tasks.filter(t => t.owner_id === id && t.status === 'inbox').length : 0
  const todo = tasks.filter(t => t.owner_id === id && (t.status === 'todo' || t.status === 'doing')).length
  const here = mine || online.has(id)

  return (
    <div className="modal-bg" onMouseDown={e => e.target === e.currentTarget && close()}>
      <div className="desk-modal">
        <header className="desk-top">
          <MiniAvatar avatar={owner.avatar} photo={owner.photo} size={40} />
          <div className="grow">
            <h2>{mine ? 'Minha mesa' : `Mesa de ${owner.name}`}</h2>
            <div className="muted small">
              {rankName(owner)}{owner.role && ` · ${owner.role}`} · <span className={here ? 'on' : 'off'}>{here ? 'no escritório' : 'fora'}</span>
            </div>
          </div>
          <button className="btn ghost sm" onClick={close} aria-label="Fechar">✕</button>
        </header>
        <Scene view={view} inbox={inbox} todo={todo} />
        <div className="desk-body">{view === 'pasta' ? <Board ownerId={id} bare /> : <Computer ownerId={id} />}</div>
      </div>
    </div>
  )
}
