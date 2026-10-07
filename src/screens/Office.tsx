import { useEffect, useState } from 'react'
import Board from '../components/Board'
import Chat from '../components/Chat'
import Game from '../components/Game'
import MiniAvatar from '../components/MiniAvatar'
import DeskView from '../components/DeskView'
import Aprovacoes from '../components/Aprovacoes'
import Avisos, { Toast } from '../components/Avisos'
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
import { setUi, signOut, toApprove, unread, useStore, type Tab } from '../store'

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
  const office = s.view === 'escritorio'
  const page: Page = office ? 'escritorio' : s.drawer ? s.tab : 'quadro'
  const items: { id: Page; label: string; ic: string; n?: number }[] = [
    { id: 'quadro', label: 'Quadro', ic: '▦' },
    { id: 'mesa', label: 'Minha mesa', ic: '▤', n: pend },
    { id: 'aprovar', label: 'Aprovação', ic: '✓', n: toApprove(s).length },
    { id: 'avisos', label: 'Avisos', ic: '◔' },
    { id: 'chat', label: 'Chat', ic: '◫', n: msgs },
    { id: 'equipe', label: 'Equipe', ic: '◍' },
  ]
  if (chief) items.push({ id: 'geral', label: 'Visão geral', ic: '◈', n: tasks.filter(t => t.status === 'inbox').length })
  const goTo = (id: Page) => {
    setNavOpen(false)
    if (id === 'quadro') setUi({ view: 'quadro', drawer: false })
    else if (id === 'escritorio') setUi({ view: 'escritorio', drawer: false })
    else setUi({ view: 'quadro', tab: id, drawer: true, ...(id === 'mesa' ? { viewing: me.id } : {}) })
  }
  const pane = (tab: Tab) => <>
    {tab === 'mesa' && <Board />}
    {tab === 'aprovar' && <Aprovacoes />}
    {tab === 'avisos' && <Avisos />}
    {tab === 'equipe' && <Team />}
    {tab === 'chat' && <Chat />}
    {tab === 'geral' && chief && <Overview />}
  </>
  const NavItem = ({ it }: { it: (typeof items)[number] }) => (
    <button className={'nav-item' + (page === it.id ? ' on' : '')} onClick={() => goTo(it.id)}>
      <span className="nav-ic">{it.ic}</span><span className="grow">{it.label}</span>
      {!!it.n && <i className="nav-n">{it.n}</i>}
    </button>
  )

  return (
    <div className={'office' + (navOpen ? ' nav-open' : '')}>
      <aside className="nav">
        <div className="nav-ws">
          <span className="nav-logo">V</span>
          <span className="grow">Escritório Village</span>
          {backend.mode === 'demo' && <span className="tag">demo</span>}
        </div>
        <nav className="nav-list">
          {items.map(it => <NavItem key={it.id} it={it} />)}
          <div className="nav-sec">Espaços</div>
          <NavItem it={{ id: 'escritorio', label: 'Escritório', ic: '⌂' }} />
        </nav>
        <div className="nav-me">
          <button className="nav-item" onClick={() => setUi({ editing: true })} title="Editar personagem">
            <MiniAvatar avatar={me.avatar} photo={me.photo} size={24} />
            <span className="grow nav-who"><b>{me.name}</b><small>{me.role || rankName(me)}</small></span>
          </button>
          <button className="nav-item muted" onClick={() => signOut()}><span className="nav-ic">↩</span>Sair</button>
        </div>
      </aside>
      {navOpen && <div className="nav-bg" onClick={() => setNavOpen(false)} />}
      <div className="page">
        <div className="mbar">
          <button className="icon" onClick={() => setNavOpen(true)} aria-label="Menu">☰</button>
          <b>{items.find(i => i.id === page)?.label ?? 'Escritório'}</b>
        </div>
        {s.error && <div className="banner" onClick={() => setUi({ error: '' })}>{s.error} <small>(clique para fechar)</small></div>}
        <main className="main">
          {page === 'quadro' && <Quadro />}
          {office && <>
            <Game />
            <aside className="side">
              <nav className="tabs">
                {(['mesa', 'equipe', 'chat'] as Tab[]).map(t => (
                  <button key={t} className={s.tab === t ? 'on' : ''} onClick={() => setUi({ tab: t, ...(t === 'mesa' && s.tab === 'mesa' ? { viewing: me.id } : {}) })}>
                    {t === 'mesa' ? 'Mesa' : t === 'equipe' ? 'Equipe' : 'Chat'}
                  </button>
                ))}
              </nav>
              <div className="pane">{pane(s.tab)}</div>
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
      <Toast />
      {s.editing && <div className="overlay"><Creator /></div>}
    </div>
  )
}
