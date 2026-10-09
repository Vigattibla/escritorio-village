import { useMemo, useState } from 'react'
import { dropRow, putRow, run, useStore } from '../store'
import type { Ajuste, Campanha, Premio, Quarto, Tier, Venda, VendasCfg } from '../types'
import { addDia, brl, CFG0, cobre, editaCampanha, hoje, livres, manda, mesDe, noites, placar, pontos, proxTier, tierOf, ve } from '../game/vendas'
import { deptOf } from '../game/ranks'
import { driveOn } from '../data/drive'
import { Bell } from './Avisos'
import { Ph } from './Icon'
import MiniAvatar from './MiniAvatar'
import SegInd from './SegInd'
import { FolderBox } from './DriveFolder'
import { first, monthKey } from './v4'

type Aba = 'quartos' | 'placar' | 'kit'
const CORES = ['#2440FF', '#FF7A1A', '#FF9ECF', '#FFE14D', '#2E9E6A', '#101014']
const diaCurto = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' }).replace('.', '')
const diaBr = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')
const mesNome = (m: string) => new Date(m + '-02T12:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).replace(' de ', ' ')
const addMes = (m: string, n: number) => { const [y, mm] = m.split('-').map(Number); return monthKey(new Date(y, mm - 1 + n, 1)) }
const now = () => new Date().toISOString()
/** texto escuro em cor clara (Prata, post-it), branco no resto */
const sobre = (c: string) => { const n = parseInt(c.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255)) > 170 ? '#101014' : '#fff' }

function Modal({ title, onClose, onSubmit, children, foot }: { title: string; onClose: () => void; onSubmit: () => void; children: React.ReactNode; foot?: React.ReactNode }) {
  return (
    <div className="modal-bg" onMouseDown={e => e.target === e.currentTarget && onClose()} onKeyDown={e => e.key === 'Escape' && onClose()}>
      <form className="modal vd-modal" onSubmit={e => { e.preventDefault(); onSubmit() }}>
        <h2>{title}</h2>
        {children}
        <footer className="row gap end">{foot}<span className="grow" /><button type="button" className="btn ghost" onClick={onClose}>Cancelar</button><button className="btn primary">Salvar</button></footer>
      </form>
    </div>
  )
}

export default function Vendas() {
  const s = useStore(x => x)
  const eu = s.meId ? s.profiles[s.meId] : undefined
  const pode = { manda: manda(eu, s), ve: ve(eu, s), edita: editaCampanha(eu, s) }
  const abas: [Aba, string][] = [['quartos', 'Quartos'], ...(pode.ve ? [['placar', 'Placar'] as [Aba, string]] : []), ['kit', 'Kit de vendas']]
  const [aba, setAba] = useState<Aba>(() => { try { const a = localStorage.getItem('ev:vendas:aba') as Aba; return abas.some(x => x[0] === a) ? a : 'quartos' } catch { return 'quartos' } })
  const ir = (a: Aba) => { setAba(a); try { localStorage.setItem('ev:vendas:aba', a) } catch { /* sem storage */ } }
  const [venda, setVenda] = useState<Partial<Venda> | null>(null)
  const quartos = Object.values(s.rows.quartos).filter(q => q.ativo).sort((a, b) => a.pos - b.pos || a.nome.localeCompare(b.nome))

  return (
    <div className="quadro metas vendas">
      <div className="qbar"><span className="grow" /><Bell />
        {pode.ve && quartos.length > 0 && <button className="btn accent" onClick={() => setVenda({})}><Ph n="plus" size={18} fill />Registrar venda</button>}
      </div>
      <div className="qhead"><div><h1>Vendas</h1><div className="sub">Quadro de quartos livres, placar do mês e o material de campanha pra mostrar pro cliente.</div></div></div>
      <div className="seg vd-seg"><SegInd />{abas.map(([k, l]) => <button key={k} className={aba === k ? 'on' : ''} onClick={() => ir(k)}>{l}</button>)}</div>
      {aba === 'quartos' && <Quartos quartos={quartos} pode={pode} onVenda={setVenda} />}
      {aba === 'placar' && pode.ve && <PlacarTab pode={pode} />}
      {aba === 'kit' && <Kit pode={pode} />}
      {venda && <VendaForm v={venda} quartos={quartos} podeOutro={pode.manda} onClose={() => setVenda(null)} />}
    </div>
  )
}

type Pode = { manda: boolean; ve: boolean; edita: boolean }

/* ---------------- quadro de quartos ---------------- */
function Quartos({ quartos, pode, onVenda }: { quartos: Quarto[]; pode: Pode; onVenda: (v: Partial<Venda>) => void }) {
  const vendas = useStore(s => s.rows.vendas)
  const ajustes = useStore(s => s.rows.ajustes)
  const meId = useStore(s => s.meId)
  const [ini, setIni] = useState(hoje)
  const [aj, setAj] = useState<{ q: Quarto; dia: string } | null>(null)
  const [tipos, setTipos] = useState(false)
  const vs = useMemo(() => Object.values(vendas), [vendas])
  const d0 = hoje()
  const dias = Array.from({ length: 14 }, (_, i) => addDia(ini, i))
  const livre = (q: Quarto, d: string) => livres(q, d, vs, ajustes[`${q.id}:${d}`])
  const nivel = (n: number, q: Quarto) => n === 0 ? ' zero' : n <= Math.max(1, Math.ceil(q.total * 0.25)) ? ' pouco' : ''
  const ajustar = (q: Quarto, d: string, n: number) => run(putRow('ajustes', { id: `${q.id}:${d}`, quarto_id: q.id, dia: d, livres: Math.max(0, Math.min(999, n)), created_by: meId, created_at: now() }))

  if (!quartos.length) return (
    <div className="panel empty-goal"><Ph n="bed" size={36} /><b>Nenhum tipo de quarto ainda</b>
      <small className="muted">{pode.manda ? 'Cadastre os tipos (Chalé, Suíte…) e quantos tem de cada.' : 'Quando a gerência do Comercial cadastrar os quartos, o quadro aparece aqui.'}</small>
      {pode.manda && <button className="btn primary" onClick={() => setTipos(true)}><Ph n="plus" size={16} />Cadastrar quartos</button>}
      {tipos && <TiposForm onClose={() => setTipos(false)} />}
    </div>
  )

  return <>
    <section className="vd-hoje">
      {quartos.map(q => {
        const n = livre(q, d0)
        return (
          <div key={q.id} className={'panel vd-qcard' + nivel(n, q)} style={{ '--qc': q.cor } as React.CSSProperties}>
            <div className="vd-qnome"><i />{q.nome}</div>
            <div className="vd-qnum"><b>{n}</b><small>de {q.total} livres hoje</small></div>
            {pode.ve && <div className="vd-qbtn">
              <button className="btn soft sm" onClick={() => ajustar(q, d0, n - 1)} disabled={n === 0} title="Saiu um quarto (tira 1 do quadro)" aria-label={`Tirar 1 ${q.nome}`}><Ph n="minus" size={16} /></button>
              <button className="btn soft sm" onClick={() => ajustar(q, d0, n + 1)} title="Voltou um quarto (põe 1 no quadro)" aria-label={`Pôr 1 ${q.nome}`}><Ph n="plus" size={16} /></button>
              <button className="btn accent sm" onClick={() => onVenda({ quarto_id: q.id, entrada: d0, saida: addDia(d0, 1) })}>Vendi</button>
            </div>}
          </div>
        )
      })}
    </section>

    <section className="panel vd-grade">
      <div className="vd-gbar">
        <b className="grow">Próximos 14 dias</b>
        <div className="mnav">
          <button onClick={() => setIni(addDia(ini, -7))} aria-label="Semana anterior"><Ph n="caret-left" size={18} /></button>
          <button className="mlabel" onClick={() => setIni(hoje())} title="Voltar para hoje">{diaBr(ini)} – {diaBr(dias[13])}</button>
          <button onClick={() => setIni(addDia(ini, 7))} aria-label="Próxima semana"><Ph n="caret-right" size={18} /></button>
        </div>
        {pode.manda && <button className="btn soft sm" onClick={() => setTipos(true)}><Ph n="pencil-simple-line" size={15} />Tipos de quarto</button>}
      </div>
      <div className="vd-gscroll">
        <table className="vd-tab">
          <thead><tr><th />{dias.map(d => <th key={d} className={d === d0 ? 'hj' : ''}>{diaCurto(d)}</th>)}</tr></thead>
          <tbody>{quartos.map(q => (
            <tr key={q.id}>
              <th><i style={{ background: q.cor }} />{q.nome}<small>{q.total}</small></th>
              {dias.map(d => {
                const n = livre(q, d), a = ajustes[`${q.id}:${d}`]
                return <td key={d}><button className={'vd-cel' + nivel(n, q) + (d === d0 ? ' hj' : '') + (a ? ' aj' : '')} disabled={!pode.ve} onClick={() => setAj({ q, dia: d })} title={`${q.nome} · ${diaBr(d)}: ${n} livre(s)${a ? ' · contagem ajustada à mão' : ''}`}>{n}</button></td>
              })}
            </tr>
          ))}</tbody>
        </table>
      </div>
      <div className="vd-leg"><span><i className="zero" />esgotado</span><span><i className="pouco" />últimos</span><span><i className="aj" />contado à mão</span>{pode.ve && <span className="muted">Clique num dia pra corrigir a contagem.</span>}</div>
    </section>
    {aj && <AjusteForm q={aj.q} dia={aj.dia} atual={livre(aj.q, aj.dia)} aj={ajustes[`${aj.q.id}:${aj.dia}`]} vendidos={vs.filter(v => v.quarto_id === aj.q.id && cobre(v, aj.dia)).reduce((n, v) => n + v.qtd, 0)} onClose={() => setAj(null)} />}
    {tipos && <TiposForm onClose={() => setTipos(false)} />}
  </>
}

function AjusteForm({ q, dia, atual, aj, vendidos, onClose }: { q: Quarto; dia: string; atual: number; aj?: Ajuste; vendidos: number; onClose: () => void }) {
  const meId = useStore(s => s.meId)
  const [n, setN] = useState(atual)
  const salvar = () => { if (n !== atual) run(putRow('ajustes', { id: `${q.id}:${dia}`, quarto_id: q.id, dia, livres: n, created_by: meId, created_at: now() })); onClose() }
  return (
    <Modal title={`${q.nome} · ${diaBr(dia)}`} onClose={onClose} onSubmit={salvar}
      foot={aj && <button type="button" className="btn ghost" onClick={() => { run(dropRow('ajustes', aj.id)); onClose() }} title="Apaga a contagem à mão e volta a calcular: total menos vendas">Voltar a contar pelas vendas</button>}>
      <div className="vd-step">
        <button type="button" className="btn soft" onClick={() => setN(Math.max(0, n - 1))} aria-label="Menos 1"><Ph n="minus" size={22} /></button>
        <div><b>{n}</b><small>livre(s)</small></div>
        <button type="button" className="btn soft" onClick={() => setN(Math.min(999, n + 1))} aria-label="Mais 1"><Ph n="plus" size={22} /></button>
      </div>
      <small className="muted">{q.total} no total · {vendidos} vendido(s) pelo sistema nesse dia.{aj ? ' Esse dia já foi contado à mão; vendas lançadas depois descontam dessa contagem.' : ' Salvar grava a contagem do dia; vendas lançadas depois descontam dela.'}</small>
    </Modal>
  )
}

function TiposForm({ onClose }: { onClose: () => void }) {
  const meId = useStore(s => s.meId)
  const rows = useStore(s => s.rows.quartos)
  const vendas = useStore(s => s.rows.vendas)
  const orig = Object.values(rows).sort((a, b) => a.pos - b.pos)
  const [lista, setLista] = useState<Quarto[]>(orig)
  const set = (i: number, p: Partial<Quarto>) => setLista(l => l.map((q, j) => j === i ? { ...q, ...p } : q))
  const usado = (id: string) => Object.values(vendas).some(v => v.quarto_id === id)
  const salvar = () => {
    lista.forEach((q, i) => {
      const r = { ...q, nome: q.nome.trim() || 'Quarto', pos: i }
      const o = rows[q.id]
      if (!o || JSON.stringify(o) !== JSON.stringify(r)) run(putRow('quartos', r))
    })
    for (const o of orig) if (!lista.some(q => q.id === o.id)) run(dropRow('quartos', o.id))
    onClose()
  }
  return (
    <Modal title="Tipos de quarto" onClose={onClose} onSubmit={salvar}>
      <div className="vd-tipos">
        {lista.map((q, i) => (
          <div key={q.id} className={'vd-tipo' + (q.ativo ? '' : ' off')}>
            <button type="button" className="vd-cor" style={{ background: q.cor }} onClick={() => set(i, { cor: CORES[(CORES.indexOf(q.cor) + 1) % CORES.length] })} title="Trocar a cor" aria-label="Trocar a cor" />
            <input className="grow" maxLength={40} value={q.nome} onChange={e => set(i, { nome: e.target.value })} placeholder="Ex.: Chalé" aria-label="Nome" />
            <input type="number" min={0} max={999} value={q.total} onChange={e => set(i, { total: Math.max(0, Math.min(999, Number(e.target.value) || 0)) })} aria-label="Quantos tem" title="Quantos tem" />
            {usado(q.id)
              ? <button type="button" className="icon-btn" onClick={() => set(i, { ativo: !q.ativo })} title={q.ativo ? 'Esconder do quadro (tem vendas, não dá pra apagar)' : 'Mostrar no quadro'}><Ph n="eye" size={16} fill={!q.ativo} /></button>
              : <button type="button" className="icon-btn" onClick={() => setLista(l => l.filter((_, j) => j !== i))} title="Tirar" aria-label="Tirar"><Ph n="trash" size={16} /></button>}
          </div>
        ))}
        <button type="button" className="btn soft sm" onClick={() => setLista(l => [...l, { id: crypto.randomUUID(), nome: '', total: 1, pos: l.length, cor: CORES[l.length % CORES.length], ativo: true, created_by: meId, created_at: now() }])}><Ph n="plus" size={15} />Tipo de quarto</button>
      </div>
      <small className="muted">O número é quantos quartos desse tipo existem. O quadro desconta as vendas sozinho.</small>
    </Modal>
  )
}

/* ---------------- registrar venda ---------------- */
function VendaForm({ v, quartos, podeOutro, onClose }: { v: Partial<Venda>; quartos: Quarto[]; podeOutro: boolean; onClose: () => void }) {
  const s = useStore(x => x)
  const meId = s.meId!
  const cfg = s.rows.vendas_cfg.cfg ?? CFG0
  const [quarto, setQuarto] = useState(v.quarto_id ?? quartos[0]?.id ?? '')
  const [entrada, setEntrada] = useState(v.entrada ?? hoje())
  const [saida, setSaida] = useState(v.saida ?? addDia(hoje(), 1))
  const [qtd, setQtd] = useState(String(v.qtd ?? 1))
  const [valor, setValor] = useState(v.valor ? String(v.valor) : '')
  const [quem, setQuem] = useState(v.user_id ?? meId)
  const [nota, setNota] = useState(v.nota ?? '')
  const [erro, setErro] = useState('')
  const q = quartos.find(x => x.id === quarto)
  const n = noites(entrada, saida), qt = Math.max(1, Math.min(99, Number(qtd) || 1))
  const val = Math.max(0, Number(valor.replace(/\./g, '').replace(',', '.')) || 0)
  const vs = Object.values(s.rows.vendas).filter(x => x.id !== v.id)
  const falta = q && n > 0 && n <= 60 ? Array.from({ length: n }, (_, i) => addDia(entrada, i)).find(d => livres(q, d, vs, s.rows.ajustes[`${q.id}:${d}`]) < qt) : undefined
  const pessoas = Object.values(s.profiles).filter(p => p.avatar && (p.id === meId || p.id === quem || s.rows.depts[deptOf(p)]?.vendas)).sort((a, b) => a.name.localeCompare(b.name))
  const salvar = () => {
    if (!q) return setErro('Escolha o quarto.')
    if (n < 1) return setErro('A saída tem que ser depois da entrada.')
    if (n > 60) return setErro('No máximo 60 noites por venda.')
    run(putRow('vendas', { id: v.id ?? crypto.randomUUID(), user_id: podeOutro ? quem : meId, quarto_id: q.id, entrada, saida, qtd: qt, valor: val, nota: nota.trim() || null, created_by: v.created_by ?? meId, created_at: v.created_at ?? now() }))
    onClose()
  }
  return (
    <Modal title={v.id ? 'Editar venda' : 'Registrar venda'} onClose={onClose} onSubmit={salvar}
      foot={v.id && <button type="button" className="btn ghost danger" onClick={() => { run(dropRow('vendas', v.id!)); onClose() }}>Apagar</button>}>
      <div className="opts">{quartos.map(x => <button type="button" key={x.id} className={'qchip' + (quarto === x.id ? ' on' : '')} onClick={() => setQuarto(x.id)}><i className="vd-dot" style={{ background: x.cor }} />{x.nome}</button>)}</div>
      <div className="row gap">
        <label className="grow">Entrada<input type="date" required value={entrada} onChange={e => { setEntrada(e.target.value); if (e.target.value >= saida) setSaida(addDia(e.target.value, 1)) }} /></label>
        <label className="grow">Saída<input type="date" required min={addDia(entrada, 1)} value={saida} onChange={e => setSaida(e.target.value)} /></label>
      </div>
      <div className="row gap">
        <label className="grow">Quartos<input type="number" min={1} max={99} required value={qtd} onChange={e => setQtd(e.target.value)} /></label>
        <label className="grow">Valor total (R$)<input inputMode="decimal" value={valor} onChange={e => setValor(e.target.value)} placeholder="0" /></label>
      </div>
      {podeOutro && <label>Quem vendeu<select value={quem} onChange={e => setQuem(e.target.value)}>{pessoas.map(p => <option key={p.id} value={p.id}>{p.id === meId ? `${p.name} (eu)` : p.name}</option>)}</select></label>}
      <label>Observação (opcional)<input maxLength={200} value={nota} onChange={e => setNota(e.target.value)} placeholder="Ex.: pacote feriado, veio do Instagram" /></label>
      <small className="muted">Sem nome, telefone ou documento do cliente: isso fica no sistema de reservas.</small>
      <div className="vd-prev">
        <span><b>{n > 0 ? n : 0}</b> noite(s)</span>
        <span><b>{brl(val)}</b></span>
        <span className="vd-pts"><Ph n="medal" size={15} fill /><b>+{pontos({ valor: val }, cfg)}</b> pontos</span>
      </div>
      {falta && <div className="vd-aviso"><Ph n="flag-banner" size={16} />Em {diaBr(falta)} o quadro mostra menos de {qt} {q?.nome} livre(s). Confira antes de fechar.</div>}
      {erro && <div className="vd-aviso">{erro}</div>}
    </Modal>
  )
}

/* ---------------- placar ---------------- */
function PlacarTab({ pode }: { pode: Pode }) {
  const s = useStore(x => x)
  const meId = s.meId!
  const cfg = s.rows.vendas_cfg.cfg ?? CFG0
  const [mes, setMes] = useState(monthKey)
  const [meta, setMeta] = useState<{ id: string; user: string | null; alvo: number } | null>(null)
  const [regras, setRegras] = useState(false)
  const [edit, setEdit] = useState<Venda | null>(null)
  const vendas = useMemo(() => Object.values(s.rows.vendas), [s.rows.vendas])
  const by = placar(vendas, mes, cfg)
  const zero = (id: string) => ({ id, pts: 0, valor: 0, n: 0 })
  const gente = Object.values(s.profiles).filter(p => p.avatar && (by[p.id] || s.rows.depts[deptOf(p)]?.vendas))
  const rank = gente.map(p => ({ p, ...(by[p.id] ?? zero(p.id)) })).sort((a, b) => b.pts - a.pts || b.valor - a.valor || a.p.name.localeCompare(b.p.name))
  const meu = by[meId] ?? zero(meId)
  const total = Object.values(by).reduce((n, r) => n + r.valor, 0)
  const mTime = s.rows.metas_venda[`${mes}:time`], mMeu = s.rows.metas_venda[`${mes}:${meId}`]
  const t = tierOf(meu.pts, cfg.tiers), prox = proxTier(meu.pts, cfg.tiers)
  const doMes = vendas.filter(v => mesDe(v.created_at) === mes).sort((a, b) => b.created_at.localeCompare(a.created_at))
  const quartos = s.rows.quartos
  const pct = (a: number, b: number) => b > 0 ? Math.min(100, Math.round(a / b * 100)) : 0
  const valorDe = (r: { pts: number; valor: number; n: number }, p: Premio) => p.regra === 'pontos' ? r.pts : p.regra === 'valor' ? r.valor : r.n
  const fmt = (p: Premio, x: number) => p.regra === 'valor' ? brl(x) : `${x} ${p.regra === 'pontos' ? 'pts' : 'vendas'}`
  const sou = s.rows.depts[deptOf(s.profiles[meId])]?.vendas

  return <>
    <div className="vd-mbar">
      <div className="mnav">
        <button onClick={() => setMes(addMes(mes, -1))} aria-label="Mês anterior"><Ph n="caret-left" size={18} /></button>
        <button className="mlabel" onClick={() => setMes(monthKey())}>{mesNome(mes)}</button>
        <button onClick={() => setMes(addMes(mes, 1))} aria-label="Próximo mês"><Ph n="caret-right" size={18} /></button>
      </div>
      <span className="grow" />
      {pode.manda && <button className="btn soft sm" onClick={() => setRegras(true)}><Ph n="gear-six" size={15} />Regras do placar</button>}
    </div>

    <div className="vd-top">
      <div className="panel vd-time">
        <div className="eyebrow">Meta do time</div>
        <div className="vd-big"><b>{brl(total)}</b>{mTime ? <small>de {brl(mTime.alvo)}</small> : <small>sem meta definida</small>}</div>
        {mTime && <div className="vd-bar"><i style={{ width: pct(total, mTime.alvo) + '%' }} /></div>}
        <div className="row gap"><small className="muted grow">{Object.values(by).reduce((n, r) => n + r.n, 0)} venda(s) no mês{mTime && total >= mTime.alvo ? ' · meta batida!' : ''}</small>
          {pode.manda && <button className="btn ghost sm" onClick={() => setMeta({ id: `${mes}:time`, user: null, alvo: mTime?.alvo ?? 0 })}>{mTime ? 'Mudar meta' : 'Definir meta'}</button>}</div>
      </div>
      {(sou || meu.n > 0) && <div className="panel vd-eu" style={{ '--tc': t?.cor ?? '#2440FF' } as React.CSSProperties}>
        <div className="eyebrow">Eu este mês</div>
        <div className="vd-eu-l">
          <span className="vd-tier" style={{ color: sobre(t?.cor ?? '#2440FF') }}><Ph n={t && cfg.tiers.indexOf(t) === cfg.tiers.length - 1 ? 'crown' : 'medal'} size={26} fill /></span>
          <div className="grow"><b>{t?.nome ?? 'Sem nível'}</b><small>{meu.pts} pontos{prox ? ` · faltam ${prox.min - meu.pts} pra ${prox.nome}` : t ? ' · nível máximo' : ''}</small></div>
        </div>
        {prox && <div className="vd-bar"><i style={{ width: pct(meu.pts - (t?.min ?? 0), prox.min - (t?.min ?? 0)) + '%' }} /></div>}
        <div className="row gap"><small className="muted grow">{brl(meu.valor)}{mMeu ? ` de ${brl(mMeu.alvo)} (minha meta)` : ''} · {meu.n} venda(s)</small>
          <button className="btn ghost sm" onClick={() => setMeta({ id: `${mes}:${meId}`, user: meId, alvo: mMeu?.alvo ?? 0 })}>{mMeu ? 'Minha meta' : 'Pôr minha meta'}</button></div>
      </div>}
    </div>

    <div className="vd-cols">
      <section className="panel vd-rank">
        <h4>Ranking</h4>
        {!rank.length && <small className="muted">Ninguém vendeu ainda nesse mês.</small>}
        {rank.map((r, i) => {
          const tr = tierOf(r.pts, cfg.tiers), mm = s.rows.metas_venda[`${mes}:${r.p.id}`]
          return (
            <div key={r.p.id} className={'vd-rrow' + (r.p.id === meId ? ' eu' : '')}>
              <span className="vd-pos">{i + 1}</span>
              <MiniAvatar avatar={r.p.avatar} photo={r.p.photo} name={r.p.name} size={30} />
              <div className="grow"><b>{first(r.p)}</b><small>{r.n} venda(s) · {brl(r.valor)}{mm ? ` · ${pct(r.valor, mm.alvo)}% da meta` : ''}</small></div>
              {tr && <span className="vd-chip" style={{ background: tr.cor, color: sobre(tr.cor) }}>{tr.nome}</span>}
              <b className="vd-rpts">{r.pts}</b>
            </div>
          )
        })}
      </section>
      <section className="panel vd-premios">
        <h4>Prêmios do mês</h4>
        {!cfg.premios.length && <small className="muted">{pode.manda ? 'Cadastre os prêmios em Regras do placar.' : 'Quando a gerência cadastrar prêmios, eles aparecem aqui.'}</small>}
        {cfg.premios.map((p, i) => {
          const quem = rank.filter(r => valorDe(r, p) >= p.alvo), x = valorDe(meu, p)
          return (
            <div key={i} className={'vd-premio' + (x >= p.alvo ? ' ok' : '')}>
              <span className="tile"><Ph n="gift" size={18} fill /></span>
              <div className="grow"><b>{p.titulo}</b><small>Bater {fmt(p, p.alvo)} no mês{sou ? ` · você: ${fmt(p, x)}` : ''}</small>
                {sou && <div className="vd-bar sm"><i style={{ width: pct(x, p.alvo) + '%' }} /></div>}
                {quem.length > 0 && <div className="vd-ganhou"><Ph n="confetti" size={13} fill />{quem.map(r => first(r.p)).join(', ')}</div>}
              </div>
            </div>
          )
        })}
      </section>
    </div>

    <section className="panel vd-ult">
      <h4>Vendas do mês</h4>
      {!doMes.length && <small className="muted">Nenhuma venda lançada.</small>}
      {doMes.slice(0, 30).map(v => {
        const q = quartos[v.quarto_id], p = s.profiles[v.user_id], meuOk = pode.manda || v.user_id === meId
        return (
          <div key={v.id} className="vd-vrow">
            <i className="vd-dot" style={{ background: q?.cor ?? '#999' }} />
            <div className="grow"><b>{v.qtd > 1 ? `${v.qtd}× ` : ''}{q?.nome ?? 'Quarto'} · {diaBr(v.entrada)} → {diaBr(v.saida)}</b><small>{first(p)} · {brl(Number(v.valor))}{v.nota ? ` · ${v.nota}` : ''}</small></div>
            <span className="vd-chip soft">+{pontos(v, cfg)}</span>
            {meuOk && <button className="icon-btn" onClick={() => setEdit(v)} aria-label="Editar venda"><Ph n="pencil-simple-line" size={15} /></button>}
          </div>
        )
      })}
    </section>
    {meta && <MetaForm {...meta} mes={mes} onClose={() => setMeta(null)} />}
    {regras && <RegrasForm cfg={cfg} onClose={() => setRegras(false)} />}
    {edit && <VendaForm v={edit} quartos={Object.values(quartos).filter(q => q.ativo || q.id === edit.quarto_id)} podeOutro={pode.manda} onClose={() => setEdit(null)} />}
  </>
}

function MetaForm({ id, user, alvo, mes, onClose }: { id: string; user: string | null; alvo: number; mes: string; onClose: () => void }) {
  const meId = useStore(s => s.meId)
  const atual = useStore(s => s.rows.metas_venda[id])
  const [v, setV] = useState(alvo ? String(alvo) : '')
  const salvar = () => { const n = Math.max(0, Number(v.replace(/\./g, '').replace(',', '.')) || 0); run(putRow('metas_venda', { id, user_id: user, mes, alvo: n, created_by: atual?.created_by ?? meId, created_at: atual?.created_at ?? now() })); onClose() }
  return (
    <Modal title={(user ? 'Minha meta' : 'Meta do time') + ' · ' + mesNome(mes)} onClose={onClose} onSubmit={salvar}
      foot={atual && <button type="button" className="btn ghost danger" onClick={() => { run(dropRow('metas_venda', id)); onClose() }}>Tirar meta</button>}>
      <label>Vender no mês (R$)<input autoFocus inputMode="decimal" value={v} onChange={e => setV(e.target.value)} placeholder="Ex.: 60000" /></label>
    </Modal>
  )
}

function RegrasForm({ cfg, onClose }: { cfg: VendasCfg; onClose: () => void }) {
  const [pv, setPv] = useState(String(cfg.pts_venda))
  const [pm, setPm] = useState(String(cfg.pts_mil))
  const [tiers, setTiers] = useState<Tier[]>(cfg.tiers)
  const [prem, setPrem] = useState<Premio[]>(cfg.premios)
  const num = (x: string) => Math.max(0, Math.min(10000, Math.round(Number(x) || 0)))
  const salvar = () => {
    run(putRow('vendas_cfg', { ...cfg, id: 'cfg', pts_venda: num(pv), pts_mil: num(pm),
      tiers: tiers.filter(t => t.nome.trim()).map(t => ({ ...t, nome: t.nome.trim() })).sort((a, b) => a.min - b.min).slice(0, 12),
      premios: prem.filter(p => p.titulo.trim()).map(p => ({ ...p, titulo: p.titulo.trim() })).slice(0, 30), created_at: cfg.created_at || now() }))
    onClose()
  }
  return (
    <Modal title="Regras do placar" onClose={onClose} onSubmit={salvar}>
      <div className="row gap">
        <label className="grow">Pontos por venda<input type="number" min={0} value={pv} onChange={e => setPv(e.target.value)} /></label>
        <label className="grow">Pontos a cada R$ 1.000<input type="number" min={0} value={pm} onChange={e => setPm(e.target.value)} /></label>
      </div>
      <h4 className="vd-h">Níveis do vendedor <small className="muted">pelos pontos do mês</small></h4>
      <div className="vd-tipos">
        {tiers.map((t, i) => (
          <div key={i} className="vd-tipo">
            <button type="button" className="vd-cor" style={{ background: t.cor }} onClick={() => setTiers(l => l.map((x, j) => j === i ? { ...x, cor: CORES[(CORES.indexOf(x.cor) + 1) % CORES.length] } : x))} aria-label="Trocar a cor" />
            <input className="grow" maxLength={24} value={t.nome} onChange={e => setTiers(l => l.map((x, j) => j === i ? { ...x, nome: e.target.value } : x))} placeholder="Ex.: Ouro" aria-label="Nome do nível" />
            <input type="number" min={0} value={t.min} onChange={e => setTiers(l => l.map((x, j) => j === i ? { ...x, min: num(e.target.value) } : x))} title="A partir de quantos pontos" aria-label="Pontos mínimos" />
            <button type="button" className="icon-btn" onClick={() => setTiers(l => l.filter((_, j) => j !== i))} aria-label="Tirar"><Ph n="trash" size={16} /></button>
          </div>
        ))}
        {tiers.length < 12 && <button type="button" className="btn soft sm" onClick={() => setTiers(l => [...l, { nome: '', min: (l.at(-1)?.min ?? 0) + 100, cor: CORES[l.length % CORES.length] }])}><Ph n="plus" size={15} />Nível</button>}
      </div>
      <h4 className="vd-h">Prêmios</h4>
      <div className="vd-tipos">
        {prem.map((p, i) => (
          <div key={i} className="vd-tipo">
            <input className="grow" maxLength={60} value={p.titulo} onChange={e => setPrem(l => l.map((x, j) => j === i ? { ...x, titulo: e.target.value } : x))} placeholder="Ex.: Jantar no restaurante" aria-label="Prêmio" />
            <select value={p.regra} onChange={e => setPrem(l => l.map((x, j) => j === i ? { ...x, regra: e.target.value as Premio['regra'] } : x))} aria-label="Regra">
              <option value="pontos">pontos</option><option value="valor">R$ vendido</option><option value="vendas">nº de vendas</option>
            </select>
            <input type="number" min={0} value={p.alvo} onChange={e => setPrem(l => l.map((x, j) => j === i ? { ...x, alvo: Math.max(0, Number(e.target.value) || 0) } : x))} aria-label="Alvo" />
            <button type="button" className="icon-btn" onClick={() => setPrem(l => l.filter((_, j) => j !== i))} aria-label="Tirar"><Ph n="trash" size={16} /></button>
          </div>
        ))}
        {prem.length < 30 && <button type="button" className="btn soft sm" onClick={() => setPrem(l => [...l, { titulo: '', regra: 'pontos', alvo: 300 }])}><Ph n="plus" size={15} />Prêmio</button>}
      </div>
    </Modal>
  )
}

/* ---------------- kit de vendas ---------------- */
function Kit({ pode }: { pode: Pode }) {
  const camps = useStore(s => s.rows.campanhas)
  const cfg = useStore(s => s.rows.vendas_cfg.cfg) ?? CFG0
  const [form, setForm] = useState<Campanha | 'nova' | null>(null)
  const [zoom, setZoom] = useState<string | null>(null)
  const d0 = hoje()
  const fase = (c: Campanha) => c.fim && c.fim < d0 ? 2 : c.inicio && c.inicio > d0 ? 1 : 0
  const lista = Object.values(camps).sort((a, b) => fase(a) - fase(b) || (a.inicio ?? '').localeCompare(b.inicio ?? ''))
  const periodo = (c: Campanha) => c.inicio && c.fim ? `${diaBr(c.inicio)} – ${diaBr(c.fim)}` : c.inicio ? `a partir de ${diaBr(c.inicio)}` : c.fim ? `até ${diaBr(c.fim)}` : 'sem data'
  return <>
    <div className="vd-mbar"><b className="grow">Campanhas</b>{pode.edita && <button className="btn soft sm" onClick={() => setForm('nova')}><Ph n="plus" size={15} />Nova campanha</button>}</div>
    {!lista.length && <div className="panel empty-goal"><Ph n="megaphone" size={36} /><b>Nenhuma campanha</b><small className="muted">O Marketing publica aqui o que está rodando: texto pronto, período e a pasta com fotos e artes.</small></div>}
    <div className="vd-camps">
      {lista.map(c => (
        <article key={c.id} className={'panel vd-camp' + (fase(c) === 2 ? ' passou' : '')} style={{ '--cc': c.cor } as React.CSSProperties}>
          <header><span className="vd-ctag" style={{ color: sobre(c.cor) }}>{fase(c) === 0 ? 'rodando' : fase(c) === 1 ? 'vem aí' : 'encerrada'}</span><small className="grow">{periodo(c)}</small>
            {pode.edita && <button className="icon-btn" onClick={() => setForm(c)} aria-label="Editar campanha"><Ph n="pencil-simple-line" size={15} /></button>}</header>
          <h3>{c.titulo}</h3>
          {c.texto && <p className="vd-ctexto">{c.texto}</p>}
          <div className="row gap">
            {c.texto && <button className="btn soft sm" onClick={() => void navigator.clipboard?.writeText(c.texto)} title="Copiar o texto pra mandar pro cliente"><Ph n="note-blank" size={15} />Copiar texto</button>}
            {c.link && /^https?:\/\//.test(c.link) && <a className="btn soft sm" href={c.link} target="_blank" rel="noreferrer noopener"><Ph n="arrow-square-out" size={15} />Abrir link</a>}
          </div>
          {driveOn && <FolderBox link={c.pasta} own={!!c.pasta} edit={pode.edita} suggest={c.titulo} base={null} onLink={l => run(putRow('campanhas', { ...c, pasta: l }))} onZoom={setZoom} />}
        </article>
      ))}
    </div>
    <section className="panel vd-pasta">
      <h4>Pasta do Comercial</h4>
      <small className="muted">Fotos dos quartos, tabela de preços, apresentações: o que o pessoal usa pra mostrar pro cliente.</small>
      {driveOn
        ? <FolderBox link={cfg.pasta} own={!!cfg.pasta} edit={pode.manda} suggest="Comercial" base={null} onLink={l => run(putRow('vendas_cfg', { ...cfg, pasta: l, created_at: cfg.created_at || now() }))} onZoom={setZoom} />
        : <div className="vd-sem"><Ph n="folder-simple" size={20} />No modo demonstração o Drive fica desligado. Com o Drive ligado, a pasta aparece aqui com as miniaturas.</div>}
    </section>
    {form && <CampForm c={form === 'nova' ? null : form} onClose={() => setForm(null)} />}
    {zoom && <div className="zoom" onMouseDown={() => setZoom(null)}><img src={zoom} alt="" /></div>}
  </>
}

function CampForm({ c, onClose }: { c: Campanha | null; onClose: () => void }) {
  const meId = useStore(s => s.meId)
  const [titulo, setTitulo] = useState(c?.titulo ?? '')
  const [texto, setTexto] = useState(c?.texto ?? '')
  const [inicio, setInicio] = useState(c?.inicio ?? '')
  const [fim, setFim] = useState(c?.fim ?? '')
  const [cor, setCor] = useState(c?.cor ?? '#FF7A1A')
  const [link, setLink] = useState(c?.link ?? '')
  const salvar = () => {
    if (!titulo.trim()) return
    run(putRow('campanhas', { id: c?.id ?? crypto.randomUUID(), titulo: titulo.trim(), texto: texto.trim(), inicio: inicio || null, fim: fim || null, cor, pasta: c?.pasta ?? null, link: link.trim() || null, created_by: c?.created_by ?? meId, created_at: c?.created_at ?? now() }))
    onClose()
  }
  return (
    <Modal title={c ? 'Editar campanha' : 'Nova campanha'} onClose={onClose} onSubmit={salvar}
      foot={c && <button type="button" className="btn ghost danger" onClick={() => { run(dropRow('campanhas', c.id)); onClose() }}>Apagar</button>}>
      <label>Campanha<input autoFocus required maxLength={80} value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex.: Feriado de novembro" /></label>
      <label>Texto pro cliente<textarea rows={5} maxLength={1000} value={texto} onChange={e => setTexto(e.target.value)} placeholder="O texto que o Comercial copia e manda no WhatsApp" /></label>
      <div className="row gap">
        <label className="grow">Começa<input type="date" value={inicio} onChange={e => setInicio(e.target.value)} /></label>
        <label className="grow">Termina<input type="date" min={inicio || undefined} value={fim} onChange={e => setFim(e.target.value)} /></label>
      </div>
      <label>Link (opcional)<input type="url" maxLength={300} value={link} onChange={e => setLink(e.target.value)} placeholder="https://" /></label>
      <div className="opts">{CORES.map(x => <button type="button" key={x} className={'vd-cor' + (cor === x ? ' on' : '')} style={{ background: x }} onClick={() => setCor(x)} aria-label={'Cor ' + x} />)}</div>
      {driveOn && <small className="muted">Depois de salvar, crie ou ligue a pasta do Drive no card da campanha.</small>}
    </Modal>
  )
}
