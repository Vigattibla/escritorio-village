import { useEffect, useState } from 'react'
import { dropRow, putRow, run, useStore } from '../store'
import type { Nota } from '../types'
import { Ph } from './Icon'

/** anotação não fixada some depois disso */
const VIDA = 7 * 864e5
const quando = (iso: string) => {
  const m = Math.round((Date.now() - Date.parse(iso)) / 6e4)
  return m < 1 ? 'agora' : m < 60 ? `há ${m} min` : m < 1440 ? `há ${Math.round(m / 60)} h` : m < 2880 ? 'ontem' : `há ${Math.floor(m / 1440)} dias`
}
const resta = (iso: string) => { const d = Math.ceil((Date.parse(iso) + VIDA - Date.now()) / 864e5); return d <= 1 ? 'some amanhã' : `some em ${d} dias` }

/** caderninho: rascunho rápido de cada pessoa (só ela vê) */
export default function Caderno() {
  const meId = useStore(s => s.meId)
  const rows = useStore(s => s.rows.caderno)
  const [txt, setTxt] = useState('')
  const [ed, setEd] = useState<string | null>(null)
  const [copiou, setCopiou] = useState<string | null>(null)
  const notas = Object.values(rows).filter(n => n.user_id === meId).sort((a, b) => Number(b.fixa) - Number(a.fixa) || b.created_at.localeCompare(a.created_at))

  useEffect(() => {
    const t = Date.now()
    for (const n of Object.values(rows)) if (n.user_id === meId && !n.fixa && t - Date.parse(n.created_at) > VIDA) run(dropRow('caderno', n.id))
  }, [rows, meId])

  const nova = () => {
    const t = txt.trim()
    if (!t || !meId) return
    run(putRow('caderno', { id: crypto.randomUUID(), user_id: meId, texto: t.slice(0, 4000), fixa: false, created_at: new Date().toISOString() }))
    setTxt('')
  }
  // editar renova o prazo de 7 dias
  const salva = (n: Nota, texto: string) => {
    setEd(null)
    const t = texto.trim()
    if (!t) return run(dropRow('caderno', n.id))
    if (t !== n.texto) run(putRow('caderno', { ...n, texto: t.slice(0, 4000), created_at: new Date().toISOString() }))
  }
  const copia = (n: Nota) => navigator.clipboard?.writeText(n.texto).then(() => { setCopiou(n.id); setTimeout(() => setCopiou(c => c === n.id ? null : c), 1400) })

  return (
    <div className="cad">
      <header><Ph n="note-blank" size={18} /><b>Caderninho</b><small>só você vê</small></header>
      <textarea className="cad-in" rows={3} value={txt} maxLength={4000} placeholder="Anotar… (Enter salva, Shift+Enter pula linha)"
        onChange={e => setTxt(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); nova() } }} />
      {!notas.length && <p className="cad-vazio muted">Recado, número de reserva, lembrete do dia… Some sozinho em 7 dias; fixe com a estrela pra guardar.</p>}
      <ul className="cad-lista">
        {notas.map(n => (
          <li key={n.id} className={'cad-nota' + (n.fixa ? ' fixa' : '')}>
            {ed === n.id
              ? <textarea autoFocus defaultValue={n.texto} maxLength={4000} rows={Math.min(8, n.texto.split('\n').length + 1)} onBlur={e => salva(n, e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.blur() } else if (e.key === 'Escape') setEd(null) }} />
              : <p onClick={() => setEd(n.id)} title="Clique pra editar">{n.texto}</p>}
            <footer>
              <small>{quando(n.created_at)}{!n.fixa && ` · ${resta(n.created_at)}`}</small>
              <span className="grow" />
              <button className={copiou === n.id ? 'on' : ''} onClick={() => copia(n)} title={copiou === n.id ? 'Copiado' : 'Copiar'} aria-label="Copiar"><Ph n={copiou === n.id ? 'check' : 'copy'} size={15} /></button>
              <button className={n.fixa ? 'on' : ''} onClick={() => run(putRow('caderno', { ...n, fixa: !n.fixa, created_at: n.fixa ? new Date().toISOString() : n.created_at }))} title={n.fixa ? 'Desafixar (volta a sumir em 7 dias)' : 'Fixar (não some)'} aria-label="Fixar"><Ph n="star" size={15} fill={n.fixa} /></button>
              <button onClick={() => run(dropRow('caderno', n.id))} title="Apagar" aria-label="Apagar"><Ph n="trash" size={15} /></button>
            </footer>
          </li>
        ))}
      </ul>
    </div>
  )
}
