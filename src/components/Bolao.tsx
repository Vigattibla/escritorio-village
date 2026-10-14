// Aba Bolão do cassino: pote da semana, bilhetes, latinhas ⚡, roleta do sorteio e histórico.
import { useEffect, useRef, useState } from 'react'
import { BILHETE, LATINHA, MAX_BILHETES, MAX_TROCAS, latinhasDoPremio, type Sorteio } from '../cassino/bolao'
import { checarBolao, comprarBilhete, itemName, primeiroNome, run, trocarLatinha, useStore } from '../store'
import { Ph } from './Icon'

const CASA = 112 // largura de cada nome na faixa da roleta
const RODOU = 'ev:bolao:roleta'
const lsGet = (k: string) => { try { return localStorage.getItem(k) ?? '' } catch { return '' } }
const lsSet = (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* sem storage */ } }

function falta(ms: number) {
  if (ms <= 0) return 'sorteando…'
  const s = Math.floor(ms / 1000), d = Math.floor(s / 86400), h = Math.floor(s / 3600) % 24, m = Math.floor(s / 60) % 60
  const p = (n: number) => String(n).padStart(2, '0')
  return d ? `${d}d ${p(h)}h ${p(m)}min` : `${p(h)}:${p(m)}:${p(s % 60)}`
}
const dia = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

/** faixa de nomes que corre e para no vencedor; cada pessoa aparece na proporção dos bilhetes */
function Roleta({ s, fim }: { s: Sorteio; fim: () => void }) {
  const faixa = useRef<string[]>([])
  const [x, setX] = useState(0)
  const [parou, setParou] = useState(false)
  const avisa = useRef(fim)
  avisa.current = fim
  if (!faixa.current.length) {
    const urna = s.roleta.flatMap(r => Array(Math.min(r.n, 6)).fill(r.u) as string[])
    faixa.current = Array.from({ length: 44 }, () => urna[Math.floor(Math.random() * urna.length)])
    faixa.current[38] = s.vencedor ?? ''
  }
  useEffect(() => {
    const a = setTimeout(() => setX(-(38 * CASA) + (Math.random() - 0.5) * CASA * 0.6), 60)
    const t = setTimeout(() => { setParou(true); avisa.current() }, 5600)
    return () => { clearTimeout(a); clearTimeout(t) }
  }, [])
  return (
    <div className={'bl-roleta' + (parou ? ' parou' : '')}>
      <i className="bl-seta" />
      <div className="bl-faixa" style={{ transform: `translateX(calc(50% - ${CASA / 2}px + ${x}px))` }}>
        {faixa.current.map((u, i) => <span key={i} className={parou && i === 38 ? 'ok' : ''} style={{ width: CASA }}>{primeiroNome(u)}</span>)}
      </div>
    </div>
  )
}

export default function Bolao() {
  const b = useStore(s => s.bolao)
  const wallet = useStore(s => s.wallet)
  const meId = useStore(s => s.meId)
  const [agora, setAgora] = useState(Date.now())
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState<{ text: string; err?: boolean } | null>(null)
  const [girando, setGirando] = useState<Sorteio | null>(null)
  const [revelado, setRevelado] = useState(false)

  useEffect(() => {
    void checarBolao()
    const t = setInterval(() => setAgora(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  // sorteio novo que a pessoa ainda não viu girar
  const ult = b?.historico[0]
  useEffect(() => {
    if (ult?.vencedor && ult.roleta.length && lsGet(RODOU) !== ult.fim) { lsSet(RODOU, ult.fim); setRevelado(false); setGirando(ult) }
  }, [ult])

  const act = (id: string, f: () => Promise<unknown>, ok: string) => {
    setBusy(id); setMsg(null)
    run(f().then(() => setMsg({ text: ok })).catch(e => setMsg({ text: (e as Error).message, err: true })).finally(() => setBusy('')))
  }
  if (!b) return <div className="bl"><p className="cs-vazio">Abrindo o bolão…</p></div>

  const meus = b.gratis + b.comprados, chance = b.bilhetes ? Math.round((meus / b.bilhetes) * 100) : 0
  const ms = Date.parse(b.fim) - agora
  return (
    <div className="bl">
      <div className="bl-topo">
        <div className="bl-pote">
          <small>Pote desta semana</small>
          <b key={b.pote}>{b.pote} <Ph n="coffee" size={30} fill /></b>
          <span>+ {latinhasDoPremio(b.pote)} latinhas ⚡ + selo 🍀 Sortudo + móvel raro</span>
        </div>
        <div className="bl-relogio">
          <small>Sorteio sexta às 17h</small>
          <b>{falta(ms)}</b>
          <span>{b.gente} {b.gente === 1 ? 'pessoa' : 'pessoas'} · {b.bilhetes} bilhetes</span>
        </div>
      </div>

      {girando && <div className="bl-sorteio">
        <Roleta key={girando.fim} s={girando} fim={() => setRevelado(true)} />
        <p className={'bl-ganhou' + (revelado ? ' on' : '')}>
          {revelado ? <>🍀 <b>{primeiroNome(girando.vencedor)}</b> ganhou {girando.pote} cafezinhos + {girando.latinhas} latinhas ⚡{girando.item && girando.vencedor === meId ? ` e ${itemName(girando.item)}` : ''}!</> : 'Girando…'}
        </p>
        {revelado && <button className="btn ghost sm" onClick={() => setGirando(null)}>Fechar roleta</button>}
      </div>}

      <div className="bl-cards">
        <div className="bl-card">
          <h4>Meus bilhetes</h4>
          <div className="bl-big">{meus}<small> {meus === 1 ? 'bilhete' : 'bilhetes'}{b.bilhetes ? ` · ${chance}% de chance` : ''}</small></div>
          <small className="muted">{b.gratis} grátis (1 por fase de meta, 2 por meta batida) · {b.comprados}/{MAX_BILHETES} comprados</small>
          <button className="btn accent" disabled={!!busy || b.comprados >= MAX_BILHETES}
            onClick={() => act('bilhete', comprarBilhete, 'Bilhete comprado. Boa sorte!')}>
            {busy === 'bilhete' ? 'Comprando…' : b.comprados >= MAX_BILHETES ? 'Limite da semana' : `Comprar bilhete · ☕ ${BILHETE}`}
          </button>
        </div>
        <div className="bl-card lata">
          <h4>Latinhas ⚡</h4>
          <div className="bl-big">{wallet?.latinhas ?? b.latinhas}<small> {(wallet?.latinhas ?? b.latinhas) === 1 ? 'latinha' : 'latinhas'}</small></div>
          <small className="muted">Moeda rara: sai no bolão ou na troca ({LATINHA} cafezinhos, até {MAX_TROCAS} por semana). Vale roupas e animações especiais.</small>
          <button className="btn soft" disabled={!!busy} onClick={() => act('troca', trocarLatinha, '+1 latinha ⚡')}>
            {busy === 'troca' ? 'Trocando…' : `Trocar ☕ ${LATINHA} → 1 ⚡`}
          </button>
        </div>
      </div>
      {msg && <p className={msg.err ? 'cs-erro' : 'bl-ok'}>{msg.text}</p>}

      <div className="bl-hist">
        <h4>Sorteios</h4>
        {!b.historico.length && <small className="muted">O primeiro sorteio é na sexta, 16/10, às 17h.</small>}
        {b.historico.map(s => <div key={s.fim} className={'bl-linha' + (s.vencedor === meId ? ' eu' : '')}>
          <span className="bl-data">{dia(s.fim)}</span>
          <span className="grow">{s.vencedor ? <><b>{primeiroNome(s.vencedor)}</b> <i className="bl-selo">🍀 Sortudo</i></> : <span className="muted">ninguém concorreu · acumulou</span>}</span>
          <span className="bl-premio">{s.pote} ☕{s.vencedor ? ` + ${s.latinhas} ⚡` : ''}</span>
          {s.vencedor && s.roleta.length > 0 && <button className="cs-chip" title="Ver a roleta de novo" disabled={!!girando} onClick={() => { setRevelado(false); setGirando(s) }}>↻</button>}
        </div>)}
      </div>
      <small className="jg-note">O pote junta 30 de semente, o que a casa ganhou no cassino na semana e os bilhetes comprados. Quem sorteia é o servidor; cafezinho e latinha não valem dinheiro.</small>
    </div>
  )
}
