import { useEffect, useState } from 'react'
import { ativo, ateQuando, avisosMegafone, PODERES, poderDe } from '../game/poderes'
import { backend } from '../data'
import { mandarMegafone, primeiroNome, useStore } from '../store'
import MiniAvatar from './MiniAvatar'

const FECHADOS = 'ev:megafone:fechados'
const lerFechados = (): string[] => { try { return JSON.parse(localStorage.getItem(FECHADOS) ?? '[]') } catch { return [] } }

/** no escritório: aviso do megafone no topo + chip "Poderes" com quem tem o quê e o envio do megafone */
export default function PoderesHud() {
  const poderes = useStore(s => s.rows.poderes)
  const profiles = useStore(s => s.profiles)
  const meId = useStore(s => s.meId)
  const [, tick] = useState(0)
  const [aberto, setAberto] = useState(false)
  const [fechados, setFechados] = useState(lerFechados)
  const [texto, setTexto] = useState('')
  const [msg, setMsg] = useState<{ t: string; err?: boolean } | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => { const i = setInterval(() => tick(n => n + 1), 60000); return () => clearInterval(i) }, [])

  const now = Date.now()
  const ativos = Object.values(poderes).filter(p => ativo(p, now) && profiles[p.user_id]).sort((a, b) => a.fim.localeCompare(b.fim))
  const aviso = avisosMegafone(poderes, now).find(p => !fechados.includes(p.id))
  const meuMega = Object.values(poderes).find(p => p.user_id === meId && p.tipo === 'megafone' && !p.aviso && ativo(p, now))
  const meu = poderDe(poderes, meId)
  const fechar = (id: string) => { const v = [id, ...fechados].slice(0, 50); setFechados(v); try { localStorage.setItem(FECHADOS, JSON.stringify(v)) } catch { /* só nesta sessão */ } }
  const enviar = async () => {
    setBusy(true); setMsg(null)
    try { await mandarMegafone(texto); setTexto(''); setMsg({ t: 'Aviso no ar pro escritório inteiro.' }) }
    catch (e) { setMsg({ t: (e as Error).message, err: true }) }
    finally { setBusy(false) }
  }

  return <>
    {aviso && <div className="pd-aviso" role="status">
      <span className="pd-aviso-ic" aria-hidden>📣</span>
      <span className="grow"><b>{primeiroNome(aviso.user_id)}:</b> {aviso.aviso}</span>
      <button className="pd-x" onClick={() => fechar(aviso.id)} aria-label="Fechar aviso">×</button>
    </div>}
    {(ativos.length > 0 || meuMega) && <div className="pdr">
      <button className={'pd-chip' + (meu ? ' meu' : '')} style={meu ? { ['--pc' as string]: PODERES[meu.tipo].cor } : undefined} onClick={() => setAberto(!aberto)} aria-expanded={aberto}>
        <span aria-hidden>{meu ? PODERES[meu.tipo].emoji : '✨'}</span>{meu ? PODERES[meu.tipo].nome : `Poderes · ${ativos.length}`}
      </button>
      {aberto && <div className="pd-pop">
        <h4>Poderes ativos</h4>
        <small className="muted">Toda segunda às 9h o escritório sorteia 3 pessoas. Quem bateu mais metas na semana tem mais chance.</small>
        {ativos.map(p => {
          const pf = profiles[p.user_id], po = PODERES[p.tipo]
          return <div key={p.id} className={'pd-linha' + (p.user_id === meId ? ' eu' : '')}>
            <MiniAvatar avatar={pf.avatar} photo={pf.photo} name={pf.name} size={28} />
            <span className="grow"><b>{p.user_id === meId ? 'Você' : pf.name.split(' ')[0]}</b> <i className="pd-selo" style={{ background: po.cor }}>{po.emoji} {po.nome}</i><small>{po.desc} · até {ateQuando(p.fim)}</small></span>
          </div>
        })}
        {meuMega && <div className="pd-mega">
          <label htmlFor="pd-mega">📣 Seu megafone: 1 aviso pra todo mundo</label>
          <textarea id="pd-mega" rows={2} maxLength={200} value={texto} onChange={e => setTexto(e.target.value)} placeholder="Ex.: Bolo na copa às 15h!" />
          <div className="pd-mega-pe"><small className="muted">{texto.trim().length}/200</small><button className="btn accent sm" disabled={busy || !texto.trim()} onClick={() => void enviar()}>{busy ? 'Enviando…' : 'Mandar aviso'}</button></div>
        </div>}
        {msg && <p className={msg.err ? 'cs-erro' : 'bl-ok'}>{msg.t}</p>}
      </div>}
    </div>}
  </>
}

/** no bolão: com o poder Visão, quem lidera em bilhetes */
export function VisaoBolao() {
  const poderes = useStore(s => s.rows.poderes)
  const meId = useStore(s => s.meId)
  const tem = !!poderDe(poderes, meId, 'visao')
  const [lista, setLista] = useState<{ u: string; n: number }[] | null>(null)
  useEffect(() => { if (tem) void backend.visaoBolao().then(setLista).catch(() => setLista([])) }, [tem])
  if (!tem) return null
  return <div className="bl-card pd-visao">
    <h4>👁️ Visão · quem lidera</h4>
    {!lista ? <small className="muted">Olhando…</small> : !lista.length ? <small className="muted">Ninguém com bilhete ainda.</small>
      : <ol>{lista.map(l => <li key={l.u} className={l.u === meId ? 'eu' : ''}><span className="grow">{l.u === meId ? 'Você' : primeiroNome(l.u)}</span><b>{l.n}</b></li>)}</ol>}
    <small className="muted">Só você vê isso, enquanto o poder durar.</small>
  </div>
}
