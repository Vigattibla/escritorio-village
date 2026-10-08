import { useState } from 'react'
import { isChief } from '../game/ranks'
import { setUi, signOut, useStore } from '../store'
import Icon, { Ph } from './Icon'
import type { PhName } from './ph'

/** Celular: o que não cabe na barra de baixo (Quadro, Fluxos, Equipe, Geral, Sair) fica num menu só. */
export default function MoreMenu() {
  const [open, setOpen] = useState(false)
  const me = useStore(s => s.profiles[s.meId!])
  const pend = useStore(s => Object.values(s.tasks).filter(t => t.owner_id === s.meId && t.status === 'inbox').length)
  const go = (fn: () => void) => () => { setOpen(false); fn() }
  const items: [PhName, string, () => void, number?][] = [
    ['kanban', 'Quadro', () => setUi({ view: 'quadro', drawer: false }), pend],
    ['flow-arrow', 'Fluxos', () => setUi({ view: 'fluxos', drawer: false })],
    ['folder-simple', 'Arquivos', () => setUi({ view: 'arquivos', drawer: false })],
    ['chat-circle-dots', 'Chat da equipe', () => setUi({ chatOpen: true })],
    ['users-three', 'Equipe', () => setUi({ view: 'quadro', tab: 'equipe', drawer: true })],
  ]
  if (me && isChief(me)) items.push(['squares-four', 'Geral', () => setUi({ view: 'quadro', tab: 'geral', drawer: true })])
  return (
    <div className="more-m">
      <button className="iconbtn" onClick={() => setOpen(!open)} aria-label="Mais" aria-expanded={open}><Icon n="menu" size={20} />{pend > 0 && <i>{pend > 9 ? '9+' : pend}</i>}</button>
      {open && <>
        <div className="more-veil" onClick={() => setOpen(false)} />
        <div className="menu-pop more-pop">
          {items.map(([ic, l, fn, n]) => <button key={l} onClick={go(fn)}><Ph n={ic} size={20} /><b className="grow">{l}</b>{!!n && <i className="nav-n">{n > 9 ? '9+' : n}</i>}</button>)}
          <button onClick={go(() => setUi({ editing: true }))}><Ph n="smiley" size={20} /><b className="grow">Meu personagem</b></button>
          <button onClick={go(() => signOut())}><Icon n="logout" size={20} /><b className="grow">Sair</b></button>
        </div>
      </>}
    </div>
  )
}
