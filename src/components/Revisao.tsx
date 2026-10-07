import { useState } from 'react'
import { criteriaOf, review, run, useStore } from '../store'
import type { Task } from '../types'
import MiniAvatar from './MiniAvatar'

const when = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

/** Aprovar ou reprovar uma entrega: checklist dos critérios + justificativa obrigatória ao reprovar. */
export function ReviewBox({ t, compact = false }: { t: Task; compact?: boolean }) {
  const crit = criteriaOf(t)
  const [failed, setFailed] = useState<string[]>([])
  const [no, setNo] = useState(false)
  const [reason, setReason] = useState('')
  const toggle = (c: string) => setFailed(f => (f.includes(c) ? f.filter(x => x !== c) : [...f, c]))
  const ok = reason.trim().length >= 3

  return (
    <div className={'rvbox' + (compact ? ' compact' : '') + (no ? ' no' : '')}>
      {crit.length > 0 && (
        <ul className="rvcrit">
          {crit.map((c, i) => (
            <li key={i}>
              <label className={failed.includes(c) ? 'bad' : ''}>
                <input type="checkbox" checked={!failed.includes(c)} onChange={() => { toggle(c); setNo(true) }} />
                <span>{c}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
      {no && (
        <textarea
          className="rvreason" rows={2} maxLength={1000} autoFocus value={reason} onChange={e => setReason(e.target.value)}
          placeholder="Por que está reprovando? O que precisa mudar? (obrigatório)"
        />
      )}
      <div className="row gap">
        {!no && <button className="btn ok sm" disabled={failed.length > 0} onClick={() => run(review(t.id, true))}>✓ Aprovar</button>}
        {no
          ? <>
              <button className="btn danger sm" disabled={!ok} onClick={() => run(review(t.id, false, reason, failed))}>✕ Reprovar e devolver</button>
              <button className="btn ghost sm" onClick={() => { setNo(false); setFailed([]); setReason('') }}>Cancelar</button>
            </>
          : <button className="btn ghost sm" onClick={() => setNo(true)}>✕ Reprovar…</button>}
        {crit.length > 0 && !no && <small className="muted">Desmarque o critério que não passou.</small>}
      </div>
    </div>
  )
}

/** Histórico de decisões do aprovador. */
export function ReviewHistory({ t, max = 0 }: { t: Task; max?: number }) {
  const profiles = useStore(s => s.profiles)
  const list = [...t.reviews].reverse().slice(0, max || undefined)
  if (!list.length) return null
  return (
    <ul className="rvhist">
      {list.map((r, i) => (
        <li key={i} className={r.ok ? 'ok' : 'bad'}>
          <MiniAvatar avatar={profiles[r.by]?.avatar ?? null} photo={profiles[r.by]?.photo ?? null} size={22} />
          <div className="grow">
            <div className="small"><b>{r.ok ? '✅ Aprovada' : '❌ Reprovada'}</b> por {profiles[r.by]?.name ?? 'alguém'} · <span className="muted">{when(r.at)}</span></div>
            {r.reason && <p>{r.reason}</p>}
            {r.failed.length > 0 && <div className="rvfail">{r.failed.map(c => <span key={c}>✕ {c}</span>)}</div>}
          </div>
        </li>
      ))}
    </ul>
  )
}
