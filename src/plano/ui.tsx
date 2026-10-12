// Peças pequenas do plano usadas na aba Plano, na Agenda e nas Equipes.
import { useState } from 'react'
import { Fundo } from '../components/Fundo'
import { deptOf } from '../game/ranks'
import { deptName, me, useStore } from '../store'
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

/** quem faz: só o setor da ação (ou o meu) à mostra; os outros setores ficam recolhidos */
export function Pessoas({ sel, sala, onChange }: { sel: string[]; sala: string | null; onChange: (ids: string[]) => void }) {
  const profiles = useStore(s => s.profiles)
  const [todas, setTodas] = useState(false)
  const eu = me()
  const base = sala ?? (eu ? deptOf(eu) : null)
  const ord = (a: Profile, b: Profile) => Number(sel.includes(b.id)) - Number(sel.includes(a.id)) || a.name.localeCompare(b.name)
  const todos = Object.values(profiles)
  const lista = todos.filter(p => !base || deptOf(p) === base || sel.includes(p.id)).sort(ord)
  const outros = todos.filter(p => !lista.includes(p))
  const setores = [...new Set(outros.map(p => deptOf(p)))].map(d => [d, outros.filter(p => deptOf(p) === d).sort(ord)] as const).sort((a, b) => deptName(a[0]).localeCompare(deptName(b[0])))
  const bt = (p: Profile) => <button type="button" key={p.id} className={sel.includes(p.id) ? 'on' : ''} onClick={() => onChange(sel.includes(p.id) ? sel.filter(x => x !== p.id) : [...sel, p.id])}>
    <MiniAvatar avatar={p.avatar} photo={p.photo} name={p.name} size={24} />{p.name.split(' ')[0]}{sel[0] === p.id && sel.length > 1 && <small>dono</small>}</button>
  return (
    <div className="pl-pess-w">
      {base && <span className="pl-set">{deptName(base)}</span>}
      <div className="pl-pess">
        {lista.map(bt)}
        {!lista.length && <small className="muted">Ninguém nesse setor ainda.</small>}
        {outros.length > 0 && <button type="button" className="pl-mais" onClick={() => setTodas(!todas)} aria-expanded={todas}>{todas ? 'Esconder outros setores' : `Outros setores (${outros.length})`}</button>}
      </div>
      {todas && setores.map(([d, ps]) => <div key={d} className="pl-set-g"><span className="pl-set">{deptName(d)}</span><div className="pl-pess">{ps.map(bt)}</div></div>)}
    </div>
  )
}
