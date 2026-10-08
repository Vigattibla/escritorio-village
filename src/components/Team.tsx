import { RANKS, rankName, ranksFor } from '../game/ranks'
import { dmChannel, run, setRank, setUi, team, useStore } from '../store'
import Accounts from './Accounts'
import MiniAvatar from './MiniAvatar'
import { canStick } from './Stickers'

export default function Team() {
  const meId = useStore(s => s.meId)!
  const profiles = useStore(s => s.profiles)
  const tasksMap = useStore(s => s.tasks)
  const online = useStore(s => s.online)
  const tasks = Object.values(tasksMap)
  const people = team(profiles)
    .filter(p => p.avatar)
    .sort((a, b) => Number(online.has(b.id) || b.id === meId) - Number(online.has(a.id) || a.id === meId) || a.name.localeCompare(b.name))

  return (
    <div className="team">
      <h2>Equipe <span className="count">{people.filter(p => online.has(p.id) || p.id === meId).length} no escritório</span></h2>
      {profiles[meId]?.is_admin && <Accounts />}
      {people.map(p => {
        const here = online.has(p.id) || p.id === meId
        const doing = tasks.filter(t => t.owner_id === p.id && t.status === 'doing').sort((a, b) => b.position - a.position)[0]
        const pend = tasks.filter(t => t.owner_id === p.id && (t.status === 'todo' || t.status === 'doing')).length
        const opts = ranksFor(profiles[meId], p)
        return (
          <div key={p.id} className="person">
            <MiniAvatar avatar={p.avatar} photo={p.photo} name={p.name} size={44} dim={!here} />
            <div className="grow">
              <div className="row gap">
                <b>{p.name}{p.id === meId && ' (você)'}</b>
                {p.is_admin && <span className="chip" title="Cria contas e define cargos">Adm</span>}
                <span className={'dot ' + (here ? 'on' : 'off')} title={here ? 'No escritório' : 'Fora'} />
                {opts.length > 0
                  ? <select className="rank-sel" value={p.rank} onChange={e => run(setRank(p.id, Number(e.target.value)))} title="Mudar cargo">
                      {opts.map(r => <option key={r} value={r}>{RANKS[r]}</option>)}
                    </select>
                  : <span className="chip">{rankName(p)}</span>}
              </div>
              <div className="muted small">{p.role || rankName(p)} · {pend} pendente(s)</div>
              <div className="doing">{doing ? <>Fazendo: {doing.title}</> : <span className="muted">Sem tarefa em andamento</span>}</div>
            </div>
            <div className="col">
              <button className="btn ghost sm" onClick={() => setUi({ view: 'escritorio', drawer: false, viewing: p.id })}>Tarefas</button>
              {p.id !== meId && <button className="btn ghost sm" onClick={() => setUi({ tab: 'chat', channel: dmChannel(meId, p.id) })}>Mensagem</button>}
              {p.id !== meId && <button className="btn ghost sm" onClick={() => setUi({ requestTo: p.id })}>Pedir</button>}
              {p.id !== meId && canStick() && <button className="btn ghost sm" onClick={() => setUi({ stickTo: p.id })}>Colar adesivo</button>}
            </div>
          </div>
        )
      })}
    </div>
  )
}
