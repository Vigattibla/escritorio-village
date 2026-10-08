import { useEffect, useMemo, useState } from 'react'
import { rankOf } from '../game/ranks'
import { dropRow, hasCanais, me, putRow, run, useStore } from '../store'
import type { Goal } from '../types'
import { Bell } from './Avisos'
import { Ph } from './Icon'
import MiniAvatar from './MiniAvatar'
import { Ring, Steps } from './Side'
import { currentGoal, daysLeft, first, goalProgress, monthKey } from './v4'
import { FINAL, goalTotal, MAX_GOALS, PHASE, steps } from '../shop/economy'

const METRIC: Record<Goal['metric'], string> = { posts: 'Posts publicados', tasks: 'Tarefas feitas', manual: 'Contagem manual' }
const monthName = (m: string) => new Date(m + '-02').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).replace(' de ', ' ')

export default function Metas() {
  const goals = useStore(s => s.rows.goals)
  const tasks = useStore(s => s.tasks)
  const profiles = useStore(s => s.profiles)
  const projects = useStore(s => s.projects)
  const [form, setForm] = useState<Goal | 'new' | null>(null)
  const [cele, setCele] = useState<Goal | null>(null)
  const list = useMemo(() => Object.values(tasks), [tasks])
  const all = Object.values(goals).sort((a, b) => b.month.localeCompare(a.month) || a.created_at.localeCompare(b.created_at))
  const can = rankOf(me()) >= 2
  const chefe = rankOf(me()) >= 4
  const months = [...new Set(all.map(g => g.month))]

  return (
    <div className="quadro metas">
      <div className="qbar"><span className="grow" /><Bell />
        {can && <button className="btn accent" onClick={() => setForm('new')}><Ph n="plus" size={18} fill />Nova meta</button>}
      </div>
      <div className="qhead"><div><h1>Metas</h1><div className="sub">O que a equipe quer bater no mês, e o que ganha quando bater. Cada pessoa recebe cafezinhos de até {MAX_GOALS} metas por mês.</div></div></div>
      {!all.length && <div className="panel empty-goal"><Ph n="target" size={36} /><b>Nenhuma meta ainda</b><small className="muted">{can ? 'Crie a primeira: tarefas feitas no mês, posts publicados ou uma contagem sua.' : 'Quando a coordenação criar uma meta, ela aparece aqui.'}</small></div>}
      {months.map(m => (
        <section key={m} className="msec-g">
          <h4>{monthName(m)}{m === monthKey() && <span className="tag green">este mês</span>}</h4>
          <div className="glist">
            {all.filter(g => g.month === m).map(g => {
              const pr = goalProgress(g, list, projects)
              const tops = Object.entries(pr.by).sort((a, b) => b[1] - a[1])
              return (
                <div key={g.id} className={'panel gcard big' + (pr.hit ? ' hit' : '')}>
                  <div className="eyebrow">{METRIC[g.metric]}</div>
                  <div className="g-row">
                    <Ring pct={pr.pct} size={110} />
                    <div className="grow"><h3>{g.title}</h3><div className="big"><b>{pr.value}</b> de {g.target}</div>
                      <div className="left">{pr.hit ? 'Meta batida!' : m < monthKey() ? 'Mês encerrado' : `faltam ${g.target - pr.value} · ${daysLeft(g.month)} dias`}</div></div>
                    {can && <button className="icon-btn on-dark" onClick={() => setForm(g)} aria-label="Editar meta"><Ph n="pencil-simple-line" size={16} /></button>}
                  </div>
                  <Steps pct={pr.pct} target={g.target} />
                  <div className="g-coffee"><Ph n="coffee" size={14} fill />{steps(g.target).length > 1 ? `+${PHASE} a cada fase · +${FINAL} no final` : `+${FINAL} ao bater`} · {goalTotal(g.target)} cafezinhos pra cada um</div>
                  {g.metric === 'manual' && chefe && (
                    <div className="row gap manual">
                      <button className="btn soft sm" onClick={() => run(putRow('goals', { ...g, value: Math.max(0, g.value - 1) }))}>−1</button>
                      <button className="btn accent sm" onClick={() => run(putRow('goals', { ...g, value: g.value + 1 }))}>+1</button>
                    </div>
                  )}
                  {tops.length > 0 && (
                    <div className="contrib">
                      <div className="faces">{tops.slice(0, 5).map(([id]) => <MiniAvatar key={id} avatar={profiles[id]?.avatar ?? null} photo={profiles[id]?.photo ?? null} name={profiles[id]?.name} size={24} />)}</div>
                      {tops.map(([id, n]) => `${first(profiles[id])} ${n}`).join(' · ')}
                    </div>
                  )}
                  {g.reward && <div className="reward"><span className="tile"><Ph n="gift" size={18} fill /></span><div><small>{pr.hit ? 'Recompensa liberada' : 'Recompensa ao bater'}</small><b>{g.reward}</b></div>
                    {pr.hit && <button className="btn accent sm" onClick={() => setCele(g)}><Ph n="confetti" size={14} fill />Comemorar</button>}</div>}
                </div>
              )
            })}
          </div>
        </section>
      ))}
      {form && <GoalForm g={form === 'new' ? null : form} onClose={() => setForm(null)} />}
      {cele && <Cele g={cele} onClose={() => setCele(null)} />}
    </div>
  )
}

function GoalForm({ g, onClose }: { g: Goal | null; onClose: () => void }) {
  const meId = useStore(s => s.meId)!
  const [title, setTitle] = useState(g?.title ?? '')
  const canais = useStore(s => hasCanais(s.sala, s))
  const [metric, setMetric] = useState<Goal['metric']>(g?.metric ?? (canais ? 'posts' : 'tasks'))
  const [target, setTarget] = useState(String(g?.target ?? 12))
  const [month, setMonth] = useState(g?.month ?? monthKey())
  const [reward, setReward] = useState(g?.reward ?? '')
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    // depois de criada, alvo/medida/mês ficam travados (o servidor recusa mudança)
    run(putRow('goals', g ? { ...g, title: title.trim(), reward: reward.trim() } : { id: crypto.randomUUID(), title: title.trim(), metric, target: Math.max(1, Number(target) || 1), month, reward: reward.trim(), value: 0, created_by: meId, created_at: new Date().toISOString() }))
    onClose()
  }
  return (
    <div className="modal-bg" onMouseDown={e => e.target === e.currentTarget && onClose()} onKeyDown={e => e.key === 'Escape' && onClose()}>
      <form className="modal" onSubmit={submit}>
        <h2>{g ? 'Editar meta' : 'Nova meta'}</h2>
        <label>Meta<input autoFocus required maxLength={80} value={title} onChange={e => setTitle(e.target.value)} placeholder={canais ? 'Ex.: Publicar 40 posts' : 'Ex.: Fechar 30 tarefas no mês'} /></label>
        <div className="opts">
          {(Object.keys(METRIC) as Goal['metric'][]).filter(k => k !== 'posts' || canais || g?.metric === 'posts').map(k => <button type="button" key={k} disabled={!!g} className={'qchip' + (metric === k ? ' on' : '')} onClick={() => setMetric(k)}>{METRIC[k]}</button>)}
        </div>
        <small className="muted">{metric === 'posts' ? 'Conta sozinho: cada post da agenda marcado como feito no mês.' : metric === 'tasks' ? 'Conta sozinho: cada tarefa feita no mês.' : 'A chefia aumenta a contagem na mão (+1).'}{g ? ' Alvo, medida e mês não mudam depois de criada.' : ' Depois de criada, alvo, medida e mês ficam travados. O que já estiver feito hoje não paga.'}</small>
        <div className="row gap"><label className="grow">Alvo<input type="number" min={1} required disabled={!!g} value={target} onChange={e => setTarget(e.target.value)} /></label><label className="grow">Mês<input type="month" required disabled={!!g} value={month} onChange={e => setMonth(e.target.value)} /></label></div>
        <label>Recompensa (opcional)<input maxLength={120} value={reward} onChange={e => setReward(e.target.value)} placeholder="Ex.: Almoço da equipe no restaurante" /></label>
        <footer className="row gap end">
          {g && <button type="button" className="btn ghost danger" onClick={() => { run(dropRow('goals', g.id)); onClose() }}>Apagar</button>}
          <span className="grow" />
          <button type="button" className="btn ghost" onClick={onClose}>Cancelar</button><button className="btn primary" disabled={!title.trim()}>Salvar</button>
        </footer>
      </form>
    </div>
  )
}

/** “Meta batida!”: troféu que pula, confete. */
export function Cele({ g, onClose }: { g: Goal; onClose: () => void }) {
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [onClose])
  const month = new Date(g.month + '-02').toLocaleDateString('pt-BR', { month: 'long' })
  return (
    <div className="modal-bg cele-bg" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="panel cele" role="dialog" aria-label="Meta batida">
        <div className="confetti" aria-hidden="true">{Array.from({ length: 18 }, (_, i) => <i key={i} style={{ '--i': i } as React.CSSProperties} />)}</div>
        <div className="trophy"><Ph n="trophy" size={46} fill /></div>
        <h2>Meta batida!</h2>
        <p>A equipe bateu “{g.title}” em {month}.{g.reward && <><br />Recompensa liberada: {g.reward}.</>}</p>
        <button className="btn accent" onClick={onClose}><Ph n="gift" size={18} fill />Oba!</button>
      </div>
    </div>
  )
}

/** Mostra a comemoração uma vez por meta quando ela é batida (em qualquer tela). */
export function CeleWatch() {
  const goals = useStore(s => s.rows.goals)
  const tasks = useStore(s => s.tasks)
  const projects = useStore(s => s.projects)
  const [show, setShow] = useState<Goal | null>(null)
  const g = currentGoal(Object.values(goals))
  const hit = !!g && goalProgress(g, Object.values(tasks), projects).hit
  useEffect(() => {
    if (!g || !hit) return
    const k = 'ev:cele:' + g.id
    try { if (localStorage.getItem(k)) return; localStorage.setItem(k, '1') } catch { return }
    setShow(g)
  }, [g, hit])
  return show ? <Cele g={show} onClose={() => setShow(null)} /> : null
}
