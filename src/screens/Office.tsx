import { useEffect } from 'react'
import Board from '../components/Board'
import FloatChat from '../components/FloatChat'
import Game from '../components/Game'
import MiniAvatar from '../components/MiniAvatar'
import { Bell, Toast } from '../components/Avisos'
import Icon, { Ph } from '../components/Icon'
import type { PhName } from '../components/ph'
import Overview from '../components/Overview'
import ProjectModal from '../components/ProjectModal'
import Distribuir from '../components/Distribuir'
import Quadro from '../components/Quadro'
import TaskDetail from '../components/TaskDetail'
import RequestModal from '../components/RequestModal'
import Team from '../components/Team'
import Agenda from '../components/Agenda'
import Metas, { CeleWatch } from '../components/Metas'
import Fluxos from '../components/Fluxos'
import Arquivos from '../components/Arquivos'
import Inicio from '../components/Inicio'
import MoreMenu from '../components/MoreMenu'
import Sheet from '../components/Sheet'
import { StickerLayer, StickerPicker } from '../components/Stickers'
import Creator from './Creator'
import { backend } from '../data'
import { isChief, rankName } from '../game/ranks'
import { setUi, signOut, unread, useStore, type Tab, type View } from '../store'

type Page = View | Tab
const narrow = () => window.matchMedia('(max-width: 900px)').matches

export default function Office() {
  const s = useStore(x => x)
  const me = s.profiles[s.meId!]
  const tasks = Object.values(s.tasks)
  const pend = tasks.filter(t => t.owner_id === me?.id && t.status === 'inbox').length
  const chans = new Set(s.messages.map(m => m.channel))
  const msgs = [...chans].reduce((n, ch) => n + unread(s, ch), 0)
  useEffect(() => {
    const n = pend + msgs
    document.title = n ? `(${n}) Escritório Village` : 'Escritório Village'
  }, [pend, msgs])
  // no celular a porta de entrada é o Início
  useEffect(() => { if (narrow() && s.view === 'quadro' && !s.drawer) setUi({ view: 'inicio' }) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  if (!me) return null

  const chief = isChief(me)
  // painel do escritório: eu primeiro, depois quem está na sala, depois quem está fora
  const people = Object.values(s.profiles).filter(p => p.avatar).sort((a, b) =>
    Number(b.id === me.id) - Number(a.id === me.id) || Number(s.online.has(b.id)) - Number(s.online.has(a.id)) || a.name.localeCompare(b.name))
  const office = s.view === 'escritorio'
  const page: Page = s.view !== 'quadro' ? s.view : s.drawer ? s.tab : 'quadro'
  // minha mesa = filtro "Só minhas"; aprovação = coluna do quadro; avisos = sino; chat = botão flutuante
  const items: { id: Page; label: string; ic: PhName; n?: number; tip?: string }[] = [
    { id: 'quadro', label: 'Quadro', ic: 'kanban', n: pend, tip: pend ? `${pend} pedido(s) esperando você aceitar` : undefined },
    { id: 'agenda', label: 'Agenda', ic: 'calendar-dots' },
    { id: 'metas', label: 'Metas', ic: 'target' },
    { id: 'fluxos', label: 'Fluxos', ic: 'flow-arrow' },
    { id: 'arquivos', label: 'Arquivos', ic: 'folder-simple' },
    { id: 'escritorio', label: 'Escritório', ic: 'desk' },
    { id: 'equipe', label: 'Equipe', ic: 'users-three' },
  ]
  if (chief) items.push({ id: 'geral', label: 'Geral', ic: 'squares-four', n: tasks.filter(t => t.status === 'inbox').length })
  const goTo = (id: Page) => {
    if (id === 'mesa' || id === 'aprovar' || id === 'avisos' || id === 'equipe' || id === 'chat' || id === 'geral') setUi({ view: 'quadro', tab: id, drawer: true })
    else setUi({ view: id, drawer: false })
  }
  const pane = (tab: Tab) => <>
    {tab === 'mesa' && <Board />}
    {tab === 'equipe' && <Team />}
    {tab === 'geral' && chief && <Overview />}
  </>
  const NavItem = ({ it }: { it: (typeof items)[number] }) => {
    const on = page === it.id
    return (
      <button className={'nav-item' + (on ? ' on' : '')} onClick={() => goTo(it.id)} title={it.tip ?? it.label} aria-current={on ? 'page' : undefined}>
        <span className="nav-ic"><Ph n={it.ic} size={24} fill={on} />{!!it.n && <i className="nav-n">{it.n > 9 ? '9+' : it.n}</i>}</span>
        <span className="nav-tip">{it.label}</span>
      </button>
    )
  }

  const tabs: { id: Page; label: string; ic: PhName }[] = [
    { id: 'inicio', label: 'Início', ic: 'house' }, { id: 'agenda', label: 'Agenda', ic: 'calendar-dots' },
    { id: 'metas', label: 'Metas', ic: 'target' }, { id: 'escritorio', label: 'Escritório', ic: 'desk' },
  ]
  const Tab = ({ it }: { it: (typeof tabs)[number] }) => (
    <button className={page === it.id ? 'on' : ''} onClick={() => goTo(it.id)} aria-current={page === it.id ? 'page' : undefined}>
      <Ph n={it.ic} size={24} fill={page === it.id} />{it.label}
    </button>
  )

  return (
    <div className="office" data-page={page}>
      <aside className="nav">
        {backend.mode === 'demo' && <span className="nav-demo">demo</span>}
        <nav className="nav-list">
          {items.map(it => <NavItem key={it.id} it={it} />)}
        </nav>
        <div className="nav-me">
          <button className="nav-item" onClick={() => signOut()} title="Sair"><span className="nav-ic"><Icon n="logout" size={20} /></span><span className="nav-tip">Sair</span></button>
          <button className="nav-av" onClick={() => setUi({ editing: true })} title={`${me.name} · ${me.role || rankName(me)} — editar personagem`}>
            <MiniAvatar avatar={me.avatar} photo={me.photo} size={36} />
          </button>
        </div>
      </aside>
      <div className="page">
        {page !== 'inicio' && <div className="mbar">
          <b className="grow">{items.find(i => i.id === page)?.label ?? 'Escritório'}</b>
          <Bell />
          <MoreMenu />
        </div>}
        {s.error && <div className="banner" onClick={() => setUi({ error: '' })}>{s.error} <small>(clique para fechar)</small></div>}
        {page !== 'quadro' && page !== 'agenda' && page !== 'metas' && page !== 'fluxos' && page !== 'arquivos' && page !== 'inicio' && <div className="ptop"><h1 className="grow">{items.find(i => i.id === page)?.label}</h1><Bell /></div>}
        <main className="main">
          {page === 'quadro' && <Quadro />}
          {page === 'inicio' && <Inicio />}
          {page === 'agenda' && <Agenda />}
          {page === 'metas' && <Metas />}
          {page === 'fluxos' && <Fluxos />}
          {page === 'arquivos' && <Arquivos />}
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
          {!s.drawer || s.view !== 'quadro' ? null : page !== 'quadro' && <div className="doc">{pane(page as Tab)}</div>}
        </main>
      </div>
      {s.task && <TaskDetail />}
      {s.projectEdit && <ProjectModal />}
      {s.aiOpen && <Distribuir />}
      <RequestModal />
      {(page === 'quadro' || page === 'inicio') && <StickerLayer />}
      <StickerPicker />
      <CeleWatch />
      <Sheet />
      <nav className="tabbar" aria-label="Seções">
        <Tab it={tabs[0]} /><Tab it={tabs[1]} />
        <button className="tfab" onClick={() => setUi({ sheet: true })} aria-label="Nova tarefa"><Ph n="plus" size={26} fill /></button>
        <Tab it={tabs[2]} /><Tab it={tabs[3]} />
      </nav>
      <FloatChat unread={msgs} />
      <Toast />
      {s.editing && <div className="overlay"><Creator /></div>}
    </div>
  )
}
