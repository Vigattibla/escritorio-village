import { useState } from 'react'
import { dayKey } from '../game/xp'
import { team, useStore } from '../store'
import type { Task } from '../types'
import { Ph } from './Icon'
import MiniAvatar from './MiniAvatar'

/** segunda-feira da semana de d, deslocada n semanas */
export const segunda = (n = 0, d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7) + n * 7); return x }
const curto = (d: Date) => d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }).replace('.', '')
const dia = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric' }).replace('.', '')

/** Relatório da semana: o que cada um concluiu. As concluídas de semanas passadas saem do quadro e ficam guardadas aqui. */
export default function Relatorio({ onClose }: { onClose: () => void }) {
  const s = useStore(x => x)
  const [n, setN] = useState(0)
  const ini = segunda(n), fim = segunda(n + 1)
  const a = dayKey(ini), b = dayKey(fim)
  const hoje = dayKey(new Date())
  const tasks = Object.values(s.tasks)
  const naSemana = (iso: string | null) => !!iso && dayKey(iso) >= a && dayKey(iso) < b
  const gente = team(s.profiles, s).filter(p => p.avatar).sort((x, y) => x.name.localeCompare(y.name))
  const linhas = gente.map(p => {
    const meu = (t: Task) => t.owner_id === p.id
    const feitas = tasks.filter(t => meu(t) && t.status === 'done' && naSemana(t.done_at)).sort((x, y) => x.done_at!.localeCompare(y.done_at!))
    const ajudou = tasks.filter(t => !meu(t) && t.collaborators.includes(p.id) && t.status === 'done' && naSemana(t.done_at))
    const abertas = tasks.filter(t => meu(t) && (t.status === 'todo' || t.status === 'doing' || t.status === 'review'))
    const atrasadas = abertas.filter(t => t.due && t.due < hoje)
    const refeitas = tasks.filter(t => meu(t) && t.reviews.some(r => r.ok === false && naSemana(r.at)))
    return { p, feitas, ajudou, abertas, atrasadas, refeitas }
  })
  const total = linhas.reduce((m, l) => m + l.feitas.length, 0)
  const close = () => onClose()
  return (
    <div className="modal-bg" onMouseDown={e => e.target === e.currentTarget && close()} onKeyDown={e => e.key === 'Escape' && close()}>
      <div className="rel" role="dialog" aria-label="Relatório da semana">
        <header className="rel-top">
          <div className="grow">
            <h2>Relatório da semana</h2>
            <small>{curto(ini)} – {curto(new Date(fim.getTime() - 864e5))} · {total} concluída{total === 1 ? '' : 's'}</small>
          </div>
          <div className="rel-sem no-print">
            <button className="iconbtn" onClick={() => setN(n - 1)} aria-label="Semana anterior"><Ph n="caret-left" size={18} /></button>
            <b>{n === 0 ? 'Esta semana' : n === -1 ? 'Semana passada' : `${-n} semanas atrás`}</b>
            <button className="iconbtn" onClick={() => setN(n + 1)} disabled={n >= 0} aria-label="Próxima semana"><Ph n="caret-right" size={18} /></button>
          </div>
          <button className="btn soft no-print" onClick={() => print()}><Ph n="printer" size={18} />Imprimir / PDF</button>
          <button className="btn ghost sm no-print" onClick={close} aria-label="Fechar">✕</button>
        </header>
        <div className="rel-lista">
          {linhas.map(({ p, feitas, ajudou, abertas, atrasadas, refeitas }) => (
            <section key={p.id} className="rel-p">
              <header>
                <MiniAvatar avatar={p.avatar} photo={p.photo} name={p.name} size={36} />
                <span className="grow"><b>{p.name}</b><small>{p.role}</small></span>
                <span className="rel-n"><b>{feitas.length}</b>concluída{feitas.length === 1 ? '' : 's'}</span>
                {ajudou.length > 0 && <span className="rel-n"><b>{ajudou.length}</b>ajudou</span>}
                {n === 0 && <span className="rel-n"><b>{abertas.length}</b>em aberto</span>}
                {n === 0 && atrasadas.length > 0 && <span className="rel-n tang"><b>{atrasadas.length}</b>atrasada{atrasadas.length === 1 ? '' : 's'}</span>}
                {refeitas.length > 0 && <span className="rel-n"><b>{refeitas.length}</b>refeita{refeitas.length === 1 ? '' : 's'}</span>}
              </header>
              {feitas.length + ajudou.length === 0 ? <p className="rel-vazio">Nada concluído nesta semana.</p> : (
                <ul>
                  {feitas.map(t => <li key={t.id}><Ph n="check-circle" size={16} fill /><span className="grow">{t.title}{t.project_id && s.projects[t.project_id] && <small> · {s.projects[t.project_id].name}</small>}</span><small>{dia(t.done_at!)}</small></li>)}
                  {ajudou.map(t => <li key={t.id} className="aj"><Ph n="hand-heart" size={16} /><span className="grow">{t.title}<small> · de {s.profiles[t.owner_id]?.name.split(' ')[0] ?? 'alguém'}</small></span><small>{dia(t.done_at!)}</small></li>)}
                </ul>
              )}
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
