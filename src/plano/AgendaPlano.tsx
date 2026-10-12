// Plano de marketing dentro da Agenda: cada ação aparece no dia dela (tracejada até virar tarefa),
// com dono automático, troca de dia/pessoa, visão da equipe por semana e a visão Estratégia do ano.
import { useEffect, useMemo, useRef, useState } from 'react'
import { dayKey } from '../game/xp'
import { dropRow, me, planoAgendar, putRow, run, useStore } from '../store'
import type { PlanoAcao, PlanoNucleo, Task } from '../types'
import { confirmar, pedirTexto } from '../components/Dialogo'
import { Ph } from '../components/Icon'
import type { PhName } from '../components/ph'
import MiniAvatar from '../components/MiniAvatar'
import { AcaoModal, NucleoModal, type Base } from '../components/Plano'
import { candidatos, cargaSemana, chave, comecar, corSig, type Ctx, distribuir, editaPlano, hoje, quando, semana, situacao, type Sit, SIT, somaDia, difDias } from './core'
import { nomeMes, somaMes } from './datas'
import { Modal, Sig } from './ui'
import './plano.css'
import './agenda.css'

export type PItem = {
  a: PlanoAcao; n: PlanoNucleo; dia: string | null; orig: string | null; movido: boolean
  dono: string | null; livre: boolean; sit: Sit; cor: string; icone: PhName; semDono: boolean; pode: boolean; cands: string[]
}

export const corNuc = (n: PlanoNucleo) => n.cor ?? corSig(n.nome)
const longo = (k: string) => { const s = new Date(k + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).replace('-feira', ''); return s[0].toUpperCase() + s.slice(1) }
const curto = (k: string) => new Date(k + 'T12:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }).replace('.', '')

/** todas as ações do plano com dia, dono calculado e o que eu posso fazer com elas */
export function usePlano() {
  const acoes = useStore(s => s.rows.plano_acoes)
  const resp = useStore(s => s.rows.plano_resp)
  const meses = useStore(s => s.rows.plano_meses)
  const nucleos = useStore(s => s.rows.plano_nucleos)
  const equipes = useStore(s => s.rows.equipes)
  const profiles = useStore(s => s.profiles)
  const tasks = useStore(s => s.tasks)
  const meId = useStore(s => s.meId)
  const ctx = useMemo<Ctx>(() => ({ resp, profiles, meses, nucleos, equipes }), [resp, profiles, meses, nucleos, equipes])
  const itens = useMemo(() => {
    const acs = Object.values(acoes ?? {}).filter(a => nucleos[a.nucleo] && nucleos[a.nucleo].tipo !== 'datas')
    const donos = distribuir(acs, ctx, tasks)
    const edita = editaPlano(meId ? profiles[meId] : undefined)
    return acs.map((a): PItem => {
      const n = nucleos[a.nucleo], q = quando(a), cands = candidatos(a, resp, profiles, equipes), dono = donos[a.id] ?? null
      const livre = !a.tarefas.length
      const pode = !!meId && (edita || a.dono === meId || a.pessoas.includes(meId) || cands.includes(meId))
      return { a, n, dia: q.dia, orig: q.orig, movido: q.movido, dono, livre, sit: situacao(a, tasks), cor: corNuc(n), icone: (n.icone ?? 'users-three') as PhName, semDono: livre && !dono, pode, cands }
    }).sort((x, y) => (x.dia ?? '9').localeCompare(y.dia ?? '9') || x.a.pos - y.a.pos)
  }, [acoes, nucleos, ctx, tasks, resp, profiles, equipes, meId])
  const datas = useMemo(() => Object.values(acoes ?? {}).filter(a => nucleos[a.nucleo]?.tipo === 'datas'), [acoes, nucleos])
  return { ctx, itens, datas }
}

const tentadas = new Set<string>()
/** vira tarefa sozinha na semana dela (só pra quem é o dono calculado; a reserva no servidor evita duplicar) */
export function useAutoPlano() {
  const meId = useStore(s => s.meId)
  const { ctx, itens } = usePlano()
  useEffect(() => {
    if (!meId) return
    const h = dayKey(new Date()), sem = semana(h), min = somaDia(h, -7)
    for (const i of itens) {
      if (!i.livre || i.dono !== meId || !i.dia || semana(i.dia) > sem || i.dia < min || tentadas.has(i.a.id)) continue
      tentadas.add(i.a.id)
      comecar(i.a, ctx, meId).catch(() => undefined)
    }
  }, [itens, meId, ctx])
}

/** muda o dia (e/ou a pessoa); voltar ao dia da planilha grava vazio */
export const agendar = (i: PItem, dia: string | null, dono: string | null = i.a.dono ?? null) => run(planoAgendar(i.a.id, dia && dia === i.orig ? null : dia, dono))

/** chip tracejado: ação do plano que ainda não virou tarefa */
export function PChip({ i, on, onPick }: { i: PItem; on?: boolean; onPick: (i: PItem) => void }) {
  const p = useStore(s => (i.dono ? s.profiles[i.dono] : undefined))
  return (
    <button type="button" className={'ev pl-ghost' + (i.semDono ? ' sem' : '') + (on ? ' on' : '')} style={{ ['--sc' as string]: i.cor }} draggable={i.pode}
      onDragStart={e => { e.stopPropagation(); e.dataTransfer.setData('text/plano', i.a.id); e.dataTransfer.effectAllowed = 'move' }}
      onClick={e => { e.stopPropagation(); onPick(i) }} title={`${i.n.nome} · ${i.a.texto}`}>
      <Ph n={i.icone} size={13} fill /><span className="tx">{i.a.texto}</span>
      {p ? <MiniAvatar avatar={p.avatar} photo={p.photo} name={p.name} size={16} /> : <i className="pl-g-sem" aria-label="Sem dono">?</i>}
    </button>
  )
}
/** onDragOver/onDrop de quem recebe um item do plano */
export const alvo = (cb: (id: string) => void) => ({
  onDragOver: (e: React.DragEvent) => { if (e.dataTransfer.types.includes('text/plano')) { e.preventDefault(); e.currentTarget.classList.add('pl-alvo') } },
  onDragLeave: (e: React.DragEvent) => e.currentTarget.classList.remove('pl-alvo'),
  onDrop: (e: React.DragEvent) => { e.currentTarget.classList.remove('pl-alvo'); const id = e.dataTransfer.getData('text/plano'); if (id) { e.preventDefault(); cb(id) } },
})

/** bandeja das ações do mês que valem pro mês todo (sem dia na planilha) */
export function SemDia({ itens, ym, sel, onPick }: { itens: PItem[]; ym: string; sel: string | null; onPick: (i: PItem) => void }) {
  const xs = itens.filter(i => i.livre && !i.dia && i.a.mes === ym)
  if (!xs.length) return null
  return (
    <div className="pl-semdia">
      <span className="pl-sd-h"><Ph n="circle-dashed" size={15} />Sem dia <i>{xs.length}</i><small>arraste para um dia</small></span>
      <div className="pl-sd-l">{xs.map(i => <PChip key={i.a.id} i={i} on={sel === i.a.id} onPick={onPick} />)}</div>
    </div>
  )
}

/** painel da ação do plano: texto original, quando, quem faz, começar */
export function PlanoPainel({ i, ctx }: { i: PItem; ctx: Ctx }) {
  const profiles = useStore(s => s.profiles)
  const tasks = useStore(s => s.tasks)
  const [indo, setIndo] = useState(false)
  const [msg, setMsg] = useState('')
  const k = chave(i.a, ctx.resp)
  const dono = i.dono ? profiles[i.dono] : undefined
  const outros = Object.values(profiles).filter(p => !i.cands.includes(p.id) && p.id === i.a.dono)
  const opc = [...i.cands, ...outros.map(p => p.id)].filter(id => profiles[id])
  const comecarJa = async () => {
    if (!i.dono) return
    setIndo(true); setMsg('')
    try { setMsg((await comecar(i.a, ctx, i.dono)) ? 'Virou tarefa no quadro.' : 'Alguém já começou essa ação.') } catch (e) { setMsg((e as Error).message) } finally { setIndo(false) }
  }
  const t = i.a.tarefas.map(id => tasks[id]).find(Boolean) as Task | undefined
  return (
    <div className="panel pl-painel" style={{ ['--sc' as string]: i.cor }}>
      <div className="eyebrow"><Ph n={i.icone} size={13} fill />{i.n.nome}{k && <> · <Sig s={k} /></>}</div>
      <p className="pl-p-tx">{i.a.texto}</p>
      {i.a.estrategia && <small className="muted">Estratégia: {i.a.estrategia}</small>}
      <div className="kv">
        <span>Quando</span>
        <div className="pl-p-q">
          {i.pode && i.livre ? <input type="date" value={i.dia ?? ''} onChange={e => agendar(i, e.target.value || null)} aria-label="Dia" /> : <b>{i.dia ? longo(i.dia) : 'O mês todo'}</b>}
          {i.movido && <small>No plano: {i.orig ? curto(i.orig) : 'o mês todo'}{i.pode && i.livre && <button type="button" className="lnk" onClick={() => run(planoAgendar(i.a.id, null, i.a.dono ?? null))}>Voltar ao dia do plano</button>}</small>}
        </div>
        <span>Situação</span><div><span className={'pl-st s-' + i.sit}>{SIT[i.sit]}</span></div>
      </div>
      <span className="pl-lab">Quem faz {!i.a.dono && i.dono && <small>(automático: quem tem menos coisa na semana)</small>}</span>
      {i.semDono ? (
        <div className="pl-p-sem"><Ph n="flag-banner" size={16} fill /><span>A sigla <b>{k || '—'}</b> não tem equipe nem pessoa. Quem edita o plano marca em Plano → Responsáveis.</span></div>
      ) : i.livre && i.pode ? (
        <div className="pl-pess">
          <button type="button" className={!i.a.dono ? 'on' : ''} onClick={() => agendar(i, i.a.data ?? null, null)}><i className="pl-auto"><Ph n="users-three" size={14} /></i>Automático</button>
          {opc.map(id => <button type="button" key={id} className={i.a.dono === id ? 'on' : ''} onClick={() => agendar(i, i.a.data ?? null, id)}>
            <MiniAvatar avatar={profiles[id].avatar} photo={profiles[id].photo} name={profiles[id].name} size={22} />{profiles[id].name.split(' ')[0]}</button>)}
        </div>
      ) : <div className="person">{dono ? <><MiniAvatar avatar={dono.avatar} photo={dono.photo} name={dono.name} size={22} />{dono.name}</> : '—'}</div>}
      {i.livre && i.pode && i.dono && <button type="button" className="btn accent" disabled={indo} onClick={() => run(comecarJa())}><Ph n="play" size={16} fill />{indo ? 'Criando tarefa…' : 'Começar agora'}</button>}
      {t && <small className="muted">Já está no quadro de {profiles[t.owner_id]?.name.split(' ')[0] ?? '—'}.</small>}
      {msg && <small className="pl-p-msg">{msg}</small>}
      <small className="muted pl-p-pe">Vira tarefa sozinha na semana dela. Mudar o dia ou a pessoa não altera o texto do plano.</small>
    </div>
  )
}
export function PlanoModal({ i, ctx, onClose }: { i: PItem; ctx: Ctx; onClose: () => void }) {
  return <Modal title="Ação do plano" onClose={onClose}><PlanoPainel i={i} ctx={ctx} /></Modal>
}

/** semanas × pessoas: quem está cheio, e arrastar muda pessoa e semana */
export function VisaoEquipe({ itens, ym, sel, onPick }: { itens: PItem[]; ym: string; sel: string | null; onPick: (i: PItem) => void }) {
  const profiles = useStore(s => s.profiles)
  const tasks = useStore(s => s.tasks)
  const ini = semana(ym + '-01')
  const sems = Array.from({ length: 6 }, (_, k) => somaDia(ini, k * 7)).filter((s, k) => k < 5 || s.slice(0, 7) === ym)
  const fim = somaDia(sems[sems.length - 1], 7)
  const xs = itens.filter(i => i.livre && i.dia && i.dia >= ini && i.dia < fim)
  const ids = [...new Set(xs.flatMap(i => [i.dono, ...i.cands]).filter((x): x is string => !!x && !!profiles[x]))].sort((a, b) => profiles[a].name.localeCompare(profiles[b].name))
  const solta = (id: string, p: string | null, s: string) => {
    const i = itens.find(x => x.a.id === id)
    if (!i || !i.pode) return
    const d = i.dia ? somaDia(i.dia, difDias(s, semana(i.dia))) : somaDia(s, 1)
    agendar(i, d, p)
  }
  const linha = (p: string | null) => (
    <tr key={p ?? '-'} className={p ? '' : 'sem'}>
      <th>{p ? <span className="person"><MiniAvatar avatar={profiles[p].avatar} photo={profiles[p].photo} name={profiles[p].name} size={26} />{profiles[p].name.split(' ')[0]}</span> : <span className="person"><i className="pl-g-sem">?</i>Sem dono</span>}</th>
      {sems.map(s => {
        const meus = xs.filter(i => i.dono === p && semana(i.dia!) === s)
        const n = p ? cargaSemana(p, s, tasks, xs) : meus.length
        return (
          <td key={s} className={p && n >= 5 ? 'cheio' : ''} {...alvo(id => solta(id, p, s))}>
            {p && <span className="pl-eq-n" title="Coisas na semana (tarefas abertas + ações do plano)">{n}</span>}
            {meus.map(i => <PChip key={i.a.id} i={i} on={sel === i.a.id} onPick={onPick} />)}
          </td>
        )
      })}
    </tr>
  )
  return (
    <div className="pl-equipe">
      <table>
        <thead><tr><th />{sems.map(s => <th key={s}>{curto(s)} – {curto(somaDia(s, 6))}</th>)}</tr></thead>
        <tbody>{ids.map(linha)}{xs.some(i => !i.dono) && linha(null)}</tbody>
      </table>
      {!xs.length && <p className="qempty">Nenhuma ação do plano neste mês.</p>}
      <small className="muted">Número = coisas da pessoa na semana. 5 ou mais fica laranja. Arraste uma ação para outra pessoa ou semana.</small>
    </div>
  )
}

/** ano inteiro: datas comemorativas no topo e uma raia por stakeholder (núcleo de ações) */
export function VisaoEstrategia({ itens, ctx }: { itens: PItem[]; ctx: Ctx }) {
  const nucleos = useStore(s => s.rows.plano_nucleos)
  const mesesR = useStore(s => s.rows.plano_meses)
  const acoes = useStore(s => s.rows.plano_acoes)
  const tasks = useStore(s => s.tasks)
  const can = editaPlano(me())
  const ciclos = useMemo(() => [...new Set(Object.values(nucleos).map(n => n.ciclo).concat(Object.values(mesesR).map(m => m.ciclo)))].sort(), [nucleos, mesesR])
  const atual = ciclos.filter(c => c <= hoje()).pop() ?? ciclos[0] ?? hoje()
  const [ciclo, setCiclo] = useState('')
  const cc = ciclos.includes(ciclo) ? ciclo : atual
  const meses = Array.from({ length: 12 }, (_, k) => somaMes(cc, k))
  const mesesObj = Object.values(mesesR).filter(m => m.ciclo === cc).sort((a, b) => a.mes.localeCompare(b.mes))
  const nucs = Object.values(nucleos).filter(n => n.ciclo === cc).sort((a, b) => a.pos - b.pos)
  const raias = nucs.filter(n => n.tipo === 'acoes')
  const nDatas = nucs.find(n => n.tipo === 'datas')
  const datas = Object.values(acoes).filter(a => a.ciclo === cc && nucleos[a.nucleo]?.tipo === 'datas')
  const [zoom, setZoom] = useState<string | null>(null)
  const [menu, setMenu] = useState<string | null>(null)
  const [mpos, setMpos] = useState({ top: 0, left: 0 })
  const [acao, setAcao] = useState<{ a: PlanoAcao | null; base: Base | null } | null>(null)
  const [nuc, setNuc] = useState<{ n: PlanoNucleo | null; tipo: PlanoNucleo['tipo'] } | null>(null)
  const ym = hoje()
  const scr = useRef<HTMLDivElement>(null)
  // abre já no mês atual, com o anterior à vista
  useEffect(() => {
    const el = scr.current, k = meses.indexOf(ym)
    const th = el?.querySelectorAll<HTMLElement>('.pl-es-m')[Math.max(0, k - 1)]
    if (el && th && k > 1) el.scrollLeft = th.offsetLeft - (el.querySelector<HTMLElement>('.pl-es-corner')?.offsetWidth ?? 0)
  }, [cc]) // eslint-disable-line react-hooks/exhaustive-deps
  const novaData = async (mes: string) => {
    let n = nDatas
    if (!n) { n = { id: `${cc}:n0`, ciclo: cc, nome: 'Datas comemorativas', pos: 0, tipo: 'datas', created_at: new Date().toISOString() }; await putRow('plano_nucleos', n) }
    setAcao({ a: null, base: { nucleo: n.id, mes } })
  }
  const renomear = async (n: PlanoNucleo) => { setMenu(null); const v = await pedirTexto('Renomear stakeholder', { v: n.nome, ok: 'Salvar', max: 60 }); if (v?.trim() && v.trim() !== n.nome) run(putRow('plano_nucleos', { ...n, nome: v.trim() })) }
  const excluir = async (n: PlanoNucleo) => { setMenu(null); if (await confirmar(`Excluir “${n.nome}”?`, { text: 'As ações dele saem do plano. As tarefas que já foram pro quadro continuam.', danger: true, ok: 'Excluir' })) run(dropRow('plano_nucleos', n.id)) }
  const mn = menu ? nucleos[menu] : undefined
  const doMes = (n: PlanoNucleo, m: string) => itens.filter(i => i.n.id === n.id && i.a.mes === m)
  return (
    <div className="pl-estr">
      <div className="pl-es-bar">
        {ciclos.length > 1 && <label className="qchip"><Ph n="calendar-dots" size={15} />
          <select value={cc} onChange={e => setCiclo(e.target.value)} aria-label="Ciclo">{ciclos.map(c => <option key={c} value={c}>Ciclo {nomeMes(c, true)}/{c.slice(2, 4)}</option>)}</select></label>}
        <span className="grow" />
        {can && <><button type="button" className="btn soft sm" onClick={() => run(novaData(meses.includes(ym) ? ym : meses[0]))}><Ph n="star" size={15} />Nova data</button>
          <button type="button" className="btn accent sm" onClick={() => setNuc({ n: null, tipo: 'acoes' })}><Ph n="plus" size={15} fill />Novo stakeholder</button></>}
      </div>
      <div className="pl-es-scroll" ref={scr}>
        <div className="pl-es-grid" style={{ ['--n' as string]: 12 }}>
          <div className="pl-es-c pl-es-corner" />
          {meses.map(m => <button type="button" key={m} className={'pl-es-c pl-es-m' + (m === ym ? ' hoje' : '') + (zoom === m ? ' on' : '')} onClick={() => setZoom(zoom === m ? null : m)}>{nomeMes(m, true)}<small>{m.slice(2, 4)}</small></button>)}
          <div className="pl-es-c pl-es-rh datas"><i className="eq-ic sm" style={{ ['--ec' as string]: '#B88A00' }}><Ph n="star" size={13} fill /></i><b>Datas</b></div>
          {meses.map(m => (
            <div key={m} className="pl-es-c pl-es-datas">
              {datas.filter(a => a.mes === m).map(a => <button type="button" key={a.id} className="pl-es-d" title={a.texto} onClick={() => setAcao({ a, base: null })}>{a.dia && <b>{a.dia}</b>}{a.texto}</button>)}
              {can && <button type="button" className="pl-es-add" onClick={() => run(novaData(m))}><Ph n="plus" size={12} />data</button>}
            </div>
          ))}
          {raias.map(n => {
            const cor = corNuc(n), tot = itens.filter(i => i.n.id === n.id)
            return [
              <div key={n.id} className="pl-es-c pl-es-rh" style={{ ['--sc' as string]: cor }}>
                <i className="eq-ic sm" style={{ ['--ec' as string]: cor }}><Ph n={(n.icone ?? 'users-three') as PhName} size={13} fill /></i>
                <span className="pl-rh-nm"><b>{n.nome}</b><small>{tot.length} {tot.length === 1 ? 'ação' : 'ações'}</small></span>
                {can && <button type="button" className="iconbtn sm" aria-label="Opções" onClick={e => { const b = e.currentTarget.getBoundingClientRect(); setMpos({ top: b.bottom + 4, left: Math.max(8, b.right - 190) }); setMenu(menu === n.id ? null : n.id) }}><Ph n="dots-three" size={18} /></button>}
              </div>,
              ...meses.map(m => {
                const xs = doMes(n, m)
                return (
                  <button type="button" key={n.id + m} className={'pl-es-c pl-es-cel' + (zoom === m ? ' on' : '')} style={{ ['--sc' as string]: cor }} onClick={() => setZoom(m)}>
                    {xs.length > 0 && <span className="pl-es-bar-a" style={{ ['--q' as string]: Math.min(1, xs.length / 6) }}>{xs.length}</span>}
                    <span className="pl-es-dots">{xs.slice(0, 8).map(i => <i key={i.a.id} className={'s-' + i.sit} />)}</span>
                  </button>
                )
              }),
            ]
          })}
          {can && <button type="button" className="pl-es-c pl-es-novo" onClick={() => setNuc({ n: null, tipo: 'acoes' })}><Ph n="plus" size={15} />Adicionar stakeholder</button>}
        </div>
      </div>
      {!raias.length && <p className="qempty">{can ? 'Nenhum stakeholder ainda. Adicione o primeiro ou importe a planilha na aba Plano.' : 'O plano deste ciclo ainda não tem stakeholders.'}</p>}
      {mn && <>
        <button type="button" className="pl-es-fundo" aria-label="Fechar" onClick={() => setMenu(null)} onWheel={() => setMenu(null)} />
        <div className="pl-es-menu" role="menu" style={mpos}>
          <button type="button" role="menuitem" onClick={() => run(renomear(mn))}><Ph n="pencil-simple-line" size={15} />Renomear</button>
          <button type="button" role="menuitem" onClick={() => { setMenu(null); setNuc({ n: mn, tipo: 'acoes' }) }}><Ph n="sparkle" size={15} />Trocar cor e ícone</button>
          <button type="button" role="menuitem" className="danger" onClick={() => run(excluir(mn))}><Ph n="trash" size={15} />Excluir</button>
        </div>
      </>}
      {zoom && (
        <section className="pl-es-zoom">
          <header><h3><span className="pl-es-zm">{nomeMes(zoom)}</span>{mesesObj.find(m => m.mes === zoom)?.campanha ? ` · ${mesesObj.find(m => m.mes === zoom)!.campanha}` : ''}</h3><button type="button" className="iconbtn" aria-label="Fechar" onClick={() => setZoom(null)}><Ph n="x" size={18} /></button></header>
          {datas.some(a => a.mes === zoom) && <div className="pl-es-zd">{datas.filter(a => a.mes === zoom).map(a => <span key={a.id} className="pl-es-d">{a.dia && <b>{a.dia}</b>}{a.texto}</span>)}</div>}
          <div className="pl-es-zl">
            {raias.map(n => {
              const xs = doMes(n, zoom)
              if (!xs.length && !can) return null
              return (
                <div key={n.id} className="pl-es-zr" style={{ ['--sc' as string]: corNuc(n) }}>
                  <h4><Ph n={(n.icone ?? 'users-three') as PhName} size={15} fill />{n.nome}</h4>
                  {xs.map(i => <button type="button" key={i.a.id} className={'pl-es-za s-' + i.sit} onClick={() => setAcao({ a: i.a, base: null })}>
                    <span>{i.dia ? curto(i.dia) : 'mês'}</span><b>{i.a.texto}</b><small>{SIT[i.sit]}</small></button>)}
                  {can && <button type="button" className="pl-r-add" onClick={() => setAcao({ a: null, base: { nucleo: n.id, mes: zoom } })}><Ph n="plus" size={14} />Ação</button>}
                </div>
              )
            })}
          </div>
        </section>
      )}
      {acao && <AcaoModal a={acao.a ? acoes[acao.a.id] ?? acao.a : null} base={acao.base} ciclo={cc} meses={mesesObj} nucleos={nucs} can={can} ctx={ctx} tasks={tasks} onClose={() => setAcao(null)} />}
      {nuc && <NucleoModal n={nuc.n} ciclo={cc} pos={nucs.length} tipo0={nuc.tipo} titulo={nuc.n ? 'Cor e ícone' : 'Novo stakeholder'} onClose={() => setNuc(null)} />}
    </div>
  )
}
