import { useEffect, useRef, useState } from 'react'
import type { JogoProps } from '../../jogos/catalogo'
import type { Carta, CorCarta, MesaCartas } from '../../jogos/cartas'
import { CORES, comprarCarta, eCoringa, jogarCarta, novaMesa, novaMesaBaralho, podeJogar, turnoComputador } from '../../jogos/cartas'
import './mesas.css'

const rotuloValor = (v: Carta['valor']) => (v === 'pular' ? 'PULA' : v === 'inverter' ? 'INV' : v === 'coringa' ? 'COR' : String(v))
const nomeValor = (v: Carta['valor']) => (typeof v === 'number' ? String(v) : v === 'pular' ? 'pular' : v === 'inverter' ? 'inverter' : v === 'coringa' ? 'coringa' : v)
const nomeCor = (c: CorCarta | null) => c ?? 'sem cor'
const classeCor = (c: Carta) => (c.cor ? `mesa-c-${c.cor}` : 'mesa-c-coringa')
const hex: Record<CorCarta, string> = { vermelho: '#d32f2f', amarelo: '#e0a800', verde: '#2e9e47', azul: '#1e56c8' }

export default function Cartas({ onPts, onFim, rede, baralho = false }: JogoProps) {
  const [local, setMesa] = useState(() => baralho ? novaMesaBaralho() : novaMesa())
  const remota = rede?.mesa.cartas
  const mesa: MesaCartas = remota && rede ? {
    maos: [remota.mao, Array.from({ length: remota.adversario }, (_, i) => ({ id: -i - 1, cor: null, valor: 0 }))],
    monte: Array.from({ length: remota.monte }, (_, i) => ({ id: -i - 1000, cor: null, valor: 0 })),
    descarte: [remota.topo], cor: remota.cor, vez: remota.vez === rede.mesa.eu ? 0 : 1,
    vencedor: remota.vencedor === null ? null : remota.vencedor === rede.mesa.eu ? 0 : 1,
    aviso: remota.aviso, baralho: remota.baralho, inicial: remota.inicial,
  } : local
  const naipes: Record<CorCarta, string> = { vermelho: 'copas', amarelo: 'ouros', verde: 'paus', azul: 'espadas' }
  const simbolos: Record<CorCarta, string> = { vermelho: '♥', amarelo: '♦', verde: '♣', azul: '♠' }
  const valor = (v: Carta['valor']) => baralho ? ({ 1: 'A', 11: 'J', 12: 'Q', 13: 'K' }[Number(v)] ?? String(v)) : rotuloValor(v)
  const corNome = (c: CorCarta | null) => baralho && c ? naipes[c] : nomeCor(c)
  const adversario = rede ? 'Colega' : 'Computador'
  const [pendente, setPendente] = useState<number | null>(null)
  const fimEnviado = useRef(false)
  const topo = mesa.descarte[mesa.descarte.length - 1]
  const minhaVez = mesa.vez === 0 && mesa.vencedor === null && !rede?.ocupado

  useEffect(() => {
    if (rede || mesa.vez !== 1 || mesa.vencedor !== null) return
    const t = setTimeout(() => setMesa(m => turnoComputador(m)), 900)
    return () => clearTimeout(t)
  }, [local, rede])

  useEffect(() => {
    onPts(mesa.vencedor === 0 ? 100 : Math.max(0, (mesa.inicial ?? 7) - mesa.maos[0].length) * 10)
  }, [mesa, onPts])

  const jogar = (i: number) => {
    if (!minhaVez) return
    const c = mesa.maos[0][i]
    if (!c || !podeJogar(mesa, c)) return
    if (eCoringa(mesa, c)) { setPendente(c.id); return }
    if (rede) void rede.acao({ tipo: 'jogar', carta: c.id }); else setMesa(jogarCarta(mesa, i))
  }
  const escolher = (cor: CorCarta) => {
    if (pendente === null) return
    const i = mesa.maos[0].findIndex(c => c.id === pendente)
    if (i < 0) { setPendente(null); return }
    if (rede) void rede.acao({ tipo: 'jogar', carta: pendente, cor }); else setMesa(jogarCarta(mesa, i, cor))
    setPendente(null)
  }
  const comprar = () => { if (minhaVez) { setPendente(null); rede ? void rede.acao({ tipo: 'comprar' }) : setMesa(comprarCarta(mesa)) } }
  const finalizar = () => {
    if (fimEnviado.current || mesa.vencedor === null) return
    fimEnviado.current = true
    onFim(mesa.vencedor === 0 ? 100 : 0)
  }

  const temJogada = mesa.maos[0].some(c => podeJogar(mesa, c))
  return (
    <div className={"mesa-raiz" + (baralho ? " mesa-baralho" : "")}>
      <div className="mesa-cartas">
        <p className="mesa-rotulo">{adversario}: {mesa.maos[1].length} {mesa.maos[1].length === 1 ? 'carta' : 'cartas'}</p>
        <div className="mesa-mao mesa-bots" aria-hidden="true">
          {mesa.maos[1].slice(0, 12).map(c => <span key={c.id} className="mesa-verso">{baralho ? '52' : 'UNO'}</span>)}
        </div>
        <div className="mesa-centro">
          <button type="button" className="mesa-btn" onClick={comprar} disabled={!minhaVez}>
            Comprar ({mesa.monte.length})
          </button>
          <span className={`mesa-carta mesa-grande ${topo.cor ? `mesa-c-${topo.cor}` : classeCor(topo)}`} role="img" aria-label={`Carta do topo: ${baralho ? valor(topo.valor) : nomeValor(topo.valor)} ${corNome(topo.cor)}`}>
            <span>{valor(topo.valor)}</span>{baralho && topo.cor && <small>{simbolos[topo.cor]}</small>}
          </span>
          <span className="mesa-chip"><i style={{ background: hex[mesa.cor] }} />{baralho ? 'Naipe' : 'Cor'}: {corNome(mesa.cor)}</span>
        </div>
        <p className="mesa-aviso" role="status" aria-live="polite">
          {mesa.vencedor !== null ? mesa.aviso : minhaVez ? `Sua vez. ${mesa.aviso}${temJogada ? '' : ' Sem jogada: compre uma carta.'}` : `Vez de ${adversario.toLowerCase()}...`}
        </p>
        {pendente !== null && (
          <div className="mesa-escolha" role="group" aria-label={baralho ? 'Escolha o naipe da dama' : 'Escolha a cor do coringa'}>
            <span>Escolha {baralho ? 'o naipe' : 'a cor'}:</span>
            {CORES.map(cor => (
              <button key={cor} type="button" className="mesa-cor" style={{ background: hex[cor] }} onClick={() => escolher(cor)} aria-label={`Escolher ${corNome(cor)}`} />
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
                aria-label={`${baralho ? valor(c.valor) : nomeValor(c.valor)} ${corNome(c.cor)}${ok ? '' : ', não jogável agora'}`}
                onClick={() => jogar(i)}
              ><span>{valor(c.valor)}</span>{baralho && c.cor && <small>{simbolos[c.cor]}</small>}</button>
            )
          })}
        </div>
      </div>
      {mesa.vencedor !== null && (
        <div className="mesa-fim" role="status">
          <h3>{mesa.vencedor === 0 ? 'Você venceu!' : `O ${adversario.toLowerCase()} venceu.`}</h3>
          <p>{rede ? mesa.aviso : mesa.vencedor === 0 ? 'Você zerou a mão primeiro.' : 'Ele zerou a mão primeiro. Tente de novo.'}</p>
          <button type="button" className="mesa-btn mesa-forte" onClick={finalizar}>Finalizar</button>
        </div>
      )}
    </div>
  )
}
