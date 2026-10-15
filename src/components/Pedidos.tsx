// Pedidos ao gerente: uma lista só (abertos / histórico). Material, folga ou outro; material pode
// virar lista coletiva do setor. Tudo fica registrado: o histórico é escrito pelo servidor.
import { useMemo, useState } from 'react'
import { deptOf } from '../game/ranks'
import { gereEquipe } from '../plano/core'
import { pref, usePref } from '../prefs'
import { Modal } from '../plano/ui'
import { me, mudarReq, nameOf, novaReq, useStore, type State } from '../store'
import type { Profile, ReqItem, ReqStatus, ReqTipo, Requisicao } from '../types'
import { confirmar, pedirTexto } from './Dialogo'
import { Ph } from './Icon'
import type { PhName } from './ph'
import MiniAvatar from './MiniAvatar'
import '../plano/plano.css'
import '../pedidos.css'

const TIPO: Record<ReqTipo, { nome: string; ic: PhName }> = {
  material: { nome: 'Material', ic: 'storefront' },
  folga: { nome: 'Folga', ic: 'bed' },
  livre: { nome: 'Outro', ic: 'note-blank' },
}
const STATUS: Record<ReqStatus, string> = { aberto: 'Aberto', aprovado: 'Aprovado', recusado: 'Recusado', entregue: 'Entregue', cancelado: 'Cancelado' }
const data = (d: string) => new Date(d.length === 10 ? d + 'T12:00' : d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
const quando = (d: string) => new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
const hoje = () => new Date().toISOString().slice(0, 10)

/** pedidos da sala que eu decido e ainda estão abertos (badge do menu) */
export function reqParaDecidir(st: State) {
  const eu = st.meId ? st.profiles[st.meId] : undefined
  if (!eu) return 0
  return Object.values(st.rows.requisicoes).filter(r => r.status === 'aberto' && r.por !== eu.id && r.dept === st.sala && gereReq(eu, r.dept)).length
}

/** quem decide pedido da sala: gerente da sala, Chefe; o adm só com o Modo desenvolvedor ligado */
export const gereReq = (eu: Profile | undefined, dept: string | null, dev = pref('dev')) =>
  !!eu && (gereEquipe({ ...eu, is_admin: false }, dept) || (!!eu.is_admin && dev))

const errMsg = (e: unknown) => (e as { message?: string })?.message ?? 'Não deu certo.'

export default function Pedidos() {
  const reqs = useStore(s => s.rows.requisicoes)
  const sala = useStore(s => s.sala)
  const meId = useStore(s => s.meId)
  const profiles = useStore(s => s.profiles)
  const [hist, setHist] = useState(false)
  const [novo, setNovo] = useState(false)
  const [open, setOpen] = useState<string | null>(null)
  const eu = me()
  const dev = usePref('dev')
  const gere = gereReq(eu, sala, dev)

  const lista = useMemo(() => Object.values(reqs)
    .filter(r => r.por === meId || (r.dept === sala && (r.coletivo || gere)))
    .filter(r => hist ? r.status !== 'aberto' && r.status !== 'aprovado' : r.status === 'aberto' || r.status === 'aprovado')
    .sort((a, b) => {
      const pa = gere && a.status === 'aberto' && a.por !== meId ? 0 : 1, pb = gere && b.status === 'aberto' && b.por !== meId ? 0 : 1
      return pa - pb || b.em.localeCompare(a.em)
    }), [reqs, sala, meId, hist, gere])

  return (
    <div className="pd">
      <div className="pd-bar">
        <div className="pd-seg" role="tablist">
          <button role="tab" aria-selected={!hist} className={!hist ? 'on' : ''} onClick={() => setHist(false)}>Abertos</button>
          <button role="tab" aria-selected={hist} className={hist ? 'on' : ''} onClick={() => setHist(true)}>Histórico</button>
        </div>
        <button className="btn accent" onClick={() => setNovo(true)}><Ph n="plus" size={16} /> Novo pedido</button>
      </div>
      {!lista.length && <p className="pd-vazio">{hist ? 'Nada no histórico ainda.' : 'Nenhum pedido aberto. Precisa de material, folga ou outra coisa? Faça um pedido — fica registrado.'}</p>}
      <ul className="pd-lista">
        {lista.map(r => <Cartao key={r.id} r={r} aberto={open === r.id} onToggle={() => setOpen(open === r.id ? null : r.id)} profiles={profiles} meId={meId} />)}
      </ul>
      {novo && <Novo onClose={() => setNovo(false)} />}
    </div>
  )
}

function Cartao({ r, aberto, onToggle, profiles, meId }: { r: Requisicao; aberto: boolean; onToggle: () => void; profiles: State['profiles']; meId: string | null }) {
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const eu = meId ? profiles[meId] : undefined
  const gere = gereReq(eu, r.dept, usePref('dev'))
  const autor = r.por === meId
  const apoiei = !!meId && r.apoios.includes(meId)
  const pessoas = new Set(r.itens.map(i => i.por).filter(Boolean)).size
  const listaAberta = r.coletivo && r.status === 'aberto' && (!r.fecha || hoje() <= r.fecha)
  const decidir = gere && r.status === 'aberto' && !autor

  const run = async (f: () => Promise<unknown>) => {
    setErr(''); setBusy(true)
    try { await f() } catch (e) { setErr(errMsg(e)) } finally { setBusy(false) }
  }
  const status = (s: ReqStatus, motivo = '') => run(() => mudarReq(r.id, 'status', { status: s, motivo }))
  const recusar = async () => { const m = await pedirTexto('Recusar pedido', { text: 'Diga o motivo — quem pediu vai ver.', ok: 'Recusar', ph: 'Motivo', max: 900 }); if (m?.trim()) status('recusado', m.trim()) }
  const cancelar = async () => { if (await confirmar('Cancelar este pedido?', { text: 'Ele continua no histórico.', ok: 'Cancelar pedido', danger: true })) status('cancelado') }

  return (
    <li className={'pd-c st-' + r.status + (aberto ? ' aberto' : '') + (decidir ? ' decidir' : '')}>
      <button className="pd-head" onClick={onToggle} aria-expanded={aberto}>
        <span className="pd-ic"><Ph n={TIPO[r.tipo].ic} size={18} /></span>
        <span className="pd-tt">
          <b>{r.titulo}</b>
          <small>
            <MiniAvatar avatar={profiles[r.por]?.avatar ?? null} photo={profiles[r.por]?.photo ?? null} name={profiles[r.por]?.name} size={16} />
            {nameOf(r.por)} · {data(r.created_at)}
            {r.tipo === 'folga' && r.de && <> · {data(r.de)}{r.ate && r.ate !== r.de ? ` → ${data(r.ate)}` : ''}</>}
            {r.coletivo && <span className="pd-tag"><Ph n="users-three" size={12} /> lista · {r.itens.length} {r.itens.length === 1 ? 'item' : 'itens'} · {pessoas} {pessoas === 1 ? 'pessoa' : 'pessoas'}</span>}
          </small>
        </span>
        {r.apoios.length > 0 && <span className="pd-n" title="Apoios">+{r.apoios.length}</span>}
        <span className="pd-st">{r.tipo === 'folga' && r.status === 'entregue' ? 'Concluído' : STATUS[r.status]}</span>
      </button>
      {aberto && (
        <div className="pd-body">
          {r.detalhe && <p className="pd-det">{r.detalhe}</p>}
          {r.motivo && <p className="pd-mot"><b>Motivo:</b> {r.motivo}</p>}
          {r.tipo === 'material' && <Itens r={r} meId={meId} pode={listaAberta || (r.status === 'aberto' && autor)} run={run} />}
          {r.coletivo && r.fecha && <small className="muted">Lista fecha em {data(r.fecha)}</small>}
          <ol className="pd-hist">
            {r.historico.map((h, i) => <li key={i}><time>{quando(h.em)}</time> <b>{nameOf(h.por)}</b> — {h.txt}</li>)}
          </ol>
          {err && <p className="pd-err" role="alert">{err}</p>}
          <div className="pd-acts">
            {r.status === 'aberto' && r.coletivo && !autor && <button className={'btn soft sm' + (apoiei ? ' apoiei' : '')} disabled={busy} onClick={() => run(() => mudarReq(r.id, 'apoio'))}><Ph n="hand-heart" size={15} fill={apoiei} /> {apoiei ? 'Apoiado' : 'Eu também'}</button>}
            {decidir && <>
              <button className="btn accent sm" disabled={busy} onClick={() => status('aprovado')}><Ph n="check" size={15} /> Aprovar</button>
              <button className="btn ghost danger sm" disabled={busy} onClick={recusar}><Ph n="x" size={15} /> Recusar</button>
            </>}
            {gere && r.status === 'aprovado' && <button className="btn accent sm" disabled={busy} onClick={() => status('entregue')}><Ph n="seal-check" size={15} /> {r.tipo === 'folga' ? 'Marcar concluído' : 'Marcar entregue'}</button>}
            {gere && r.status !== 'aberto' && r.status !== 'cancelado' && <button className="btn ghost sm" disabled={busy} onClick={() => status('aberto')}>Reabrir</button>}
            {autor && r.status === 'aberto' && <button className="btn ghost danger sm" disabled={busy} onClick={cancelar}>Cancelar pedido</button>}
          </div>
        </div>
      )}
    </li>
  )
}

/** itens agrupados por nome; cada um edita só os seus */
function Itens({ r, meId, pode, run }: { r: Requisicao; meId: string | null; pode: boolean; run: (f: () => Promise<unknown>) => void }) {
  const meus = r.itens.filter(i => i.por === meId)
  const [edit, setEdit] = useState<ReqItem[] | null>(null)
  const grupos = useMemo(() => {
    const m = new Map<string, { nome: string; qtd: number; por: string[] }>()
    for (const i of r.itens) {
      const k = i.nome.trim().toLowerCase()
      const g = m.get(k) ?? { nome: i.nome.trim(), qtd: 0, por: [] }
      g.qtd += i.qtd; if (i.por && !g.por.includes(i.por)) g.por.push(i.por)
      m.set(k, g)
    }
    return [...m.values()]
  }, [r.itens])

  return (
    <div className="pd-itens">
      {grupos.length > 0 && <table><tbody>{grupos.map(g => <tr key={g.nome}><td className="q">{g.qtd}×</td><td>{g.nome}</td>{r.coletivo && <td className="muted">{g.por.map(nameOf).join(', ')}</td>}</tr>)}</tbody></table>}
      {pode && !edit && <button className="btn soft sm" onClick={() => setEdit(meus.length ? meus : [{ id: crypto.randomUUID(), nome: '', qtd: 1 }])}><Ph n="pencil-simple-line" size={15} /> {meus.length ? 'Mudar meus itens' : r.coletivo ? 'Pôr o que eu preciso' : 'Itens'}</button>}
      {edit && <form className="pd-meus" onSubmit={e => { e.preventDefault(); const it = edit.filter(i => i.nome.trim()).map(i => ({ ...i, nome: i.nome.trim() })); run(() => mudarReq(r.id, 'itens', { itens: it }).then(() => setEdit(null))) }}>
        <ItensEditor v={edit} onChange={setEdit} />
        <footer><button type="button" className="btn ghost sm" onClick={() => setEdit(null)}>Voltar</button><button className="btn accent sm">Salvar</button></footer>
      </form>}
    </div>
  )
}

function ItensEditor({ v, onChange }: { v: ReqItem[]; onChange: (v: ReqItem[]) => void }) {
  const up = (id: string, p: Partial<ReqItem>) => onChange(v.map(i => i.id === id ? { ...i, ...p } : i))
  return (
    <div className="pd-ed">
      {v.map((i, n) => (
        <div key={i.id} className="pd-ln">
          <input type="number" min={1} max={9999} value={i.qtd} onChange={e => up(i.id, { qtd: Math.max(1, Math.min(9999, +e.target.value || 1)) })} aria-label="Quantidade" />
          <input value={i.nome} onChange={e => up(i.id, { nome: e.target.value })} maxLength={120} placeholder="Ex.: papel A4, fita crepe…" autoFocus={n === v.length - 1 && !i.nome} aria-label="Item" />
          <button type="button" className="icon-btn" onClick={() => onChange(v.filter(x => x.id !== i.id))} aria-label="Tirar"><Ph n="x" size={15} /></button>
        </div>
      ))}
      <button type="button" className="pd-add" onClick={() => onChange([...v, { id: crypto.randomUUID(), nome: '', qtd: 1 }])}><Ph n="plus" size={14} /> item</button>
    </div>
  )
}

function Novo({ onClose }: { onClose: () => void }) {
  const sala = useStore(s => s.sala)
  const eu = me()
  const [tipo, setTipo] = useState<ReqTipo>('material')
  const [titulo, setTitulo] = useState('')
  const [detalhe, setDetalhe] = useState('')
  const [coletivo, setColetivo] = useState(false)
  const [fecha, setFecha] = useState('')
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')
  const [itens, setItens] = useState<ReqItem[]>([{ id: crypto.randomUUID(), nome: '', qtd: 1 }])
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  if (!eu) return null
  const dept = gereEquipe(eu, sala) || deptOf(eu) === sala ? sala : deptOf(eu)

  const salvar = async () => {
    if (!titulo.trim()) return setErr('Dê um título.')
    if (tipo === 'folga' && !de) return setErr('Escolha o dia.')
    setErr(''); setBusy(true)
    const agora = new Date().toISOString()
    const it = tipo === 'material' ? itens.filter(i => i.nome.trim()).map(i => ({ ...i, nome: i.nome.trim(), por: eu.id })) : []
    try {
      await novaReq({
        id: crypto.randomUUID(), dept, tipo, titulo: titulo.trim(), detalhe: detalhe.trim(), coletivo: tipo === 'material' && coletivo,
        itens: it, apoios: [], fecha: tipo === 'material' && coletivo && fecha ? fecha : null,
        de: tipo === 'folga' ? de : null, ate: tipo === 'folga' && ate ? ate : null,
        status: 'aberto', motivo: '', por: eu.id, decidido_por: null,
        historico: [{ em: agora, por: eu.id, txt: 'Pedido feito' }], created_at: agora, em: agora,
      })
      onClose()
    } catch (e) { setErr(errMsg(e)); setBusy(false) }
  }

  return (
    <Modal title="Novo pedido" onClose={onClose}>
      <form className="pl-form one pd-novo" onSubmit={e => { e.preventDefault(); salvar() }}>
        <div className="pd-tipos" role="radiogroup" aria-label="Tipo">
          {(Object.keys(TIPO) as ReqTipo[]).map(t => <button type="button" role="radio" aria-checked={tipo === t} key={t} className={tipo === t ? 'on' : ''} onClick={() => setTipo(t)}><Ph n={TIPO[t].ic} size={18} /> {TIPO[t].nome}</button>)}
        </div>
        <label><span>{tipo === 'folga' ? 'O que você pede' : 'Título'}</span><input value={titulo} onChange={e => setTitulo(e.target.value)} maxLength={120} placeholder={tipo === 'material' ? 'Ex.: material de escritório' : tipo === 'folga' ? 'Ex.: folga no sábado / troca com a Ana' : 'Ex.: cadeira nova'} autoFocus required /></label>
        {tipo === 'folga' && <div className="pd-datas">
          <label><span>Dia</span><input type="date" value={de} onChange={e => setDe(e.target.value)} required /></label>
          <label><span>Até <small className="muted">(opcional)</small></span><input type="date" value={ate} min={de || undefined} onChange={e => setAte(e.target.value)} /></label>
        </div>}
        {tipo === 'material' && <>
          <div><span className="pl-lab">Itens</span><ItensEditor v={itens} onChange={setItens} /></div>
          <label className="pd-chk"><input type="checkbox" checked={coletivo} onChange={e => setColetivo(e.target.checked)} /> <span><b>Lista coletiva</b> — o setor todo pode pôr o que precisa</span></label>
          {coletivo && <label><span>Fecha em <small className="muted">(opcional)</small></span><input type="date" value={fecha} min={hoje()} onChange={e => setFecha(e.target.value)} /></label>}
        </>}
        <label><span>Detalhes <small className="muted">(opcional)</small></span><textarea value={detalhe} onChange={e => setDetalhe(e.target.value)} maxLength={4000} rows={3} placeholder={tipo === 'folga' ? 'Motivo, quem cobre…' : 'Para quê, até quando, link…'} /></label>
        {err && <p className="pd-err" role="alert">{err}</p>}
        <footer className="pl-foot"><button type="button" className="btn ghost" onClick={onClose}>Voltar</button><button className="btn accent" disabled={busy}>{busy ? 'Enviando…' : 'Enviar ao gerente'}</button></footer>
      </form>
    </Modal>
  )
}
