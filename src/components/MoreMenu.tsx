import { useState } from 'react'
import { isChief } from '../game/ranks'
import { vende } from '../game/vendas'
import { abasDe, setUi, signOut, useStore } from '../store'
import { MOD } from '../setor/tipos'
import Icon, { Ph } from './Icon'
import type { PhName } from './ph'
import { setPref, usePref } from '../prefs'
import { confirmar } from './Dialogo'

/** dentro do app Android o botão some; no navegador do celular, Android baixa o APK e iPhone aprende a pôr na tela */
const noApp = /EscritorioApp/.test(navigator.userAgent)
const iphone = /iPhone|iPad|iPod/.test(navigator.userAgent)
const baixarApp = () => iphone
  ? confirmar('Pôr na tela do iPhone', { text: 'No Safari, toque em Compartilhar (quadrado com seta) e depois em "Adicionar à Tela de Início". Abre como app e já vem sempre atualizado.', ok: 'Entendi', ic: 'download-simple' })
  : void (location.href = new URL('app/escritorio.apk', location.href.split(/[?#]/)[0]).href)

/** Celular: o que não cabe na barra de baixo (Quadro, Fluxos, Equipe, Geral, Sair) fica num menu só. */
export default function MoreMenu() {
  const [open, setOpen] = useState(false)
  const me = useStore(s => s.profiles[s.meId!])
  const pend = useStore(s => Object.values(s.tasks).filter(t => t.owner_id === s.meId && t.status === 'inbox').length)
  const dev = usePref('dev')
  const go = (fn: () => void) => () => { setOpen(false); fn() }
  const sv = useStore(s => !!me && !me.is_admin && vende(me, s))
  // abas da sala que não couberam na barra de baixo (lá fica só o 1º módulo, ou a Agenda)
  const abas = useStore(s => [...abasDe(s.sala, s)].join(',')).split(',').filter(Boolean)
  const naBarra = abas.find(id => MOD[id]) ?? (abas.includes('agenda') ? 'agenda' : '')
  const VIEW: Record<string, [PhName, string]> = { agenda: ['calendar-dots', 'Agenda'], plano: ['target', 'Plano'], redes: ['images', 'Publicações'] }
  const daSala: [PhName, string, () => void][] = sv ? [] : abas.filter(id => id !== naBarra && (MOD[id] || VIEW[id]))
    .map(id => MOD[id] ? [MOD[id].ic, MOD[id].nome, () => setUi({ view: `m:${id}`, drawer: false })] : [VIEW[id][0], VIEW[id][1], () => setUi({ view: id as 'agenda', drawer: false })])
  // setor de vendas: o resto já está na barra de baixo
  const items: [PhName, string, () => void, number?][] = sv ? [
    ['folder-simple', 'Arquivos', () => setUi({ view: 'arquivos', drawer: false })],
    ['coffee', 'Almoxarifado', () => setUi({ view: 'loja', drawer: false })],
    ['sparkle', 'Cassino', () => setUi({ cassino: true })],
    ['confetti', 'Bingo', () => setUi({ bingo: true })],
  ] : [
    ['kanban', 'Quadro', () => setUi({ view: 'quadro', drawer: false }), pend],
    ...(abas.includes('pedidos') ? [['hand-heart', 'Pedidos', () => setUi({ view: 'pedidos', drawer: false })] as [PhName, string, () => void]] : []),
    ...(abas.includes('legendas') ? [['sparkle', 'Legendas', () => setUi({ view: 'legendas', drawer: false })] as [PhName, string, () => void]] : []),
    ...(abas.includes('arquivos') ? [['folder-simple', 'Arquivos', () => setUi({ view: 'arquivos', drawer: false })] as [PhName, string, () => void]] : []),
    ['coffee', 'Almoxarifado', () => setUi({ view: 'loja', drawer: false })],
    ['sparkle', 'Cassino', () => setUi({ cassino: true })],
    ['confetti', 'Bingo', () => setUi({ bingo: true })],
    ['chat-circle-dots', 'Chat da equipe', () => setUi({ chatOpen: true })],
  ]
  if (dev && !sv) items.push(['users-three', 'Equipe', () => setUi({ view: 'quadro', tab: 'equipe', drawer: true })])
  if (dev && !sv && me && isChief(me)) items.push(['squares-four', 'Geral', () => setUi({ view: 'quadro', tab: 'geral', drawer: true })])
  return (
    <div className="more-m">
      <button className="iconbtn" onClick={() => setOpen(!open)} aria-label="Mais" aria-expanded={open}><Icon n="menu" size={20} />{pend > 0 && <i>{pend > 9 ? '9+' : pend}</i>}</button>
      {open && <>
        <div className="more-veil" onClick={() => setOpen(false)} />
        <div className="menu-pop more-pop">
          {daSala.length > 0 && <>
            <small className="more-sec">Da sala</small>
            {daSala.map(([ic, l, fn]) => <button key={l} onClick={go(fn)}><Ph n={ic} size={20} /><b className="grow">{l}</b></button>)}
            <hr />
          </>}
          {items.map(([ic, l, fn, n]) => <button key={l} onClick={go(fn)}><Ph n={ic} size={20} /><b className="grow">{l}</b>{!!n && <i className="nav-n">{n > 9 ? '9+' : n}</i>}</button>)}
          <button onClick={go(() => setUi({ editing: true }))}><Ph n="smiley" size={20} /><b className="grow">Meu personagem</b></button>
          {!noApp && <button onClick={go(baixarApp)}><Ph n="download-simple" size={20} /><b className="grow">{iphone ? 'Pôr na tela do iPhone' : 'Baixar o app'}</b></button>}
          <button onClick={go(() => setUi({ conectar: true }))}><Ph n="link" size={20} /><b className="grow">Conectar IA</b></button>
          <button onClick={() => setPref('dev', !dev)} aria-pressed={dev}><Ph n="gear-six" size={20} /><b className="grow">Modo desenvolvedor</b><i className={'tswitch' + (dev ? ' on' : '')} /></button>
          <button onClick={go(() => signOut())}><Icon n="logout" size={20} /><b className="grow">Sair</b></button>
        </div>
      </>}
    </div>
  )
}
