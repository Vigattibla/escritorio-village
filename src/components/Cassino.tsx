import { useEffect, useRef, useState } from 'react'
import Bolao from './Bolao'
import { apostar, refreshWallet, useStore } from '../store'
import type { Backend } from '../types'
import { DOIS, FACE, MAX, MIN, NAIPE, RODA, SIMBOLOS, TRES, corDe, type JogoCassino, type Rodada, type TipoRoleta } from '../cassino/regras'
import { Ph } from './Icon'
import { Fundo } from './Fundo'

/** cassino dos cafezinhos: o servidor sorteia e paga, aqui só a mesa e a animação */
const JOGOS: { id: JogoCassino; nome: string; dica: string }[] = [
  { id: 'caca', nome: 'Caça-níquel', dica: 'Três iguais pagam até 100x a aposta. Dois iguais também pagam.' },
  { id: 'roleta', nome: 'Roleta', dica: 'Roleta europeia. Cor, par/ímpar e metades pagam 2x, dúzia 3x e número certo 36x.' },
  { id: 'blackjack', nome: 'Blackjack', dica: 'Chegue mais perto de 21 que a banca sem passar. Blackjack paga 3:2; a banca para no 17.' },
  { id: 'crash', nome: 'Crash', dica: 'Escolha antes onde sacar. Se o multiplicador passar do seu alvo, você leva alvo × aposta.' },
  { id: 'minas', nome: 'Minas', dica: 'Abra casas sem achar mina. Cada casa limpa sobe o prêmio: saque quando quiser.' },
]
const FIM: Record<string, string> = {
  blackjack: 'Blackjack! Paga 3:2', banca_blackjack: 'A banca fez blackjack', estourou: 'Estourou: passou de 21', banca_estourou: 'A banca estourou!',
  ganhou: 'Você ganhou da banca', empate: 'Empate: aposta devolvida', perdeu: 'A banca ganhou', mina: 'Achou uma mina', sacou: 'Sacou a tempo', limpou: 'Limpou o campo todo!',
}
const NOME: Record<JogoCassino, string> = Object.fromEntries(JOGOS.map(j => [j.id, j.nome])) as Record<JogoCassino, string>
const x2 = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + 'x'

type Jogada = (fn: (b: Backend) => Promise<Rodada | null>, segura?: boolean) => Promise<Rodada | null>
interface P { aposta: number; busy: boolean; jogada: Jogada; fim: (r: Rodada) => void; trava: (v: boolean) => void }

/** faixa com o resultado da rodada */
function Resultado({ r, txt }: { r: Rodada; txt?: string }) {
  const lucro = r.premio - r.aposta * (r.dobrou ? 2 : 1)
  return (
    <div className={'cs-res ' + (r.premio > 0 ? (lucro >= 0 ? 'win' : 'meio') : 'lose')}>
      {txt && <span>{txt}</span>}
      <b>{r.premio > 0 ? `+${r.premio}` : `−${r.aposta * (r.dobrou ? 2 : 1)}`} <Ph n="coffee" size={14} fill /></b>
    </div>
  )
}

// ---------- caça-níquel ----------
function Caca({ aposta, busy, jogada, fim, trava }: P) {
  const [rolos, setRolos] = useState([1, 1, 1])
  const [r, setR] = useState<Rodada | null>(null)
  const [girando, setGirando] = useState(false)
  const parou = useRef(3), alvo = useRef([1, 1, 1]), timers = useRef<number[]>([])
  useEffect(() => () => timers.current.forEach(t => { clearInterval(t); clearTimeout(t) }), [])
  const gira = async () => {
    setR(null); setGirando(true); trava(true); parou.current = 0
    const roda = window.setInterval(() => setRolos(v => v.map((_, i) => i < parou.current ? alvo.current[i] : Math.floor(Math.random() * 7))), 70)
    timers.current.push(roda)
    const res = await jogada(b => b.cassinoJogar('caca', aposta, {}))
    if (!res) { clearInterval(roda); parou.current = 3; setRolos(alvo.current); setGirando(false); trava(false); return }
    alvo.current = res.resultado.rolos!
    ;[500, 900, 1300].forEach((ms, i) => timers.current.push(window.setTimeout(() => { parou.current = i + 1 }, ms)))
    timers.current.push(window.setTimeout(() => { clearInterval(roda); setRolos(alvo.current); setR(res); setGirando(false); trava(false); fim(res) }, 1400))
  }
  return <>
    <div className="cs-stage cs-slot">
      <div className="cs-rolos">{rolos.map((s, i) => <div key={i} className={'cs-rolo' + (girando && i >= parou.current ? ' gira' : '') + (r && r.premio > 0 ? ' ok' : '')}>{SIMBOLOS[s]}</div>)}</div>
      {r && <Resultado r={r} txt={r.premio > 0 ? `${x2(r.resultado.mult!)} a aposta` : 'Não foi dessa vez'} />}
    </div>
    <div className="cs-ctl"><button className="btn cs-go" disabled={busy || girando} onClick={gira}><Ph n="play" size={16} fill /> Girar</button></div>
  </>
}

// ---------- roleta ----------
const FORA: [TipoRoleta, string][] = [['vermelho', 'Vermelho'], ['preto', 'Preto'], ['par', 'Par'], ['impar', 'Ímpar'], ['baixo', '1–18'], ['alto', '19–36'], ['duzia1', '1ª dúzia'], ['duzia2', '2ª dúzia'], ['duzia3', '3ª dúzia']]
const STEP = 360 / 37
function Roda({ rot }: { rot: number }) {
  const c = 110, R = 104, r0 = 62
  const pt = (a: number, rad: number) => [c + rad * Math.sin(a * Math.PI / 180), c - rad * Math.cos(a * Math.PI / 180)]
  return (
    <svg viewBox="0 0 220 220" className="cs-roda" style={{ transform: `rotate(${rot}deg)` }}>
      <circle cx={c} cy={c} r={R + 4} fill="#6b4423" />
      {RODA.map((n, i) => {
        const a0 = (i - 0.5) * STEP, a1 = (i + 0.5) * STEP
        const [x0, y0] = pt(a0, R), [x1, y1] = pt(a1, R), [x2_, y2] = pt(a1, r0), [x3, y3] = pt(a0, r0), [tx, ty] = pt(i * STEP, R - 11)
        const cor = corDe(n) === 'verde' ? '#2f8f5b' : corDe(n) === 'vermelho' ? '#c8323c' : '#1b1f2b'
        return <g key={n}>
          <path d={`M${x0},${y0} A${R},${R} 0 0 1 ${x1},${y1} L${x2_},${y2} A${r0},${r0} 0 0 0 ${x3},${y3} Z`} fill={cor} stroke="#d9b45a" strokeWidth=".6" />
          <text x={tx} y={ty} transform={`rotate(${i * STEP} ${tx} ${ty})`} textAnchor="middle" dominantBaseline="central" fontSize="8.5" fontWeight="700" fill="#fff">{n}</text>
        </g>
      })}
      <circle cx={c} cy={c} r={r0} fill="#2b2350" stroke="#d9b45a" strokeWidth="2" />
      <circle cx={c} cy={c} r={16} fill="#d9b45a" />
    </svg>
  )
}
function Roleta({ aposta, busy, jogada, fim, trava }: P) {
  const [tipo, setTipo] = useState<TipoRoleta>('vermelho')
  const [num, setNum] = useState<number | null>(null)
  const [rot, setRot] = useState(0)
  const [r, setR] = useState<Rodada | null>(null)
  const [girando, setGirando] = useState(false)
  const t = useRef(0)
  useEffect(() => () => clearTimeout(t.current), [])
  const escolhe = (tp: TipoRoleta, n: number | null = null) => { setTipo(tp); setNum(n) }
  const gira = async () => {
    setR(null); setGirando(true); trava(true)
    const res = await jogada(b => b.cassinoJogar('roleta', aposta, tipo === 'numero' ? { tipo, n: num! } : { tipo }))
    if (!res) { setGirando(false); trava(false); return }
    const i = RODA.indexOf(res.resultado.n!)
    setRot(p => Math.ceil(p / 360) * 360 + 360 * 5 - i * STEP)
    t.current = window.setTimeout(() => { setR(res); setGirando(false); trava(false); fim(res) }, 4300)
  }
  const n = r?.resultado.n
  const sel = (tp: TipoRoleta, k: number | null = null) => tipo === tp && (tp !== 'numero' || num === k) ? ' on' : ''
  const paga = tipo === 'numero' ? 36 : tipo.startsWith('duzia') ? 3 : 2
  return <>
    <div className="cs-stage cs-mesa">
      <div className="cs-roda-wrap"><i className="cs-seta" /><Roda rot={rot} /></div>
      {r && n != null && <div className={'cs-num ' + corDe(n)}>{n}</div>}
      {r && <Resultado r={r} txt={r.premio > 0 ? 'Acertou!' : 'Não foi dessa vez'} />}
    </div>
    <div className="cs-ctl col">
      <div className="cs-pano">
        <button className={'n0' + sel('numero', 0)} disabled={girando} onClick={() => escolhe('numero', 0)}>0</button>
        {[3, 2, 1].flatMap(l => Array.from({ length: 12 }, (_, c) => c * 3 + l)).map(k =>
          <button key={k} className={corDe(k) + sel('numero', k)} disabled={girando} onClick={() => escolhe('numero', k)}>{k}</button>)}
      </div>
      <div className="cs-fora">{FORA.map(([tp, l]) => <button key={tp} className={tp + sel(tp)} disabled={girando} onClick={() => escolhe(tp)}>{l}</button>)}</div>
      <div className="cs-row"><small className="grow">Apostando em <b>{tipo === 'numero' ? `número ${num}` : FORA.find(f => f[0] === tipo)![1]}</b> · paga {paga}x</small>
        <button className="btn cs-go" disabled={busy || girando} onClick={gira}><Ph n="play" size={16} fill /> Girar</button></div>
    </div>
  </>
}

// ---------- blackjack ----------
function Carta({ c, i }: { c?: number; i: number }) {
  if (c == null) return <div className="cs-carta verso" style={{ animationDelay: `${i * 90}ms` }} />
  const s = Math.floor(c / 13), red = s === 1 || s === 2
  return <div className={'cs-carta' + (red ? ' red' : '')} style={{ animationDelay: `${i * 90}ms` }}><b>{FACE[c % 13]}</b><span>{NAIPE[s]}</span></div>
}
/** blackjack e minas: rodada que ficou aberta volta quando o cassino reabre */
function useAberta(jogo: JogoCassino, trava: (v: boolean) => void) {
  const [r, setR] = useState<Rodada | null>(null)
  useEffect(() => { apostar(b => b.cassinoEstado(jogo)).then(x => { if (x) setR(x) }).catch(() => {}) }, [jogo])
  useEffect(() => { trava(!!r?.aberta) }, [r?.aberta]) // eslint-disable-line react-hooks/exhaustive-deps
  return [r, setR] as const
}
function Blackjack({ aposta, busy, jogada, fim, saldo }: P & { saldo: number }) {
  const [r, setR] = useAberta('blackjack', () => {})
  const vai = async (fn: (b: Backend) => Promise<Rodada | null>) => { const x = await jogada(fn, false); if (x) { setR(x); if (!x.aberta) fim(x) } }
  const aberta = !!r?.aberta
  return <>
    <div className="cs-stage cs-feltro">
      {r ? <>
        <div className="cs-mao"><small>Banca · {aberta ? `${r.banca_pontos} + ?` : r.banca_pontos}</small>
          <div className="cs-cartas">{r.banca!.map((c, i) => <Carta key={i + ':' + c} c={c} i={i} />)}{aberta && <Carta i={1} />}</div></div>
        <div className="cs-mao"><small>Você · {r.pontos}{r.dobrou ? ' · dobrou' : ''}</small>
          <div className="cs-cartas">{r.mao!.map((c, i) => <Carta key={i + ':' + c} c={c} i={i} />)}</div></div>
        {!aberta && <Resultado r={r} txt={FIM[r.resultado.fim ?? ''] ?? ''} />}
        {r.retomada && aberta && <small className="cs-ret">Mão que tinha ficado aberta</small>}
      </> : <p className="cs-vazio">Aposta escolhida? Distribua as cartas.</p>}
    </div>
    <div className="cs-ctl">
      {aberta ? <>
        <button className="btn cs-go" disabled={busy} onClick={() => vai(b => b.cassinoAcao(r!.id, 'pedir'))}>Pedir carta</button>
        <button className="btn" disabled={busy} onClick={() => vai(b => b.cassinoAcao(r!.id, 'parar'))}>Parar</button>
        <button className="btn ghost" disabled={busy || r!.mao!.length !== 2 || saldo < r!.aposta} onClick={() => vai(b => b.cassinoAcao(r!.id, 'dobrar'))} title="Dobra a aposta e recebe só mais uma carta">Dobrar</button>
      </> : <button className="btn cs-go" disabled={busy} onClick={() => vai(b => b.cassinoAbrir('blackjack', aposta, {}))}><Ph n="play" size={16} fill /> Distribuir</button>}
    </div>
  </>
}

// ---------- crash ----------
function Crash({ aposta, busy, jogada, fim, trava }: P) {
  const [alvo, setAlvo] = useState(2)
  const [m, setM] = useState(1)
  const [r, setR] = useState<Rodada | null>(null)
  const [voando, setVoando] = useState(false)
  const raf = useRef(0), curva = useRef<[number, number][]>([[0, 1]])
  useEffect(() => () => cancelAnimationFrame(raf.current), [])
  const voa = async () => {
    const a = Math.min(100, Math.max(1.01, Math.round(alvo * 100) / 100))
    setAlvo(a); setR(null); setM(1); trava(true); setVoando(true); curva.current = [[0, 1]]
    const res = await jogada(b => b.cassinoJogar('crash', aposta, { alvo: a }))
    if (!res) { setVoando(false); trava(false); return }
    const ponto = res.resultado.ponto!, k = Math.max(0.35, Math.log(ponto) / 7), t0 = performance.now()
    const tick = (t: number) => {
      const s = (t - t0) / 1000, v = Math.min(ponto, Math.exp(k * s))
      curva.current.push([s, v]); setM(v)
      if (v >= ponto) { setR(res); setVoando(false); trava(false); fim(res); return }
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
  }
  const pts = curva.current, sMax = Math.max(4, pts[pts.length - 1][0]), mMax = Math.max(2, m * 1.15)
  const path = pts.map(([s, v], i) => `${i ? 'L' : 'M'}${(s / sMax) * 300},${170 - ((v - 1) / (mMax - 1)) * 160}`).join(' ')
  const ganhou = !!r && r.premio > 0
  const passou = m >= alvo
  return <>
    <div className={'cs-stage cs-crash' + (r ? (r.premio > 0 ? ' win' : ' boom') : '')}>
      <svg viewBox="0 0 300 180" preserveAspectRatio="none" className="cs-graf">
        <line x1="0" x2="300" y1={170 - ((alvo - 1) / (mMax - 1)) * 160} y2={170 - ((alvo - 1) / (mMax - 1)) * 160} className="cs-alvo" />
        <path d={path} className="cs-linha" />
      </svg>
      <div className="cs-mult"><b className={passou && (voando || ganhou) ? 'ok' : ''}>{x2(m)}</b>
        {voando && passou && <small>passou do seu alvo de {x2(alvo)}</small>}
        {r && <small>{r.premio > 0 ? `Sacou em ${x2(r.resultado.alvo!)} · parou em ${x2(r.resultado.ponto!)}` : `Parou em ${x2(r.resultado.ponto!)} · seu alvo era ${x2(r.resultado.alvo!)}`}</small>}
      </div>
      {r && <Resultado r={r} />}
    </div>
    <div className="cs-ctl col">
      <div className="cs-row">
        <label className="cs-in">Sacar em <input type="number" min={1.01} max={100} step={0.1} value={alvo} disabled={voando} onChange={e => setAlvo(Number(e.target.value) || 1.01)} /> x</label>
        {[1.5, 2, 3, 5, 10].map(v => <button key={v} className={'cs-chip' + (alvo === v ? ' on' : '')} disabled={voando} onClick={() => setAlvo(v)}>{String(v).replace('.', ',')}x</button>)}
      </div>
      <div className="cs-row"><small className="grow">Chance de chegar lá: <b>{Math.min(97, 97 / Math.max(1.01, alvo)).toFixed(1).replace('.', ',')}%</b> · prêmio {Math.floor(aposta * alvo)}</small>
        <button className="btn cs-go" disabled={busy || voando} onClick={voa}><Ph n="play" size={16} fill /> Decolar</button></div>
    </div>
  </>
}

// ---------- minas ----------
function Minas({ aposta, busy, jogada, fim, trava }: P) {
  const [n, setN] = useState(3)
  const [r, setR] = useAberta('minas', trava)
  const vai = async (fn: (b: Backend) => Promise<Rodada | null>) => { const x = await jogada(fn, false); if (x) { setR(x); if (!x.aberta) fim(x) } }
  const aberta = !!r?.aberta
  return <>
    <div className="cs-stage cs-campo">
      <div className="cs-grade">
        {Array.from({ length: 25 }, (_, c) => {
          const aberto = r?.abertas?.includes(c), mina = r?.minas?.includes(c), bum = r?.resultado.casa === c
          const cls = bum ? ' bum' : aberto ? ' ok' : mina ? ' mina' : ''
          return <button key={c} className={'cs-casa' + cls} disabled={!aberta || busy || aberto} onClick={() => vai(b => b.cassinoAcao(r!.id, 'abrir', c))}>
            {mina ? '💣' : aberto ? '💎' : ''}</button>
        })}
      </div>
      {r && !aberta && <Resultado r={r} txt={FIM[r.resultado.fim ?? ''] ?? ''} />}
    </div>
    <div className="cs-ctl col">
      {aberta ? <div className="cs-row">
        <small className="grow">{r!.n} minas · agora <b>{x2(r!.mult!)}</b> · próxima casa {x2(r!.proximo!)}{r!.retomada ? ' · rodada retomada' : ''}</small>
        <button className="btn cs-go" disabled={busy || !r!.abertas!.length} onClick={() => vai(b => b.cassinoAcao(r!.id, 'sacar'))}>Sacar {Math.floor(r!.aposta * r!.mult!)}</button>
      </div> : <div className="cs-row">
        <span className="cs-in">Minas</span>
        {[1, 3, 5, 10, 15, 24].map(v => <button key={v} className={'cs-chip' + (n === v ? ' on' : '')} onClick={() => setN(v)}>{v}</button>)}
        <span className="grow" />
        <button className="btn cs-go" disabled={busy} onClick={() => vai(b => b.cassinoAbrir('minas', aposta, { minas: n }))}><Ph n="play" size={16} fill /> Começar</button>
      </div>}
    </div>
  </>
}

const TELAS = { caca: Caca, roleta: Roleta, blackjack: Blackjack, crash: Crash, minas: Minas }

export default function Cassino({ onClose, inicial }: { onClose: () => void; inicial?: JogoCassino | 'bolao' }) {
  const [jogo, setJogo] = useState<JogoCassino | 'bolao'>(inicial ?? 'caca')
  const [aposta, setAposta] = useState(5)
  const [busy, setBusy] = useState(false)
  const [travado, setTravado] = useState(false)
  const [segura, setSegura] = useState<number | null>(null)
  const [erro, setErro] = useState('')
  const [hist, setHist] = useState<Rodada[]>([])
  const wallet = useStore(s => s.wallet)
  const saldo = segura ?? wallet?.balance ?? 0
  const info = JOGOS.find(j => j.id === jogo)
  const Tela = jogo === 'bolao' ? null : TELAS[jogo]

  useEffect(() => { void refreshWallet() }, [])
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape' && !travado) onClose() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose, travado])

  const jogada: Jogada = async (fn, esconde = true) => {
    setErro(''); setBusy(true)
    try {
      const r = await apostar(fn)
      // o saldo só mostra o prêmio quando a animação termina
      if (r && esconde) setSegura(r.saldo - r.premio)
      return r
    } catch (e) { setErro(e instanceof Error ? e.message : String(e)); return null }
    finally { setBusy(false) }
  }
  const fim = (r: Rodada) => { setSegura(null); setHist(h => [r, ...h.filter(x => x.id !== r.id)].slice(0, 8)) }
  const troca = (j: JogoCassino | 'bolao') => { if (!travado) { setJogo(j); setErro(''); setSegura(null) } }
  const muda = (v: number) => setAposta(Math.max(MIN, Math.min(MAX, Math.round(v))))

  return (
    <Fundo className="modal-bg" onMouseDown={e => e.target === e.currentTarget && !travado && onClose()}>
      <section className="jan jg cs" role="dialog" aria-label="Cassino dos cafezinhos">
        <div className="jg-bar">
          <div className="jg-tabs" role="tablist">
            {JOGOS.map(j => <button key={j.id} role="tab" aria-selected={j.id === jogo} className={j.id === jogo ? 'on' : ''} disabled={travado && j.id !== jogo} onClick={() => troca(j.id)}>{j.nome}</button>)}
            <button role="tab" aria-selected={jogo === 'bolao'} className={'bl-tab' + (jogo === 'bolao' ? ' on' : '')} disabled={travado} onClick={() => troca('bolao')}>🍀 Bolão</button>
          </div>
          <span className="grow" />
          <span className="cs-saldo"><Ph n="coffee" size={16} fill /> <b>{wallet ? saldo : '…'}</b></span>
          <span className="cs-saldo lata" title="Latinhas">⚡ <b>{wallet ? wallet.latinhas : '…'}</b></span>
          <button className="btn ghost sm" onClick={onClose} disabled={travado} aria-label="Fechar"><Ph n="x" size={18} /></button>
        </div>
        {!Tela || !info ? <div className="jg-body bl-body"><Bolao /></div> : <div className="jg-body cs-body">
          <div className="cs-play">
            <Tela key={jogo} aposta={aposta} busy={busy} jogada={jogada} fim={fim} trava={setTravado} saldo={saldo} />
            {erro && <p className="cs-erro">{erro}</p>}
          </div>
          <aside className="jg-rank cs-lado">
            <div className="jg-rh"><b>Aposta</b><span className="grow" /><b className="cs-val">{aposta} <Ph n="coffee" size={14} fill /></b></div>
            <div className="cs-fichas">
              {[1, 5, 10, 25, 50, 100].map(v => <button key={v} className={'cs-ficha' + (aposta === v ? ' on' : '')} disabled={travado} onClick={() => muda(v)}>{v}</button>)}
            </div>
            <div className="cs-row">
              <button className="cs-chip" disabled={travado} onClick={() => muda(aposta / 2)}>½</button>
              <button className="cs-chip" disabled={travado} onClick={() => muda(aposta - 1)}>−1</button>
              <button className="cs-chip" disabled={travado} onClick={() => muda(aposta + 1)}>+1</button>
              <button className="cs-chip" disabled={travado} onClick={() => muda(aposta * 2)}>2x</button>
            </div>
            <p className="cs-dica">{info.dica}</p>
            {jogo === 'caca' && <div className="cs-tab">
              {SIMBOLOS.map((s, i) => <div key={i}><span>{s}{s}{s}</span><b>{TRES[i]}x</b><span>{s}{s}</span><b>{DOIS[i]}x</b></div>).reverse()}
            </div>}
            {hist.length > 0 && <div className="cs-hist">
              <small>Suas últimas</small>
              {hist.map(h => <div key={h.id}><span className="grow">{NOME[h.jogo]}</span><b className={h.premio > 0 ? 'pos' : 'neg'}>{h.premio > 0 ? `+${h.premio}` : `−${h.aposta * (h.dobrou ? 2 : 1)}`}</b></div>)}
            </div>}
            <small className="jg-note">Só diversão: cafezinho não vale dinheiro. Aposta de {MIN} a {MAX}; a casa fica com cerca de 3%.</small>
          </aside>
        </div>}
      </section>
    </Fundo>
  )
}
