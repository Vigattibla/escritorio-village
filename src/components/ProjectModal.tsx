import { useState } from 'react'
import { isChief, rankName, rankOf } from '../game/ranks'
import { removeProject, run, saveProject, setUi, useStore } from '../store'

const COLORS = ['#e8a33d', '#3d8be8', '#2fb36d', '#d9493a', '#8e5cd9', '#1fa5a0', '#e05ea8', '#6b7a90']

/** Criar ou editar projeto: nome, mestre (aprova as entregas), cor e critérios de aprovação. */
export default function ProjectModal() {
  const edit = useStore(s => s.projectEdit)!
  const prev = useStore(s => (edit === 'new' ? undefined : s.projects[edit]))
  const profiles = useStore(s => s.profiles)
  const meId = useStore(s => s.meId)!
  const nProj = useStore(s => Object.keys(s.projects).length)
  const [name, setName] = useState(prev?.name ?? '')
  const [master, setMaster] = useState(prev?.master_id ?? meId)
  const [color, setColor] = useState(prev?.color ?? COLORS[nProj % COLORS.length])
  const [crit, setCrit] = useState<string[]>(prev?.criteria ?? [])
  const [draft, setDraft] = useState('')
  const [sure, setSure] = useState(false)
  const close = () => setUi({ projectEdit: null })
  const people = Object.values(profiles).sort((a, b) => rankOf(b) - rankOf(a) || a.name.localeCompare(b.name))
  const canDel = !!prev && (prev.created_by === meId || isChief(profiles[meId]))
  const add = () => { if (draft.trim()) { setCrit(c => [...c, draft.trim()]); setDraft('') } }
  const submit = () => {
    const all = draft.trim() ? [...crit, draft.trim()] : crit
    run(saveProject({ id: prev?.id, name, master_id: master, criteria: all, color }).then(p => { close(); setUi({ project: p.id, view: 'quadro' }) }))
  }

  return (
    <div className="modal-bg" onMouseDown={e => e.target === e.currentTarget && close()} onKeyDown={e => e.key === 'Escape' && close()}>
      <form className="task-modal proj-modal" onSubmit={e => { e.preventDefault(); submit() }} style={{ '--pc': color } as React.CSSProperties}>
        <header className="task-top">
          <span className="qproj-dot" />
          <b className="grow">{prev ? 'Editar projeto' : 'Novo projeto'}</b>
          <button type="button" className="btn ghost sm" onClick={close} aria-label="Fechar">✕</button>
        </header>
        <div className="task-body">
          <label>Nome
            <input autoFocus required maxLength={80} value={name} onChange={e => setName(e.target.value)} placeholder="Ex.: Semana das Crianças" />
          </label>
          <label>Mestre do projeto <small className="muted">— aprova ou reprova as entregas do time</small>
            <select value={master} onChange={e => setMaster(e.target.value)}>
              {people.map(p => <option key={p.id} value={p.id}>{p.id === meId ? `${p.name} (você)` : p.name} · {p.role || rankName(p)}</option>)}
            </select>
          </label>
          <div className="field">
            <h3>Cor</h3>
            <div className="row gap">
              {COLORS.map(c => (
                <button type="button" key={c} className={'swatch' + (c === color ? ' on' : '')} style={{ background: c }} onClick={() => setColor(c)} aria-label={c} />
              ))}
            </div>
          </div>
          <div className="field">
            <h3>Critérios de aprovação <span className="count">{crit.length}</span></h3>
            <ul className="critlist">
              {crit.map((c, i) => (
                <li key={i}>📏 {c}<button type="button" className="icon" onClick={() => setCrit(crit.filter((_, j) => j !== i))} title="Tirar">✕</button></li>
              ))}
              {!crit.length && <li className="muted">O mestre confere cada entrega por estes itens.</li>}
            </ul>
            <div className="row gap">
              <input className="grow" value={draft} maxLength={140} placeholder="Ex.: Revisado, sem erro de texto (Enter adiciona)"
                onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }} />
              <button type="button" className="btn ghost sm" onClick={add} disabled={!draft.trim()}>＋</button>
            </div>
          </div>
        </div>
        <footer className="task-foot">
          <button className="btn primary sm" disabled={!name.trim()}>{prev ? 'Salvar' : 'Criar projeto'}</button>
          {prev && (
            <button type="button" className="btn ghost sm" onClick={() => run(saveProject({ ...prev, archived: !prev.archived }).then(close))}>
              {prev.archived ? 'Desarquivar' : 'Arquivar'}
            </button>
          )}
          <span className="grow" />
          {canDel && (sure
            ? <button type="button" className="btn danger sm" onClick={() => run(removeProject(prev!.id).then(() => { close(); setUi({ project: '' }) }))} onBlur={() => setSure(false)}>Apagar (tarefas ficam)</button>
            : <button type="button" className="btn ghost sm" onClick={() => setSure(true)}>🗑 Apagar</button>)}
        </footer>
      </form>
    </div>
  )
}
