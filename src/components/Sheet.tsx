import { useState } from 'react'
import { dayKey } from '../game/xp'
import { addTask, hasCanais, run, setUi, team, useStore } from '../store'
import type { Channel } from '../types'
import Icon, { Ph } from './Icon'
import MiniAvatar from './MiniAvatar'
import { CHANNEL_KEYS, CHANNELS, first } from './v4'

const plus = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return dayKey(d) }
const friday = () => { const d = new Date(); d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7 || 7)); return dayKey(d) }

/** Celular: “Nova tarefa” em folha que sobe de baixo. */
export default function Sheet() {
  const open = useStore(s => s.sheet)
  const meId = useStore(s => s.meId)!
  const profiles = useStore(s => s.profiles)
  const tasks = useStore(s => s.tasks)
  const online = useStore(s => s.online)
  const projects = useStore(s => s.projects)
  const cur = useStore(s => s.project)
  const [title, setTitle] = useState('')
  const [who, setWho] = useState('')
  const [due, setDue] = useState<string | null>(plus(1))
  const [hora, setHora] = useState('')
  const [pick, setPick] = useState(false)
  const [channel, setChannel] = useState<Channel | null>(null)
  const canais = useStore(s => hasCanais(s.sala, s))
  const [mine, setMine] = useState(true)
  if (!open) return null
  const owner = who || meId
  const people = team(profiles).filter(p => p.avatar).sort((a, b) => Number(b.id === meId) - Number(a.id === meId) || a.name.localeCompare(b.name))
  const openN = (id: string) => Object.values(tasks).filter(t => t.owner_id === id && t.status !== 'done').length
  // aprovação vem do mestre do projeto: uso o projeto aberto (se for meu) ou o primeiro que eu mestro
  const myProj = (projects[cur]?.master_id === meId ? projects[cur] : Object.values(projects).find(p => p.master_id === meId && !p.archived)) ?? null
  const canMine = !!myProj && owner !== meId
  const close = () => { setUi({ sheet: false }); setTitle(''); setWho(''); setChannel(null); setPick(false); setDue(plus(1)); setHora('') }
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    const project = canMine && mine ? myProj!.id : (cur && cur !== '-' && projects[cur] ? cur : null)
    const publish_at = channel && due ? new Date(`${due}T10:00`).toISOString() : null
    run(addTask(owner, channel ? `${CHANNELS[channel].label} · ${title.trim()}` : title.trim(), due, '', 'todo', project, { channel, publish_at, due_time: hora || null }))
    close()
  }
  const chips: [string, string | null][] = [['Hoje', plus(0)], ['Amanhã', plus(1)], ['Sexta', friday()]]
  return (
    <>
      <div className="veil" onClick={close} />
      <form className="msheet" onSubmit={submit} role="dialog" aria-label="Nova tarefa">
        <i className="handle" />
        <div className="sh-h"><h2>Nova tarefa</h2><button type="button" className="icon-btn" onClick={close} aria-label="Fechar"><Icon n="x" size={18} /></button></div>
        <input className="sh-field" autoFocus required maxLength={120} value={title} onChange={e => setTitle(e.target.value)} placeholder="O que precisa ser feito?" />
        <div className="lbl">Quem faz</div>
        <div className="pick">
          {people.map(p => {
            const here = p.id === meId || online.has(p.id)
            return (
              <button type="button" key={p.id} className={(owner === p.id ? 'on' : '') + (here ? '' : ' out')} onClick={() => setWho(p.id)}>
                <MiniAvatar avatar={p.avatar} photo={p.photo} name={p.name} size={44} dim={!here} />
                <b>{p.id === meId ? 'Eu' : first(p)}</b><small>{here ? `${openN(p.id)} tarefas` : 'fora'}</small>
              </button>
            )
          })}
        </div>
        <div className="lbl">Prazo</div>
        <div className="opts">
          {chips.map(([l, d]) => <button type="button" key={l} className={'qchip' + (!pick && due === d ? ' on' : '')} onClick={() => { setPick(false); setDue(d) }}>{l}</button>)}
          <button type="button" className={'qchip' + (pick ? ' on' : '')} onClick={() => setPick(true)}><Ph n="calendar-dots" size={14} />Escolher</button>
        </div>
        {pick && <input className="sh-field" type="date" value={due ?? ''} onChange={e => setDue(e.target.value || null)} />}
        {due && <label className="sh-hora"><Icon n="clock" size={16} />Horário (opcional)<input type="time" value={hora} onChange={e => setHora(e.target.value)} /></label>}
        {canais && <>
        <div className="lbl">Canal (se for post)</div>
        <div className="opts">
          {CHANNEL_KEYS.map(c => (
            <button type="button" key={c} className={'tag ' + CHANNELS[c].tag + (channel === c ? '' : ' off')} onClick={() => setChannel(channel === c ? null : c)}>
              <Ph n={CHANNELS[c].ic} size={14} fill />{CHANNELS[c].label}
            </button>
          ))}
        </div>
        </>}
        {canMine && (
          <button type="button" className="remind" onClick={() => setMine(!mine)}>
            <Ph n="check-circle" size={20} fill /><div className="grow">Passa pela <b>sua aprovação</b><small>{myProj!.name}</small></div><span className={'toggle' + (mine ? ' on' : '')} />
          </button>
        )}
        <button className="btn accent wide" disabled={!title.trim()}><Ph n="paper-plane-tilt" size={18} fill />{owner === meId ? 'Criar para mim' : `Enviar para ${first(profiles[owner])}`}</button>
      </form>
    </>
  )
}
