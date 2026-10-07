import { useEffect, useRef, useState } from 'react'
import { rankName, rankOf } from '../game/ranks'
import { aiOnline, askAI, distribute, run, setUi, useStore } from '../store'
import type { AiItem, AiStage } from '../types'

const STAGE: Record<AiStage, string> = {
  pending: 'Esperando a ponte do PC pegar o pedido…',
  working: 'O Claude está lendo o time e dividindo as tarefas…',
}

/** Gerente escreve o que precisa ser feito; a IA propõe quem faz o quê; ele ajusta e distribui. */
export default function Distribuir() {
  const profiles = useStore(s => s.profiles)
  const projects = useStore(s => s.projects)
  const meId = useStore(s => s.meId)!
  const [prompt, setPrompt] = useState('')
  const [online, setOnline] = useState<boolean | null>(null)
  const [stage, setStage] = useState<AiStage | null>(null)
  const [secs, setSecs] = useState(0)
  const [err, setErr] = useState('')
  const [summary, setSummary] = useState('')
  const [items, setItems] = useState<AiItem[] | null>(null)
  const [sending, setSending] = useState(false)
  const abort = useRef<AbortController | null>(null)
  const close = () => { abort.current?.abort(); setUi({ aiOpen: false }) }
  const people = Object.values(profiles).sort((a, b) => rankOf(b) - rankOf(a) || a.name.localeCompare(b.name))
  const projList = Object.values(projects).filter(p => !p.archived).sort((a, b) => a.name.localeCompare(b.name))

  useEffect(() => {
    let on = true
    const check = () => aiOnline().then(v => on && setOnline(v)).catch(() => on && setOnline(false))
    check()
    const t = setInterval(check, 30000)
    return () => { on = false; clearInterval(t); abort.current?.abort() }
  }, [])
  useEffect(() => {
    if (!stage) return
    setSecs(0)
    const t = setInterval(() => setSecs(s => s + 1), 1000)
    return () => clearInterval(t)
  }, [stage === null])

  const ask = async () => {
    if (prompt.trim().length < 3 || stage) return
    setErr(''); setItems(null); setStage('pending')
    abort.current = new AbortController()
    try {
      const r = await askAI(prompt, s => setStage(s), abort.current.signal)
      setSummary(r.summary); setItems(r.items)
      if (!r.items.length) setErr('A IA não encontrou tarefas nesse pedido. Tente escrever uma por linha.')
    } catch (e) {
      if (!abort.current?.signal.aborted) setErr(e instanceof Error ? e.message : String(e))
    } finally { setStage(null) }
  }
  const edit = (i: number, p: Partial<AiItem>) => setItems(xs => xs!.map((x, j) => (j === i ? { ...x, ...p } : x)))
  const ready = !!items?.length && items.every(i => i.title.trim() && i.owner_id)
  const send = () => {
    if (!ready || sending) return
    setSending(true)
    run(distribute(items!).then(close).finally(() => setSending(false)))
  }

  return (
    <div className="modal-bg" onMouseDown={e => e.target === e.currentTarget && close()} onKeyDown={e => e.key === 'Escape' && close()}>
      <div className="task-modal ai-modal">
        <header className="task-top">
          <b className="grow">✨ Distribuir com IA</b>
          <span className={'ai-dot ' + (online ? 'on' : online === false ? 'off' : '')}>
            {online === null ? 'conferindo…' : online ? 'IA online' : 'IA offline'}
          </span>
          <button type="button" className="btn ghost sm" onClick={close} aria-label="Fechar">✕</button>
        </header>
        <div className="task-body">
          <label>O que precisa ser feito?
            <textarea autoFocus rows={4} maxLength={4000} value={prompt} disabled={!!stage}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) ask() }}
              placeholder={'Ex.: Semana das Crianças — arte do feed até sexta, orçamento de brinquedos, escala dos monitores no sábado…'} />
          </label>
          {online === false && !stage && <p className="muted small">A ponte do PC não deu sinal no último minuto. Dá para tentar mesmo assim: se o PC estiver desligado, aviso em 45 s.</p>}

          {stage ? (
            <div className="ai-wait" role="status">
              <span className="spin" />
              <div className="grow">
                <b>{STAGE[stage]}</b>
                <small className="muted">Normalmente leva de 10 a 40 s · {secs}s</small>
              </div>
              <button type="button" className="btn ghost sm" onClick={() => abort.current?.abort()}>Cancelar</button>
            </div>
          ) : (
            <div className="row gap">
              <button type="button" className="btn primary sm" disabled={prompt.trim().length < 3} onClick={ask}>
                {items ? '↻ Pedir outra proposta' : 'Pedir proposta'}
              </button>
              <small className="muted">Ctrl+Enter · nada é criado antes de você conferir</small>
            </div>
          )}
          {err && <p className="ai-err">{err}</p>}

          {items && items.length > 0 && (
            <div className="field">
              <h3>Proposta <span className="count">{items.length}</span></h3>
              {summary && <p className="muted small">{summary}</p>}
              <ul className="ai-list">
                {items.map((it, i) => (
                  <li key={i} className={'ai-card' + (it.owner_id ? '' : ' warn')}>
                    <div className="row gap">
                      <input className="grow" maxLength={140} value={it.title} onChange={e => edit(i, { title: e.target.value })} aria-label="Título" />
                      <button type="button" className="icon" title="Tirar" onClick={() => setItems(items.filter((_, j) => j !== i))}>✕</button>
                    </div>
                    <div className="row gap wrap">
                      <select value={it.owner_id} onChange={e => edit(i, { owner_id: e.target.value })} aria-label="Responsável">
                        <option value="">— escolher responsável —</option>
                        {people.map(p => <option key={p.id} value={p.id}>{p.id === meId ? `${p.name} (você)` : p.name} · {p.role || rankName(p)}</option>)}
                      </select>
                      <input type="date" value={it.due ?? ''} onChange={e => edit(i, { due: e.target.value || null })} aria-label="Prazo" />
                      <select value={it.project_id ?? ''} onChange={e => edit(i, { project_id: e.target.value || null })} aria-label="Projeto">
                        <option value="">Sem projeto</option>
                        {projList.map(p => <option key={p.id} value={p.id}>● {p.name}</option>)}
                      </select>
                    </div>
                    {it.why && <small className="muted">💡 {it.why}</small>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <footer className="task-foot">
          <span className="grow" />
          <button type="button" className="btn ghost sm" onClick={close}>Fechar</button>
          <button type="button" className="btn primary sm" disabled={!ready || sending} onClick={send}>
            {sending ? 'Criando…' : `Distribuir ${items?.length ?? 0} tarefa(s)`}
          </button>
        </footer>
      </div>
    </div>
  )
}
