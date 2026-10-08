import { useState } from 'react'
import { canAssign } from '../game/ranks'
import { addTask, run, setUi, useStore } from '../store'
import MiniAvatar from './MiniAvatar'

export default function RequestModal() {
  const to = useStore(s => s.requestTo)
  const profiles = useStore(s => s.profiles)
  const meId = useStore(s => s.meId)
  const [title, setTitle] = useState('')
  const [due, setDue] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const p = to ? profiles[to] : null
  if (!p) return null
  const direct = canAssign(meId ? profiles[meId] : undefined, p)
  const close = () => { setUi({ requestTo: null }); setTitle(''); setDue(''); setNotes('') }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    run(addTask(p.id, title, due || null, notes.trim()).then(close).finally(() => setBusy(false)))
  }

  return (
    <div className="modal-bg" onMouseDown={e => e.target === e.currentTarget && close()}>
      <form className="modal" onSubmit={submit}>
        <header className="row gap">
          <MiniAvatar avatar={p.avatar} photo={p.photo} name={p.name} size={44} />
          <div><h2>{direct ? 'Passar tarefa para' : 'Pedir algo para'} {p.name}</h2><div className="muted small">{direct ? 'Vai direto para a pasta da pessoa.' : 'Chega no computador da pessoa para aceitar ou recusar.'} Concluir rende +5 XP extra.</div></div>
        </header>
        <label>O que você precisa?<input autoFocus required value={title} onChange={e => setTitle(e.target.value)} maxLength={140} placeholder="Ex.: Revisar o texto do post de sábado" /></label>
        <label>Prazo (opcional)<input type="date" value={due} onChange={e => setDue(e.target.value)} /></label>
        <label>Detalhes (opcional)<textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} maxLength={600} /></label>
        <footer className="row gap end">
          <button type="button" className="btn ghost" onClick={close}>Cancelar</button>
          <button className="btn primary" disabled={!title.trim() || busy}>{busy ? 'Enviando…' : direct ? 'Colocar na pasta' : 'Enviar pedido'}</button>
        </footer>
      </form>
    </div>
  )
}
