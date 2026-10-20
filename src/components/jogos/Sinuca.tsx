import { useCallback, useEffect, useRef, useState } from 'react'
import type { JogoProps } from '../../jogos/catalogo'
import type { Bola, Contexto, Grupo } from '../../jogos/sinuca'
import { A, CACAPAS, L, MAX_V, R, avancar, emMovimento, grupoDe, montarMesa, pontoLivre, resolverTacada } from '../../jogos/sinuca'
import './mesas.css'

const CW = 880, CH = 480, M = 40
const CORES_BOLA = ['#f4f4f4', '#f5c518', '#1e56c8', '#d32f2f', '#6a2c91', '#f57c00', '#1b7a3a', '#7b1e1e', '#111']
const corDe = (id: number) => CORES_BOLA[id === 8 ? 8 : id === 0 ? 0 : ((id - 1) % 8) + 1]

interface Jogo { bolas: Bola[]; vez: 0 | 1; grupos: [Grupo | null, Grupo | null]; movendo: boolean; passos: number; ctx: Contexto; antes: number[]; fim: boolean }
interface Ui { vez: 0 | 1; grupos: [Grupo | null, Grupo | null]; rest: [number, number]; aviso: string; vencedor: 0 | 1 | null; motivo: string }

const novoJogo = (): Jogo => ({ bolas: montarMesa(), vez: 0, grupos: [null, null], movendo: false, passos: 0, ctx: { encacapadas: [], primeiro: null }, antes: [], fim: false })
const restantes = (j: Jogo): [number, number] => [0, 1].map(i => {
  const g = j.grupos[i]
  return g ? j.bolas.filter(b => !b.fora && grupoDe(b.id) === g).length : 7
}) as [number, number]
const instantaneo = (j: Jogo, aviso: string, vencedor: 0 | 1 | null = null, motivo = ''): Ui => ({ vez: j.vez, grupos: [j.grupos[0], j.grupos[1]], rest: restantes(j), aviso, vencedor, motivo })

function desenhar(cv: HTMLCanvasElement, j: Jogo, ang: number, pot: number) {
  const c = cv.getContext('2d')
  if (!c) return
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  if (cv.width !== CW * dpr) { cv.width = CW * dpr; cv.height = CH * dpr }
  c.setTransform(dpr, 0, 0, dpr, 0, 0)
  c.clearRect(0, 0, CW, CH)
  const mad = c.createLinearGradient(0, 0, 0, CH)
  mad.addColorStop(0, '#7a4e2a'); mad.addColorStop(1, '#4a2d15')
  c.fillStyle = mad; c.beginPath(); c.roundRect(0, 0, CW, CH, 18); c.fill()
  c.save(); c.translate(M, M)
  c.fillStyle = '#1b7d44'; c.fillRect(0, 0, L, A)
  c.strokeStyle = '#0f5a2e'; c.lineWidth = 4; c.strokeRect(0, 0, L, A)
  c.strokeStyle = '#ffffff22'; c.lineWidth = 1.5
  c.beginPath(); c.moveTo(200, 0); c.lineTo(200, A); c.stroke()
  c.fillStyle = '#0a0a0a'
  for (const p of CACAPAS) { c.beginPath(); c.arc(p.x, p.y, p.r - 4, 0, Math.PI * 2); c.fill() }
  const br = j.bolas[0]
  if (!j.movendo && !j.fim && !br.fora) {
    const dx = Math.cos(ang), dy = Math.sin(ang), recuo = 18 + pot * 0.9
    c.strokeStyle = '#ffffff88'; c.lineWidth = 2; c.setLineDash([6, 6])
    c.beginPath(); c.moveTo(br.x + dx * R, br.y + dy * R); c.lineTo(br.x + dx * 170, br.y + dy * 170); c.stroke(); c.setLineDash([])
    c.strokeStyle = '#e8c88a'; c.lineWidth = 5; c.lineCap = 'round'
    c.beginPath(); c.moveTo(br.x - dx * (R + recuo), br.y - dy * (R + recuo)); c.lineTo(br.x - dx * (R + recuo + 230), br.y - dy * (R + recuo + 230)); c.stroke()
  }
  for (const b of j.bolas) {
    if (b.fora) continue
    c.fillStyle = b.id > 8 ? '#f4f4f4' : corDe(b.id)
    c.beginPath(); c.arc(b.x, b.y, R, 0, Math.PI * 2); c.fill()
    if (b.id > 8) {
      c.save(); c.beginPath(); c.arc(b.x, b.y, R, 0, Math.PI * 2); c.clip()
      c.fillStyle = corDe(b.id); c.fillRect(b.x - R, b.y - R * 0.55, R * 2, R * 1.1); c.restore()
    }
    if (b.id > 0) {
      c.fillStyle = '#f4f4f4'; c.beginPath(); c.arc(b.x, b.y, R * 0.5, 0, Math.PI * 2); c.fill()
      c.fillStyle = '#111'; c.font = 'bold 8px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'
      c.fillText(String(b.id), b.x, b.y + 0.5)
    }
    c.strokeStyle = '#0004'; c.lineWidth = 1; c.beginPath(); c.arc(b.x, b.y, R, 0, Math.PI * 2); c.stroke()
  }
  c.restore()
}

export default function Sinuca({ onPts, onFim }: JogoProps) {
  const J = useRef<Jogo | null>(null)
  if (!J.current) J.current = novoJogo()
  const cv = useRef<HTMLCanvasElement>(null)
  const raf = useRef(0)
  const ultimoFrame = useRef(0)
  const vivo = useRef(true)
  const fimEnviado = useRef(false)
  const [ang, setAng] = useState(0)
  const [pot, setPot] = useState(50)
  const [ui, setUi] = useState<Ui>(() => instantaneo(J.current!, 'Jogador 1 começa. Mire e dê a tacada.'))
  const [movendo, setMovendo] = useState(false)
  const aim = useRef({ ang, pot })
  aim.current = { ang, pot }

  const redesenhar = useCallback(() => { if (cv.current && J.current) desenhar(cv.current, J.current, aim.current.ang, aim.current.pot) }, [])

  const resolver = useCallback(() => {
    const j = J.current!
    const res = resolverTacada(j.vez, j.grupos, j.ctx, j.antes)
    j.grupos = res.grupos
    const br = j.bolas[0]
    if (br.fora) { const p = pontoLivre(j.bolas); br.x = p.x; br.y = p.y; br.vx = 0; br.vy = 0; br.fora = false }
    j.vez = res.vez
    onPts(j.bolas.filter(b => b.fora && b.id > 0).length)
    if (res.fim) {
      j.fim = true; j.vez = res.fim.vencedor
      setUi(instantaneo(j, `Jogador ${res.fim.vencedor + 1} venceu.`, res.fim.vencedor, res.fim.motivo))
    } else {
      setUi(instantaneo(j, res.aviso))
    }
    setMovendo(false)
  }, [onPts])

  const quadro = useCallback(() => {
    const j = J.current!
    if (!vivo.current || !j.movendo) return
    const agora = performance.now()
    const passos = Math.min(3000 - j.passos, Math.max(3, Math.floor((agora - ultimoFrame.current) * 0.18)))
    ultimoFrame.current = agora
    for (let i = 0; i < passos; i++) avancar(j.bolas, j.ctx)
    j.passos += passos
    if (!emMovimento(j.bolas) || j.passos >= 3000) {
      for (const b of j.bolas) { b.vx = 0; b.vy = 0 }
      j.movendo = false
      redesenhar()
      resolver()
      return
    }
    redesenhar()
    raf.current = requestAnimationFrame(quadro)
  }, [redesenhar, resolver])

  useEffect(() => {
    vivo.current = true
    return () => { vivo.current = false; cancelAnimationFrame(raf.current) }
  }, [])
  useEffect(() => { redesenhar() }, [ang, pot, ui, redesenhar])

  const tacada = () => {
    const j = J.current!
    if (j.movendo || j.fim) return
    const v = (Math.max(5, pot) / 100) * MAX_V
    const br = j.bolas[0]
    br.vx = Math.cos(ang) * v; br.vy = Math.sin(ang) * v
    j.ctx = { encacapadas: [], primeiro: null }
    j.antes = j.bolas.filter(b => !b.fora && b.id > 0).map(b => b.id)
    j.movendo = true; j.passos = 0
    ultimoFrame.current = performance.now()
    setMovendo(true)
    setUi(u => ({ ...u, aviso: 'Bolas em movimento...' }))
    cancelAnimationFrame(raf.current)
    raf.current = requestAnimationFrame(quadro)
  }

  const mirar = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const j = J.current!
    if (j.movendo || j.fim) return
    if (e.pointerType !== 'mouse' && e.type === 'pointermove' && e.buttons === 0) return
    const r = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - r.left) / r.width) * CW - M, py = ((e.clientY - r.top) / r.height) * CH - M
    const br = j.bolas[0]
    if (Math.hypot(px - br.x, py - br.y) < 4) return
    setAng(Math.atan2(py - br.y, px - br.x))
  }
  const girar = (d: number) => setAng(a => a + d)
  const teclas = (e: React.KeyboardEvent<HTMLCanvasElement>) => {
    const fino = e.shiftKey ? 0.004 : 0.02
    if (e.key === 'ArrowLeft') girar(-fino)
    else if (e.key === 'ArrowRight') girar(fino)
    else if (e.key === 'ArrowUp') setPot(p => Math.min(100, p + 5))
    else if (e.key === 'ArrowDown') setPot(p => Math.max(5, p - 5))
    else if (e.key === ' ' || e.key === 'Enter') tacada()
    else return
    e.preventDefault()
  }
  const finalizar = () => {
    if (fimEnviado.current || ui.vencedor === null) return
    fimEnviado.current = true
    const g = ui.grupos[ui.vencedor]
    const feitas = g ? 7 - ui.rest[ui.vencedor] : 0
    onFim(feitas + 1)
  }

  const nomeGrupo = (g: Grupo | null) => (g ? (g === 'lisas' ? 'Lisas (1 a 7)' : 'Listradas (9 a 15)') : 'Grupo livre')
  const bloqueado = movendo || ui.vencedor !== null

  return (
    <div className="mesa-raiz">
      <div className="mesa-hud">
        {[0, 1].map(i => (
          <div key={i} className={'mesa-jog' + (ui.vez === i && ui.vencedor === null ? ' mesa-ativo' : '')}>
            <b>Jogador {i + 1}{ui.vez === i && ui.vencedor === null ? ' (vez)' : ''}</b>
            {nomeGrupo(ui.grupos[i])}: {ui.grupos[i] ? `${ui.rest[i as 0 | 1]} restantes` : '7 restantes'}
          </div>
        ))}
      </div>
      <p className="mesa-aviso" role="status" aria-live="polite">{ui.aviso}</p>
      <div className="mesa-canvas-wrap">
        <canvas
          ref={cv} className="mesa-canvas" width={CW} height={CH} tabIndex={0}
          aria-label="Mesa de sinuca. Setas esquerda e direita giram a mira, cima e baixo ajustam a força, espaço dá a tacada."
          onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); mirar(e) }}
          onPointerMove={mirar} onKeyDown={teclas}
        />
      </div>
      <div className="mesa-controles">
        <button type="button" className="mesa-btn" disabled={bloqueado} onClick={() => girar(-0.05)} aria-label="Girar mira para a esquerda">Mira −</button>
        <button type="button" className="mesa-btn" disabled={bloqueado} onClick={() => girar(0.05)} aria-label="Girar mira para a direita">Mira +</button>
        <label className="mesa-forca">Força
          <input type="range" min={5} max={100} step={1} value={pot} disabled={bloqueado} onChange={e => setPot(Number(e.target.value))} aria-label="Força da tacada" />
          <span>{pot}</span>
        </label>
        <button type="button" className="mesa-btn mesa-forte" disabled={bloqueado} onClick={tacada}>Tacada</button>
      </div>
      <p className="mesa-dica">Toque ou arraste na mesa para mirar. Teclado: setas e espaço (Shift = mira fina).</p>
      {ui.vencedor !== null && (
        <div className="mesa-fim" role="status">
          <h3>Jogador {ui.vencedor + 1} venceu!</h3>
          <p>{ui.motivo}</p>
          <button type="button" className="mesa-btn mesa-forte" onClick={finalizar}>Finalizar</button>
        </div>
      )}
    </div>
  )
}
