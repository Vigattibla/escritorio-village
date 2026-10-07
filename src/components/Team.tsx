import { DAILY_GOAL, doneToday, level, levelTitle } from '../game/xp'
import { RANKS, rankName, ranksFor } from '../game/ranks'
import { dmChannel, run, setRank, setUi, useStore } from '../store'
import MiniAvatar from './MiniAvatar'

export default function Team() {
  const meId = useStore(s => s.meId)!
  const profiles = useStore(s => s.profiles)
  const tasksMap = useStore(s => s.tasks)
  const online = useStore(s => s.online)
  const tasks = Object.values(tasksMap)
  const people = Object.values(profiles)
    .filter(p => p.avatar)
    .sort((a, b) => Number(online.has(b.id) || b.id === meId) - Number(online.has(a.id) || a.id === meId) || b.xp - a.xp)
  const ranking = [...people].sort((a, b) => b.xp - a.xp)

  return (
    <div className="team">
      <h2>Equipe <span className="count">{people.filter(p => online.has(p.id) || p.id === meId).length} no escritório</span></h2>
      {people.map(p => {
        const here = online.has(p.id) || p.id === meId
        const doing = tasks.filter(t => t.owner_id === p.id && t.status === 'doing').sort((a, b) => b.position - a.position)[0]
        const pend = tasks.filter(t => t.owner_id === p.id && (t.status === 'todo' || t.status === 'doing')).length
        const done = doneToday(tasks, p.id)
        const opts = ranksFor(profiles[meId], p)
        return (
          <div key={p.id} className="person">
            <MiniAvatar avatar={p.avatar} photo={p.photo} size={44} dim={!here} />
            <div className="grow">
              <div className="row gap">
                <b>{p.name}{p.id === meId && ' (você)'}</b>
                <span className="lvl">Nv {level(p.xp)}</span>
                <span className={'dot ' + (here ? 'on' : 'off')} title={here ? 'No escritório' : 'Fora'} />
                {opts.length > 0
                  ? <select className="rank-sel" value={p.rank} onChange={e => run(setRank(p.id, Number(e.target.value)))} title="Mudar cargo">
                      {opts.map(r => <option key={r} value={r}>{RANKS[r]}</option>)}
                    </select>
                  : <span className="chip">{rankName(p)}</span>}
              </div>
              <div className="muted small">{p.role || rankName(p)} · {pend} pendente(s) · {done}/{DAILY_GOAL} hoje</div>
              <div className="doing">{doing ? <>▶ {doing.title}</> : <span className="muted">Sem tarefa em andamento</span>}</div>
            </div>
            <div className="col">
              <button className="btn ghost sm" onClick={() => setUi({ desk: p.id, deskView: 'pasta', viewing: p.id })}>Mesa</button>
              {p.id !== meId && <button className="btn ghost sm" onClick={() => setUi({ tab: 'chat', channel: dmChannel(meId, p.id) })}>Mensagem</button>}
              {p.id !== meId && <button className="btn ghost sm" onClick={() => setUi({ desk: p.id, deskView: 'pc', viewing: p.id })}>Pedir</button>}
            </div>
          </div>
        )
      })}
      <h3 className="rank-title">🏆 Ranking de XP</h3>
      <ol className="rank">
        {ranking.slice(0, 5).map((p, i) => (
          <li key={p.id} className={p.id === meId ? 'me' : ''}>
            <span className="pos">{['🥇', '🥈', '🥉'][i] ?? i + 1}</span>
            <span className="grow">{p.name} <span className="muted small">{levelTitle(p.xp)}</span></span>
            <b>{p.xp} XP</b>
          </li>
        ))}
      </ol>
    </div>
  )
}
