import { canCreateProject, canEditProject, criteriaOf, run, setStatus, setUi, toApprove, useStore } from '../store'
import type { Task } from '../types'
import MiniAvatar from './MiniAvatar'
import { ReviewBox, ReviewHistory } from './Revisao'

const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  return m < 60 ? `${Math.max(1, m)} min` : m < 1440 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} d`
}

/** Aba de aprovação: o que espera a minha decisão, minhas entregas esperando e as decisões recentes. */
export default function Aprovacoes() {
  const s = useStore(x => x)
  const meId = s.meId!
  const tasks = Object.values(s.tasks)
  const mineToDo = toApprove(s).sort((a, b) => a.position - b.position)
  const mineSent = tasks.filter(t => t.owner_id === meId && t.status === 'review')
  const lastAt = (t: Task) => t.reviews.at(-1)?.at ?? ''
  const recent = tasks
    .filter(t => t.reviews.length && (t.owner_id === meId || t.reviews.at(-1)!.by === meId || (t.project_id && s.projects[t.project_id]?.master_id === meId)))
    .sort((a, b) => lastAt(b).localeCompare(lastAt(a)))
    .slice(0, 12)
  const myProjects = Object.values(s.projects).filter(p => !p.archived && (p.master_id === meId || canEditProject(p)))
  const name = (id: string) => s.profiles[id]?.name ?? 'Alguém'
  const open = (t: Task) => setUi({ task: t.id })
  const pj = (t: Task) => (t.project_id ? s.projects[t.project_id] : undefined)
  const tag = (t: Task) => { const p = pj(t); return p && <span className="tc-proj" style={{ '--pc': p.color } as React.CSSProperties}>{p.name}</span> }

  return (
    <div className="aprov">
      <section>
        <h3>Esperando sua aprovação <span className="count">{mineToDo.length}</span></h3>
        {!mineToDo.length && <p className="empty">Nada esperando você. 🎉</p>}
        {mineToDo.map(t => (
          <article key={t.id} className="apcard">
            <header onClick={() => open(t)}>
              <MiniAvatar avatar={s.profiles[t.owner_id]?.avatar ?? null} photo={s.profiles[t.owner_id]?.photo ?? null} name={s.profiles[t.owner_id]?.name} size={30} />
              <div className="grow">
                <b>{t.title}</b>
                <small>{name(t.owner_id)} entregou · há {ago(new Date(t.position).toISOString())}</small>
              </div>
              {tag(t)}
            </header>
            {t.reviews.at(-1)?.ok === false && <p className="small muted">↺ Reenvio — antes: “{t.reviews.at(-1)!.reason}”</p>}
            {!criteriaOf(t).length && <p className="small muted">Projeto sem critérios: avalie pela descrição.</p>}
            <ReviewBox t={t} compact />
          </article>
        ))}
      </section>

      <section>
        <h3>Minhas entregas em aprovação <span className="count">{mineSent.length}</span></h3>
        {!mineSent.length && <p className="empty">Nenhuma entrega sua esperando.</p>}
        {mineSent.map(t => (
          <div key={t.id} className="aprow" onClick={() => open(t)}>
            <span className="grow"><b>{t.title}</b><small>esperando {name(pj(t)?.master_id ?? '')}</small></span>
            {tag(t)}
            <button className="btn ghost sm" onClick={e => { e.stopPropagation(); run(setStatus(t.id, 'doing')) }} title="Voltar para Fazendo">↩ Retirar</button>
          </div>
        ))}
      </section>

      <section>
        <h3>Decisões recentes</h3>
        {!recent.length && <p className="empty">Nenhuma decisão ainda.</p>}
        {recent.map(t => (
          <div key={t.id} className="aprow col" onClick={() => open(t)}>
            <span className="row gap"><b className="grow">{t.title}</b>{tag(t)}</span>
            <small className="muted">{name(t.owner_id)}</small>
            <ReviewHistory t={t} max={1} />
          </div>
        ))}
      </section>

      <section>
        <h3>Projetos</h3>
        {myProjects.map(p => (
          <div key={p.id} className="aprow" onClick={() => setUi({ view: 'quadro', project: p.id, drawer: false })}>
            <span className="qproj-dot" style={{ '--pc': p.color } as React.CSSProperties} />
            <span className="grow"><b>{p.name}</b><small>mestre: {name(p.master_id)} · {p.criteria.length} critérios</small></span>
            {canEditProject(p) && <button className="btn ghost sm" onClick={e => { e.stopPropagation(); setUi({ projectEdit: p.id }) }}>✎</button>}
          </div>
        ))}
        {canCreateProject() && <button className="btn ghost sm" onClick={() => setUi({ projectEdit: 'new' })}>＋ Novo projeto</button>}
      </section>
    </div>
  )
}
