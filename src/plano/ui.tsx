// Peças pequenas do plano usadas na aba Plano, na Agenda e nas Equipes.
import { useState } from 'react'
import { Fundo } from '../components/Fundo'
import { deptOf } from '../game/ranks'
import { useStore } from '../store'
import type { Profile } from '../types'
import { Ph } from '../components/Icon'
import MiniAvatar from '../components/MiniAvatar'
import { corSig, siglas } from './core'

/** sigla na cor dela; passando o mouse mostra o que ela significa */
export function Sig({ s, big }: { s: string; big?: boolean }) {
  const resp = useStore(st => st.rows.plano_resp)
  const k = s.trim().toUpperCase()
  const sig = resp[k]?.nome ? `${k} = ${resp[k].nome}` : siglas(k).map(c => resp[c]?.nome ? `${c} = ${resp[c].nome}` : c).join(' · ')
  return <em className={'pl-sig' + (big ? ' big' : '')} style={{ ['--sc' as string]: corSig(s) }} title={sig}>{s}</em>
}
export function Rostos({ ids, profiles, size = 24, max = 4 }: { ids: string[]; profiles: Record<string, Profile>; size?: number; max?: number }) {
  return <span className="faces">{ids.slice(0, max).map(id => <MiniAvatar key={id} avatar={profiles[id]?.avatar ?? null} photo={profiles[id]?.photo ?? null} name={profiles[id]?.name} size={size} />)}{ids.length > max && <i className="pl-mais-n">+{ids.length - max}</i>}</span>
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <Fundo className="modal-bg" onMouseDown={e => e.target === e.currentTarget && onClose()} onKeyDown={e => e.key === 'Escape' && onClose()}>
      <div className={'jan pl-modal' + (wide ? ' wide' : '')} role="dialog" aria-label={title}>
        <header className="pl-mh"><h2>{title}</h2><button className="icon-btn" onClick={onClose} aria-label="Fechar"><Ph n="x" size={18} /></button></header>
        {children}
      </div>
    </Fundo>
  )
}

export function Pessoas({ sel, sala, onChange }: { sel: string[]; sala: string | null; onChange: (ids: string[]) => void }) {
  const profiles = useStore(s => s.profiles)
  const [todas, setTodas] = useState(false)
  const lista = Object.values(profiles).filter(p => todas || !sala || deptOf(p) === sala || sel.includes(p.id)).sort((a, b) => Number(sel.includes(b.id)) - Number(sel.includes(a.id)) || a.name.localeCompare(b.name))
  return (
    <div className="pl-pess">
      {lista.map(p => <button type="button" key={p.id} className={sel.includes(p.id) ? 'on' : ''} onClick={() => onChange(sel.includes(p.id) ? sel.filter(x => x !== p.id) : [...sel, p.id])}>
        <MiniAvatar avatar={p.avatar} photo={p.photo} name={p.name} size={24} />{p.name.split(' ')[0]}{sel[0] === p.id && sel.length > 1 && <small>dono</small>}</button>)}
      {sala && !todas && <button type="button" className="pl-mais" onClick={() => setTodas(true)}>Outras salas…</button>}
      {!lista.length && <small className="muted">Ninguém nessa sala ainda.</small>}
    </div>
  )
}
