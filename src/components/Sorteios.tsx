import { useEffect, useState } from 'react'
import { setUi, useStore } from '../store'

/** quanto falta, curto: 2d 4h · 3h 12min · 08:41 */
function falta(ms: number) {
  if (ms <= 0) return 'agora'
  const m = Math.floor(ms / 60e3), h = Math.floor(m / 60), d = Math.floor(h / 24)
  if (d >= 1) return `${d}d ${h % 24}h`
  if (h >= 1) return `${h}h ${m % 60}min`
  const s = Math.floor(ms / 1e3)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

/** bolão e bingo sempre à vista em cima do escritório */
export default function Sorteios() {
  const bolao = useStore(s => s.bolao), bingo = useStore(s => s.bingoDados)
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [])
  const fimBolao = bolao ? Date.parse(bolao.fim) - now : 0
  const prox = bingo ? Date.parse(bingo.proxima.inicio) - now : 0
  const jogando = bingo?.atual.estado === 'jogando'
  return (
    <div className="sorteios">
      {bolao && <button className={'srt srt-bolao' + (fimBolao < 3600e3 ? ' quente' : '')} onClick={() => setUi({ cassino: 'bolao' })} title="Bolão da semana: sorteio sexta 17h">
        <span className="srt-ic">🍀</span><span className="srt-tx"><b>Bolão ☕ {bolao.pote}</b><small>sorteio em {falta(fimBolao)}</small></span>
      </button>}
      <button className={'srt srt-bingo' + (jogando ? ' quente' : '')} onClick={() => setUi({ bingo: true })} title="Salão de Bingo: rodada a cada 15 min">
        <span className="srt-ic">🎱</span><span className="srt-tx"><b>{jogando ? 'Bingo rolando!' : 'Bingo'}{bingo && bingo.proxima.pote > 0 ? ` ☕ ${bingo.proxima.pote}` : ''}</b><small>{bingo ? `próxima em ${falta(prox)}` : 'a cada 15 min'}</small></span>
      </button>
    </div>
  )
}
