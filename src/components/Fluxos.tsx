import { useRef, useState } from 'react'
import { rankOf } from '../game/ranks'
import { addTask, dropRow, getState, me, putRow, run, setUi, useStore } from '../store'
import type { Flow, FlowNode } from '../types'
import { Bell } from './Avisos'
import Icon, { Ph } from './Icon'
import MiniAvatar from './MiniAvatar'
import { first } from './v4'

const NW = 220, NH = 96
const MODELOS: { name: string; objective: string; steps: [string, number[]][] }[] = [
  { name: 'Campanha de post', objective: 'Post publicado no prazo', steps: [['Briefing e oferta', []], ['Fotos', [0]], ['Texto do post', [0]], ['Arte final', [1, 2]], ['Publicar', [3]]] },
  { name: 'Evento no resort', objective: 'Evento redondo, do convite ao pós', steps: [['Data e orçamento', []], ['Divulgação', [0]], ['Reservas e lista', [0]], ['Checklist do dia', [1, 2]], ['Fotos e pós-evento', [3]]] },
  { name: 'Página do site', objective: 'Página nova no ar', steps: [['Conteúdo', []], ['Fotos', []], ['Montar a página', [0, 1]], ['Revisar e publicar', [2]]] },
]
const layout = (steps: [string, number[]][]): FlowNode[] => {
  const col: number[] = []
  steps.forEach(([, a], i) => { col[i] = a.length ? Math.max(...a.map(j => col[j])) + 1 : 0 })
  const rowIn: Record<number, number> = {}
  return steps.map(([title, after], i) => {
    const r = (rowIn[col[i]] = (rowIn[col[i]] ?? -1) + 1)
    return { id: 'n' + (i + 1), title, owner: null, due: null, x: 60 + col[i] * 290, y: 60 + r * 150, after: after.map(j => 'n' + (j + 1)), task_id: null }
  })
}

export default function Fluxos() {
  const flows = useStore(s => s.rows.flows)
  const tasks = useStore(s => s.tasks)
  const profiles = useStore(s => s.profiles)
  const meId = useStore(s => s.meId)!
  const cur = useStore(s => s.flow)
  const list = Object.values(flows).sort((a, b) => b.created_at.localeCompare(a.created_at))
  const f = (cur && flows[cur]) || list[0]
  const [pick, setPick] = useState<string | null>(null)
  const [models, setModels] = useState(false)
  const [drag, setDrag] = useState<{ id: string; dx: number; dy: number; x: number; y: number } | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const can = rankOf(me()) >= 2
  const people = Object.values(profiles).filter(p => p.avatar)
  const openN = (id: string) => Object.values(tasks).filter(t => t.owner_id === id && t.status !== 'done' && t.status !== 'declined').length

  const save = (fl: Flow) => run(putRow('flows', fl))
  const setNode = (id: string, patch: Partial<FlowNode>) => f && save({ ...f, nodes: f.nodes.map(n => (n.id === id ? { ...n, ...patch } : n)) })
  const create = (m?: typeof MODELOS[number]) => {
    const fl: Flow = { id: crypto.randomUUID(), name: m ? m.name : 'Novo fluxo', objective: m?.objective ?? '', nodes: m ? layout(m.steps) : layout([['Primeiro passo', []]]), created_by: meId, created_at: new Date().toISOString() }
    save(fl); setUi({ flow: fl.id }); setModels(false); setPick(null)
  }
  const addNode = () => {
    if (!f) return
    const last = f.nodes[f.nodes.length - 1]
    const id = 'n' + (Math.max(0, ...f.nodes.map(n => Number(n.id.slice(1)) || 0)) + 1)
    save({ ...f, nodes: [...f.nodes, { id, title: 'Novo passo', owner: null, due: null, x: (last?.x ?? 0) + 290, y: last?.y ?? 60, after: last ? [last.id] : [], task_id: null }] })
    setPick(id)
  }
  const pending = f ? f.nodes.filter(n => !n.task_id && n.owner) : []
  const send = async () => {
    if (!f) return
    const pj = getState().project
    const nodes = [...f.nodes]
    for (const [i, n] of nodes.entries()) {
      if (n.task_id || !n.owner) continue
      const t = await addTask(n.owner, n.title, n.due, f.objective ? `Fluxo “${f.name}”: ${f.objective}` : `Fluxo “${f.name}”`, 'todo', pj && pj !== '-' ? pj : null)
      nodes[i] = { ...n, task_id: t.id }
    }
    await putRow('flows', { ...f, nodes })
  }

  const onDown = (e: React.PointerEvent, n: FlowNode) => {
    if (!can || (e.target as HTMLElement).closest('button')) return
    e.currentTarget.setPointerCapture(e.pointerId)
    setDrag({ id: n.id, dx: e.clientX - n.x, dy: e.clientY - n.y, x: n.x, y: n.y })
  }
  const onMove = (e: React.PointerEvent) => drag && setDrag({ ...drag, x: Math.max(0, e.clientX - drag.dx), y: Math.max(0, e.clientY - drag.dy) })
  const onUp = (n: FlowNode) => {
    if (!drag) return
    const moved = Math.abs(drag.x - n.x) + Math.abs(drag.y - n.y) > 4
    if (moved) setNode(n.id, { x: Math.round(drag.x), y: Math.round(drag.y) })
    else setPick(p => (p === n.id ? null : n.id))
    setDrag(null)
  }
  const pos = (n: FlowNode) => (drag?.id === n.id ? { x: drag.x, y: drag.y } : { x: n.x, y: n.y })
  const W = f ? Math.max(900, ...f.nodes.map(n => pos(n).x + NW + 80)) : 900
  const H = f ? Math.max(520, ...f.nodes.map(n => pos(n).y + NH + 80)) : 520
  const node = f && pick ? f.nodes.find(n => n.id === pick) : undefined

  return (
    <div className="quadro fluxos">
      <div className="qbar">
        {list.length > 0 && (
          <label className="qchip on"><Ph n="tree-structure" size={15} />
            <select value={f?.id ?? ''} onChange={e => { setUi({ flow: e.target.value }); setPick(null) }} aria-label="Fluxo">
              {list.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          </label>
        )}
        <span className="grow" /><Bell />
        {can && <div className="pop-wrap">
          <button className="btn soft" onClick={() => setModels(v => !v)}><Ph n="squares-four" size={18} />Modelos</button>
          {models && <div className="menu-pop">
            <button onClick={() => create()}><Ph n="note-blank" size={18} /><div><b>Em branco</b><small>Começar do zero</small></div></button>
            {MODELOS.map(m => <button key={m.name} onClick={() => create(m)}><Ph n="flow-arrow" size={18} /><div><b>{m.name}</b><small>{m.steps.length} passos · {m.objective}</small></div></button>)}
          </div>}
        </div>}
        {can && f && <button className="btn accent" disabled={!pending.length} onClick={() => run(send())} title={pending.length ? 'Cria uma tarefa para cada passo com responsável' : 'Escolha quem faz cada passo'}>
          <Ph n="paper-plane-tilt" size={18} fill />{pending.length ? `Enviar ${pending.length} tarefa${pending.length > 1 ? 's' : ''}` : 'Tudo enviado'}</button>}
      </div>

      {!f ? (
        <div className="panel empty-goal"><Ph n="flow-arrow" size={36} /><b>Nenhum fluxo ainda</b>
          <small className="muted">{can ? 'Monte a estratégia em passos, escolha quem faz cada um e envie tudo como tarefas.' : 'Quando a coordenação montar um fluxo, ele aparece aqui.'}</small>
          {can && <button className="btn primary" onClick={() => setModels(true)}><Ph n="plus" size={18} fill />Criar fluxo</button>}</div>
      ) : (
        <>
          <div className="fl-head">
            {can ? <input key={f.id + f.name} className="fl-name" defaultValue={f.name} maxLength={80} onBlur={e => e.target.value.trim() && e.target.value !== f.name && save({ ...f, name: e.target.value.trim() })} onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()} aria-label="Nome do fluxo" /> : <h1>{f.name}</h1>}
            <span className="pill"><Ph n="tree-structure" size={14} />Estratégia</span>
            <span className="grow" />
            <div className="faces">{[...new Set(f.nodes.map(n => n.owner).filter(Boolean) as string[])].map(id => <MiniAvatar key={id} avatar={profiles[id]?.avatar ?? null} photo={profiles[id]?.photo ?? null} size={26} />)}</div>
            {can && <button className="btn soft sm" onClick={addNode}><Icon n="plus" size={14} />Passo</button>}
            {can && <button className="icon-btn" title="Apagar fluxo" aria-label="Apagar fluxo" onClick={() => { if (confirm(`Apagar o fluxo “${f.name}”? As tarefas já enviadas continuam.`)) { run(dropRow('flows', f.id)); setUi({ flow: null }) } }}><Icon n="trash" /></button>}
          </div>
          {can ? <input key={f.id + f.objective} className="fl-obj" defaultValue={f.objective} maxLength={160} placeholder="Objetivo (ex.: vender 30 pacotes até 15/12)" onBlur={e => e.target.value !== f.objective && save({ ...f, objective: e.target.value })} onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()} /> : f.objective && <p className="fl-obj">{f.objective}</p>}
          <div className="fl-wrap">
            <div className="canvas" ref={box}>
              <div className="canvas-in" style={{ width: W, height: H }}>
                <svg className="links" width={W} height={H}>
                  <defs><marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 10 5 0 10z" fill="#141519" /></marker></defs>
                  <g fill="none" stroke="#141519" strokeWidth={1.8} strokeDasharray="2 6" strokeLinecap="round" markerEnd="url(#ah)">
                    {f.nodes.flatMap(n => n.after.map(a => {
                      const s = f.nodes.find(x => x.id === a)
                      if (!s) return null
                      const p1 = pos(s), p2 = pos(n)
                      const x1 = p1.x + NW, y1 = p1.y + NH / 2, x2 = p2.x - 6, y2 = p2.y + NH / 2, mx = (x1 + x2) / 2
                      return <path key={a + n.id} d={`M${x1} ${y1} C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`} />
                    }))}
                  </g>
                </svg>
                {f.nodes.map(n => {
                  const p = pos(n)
                  const o = n.owner ? profiles[n.owner] : undefined
                  const t = n.task_id ? tasks[n.task_id] : undefined
                  const last = !f.nodes.some(x => x.after.includes(n.id))
                  return (
                    <div
                      key={n.id} className={'fn' + (pick === n.id ? ' on' : '') + (last ? ' goal-n' : '') + (drag?.id === n.id ? ' drag' : '') + (t ? ' sent' : '')}
                      style={{ left: p.x, top: p.y }} onPointerDown={e => onDown(e, n)} onPointerMove={onMove} onPointerUp={() => onUp(n)}
                      onClick={() => !can && t && setUi({ task: t.id })}
                    >
                      <b>{n.title}</b>
                      <div className="fn-meta">
                        {o ? <><MiniAvatar avatar={o.avatar} photo={o.photo} size={22} /><span>{first(o)}</span></> : <span className="muted">quem faz?</span>}
                        {n.due && <span className="fn-due"><Icon n="clock" size={12} />{new Date(n.due + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')}</span>}
                      </div>
                      {t && <button className="fn-task" onClick={() => setUi({ task: t.id })}><Ph n={t.status === 'done' ? 'check-circle' : 'paper-plane-tilt'} size={13} fill />{t.status === 'done' ? 'feita' : 'enviada'}</button>}
                    </div>
                  )
                })}
              </div>
            </div>
            {node && can && (
              <div className="panel picker">
                <header className="row"><b className="grow">Passo</b><button className="icon-btn" onClick={() => setPick(null)} aria-label="Fechar"><Icon n="x" size={14} /></button></header>
                <input key={node.id + node.title} defaultValue={node.title} maxLength={100} onBlur={e => e.target.value.trim() && e.target.value !== node.title && setNode(node.id, { title: e.target.value.trim() })} onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()} aria-label="Título do passo" />
                <small className="muted">Quem faz</small>
                <div className="pk-people">
                  {people.map(p => (
                    <button key={p.id} className={node.owner === p.id ? 'on' : ''} onClick={() => setNode(node.id, { owner: node.owner === p.id ? null : p.id })} disabled={!!node.task_id}>
                      <MiniAvatar avatar={p.avatar} photo={p.photo} size={26} /><span>{p.id === meId ? 'Eu' : first(p)}</span><small>{openN(p.id)} abertas</small>
                    </button>
                  ))}
                </div>
                <label>Prazo<input type="date" value={node.due ?? ''} onChange={e => setNode(node.id, { due: e.target.value || null })} disabled={!!node.task_id} /></label>
                <small className="muted">Vem depois de</small>
                <div className="opts">
                  {f.nodes.filter(x => x.id !== node.id).map(x => (
                    <button key={x.id} className={'qchip' + (node.after.includes(x.id) ? ' on' : '')} onClick={() => setNode(node.id, { after: node.after.includes(x.id) ? node.after.filter(a => a !== x.id) : [...node.after, x.id] })}>{x.title}</button>
                  ))}
                </div>
                {node.task_id ? <small className="muted">Já virou tarefa: edite pelo cartão.</small> : (
                  <button className="btn ghost danger sm" onClick={() => { save({ ...f, nodes: f.nodes.filter(x => x.id !== node.id).map(x => ({ ...x, after: x.after.filter(a => a !== node.id) })) }); setPick(null) }}><Icon n="trash" size={14} />Tirar passo</button>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
