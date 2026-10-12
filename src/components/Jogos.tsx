import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getState, myDept, putRow, run, useStore } from '../store'
import type { Jogo } from '../office/world'
import { Ph } from './Icon'
import type { PhName } from './ph'
import MiniAvatar from './MiniAvatar'

/** os jogos da sala de jogos (o móvel que abre cada um está em world.ts) */
const JOGOS: { id: Jogo; nome: string; onde: string; dica: string }[] = [
  { id: 'cobrinha', nome: 'Cobrinha', onde: 'Fliperama', dica: 'Setas, WASD ou arraste. Pegue o café e não bata.' },
  { id: 'penalti', nome: 'Pênalti', onde: 'Pebolim', dica: 'Espaço ou clique pra chutar. Mire longe do goleiro: 10 cobranças.' },
  { id: 'memoria', nome: 'Memória', onde: 'Mesa de jogos', dica: 'Ache os 8 pares. Menos erros e menos tempo valem mais.' },
  { id: 'reflexo', nome: 'Reflexo', onde: 'Videogame', dica: 'Clique nos alvos por 30 segundos. Clique no vazio tira ponto.' },
]
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const mesAgora = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
const mesNome = (m: string) => MESES[Number(m.slice(5)) - 1] ?? m

/** grava a partida: o recorde do mês só sobe (o banco garante também) */
function salvar(jogo: Jogo, pontos: number) {
  const s = getState(), me = s.meId
  if (!me) return false
  const mes = mesAgora(), id = `${me}:${jogo}:${mes}`, old = s.rows.jogos_pontos[id], now = new Date().toISOString()
  pontos = Math.max(0, Math.round(pontos))
  run(putRow('jogos_pontos', { id, user_id: me, dept: old?.dept ?? myDept(s), jogo, mes, pontos: Math.max(old?.pontos ?? 0, pontos), partidas: (old?.partidas ?? 0) + 1, created_at: old?.created_at ?? now, updated_at: now }))
  return pontos > 0 && pontos > (old?.pontos ?? 0)
}

interface GameProps { onPts: (n: number) => void; onFim: (n: number) => void }
const W = 288
const rnd = (n: number) => Math.floor(Math.random() * n)
/** posição do clique em pixels do jogo (o canvas é esticado no CSS) */
const ponto = (c: HTMLCanvasElement, e: { clientX: number; clientY: number }) => { const r = c.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * W } }

/** laço de animação que para sozinho quando o jogo sai da tela */
function useLoop(ref: React.RefObject<HTMLCanvasElement | null>, setup: (c: CanvasRenderingContext2D, el: HTMLCanvasElement) => { frame: (dt: number, t: number) => void; off?: () => void }) {
  useEffect(() => {
    const el = ref.current
    const c = el?.getContext('2d')
    if (!el || !c) return
    const g = setup(c, el)
    let raf = 0, last = performance.now(), on = true
    const tick = (t: number) => { if (!on) return; g.frame(Math.min(100, t - last), t); last = t; raf = requestAnimationFrame(tick) }
    raf = requestAnimationFrame(tick)
    return () => { on = false; cancelAnimationFrame(raf); g.off?.() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
}

const SETAS: Record<string, [number, number]> = { arrowup: [0, -1], w: [0, -1], arrowdown: [0, 1], s: [0, 1], arrowleft: [-1, 0], a: [-1, 0], arrowright: [1, 0], d: [1, 0] }

function Cobrinha({ onPts, onFim }: GameProps) {
  const ref = useRef<HTMLCanvasElement>(null)
  useLoop(ref, (c, el) => {
    const N = 18, S = W / N
    const cobra = [{ x: 8, y: 9 }, { x: 7, y: 9 }, { x: 6, y: 9 }]
    let dir = { x: 1, y: 0 }, pts = 0, passo = 150, acc = 0, vivo = true
    const fila: { x: number; y: number }[] = []
    const nova = () => { for (;;) { const p = { x: rnd(N), y: rnd(N) }; if (!cobra.some(q => q.x === p.x && q.y === p.y)) return p } }
    let cafe = nova()
    const vira = (x: number, y: number) => { const u = fila.at(-1) ?? dir; if ((x === -u.x && y === -u.y) || (x === u.x && y === u.y) || fila.length > 2) return; fila.push({ x, y }) }
    const key = (e: KeyboardEvent) => { const m = SETAS[e.key.toLowerCase()]; if (!m) return; e.preventDefault(); vira(m[0], m[1]) }
    let ini: { x: number; y: number } | null = null
    const down = (e: PointerEvent) => { ini = ponto(el, e) }
    const up = (e: PointerEvent) => {
      if (!ini) return
      const p = ponto(el, e), dx = p.x - ini.x, dy = p.y - ini.y
      ini = null
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 12) return
      if (Math.abs(dx) > Math.abs(dy)) vira(Math.sign(dx), 0); else vira(0, Math.sign(dy))
    }
    window.addEventListener('keydown', key)
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointerup', up)
    const anda = () => {
      dir = fila.shift() ?? dir
      const h = { x: cobra[0].x + dir.x, y: cobra[0].y + dir.y }
      if (h.x < 0 || h.y < 0 || h.x >= N || h.y >= N || cobra.slice(0, -1).some(q => q.x === h.x && q.y === h.y)) { vivo = false; return onFim(pts) }
      cobra.unshift(h)
      if (h.x === cafe.x && h.y === cafe.y) { pts += 10; onPts(pts); passo = Math.max(70, passo - 4); cafe = nova() } else cobra.pop()
    }
    return {
      frame: (dt, t) => {
        if (vivo) { acc += dt; while (vivo && acc >= passo) { acc -= passo; anda() } }
        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { c.fillStyle = (x + y) % 2 ? '#222a3b' : '#26304a'; c.fillRect(x * S, y * S, S, S) }
        // café: xícara branca com o café por cima
        const cx = cafe.x * S, cy = cafe.y * S, b = Math.sin(t / 220) > 0 ? 0 : 1
        c.fillStyle = '#fbfbf8'; c.fillRect(cx + 3, cy + 5 + b, 9, 8); c.fillRect(cx + 12, cy + 7 + b, 2, 4)
        c.fillStyle = '#7a4a2a'; c.fillRect(cx + 4, cy + 5 + b, 7, 2)
        cobra.forEach((q, i) => { c.fillStyle = i ? (i % 2 ? '#3fa66b' : '#47b877') : '#2e8a56'; c.fillRect(q.x * S + 1, q.y * S + 1, S - 2, S - 2) })
        const h = cobra[0]
        const mx = h.x * S + S / 2 + dir.x * 3 - 1, my = h.y * S + S / 2 + dir.y * 3 - 1
        c.fillStyle = '#fbfbf8'; c.fillRect(mx - dir.y * 3, my + dir.x * 3, 3, 3); c.fillRect(mx + dir.y * 3, my - dir.x * 3, 3, 3)
        if (!vivo) { c.fillStyle = 'rgba(232,80,138,.25)'; c.fillRect(0, 0, W, W) }
      },
      off: () => { window.removeEventListener('keydown', key); el.removeEventListener('pointerdown', down); el.removeEventListener('pointerup', up) },
    }
  })
  return <canvas ref={ref} width={W} height={W} className="jg-cv" aria-label="Cobrinha" />
}

function Penalti({ onPts, onFim }: GameProps) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [chutes, setChutes] = useState<boolean[]>([])
  useLoop(ref, (c, el) => {
    const G0 = 30, G1 = W - 30, GY = 54, GH = 84, KW = 58
    let kx = W / 2, kv = 0.07, mx = G0 + 10, mv = 0.16, pts = 0, n = 0, voo: { x: number; t: number } | null = null, fim = false
    const res: boolean[] = []
    let aviso: { txt: string; ate: number } | null = null
    const chuta = () => { if (voo || fim) return; voo = { x: mx, t: 0 } }
    const key = (e: KeyboardEvent) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); chuta() } }
    window.addEventListener('keydown', key)
    el.addEventListener('pointerdown', chuta)
    return {
      frame: (dt, t) => {
        // goleiro patrulha e muda de ideia de vez em quando; a mira vai e volta
        kx += kv * dt
        if (kx < G0 + KW / 2 || kx > G1 - KW / 2) { kv = -kv; kx = Math.max(G0 + KW / 2, Math.min(G1 - KW / 2, kx)) }
        if (Math.random() < dt / 900) kv = -kv
        if (!voo) { mx += mv * dt; if (mx < G0 + 6 || mx > G1 - 6) { mv = -mv; mx = Math.max(G0 + 6, Math.min(G1 - 6, mx)) } }
        else {
          voo.t += dt
          // o goleiro pula pro lado da bola (cada cobrança reage mais rápido)
          const pulo = 0.05 * (1 + n * 0.1) * dt
          kx += Math.max(-pulo, Math.min(pulo, voo.x - kx))
          if (voo.t >= 420) {
            const gol = Math.abs(voo.x - kx) > KW / 2 + 5
            if (gol) pts += 100 + Math.round(50 * Math.min(1, Math.abs(voo.x - W / 2) / ((G1 - G0) / 2)))
            res.push(gol); setChutes([...res]); onPts(pts); n++
            aviso = { txt: gol ? 'GOL!' : 'Defendeu', ate: t + 700 }
            voo = null
            const sp = 1 + n * 0.12
            kv = Math.sign(kv || 1) * 0.07 * sp; mv = Math.sign(mv || 1) * 0.16 * sp
            if (n >= 10) { fim = true; onFim(pts) }
          }
        }
        // campo, gol e rede
        c.fillStyle = '#3f8f52'; c.fillRect(0, 0, W, W)
        for (let i = 0; i < 6; i++) { c.fillStyle = i % 2 ? '#3a8a4d' : '#44975a'; c.fillRect(0, GY + GH + i * 26, W, 26) }
        c.fillStyle = '#2d6b3d'; c.fillRect(G0, GY, G1 - G0, GH)
        c.fillStyle = 'rgba(255,255,255,.18)'
        for (let x = G0; x < G1; x += 10) c.fillRect(x, GY, 1, GH)
        for (let y = GY; y < GY + GH; y += 10) c.fillRect(G0, y, G1 - G0, 1)
        c.fillStyle = '#fbfbf8'; c.fillRect(G0 - 4, GY - 4, G1 - G0 + 8, 4); c.fillRect(G0 - 4, GY, 4, GH); c.fillRect(G1, GY, 4, GH)
        c.fillRect(0, GY + GH, W, 2); c.fillRect(W / 2 - 2, 236, 4, 3)
        // goleiro
        const ky = GY + GH - 46
        c.fillStyle = '#FBC222'; c.fillRect(kx - KW / 2, ky + 14, KW, 8)
        c.fillStyle = '#26324F'; c.fillRect(kx - 9, ky + 10, 18, 26)
        c.fillStyle = '#e9b48a'; c.fillRect(kx - 6, ky, 12, 11)
        c.fillStyle = '#17171c'; c.fillRect(kx - 8, ky + 36, 6, 10); c.fillRect(kx + 2, ky + 36, 6, 10)
        // mira
        if (!voo && !fim) { c.strokeStyle = '#fbfbf8'; c.lineWidth = 2; c.beginPath(); c.arc(mx, GY + GH / 2, 9, 0, 7); c.stroke(); c.fillStyle = '#e8508a'; c.fillRect(mx - 1, GY + GH / 2 - 1, 3, 3) }
        // bola
        const p = voo ? Math.min(1, voo.t / 420) : 0, bx = voo ? W / 2 + (voo.x - W / 2) * p : W / 2, by = voo ? 230 - (230 - (GY + GH / 2)) * p : 230, br = 8 - 3 * p
        c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(bx, by + br + 2, br, 3, 0, 0, 7); c.fill()
        c.fillStyle = '#fbfbf8'; c.beginPath(); c.arc(bx, by, br, 0, 7); c.fill()
        c.fillStyle = '#26324F'; c.fillRect(bx - 2, by - 2, 4, 4)
        if (aviso && t < aviso.ate) { c.fillStyle = aviso.txt === 'GOL!' ? '#FBC222' : '#fbfbf8'; c.font = '800 28px Poppins, sans-serif'; c.textAlign = 'center'; c.fillText(aviso.txt, W / 2, 30) }
      },
      off: () => { window.removeEventListener('keydown', key); el.removeEventListener('pointerdown', chuta) },
    }
  })
  return (
    <div className="jg-col">
      <canvas ref={ref} width={W} height={W} className="jg-cv" aria-label="Pênalti" />
      <div className="jg-shots" aria-label="Cobranças">{Array.from({ length: 10 }, (_, i) => <i key={i} className={i >= chutes.length ? '' : chutes[i] ? 'gol' : 'def'} />)}</div>
    </div>
  )
}

const FIGURAS: PhName[] = ['coffee', 'star', 'trophy', 'crown', 'medal', 'gift', 'smiley', 'confetti']
const CORES = ['#7a4a2a', '#e0a400', '#8e5bd6', '#d68a00', '#3a6fd8', '#e8508a', '#3fa66b', '#26324F']

function Memoria({ onPts, onFim }: GameProps) {
  const [cartas] = useState(() => [...FIGURAS.keys(), ...FIGURAS.keys()].map(f => ({ f, k: Math.random() })).sort((a, b) => a.k - b.k).map(x => x.f))
  const [abertas, setAbertas] = useState<number[]>([])
  const [achadas, setAchadas] = useState<Set<number>>(new Set())
  const [erros, setErros] = useState(0)
  const [t0, setT0] = useState(0)
  const [seg, setSeg] = useState(0)
  const nota = (e: number, s: number) => Math.max(100, 1000 - e * 30 - s * 5)
  useEffect(() => {
    if (!t0 || achadas.size === 16) return
    const iv = setInterval(() => { const s = Math.floor((Date.now() - t0) / 1000); setSeg(s); onPts(nota(erros, s)) }, 500)
    return () => clearInterval(iv)
  }, [t0, achadas.size, erros, onPts])
  const vira = (i: number) => {
    if (abertas.length === 2 || abertas.includes(i) || achadas.has(i)) return
    if (!t0) setT0(Date.now())
    const ab = [...abertas, i]
    setAbertas(ab)
    if (ab.length < 2) return
    if (cartas[ab[0]] === cartas[ab[1]]) {
      const ac = new Set(achadas).add(ab[0]).add(ab[1])
      setAchadas(ac); setAbertas([])
      if (ac.size === 16) { const s = Math.floor((Date.now() - (t0 || Date.now())) / 1000); setSeg(s); onPts(nota(erros, s)); onFim(nota(erros, s)) }
    } else { setErros(e => e + 1); setTimeout(() => setAbertas([]), 650) }
  }
  return (
    <div className="jg-col">
      <div className="jg-mem" role="grid" aria-label="Memória">
        {cartas.map((f, i) => {
          const vis = abertas.includes(i) || achadas.has(i)
          return (
            <button key={i} className={`jg-card${vis ? ' on' : ''}${achadas.has(i) ? ' ok' : ''}`} onClick={() => vira(i)} aria-label={vis ? FIGURAS[f] : 'Carta virada'} style={vis ? { color: CORES[f] } : undefined}>
              {vis ? <Ph n={FIGURAS[f]} size={30} fill /> : <span className="jg-back" />}
            </button>
          )
        })}
      </div>
      <div className="jg-info"><span><Ph n="x" size={14} /> {erros} erros</span><span>{seg} s</span></div>
    </div>
  )
}

function Reflexo({ onPts, onFim }: GameProps) {
  const ref = useRef<HTMLCanvasElement>(null)
  useLoop(ref, (c, el) => {
    const DUR = 30000
    let tempo = 0, pts = 0, fim = false, alvo: { x: number; y: number; r: number; nasce: number; vida: number } | null = null, espera = 500
    const fx: { x: number; y: number; txt: string; ate: number; cor: string }[] = []
    const novo = () => { const r = 16 + rnd(8); alvo = { x: r + rnd(W - 2 * r), y: r + 22 + rnd(W - 2 * r - 22), r, nasce: tempo, vida: Math.max(650, 1400 - tempo / 30) } }
    const clica = (e: PointerEvent) => {
      if (fim) return
      const p = ponto(el, e)
      if (alvo && Math.hypot(p.x - alvo.x, p.y - alvo.y) <= alvo.r + 4) {
        const rap = tempo - alvo.nasce < 450 ? 5 : 0
        pts += 10 + rap; fx.push({ x: alvo.x, y: alvo.y, txt: `+${10 + rap}`, ate: tempo + 500, cor: '#FBC222' })
        alvo = null; espera = 120 + rnd(300)
      } else { pts = Math.max(0, pts - 5); fx.push({ x: p.x, y: p.y, txt: '-5', ate: tempo + 500, cor: '#e8508a' }) }
      onPts(pts)
    }
    el.addEventListener('pointerdown', clica)
    return {
      frame: dt => {
        if (!fim) {
          tempo += dt
          if (alvo && tempo - alvo.nasce > alvo.vida) { alvo = null; espera = 150 }
          if (!alvo) { espera -= dt; if (espera <= 0) novo() }
          if (tempo >= DUR) { fim = true; alvo = null; onFim(pts) }
        }
        c.fillStyle = '#1d2433'; c.fillRect(0, 0, W, W)
        c.fillStyle = 'rgba(255,255,255,.04)'
        for (let x = 0; x < W; x += 24) c.fillRect(x, 0, 1, W)
        for (let y = 0; y < W; y += 24) c.fillRect(0, y, W, 1)
        // tempo que falta
        c.fillStyle = '#2d3650'; c.fillRect(8, 8, W - 16, 6)
        c.fillStyle = tempo > DUR - 5000 ? '#e8508a' : '#8e5bd6'; c.fillRect(8, 8, (W - 16) * Math.max(0, 1 - tempo / DUR), 6)
        if (alvo) {
          const k = 1 - (tempo - alvo.nasce) / alvo.vida
          c.fillStyle = '#e8508a'; c.beginPath(); c.arc(alvo.x, alvo.y, alvo.r, 0, 7); c.fill()
          c.fillStyle = '#fbfbf8'; c.beginPath(); c.arc(alvo.x, alvo.y, alvo.r * 0.62, 0, 7); c.fill()
          c.fillStyle = '#e8508a'; c.beginPath(); c.arc(alvo.x, alvo.y, alvo.r * 0.28, 0, 7); c.fill()
          c.strokeStyle = 'rgba(251,194,34,.8)'; c.lineWidth = 2; c.beginPath(); c.arc(alvo.x, alvo.y, alvo.r + 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); c.stroke()
        }
        c.font = '700 14px Poppins, sans-serif'; c.textAlign = 'center'
        for (let i = fx.length - 1; i >= 0; i--) { const f = fx[i]; if (tempo > f.ate) { fx.splice(i, 1); continue } c.fillStyle = f.cor; c.fillText(f.txt, f.x, f.y - 14 - (500 - (f.ate - tempo)) / 25) }
      },
      off: () => el.removeEventListener('pointerdown', clica),
    }
  })
  return <canvas ref={ref} width={W} height={W} className="jg-cv cross" aria-label="Reflexo" />
}

const TELAS: Record<Jogo, (p: GameProps) => React.ReactElement> = { cobrinha: Cobrinha, penalti: Penalti, memoria: Memoria, reflexo: Reflexo }

export default function Jogos({ inicio, onClose }: { inicio: Jogo; onClose: () => void }) {
  const [jogo, setJogo] = useState<Jogo>(inicio)
  const [fase, setFase] = useState<'pronto' | 'jogando' | 'fim'>('pronto')
  const [rodada, setRodada] = useState(0)
  const [pts, setPts] = useState(0)
  const [rec, setRec] = useState(false)
  const [aba, setAba] = useState<'jogo' | 'geral'>('jogo')
  const meId = useStore(s => s.meId)
  const dept = useStore(s => s.sala)
  const linhas = useStore(s => s.rows.jogos_pontos)
  const profiles = useStore(s => s.profiles)
  const mes = mesAgora()
  const info = JOGOS.find(j => j.id === jogo)!
  const Tela = TELAS[jogo]

  // Esc fecha mesmo com o foco no canvas
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])

  const troca = (j: Jogo) => { setJogo(j); setFase('pronto'); setPts(0); setRodada(r => r + 1) }
  const joga = () => { setPts(0); setRec(false); setFase('jogando'); setRodada(r => r + 1) }
  const fim = useCallback((n: number) => { setPts(n); setRec(salvar(jogo, n)); setFase('fim') }, [jogo])

  // ranking do setor do andar no mês: recorde de cada um no jogo, ou a soma dos recordes dos 4 jogos
  const ranking = useMemo(() => {
    const por = new Map<string, number>()
    for (const r of Object.values(linhas)) {
      if (r.mes !== mes || r.dept !== dept || (aba === 'jogo' && r.jogo !== jogo)) continue
      por.set(r.user_id, (por.get(r.user_id) ?? 0) + r.pontos)
    }
    return [...por].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1])
  }, [linhas, mes, dept, aba, jogo])
  const meu = meId ? linhas[`${meId}:${jogo}:${mes}`]?.pontos ?? 0 : 0

  return (
    <div className="modal-bg" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <section className="modal jg" role="dialog" aria-label="Sala de jogos">
        <div className="jg-bar">
          <div className="jg-tabs" role="tablist">
            {JOGOS.map(j => <button key={j.id} role="tab" aria-selected={j.id === jogo} className={j.id === jogo ? 'on' : ''} onClick={() => troca(j.id)}>{j.nome}</button>)}
          </div>
          <span className="grow" />
          <button className="btn ghost sm" onClick={onClose} aria-label="Fechar" autoFocus><Ph n="x" size={18} /></button>
        </div>
        <div className="jg-body">
          <div className="jg-play">
            <div className="jg-score"><b>{pts}</b><span>pontos</span><span className="grow" /><span className="jg-best"><Ph n="star" size={14} fill /> seu recorde: {meu}</span></div>
            <div className="jg-stage">
              {fase === 'pronto' ? (
                <div className="jg-over">
                  <small>{info.onde}</small>
                  <b>{info.nome}</b>
                  <p>{info.dica}</p>
                  <button className="btn" onClick={joga}><Ph n="play" size={16} fill /> Jogar</button>
                </div>
              ) : (
                <>
                  <Tela key={rodada} onPts={setPts} onFim={fim} />
                  {fase === 'fim' && (
                    <div className="jg-over dim">
                      {rec && <span className="jg-rec"><Ph n="trophy" size={16} fill /> Novo recorde do mês</span>}
                      <b>{pts} pontos</b>
                      <button className="btn" onClick={joga}><Ph n="play" size={16} fill /> Jogar de novo</button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
          <aside className="jg-rank">
            <div className="jg-rh"><Ph n="trophy" size={18} /> <b>Ranking de {mesNome(mes)}</b></div>
            <div className="jg-seg">
              <button className={aba === 'jogo' ? 'on' : ''} onClick={() => setAba('jogo')}>{info.nome}</button>
              <button className={aba === 'geral' ? 'on' : ''} onClick={() => setAba('geral')}>Geral</button>
            </div>
            {ranking.length === 0 ? <p className="jg-empty">Ninguém do setor jogou ainda este mês.</p> : (
              <ol className="jg-list">
                {ranking.slice(0, 10).map(([uid, n], i) => {
                  const p = profiles[uid]
                  return (
                    <li key={uid} className={uid === meId ? 'me' : ''}>
                      <span className={`jg-pos p${i + 1}`}>{i === 0 ? <Ph n="crown" size={15} fill /> : i < 3 ? <Ph n="medal" size={15} fill /> : i + 1}</span>
                      <MiniAvatar avatar={p?.avatar} photo={p?.photo} name={p?.name ?? '?'} size={26} />
                      <span className="grow">{p?.name ?? 'Alguém'}</span>
                      <b>{n}</b>
                    </li>
                  )
                })}
              </ol>
            )}
            <small className="jg-note">{aba === 'geral' ? 'Soma do recorde de cada um nos 4 jogos.' : 'Vale o melhor resultado de cada um no mês.'} Zera todo mês.</small>
          </aside>
        </div>
      </section>
    </div>
  )
}
