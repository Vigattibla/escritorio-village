import Board from '../components/Board'
import Chat from '../components/Chat'
import Game from '../components/Game'
import Mascot from '../components/Mascot'
import MiniAvatar from '../components/MiniAvatar'
import DeskView from '../components/DeskView'
import Overview from '../components/Overview'
import TaskDetail from '../components/TaskDetail'
import RequestModal from '../components/RequestModal'
import Team from '../components/Team'
import Creator from './Creator'
import { backend } from '../data'
import { isChief } from '../game/ranks'
import { DAILY_GOAL, doneToday, level, levelProgress, levelTitle, streak } from '../game/xp'
import { setUi, signOut, unread, useStore, type Tab } from '../store'

export default function Office() {
  const s = useStore(x => x)
  const me = s.profiles[s.meId!]
  if (!me) return null
  const tasks = Object.values(s.tasks)
  const st = streak(tasks, me.id)
  const today = doneToday(tasks, me.id)
  const pend = tasks.filter(t => t.owner_id === me.id && t.status === 'inbox').length
  const chans = new Set(s.messages.map(m => m.channel))
  const msgs = [...chans].reduce((n, ch) => n + unread(s, ch), 0)
  const tabs: { id: Tab; label: string; n: number }[] = [
    { id: 'mesa', label: 'Mesa', n: pend },
    { id: 'equipe', label: 'Equipe', n: 0 },
    { id: 'chat', label: 'Chat', n: msgs },
  ]
  const chief = isChief(me)
  if (chief) tabs.push({ id: 'geral', label: '👑 Geral', n: tasks.filter(t => t.status === 'inbox').length })

  return (
    <div className="office">
      <header className="top">
        <div className="logo">Escritório <b>Village</b>{backend.mode === 'demo' && <span className="tag">demo</span>}</div>
        <div className="stats">
          <div className="stat xp" title={`${me.xp} XP no total`}>
            <span className="lv">Nv {level(me.xp)}</span>
            <div><small>{levelTitle(me.xp)}</small><div className="bar"><i style={{ width: `${levelProgress(me.xp)}%` }} /></div></div>
          </div>
          <div className="stat" title="Dias seguidos concluindo tarefas">🔥 {st} {st === 1 ? 'dia' : 'dias'}</div>
          <div className={'stat' + (today >= DAILY_GOAL ? ' win' : '')} title="Meta do dia">🎯 {today}/{DAILY_GOAL}</div>
        </div>
        <div className="me">
          <button className="me-btn" onClick={() => setUi({ editing: true })} title="Editar personagem">
            <MiniAvatar avatar={me.avatar} photo={me.photo} size={30} />
            <span>{me.name}</span>
          </button>
          <button className="btn ghost sm" onClick={() => signOut()}>Sair</button>
        </div>
      </header>
      {s.error && <div className="banner" onClick={() => setUi({ error: '' })}>⚠️ {s.error} <small>(clique para fechar)</small></div>}
      <main className="main">
        <Game />
        <aside className="side">
          <nav className="tabs">
            {tabs.map(t => (
              <button key={t.id} className={s.tab === t.id ? 'on' : ''} onClick={() => setUi({ tab: t.id, ...(t.id === 'mesa' && s.tab === 'mesa' ? { viewing: me.id } : {}) })}>
                {t.label}{t.n > 0 && <span className="badge">{t.n}</span>}
              </button>
            ))}
          </nav>
          <div className="pane">
            {s.tab === 'mesa' && <Board />}
            {s.tab === 'equipe' && <Team />}
            {s.tab === 'chat' && <Chat />}
            {s.tab === 'geral' && chief && <Overview />}
          </div>
        </aside>
      </main>
      {s.desk && <DeskView />}
      {s.task && <TaskDetail />}
      <RequestModal />
      <Mascot />
      {s.editing && <div className="overlay"><Creator /></div>}
    </div>
  )
}
