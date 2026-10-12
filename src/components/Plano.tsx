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
import { confirmar } from './Dialogo'

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

/** coluna/linha da ação: a sigla inteira se ela está na legenda; senão a primeira; '' = sem responsável */
const chave = (a: PlanoAcao, resp: Record<string, PlanoResp>) => { const k = a.resp.trim().toUpperCase(); return resp[k] ? k : siglas(k)[0] ?? '' }
const CORES = ['#2440FF', '#E8620C', '#1F9D55', '#C2189B', '#0E8FA8', '#7B4DFF', '#B88A00', '#D93A3F']
/** cor fixa por sigla (a primeira), igual em toda a tela */
const corSig = (s: string) => { let h = 0; for (const c of siglas(s)[0] ?? s) h = (h * 31 + c.charCodeAt(0)) | 0; return s ? CORES[Math.abs(h) % CORES.length] : '#A39C8E' }
const novoResp = (id: string): PlanoResp => ({ id, nome: '', dept: null, pessoas: [], created_at: new Date().toISOString() })
type Agr = 'resp' | 'nucleo'
const AGR = 'pl-agrupa'
const lerAgr = (): Agr => { try { return localStorage.getItem(AGR) === 'nucleo' ? 'nucleo' : 'resp' } catch { return 'resp' } }

function Sig({ s, big }: { s: string; big?: boolean }) {
  return <em className={'pl-sig' + (big ? ' big' : '')} style={{ ['--sc' as string]: corSig(s) }}>{s}</em>
}
function Rostos({ ids, profiles, size = 24, max = 4 }: { ids: string[]; profiles: Record<string, Profile>; size?: number; max?: number }) {
  return <span className="faces">{ids.slice(0, max).map(id => <MiniAvatar key={id} avatar={profiles[id]?.avatar ?? null} photo={profiles[id]?.photo ?? null} name={profiles[id]?.name} size={size} />)}{ids.length > max && <i className="pl-mais-n">+{ids.length - max}</i>}</span>
}

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
  const [novo, setNovo] = useState<Base | null>(null)
  const [nuc, setNuc] = useState<PlanoNucleo | 'novo' | null>(null)
  const [respOpen, setRespOpen] = useState<string | boolean>(false)
  const [agr, setAgr] = useState<Agr>(lerAgr)
  const agrupa = (v: Agr) => { setAgr(v); try { localStorage.setItem(AGR, v) } catch { /* sem storage */ } }
  const [rf, setRf] = useState('')
  const [prev, setPrev] = useState<Importado | null>(null)
  const [lendo, setLendo] = useState(false)
  const file = useRef<HTMLInputElement>(null)
  const ctx = { resp: rows.plano_resp, profiles, meses: rows.plano_meses, nucleos: rows.plano_nucleos }

  const ehData = (a: PlanoAcao) => rows.plano_nucleos[a.nucleo]?.tipo === 'datas'
  const chaves = useMemo(() => [...new Set(acoes.filter(a => rows.plano_nucleos[a.nucleo]?.tipo !== 'datas').map(a => chave(a, rows.plano_resp)))].sort((a, b) => a === '' ? -1 : b === '' ? 1 : a.localeCompare(b)), [acoes, rows.plano_nucleos, rows.plano_resp])
  const passa = (a: PlanoAcao) => {
    if (q && !norm(`${a.texto} ${a.resp} ${a.dia}`).includes(norm(q))) return false
    if (ehData(a)) return true
    const qq = (sala || rf === '@eu') ? quem(a, rows.plano_resp, profiles) : null
    if (sala && qq?.dept !== sala) return false
    if (rf === '@eu') return !!meP && !!qq?.pessoas.includes(meP.id)
    if (rf && chave(a, rows.plano_resp) !== rf && !siglas(a.resp).includes(rf)) return false
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
        <div className="seg pl-agr" role="tablist" aria-label="Organizar por">
          <SegInd />
          <button className={agr === 'resp' ? 'on' : ''} onClick={() => agrupa('resp')} title="Uma coluna para cada responsável"><Ph n="users-three" size={18} fill={agr === 'resp'} />Por quem faz</button>
          <button className={agr === 'nucleo' ? 'on' : ''} onClick={() => agrupa('nucleo')} title="Agrupado pelos núcleos da planilha"><Ph n="tree-structure" size={18} fill={agr === 'nucleo'} />Por núcleo</button>
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
        <label className={'qchip' + (rf ? ' on' : '')}><Ph n="user-circle" size={15} />
          <select value={rf} onChange={e => setRf(e.target.value)} aria-label="Filtrar por responsável">
            <option value="">Todos os responsáveis</option>
            {meP && <option value="@eu">Só as minhas</option>}
            {chaves.map(k => <option key={k} value={k}>{k ? `${k}${rows.plano_resp[k]?.nome ? ' · ' + rows.plano_resp[k].nome : ''}` : 'Sem responsável'}</option>)}
          </select>
        </label>
        <label className="qchip pl-busca"><Ph n="magnifying-glass" size={15} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar ação" aria-label="Buscar ação" /></label>
        <span className="grow" />
        {can && <button className="btn soft" onClick={() => setRespOpen(true)} title="Quem é cada sigla (MKT, DES…) e quem recebe as tarefas"><Ph n="list-bullets" size={18} />Legenda</button>}
        {can && <button className="btn soft" disabled={lendo} onClick={() => file.current?.click()} title="Atualiza o plano com uma nova versão da planilha"><Ph n="upload-simple" size={18} />{lendo ? 'Lendo…' : 'Importar'}</button>}
        {input}
        <Bell />
      </div>

      {modo === 'matriz'
        ? <Matriz meses={meses} nucleos={nucleos} acoes={acoes} passa={passa} can={can} mesAtual={hoje()} agr={agr} chaves={chaves} ctx={ctx}
            onMes={m => { setMes(m); setModo('mes') }} onAcao={setEdit} onNova={b => { setNovo(b); setEdit('novo') }} onNucleo={setNuc} onResp={k => setRespOpen(k || true)} />
        : <Mes m={meses.find(x => x.mes === mm)} meses={meses} nucleos={nucleos} acoes={acoes.filter(a => a.mes === mm)} passa={passa} can={can} ctx={ctx} tasks={tasks} agr={agr}
            onMes={setMes} onAcao={setEdit} onNova={(n, resp) => { setNovo({ nucleo: n, mes: mm, resp }); setEdit('novo') }} />}

      {edit && <AcaoModal a={edit === 'novo' ? null : rows.plano_acoes[edit.id] ?? edit} base={novo} ciclo={cc} meses={meses} nucleos={nucleos} can={can} ctx={ctx} tasks={tasks}
        onClose={() => { setEdit(null); setNovo(null) }} />}
      {nuc && <NucleoModal n={nuc === 'novo' ? null : nuc} ciclo={cc} pos={nucleos.length} onClose={() => setNuc(null)} />}
      {respOpen && <RespModal acoes={acoes} foco={typeof respOpen === 'string' ? respOpen : null} onClose={() => setRespOpen(false)} />}
      {prev && <Previa p={prev} onClose={() => setPrev(null)} onDone={c => { setCiclo(c); setPrev(null) }} />}
    </div>
  )
}

/* ---------------- Ano: núcleos × meses ---------------- */
type Base = { nucleo: string; mes: string; resp?: string }
function Matriz({ meses, nucleos, acoes, passa, can, mesAtual, agr, chaves, ctx, onMes, onAcao, onNova, onNucleo, onResp }: {
  meses: PlanoMes[]; nucleos: PlanoNucleo[]; acoes: PlanoAcao[]; passa: (a: PlanoAcao) => boolean; can: boolean; mesAtual: string; agr: Agr; chaves: string[]
  ctx: Parameters<typeof mandar>[1]; onMes: (m: string) => void; onAcao: (a: PlanoAcao) => void; onNova: (b: Base) => void; onNucleo: (n: PlanoNucleo | 'novo') => void; onResp: (k: string) => void
}) {
  const tasks = useStore(s => s.tasks)
  const por = useMemo(() => {
    const o: Record<string, PlanoAcao[]> = {}
    for (const a of acoes) (o[a.nucleo + '|' + a.mes] ??= []).push(a)
    return o
  }, [acoes])
  const porResp = useMemo(() => {
    const o: Record<string, PlanoAcao[]> = {}
    for (const a of acoes) if (ctx.nucleos[a.nucleo]?.tipo !== 'datas') (o[chave(a, ctx.resp) + '|' + a.mes] ??= []).push(a)
    return o
  }, [acoes, ctx.nucleos, ctx.resp])
  const primeiro = nucleos.find(n => n.tipo === 'acoes')?.id ?? nucleos[0]?.id ?? ''
  const linhas = agr === 'resp' ? chaves.filter(k => meses.some(m => (porResp[k + '|' + m.mes] ?? []).some(passa))) : []
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
            <th className="pl-corner">{agr === 'resp' ? 'Quem faz' : 'Núcleo'}</th>
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
          {nucleos.filter(n => agr === 'nucleo' || n.tipo === 'datas').map(n => (
            <tr key={n.id} className={n.tipo === 'datas' ? 'pl-datas' : ''}>
              <th>{can ? <button className="pl-nuc" onClick={() => onNucleo(n)} title="Renomear ou apagar">{n.nome}</button> : <span className="pl-nuc">{n.nome}</span>}</th>
              {meses.map(m => {
                const xs = (por[n.id + '|' + m.mes] ?? []).filter(passa)
                return <td key={m.mes} className={m.mes === mesAtual ? 'agora' : ''}>
                  <div className="pl-cel">
                    {xs.map(a => <Chip key={a.id} a={a} datas={n.tipo === 'datas'} sit={situacao(a, tasks)} onClick={() => onAcao(a)} />)}
                    {can && <button className="pl-add" onClick={() => onNova({ nucleo: n.id, mes: m.mes })} aria-label={`Nova ação em ${n.nome}, ${nomeMes(m.mes)}`}><Ph n="plus" size={14} /></button>}
                  </div>
                </td>
              })}
            </tr>
          ))}
          {linhas.map(k => {
            const r = ctx.resp[k], eq = (r?.pessoas ?? []).filter(id => ctx.profiles[id])
            return (
              <tr key={'r:' + k} className="pl-rrow" style={{ ['--sc' as string]: corSig(k) }}>
                <th><button className="pl-quem" onClick={() => onResp(k)} disabled={!can} title={can ? 'Quem recebe as tarefas desta sigla' : undefined}>
                  {k ? <Sig s={k} /> : <span className="pl-sig sem"><Ph n="user-circle" size={14} /></span>}
                  <span className="pl-quem-nm"><b>{k ? r?.nome || k : 'Sem responsável'}</b>{k && <small>{r?.dept ? deptName(r.dept) : eq.length ? '' : 'falta quem faça'}</small>}</span>
                  {eq.length > 0 && <Rostos ids={eq} profiles={ctx.profiles} size={20} max={3} />}
                </button></th>
                {meses.map(m => {
                  const xs = (porResp[k + '|' + m.mes] ?? []).filter(passa)
                  return <td key={m.mes} className={m.mes === mesAtual ? 'agora' : ''}>
                    <div className="pl-cel">
                      {xs.map(a => <Chip key={a.id} a={a} sit={situacao(a, tasks)} meta={ctx.nucleos[a.nucleo]?.nome} onClick={() => onAcao(a)} />)}
                      {can && <button className="pl-add" onClick={() => onNova({ nucleo: primeiro, mes: m.mes, resp: k })} aria-label={`Nova ação de ${k || 'sem responsável'}, ${nomeMes(m.mes)}`}><Ph n="plus" size={14} /></button>}
                    </div>
                  </td>
                })}
              </tr>
            )
          })}
          {can && agr === 'nucleo' && <tr className="pl-novo"><th><button className="btn ghost" onClick={() => onNucleo('novo')}><Ph n="plus" size={16} />Núcleo</button></th><td colSpan={meses.length} /></tr>}
        </tbody>
      </table>
    </div>
  )
}

function Chip({ a, datas, sit, meta, onClick }: { a: PlanoAcao; datas?: boolean; sit: Sit; meta?: string; onClick: () => void }) {
  return (
    <button className={'pl-chip' + (datas ? ' data' : ' s-' + sit)} onClick={onClick} title={`${a.dia ? a.dia + ' · ' : ''}${a.texto}${datas ? '' : '\n' + SIT[sit]}`}>
      {(a.dia || a.resp || meta) && <span className="pl-meta">{a.dia && <b>{a.dia}</b>}{meta ? <small>{meta}</small> : a.resp && <em style={{ color: corSig(a.resp) }}>{a.resp}</em>}</span>}
      <span className="pl-tx">{a.texto}</span>
    </button>
  )
}

/* ---------------- Mês: campanha + ações por núcleo ---------------- */
function Mes({ m, meses, nucleos, acoes, passa, can, ctx, tasks, agr, onMes, onAcao, onNova }: {
  m: PlanoMes | undefined; meses: PlanoMes[]; nucleos: PlanoNucleo[]; acoes: PlanoAcao[]; passa: (a: PlanoAcao) => boolean; can: boolean
  ctx: Parameters<typeof mandar>[1]; tasks: Record<string, Task>; agr: Agr; onMes: (m: string) => void; onAcao: (a: PlanoAcao) => void; onNova: (n: string, resp?: string) => void
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
    if (!await confirmar(`Mandar ${prontas.length} ${prontas.length === 1 ? 'ação' : 'ações'} de ${nomeMes(m.mes)} pro quadro?`, { text: `Cada uma vira tarefa no quadro de quem executa.${livres.length > prontas.length ? `\n${livres.length - prontas.length} ficam de fora porque ainda não têm quem faça.` : ''}`, ok: 'Mandar', ic: 'paper-plane-tilt' })) return
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

      {agr === 'resp' ? <Raias acs={acs} ctx={ctx} tasks={tasks} can={can} onAcao={onAcao} onNova={k => onNova(nucleos.find(n => n.tipo === 'acoes')?.id ?? nucleos[0]?.id ?? '', k)} /> : <div className="pl-grupos">
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
      </div>}
    </div>
  )
}

/* ---------------- Mês por responsável: uma coluna por sigla, arrasta pra trocar ---------------- */
function Raias({ acs, ctx, tasks, can, onAcao, onNova }: {
  acs: PlanoAcao[]; ctx: Parameters<typeof mandar>[1]; tasks: Record<string, Task>; can: boolean; onAcao: (a: PlanoAcao) => void; onNova: (resp: string) => void
}) {
  const [arr, setArr] = useState<string | null>(null)
  const [sobre, setSobre] = useState<string | null>(null)
  const grupos = new Map<string, PlanoAcao[]>()
  for (const a of acs) { const k = chave(a, ctx.resp); grupos.set(k, [...(grupos.get(k) ?? []), a]) }
  const ks = [...grupos.keys()].sort((a, b) => a === '' ? -1 : b === '' ? 1 : grupos.get(b)!.length - grupos.get(a)!.length || a.localeCompare(b))
  const solta = (k: string) => {
    const a = acs.find(x => x.id === arr)
    setArr(null); setSobre(null)
    if (a && chave(a, ctx.resp) !== k) run(putRow('plano_acoes', { ...a, resp: k, pessoas: [], dept: null }))
  }
  if (!ks.length) return <div className="panel pl-raias-vazio muted">Nenhuma ação neste mês{can ? ' — crie uma pelo Ano ou pelo botão abaixo.' : '.'}{can && <button className="btn soft" onClick={() => onNova('')}><Ph n="plus" size={16} />Nova ação</button>}</div>
  return (
    <div className={'pl-raias' + (arr ? ' arrastando' : '')}>
      {ks.map(k => <Raia key={k} k={k} xs={grupos.get(k)!} ctx={ctx} tasks={tasks} can={can} alvo={!!arr && sobre === k}
        onSobre={on => setSobre(on ? k : s => s === k ? null : s)} onSolta={() => solta(k)} onDrag={setArr} onAcao={onAcao} onNova={() => onNova(k)} />)}
    </div>
  )
}

function Raia({ k, xs, ctx, tasks, can, alvo, onSobre, onSolta, onDrag, onAcao, onNova }: {
  k: string; xs: PlanoAcao[]; ctx: Parameters<typeof mandar>[1]; tasks: Record<string, Task>; can: boolean; alvo: boolean
  onSobre: (on: boolean) => void; onSolta: () => void; onDrag: (id: string | null) => void; onAcao: (a: PlanoAcao) => void; onNova: () => void
}) {
  const [eq, setEq] = useState(false)
  const [indo, setIndo] = useState(false)
  const r = ctx.resp[k]
  const sits = xs.map(a => situacao(a, tasks))
  const noQ = sits.filter(s => s !== 'livre').length, feitas = sits.filter(s => s === 'feita').length
  const prontas = xs.filter((a, i) => sits[i] === 'livre' && quem(a, ctx.resp, ctx.profiles).pessoas.length)
  const equipe = (r?.pessoas ?? []).filter(id => ctx.profiles[id])
  const dept = r?.dept ?? (equipe[0] ? deptOf(ctx.profiles[equipe[0]]) : null)
  const nome = k ? r?.nome || k : 'Sem responsável'
  const manda = async () => {
    if (!await confirmar(`Mandar ${prontas.length} ${prontas.length === 1 ? 'ação' : 'ações'} de ${nome} pro quadro?`, { text: 'Cada uma vira tarefa no quadro de quem executa.', ok: 'Mandar', ic: 'paper-plane-tilt' })) return
    setIndo(true)
    try { for (const a of prontas) await mandar(a, ctx) } finally { setIndo(false) }
  }
  const pct = (n: number) => (xs.length ? n / xs.length * 100 : 0) + '%'
  return (
    <section className={'pl-raia' + (k ? '' : ' sem') + (alvo ? ' alvo' : '')} style={{ ['--sc' as string]: corSig(k) }} aria-label={nome}
      onDragOver={e => { if (e.dataTransfer.types.includes('text/plain')) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; onSobre(true) } }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) onSobre(false) }}
      onDrop={e => { e.preventDefault(); onSolta() }}>
      <header className="pl-rh">
        <div className="pl-rh-top">
          {k ? <Sig s={k} big /> : <span className="pl-sig big sem"><Ph n="user-circle" size={20} /></span>}
          <div className="pl-rh-nm"><b>{nome}</b><small>{k ? (dept ? deptName(dept) : 'Sem sala') : 'Arraste o cartão pra coluna de quem faz'}</small></div>
          {k && (equipe.length ? <Rostos ids={equipe} profiles={ctx.profiles} size={26} max={3} /> : <span className="pl-falta">ninguém recebe</span>)}
          {can && k && <button className={'icon-btn pl-rh-ed' + (eq ? ' on' : '')} onClick={() => setEq(!eq)} aria-expanded={eq} title="Nome, sala e quem recebe as tarefas" aria-label={`Editar equipe de ${k}`}><Ph n={eq ? 'x' : 'pencil-simple-line'} size={16} /></button>}
        </div>
        {eq && <Equipe r={r ?? novoResp(k)} />}
        <div className="pl-prog" role="img" aria-label={`${feitas} feitas, ${noQ} no quadro, de ${xs.length}`}><i className="q" style={{ width: pct(noQ) }} /><i className="f" style={{ width: pct(feitas) }} /></div>
        <div className="pl-rh-n">
          <span><b>{xs.length}</b>{xs.length === 1 ? 'ação' : 'ações'}</span><span><b>{noQ}</b>no quadro</span><span><b>{feitas}</b>{feitas === 1 ? 'feita' : 'feitas'}</span>
          {can && prontas.length > 0 && <button className="btn soft sm" disabled={indo} onClick={() => run(manda())} title="Cria uma tarefa no quadro para cada ação desta coluna"><Ph n="paper-plane-tilt" size={14} fill />{indo ? 'Mandando…' : `Mandar ${prontas.length}`}</button>}
        </div>
      </header>
      <div className="pl-rb">
        {xs.map((a, i) => <Cartao key={a.id} a={a} k={k} sit={sits[i]} ctx={ctx} can={can} onOpen={() => onAcao(a)} onDrag={onDrag} />)}
        {can && <button className="pl-r-add" onClick={onNova}><Ph n="plus" size={15} />Ação{k ? ` de ${k}` : ''}</button>}
      </div>
    </section>
  )
}

function Cartao({ a, k, sit, ctx, can, onOpen, onDrag }: { a: PlanoAcao; k: string; sit: Sit; ctx: Parameters<typeof mandar>[1]; can: boolean; onOpen: () => void; onDrag: (id: string | null) => void }) {
  const [indo, setIndo] = useState(false)
  const { pessoas } = quem(a, ctx.resp, ctx.profiles)
  const extra = a.resp.trim().toUpperCase() === k ? [] : siglas(a.resp).filter(s => s !== k)
  const solto = can && sit === 'livre'
  return (
    <article className={'pl-card s-' + sit + (solto ? ' solto' : '')} draggable={solto}
      onDragStart={e => { e.dataTransfer.setData('text/plain', a.id); e.dataTransfer.effectAllowed = 'move'; onDrag(a.id) }} onDragEnd={() => onDrag(null)}>
      <button className="pl-card-main" onClick={onOpen} title={a.texto}>
        <span className="pl-card-top">{a.dia && <b>{a.dia}</b>}<small>{ctx.nucleos[a.nucleo]?.nome}</small></span>
        <span className="pl-card-tx">{a.texto}</span>
      </button>
      <footer>
        {extra.map(s => <Sig key={s} s={s} />)}
        {pessoas.length > 0 && <Rostos ids={pessoas} profiles={ctx.profiles} size={22} max={3} />}
        <span className="grow" />
        {sit !== 'livre' ? <span className={'pl-st s-' + sit}><Ph n={sit === 'feita' ? 'check-circle' : 'kanban'} size={14} fill={sit === 'feita'} />{SIT[sit]}</span>
          : can && <button className="btn soft sm" disabled={!pessoas.length || indo} title={pessoas.length ? 'Cria a tarefa no quadro da sala' : 'Escolha quem faz'} onClick={() => { setIndo(true); run(mandar(a, ctx).finally(() => setIndo(false))) }}>
            <Ph n="paper-plane-tilt" size={14} />{pessoas.length ? 'Quadro' : 'Sem quem faça'}</button>}
      </footer>
    </article>
  )
}

/** nome, sala e pessoas de uma sigla — no cabeçalho da coluna e na legenda */
function Equipe({ r }: { r: PlanoResp }) {
  const depts = deptList()
  const save = (p: Partial<PlanoResp>) => run(putRow('plano_resp', { ...r, ...p }))
  return (
    <div className="pl-eq">
      <div className="pl-eq-l">
        <input key={r.nome} defaultValue={r.nome} maxLength={80} placeholder="Nome (ex.: Design)" onBlur={e => e.target.value.trim() !== r.nome && save({ nome: e.target.value.trim() })} onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()} aria-label={`Nome de ${r.id}`} />
        <select value={r.dept ?? ''} onChange={e => save({ dept: e.target.value || null })} aria-label={`Sala de ${r.id}`}>
          <option value="">Sala…</option>{depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>
      <span className="pl-lab">Quem recebe <small className="muted">· a primeira pessoa é a dona da tarefa</small></span>
      <Pessoas sel={r.pessoas} sala={r.dept} onChange={ids => save({ pessoas: ids })} />
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
        {a.resp && <Sig s={a.resp} />}
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
  a: PlanoAcao | null; base: Base | null; ciclo: string; meses: PlanoMes[]; nucleos: PlanoNucleo[]; can: boolean
  ctx: Parameters<typeof mandar>[1]; tasks: Record<string, Task>; onClose: () => void
}) {
  const depts = deptList()
  const [f, setF] = useState<PlanoAcao>(() => a ?? {
    id: crypto.randomUUID(), ciclo, nucleo: base?.nucleo ?? nucleos[0]?.id ?? '', pos: Date.now() % 1e6, mes: base?.mes ?? meses[0]?.mes ?? '',
    dia: '', resp: base?.resp ?? '', texto: '', estrategia: '', dept: null, pessoas: [], tarefas: [], created_by: me()?.id ?? null, created_at: new Date().toISOString(),
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
          {a && <button type="button" className="btn ghost danger" onClick={async () => { if (await confirmar('Apagar esta ação do plano?', { text: 'As tarefas já criadas continuam no quadro.', danger: true })) { run(dropRow('plano_acoes', a.id)); onClose() } }}><Ph n="trash" size={16} />Apagar</button>}
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
          {n && <button type="button" className="btn ghost danger" onClick={async () => { if (await confirmar(`Apagar o núcleo “${n.nome}”?`, { text: 'As ações dele saem do plano. As tarefas já criadas continuam.', danger: true })) { run(dropRow('plano_nucleos', n.id)); onClose() } }}><Ph n="trash" size={16} />Apagar</button>}
          <span className="grow" /><button className="btn accent" disabled={!nome.trim()}>Salvar</button>
        </footer>
      </form>
    </Modal>
  )
}

/** legenda de siglas → sala e pessoas que recebem as tarefas */
function RespModal({ acoes, foco, onClose }: { acoes: PlanoAcao[]; foco: string | null; onClose: () => void }) {
  const resp = useStore(s => s.rows.plano_resp)
  const profiles = useStore(s => s.profiles)
  const usadas = [...new Set(acoes.flatMap(a => resp[a.resp] ? [a.resp] : siglas(a.resp)))].filter(s => s && s.length <= 12)
  const ids = [...new Set([...Object.keys(resp), ...usadas])].sort()
  const [open, setOpen] = useState<string | null>(foco)
  return (
    <Modal title="Legenda de responsáveis" onClose={onClose} wide>
      <small className="muted">Cada sigla da coluna RESP. aponta para uma sala e para as pessoas que recebem a tarefa. Dá pra editar também direto na coluna, na visão do mês.</small>
      <div className="pl-resp">
        {ids.map(id => {
          const r = resp[id] ?? novoResp(id)
          const n = acoes.filter(a => a.resp === id || siglas(a.resp).includes(id)).length
          const eq = r.pessoas.filter(p => profiles[p])
          return (
            <div key={id} className={'pl-r' + (open === id ? ' on' : '')} style={{ ['--sc' as string]: corSig(id) }}>
              <button type="button" className="pl-r-top" onClick={() => setOpen(open === id ? null : id)} aria-expanded={open === id}>
                <Sig s={id} big />
                <span className="pl-rh-nm"><b>{r.nome || 'Sem nome'}</b><small>{r.dept ? deptName(r.dept) : 'Sem sala'} · {n} {n === 1 ? 'ação' : 'ações'}</small></span>
                {eq.length ? <Rostos ids={eq} profiles={profiles} size={24} max={3} /> : <span className="pl-falta">ninguém</span>}
                <Ph n="caret-right" size={16} />
              </button>
              {open === id && <Equipe r={r} />}
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
