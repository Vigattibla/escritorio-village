import { useEffect, useState } from 'react'
import Timelapse from '../components/Timelapse'
import { setPref, usePref } from '../prefs'
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
import Loja from '../components/Loja'
import SalaEditor, { canEditOffice } from '../components/SalaEditor'
import Fluxos from '../components/Fluxos'
import Arquivos from '../components/Arquivos'
import Inicio from '../components/Inicio'
import InicioDesk from '../components/InicioDesk'
import TIcon, { type TName } from '../components/TIcon'
import Meo, { Wordmark } from '../components/Meo'
import { TENANT } from '../tenant'
import Marca from '../components/Marca'
import MoreMenu from '../components/MoreMenu'
import Sheet from '../components/Sheet'
import { StickerLayer, StickerPicker } from '../components/Stickers'
import Creator from './Creator'
import { backend } from '../data'
import { isChief, rankName } from '../game/ranks'
import { deptList, deptName, myDept, openSala, run, setUi, signOut, team, unread, useStore, type Tab, type View } from '../store'

type Page = View | Tab
const NARROW = '(max-width: 900px)'
const narrow = () => window.matchMedia(NARROW).matches
function useNarrow() {
  const [n, setN] = useState(narrow)
  useEffect(() => {
    const m = window.matchMedia(NARROW), f = () => setN(m.matches)
    m.addEventListener('change', f)
    return () => m.removeEventListener('change', f)
  }, [])
  return n
}

export default function Office() {
  const s = useStore(x => x)
  const [arrumando, setArrumando] = useState(false)
  const [meOpen, setMeOpen] = useState(false)
  // Metas, Fluxos e Geral ficam guardados: só aparecem quando a pessoa abre o "Mais"
  const [mais, setMais] = useState(() => { try { return localStorage.getItem('ev:nav:mais') === '1' } catch { return false } })
  const toggleMais = () => { setMais(!mais); try { localStorage.setItem('ev:nav:mais', mais ? '0' : '1') } catch { /* sem storage */ } }
  const isNarrow = useNarrow()
  const me = s.profiles[s.meId!]
  const tasks = Object.values(s.tasks)
  const pend = tasks.filter(t => t.owner_id === me?.id && t.status === 'inbox').length
  const chans = new Set(s.messages.map(m => m.channel))
  const msgs = [...chans].reduce((n, ch) => n + unread(s, ch), 0)
  useEffect(() => {
    const n = pend + msgs
    document.title = n ? `(${n}) ${TENANT.name}` : TENANT.name
  }, [pend, msgs])
  // a porta de entrada é o Início (celular e computador)
  useEffect(() => { if (s.view === 'quadro' && !s.drawer) setUi({ view: 'inicio' }) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  if (!me) return null

  const chief = isChief(me)
  const dev = usePref('dev')
  const [tl, setTl] = useState(false)
  const depts = deptList(s)
  const canEdit = canEditOffice(me, s.rows.carpenters)
  // painel do escritório: eu primeiro, depois quem está na sala, depois quem está fora
  const people = team(s.profiles, s).filter(p => p.avatar).sort((a, b) =>
    Number(b.id === me.id) - Number(a.id === me.id) || Number(s.online.has(b.id)) - Number(s.online.has(a.id)) || a.name.localeCompare(b.name))
  const office = s.view === 'escritorio'
  const page: Page = s.view !== 'quadro' ? s.view : s.drawer ? s.tab : 'quadro'
  // minha mesa = filtro "Só minhas"; aprovação = coluna do quadro; avisos = sino; chat = abre a janela flutuante
  const items: { id: Page | 'chatwin'; label: string; ic: TName; n?: number; tip?: string; more?: boolean }[] = [
    { id: 'inicio', label: 'Início', ic: 'inicio' },
    { id: 'quadro', label: 'Quadro', ic: 'quadro', n: pend, tip: pend ? `${pend} pedido(s) esperando você aceitar` : undefined },
    { id: 'agenda', label: 'Agenda', ic: 'agenda' },
    { id: 'chatwin', label: 'Chat', ic: 'chat', n: msgs },
    { id: 'escritorio', label: 'Escritório', ic: 'escritorio' },
    { id: 'arquivos', label: 'Arquivos', ic: 'arquivos' },
    { id: 'metas', label: 'Metas', ic: 'metas', more: true },
    { id: 'fluxos', label: 'Fluxos', ic: 'fluxos', more: true },
  ]
  // Equipe e Geral só no modo desenvolvedor (liga no menu do perfil)
  if (dev) items.push({ id: 'equipe', label: 'Equipe', ic: 'equipe', more: true })
  if (dev && chief) items.push({ id: 'geral', label: 'Geral', ic: 'mural', more: true, n: tasks.filter(t => t.status === 'inbox').length })
  const maisOn = mais || items.some(it => it.more && it.id === page)
  const goTo = (id: Page) => {
    if (id === 'mesa' || id === 'aprovar' || id === 'avisos' || id === 'equipe' || id === 'chat' || id === 'geral') setUi({ view: 'quadro', tab: id, drawer: true })
    else setUi({ view: id, drawer: false })
  }
  const pane = (tab: Tab) => <>
    {tab === 'mesa' && <Board />}
    {tab === 'equipe' && dev && <Team />}
    {tab === 'geral' && chief && <Overview />}
  </>
  const NavItem = ({ it }: { it: (typeof items)[number] }) => {
    // a janela do chat flutua por cima: aberta ganha só um fundo leve, o destaque fica na página
    const on = it.id !== 'chatwin' && page === it.id
    return (
      <button className={'nav-item' + (on ? ' on' : '') + (it.id === 'chatwin' && s.chatOpen ? ' aberto' : '')} onClick={() => it.id === 'chatwin' ? setUi({ chatOpen: !s.chatOpen }) : goTo(it.id)} title={it.tip} aria-current={on && it.id !== 'chatwin' ? 'page' : undefined}>
        <TIcon n={it.ic} size={22} /><span className="nav-l">{it.label}</span>{!!it.n && <i className="nav-n">{it.n > 9 ? '9+' : it.n}</i>}
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
        <div className="tbrand">
          <Marca />
          <span className="grow"><b>{TENANT.short}</b><small>{TENANT.sub}</small></span>
          {backend.mode === 'demo' && <span className="nav-demo">demo</span>}
        </div>
        <nav className="nav-list">
          {items.filter(it => !it.more).map(it => <NavItem key={it.id} it={it} />)}
          <button className={'nav-sec' + (maisOn ? ' on' : '')} onClick={toggleMais} aria-expanded={maisOn}>Mais <Ph n={maisOn ? 'caret-left' : 'caret-right'} size={14} /></button>
          {maisOn && items.filter(it => it.more).map(it => <NavItem key={it.id} it={it} />)}
        </nav>
        <div className="nav-me">
          <button className={'nav-av' + (page === 'loja' ? ' on' : '')} onClick={() => setMeOpen(!meOpen)} title={`${me.name} · ${me.role || rankName(me)}`} aria-expanded={meOpen}>
            <MiniAvatar avatar={me.avatar} photo={me.photo} name={me.name} size={36} />
            <span className="grow"><b>{me.name.split(' ')[0]}</b><small>{s.wallet ? `☕ ${s.wallet.balance} cafezinhos` : me.role || rankName(me)}</small></span>
            <TIcon n="ajustes" size={20} />
          </button>
          {meOpen && <>
            <div className="more-veil" onClick={() => setMeOpen(false)} />
            <div className="menu-pop more-pop me-pop">
              <div className="me-pop-h"><b>{me.name}</b><small>{me.role || rankName(me)}</small></div>
              <button onClick={() => { setMeOpen(false); setUi({ editing: true }) }}><Ph n="smiley" size={20} /><b className="grow">Meu personagem</b></button>
              <button onClick={() => { setMeOpen(false); goTo('loja') }}><Ph n="coffee" size={20} /><b className="grow">Almoxarifado</b>{s.wallet && <small className="me-pop-cf">☕ {s.wallet.balance}</small>}</button>
              <button onClick={() => setPref('dev', !dev)} aria-pressed={dev}><Ph n="gear-six" size={20} /><b className="grow">Modo desenvolvedor</b><i className={'tswitch' + (dev ? ' on' : '')} /></button>
              {dev && chief && depts.length > 1 && <div className="me-pop-salas">
                <small>Salas do andar</small>
                {depts.map(d => <button key={d.id} className={d.id === s.sala ? 'on' : ''} onClick={() => { setMeOpen(false); run(openSala(d.id)) }}>
                  <i className="sala-dot" style={{ background: d.color }} /><b className="grow">{d.name}</b>{d.id === s.sala && <small>aqui</small>}
                </button>)}
              </div>}
              <button onClick={() => { setMeOpen(false); void signOut() }}><Icon n="logout" size={20} /><b className="grow">Sair</b></button>
            </div>
          </>}
        </div>
        <div className="tfeito">feito com <Meo size={16} color="#2440FF" /><Wordmark size={14} /></div>
      </aside>
      <div className="page">
        {page !== 'inicio' && <div className="mbar">
          <b className="grow">{page === 'loja' ? 'Almoxarifado' : items.find(i => i.id === page)?.label ?? 'Escritório'}</b>
          <Bell />
          <MoreMenu />
        </div>}
        {s.sala !== myDept(s) && s.here === s.sala && <div className="banner sala-visit" onClick={() => run(openSala(myDept(s)))}>Você está na sala {deptName(s.sala, s)} <small>(clique para voltar para a sua)</small></div>}
        {s.error && <div className="banner" onClick={() => setUi({ error: '' })}>{s.error} <small>(clique para fechar)</small></div>}
        {page !== 'quadro' && page !== 'agenda' && page !== 'metas' && page !== 'fluxos' && page !== 'arquivos' && page !== 'inicio' && page !== 'loja' && <div className="ptop"><h1 className="grow">{items.find(i => i.id === page)?.label}</h1><Bell /></div>}
        <main className="main">
          {page === 'quadro' && <Quadro />}
          {page === 'inicio' && (isNarrow ? <Inicio /> : <InicioDesk />)}
          {page === 'agenda' && <Agenda />}
          {page === 'metas' && <Metas />}
          {page === 'fluxos' && <Fluxos />}
          {page === 'arquivos' && <Arquivos />}
          {page === 'loja' && <Loja />}
          {office && arrumando && <SalaEditor onClose={() => setArrumando(false)} />}
          {office && !arrumando && <>
            <div className="game-wrap"><Game />{canEdit && s.here === s.sala && <button className="btn primary sm game-edit" onClick={() => setArrumando(true)}>🪚 Arrumar sala</button>}
              <button className={'btn sm game-tl' + (new Date().getHours() >= 17 ? ' accent' : ' soft')} onClick={() => setTl(true)} title="Ver como todo mundo se movimentou hoje, acelerado"><Ph n="film-strip" size={16} />Timelapse do dia</button></div>
            {tl && <Timelapse onClose={() => setTl(false)} />}
            <aside className="side">
              <nav className="who-strip" aria-label="Ver a mesa de">
                {people.map(p => {
                  const here = p.id === me.id || s.online.has(p.id)
                  return (
                    <button key={p.id} className={(s.viewing ?? me.id) === p.id ? 'on' : ''} onClick={() => setUi({ viewing: p.id })} title={`${p.id === me.id ? 'Minha mesa' : p.name} · ${here ? 'no escritório' : 'fora'}`}>
                      <MiniAvatar avatar={p.avatar} photo={p.photo} name={p.name} size={30} dim={!here} />
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
