import { useEffect, useState } from 'react'
import { setUi, useStore } from '../store'

/** quanto falta, curto: 2d 4h · 3h 12min · 8 min */
function falta(ms: number) {
  const m = Math.max(1, Math.round(ms / 60e3)), h = Math.floor(m / 60), d = Math.floor(h / 24)
  if (d >= 1) return `${d}d ${h % 24}h`
  if (h >= 1) return `${h}h ${m % 60}min`
  return `${m} min`
}
// cada lembrete aparece uma vez só (fica guardado neste navegador)
const ja = (k: string) => { try { if (localStorage.getItem('ev:srt:' + k)) return true; localStorage.setItem('ev:srt:' + k, '1') } catch { /* sem storage: mostra */ } return false }

interface Aviso { k: string; ic: string; tit: string; sub: string; cls: string; abrir: () => void }

/** bolão e bingo como lembrete rápido no canto: o bolão 1x por dia e na última hora; o bingo no máximo 1x a cada 3h, 2 min antes */
export default function Sorteios() {
  const bolao = useStore(s => s.bolao), bingo = useStore(s => s.bingoDados)
  const [aviso, setAviso] = useState<Aviso | null>(null)
  useEffect(() => {
    const ver = () => {
      const now = Date.now(), dia = new Date().toDateString()
      if (bolao) {
        const f = Date.parse(bolao.fim) - now
        const k = f > 0 && f < 3600e3 ? 'bolao-fim:' + bolao.fim : f > 0 ? 'bolao-dia:' + dia : ''
        if (k && !ja(k)) return setAviso({ k, ic: '🍀', cls: 'srt-bolao', tit: `Bolão ☕ ${bolao.pote}`, sub: f < 3600e3 ? `Sorteio em ${falta(f)}. Última chance!` : `Sorteio em ${falta(f)}`, abrir: () => setUi({ cassino: 'bolao' }) })
      }
      if (bingo) {
        const p = Date.parse(bingo.proxima.inicio) - now
        if (p > 0 && p < 120e3 && !ja('bingo:' + Math.floor(now / 3 / 3600e3))) return setAviso({ k: 'bingo', ic: '🎱', cls: 'srt-bingo', tit: 'Bingo daqui a pouco', sub: `Próxima rodada em ${falta(p)}${bingo.proxima.pote > 0 ? ` · ☕ ${bingo.proxima.pote}` : ''}`, abrir: () => setUi({ bingo: true }) })
      }
    }
    ver()
    const t = window.setInterval(ver, 30e3)
    return () => clearInterval(t)
  }, [bolao, bingo])
  useEffect(() => { if (!aviso) return; const t = window.setTimeout(() => setAviso(null), 7000); return () => clearTimeout(t) }, [aviso])
  if (!aviso) return null
  return (
    <div className="sorteios">
      <button key={aviso.k} className={'srt ' + aviso.cls} onClick={() => { aviso.abrir(); setAviso(null) }} title="Abrir">
        <span className="srt-ic">{aviso.ic}</span><span className="srt-tx"><b>{aviso.tit}</b><small>{aviso.sub}</small></span>
      </button>
    </div>
  )
}
