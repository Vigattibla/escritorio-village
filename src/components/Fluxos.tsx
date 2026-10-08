import { useRef, useState } from 'react'
import { rankOf } from '../game/ranks'
import { addTask, dropRow, getState, me, putRow, run, setUi, useStore } from '../store'
import type { Flow, FlowNode } from '../types'
import { StatusTag } from './Agenda'
import Icon, { Ph } from './Icon'
import MiniAvatar from './MiniAvatar'
import SegInd from './SegInd'
import { first } from './v4'

const NW = 220, NH = 96, OX = 290 // OX: espaço do nó do objetivo, à esquerda
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
  const [mode, setMode] = useState<'seq' | 'mapa'>('seq')
  const [z, setZ] = useState(() => (matchMedia('(max-width: 900px)').matches ? 0.6 : 1))
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
    setDrag({ id: n.id, dx: e.clientX / z - n.x, dy: e.clientY / z - n.y, x: n.x, y: n.y })
  }
  const onMove = (e: React.PointerEvent) => drag && setDrag({ ...drag, x: Math.max(0, e.clientX / z - drag.dx), y: Math.max(0, e.clientY / z - drag.dy) })
  const onUp = (n: FlowNode) => {
    if (!drag) return
    const moved = Math.abs(drag.x - n.x) + Math.abs(drag.y - n.y) > 4
    if (moved) setNode(n.id, { x: Math.round(drag.x), y: Math.round(drag.y) })
    else setPick(p => (p === n.id ? null : n.id))
    setDrag(null)
  }
  // Sequência: etapas pela ordem de dependência (passos sem vínculo entre si ficam na mesma etapa)
  const steps: FlowNode[][] = []
  if (f) {
    const depth: Record<string, number> = {}
    const d = (n: FlowNode, seen: string[] = []): number => {
      if (depth[n.id] != null) return depth[n.id]
      const prev = n.after.map(a => f.nodes.find(x => x.id === a)).filter((x): x is FlowNode => !!x && !seen.includes(x.id))
      return (depth[n.id] = prev.length ? Math.max(...prev.map(p => d(p, [...seen, n.id]))) + 1 : 0)
    }
    f.nodes.forEach(n => (steps[d(n)] ??= []).push(n))
  }
  const pos = (n: FlowNode) => (drag?.id === n.id ? { x: drag.x, y: drag.y } : { x: n.x, y: n.y })
  const W = f ? Math.max(900, ...f.nodes.map(n => pos(n).x + OX + NW + 80)) : 900
  const H = f ? Math.max(520, ...f.nodes.map(n => pos(n).y + NH + 80)) : 520
  const node = f && pick ? f.nodes.find(n => n.id === pick) : undefined
  const roots = f ? f.nodes.filter(n => !n.after.some(a => f.nodes.some(x => x.id === a))) : []
  const goalY = roots.length ? roots.reduce((s, n) => s + pos(n).y, 0) / roots.length : 60

  return (
    <div className="quadro fluxos">
      {!f ? (
        <div className="panel empty-goal"><Ph n="flow-arrow" size={36} /><b>Nenhum fluxo ainda</b>
          <small className="muted">{can ? 'Monte a estratégia em passos, escolha quem faz cada um e envie tudo como tarefas.' : 'Quando a coordenação montar um fluxo, ele aparece aqui.'}</small>
          {can && <div className="row gap"><button className="btn primary" onClick={() => create()}><Ph n="plus" size={18} fill />Em branco</button>{MODELOS.map(m => <button key={m.name} className="btn soft" onClick={() => create(m)}><Ph n="flow-arrow" size={18} />{m.name}</button>)}</div>}</div>
      ) : (
        <>
          <div className="fl-head">
            {can ? <input key={f.id + f.name} className="fl-name" defaultValue={f.name} maxLength={80} onBlur={e => e.target.value.trim() && e.target.value !== f.name && save({ ...f, name: e.target.value.trim() })} onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()} aria-label="Nome do fluxo" /> : <h1>{f.name}</h1>}
            <span className="pill"><Ph n="tree-structure" size={14} />Estratégia</span>
            <div className="seg" role="tablist" aria-label="Visão">
              <SegInd />
              <button className={mode === 'seq' ? 'on' : ''} onClick={() => setMode('seq')} title="Passos alinhados pela ordem"><Ph n="flow-arrow" size={18} fill={mode === 'seq'} />Sequência</button>
              <button className={mode === 'mapa' ? 'on' : ''} onClick={() => setMode('mapa')} title="Arraste os passos livremente"><Ph n="git-fork" size={18} fill={mode === 'mapa'} />Mapa</button>
            </div>
            {list.length > 1 && (
              <label className="qchip"><Ph n="tree-structure" size={15} />
                <select value={f.id} onChange={e => { setUi({ flow: e.target.value }); setPick(null) }} aria-label="Trocar de fluxo">
                  {list.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
              </label>
            )}
            <span className="grow" />
            <div className="faces">{[...new Set(f.nodes.map(n => n.owner).filter(Boolean) as string[])].map(id => <MiniAvatar key={id} avatar={profiles[id]?.avatar ?? null} photo={profiles[id]?.photo ?? null} size={30} />)}</div>
            {can && <div className="pop-wrap">
              <button className="btn soft" onClick={() => setModels(v => !v)}><Ph n="squares-four" size={18} />Modelos</button>
              {models && <div className="menu-pop">
                <button onClick={() => create()}><Ph n="note-blank" size={18} /><div><b>Em branco</b><small>Começar do zero</small></div></button>
                {MODELOS.map(m => <button key={m.name} onClick={() => create(m)}><Ph n="flow-arrow" size={18} /><div><b>{m.name}</b><small>{m.steps.length} passos · {m.objective}</small></div></button>)}
              </div>}
            </div>}
            {can && <button className="btn accent" disabled={!pending.length} onClick={() => run(send())} title={pending.length ? 'Cria uma tarefa para cada passo com responsável' : 'Escolha quem faz cada passo'}>
              <Ph n="paper-plane-tilt" size={18} fill />{pending.length ? `Enviar ${pending.length} tarefa${pending.length > 1 ? 's' : ''}` : 'Tudo enviado'}</button>}
            {can && <button className="icon-btn" title="Apagar fluxo" aria-label="Apagar fluxo" onClick={() => { if (confirm(`Apagar o fluxo “${f.name}”? As tarefas já enviadas continuam.`)) { run(dropRow('flows', f.id)); setUi({ flow: null }) } }}><Icon n="trash" /></button>}
          </div>
          <div className="fl-wrap">
            {mode === 'seq' ? (
              <ol className="seq">
                <li className="seq-goal"><span className="seq-dot"><Ph n="star" size={14} fill /></span><div><small>Objetivo</small><b>{f.objective || 'Sem objetivo definido'}</b></div></li>
                {steps.map((row, k) => (
                  <li key={k} className="seq-step">
                    <span className="seq-dot">{k + 1}</span>
                    <div className="seq-row">
                      <small>Etapa {k + 1}{row.length > 1 ? ` · ${row.length} passos ao mesmo tempo` : ''}</small>
                      <div className="seq-cards">
                        {row.map(n => {
                          const o = n.owner ? profiles[n.owner] : undefined
                          const t = n.task_id ? tasks[n.task_id] : undefined
                          return (
                            <button key={n.id} className={'seq-card' + (pick === n.id ? ' on' : '') + (t ? ' sent' : '')} onClick={() => (can ? setPick(p => (p === n.id ? null : n.id)) : t && setUi({ task: t.id }))}>
                              <b>{n.title}</b>
                              <span className="fn-meta">
                                {o ? <><MiniAvatar avatar={o.avatar} photo={o.photo} size={22} /><span>{first(o)}</span></> : <span className="muted">Sem responsável</span>}
                                {n.due && <span className="fn-due"><Icon n="clock" size={12} />{new Date(n.due + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')}</span>}
                                {t && <StatusTag t={t} />}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </li>
                ))}
                {can && <li className="seq-add"><button className="btn soft" onClick={addNode}><Ph n="plus" size={16} />Novo passo</button></li>}
              </ol>
            ) : (
            <div className="cv-box">
              {can && <span className="cv-hint"><Ph n="cursor" size={14} />Arraste os passos para onde quiser</span>}
              {can && <div className="cv-tools">
                <button className="on" title="Selecionar" aria-label="Selecionar"><Ph n="cursor" size={20} fill /></button>
                <button onClick={addNode} title="Novo passo" aria-label="Novo passo"><Ph n="note-blank" size={20} /></button>
              </div>}
              <div className="cv-zoom">
                <button onClick={() => setZ(v => Math.max(0.5, +(v - 0.1).toFixed(1)))} aria-label="Diminuir zoom"><Ph n="caret-left" size={14} /></button>
                <button onClick={() => setZ(1)} title="Voltar a 100%">{Math.round(z * 100)}%</button>
                <button onClick={() => setZ(v => Math.min(1.5, +(v + 0.1).toFixed(1)))} aria-label="Aumentar zoom"><Ph n="caret-right" size={14} /></button>
              </div>
            <div className="canvas" ref={box}>
              <div className="canvas-in" style={{ width: W, height: H, zoom: z }}>
                <svg className="links" width={W} height={H}>
                  <defs><marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 10 5 0 10z" fill="#141519" /></marker></defs>
                  <g fill="none" stroke="#141519" strokeWidth={1.8} strokeDasharray="2 6" strokeLinecap="round" markerEnd="url(#ah)">
                    {roots.map(n => { const p = pos(n), y1 = goalY + NH / 2, y2 = p.y + NH / 2, x1 = 60 + 230, x2 = p.x + OX - 6, mx = (x1 + x2) / 2; return <path key={'g' + n.id} d={`M${x1} ${y1} C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`} /> })}
                    {f.nodes.flatMap(n => n.after.map(a => {
                      const s = f.nodes.find(x => x.id === a)
                      if (!s) return null
                      const p1 = pos(s), p2 = pos(n)
                      const x1 = p1.x + OX + NW, y1 = p1.y + NH / 2, x2 = p2.x + OX - 6, y2 = p2.y + NH / 2, mx = (x1 + x2) / 2
                      return <path key={a + n.id} d={`M${x1} ${y1} C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`} />
                    }))}
                  </g>
                </svg>
                <div className="fn goal-n" style={{ left: 60, top: goalY }}>
                  <div className="top-r"><span className="num"><Ph n="star" size={14} fill /></span><h4>Objetivo</h4></div>
                  {can ? <textarea key={f.id + f.objective} className="fl-obj" defaultValue={f.objective} maxLength={160} rows={2} placeholder="Ex.: vender 30 pacotes até 15/12" onBlur={e => e.target.value !== f.objective && save({ ...f, objective: e.target.value })} /> : <small>{f.objective || 'Sem objetivo definido'}</small>}
                </div>
                {f.nodes.map((n, i) => {
                  const p = pos(n)
                  const o = n.owner ? profiles[n.owner] : undefined
                  const t = n.task_id ? tasks[n.task_id] : undefined
                  return (
                    <div
                      key={n.id} className={'fn' + (pick === n.id ? ' on' : '') + (can ? ' movable' : '') + (drag?.id === n.id ? ' drag' : '') + (t ? ' sent' : '')}
                      style={{ left: p.x + OX, top: p.y }} onPointerDown={e => onDown(e, n)} onPointerMove={onMove} onPointerUp={() => onUp(n)}
                      onClick={() => !can && t && setUi({ task: t.id })}
                    >
                      <div className="top-r"><span className="num">{i + 1}</span><h4>{n.title}</h4>{t && <StatusTag t={t} />}</div>
                      <div className={'fn-meta' + (o ? '' : ' empty')}>
                        {o ? <><MiniAvatar avatar={o.avatar} photo={o.photo} size={24} /><span>{first(o)}</span></> : <><i className="fn-add">+</i><span>Escolher quem faz</span></>}
                        {n.due && <span className="fn-due"><Icon n="clock" size={12} />{new Date(n.due + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')}</span>}
                      </div>
                      {t && <button className="fn-task" onClick={() => setUi({ task: t.id })}><Icon n="locate" size={12} />Abrir tarefa</button>}
                    </div>
                  )
                })}
              </div>
            </div>
            </div>
            )}
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
