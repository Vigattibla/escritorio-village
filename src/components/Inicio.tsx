import { dayKey } from '../game/xp'
import { setUi, toApprove, unread, useStore } from '../store'
import { Bell } from './Avisos'
import { StatusTag } from './Agenda'
import Icon, { Ph } from './Icon'
import MiniAvatar from './MiniAvatar'
import { Live } from './Side'
import { CHANNELS, first } from './v4'

const hello = () => { const h = new Date().getHours(); return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite' }
const ORDER = { doing: 0, review: 1, inbox: 2, todo: 3, done: 4, declined: 5 }

/** Celular: início com o escritório em filme, o dia em três números e o que é meu. */
export default function Inicio() {
  const s = useStore(x => x)
  const me = s.profiles[s.meId!]
  if (!me) return null
  const today = dayKey(new Date())
  const all = Object.values(s.tasks)
  const open = all.filter(t => t.status !== 'done' && t.status !== 'declined')
  const dueToday = open.filter(t => t.owner_id === me.id && t.due && t.due <= today).length
  const approve = toApprove(s).length
  const posts = open.filter(t => t.publish_at && dayKey(t.publish_at) >= today).length
  const msgs = [...new Set(s.messages.map(m => m.channel))].reduce((n, ch) => n + unread(s, ch), 0)
  const mine = open.filter(t => t.owner_id === me.id).sort((a, b) => ORDER[a.status] - ORDER[b.status] || (a.due ?? '9').localeCompare(b.due ?? '9')).slice(0, 6)
  const date = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
  return (
    <div className="inicio">
      <div className="mtop">
        <button className="mav" onClick={() => setUi({ editing: true })} aria-label="Editar personagem"><MiniAvatar avatar={me.avatar} photo={me.photo} size={44} /></button>
        <div className="grow"><small>{date[0].toUpperCase() + date.slice(1)}</small><h2>{hello()}, {first(me)}</h2></div>
        <button className="iconbtn" onClick={() => setUi({ chatOpen: true })} aria-label="Chat"><Icon n="chat" size={20} />{msgs > 0 && <i>{msgs > 9 ? '9+' : msgs}</i>}</button>
        <Bell />
      </div>
      <Live small />
      <div className="mday">
        <button className="ink" onClick={() => setUi({ view: 'quadro', drawer: false })}><b>{dueToday}</b><small>vencem hoje</small></button>
        <button onClick={() => setUi({ view: 'quadro', drawer: false, qApprove: true })}><b>{approve}</b><small>para você aprovar</small></button>
        <button onClick={() => setUi({ view: 'agenda', drawer: false })}><b>{posts}</b><small>posts agendados</small></button>
      </div>
      <div className="msec"><h3>Para você</h3><button onClick={() => setUi({ view: 'quadro', drawer: false })}>Ver quadro</button></div>
      <div className="mcards">
        {!mine.length && <div className="panel empty-goal"><Ph n="check-circle" size={30} /><b>Nada pendente</b><small className="muted">Toque no + para criar uma tarefa.</small></div>}
        {mine.map(t => {
          const p = t.project_id ? s.projects[t.project_id] : null
          const ch = t.channel ? CHANNELS[t.channel] : null
          const by = s.profiles[t.created_by]
          const late = t.due && t.due < today
          return (
            <button key={t.id} className="panel mcard" onClick={() => setUi({ task: t.id })}>
              <div className="row gap">
                {ch && <span className={'tag ' + ch.tag}><Ph n={ch.ic} size={13} fill />{ch.label}</span>}
                {p && <span className="tag gray">{p.name}</span>}
                <span className="grow" />
                <StatusTag t={t} />
              </div>
              <b>{t.title}</b>
              <div className="row gap mc-ft">
                {t.due && <span className={late ? 'late' : ''}><Ph n="calendar-dots" size={14} />{t.due === today ? 'hoje' : new Date(t.due + 'T12:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}</span>}
                <span className="grow" />
                {by && by.id !== me.id && <><small>de {first(by)}</small><MiniAvatar avatar={by.avatar} photo={by.photo} size={22} /></>}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
