import { useMemo, useRef, useState } from 'react'
import { deptOf, rankOf } from '../game/ranks'
import { importar, type Importado } from '../plano/importar'
import { nomeMes, parseDia, somaMes } from '../plano/datas'
import { addTask, deptList, deptName, dropRow, me, putRow, putRows, run, setUi, useStore } from '../store'
import type { PlanoAcao, PlanoMes, PlanoNucleo, PlanoResp, Profile, Task } from '../types'
import { Bell } from './Avisos'
import { Ph } from './Icon'
import MiniAvatar from './MiniAvatar'
import SegInd from './SegInd'
import '../plano/plano.css'

type Modo = 'matriz' | 'mes'
type Faixa = 'campanha' | 'principal' | 'tematica' | 'oferta' | 'persona'
const FAIXAS: { k: Faixa; label: string; max: number }[] = [
  { k: 'tematica', label: 'Temáticas', max: 400 },
  { k: 'principal', label: 'Campanha do bimestre', max: 300 },
  { k: 'campanha', label: 'Campanha do mês', max: 300 },
  { k: 'oferta', label: 'Produto / oferta', max: 2000 },
  { k: 'persona', label: 'Persona e foco', max: 2000 },
]
const hoje = () => new Date().toISOString().slice(0, 7)
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const siglas = (resp: string) => resp.toUpperCase().split(/\s*(?:\/|,|\+|&|\bE\b)\s*/).map(x => x.trim()).filter(Boolean)

const editaPlano = (p: Profile | undefined) => !!p && (!!p.is_admin || rankOf(p) === 4 || deptOf(p) === 'marketing')

/** quem executa: pessoas da ação; senão, as da sigla (RESP.) ou alguém com esse nome; sala idem */
function quem(a: PlanoAcao, resp: Record<string, PlanoResp>, profiles: Record<string, Profile>) {
  let pessoas = a.pessoas.filter(id => profiles[id])
  const rs = resp[a.resp.toUpperCase()] ? [resp[a.resp.toUpperCase()]] : siglas(a.resp).map(c => resp[c]).filter(Boolean)
  if (!pessoas.length) pessoas = [...new Set(rs.flatMap(r => r.pessoas))].filter(id => profiles[id])
  if (!pessoas.length && a.resp && !rs.length) {
    const n = norm(a.resp.trim())
    pessoas = Object.values(profiles).filter(p => n.length > 2 && norm(p.name).split(' ')[0] === n.split(' ')[0]).map(p => p.id).slice(0, 1)
  }
  const dept = a.dept ?? rs.find(r => r.dept)?.dept ?? (pessoas[0] ? deptOf(profiles[pessoas[0]]) : null)
  return { pessoas, dept }
}

type Sit = 'livre' | 'enviada' | 'fazendo' | 'feita'
function situacao(a: PlanoAcao, tasks: Record<string, Task>): Sit {
  if (!a.tarefas.length) return 'livre'
  const ts = a.tarefas.map(id => tasks[id]).filter(Boolean)
  if (ts.length && ts.every(t => t.status === 'done')) return 'feita'
  if (ts.some(t => t.status === 'doing' || t.status === 'review')) return 'fazendo'
  return 'enviada'
}
const SIT: Record<Sit, string> = { livre: 'Ainda não foi pro quadro', enviada: 'No quadro', fazendo: 'Em andamento', feita: 'Feita' }

/** cria a tarefa no quadro da sala de quem executa e guarda o vínculo na ação */
async function mandar(a: PlanoAcao, ctx: { resp: Record<string, PlanoResp>; profiles: Record<string, Profile>; meses: Record<string, PlanoMes>; nucleos: Record<string, PlanoNucleo> }) {
  const { pessoas } = quem(a, ctx.resp, ctx.profiles)
  if (!pessoas.length) throw new Error(`Escolha quem faz “${a.texto.slice(0, 40)}”.`)
  const { start, due } = parseDia(a.dia, a.mes)
  const m = ctx.meses[`${a.ciclo}:${a.mes}`], n = ctx.nucleos[a.nucleo]
  const title = a.texto.length > 200 ? a.texto.slice(0, 197).trimEnd() + '…' : a.texto
  const notes = [
    `Plano de marketing · ${nomeMes(a.mes)}${m?.campanha ? ' · ' + m.campanha : ''}`,
    n ? `Núcleo: ${n.nome}` : '',
    a.texto.length > 200 ? a.texto : '',
    a.estrategia ? `Estratégia: ${a.estrategia}` : '',
    m?.estrategia ? `Estratégia do mês: ${m.estrategia}` : '',
  ].filter(Boolean).join('\n\n')
  const t = await addTask(pessoas[0], title, due, notes, 'todo', null, { start: start < due ? start : null, collaborators: pessoas.slice(1) })
  await putRow('plano_acoes', { ...a, tarefas: [...a.tarefas, t.id] })
}

export default function Plano() {
  const rows = useStore(s => s.rows)
  const profiles = useStore(s => s.profiles)
  const tasks = useStore(s => s.tasks)
  const meP = me()
  const can = editaPlano(meP)
  const depts = deptList()
  const ciclos = useMemo(() => [...new Set(Object.values(rows.plano_nucleos).map(n => n.ciclo).concat(Object.values(rows.plano_meses).map(m => m.ciclo)))].sort(), [rows.plano_nucleos, rows.plano_meses])
  const atual = ciclos.filter(c => c <= hoje()).pop() ?? ciclos[0] ?? ''
  const [ciclo, setCiclo] = useState('')
  const cc = ciclos.includes(ciclo) ? ciclo : atual
  const meses = useMemo(() => Object.values(rows.plano_meses).filter(m => m.ciclo === cc).sort((a, b) => a.mes.localeCompare(b.mes)), [rows.plano_meses, cc])
  const nucleos = useMemo(() => Object.values(rows.plano_nucleos).filter(n => n.ciclo === cc).sort((a, b) => a.pos - b.pos), [rows.plano_nucleos, cc])
  const acoes = useMemo(() => Object.values(rows.plano_acoes).filter(a => a.ciclo === cc).sort((a, b) => a.pos - b.pos || a.created_at.localeCompare(b.created_at)), [rows.plano_acoes, cc])
  const [modo, setModo] = useState<Modo>('matriz')
  const [mes, setMes] = useState('')
  const mm = meses.some(m => m.mes === mes) ? mes : (meses.find(m => m.mes === hoje()) ?? meses[0])?.mes ?? ''
  const [sala, setSala] = useState('')
  const [q, setQ] = useState('')
  const [edit, setEdit] = useState<PlanoAcao | 'novo' | null>(null)
  const [novo, setNovo] = useState<{ nucleo: string; mes: string } | null>(null)
  const [nuc, setNuc] = useState<PlanoNucleo | 'novo' | null>(null)
  const [respOpen, setRespOpen] = useState(false)
  const [prev, setPrev] = useState<Importado | null>(null)
  const [lendo, setLendo] = useState(false)
  const file = useRef<HTMLInputElement>(null)
  const ctx = { resp: rows.plano_resp, profiles, meses: rows.plano_meses, nucleos: rows.plano_nucleos }

  const passa = (a: PlanoAcao) => {
    if (q && !norm(`${a.texto} ${a.resp} ${a.dia}`).includes(norm(q))) return false
    if (sala && rows.plano_nucleos[a.nucleo]?.tipo !== 'datas' && quem(a, rows.plano_resp, profiles).dept !== sala) return false
    return true
  }

  const ler = async (f: File) => {
    setLendo(true)
    try { setPrev(await importar(f, depts, rows)) } catch (e) { setUi({ error: (e as Error).message }) } finally { setLendo(false) }
  }
  const novoCiclo = async () => {
    const c = hoje(), now = new Date().toISOString()
    await putRows('plano_meses', Array.from({ length: 12 }, (_, i) => somaMes(c, i)).map(m => ({ id: `${c}:${m}`, ciclo: c, mes: m, tematica: '', principal: '', campanha: '', oferta: '', persona: '', estrategia: '', created_at: now })))
    await putRows('plano_nucleos', [{ id: `${c}:n0`, ciclo: c, nome: 'Datas comemorativas', pos: 0, tipo: 'datas', created_at: now }])
    setCiclo(c)
  }

  const input = <input ref={file} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) run(ler(f)) }} />

  if (!meses.length && !nucleos.length) return (
    <div className="quadro plano">
      <div className="qbar"><b className="grow">Plano de marketing</b><Bell /></div>
      <div className="panel empty-goal pl-vazio">
        <Ph n="calendar-dots" size={40} /><b>Nenhum plano ainda</b>
        <small className="muted">{can
          ? 'Traga a planilha do plano macro (núcleos nas linhas, meses nas colunas) ou comece em branco. Depois é só escolher quem faz cada ação e mandar pro quadro da sala.'
          : 'Quando o Marketing montar o plano do ano, ele aparece aqui, com a campanha de cada mês e o que cada setor faz.'}</small>
        {can && <div className="row gap">
          <button className="btn accent" disabled={lendo} onClick={() => file.current?.click()}><Ph n="upload-simple" size={18} />{lendo ? 'Lendo a planilha…' : 'Importar planilha (.xlsx)'}</button>
          <button className="btn soft" onClick={() => run(novoCiclo())}><Ph n="note-blank" size={18} />Começar em branco</button>
        </div>}
        {input}
      </div>
      {prev && <Previa p={prev} onClose={() => setPrev(null)} onDone={c => { setCiclo(c); setPrev(null) }} />}
    </div>
  )

  return (
    <div className="quadro plano">
      <div className="qbar pl-bar">
        <div className="seg" role="tablist" aria-label="Visão">
          <SegInd />
          <button className={modo === 'matriz' ? 'on' : ''} onClick={() => setModo('matriz')} title="Todos os núcleos × todos os meses"><Ph n="squares-four" size={18} fill={modo === 'matriz'} />Ano</button>
          <button className={modo === 'mes' ? 'on' : ''} onClick={() => setModo('mes')} title="A campanha e as ações de um mês"><Ph n="calendar-blank" size={18} fill={modo === 'mes'} />Mês</button>
        </div>
        {ciclos.length > 1 && <label className="qchip"><Ph n="calendar-dots" size={15} />
          <select value={cc} onChange={e => setCiclo(e.target.value)} aria-label="Ciclo">{ciclos.map(c => <option key={c} value={c}>Ciclo {nomeMes(c, true)}/{c.slice(2, 4)}</option>)}</select>
        </label>}
        <label className="qchip"><Ph n="funnel" size={15} />
          <select value={sala} onChange={e => setSala(e.target.value)} aria-label="Filtrar por sala">
            <option value="">Todas as salas</option>
            {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </label>
        <label className="qchip pl-busca"><Ph n="magnifying-glass" size={15} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar ação" aria-label="Buscar ação" /></label>
        <span className="grow" />
        {can && <button className="btn soft" onClick={() => setRespOpen(true)} title="Quem é cada sigla (MKT, DES…) e quem recebe as tarefas"><Ph n="users-three" size={18} />Responsáveis</button>}
        {can && <button className="btn soft" disabled={lendo} onClick={() => file.current?.click()} title="Atualiza o plano com uma nova versão da planilha"><Ph n="upload-simple" size={18} />{lendo ? 'Lendo…' : 'Importar'}</button>}
        {input}
        <Bell />
      </div>

      {modo === 'matriz'
        ? <Matriz meses={meses} nucleos={nucleos} acoes={acoes} passa={passa} can={can} mesAtual={hoje()}
            onMes={m => { setMes(m); setModo('mes') }} onAcao={setEdit} onNova={(n, m) => { setNovo({ nucleo: n, mes: m }); setEdit('novo') }} onNucleo={setNuc} />
        : <Mes m={meses.find(x => x.mes === mm)} meses={meses} nucleos={nucleos} acoes={acoes.filter(a => a.mes === mm)} passa={passa} can={can} ctx={ctx} tasks={tasks}
            onMes={setMes} onAcao={setEdit} onNova={n => { setNovo({ nucleo: n, mes: mm }); setEdit('novo') }} />}

      {edit && <AcaoModal a={edit === 'novo' ? null : rows.plano_acoes[edit.id] ?? edit} base={novo} ciclo={cc} meses={meses} nucleos={nucleos} can={can} ctx={ctx} tasks={tasks}
        onClose={() => { setEdit(null); setNovo(null) }} />}
      {nuc && <NucleoModal n={nuc === 'novo' ? null : nuc} ciclo={cc} pos={nucleos.length} onClose={() => setNuc(null)} />}
      {respOpen && <RespModal acoes={acoes} onClose={() => setRespOpen(false)} />}
      {prev && <Previa p={prev} onClose={() => setPrev(null)} onDone={c => { setCiclo(c); setPrev(null) }} />}
    </div>
  )
}

/* ---------------- Ano: núcleos × meses ---------------- */
function Matriz({ meses, nucleos, acoes, passa, can, mesAtual, onMes, onAcao, onNova, onNucleo }: {
  meses: PlanoMes[]; nucleos: PlanoNucleo[]; acoes: PlanoAcao[]; passa: (a: PlanoAcao) => boolean; can: boolean; mesAtual: string
  onMes: (m: string) => void; onAcao: (a: PlanoAcao) => void; onNova: (n: string, m: string) => void; onNucleo: (n: PlanoNucleo | 'novo') => void
}) {
  const tasks = useStore(s => s.tasks)
  const por = useMemo(() => {
    const o: Record<string, PlanoAcao[]> = {}
    for (const a of acoes) (o[a.nucleo + '|' + a.mes] ??= []).push(a)
    return o
  }, [acoes])
  // faixas: meses vizinhos com o mesmo texto viram uma célula só
  const faixa = (k: Faixa) => {
    const out: { v: string; n: number; mes: string }[] = []
    for (const m of meses) {
      const last = out[out.length - 1]
      if (last && last.v && last.v === m[k]) last.n++
      else out.push({ v: m[k], n: 1, mes: m.mes })
    }
    return out
  }
  return (
    <div className="pl-scroll">
      <table className="pl-mx" style={{ ['--n' as string]: meses.length }}>
        <thead>
          <tr>
            <th className="pl-corner">Núcleo</th>
            {meses.map(m => <th key={m.mes} className={m.mes === mesAtual ? 'agora' : ''}>
              <button onClick={() => onMes(m.mes)} title="Abrir o mês"><b>{nomeMes(m.mes, true)}</b><small>{m.mes.slice(0, 4)}</small></button>
            </th>)}
          </tr>
        </thead>
        <tbody>
          {FAIXAS.map(f => (
            <tr key={f.k} className={'pl-faixa f-' + f.k}>
              <th>{f.label}</th>
              {faixa(f.k).map(c => <td key={c.mes} colSpan={c.n} className={c.mes <= mesAtual && mesAtual <= somaMes(c.mes, c.n - 1) ? 'agora' : ''}>
                {c.v ? <button className="pl-fx" onClick={() => onMes(c.mes)} title={c.v}>{c.v}</button> : <span className="pl-nada">—</span>}
              </td>)}
            </tr>
          ))}
          {nucleos.map(n => (
            <tr key={n.id} className={n.tipo === 'datas' ? 'pl-datas' : ''}>
              <th>{can ? <button className="pl-nuc" onClick={() => onNucleo(n)} title="Renomear ou apagar">{n.nome}</button> : <span className="pl-nuc">{n.nome}</span>}</th>
              {meses.map(m => {
                const xs = (por[n.id + '|' + m.mes] ?? []).filter(passa)
                return <td key={m.mes} className={m.mes === mesAtual ? 'agora' : ''}>
                  <div className="pl-cel">
                    {xs.map(a => <Chip key={a.id} a={a} datas={n.tipo === 'datas'} sit={situacao(a, tasks)} onClick={() => onAcao(a)} />)}
                    {can && <button className="pl-add" onClick={() => onNova(n.id, m.mes)} aria-label={`Nova ação em ${n.nome}, ${nomeMes(m.mes)}`}><Ph n="plus" size={14} /></button>}
                  </div>
                </td>
              })}
            </tr>
          ))}
          {can && <tr className="pl-novo"><th><button className="btn ghost" onClick={() => onNucleo('novo')}><Ph n="plus" size={16} />Núcleo</button></th><td colSpan={meses.length} /></tr>}
        </tbody>
      </table>
    </div>
  )
}

function Chip({ a, datas, sit, onClick }: { a: PlanoAcao; datas: boolean; sit: Sit; onClick: () => void }) {
  return (
    <button className={'pl-chip' + (datas ? ' data' : ' s-' + sit)} onClick={onClick} title={`${a.dia ? a.dia + ' · ' : ''}${a.texto}${datas ? '' : '\n' + SIT[sit]}`}>
      {(a.dia || a.resp) && <span className="pl-meta">{a.dia && <b>{a.dia}</b>}{a.resp && <em>{a.resp}</em>}</span>}
      <span className="pl-tx">{a.texto}</span>
    </button>
  )
}

/* ---------------- Mês: campanha + ações por núcleo ---------------- */
function Mes({ m, meses, nucleos, acoes, passa, can, ctx, tasks, onMes, onAcao, onNova }: {
  m: PlanoMes | undefined; meses: PlanoMes[]; nucleos: PlanoNucleo[]; acoes: PlanoAcao[]; passa: (a: PlanoAcao) => boolean; can: boolean
  ctx: Parameters<typeof mandar>[1]; tasks: Record<string, Task>; onMes: (m: string) => void; onAcao: (a: PlanoAcao) => void; onNova: (n: string) => void
}) {
  const [indo, setIndo] = useState(false)
  if (!m) return null
  const datas = new Set(nucleos.filter(n => n.tipo === 'datas').map(n => n.id))
  const vis = acoes.filter(passa)
  const dts = vis.filter(a => datas.has(a.nucleo)).sort((a, b) => parseDia(a.dia, a.mes).start.localeCompare(parseDia(b.dia, b.mes).start))
  const acs = vis.filter(a => !datas.has(a.nucleo))
  const livres = acs.filter(a => !a.tarefas.length)
  const prontas = livres.filter(a => quem(a, ctx.resp, ctx.profiles).pessoas.length)
  const feitas = acs.filter(a => situacao(a, tasks) === 'feita').length
  const salva = (k: keyof PlanoMes, v: string) => { if (v !== m[k]) run(putRow('plano_meses', { ...m, [k]: v })) }
  const tudo = async () => {
    if (!confirm(`Mandar ${prontas.length} ação(ões) de ${nomeMes(m.mes)} pro quadro de quem executa?${livres.length > prontas.length ? `\n\n${livres.length - prontas.length} ficam de fora porque ainda não têm quem faça.` : ''}`)) return
    setIndo(true)
    try { for (const a of prontas) await mandar(a, ctx) } finally { setIndo(false) }
  }
  const i = meses.findIndex(x => x.mes === m.mes)
  return (
    <div className="pl-mes">
      <nav className="pl-pills" aria-label="Meses">
        <button className="icon-btn" disabled={i <= 0} onClick={() => onMes(meses[i - 1].mes)} aria-label="Mês anterior"><Ph n="caret-left" size={18} /></button>
        {meses.map(x => <button key={x.mes} className={'pl-pill' + (x.mes === m.mes ? ' on' : '') + (x.mes === hoje() ? ' agora' : '')} onClick={() => onMes(x.mes)}>{nomeMes(x.mes, true)}</button>)}
        <button className="icon-btn" disabled={i >= meses.length - 1} onClick={() => onMes(meses[i + 1].mes)} aria-label="Próximo mês"><Ph n="caret-right" size={18} /></button>
      </nav>

      <section className="pl-hero">
        <div className="pl-hero-top">
          <small className="pl-kick">{nomeMes(m.mes)}</small>
          <Campo can={can} cls="pl-camp" v={m.campanha} max={300} ph="Campanha do mês" onSave={v => salva('campanha', v)} />
          <div className="pl-tags">
            <span className="pl-tag"><Ph n="flag-banner" size={14} /><Campo can={can} v={m.principal} max={300} ph="Campanha do bimestre" onSave={v => salva('principal', v)} /></span>
            <span className="pl-tag"><Ph n="sparkle" size={14} /><Campo can={can} v={m.tematica} max={400} ph="Temáticas" onSave={v => salva('tematica', v)} /></span>
          </div>
        </div>
        <div className="pl-hero-grid">
          <div className="pl-bloco"><h3><Ph n="gift" size={16} />Produto e oferta</h3><Campo can={can} area v={m.oferta} max={2000} ph="Qual é a oferta, a mecânica e as travas" onSave={v => salva('oferta', v)} /></div>
          <div className="pl-bloco"><h3><Ph n="target" size={16} />Persona e foco</h3><Campo can={can} area v={m.persona} max={2000} ph="Para quem é e onde focar" onSave={v => salva('persona', v)} /></div>
          <div className="pl-bloco pl-estr"><h3><Ph n="tree-structure" size={16} />Estratégia do mês</h3><Campo can={can} area v={m.estrategia} max={4000} ph={can ? 'Por que essa campanha agora, como os núcleos se ligam e o que mede o sucesso' : 'Ainda sem explicação'} onSave={v => salva('estrategia', v)} /></div>
        </div>
        <div className="pl-num">
          <span><b>{acs.length}</b> ações</span>
          <span><b>{acs.length - livres.length}</b> no quadro</span>
          <span><b>{feitas}</b> feitas</span>
          <span className="grow" />
          {can && <button className="btn accent" disabled={!prontas.length || indo} onClick={() => run(tudo())} title={prontas.length ? 'Cria uma tarefa no quadro de cada responsável' : livres.length ? 'Escolha quem faz as ações' : 'Tudo já foi pro quadro'}>
            <Ph n="paper-plane-tilt" size={18} fill />{indo ? 'Mandando…' : prontas.length ? `Mandar ${prontas.length} pro quadro` : 'Nada pra mandar'}</button>}
        </div>
      </section>

      {!!dts.length && <section className="pl-dts">
        <h3><Ph n="calendar-dots" size={16} />Datas do mês</h3>
        <div className="pl-dts-l">{dts.map(a => <button key={a.id} className="pl-dt" onClick={() => onAcao(a)}><b>{a.dia || '—'}</b><span>{a.texto}</span></button>)}</div>
      </section>}

      <div className="pl-grupos">
        {nucleos.filter(n => n.tipo === 'acoes').map(n => {
          const xs = acs.filter(a => a.nucleo === n.id)
          if (!xs.length && (!can || acoes.some(a => a.nucleo === n.id))) return null
          return (
            <section key={n.id} className="pl-grupo">
              <header><h3>{n.nome}</h3><small className="muted">{xs.length || ''}</small>{can && <button className="icon-btn" onClick={() => onNova(n.id)} aria-label={`Nova ação em ${n.nome}`}><Ph n="plus" size={16} /></button>}</header>
              {xs.map(a => <Linha key={a.id} a={a} ctx={ctx} tasks={tasks} can={can} onOpen={() => onAcao(a)} />)}
            </section>
          )
        })}
      </div>
    </div>
  )
}

function Linha({ a, ctx, tasks, can, onOpen }: { a: PlanoAcao; ctx: Parameters<typeof mandar>[1]; tasks: Record<string, Task>; can: boolean; onOpen: () => void }) {
  const [indo, setIndo] = useState(false)
  const { pessoas, dept } = quem(a, ctx.resp, ctx.profiles)
  const sit = situacao(a, tasks)
  return (
    <div className={'pl-linha s-' + sit}>
      <button className="pl-l-main" onClick={onOpen}>
        <span className="pl-dia">{a.dia || '—'}</span>
        <span className="pl-l-tx">{a.texto}{a.estrategia && <small><Ph n="tree-structure" size={12} />{a.estrategia}</small>}</span>
      </button>
      <span className="pl-l-side">
        {a.resp && <em className="pl-sig">{a.resp}</em>}
        {dept && <span className="pl-sala">{deptName(dept)}</span>}
        <span className="faces">{pessoas.slice(0, 3).map(id => <MiniAvatar key={id} avatar={ctx.profiles[id]?.avatar ?? null} photo={ctx.profiles[id]?.photo ?? null} name={ctx.profiles[id]?.name} size={26} />)}</span>
        {sit !== 'livre' ? <span className={'pl-st s-' + sit}><Ph n={sit === 'feita' ? 'check-circle' : 'kanban'} size={14} fill={sit === 'feita'} />{SIT[sit]}</span>
          : can && <button className="btn soft sm" disabled={!pessoas.length || indo} title={pessoas.length ? 'Cria a tarefa no quadro da sala' : 'Escolha quem faz'} onClick={() => { setIndo(true); run(mandar(a, ctx).finally(() => setIndo(false))) }}>
            <Ph n="paper-plane-tilt" size={15} />{pessoas.length ? 'Quadro' : 'Sem quem faça'}</button>}
      </span>
    </div>
  )
}

/** texto editável no lugar: salva ao sair do campo */
function Campo({ can, v, max, ph, onSave, area, cls = '' }: { can: boolean; v: string; max: number; ph: string; onSave: (v: string) => void; area?: boolean; cls?: string }) {
  if (!can) return v ? <span className={'pl-campo ' + cls}>{v}</span> : <span className={'pl-campo vazio ' + cls}>{ph}</span>
  const done = (e: { currentTarget: HTMLInputElement | HTMLTextAreaElement }) => onSave(e.currentTarget.value.trim())
  return area
    ? <textarea key={v} className={'pl-campo ' + cls} defaultValue={v} maxLength={max} placeholder={ph} rows={3} onBlur={done} aria-label={ph}
        onInput={e => { const t = e.currentTarget; t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px' }} ref={t => { if (t) { t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px' } }} />
    : <input key={v} className={'pl-campo ' + cls} defaultValue={v} maxLength={max} placeholder={ph} onBlur={done} onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()} aria-label={ph} />
}

/* ---------------- modais ---------------- */
function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="modal-bg" onMouseDown={e => e.target === e.currentTarget && onClose()} onKeyDown={e => e.key === 'Escape' && onClose()}>
      <div className={'modal pl-modal' + (wide ? ' wide' : '')} role="dialog" aria-label={title}>
        <header className="pl-mh"><h2>{title}</h2><button className="icon-btn" onClick={onClose} aria-label="Fechar"><Ph n="x" size={18} /></button></header>
        {children}
      </div>
    </div>
  )
}

function Pessoas({ sel, sala, onChange }: { sel: string[]; sala: string | null; onChange: (ids: string[]) => void }) {
  const profiles = useStore(s => s.profiles)
  const [todas, setTodas] = useState(false)
  const lista = Object.values(profiles).filter(p => todas || !sala || deptOf(p) === sala || sel.includes(p.id)).sort((a, b) => Number(sel.includes(b.id)) - Number(sel.includes(a.id)) || a.name.localeCompare(b.name))
  return (
    <div className="pl-pess">
      {lista.map(p => <button type="button" key={p.id} className={sel.includes(p.id) ? 'on' : ''} onClick={() => onChange(sel.includes(p.id) ? sel.filter(x => x !== p.id) : [...sel, p.id])}>
        <MiniAvatar avatar={p.avatar} photo={p.photo} name={p.name} size={24} />{p.name.split(' ')[0]}{sel[0] === p.id && sel.length > 1 && <small>dono</small>}</button>)}
      {sala && !todas && <button type="button" className="pl-mais" onClick={() => setTodas(true)}>Outras salas…</button>}
      {!lista.length && <small className="muted">Ninguém nessa sala ainda.</small>}
    </div>
  )
}

function AcaoModal({ a, base, ciclo, meses, nucleos, can, ctx, tasks, onClose }: {
  a: PlanoAcao | null; base: { nucleo: string; mes: string } | null; ciclo: string; meses: PlanoMes[]; nucleos: PlanoNucleo[]; can: boolean
  ctx: Parameters<typeof mandar>[1]; tasks: Record<string, Task>; onClose: () => void
}) {
  const depts = deptList()
  const [f, setF] = useState<PlanoAcao>(() => a ?? {
    id: crypto.randomUUID(), ciclo, nucleo: base?.nucleo ?? nucleos[0]?.id ?? '', pos: Date.now() % 1e6, mes: base?.mes ?? meses[0]?.mes ?? '',
    dia: '', resp: '', texto: '', estrategia: '', dept: null, pessoas: [], tarefas: [], created_by: me()?.id ?? null, created_at: new Date().toISOString(),
  })
  const [indo, setIndo] = useState(false)
  const datas = ctx.nucleos[f.nucleo]?.tipo === 'datas'
  const auto = quem({ ...f, pessoas: [], dept: null }, ctx.resp, ctx.profiles)
  const ef = quem(f, ctx.resp, ctx.profiles)
  const up = (p: Partial<PlanoAcao>) => setF(x => ({ ...x, ...p }))
  const ok = f.texto.trim() && f.nucleo && f.mes
  const salvar = async () => { if (ok) await putRow('plano_acoes', { ...f, texto: f.texto.trim(), dia: f.dia.trim(), resp: f.resp.trim().toUpperCase(), estrategia: f.estrategia.trim() }) }
  const { start, due } = parseDia(f.dia, f.mes || meses[0]?.mes || hoje())
  const fmt = (d: string) => d.slice(8, 10) + '/' + d.slice(5, 7)
  const ro = !can
  return (
    <Modal title={a ? (datas ? 'Data' : 'Ação') : 'Nova ação'} onClose={onClose} wide>
      <form className="pl-form" onSubmit={e => { e.preventDefault(); if (!ro) run(salvar().then(onClose)) }}>
        <label className="pl-full"><span>{datas ? 'Data comemorativa' : 'O que fazer'}</span>
          <textarea value={f.texto} onChange={e => up({ texto: e.target.value })} maxLength={1000} rows={3} readOnly={ro} required autoFocus={!a} /></label>
        <label><span>Núcleo</span><select value={f.nucleo} onChange={e => up({ nucleo: e.target.value })} disabled={ro}>{nucleos.map(n => <option key={n.id} value={n.id}>{n.nome}</option>)}</select></label>
        <label><span>Mês</span><select value={f.mes} onChange={e => up({ mes: e.target.value })} disabled={ro}>{meses.map(m => <option key={m.mes} value={m.mes}>{nomeMes(m.mes)}</option>)}</select></label>
        <label><span>Dia <small className="muted">{f.dia ? (start === due ? fmt(start) : `${fmt(start)} → ${fmt(due)}`) : 'mês todo'}</small></span>
          <input value={f.dia} onChange={e => up({ dia: e.target.value })} maxLength={40} placeholder="10, 1-10, 1ª SEG, última SEX…" readOnly={ro} /></label>
        {!datas && <label><span>Sigla (RESP.)</span><input value={f.resp} onChange={e => up({ resp: e.target.value })} maxLength={60} placeholder="MKT, DES/VID…" readOnly={ro} />
          {f.resp && <small className="muted">{siglas(f.resp).map(s => ctx.resp[s]?.nome || s).join(' · ')}</small>}</label>}
        {!datas && <>
          <label className="pl-full"><span>Estratégia da ação</span>
            <textarea value={f.estrategia} onChange={e => up({ estrategia: e.target.value })} maxLength={4000} rows={2} readOnly={ro} placeholder={ro ? '' : 'Por que essa ação, o que ela precisa entregar e como se liga à campanha'} /></label>
          <label className="pl-full"><span>Sala que executa</span>
            <select value={f.dept ?? ''} onChange={e => up({ dept: e.target.value || null })} disabled={ro}>
              <option value="">{auto.dept ? `Automático: ${deptName(auto.dept)}` : 'Automático (pela sigla)'}</option>
              {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select></label>
          <div className="pl-full"><span className="pl-lab">Quem faz {!f.pessoas.length && auto.pessoas.length > 0 && <small className="muted">· pela sigla: {auto.pessoas.map(id => ctx.profiles[id]?.name.split(' ')[0]).join(', ')}</small>}</span>
            {ro ? <div className="faces">{ef.pessoas.map(id => <MiniAvatar key={id} avatar={ctx.profiles[id]?.avatar ?? null} photo={ctx.profiles[id]?.photo ?? null} name={ctx.profiles[id]?.name} size={28} />)}</div>
              : <Pessoas sel={f.pessoas} sala={ef.dept} onChange={ids => up({ pessoas: ids })} />}
          </div>
          {!!f.tarefas.length && <div className="pl-full pl-tasks"><span className="pl-lab">No quadro</span>
            {f.tarefas.map(id => {
              const t = tasks[id]
              return t ? <button type="button" key={id} className="pl-task" onClick={() => setUi({ task: id })}><Ph n={t.status === 'done' ? 'check-circle' : 'kanban'} size={16} fill={t.status === 'done'} />{t.title}<small>{ctx.profiles[t.owner_id]?.name.split(' ')[0]}</small></button>
                : <span key={id} className="pl-task off"><Ph n="kanban" size={16} />Tarefa no quadro de outra sala</span>
            })}</div>}
        </>}
        {!ro && <footer className="pl-full pl-foot">
          {a && <button type="button" className="btn ghost danger" onClick={() => { if (confirm('Apagar esta ação do plano? As tarefas já criadas continuam no quadro.')) { run(dropRow('plano_acoes', a.id)); onClose() } }}><Ph n="trash" size={16} />Apagar</button>}
          <span className="grow" />
          {!datas && <button type="button" className="btn soft" disabled={!ok || !ef.pessoas.length || indo} title={ef.pessoas.length ? 'Salva e cria a tarefa no quadro da sala' : 'Escolha quem faz'}
            onClick={() => { setIndo(true); run(salvar().then(() => mandar({ ...f, texto: f.texto.trim() }, ctx)).then(onClose).finally(() => setIndo(false))) }}>
            <Ph n="paper-plane-tilt" size={16} />{f.tarefas.length ? 'Mandar de novo' : 'Mandar pro quadro'}</button>}
          <button className="btn accent" disabled={!ok}>Salvar</button>
        </footer>}
      </form>
    </Modal>
  )
}

function NucleoModal({ n, ciclo, pos, onClose }: { n: PlanoNucleo | null; ciclo: string; pos: number; onClose: () => void }) {
  const [nome, setNome] = useState(n?.nome ?? '')
  const [tipo, setTipo] = useState<PlanoNucleo['tipo']>(n?.tipo ?? 'acoes')
  const save = () => putRow('plano_nucleos', n ? { ...n, nome: nome.trim(), tipo } : { id: `${ciclo}:${crypto.randomUUID().slice(0, 8)}`, ciclo, nome: nome.trim(), pos, tipo, created_at: new Date().toISOString() })
  return (
    <Modal title={n ? 'Núcleo' : 'Novo núcleo'} onClose={onClose}>
      <form className="pl-form one" onSubmit={e => { e.preventDefault(); if (nome.trim()) run(save().then(onClose)) }}>
        <label><span>Nome</span><input value={nome} onChange={e => setNome(e.target.value)} maxLength={120} placeholder="Ex.: Instagram e conteúdo" autoFocus required /></label>
        <label><span>Tipo</span><select value={tipo} onChange={e => setTipo(e.target.value as PlanoNucleo['tipo'])}><option value="acoes">Ações (viram tarefas)</option><option value="datas">Datas comemorativas</option></select></label>
        <footer className="pl-foot">
          {n && <button type="button" className="btn ghost danger" onClick={() => { if (confirm(`Apagar o núcleo “${n.nome}” e as ações dele? As tarefas já criadas continuam.`)) { run(dropRow('plano_nucleos', n.id)); onClose() } }}><Ph n="trash" size={16} />Apagar</button>}
          <span className="grow" /><button className="btn accent" disabled={!nome.trim()}>Salvar</button>
        </footer>
      </form>
    </Modal>
  )
}

/** legenda de siglas → sala e pessoas que recebem as tarefas */
function RespModal({ acoes, onClose }: { acoes: PlanoAcao[]; onClose: () => void }) {
  const resp = useStore(s => s.rows.plano_resp)
  const depts = deptList()
  const usadas = [...new Set(acoes.flatMap(a => resp[a.resp] ? [a.resp] : siglas(a.resp)))].filter(s => s && s.length <= 12)
  const ids = [...new Set([...Object.keys(resp), ...usadas])].sort()
  const [open, setOpen] = useState<string | null>(null)
  const cur = (id: string): PlanoResp => resp[id] ?? { id, nome: '', dept: null, pessoas: [], created_at: new Date().toISOString() }
  const save = (r: PlanoResp) => run(putRow('plano_resp', r))
  return (
    <Modal title="Responsáveis" onClose={onClose} wide>
      <small className="muted">Cada sigla da coluna RESP. aponta para uma sala e as pessoas que recebem a tarefa. A primeira pessoa é a dona; as outras entram como colaboradoras.</small>
      <div className="pl-resp">
        {ids.map(id => {
          const r = cur(id)
          const n = acoes.filter(a => a.resp === id || siglas(a.resp).includes(id)).length
          return (
            <div key={id} className={'pl-r' + (open === id ? ' on' : '')}>
              <div className="pl-r-top">
                <b className="pl-sig">{id}</b>
                <input key={r.nome} defaultValue={r.nome} maxLength={80} placeholder="Quem é" onBlur={e => e.target.value.trim() !== r.nome && save({ ...r, nome: e.target.value.trim() })} aria-label={`Nome de ${id}`} />
                <select value={r.dept ?? ''} onChange={e => save({ ...r, dept: e.target.value || null })} aria-label={`Sala de ${id}`}>
                  <option value="">Sala…</option>{depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <button type="button" className={'pl-r-pp' + (r.pessoas.length ? ' tem' : '')} onClick={() => setOpen(open === id ? null : id)}>
                  <Ph n="users-three" size={15} />{r.pessoas.length || 'Pessoas'}</button>
                <small className="muted">{n} ações</small>
              </div>
              {open === id && <Pessoas sel={r.pessoas} sala={r.dept} onChange={ids => save({ ...r, pessoas: ids })} />}
            </div>
          )
        })}
      </div>
    </Modal>
  )
}

/** confere a planilha antes de gravar */
function Previa({ p, onClose, onDone }: { p: Importado; onClose: () => void; onDone: (ciclo: string) => void }) {
  const rows = useStore(s => s.rows)
  const [indo, setIndo] = useState(false)
  const novos = new Set(p.acoes.map(a => a.id)), nucs = new Set(p.nucleos.map(n => n.id))
  const velhas = Object.values(rows.plano_acoes).filter(a => a.ciclo === p.ciclo && !novos.has(a.id) && !a.tarefas.length && rows.plano_nucleos[a.nucleo] && /^\d{4}-\d{2}:n\d+$/.test(a.nucleo))
  const ligadas = p.acoes.filter(a => a.tarefas.length).length
  const go = async () => {
    setIndo(true)
    try {
      await putRows('plano_nucleos', p.nucleos)
      await putRows('plano_meses', p.meses)
      await putRows('plano_acoes', p.acoes)
      await putRows('plano_resp', p.resp)
      for (const a of velhas) await dropRow('plano_acoes', a.id)
      for (const n of Object.values(rows.plano_nucleos)) if (n.ciclo === p.ciclo && !nucs.has(n.id) && /:n\d+$/.test(n.id) && !Object.values(rows.plano_acoes).some(a => a.nucleo === n.id && a.tarefas.length)) await dropRow('plano_nucleos', n.id)
      onDone(p.ciclo)
    } finally { setIndo(false) }
  }
  const camp = p.meses.filter(m => m.campanha)
  return (
    <Modal title="Importar plano" onClose={onClose}>
      <div className="pl-prev">
        <div className="pl-num">
          <span><b>{p.meses.length}</b> meses</span><span><b>{p.nucleos.length}</b> núcleos</span><span><b>{p.acoes.length}</b> ações</span><span><b>{p.resp.length}</b> siglas</span>
        </div>
        <small className="muted">Ciclo de {nomeMes(p.meses[0].mes)} a {nomeMes(p.meses[p.meses.length - 1].mes)}.</small>
        {!!camp.length && <ul className="pl-prev-l">{camp.slice(0, 4).map(m => <li key={m.mes}><b>{nomeMes(m.mes, true)}</b>{m.campanha}</li>)}{camp.length > 4 && <li className="muted">e mais {camp.length - 4}…</li>}</ul>}
        {(ligadas > 0 || velhas.length > 0) && <small className="muted">{ligadas > 0 && `${ligadas} ação(ões) já mandadas pro quadro continuam ligadas às tarefas. `}{velhas.length > 0 && `${velhas.length} ação(ões) que saíram da planilha serão tiradas do plano.`}</small>}
        <small className="muted">O conteúdo fica guardado só no Turmeo da empresa. Quem faz e a estratégia que já foram escritas aqui são mantidos.</small>
      </div>
      <footer className="pl-foot"><span className="grow" /><button className="btn ghost" onClick={onClose}>Cancelar</button>
        <button className="btn accent" disabled={indo} onClick={() => run(go())}><Ph n="upload-simple" size={16} />{indo ? 'Gravando…' : 'Gravar plano'}</button></footer>
    </Modal>
  )
}
