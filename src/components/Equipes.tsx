import { useState } from 'react'
import { deptOf, isChief } from '../game/ranks'
import { gereEquipe } from '../plano/core'
import { Modal, Pessoas, Rostos } from '../plano/ui'
import { deptList, deptName, dropRow, me, putRow, run, useStore } from '../store'
import type { Equipe } from '../types'
import { confirmar, pedirTexto } from './Dialogo'
import { Ph } from './Icon'
import type { PhName } from './ph'

export const SUGERIDAS: [string, PhName, string][] = [
  // lista do Pablo (12/10): só as equipes do marketing; o resto é outra linha de produto
  ['Comercial', 'storefront', '#B88A00'], ['Agentes de viagem', 'paper-plane-tilt', '#0E8FA8'], ['Edição de vídeo', 'film-strip', '#C2189B'],
  ['Design', 'sparkle', '#2440FF'], ['Performance (Tráfego Pago)', 'target', '#1F9D55'], ['Social Media', 'instagram-logo', '#E8620C'],
  ['Storymaker', 'play', '#7A3FD1'], ['Fotógrafo', 'images', '#0B7A6E'], ['Análise de dados', 'funnel', '#5A5A66'], ['Merchandising', 'gift', '#C2410C'],
]
const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32) || 'equipe'
const nova = (nome: string, dept: string | null, icone: string | null = 'users-three', cor: string | null = null): Equipe =>
  ({ id: `${slug(nome)}-${crypto.randomUUID().slice(0, 4)}`, nome: nome.trim().slice(0, 60), cor, icone, dept, pessoas: [], created_at: new Date().toISOString() })

/** marca de equipe: ícone na cor dela */
export function EqTag({ e, sm }: { e: Equipe; sm?: boolean }) {
  return <span className={'eq-tag' + (sm ? ' sm' : '')} style={{ ['--ec' as string]: e.cor ?? '#5A5A66' }}><Ph n={(e.icone ?? 'users-three') as PhName} size={sm ? 12 : 14} fill />{e.nome}</span>
}

/** equipes de cada pessoa (Design, Edição de vídeo…). Quem marca: gerente da sala, a Chefe ou o adm */
export function EquipesModal({ onClose }: { onClose: () => void }) {
  const equipes = useStore(s => s.rows.equipes)
  const profiles = useStore(s => s.profiles)
  const eu = me()
  const chefe = !!eu && (!!eu.is_admin || isChief(eu))
  const minha = eu ? deptOf(eu) : null
  const podeCriar = gereEquipe(eu, chefe ? null : minha) || chefe
  const deptNovo = chefe ? null : minha
  const lista = Object.values(equipes).sort((a, b) => a.nome.localeCompare(b.nome))
  const [open, setOpen] = useState<string | null>(null)
  const depts = deptList()
  const faltam = SUGERIDAS.filter(([n]) => !lista.some(e => e.nome.toLowerCase() === n.toLowerCase()))
  const criar = async () => {
    const nome = await pedirTexto('Nova equipe', { ph: 'Ex.: Design', ok: 'Criar', max: 60 })
    if (!nome?.trim()) return
    const e = nova(nome, deptNovo)
    await putRow('equipes', e); setOpen(e.id)
  }
  return (
    <Modal title="Equipes" onClose={onClose} wide>
      <small className="muted">Cada pessoa pode estar em uma ou mais equipes. Por enquanto as tarefas seguem indo para as pessoas; a equipe ajuda a achar quem faz e a filtrar o quadro. Quem marca: o gerente da sala, a Chefe ou o adm.</small>
      <div className="eq-list">
        {lista.map(e => {
          const pode = gereEquipe(eu, e.dept) || chefe
          const ids = e.pessoas.filter(id => profiles[id])
          const on = open === e.id
          const save = (p: Partial<Equipe>) => run(putRow('equipes', { ...e, ...p }))
          return (
            <div key={e.id} className={'eq-card' + (on ? ' on' : '')} style={{ ['--ec' as string]: e.cor ?? '#5A5A66' }}>
              <button type="button" className="eq-top" onClick={() => setOpen(on ? null : e.id)} aria-expanded={on}>
                <i className="eq-ic"><Ph n={(e.icone ?? 'users-three') as PhName} size={18} fill /></i>
                <span className="pl-rh-nm"><b>{e.nome}</b><small>{e.dept ? deptName(e.dept) : 'Todas as salas'} · {ids.length} {ids.length === 1 ? 'pessoa' : 'pessoas'}</small></span>
                {ids.length ? <Rostos ids={ids} profiles={profiles} size={24} max={4} /> : <span className="pl-falta">ninguém</span>}
                <Ph n="caret-right" size={16} />
              </button>
              {on && <div className="pl-eq">
                {pode ? <>
                  <div className="pl-eq-l">
                    <input key={e.nome} defaultValue={e.nome} maxLength={60} aria-label="Nome da equipe" onBlur={x => x.target.value.trim() && x.target.value.trim() !== e.nome && save({ nome: x.target.value.trim() })} onKeyDown={x => x.key === 'Enter' && x.currentTarget.blur()} />
                    <select value={e.dept ?? ''} onChange={x => save({ dept: x.target.value || null })} disabled={!chefe} aria-label="Sala da equipe">
                      <option value="">Todas as salas</option>{depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                  <span className="pl-lab">Quem faz parte</span>
                  <Pessoas sel={e.pessoas} sala={e.dept} onChange={ids => save({ pessoas: ids })} />
                  <footer className="pl-foot"><button type="button" className="btn ghost danger sm" onClick={async () => { if (await confirmar(`Apagar a equipe “${e.nome}”?`, { text: 'As pessoas e as tarefas continuam; só some o agrupamento.', danger: true })) run(dropRow('equipes', e.id)) }}><Ph n="trash" size={16} />Apagar</button></footer>
                </> : <small className="muted">Só o gerente da sala, a Chefe ou o adm mudam essa equipe.</small>}
              </div>}
            </div>
          )
        })}
        {!lista.length && <div className="eq-vazio"><Ph n="users-three" size={28} /><span>Nenhuma equipe ainda.</span></div>}
      </div>
      {podeCriar && faltam.length > 0 && <div className="eq-ex">
        <span className="pl-lab">Exemplos <small className="muted">· toque para criar só as que fazem sentido aqui</small></span>
        <div className="pl-pess">{faltam.map(([n, ic, c]) => <button type="button" key={n} className="eq-pick" style={{ ['--ec' as string]: c }} onClick={() => run(putRow('equipes', nova(n, deptNovo, ic, c)))}>
          <i className="eq-ic sm"><Ph n={ic} size={13} fill /></i>{n}<Ph n="plus" size={12} /></button>)}</div>
      </div>}
      {podeCriar && <footer className="pl-foot">
        <span className="grow" />
        <button type="button" className="btn accent" onClick={() => run(criar())}><Ph n="plus" size={16} />Nova equipe</button>
      </footer>}
    </Modal>
  )
}

/** escolhe as equipes de uma sigla do plano */
export function EscolheEquipes({ sel, onChange, onGerir }: { sel: string[]; onChange: (ids: string[]) => void; onGerir?: () => void }) {
  const equipes = useStore(s => s.rows.equipes)
  const lista = Object.values(equipes).sort((a, b) => a.nome.localeCompare(b.nome))
  return (
    <div className="pl-pess">
      {lista.map(e => <button type="button" key={e.id} className={'eq-pick' + (sel.includes(e.id) ? ' on' : '')} style={{ ['--ec' as string]: e.cor ?? '#5A5A66' }} onClick={() => onChange(sel.includes(e.id) ? sel.filter(x => x !== e.id) : [...sel, e.id])}>
        <i className="eq-ic sm"><Ph n={(e.icone ?? 'users-three') as PhName} size={13} fill /></i>{e.nome}<small>{e.pessoas.length}</small></button>)}
      {onGerir && <button type="button" className="pl-mais" onClick={onGerir}>{lista.length ? 'Equipes…' : 'Criar equipes…'}</button>}
    </div>
  )
}
