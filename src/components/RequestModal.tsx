import { useRef, useState } from 'react'
import { canAssign } from '../game/ranks'
import { addTask, attachFiles, run, setUi, useStore } from '../store'
import { Ph } from './Icon'
import MiniAvatar from './MiniAvatar'

export default function RequestModal() {
  const to = useStore(s => s.requestTo)
  const profiles = useStore(s => s.profiles)
  const meId = useStore(s => s.meId)
  const [title, setTitle] = useState('')
  const [due, setDue] = useState('')
  const [hora, setHora] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [over, setOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const p = to ? profiles[to] : null
  if (!p) return null
  const direct = canAssign(meId ? profiles[meId] : undefined, p)
  const close = () => { setUi({ requestTo: null }); setTitle(''); setDue(''); setHora(''); setNotes(''); setFiles([]) }
  const add = (f: File[]) => f.length && setFiles(xs => [...xs, ...f.filter(n => !xs.some(x => x.name === n.name && x.size === n.size))].slice(0, 10))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    run(addTask(p.id, title, due || null, notes.trim(), 'todo', null, { due_time: hora || null }).then(t => files.length ? attachFiles(t.id, files) : undefined).then(close).finally(() => setBusy(false)))
  }

  return (
    <div className="modal-bg" onMouseDown={e => e.target === e.currentTarget && close()}>
      <form className="modal" onSubmit={submit} onPaste={e => { const f = [...e.clipboardData.files]; if (f.length) { e.preventDefault(); add(f) } }}>
        <header className="row gap">
          <MiniAvatar avatar={p.avatar} photo={p.photo} name={p.name} size={44} />
          <div><h2>{direct ? 'Passar tarefa para' : 'Pedir algo para'} {p.name}</h2><div className="muted small">{direct ? 'Vai direto para a pasta da pessoa.' : 'Chega no computador da pessoa para aceitar ou recusar.'} Concluir rende +5 XP extra.</div></div>
        </header>
        <label>O que você precisa?<input autoFocus required value={title} onChange={e => setTitle(e.target.value)} maxLength={140} placeholder="Ex.: Revisar a proposta de sábado" /></label>
        <div className="row gap">
          <label className="grow">Entrega (opcional)<input type="date" value={due} onChange={e => { setDue(e.target.value); if (!e.target.value) setHora('') }} /></label>
          <label>Horário<input type="time" value={hora} disabled={!due} onChange={e => setHora(e.target.value)} /></label>
        </div>
        <label>Detalhes (opcional)<textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} maxLength={600} /></label>
        <div
          className={'rq-anexos' + (over ? ' over' : '')}
          onDragOver={e => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setOver(true) } }}
          onDragLeave={() => setOver(false)}
          onDrop={e => { e.preventDefault(); setOver(false); add([...e.dataTransfer.files]) }}
        >
          <span className="rq-anexos-t">Anexos <small>(opcional)</small></span>
          {files.map((f, i) => (
            <span key={f.name + f.size} className="rq-file" title={f.name}>
              <Ph n={f.type.startsWith('image/') ? 'images' : 'file-text'} size={14} />{f.name}
              <button type="button" onClick={() => setFiles(xs => xs.filter((_, j) => j !== i))} aria-label={'Tirar ' + f.name}><Ph n="x" size={12} /></button>
            </span>
          ))}
          <button type="button" className="rq-add" onClick={() => fileRef.current?.click()}><Ph n="paperclip" size={15} />{files.length ? 'Mais' : 'Anexar arquivo'}</button>
          {!files.length && <small className="rq-dica">ou arraste / cole aqui</small>}
          <input ref={fileRef} type="file" multiple hidden onChange={e => { add([...(e.target.files ?? [])]); e.target.value = '' }} />
        </div>
        <footer className="row gap end">
          <button type="button" className="btn ghost" onClick={close}>Cancelar</button>
          <button className="btn primary" disabled={!title.trim() || busy}>{busy ? (files.length ? 'Enviando anexos…' : 'Enviando…') : direct ? 'Colocar na pasta' : 'Enviar pedido'}</button>
        </footer>
      </form>
    </div>
  )
}
