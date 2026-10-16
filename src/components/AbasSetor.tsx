import { useState } from 'react'
import { ABAS, abasPadrao, canDoor, deptList, deptName, PAR_NOME, parceria, run, setDeptAbas, setUi, useStore } from '../store'
import type { ParModulo, Parceria } from '../types'
import { Fundo } from './Fundo'

const MODS: ParModulo[] = ['agenda', 'plano', 'redes']
const FIXAS = 'Início, Quadro e Escritório ficam sempre.'

/** cada setor liga as abas que usa e pede pra acompanhar a Agenda/Plano/Publicações de outro. Gerente da sala, Chefe ou adm */
export default function AbasSetor() {
  const s = useStore(st => st)
  const [sala, setSala] = useState(s.sala)
  const fechar = () => setUi({ abasOpen: false })
  const d = s.rows.depts[sala]
  if (!d) return null
  const pode = canDoor(sala)
  const ligadas = new Set(d.abas ?? abasPadrao(sala))
  const toggle = (id: string) => {
    const n = new Set(ligadas)
    if (n.has(id)) n.delete(id)
    else n.add(id)
    run(setDeptAbas(sala, ABAS.map(a => a[0]).filter(a => n.has(a))))
  }
  const outras = deptList(s).filter(x => x.id !== sala)
  const pars = Object.values(s.rows.parcerias)
  const minha = (para: string, m: ParModulo) => pars.find(p => p.de === sala && p.para === para && p.modulo === m)
  const recebidos = pars.filter(p => p.para === sala && p.status !== 'recusado').sort((a, b) => a.status.localeCompare(b.status) || b.created_at.localeCompare(a.created_at))
  const acao = (p: Pick<Parceria, 'de' | 'para' | 'modulo'>, a: 'pedir' | 'aceitar' | 'recusar' | 'sair') => run(parceria(p.de, p.para, p.modulo, a))

  return (
    <Fundo className="modal-bg" onMouseDown={e => e.target === e.currentTarget && fechar()} onKeyDown={e => e.key === 'Escape' && fechar()}>
      <div className="jan acc-modal abas-jan">
        <div className="abas-h">
          <h2 className="grow">Abas do setor</h2>
          {s.profiles[s.meId ?? '']?.rank === 4 || s.profiles[s.meId ?? '']?.is_admin ? (
            <select value={sala} onChange={e => setSala(e.target.value)} aria-label="Setor">
              {deptList(s).map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          ) : <b>{deptName(sala, s)}</b>}
        </div>

        <section>
          <h3>Abas que a sala usa</h3>
          <small className="muted">{FIXAS}</small>
          <div className="abas-lista">
            {ABAS.map(([id, nome]) => (
              <label key={id} className="abas-op">
                <input type="checkbox" checked={ligadas.has(id)} disabled={!pode} onChange={() => toggle(id)} />
                <span className="grow">{nome}</span>
              </label>
            ))}
          </div>
          {pode && d.abas && <button type="button" className="btn ghost sm" onClick={() => run(setDeptAbas(sala, null))}>Voltar ao padrão</button>}
        </section>

        <section>
          <h3>Acompanhar outros setores</h3>
          <small className="muted">Vocês veem as coisas deles (marcadas com o nome do setor) e podem mandar pedido. Quem edita continua sendo o dono. O gerente de lá aceita.</small>
          {outras.length === 0 && <p className="muted">Não há outros setores.</p>}
          {outras.map(o => (
            <div key={o.id} className="abas-par">
              <b className="grow"><i className="sala-dot" style={{ background: o.color }} />{o.name}</b>
              {MODS.map(m => {
                const p = minha(o.id, m)
                const nome = ABAS.find(a => a[0] === m)?.[1]
                if (p?.status === 'aceito') return <button key={m} type="button" className="btn sm on" disabled={!pode} title={`Vocês acompanham ${PAR_NOME[m]} de ${o.name}. Clique para sair.`} onClick={() => acao(p, 'sair')}>{nome} ✓</button>
                if (p?.status === 'pendente') return <button key={m} type="button" className="btn sm ghost" disabled={!pode} title="Esperando o gerente de lá. Clique para cancelar." onClick={() => acao(p, 'sair')}>{nome} · esperando</button>
                return <button key={m} type="button" className="btn sm ghost" disabled={!pode} title={p?.status === 'recusado' ? 'Recusado antes. Pedir de novo?' : `Pedir pra acompanhar ${PAR_NOME[m]}`} onClick={() => acao({ de: sala, para: o.id, modulo: m }, 'pedir')}>+ {nome}</button>
              })}
            </div>
          ))}
        </section>

        <section>
          <h3>Quem acompanha esta sala</h3>
          {recebidos.length === 0 && <small className="muted">Ninguém por enquanto.</small>}
          {recebidos.map(p => (
            <div key={p.id} className="abas-par">
              <span className="grow"><b>{deptName(p.de, s)}</b> {p.status === 'pendente' ? 'quer acompanhar' : 'acompanha'} {PAR_NOME[p.modulo]}</span>
              {pode && p.status === 'pendente' && <>
                <button type="button" className="btn sm" onClick={() => acao(p, 'aceitar')}>Aceitar</button>
                <button type="button" className="btn sm ghost" onClick={() => acao(p, 'recusar')}>Recusar</button>
              </>}
              {pode && p.status === 'aceito' && <button type="button" className="btn sm ghost" onClick={() => acao(p, 'sair')}>Encerrar</button>}
            </div>
          ))}
        </section>

        <button type="button" className="btn ghost" onClick={fechar}>Fechar</button>
      </div>
    </Fundo>
  )
}
