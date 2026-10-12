import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Ph } from './Icon'
import type { PhName } from './ph'
import { Fundo } from './Fundo'

/** Diálogo do próprio app no lugar do confirm()/prompt() do navegador (aquela janelinha no topo). */
interface Pedido { title: string; text?: string; ok?: string; danger?: boolean; campo?: { ph?: string; v?: string; max?: number }; ic?: PhName; done: (v: string | null) => void }

let atual: Pedido | null = null
const subs = new Set<() => void>()
const set = (p: Pedido | null) => { atual = p; subs.forEach(f => f()) }

const abrir = (p: Omit<Pedido, 'done'>) => new Promise<string | null>(done => { atual?.done(null); set({ ...p, done }) })

/** sim/não; resolve true só no botão de confirmar */
export const confirmar = (title: string, o: { text?: string; ok?: string; danger?: boolean; ic?: PhName } = {}) => abrir({ title, ...o }).then(v => v !== null)
/** pede um texto; null = cancelou ou vazio */
export const pedirTexto = (title: string, o: { text?: string; ok?: string; ph?: string; v?: string; max?: number } = {}) =>
  abrir({ title, text: o.text, ok: o.ok ?? 'Criar', campo: { ph: o.ph, v: o.v, max: o.max } }).then(v => v?.trim() || null)

export default function Dialogos() {
  const p = useSyncExternalStore(f => { subs.add(f); return () => { subs.delete(f) } }, () => atual)
  return p ? <Caixa key={p.title + (p.text ?? '')} p={p} /> : null
}

function Caixa({ p }: { p: Pedido }) {
  const [v, setV] = useState(p.campo?.v ?? '')
  const okRef = useRef<HTMLButtonElement>(null)
  const fim = (r: string | null) => { set(null); p.done(r) }
  useEffect(() => { if (!p.campo) okRef.current?.focus() }, [p.campo])
  return (
    <Fundo className="modal-bg dlg-bg" onMouseDown={e => e.target === e.currentTarget && fim(null)} onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); fim(null) } }}>
      <form className="jan dlg" role="alertdialog" aria-label={p.title} onSubmit={e => { e.preventDefault(); if (!p.campo || v.trim()) fim(p.campo ? v : '') }}>
        <div className={'dlg-ic' + (p.danger ? ' danger' : '')}><Ph n={p.ic ?? (p.danger ? 'trash' : p.campo ? 'pencil-simple-line' : 'check-circle')} size={22} fill /></div>
        <div className="dlg-tx">
          <h2>{p.title}</h2>
          {p.text && <p>{p.text}</p>}
          {p.campo && <input value={v} onChange={e => setV(e.target.value)} placeholder={p.campo.ph} maxLength={p.campo.max ?? 120} autoFocus aria-label={p.title} />}
        </div>
        <footer className="dlg-ft">
          <button type="button" className="btn ghost" onClick={() => fim(null)}>Cancelar</button>
          <button ref={okRef} className={'btn ' + (p.danger ? 'danger' : 'accent')} disabled={!!p.campo && !v.trim()}>{p.ok ?? (p.danger ? 'Apagar' : 'Confirmar')}</button>
        </footer>
      </form>
    </Fundo>
  )
}
