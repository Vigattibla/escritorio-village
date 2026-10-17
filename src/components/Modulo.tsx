// Tela de um módulo do setor (Reservas, Obras, Chamados, Quartos, Turno…). Um só componente monta
// cada layout a partir do catálogo em setor/tipos; os cartões ficam na tabela `registros`.
import { useEffect, useMemo, useRef, useState } from 'react'
import { deptOf } from '../game/ranks'
import { gereEquipe } from '../plano/core'
import { Modal } from '../plano/ui'
import { abasDe, deptName, dropRow, me, myDept, putRow, run, useStore } from '../store'
import type { Profile, Registro } from '../types'
import { MOD, type Campo, type Etapa, type Modulo } from '../setor/tipos'
import type { PhName } from './ph'
import { confirmar } from './Dialogo'
import { Ph } from './Icon'
import MiniAvatar from './MiniAvatar'
import '../plano/plano.css'
import '../modulo.css'

const hoje = () => new Date().toLocaleDateString('sv-SE')
const dia = (d: string) => new Date(d + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')
const hora = (d: string) => new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
const somaDias = (d: string, n: number) => { const x = new Date(d + 'T12:00'); x.setDate(x.getDate() + n); return x.toLocaleDateString('sv-SE') }
const real = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const num = (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0)
const txt = (v: unknown) => (v == null ? '' : String(v))
const primeiro = (id: unknown, profiles: Record<string, Profile>) => profiles[txt(id)]?.name.split(' ')[0] ?? ''

/** valor pronto pra mostrar no cartão */
function mostra(c: Campo, v: unknown, profiles: Record<string, Profile>) {
  if (v == null || v === '' || v === false) return ''
  switch (c.tipo) {
    case 'dinheiro': return real(num(v))
    case 'data': return dia(txt(v))
    case 'pct': return `${num(v)}%`
    case 'pessoa': return primeiro(v, profiles)
    case 'check': return c.nome
    case 'num': return `${num(v)} ${c.nome.toLowerCase()}`
    default: return txt(v)
  }
}
const vencido = (m: Modulo, r: Registro) => !!m.prazo && !!r.campos[m.prazo] && txt(r.campos[m.prazo]) < hoje() && !m.status.find(e => e.id === r.status)?.fim
const etapa = (m: Modulo, id: string): Etapa => m.status.find(e => e.id === id) ?? m.status[0]

function novoReg(m: Modulo, dept: string, p: Partial<Registro>): Registro {
  const agora = new Date().toISOString()
  return { id: crypto.randomUUID(), dept, modulo: m.id, titulo: '', status: m.status[0].id, campos: {}, pos: Date.now(), por: me()?.id ?? null, created_at: agora, em: agora, ...p }
}
const salva = (r: Registro) => run(putRow('registros', { ...r, em: new Date().toISOString() }))

/** quem mexe: gente da sala, gerente/Chefe/adm; de fora só vê (chamado aberto por mim eu acompanho no Pedidos) */
const podeEditar = (dept: string) => { const eu = me(); return !!eu && (deptOf(eu) === dept || gereEquipe(eu, dept)) }

export default function ModuloTela({ id }: { id: string }) {
  const m = MOD[id]
  const s = useStore(st => st)
  const sala = s.sala
  const [q, setQ] = useState('')
  const [modo, setModo] = useState<'base' | 'lista' | 'cal'>('base')
  const [edit, setEdit] = useState<Registro | null>(null)
  const [fHoje, setFHoje] = useState<string | null>(null)
  const regs = useMemo(() => Object.values(s.rows.registros).filter(r => r.dept === sala && r.modulo === id).sort((a, b) => a.pos - b.pos), [s.rows.registros, sala, id])
  if (!m) return <p className="pd-vazio">Esse módulo não existe mais.</p>
  const pode = podeEditar(sala)
  const busca = q.trim().toLowerCase()
  const achou = busca ? regs.filter(r => (r.titulo + ' ' + Object.values(r.campos).map(txt).join(' ')).toLowerCase().includes(busca)) : regs
  const comHoje = temEstadia(m), comPrazo = !comHoje && !!m.prazo && m.layout === 'kanban'
  const vis = fHoje ? achou.filter(r => (comHoje ? naHoje(r, fHoje as FiltroHoje) : comPrazo && noPrazo(m, r, fHoje as FiltroPrazo))) : achou
  const abrir = (p: Partial<Registro> = {}) => pode && setEdit(novoReg(m, sala, p))
  const temLista = m.layout === 'kanban'
  const temBusca = m.layout !== 'rotina' && m.layout !== 'semana'
  const ctx: Ctx = { m, regs: vis, todos: regs, pode, profiles: s.profiles, sala, abrir, editar: r => setEdit(r) }

  return (
    <div className={'md md-l-' + m.layout}>
      <div className="md-bar">
        <p className="md-desc grow">{m.desc}{sala !== myDept(s) && <small> · sala {deptName(sala, s)}</small>}</p>
        {temBusca && <label className="md-busca"><Ph n="magnifying-glass" size={16} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar" aria-label="Buscar" /></label>}
        {(temLista || m.cal) && <div className="pd-seg" role="tablist">
          <button className={modo === 'base' ? 'on' : ''} onClick={() => setModo('base')}>Quadro</button>
          {temLista && <button className={modo === 'lista' ? 'on' : ''} onClick={() => setModo('lista')}>Lista</button>}
          {m.cal && <button className={modo === 'cal' ? 'on' : ''} onClick={() => setModo('cal')}>Calendário</button>}
        </div>}
        {pode && m.layout !== 'diario' && m.layout !== 'grade' && <button className="btn primary sm" onClick={() => abrir()}><Ph n="plus" size={16} />{m.novo}</button>}
      </div>
      {comHoje && <Hoje regs={regs} f={fHoje} setF={setFHoje} />}
      {comPrazo && <Prazos m={m} regs={regs} f={fHoje} setF={setFHoje} />}
      {modo === 'cal' && m.cal ? <Calendario {...ctx} /> : modo === 'lista' ? <Lista {...ctx} /> : <>
        {m.layout === 'kanban' && <Kanban {...ctx} />}
        {m.layout === 'lista' && <Lista {...ctx} />}
        {m.layout === 'grade' && <Grade {...ctx} />}
        {m.layout === 'diario' && <Diario {...ctx} />}
        {m.layout === 'semana' && <Semana {...ctx} />}
        {m.layout === 'rotina' && <Rotina {...ctx} />}
        {m.layout === 'estoque' && <Estoque {...ctx} />}
      </>}
      {edit && <Editor m={m} reg={edit} novo={!regs.some(r => r.id === edit.id)} pode={pode} onClose={() => setEdit(null)} />}
    </div>
  )
}

/** módulos com entrada e saída (reservas, chegadas, grupos) ganham a faixa do dia */
type FiltroHoje = 'chega' | 'sai' | 'casa' | 'amanha'
const temEstadia = (m: Modulo) => ['entrada', 'saida'].every(k => m.campos.some(c => c.id === k && c.tipo === 'data'))
/** só conta quem vem mesmo: fora consulta/cotação e perdidos/cancelados */
const FORA_DO_DIA = new Set(['contato', 'cotacao', 'consulta', 'perdida', 'noshow', 'cancelado'])
function naHoje(r: Registro, f: FiltroHoje) {
  if (FORA_DO_DIA.has(r.status)) return false
  const e = txt(r.campos.entrada), sa = txt(r.campos.saida), h = hoje()
  if (f === 'chega') return e === h
  if (f === 'sai') return sa === h
  if (f === 'amanha') return e === somaDias(h, 1)
  return !!e && e <= h && (!sa || sa > h) && r.status !== 'saiu'
}
const gente = (r: Registro) => num(r.campos.pessoas) || num(r.campos.adultos) + num(r.campos.criancas)
function Hoje({ regs, f, setF }: { regs: Registro[]; f: string | null; setF: (f: string | null) => void }) {
  const itens: [FiltroHoje, string, PhName][] = [['chega', 'Chegam hoje', 'person-simple-walk'], ['sai', 'Saem hoje', 'arrow-square-out'], ['casa', 'Na casa', 'bed'], ['amanha', 'Chegam amanhã', 'calendar-blank']]
  return (
    <div className="md-hoje" role="group" aria-label="Resumo do dia">
      {itens.map(([k, nome, ic]) => {
        const rs = regs.filter(r => naHoje(r, k)), p = rs.reduce((a, r) => a + gente(r), 0)
        return (
          <button key={k} className={f === k ? 'on' : ''} aria-pressed={f === k} onClick={() => setF(f === k ? null : k)} title={f === k ? 'Mostrar todos' : 'Mostrar só esses'}>
            <Ph n={ic} size={18} /><b>{rs.length}</b><span>{nome}{p > 0 && <small>{p} {p === 1 ? 'pessoa' : 'pessoas'}</small>}</span>
          </button>
        )
      })}
    </div>
  )
}

/** módulos com prazo (chamados, obras, compras, contas…): o que está atrasado e o que vence logo */
type FiltroPrazo = 'atraso' | 'hoje' | 'semana' | 'sem'
function noPrazo(m: Modulo, r: Registro, f: FiltroPrazo) {
  if (m.status.find(e => e.id === r.status)?.fim) return false
  const d = txt(r.campos[m.prazo!]), h = hoje()
  if (f === 'sem') return !d
  if (!d) return false
  if (f === 'atraso') return d < h
  if (f === 'hoje') return d === h
  return d > h && d <= somaDias(h, 7)
}
function Prazos({ m, regs, f, setF }: { m: Modulo; regs: Registro[]; f: string | null; setF: (f: string | null) => void }) {
  const din = m.campos.find(c => c.tipo === 'dinheiro')
  const itens: [FiltroPrazo, string, PhName][] = [['atraso', 'Atrasados', 'flag-banner'], ['hoje', 'Vencem hoje', 'bell-simple'], ['semana', 'Próximos 7 dias', 'calendar-dots'], ['sem', 'Sem data', 'circle-dashed']]
  // nada atrasado nem perto de vencer: a faixa só faria barulho
  if (!f && !regs.some(r => itens.some(([k]) => noPrazo(m, r, k)))) return null
  return (
    <div className="md-hoje" role="group" aria-label="Prazos">
      {itens.map(([k, nome, ic]) => {
        const rs = regs.filter(r => noPrazo(m, r, k)), v = din ? rs.reduce((a, r) => a + num(r.campos[din.id]), 0) : 0
        return (
          <button key={k} className={(f === k ? 'on' : '') + (k === 'atraso' && rs.length ? ' alerta' : '')} aria-pressed={f === k} onClick={() => setF(f === k ? null : k)} title={f === k ? 'Mostrar todos' : 'Mostrar só esses'}>
            <Ph n={ic} size={18} /><b>{rs.length}</b><span>{nome}{v > 0 && <small>{real(v)}</small>}</span>
          </button>
        )
      })}
    </div>
  )
}

interface Ctx { m: Modulo; regs: Registro[]; todos: Registro[]; pode: boolean; profiles: Record<string, Profile>; sala: string; abrir: (p?: Partial<Registro>) => void; editar: (r: Registro) => void }

function Info({ m, r, profiles, so }: { m: Modulo; r: Registro; profiles: Record<string, Profile>; so?: string[] }) {
  const cs = m.campos.filter(c => c.card && (!so || so.includes(c.id)) && c.tipo !== 'pct')
  const pct = m.campos.find(c => c.tipo === 'pct' && c.card)
  // obra: quanto do orçamento já foi; acende quando o gasto corre na frente do avanço
  const orc = num(r.campos.orcamento), gas = num(r.campos.gasto)
  const gasto = m.campos.some(c => c.id === 'gasto') && orc > 0 && gas > 0 ? Math.round(gas / orc * 100) : null
  return <>
    <div className="md-info">{cs.map(c => { const v = mostra(c, r.campos[c.id], profiles); return v ? <span key={c.id} className={'md-v md-v-' + c.tipo + (m.prazo === c.id && vencido(m, r) ? ' venc' : '')} title={c.nome}>{v}</span> : null })}</div>
    {pct && r.campos[pct.id] != null && <div className="md-pctl" title={`${pct.nome}: ${num(r.campos[pct.id])}%`}><div className="md-pct"><i style={{ width: Math.min(100, num(r.campos[pct.id])) + '%' }} /></div><b>{num(r.campos[pct.id])}%</b></div>}
    {gasto != null && <small className={'md-gasto' + (gasto > num(pct ? r.campos[pct.id] : 0) + 10 ? ' alerta' : '')}>{gasto > 100 ? `Estourou: ${gasto}% do orçamento` : `Gastou ${gasto}% do orçamento`}</small>}
  </>
}

function Cartao({ m, r, profiles, onClick, drag }: { m: Modulo; r: Registro; profiles: Record<string, Profile>; onClick: () => void; drag?: boolean }) {
  const urg = txt(r.campos.urg)
  return (
    <button className={'md-card' + (vencido(m, r) ? ' venc' : '') + (urg === 'Urgente' || urg === 'Alta' ? ' urg' : '')} onClick={onClick} draggable={drag}
      onDragStart={e => { e.dataTransfer.setData('text/md', r.id); e.dataTransfer.effectAllowed = 'move' }}>
      <b>{r.titulo || <i className="muted">sem título</i>}</b>
      <Info m={m} r={r} profiles={profiles} />
    </button>
  )
}

function Kanban({ m, regs, pode, profiles, editar }: Ctx) {
  const [sobre, setSobre] = useState('')
  const [fimAbertos, setFimAbertos] = useState<Record<string, boolean>>({})
  const din = m.campos.find(c => c.tipo === 'dinheiro')
  const mover = (rid: string, st: string) => { const r = regs.find(x => x.id === rid); if (r && r.status !== st) salva({ ...r, status: st, pos: Date.now() }) }
  return (
    <div className="md-kanban">
      {m.status.map(e => {
        const col = regs.filter(r => etapa(m, r.status).id === e.id)
        const total = din ? col.reduce((a, r) => a + num(r.campos[din.id]), 0) : 0
        const corte = e.fim && !fimAbertos[e.id] ? 6 : Infinity
        return (
          <section key={e.id} className={'md-col' + (sobre === e.id ? ' sobre' : '') + (e.fim ? ' fim' : '')} style={{ '--c': e.cor } as React.CSSProperties}
            onDragOver={ev => { if (pode) { ev.preventDefault(); setSobre(e.id) } }} onDragLeave={() => setSobre('')}
            onDrop={ev => { ev.preventDefault(); setSobre(''); mover(ev.dataTransfer.getData('text/md'), e.id) }}>
            <header><i className="md-dot" /><b className="grow">{e.nome}</b><small>{col.length}</small></header>
            {!!total && <small className="md-tot">{real(total)}</small>}
            <div className="md-cards">
              {col.slice(0, corte).map(r => <Cartao key={r.id} m={m} r={r} profiles={profiles} onClick={() => editar(r)} drag={pode} />)}
              {col.length > corte && <button className="md-mais" onClick={() => setFimAbertos({ ...fimAbertos, [e.id]: true })}>+ {col.length - corte} mais</button>}
              {!col.length && <small className="md-col-vazio">{pode ? 'Arraste um cartão pra cá' : 'Nada aqui'}</small>}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function Lista({ m, regs, pode, profiles, editar }: Ctx) {
  const [todos, setTodos] = useState(false)
  const abertos = regs.filter(r => !etapa(m, r.status).fim)
  const vis = (todos ? regs : abertos).slice().sort((a, b) => Number(etapa(m, a.status).fim ?? 0) - Number(etapa(m, b.status).fim ?? 0) || (m.prazo ? txt(a.campos[m.prazo]).localeCompare(txt(b.campos[m.prazo])) : 0) || b.pos - a.pos)
  const proximo = (r: Registro) => { const i = m.status.findIndex(e => e.id === r.status); salva({ ...r, status: m.status[(i + 1) % m.status.length].id }) }
  return <>
    <div className="pd-seg md-filtro"><button className={!todos ? 'on' : ''} onClick={() => setTodos(false)}>Em aberto · {abertos.length}</button><button className={todos ? 'on' : ''} onClick={() => setTodos(true)}>Todos · {regs.length}</button></div>
    {!vis.length ? <p className="pd-vazio">Nada {todos ? 'registrado' : 'em aberto'}.</p> : <ul className="md-lista">
      {vis.map(r => { const e = etapa(m, r.status); return (
        <li key={r.id} className={vencido(m, r) ? 'venc' : ''}>
          <button className="md-st" style={{ '--c': e.cor } as React.CSSProperties} disabled={!pode} onClick={() => proximo(r)} title={pode ? 'Clique para avançar' : e.nome}>{e.nome}</button>
          <button className="md-li" onClick={() => editar(r)}><b>{r.titulo || 'sem título'}</b><Info m={m} r={r} profiles={profiles} /></button>
        </li>) })}
    </ul>}
  </>
}

function Calendario({ m, regs, profiles, editar, abrir, pode }: Ctx) {
  const [mes, setMes] = useState(() => hoje().slice(0, 7))
  const ini = new Date(mes + '-01T12:00')
  const pad = (ini.getDay() + 6) % 7
  const dias = new Date(ini.getFullYear(), ini.getMonth() + 1, 0).getDate()
  const nav = (n: number) => { const d = new Date(ini); d.setMonth(d.getMonth() + n); setMes(d.toLocaleDateString('sv-SE').slice(0, 7)) }
  const porDia = (d: string) => regs.filter(r => txt(r.campos[m.cal!]) === d)
  const semData = regs.filter(r => !r.campos[m.cal!] && !etapa(m, r.status).fim)
  return (
    <div className="md-cal">
      <div className="md-cal-h"><button className="icon-btn" onClick={() => nav(-1)} aria-label="Mês anterior"><Ph n="caret-left" size={16} /></button>
        <b>{ini.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</b>
        <button className="icon-btn" onClick={() => nav(1)} aria-label="Próximo mês"><Ph n="caret-right" size={16} /></button></div>
      <div className="md-cal-g">
        {['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'].map(d => <small key={d} className="md-cal-s">{d}</small>)}
        {Array.from({ length: pad }, (_, i) => <i key={'p' + i} />)}
        {Array.from({ length: dias }, (_, i) => {
          const d = `${mes}-${String(i + 1).padStart(2, '0')}`
          const rs = porDia(d)
          return (
            <div key={d} className={'md-cal-d' + (d === hoje() ? ' hoje' : '')} onDoubleClick={() => pode && abrir({ campos: { [m.cal!]: d } })}>
              <small>{i + 1}</small>
              {rs.slice(0, 3).map(r => <button key={r.id} style={{ '--c': etapa(m, r.status).cor } as React.CSSProperties} onClick={() => editar(r)} title={r.titulo}>{r.titulo || '—'}</button>)}
              {rs.length > 3 && <em>+{rs.length - 3}</em>}
            </div>
          )
        })}
      </div>
      {!!semData.length && <div className="md-semdata"><small>Sem data</small>{semData.map(r => <Cartao key={r.id} m={m} r={r} profiles={profiles} onClick={() => editar(r)} />)}</div>}
      {pode && <small className="muted">Dois cliques num dia para criar nele.</small>}
    </div>
  )
}

function Grade({ m, regs, todos, pode, profiles, editar, sala }: Ctx) {
  const [filtro, setFiltro] = useState('')
  const [menu, setMenu] = useState('')
  const [lote, setLote] = useState(false)
  const vis = filtro ? regs.filter(r => r.status === filtro) : regs
  const blocos = [...new Set(vis.map(r => txt(r.campos.bloco)))].sort()
  const ord = (a: Registro, b: Registro) => a.titulo.localeCompare(b.titulo, 'pt-BR', { numeric: true })
  return <>
    <div className="md-cont">
      {m.status.map(e => { const n = todos.filter(r => r.status === e.id).length; return (
        <button key={e.id} className={filtro === e.id ? 'on' : ''} style={{ '--c': e.cor } as React.CSSProperties} onClick={() => setFiltro(filtro === e.id ? '' : e.id)}><i className="md-dot" />{e.nome}<b>{n}</b></button>) })}
      {pode && <button className="btn sm ghost" onClick={() => setLote(true)}><Ph n="plus" size={14} />{m.novo}</button>}
    </div>
    {!todos.length && <p className="pd-vazio">Nenhum quarto ainda. {pode && <>Use <b>{m.novo}</b> e digite os números (ex.: 101-120).</>}</p>}
    {blocos.map(b => (
      <section key={b} className="md-bloco">
        {(b || blocos.length > 1) && <h3>{b || 'Sem bloco'}</h3>}
        <div className="md-tiles">
          {vis.filter(r => txt(r.campos.bloco) === b).sort(ord).map(r => { const e = etapa(m, r.status); return (
            <div key={r.id} className="md-tile-w">
              <button className="md-tile" style={{ '--c': e.cor } as React.CSSProperties} onClick={() => setMenu(menu === r.id ? '' : r.id)} aria-expanded={menu === r.id} title={`${r.titulo} · ${e.nome}`}>
                <b>{r.titulo}</b><small>{e.nome}</small>{!!r.campos.camareira && <em>{primeiro(r.campos.camareira, profiles)}</em>}
              </button>
              {menu === r.id && <>
                <div className="more-veil" onClick={() => setMenu('')} />
                <div className="menu-pop md-tile-pop">
                  {m.status.map(x => <button key={x.id} disabled={!pode} className={x.id === r.status ? 'on' : ''} onClick={() => { setMenu(''); salva({ ...r, status: x.id }) }}><i className="md-dot" style={{ background: x.cor }} /><b className="grow">{x.nome}</b></button>)}
                  <button onClick={() => { setMenu(''); editar(r) }}><Ph n="pencil-simple-line" size={16} /><b className="grow">Detalhes</b></button>
                </div>
              </>}
            </div>) })}
        </div>
      </section>
    ))}
    {lote && <Lote m={m} sala={sala} existentes={todos} onClose={() => setLote(false)} />}
  </>
}

/** "101-120, 201, 202" → quartos novos de uma vez */
function Lote({ m, sala, existentes, onClose }: { m: Modulo; sala: string; existentes: Registro[]; onClose: () => void }) {
  const [t, setT] = useState('')
  const [bloco, setBloco] = useState('')
  const nomes = t.split(/[,;\s]+/).filter(Boolean).flatMap(p => {
    const [a, b] = p.split('-').map(x => x.trim())
    if (b && /^\d+$/.test(a) && /^\d+$/.test(b) && +b >= +a && +b - +a <= 300) return Array.from({ length: +b - +a + 1 }, (_, i) => String(+a + i))
    return [p]
  })
  const ja = new Set(existentes.map(r => r.titulo))
  const novos = [...new Set(nomes)].filter(n => !ja.has(n))
  const ok = () => { novos.forEach((n, i) => salva(novoReg(m, sala, { titulo: n, campos: bloco ? { bloco } : {}, pos: Date.now() + i }))); onClose() }
  return (
    <Modal title={m.novo} onClose={onClose}>
      <form className="pl-form one" onSubmit={e => { e.preventDefault(); ok() }}>
        <label><span>Números</span><input value={t} onChange={e => setT(e.target.value)} placeholder="Ex.: 101-120, 201, 202, Chalé 3" autoFocus /></label>
        <label><span>Bloco / andar <small className="muted">(opcional)</small></span><input value={bloco} onChange={e => setBloco(e.target.value)} placeholder="Ex.: Bloco A" /></label>
        <small className="muted">{novos.length ? `${novos.length} quarto(s) novo(s)` : 'Nenhum quarto novo'}{nomes.length > novos.length ? ` · ${nomes.length - novos.length} já existe(m)` : ''}</small>
        <div className="md-acts"><button type="button" className="btn ghost" onClick={onClose}>Cancelar</button><button className="btn primary" disabled={!novos.length}>Adicionar</button></div>
      </form>
    </Modal>
  )
}

const nomeSt = (m: Modulo, id: string) => m.status.find(e => e.id === id)?.nome ?? id
const turnoAgora = () => { const h = new Date().getHours(); return h < 12 ? 'Manhã' : h < 18 ? 'Tarde' : 'Noite' }
function Diario({ m, regs, pode, profiles, sala }: Ctx) {
  const [t, setT] = useState('')
  const turnos = m.campos.find(c => c.id === 'turno')?.ops ?? ['Manhã', 'Tarde', 'Noite']
  const [turno, setTurno] = useState(() => turnos.includes(turnoAgora()) ? turnoAgora() : turnos[0] ?? '')
  const [pend, setPend] = useState(false)
  const [so, setSo] = useState(false)
  const eu = me()
  const vis = regs.filter(r => !so || r.status === 'pendente').sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 120)
  const dias = [...new Set(vis.map(r => r.created_at.slice(0, 10)))]
  const enviar = () => { if (!t.trim() || !eu) return; salva(novoReg(m, sala, { titulo: t.trim(), status: pend ? 'pendente' : 'nota', campos: { ...(turno ? { turno } : {}), lidos: [eu.id] } })); setT(''); setPend(false) }
  const li = (r: Registro) => { if (!eu) return; const l = (r.campos.lidos as string[] | undefined) ?? []; if (!l.includes(eu.id)) salva({ ...r, campos: { ...r.campos, lidos: [...l, eu.id] } }) }
  const abertas = regs.filter(r => r.status === 'pendente').length
  return <>
    {pode && <form className="md-diario-f" onSubmit={e => { e.preventDefault(); enviar() }}>
      <textarea value={t} onChange={e => setT(e.target.value)} rows={2} maxLength={2000} placeholder={m.dica ?? 'O que o próximo turno precisa saber?'} onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) enviar() }} />
      <div className="md-diario-a">
        {turnos.length > 0 && <div className="pd-seg">{turnos.map(x => <button type="button" key={x} className={turno === x ? 'on' : ''} onClick={() => setTurno(x)}>{x}</button>)}</div>}
        <label className="pd-chk"><input type="checkbox" checked={pend} onChange={e => setPend(e.target.checked)} /> {nomeSt(m, 'pendente')} (alguém precisa ver)</label>
        <button className="btn primary sm" disabled={!t.trim()}>{m.novo}</button>
      </div>
    </form>}
    <div className="pd-seg md-filtro"><button className={!so ? 'on' : ''} onClick={() => setSo(false)}>Tudo</button><button className={so ? 'on' : ''} onClick={() => setSo(true)}>{nomeSt(m, 'pendente')} · {abertas}</button></div>
    {!vis.length && <p className="pd-vazio">{so ? 'Nada em aberto.' : 'Nada anotado ainda.'}</p>}
    {dias.map(d => (
      <section key={d} className="md-dia">
        <h3>{d === hoje() ? 'Hoje' : d === somaDias(hoje(), -1) ? 'Ontem' : dia(d)}</h3>
        {vis.filter(r => r.created_at.slice(0, 10) === d).map(r => {
          const autor = profiles[r.por ?? '']
          const lidos = ((r.campos.lidos as string[] | undefined) ?? []).filter(x => x !== r.por)
          const eli = !!eu && (r.por === eu.id || lidos.includes(eu.id))
          return (
            <article key={r.id} className={'md-nota st-' + r.status}>
              <MiniAvatar avatar={autor?.avatar ?? null} photo={autor?.photo ?? null} name={autor?.name ?? '?'} size={30} />
              <div className="grow">
                <small><b>{autor?.name.split(' ')[0] ?? 'Alguém'}</b> {r.campos.turno ? ' · ' + txt(r.campos.turno) : ''} · {hora(r.created_at)}{r.status === 'pendente' && <em className="md-tag-p">{nomeSt(m, 'pendente')}</em>}{r.status === 'resolvido' && <em className="md-tag-ok">{nomeSt(m, 'resolvido')}</em>}</small>
                <p>{r.titulo}</p>
                <div className="md-nota-a">
                  {lidos.length > 0 && <small className="muted">Lido por {lidos.map(x => primeiro(x, profiles)).join(', ')}</small>}
                  {!eli && <button className="btn sm ghost" onClick={() => li(r)}><Ph n="check" size={14} />Li</button>}
                  {pode && r.status === 'pendente' && <button className="btn sm ghost" onClick={() => salva({ ...r, status: 'resolvido', campos: { ...r.campos, resolveu: eu?.id } })}>Resolver</button>}
                  {r.status === 'resolvido' && !!r.campos.resolveu && <small className="muted">por {primeiro(r.campos.resolveu, profiles)}</small>}
                  {(r.por === eu?.id) && <button className="md-x" onClick={async () => { if (await confirmar('Apagar este recado?', { danger: true, ok: 'Apagar' })) run(dropRow('registros', r.id)) }} aria-label="Apagar"><Ph n="trash" size={14} /></button>}
                </div>
              </div>
            </article>
          )
        })}
      </section>
    ))}
  </>
}

const segunda = (d: string) => { const x = new Date(d + 'T12:00'); x.setDate(x.getDate() - (x.getDay() + 6) % 7); return x.toLocaleDateString('sv-SE') }
function Semana({ m, regs, pode, profiles, editar, abrir, sala }: Ctx) {
  const [ini, setIni] = useState(() => segunda(hoje()))
  const [copiado, setCopiado] = useState(false)
  const grade = useRef<HTMLDivElement>(null)
  // semana com rolagem lateral: o dia de hoje aparece sem precisar procurar
  useEffect(() => {
    const box = grade.current, h = box?.querySelector<HTMLElement>('.hoje')
    if (box && h && box.scrollWidth > box.clientWidth) box.scrollLeft += h.getBoundingClientRect().left - box.getBoundingClientRect().left - 8
  }, [ini])
  const dias = Array.from({ length: 7 }, (_, i) => somaDias(ini, i))
  const doDia = (d: string) => regs.filter(r => txt(r.campos.dia) === d).sort((a, b) => txt(a.campos.hora).localeCompare(txt(b.campos.hora)))
  const semana = regs.filter(r => dias.includes(txt(r.campos.dia)))
  const anterior = regs.filter(r => { const d = txt(r.campos.dia); return d >= somaDias(ini, -7) && d < ini })
  const repetir = () => anterior.forEach((r, i) => salva(novoReg(m, sala, { titulo: r.titulo, status: 'ok', campos: { ...r.campos, dia: somaDias(txt(r.campos.dia), 7) }, pos: Date.now() + i })))
  const copiar = () => {
    const t = dias.map(d => { const rs = doDia(d).filter(r => r.status !== 'cancelada'); if (!rs.length) return ''
      const w = new Date(d + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })
      return `*${w[0].toUpperCase() + w.slice(1)}*\n` + rs.map(r => `${txt(r.campos.hora)} ${r.titulo}${r.campos.local ? ' · ' + txt(r.campos.local) : ''}${r.campos.publico ? ' (' + txt(r.campos.publico) + ')' : ''}${r.campos.resp && m.campos.find(c => c.id === 'resp')?.tipo === 'pessoa' ? ' — ' + primeiro(r.campos.resp, profiles) : ''}`).join('\n') }).filter(Boolean).join('\n\n')
    void navigator.clipboard?.writeText(t).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 2000) })
  }
  return <>
    <div className="md-sem-h">
      <button className="icon-btn" onClick={() => setIni(somaDias(ini, -7))} aria-label="Semana anterior"><Ph n="caret-left" size={16} /></button>
      <b>{dia(ini)} a {dia(dias[6])}</b>
      <button className="icon-btn" onClick={() => setIni(somaDias(ini, 7))} aria-label="Próxima semana"><Ph n="caret-right" size={16} /></button>
      {ini !== segunda(hoje()) && <button className="btn sm ghost" onClick={() => setIni(segunda(hoje()))}>Esta semana</button>}
      <span className="grow" />
      {pode && !semana.length && !!anterior.length && <button className="btn sm ghost" onClick={repetir}>Repetir semana anterior ({anterior.length})</button>}
      {!!semana.length && <button className="btn sm ghost" onClick={copiar}><Ph n="copy" size={14} />{copiado ? 'Copiado' : 'Copiar pro WhatsApp'}</button>}
    </div>
    <div className="md-sem" ref={grade}>
      {dias.map(d => (
        <section key={d} className={d === hoje() ? 'hoje' : ''}>
          <header><b>{new Date(d + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}</b><small>{d.slice(8)}/{d.slice(5, 7)}</small>
            {pode && <button className="icon-btn" onClick={() => abrir({ campos: { dia: d } })} aria-label={`${m.novo} em ${dia(d)}`}><Ph n="plus" size={14} /></button>}</header>
          {doDia(d).map(r => (
            <button key={r.id} className={'md-ativ' + (r.status === 'cancelada' ? ' canc' : '')} onClick={() => editar(r)}>
              <small>{txt(r.campos.hora)}</small><b>{r.titulo}</b><Info m={m} r={r} profiles={profiles} so={m.campos.filter(c => c.id !== 'hora' && c.id !== 'dia').map(c => c.id)} />
            </button>
          ))}
        </section>
      ))}
    </div>
  </>
}

function Rotina({ m, regs, pode, profiles, editar }: Ctx) {
  const [d, setD] = useState(hoje)
  const eu = me()
  const feito = (r: Registro) => (r.campos.feito as Record<string, { por: string; em: string }> | undefined)?.[d]
  const marca = (r: Registro) => {
    if (!eu || d > hoje()) return
    const f = { ...((r.campos.feito as Record<string, unknown>) ?? {}) }
    if (f[d]) delete f[d]
    else f[d] = { por: eu.id, em: new Date().toISOString() }
    // guarda só os últimos 60 dias
    for (const k of Object.keys(f)) if (k < somaDias(hoje(), -60)) delete f[k]
    salva({ ...r, campos: { ...r.campos, feito: f } })
  }
  const ops = m.campos.find(c => c.id === 'turno')?.ops ?? []
  const grupos = [...ops, ''].map(t => [t, regs.filter(r => txt(r.campos.turno) === t || (!t && !ops.includes(txt(r.campos.turno))))] as const).filter(g => g[1].length)
  const n = regs.filter(feito).length
  return <>
    <div className="md-sem-h">
      <button className="icon-btn" onClick={() => setD(somaDias(d, -1))} aria-label="Dia anterior"><Ph n="caret-left" size={16} /></button>
      <b>{d === hoje() ? 'Hoje' : dia(d)}</b>
      <button className="icon-btn" onClick={() => setD(somaDias(d, 1))} disabled={d >= hoje()} aria-label="Próximo dia"><Ph n="caret-right" size={16} /></button>
      <div className="md-prog grow" title={`${n} de ${regs.length}`}><i style={{ width: regs.length ? (n / regs.length) * 100 + '%' : 0 }} /></div>
      <b className="md-prog-n">{n}/{regs.length}</b>
    </div>
    {!regs.length && <p className="pd-vazio">Monte o checklist do dia a dia: abrir o caixa, conferir a piscina, trancar o depósito…</p>}
    {grupos.map(([t, rs]) => (
      <section key={t} className="md-rot">
        {t && <h3>{t}</h3>}
        {rs.map(r => { const f = feito(r); return (
          <div key={r.id} className={'md-rot-i' + (f ? ' ok' : '')}>
            <button className="md-chk" disabled={!pode || d > hoje()} onClick={() => marca(r)} aria-pressed={!!f} aria-label={r.titulo}>{f && <Ph n="check" size={16} />}</button>
            <span className="grow"><b>{r.titulo}</b>{f ? <small>{primeiro(f.por, profiles)} · {hora(f.em)}</small> : !!r.campos.resp && <small>{primeiro(r.campos.resp, profiles)}</small>}</span>
            {pode && <button className="icon-btn" onClick={() => editar(r)} aria-label="Editar"><Ph n="pencil-simple-line" size={14} /></button>}
          </div>) })}
      </section>
    ))}
  </>
}

function Estoque({ regs, pode, editar, sala }: Ctx) {
  const [baixo, setBaixo] = useState(false)
  const [msg, setMsg] = useState('')
  const falta = (r: Registro) => r.campos.min != null && r.campos.min !== '' && num(r.campos.qtd) <= num(r.campos.min)
  const faltam = regs.filter(falta)
  const vis = (baixo ? faltam : regs).slice().sort((a, b) => Number(falta(b)) - Number(falta(a)) || a.titulo.localeCompare(b.titulo))
  const ajusta = (r: Registro, n: number) => salva({ ...r, campos: { ...r.campos, qtd: Math.max(0, num(r.campos.qtd) + n) } })
  const compras = abasDe(sala).has('compras') && MOD.compras
  const mandar = () => {
    if (!compras) return
    faltam.forEach((r, i) => salva(novoReg(MOD.compras, sala, { titulo: r.titulo, campos: { qtd: `${Math.max(1, num(r.campos.min) * 2 - num(r.campos.qtd))} ${txt(r.campos.unid) || 'un'}` }, pos: Date.now() + i })))
    setMsg(`${faltam.length} item(ns) foram para Compras.`)
  }
  const copiar = () => void navigator.clipboard?.writeText(faltam.map(r => `- ${r.titulo}: tem ${num(r.campos.qtd)} ${txt(r.campos.unid)} (mín. ${num(r.campos.min)})`).join('\n')).then(() => setMsg('Lista copiada.'))
  return <>
    <div className="md-sem-h">
      <div className="pd-seg"><button className={!baixo ? 'on' : ''} onClick={() => setBaixo(false)}>Tudo · {regs.length}</button><button className={baixo ? 'on' : ''} onClick={() => setBaixo(true)}>Abaixo do mínimo · {faltam.length}</button></div>
      <span className="grow" />
      {!!faltam.length && <button className="btn sm ghost" onClick={copiar}><Ph n="copy" size={14} />Copiar o que falta</button>}
      {!!faltam.length && pode && compras && <button className="btn sm ghost" onClick={mandar}><Ph n="storefront" size={14} />Mandar pra Compras</button>}
    </div>
    {msg && <small className="md-msg">{msg}</small>}
    {!vis.length ? <p className="pd-vazio">{baixo ? 'Nada abaixo do mínimo.' : 'Nenhum item cadastrado.'}</p> : <ul className="md-est">
      {vis.map(r => (
        <li key={r.id} className={falta(r) ? 'falta' : ''}>
          <button className="md-li" onClick={() => editar(r)}><b>{r.titulo}</b><small>{r.campos.local ? txt(r.campos.local) + ' · ' : ''}mín. {num(r.campos.min)}</small></button>
          <div className="md-qtd">
            {pode && <button className="icon-btn" onClick={() => ajusta(r, -1)} aria-label="Menos um"><Ph n="minus" size={14} /></button>}
            <b>{num(r.campos.qtd)}</b><small>{txt(r.campos.unid)}</small>
            {pode && <button className="icon-btn" onClick={() => ajusta(r, 1)} aria-label="Mais um"><Ph n="plus" size={14} /></button>}
          </div>
        </li>
      ))}
    </ul>}
  </>
}

/** formulário de um cartão: título, etapa e os campos do módulo */
export function Editor({ m, reg, novo, pode, fora, onClose }: { m: Modulo; reg: Registro; novo: boolean; pode: boolean; fora?: boolean; onClose: () => void }) {
  const profiles = useStore(st => st.profiles)
  const [r, setR] = useState(reg)
  const [err, setErr] = useState('')
  const set = (id: string, v: unknown) => setR({ ...r, campos: { ...r.campos, [id]: v } })
  const pessoas = Object.values(profiles).filter(p => deptOf(p) === r.dept || p.id === r.campos.resp).sort((a, b) => a.name.localeCompare(b.name))
  const ok = () => {
    if (!r.titulo.trim()) return setErr(`Preencha "${m.titulo}".`)
    salva({ ...r, titulo: r.titulo.trim() })
    onClose()
  }
  const apagar = async () => { if (await confirmar(`Apagar "${r.titulo}"?`, { danger: true, ok: 'Apagar' })) { run(dropRow('registros', r.id)); onClose() } }
  const campo = (c: Campo) => {
    const v = r.campos[c.id]
    const dis = !pode
    switch (c.tipo) {
      case 'longo': return <textarea value={txt(v)} disabled={dis} onChange={e => set(c.id, e.target.value)} rows={3} maxLength={4000} />
      case 'sel': return <select value={txt(v)} disabled={dis} onChange={e => set(c.id, e.target.value)}><option value="">—</option>{c.ops?.map(o => <option key={o}>{o}</option>)}</select>
      case 'pessoa': return <select value={txt(v)} disabled={dis} onChange={e => set(c.id, e.target.value)}><option value="">—</option>{pessoas.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
      case 'check': return <input type="checkbox" checked={!!v} disabled={dis} onChange={e => set(c.id, e.target.checked)} />
      case 'num': case 'dinheiro': return <input type="number" inputMode="decimal" min={0} step={c.tipo === 'dinheiro' ? 'any' : 1} value={v == null ? '' : txt(v)} disabled={dis} onChange={e => set(c.id, e.target.value === '' ? null : Number(e.target.value))} />
      case 'pct': return <span className="md-pct-in"><input type="range" min={0} max={100} step={5} value={num(v)} disabled={dis} onChange={e => set(c.id, Number(e.target.value))} /><b>{num(v)}%</b></span>
      default: return <input type={c.tipo === 'data' ? 'date' : c.tipo === 'hora' ? 'time' : c.tipo === 'tel' ? 'tel' : 'text'} value={txt(v)} disabled={dis} onChange={e => set(c.id, e.target.value)} maxLength={300} />
    }
  }
  const autor = profiles[r.por ?? '']
  return (
    <Modal title={novo ? m.novo : r.titulo || m.nome} onClose={onClose}>
      <form className="pl-form md-ed" onSubmit={e => { e.preventDefault(); if (pode) ok() }}>
        <label className="md-full"><span>{m.titulo}</span><input value={r.titulo} disabled={!pode} onChange={e => setR({ ...r, titulo: e.target.value })} maxLength={200} autoFocus={novo} required /></label>
        {m.status.length > 1 && !fora && <div className="md-full"><span className="pl-lab">Etapa</span>
          <div className="md-etapas">{m.status.map(e => <button type="button" key={e.id} disabled={!pode} className={r.status === e.id ? 'on' : ''} style={{ '--c': e.cor } as React.CSSProperties} onClick={() => setR({ ...r, status: e.id })}>{e.nome}</button>)}</div></div>}
        {m.campos.filter(c => !fora || c.tipo !== 'pessoa').map(c => <label key={c.id} className={c.tipo === 'longo' ? 'md-full' : ''}><span>{c.nome}</span>{campo(c)}</label>)}
        {err && <p className="pd-err md-full">{err}</p>}
        {!novo && <small className="muted md-full">{autor ? `Criado por ${autor.name.split(' ')[0]}` : 'Criado'} em {new Date(r.created_at).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}{r.dept !== me()?.dept && r.dept ? ` · ${deptName(r.dept)}` : ''}</small>}
        <div className="md-acts md-full">
          {!novo && (pode || r.por === me()?.id) && <button type="button" className="btn danger-ghost" onClick={apagar}><Ph n="trash" size={16} />Apagar</button>}
          <span className="grow" />
          <button type="button" className="btn ghost" onClick={onClose}>{pode ? 'Cancelar' : 'Fechar'}</button>
          {pode && <button className="btn primary">{novo ? 'Criar' : 'Salvar'}</button>}
        </div>
      </form>
    </Modal>
  )
}

/** chamado pra Manutenção/TI de qualquer sala (fica nos Pedidos): abre o cartão no setor dono e eu acompanho aqui */
export function Chamados() {
  const s = useStore(st => st)
  const eu = me()
  const [novo, setNovo] = useState<{ m: Modulo; r: Registro } | null>(null)
  const [ver, setVer] = useState<Registro | null>(null)
  if (!eu) return null
  const alvos = (['os', 'ti'] as const).flatMap(mid => Object.values(s.rows.depts).filter(d => abasDe(d.id, s).has(mid)).map(d => ({ mid, d })))
  const meus = Object.values(s.rows.registros).filter(r => r.por === eu.id && (r.modulo === 'os' || r.modulo === 'ti') && r.dept !== deptOf(eu))
    .sort((a, b) => Number(!!etapa(MOD[a.modulo], a.status).fim) - Number(!!etapa(MOD[b.modulo], b.status).fim) || b.created_at.localeCompare(a.created_at)).slice(0, 12)
  if (!alvos.length && !meus.length) return null
  return (
    <section className="md-chamados">
      <div className="md-chamados-h">
        <b className="grow">Chamados</b>
        {alvos.filter(a => a.d.id !== deptOf(eu)).map(({ mid, d }) => (
          <button key={mid + d.id} className="btn sm ghost" onClick={() => setNovo({ m: MOD[mid], r: novoReg(MOD[mid], d.id, {}) })}>
            <Ph n={MOD[mid].ic} size={16} />{mid === 'ti' ? 'Chamado de TI' : 'Chamado'} · {d.name}
          </button>
        ))}
      </div>
      {meus.length > 0 && <ul className="md-lista">
        {meus.map(r => { const m = MOD[r.modulo]; const e = etapa(m, r.status); return (
          <li key={r.id}>
            <span className="md-st" style={{ '--c': e.cor } as React.CSSProperties}>{e.nome}</span>
            <button className="md-li" onClick={() => setVer(r)}><b>{r.titulo}</b><small>{deptName(r.dept, s)} · {dia(r.created_at.slice(0, 10))}{r.campos.resp ? ' · com ' + primeiro(r.campos.resp, s.profiles) : ''}</small></button>
          </li>) })}
      </ul>}
      {novo && <Editor m={novo.m} reg={novo.r} novo pode fora onClose={() => setNovo(null)} />}
      {ver && <Editor m={MOD[ver.modulo]} reg={ver} novo={false} pode={false} onClose={() => setVer(null)} />}
    </section>
  )
}
