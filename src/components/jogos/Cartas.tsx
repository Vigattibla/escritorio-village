import { useEffect, useRef, useState } from 'react'
import type { JogoProps } from '../../jogos/catalogo'
import type { Carta, CorCarta } from '../../jogos/cartas'
import { CORES, comprarCarta, jogarCarta, novaMesa, podeJogar, turnoComputador } from '../../jogos/cartas'
import './mesas.css'

const rotuloValor = (v: Carta['valor']) => (v === 'pular' ? 'PULA' : v === 'inverter' ? 'INV' : v === 'coringa' ? 'COR' : String(v))
const nomeValor = (v: Carta['valor']) => (typeof v === 'number' ? String(v) : v === 'pular' ? 'pular' : v === 'inverter' ? 'inverter' : v === 'coringa' ? 'coringa' : v)
const nomeCor = (c: CorCarta | null) => c ?? 'sem cor'
const classeCor = (c: Carta) => (c.cor ? `mesa-c-${c.cor}` : 'mesa-c-coringa')
const hex: Record<CorCarta, string> = { vermelho: '#d32f2f', amarelo: '#e0a800', verde: '#2e9e47', azul: '#1e56c8' }

export default function Cartas({ onPts, onFim }: JogoProps) {
  const [mesa, setMesa] = useState(() => novaMesa())
  const [pendente, setPendente] = useState<number | null>(null)
  const fimEnviado = useRef(false)
  const topo = mesa.descarte[mesa.descarte.length - 1]
  const minhaVez = mesa.vez === 0 && mesa.vencedor === null

  useEffect(() => {
    if (mesa.vez !== 1 || mesa.vencedor !== null) return
    const t = setTimeout(() => setMesa(m => turnoComputador(m)), 900)
    return () => clearTimeout(t)
  }, [mesa])

  useEffect(() => {
    onPts(mesa.vencedor === 0 ? 100 : Math.max(0, 7 - mesa.maos[0].length) * 10)
  }, [mesa, onPts])

  const jogar = (i: number) => {
    if (!minhaVez) return
    const c = mesa.maos[0][i]
    if (!c || !podeJogar(mesa, c)) return
    if (!c.cor) { setPendente(i); return }
    setMesa(jogarCarta(mesa, i))
  }
  const escolher = (cor: CorCarta) => {
    if (pendente === null) return
    setMesa(jogarCarta(mesa, pendente, cor))
    setPendente(null)
  }
  const comprar = () => { if (minhaVez) { setPendente(null); setMesa(comprarCarta(mesa)) } }
  const finalizar = () => {
    if (fimEnviado.current || mesa.vencedor === null) return
    fimEnviado.current = true
    onFim(mesa.vencedor === 0 ? 100 : 0)
  }

  const temJogada = mesa.maos[0].some(c => podeJogar(mesa, c))
  return (
    <div className="mesa-raiz">
      <div className="mesa-cartas">
        <p className="mesa-rotulo">Computador: {mesa.maos[1].length} {mesa.maos[1].length === 1 ? 'carta' : 'cartas'}</p>
        <div className="mesa-mao mesa-bots" aria-hidden="true">
          {mesa.maos[1].slice(0, 12).map(c => <span key={c.id} className="mesa-verso">UNO</span>)}
        </div>
        <div className="mesa-centro">
          <button type="button" className="mesa-btn" onClick={comprar} disabled={!minhaVez}>
            Comprar ({mesa.monte.length})
          </button>
          <span className={`mesa-carta mesa-grande ${topo.cor ? `mesa-c-${topo.cor}` : classeCor(topo)}`} role="img" aria-label={`Carta do topo: ${nomeValor(topo.valor)} ${nomeCor(topo.cor)}`}>
            {rotuloValor(topo.valor)}
          </span>
          <span className="mesa-chip"><i style={{ background: hex[mesa.cor] }} />Cor: {mesa.cor}</span>
        </div>
        <p className="mesa-aviso" role="status" aria-live="polite">
          {mesa.vencedor !== null ? mesa.aviso : minhaVez ? `Sua vez. ${mesa.aviso}${temJogada ? '' : ' Sem jogada: compre uma carta.'}` : 'Vez do computador...'}
        </p>
        {pendente !== null && (
          <div className="mesa-escolha" role="group" aria-label="Escolha a cor do coringa">
            <span>Escolha a cor:</span>
            {CORES.map(cor => (
              <button key={cor} type="button" className="mesa-cor" style={{ background: hex[cor] }} onClick={() => escolher(cor)} aria-label={`Escolher ${cor}`} />
            ))}
            <button type="button" className="mesa-btn" onClick={() => setPendente(null)}>Cancelar</button>
          </div>
        )}
        <p className="mesa-rotulo">Sua mão: {mesa.maos[0].length} {mesa.maos[0].length === 1 ? 'carta' : 'cartas'}</p>
        <div className="mesa-mao">
          {mesa.maos[0].map((c, i) => {
            const ok = minhaVez && podeJogar(mesa, c)
            return (
              <button
                key={c.id} type="button" disabled={!ok}
                className={`mesa-carta ${classeCor(c)}${ok ? ' mesa-jogavel' : ' mesa-opaca'}`}
                aria-label={`${nomeValor(c.valor)} ${nomeCor(c.cor)}${ok ? '' : ', não jogável agora'}`}
                onClick={() => jogar(i)}
              >{rotuloValor(c.valor)}</button>
            )
          })}
        </div>
      </div>
      {mesa.vencedor !== null && (
        <div className="mesa-fim" role="status">
          <h3>{mesa.vencedor === 0 ? 'Você venceu!' : 'O computador venceu.'}</h3>
          <p>{mesa.vencedor === 0 ? 'Você zerou a mão primeiro.' : 'Ele zerou a mão primeiro. Tente de novo.'}</p>
          <button type="button" className="mesa-btn mesa-forte" onClick={finalizar}>Finalizar</button>
        </div>
      )}
    </div>
  )
}
