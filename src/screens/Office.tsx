import { useEffect, useState } from 'react'
import Board from '../components/Board'
import Chat from '../components/Chat'
import Game from '../components/Game'
import MiniAvatar from '../components/MiniAvatar'
import DeskView from '../components/DeskView'
import { Bell, Toast } from '../components/Avisos'
import Icon, { type IconName } from '../components/Icon'
import Overview from '../components/Overview'
import ProjectModal from '../components/ProjectModal'
import Distribuir from '../components/Distribuir'
import Quadro from '../components/Quadro'
import TaskDetail from '../components/TaskDetail'
import RequestModal from '../components/RequestModal'
import Team from '../components/Team'
import Creator from './Creator'
import { backend } from '../data'
import { isChief, rankName } from '../game/ranks'
import { setUi, signOut, unread, useStore, type Tab } from '../store'

type Page = 'quadro' | 'escritorio' | Tab

export default function Office() {
  const s = useStore(x => x)
  const me = s.profiles[s.meId!]
  const [navOpen, setNavOpen] = useState(false)
  const tasks = Object.values(s.tasks)
  const pend = tasks.filter(t => t.owner_id === me?.id && t.status === 'inbox').length
  const chans = new Set(s.messages.map(m => m.channel))
  const msgs = [...chans].reduce((n, ch) => n + unread(s, ch), 0)
  useEffect(() => {
    const n = pend + msgs
    document.title = n ? `(${n}) Escritório Village` : 'Escritório Village'
  }, [pend, msgs])
  if (!me) return null

  const chief = isChief(me)
  // painel do escritório: eu primeiro, depois quem está na sala, depois quem está fora
  const people = Object.values(s.profiles).filter(p => p.avatar).sort((a, b) =>
    Number(b.id === me.id) - Number(a.id === me.id) || Number(s.online.has(b.id)) - Number(s.online.has(a.id)) || a.name.localeCompare(b.name))
  const office = s.view === 'escritorio'
  const page: Page = office ? 'escritorio' : s.drawer ? s.tab : 'quadro'
  // minha mesa = filtro "Só minhas"; aprovação = coluna do quadro; avisos = sino; chat = botão flutuante
  const items: { id: Page; label: string; ic: IconName; n?: number; tip?: string }[] = [
    { id: 'quadro', label: 'Quadro', ic: 'board', n: pend, tip: pend ? `${pend} pedido(s) esperando você aceitar` : undefined },
    { id: 'escritorio', label: 'Escritório', ic: 'office' },
    { id: 'equipe', label: 'Equipe', ic: 'users' },
  ]
  if (chief) items.push({ id: 'geral', label: 'Visão geral', ic: 'chart', n: tasks.filter(t => t.status === 'inbox').length })
  const goTo = (id: Page) => {
    setNavOpen(false)
    if (id === 'quadro') setUi({ view: 'quadro', drawer: false })
    else if (id === 'escritorio') setUi({ view: 'escritorio', drawer: false })
    else setUi({ view: 'quadro', tab: id, drawer: true })
  }
  const pane = (tab: Tab) => <>
    {tab === 'mesa' && <Board />}
    {tab === 'equipe' && <Team />}
    {tab === 'geral' && chief && <Overview />}
  </>
  const NavItem = ({ it }: { it: (typeof items)[number] }) => (
    <button className={'nav-item' + (page === it.id ? ' on' : '')} onClick={() => goTo(it.id)} title={it.tip}>
      <span className="nav-ic"><Icon n={it.ic} size={17} /></span><span className="grow">{it.label}</span>
      {!!it.n && <i className="nav-n">{it.n}</i>}
    </button>
  )

  return (
    <div className={'office' + (navOpen ? ' nav-open' : '')}>
      <aside className="nav">
        <div className="nav-ws">
          <span className="grow">Escritório Village</span>
          {backend.mode === 'demo' && <span className="tag">demo</span>}
          <Bell />
        </div>
        <nav className="nav-list">
          {items.map(it => <NavItem key={it.id} it={it} />)}
        </nav>
        <div className="nav-me">
          <button className="nav-item" onClick={() => setUi({ editing: true })} title="Editar personagem">
            <MiniAvatar avatar={me.avatar} photo={me.photo} size={24} />
            <span className="grow nav-who"><b>{me.name}</b><small>{me.role || rankName(me)}</small></span>
          </button>
          <button className="nav-item muted" onClick={() => signOut()}><span className="nav-ic"><Icon n="logout" size={17} /></span>Sair</button>
        </div>
      </aside>
      {navOpen && <div className="nav-bg" onClick={() => setNavOpen(false)} />}
      <div className="page">
        <div className="mbar">
          <button className="icon-btn" onClick={() => setNavOpen(true)} aria-label="Menu"><Icon n="menu" size={20} /></button>
          <b className="grow">{items.find(i => i.id === page)?.label ?? 'Escritório'}</b>
          <Bell />
        </div>
        {s.error && <div className="banner" onClick={() => setUi({ error: '' })}>{s.error} <small>(clique para fechar)</small></div>}
        <main className="main">
          {page === 'quadro' && <Quadro />}
          {office && <>
            <Game />
            <aside className="side">
              <nav className="who-strip" aria-label="Ver a mesa de">
                {people.map(p => {
                  const here = p.id === me.id || s.online.has(p.id)
                  return (
                    <button key={p.id} className={(s.viewing ?? me.id) === p.id ? 'on' : ''} onClick={() => setUi({ viewing: p.id })} title={`${p.id === me.id ? 'Minha mesa' : p.name} · ${here ? 'no escritório' : 'fora'}`}>
                      <MiniAvatar avatar={p.avatar} photo={p.photo} size={30} dim={!here} />
                      <i className={'dot ' + (here ? 'on' : 'off')} />
                      <small>{p.id === me.id ? 'Eu' : p.name.split(' ')[0]}</small>
                    </button>
                  )
                })}
              </nav>
              <div className="pane"><Board /></div>
            </aside>
          </>}
          {page !== 'quadro' && page !== 'escritorio' && <div className="doc">{pane(page)}</div>}
        </main>
      </div>
      {s.desk && <DeskView />}
      {s.task && <TaskDetail />}
      {s.projectEdit && <ProjectModal />}
      {s.aiOpen && <Distribuir />}
      <RequestModal />
      <button className={'fab' + (s.chatOpen ? ' on' : '')} onClick={() => setUi({ chatOpen: !s.chatOpen })} title="Chat da equipe" aria-label={`Chat${msgs ? ` (${msgs} novas)` : ''}`}>
        <Icon n={s.chatOpen ? 'x' : 'chat'} size={22} />{!s.chatOpen && msgs > 0 && <i className="dot-n">{msgs > 9 ? '9+' : msgs}</i>}
      </button>
      {s.chatOpen && (
        <section className="dock" aria-label="Chat">
          <header className="pop-head"><Icon n="chat" /><b className="grow">Chat</b>
            <button className="icon-btn" onClick={() => setUi({ chatOpen: false })} aria-label="Fechar"><Icon n="x" /></button>
          </header>
          <Chat />
        </section>
      )}
      <Toast />
      {s.editing && <div className="overlay"><Creator /></div>}
    </div>
  )
}
