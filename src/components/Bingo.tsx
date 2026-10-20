import { useEffect, useRef, useState } from 'react'
import { CARTELA, CASA, LETRAS, MAX_CARTELAS, PASSO, ATRASO, RAROS_BINGO, SLOT, LINHA_PCT, faltam, letraDe, type BingoRodada, type BingoVenc, type Cartela } from '../cassino/bingo'
import { checarBingo, comprarCartela, itemName, primeiroNome, refreshWallet, useStore } from '../store'
import { Ph } from './Icon'
import { Fundo } from './Fundo'

/** Salão de Bingo: o servidor sorteia, confere e paga; aqui o globo, o painel e as cartelas */
const COR = ['#ff5fa2', '#FBC222', '#38c6e8', '#5fcf6f', '#a77bff']
const corDe = (n: number) => COR[Math.floor((n - 1) / 15)]
const mmss = (ms: number) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` }
const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
const nomes = (v: BingoVenc[]) => v.map(w => primeiroNome(w.u) + (w.n > 1 ? ` (${w.n})` : '')).join(', ')

function Bola({ n, grande }: { n: number; grande?: boolean }) {
  return <span className={'bg-bola' + (grande ? ' grande' : '')} style={{ ['--c' as string]: corDe(n) }}><small>{letraDe(n)}</small>{n}</span>
}

function CartelaV({ c, saiu, ultima }: { c: Cartela; saiu: Set<number>; ultima?: number }) {
  const f = faltam(c.numeros, saiu)
  return (
    <div className={'bg-cartela' + (f.cheia === 0 ? ' cheia' : f.linha === 0 ? ' linha' : '')}>
      <div className="bg-cab">{[...LETRAS].map((l, i) => <b key={l} style={{ color: COR[i] }}>{l}</b>)}</div>
      <div className="bg-grade">
        {Array.from({ length: 25 }, (_, k) => {
          const i = (k % 5) * 5 + Math.floor(k / 5), n = c.numeros[i]
          const on = n === 0 || saiu.has(n)
          return <span key={k} className={(on ? 'on' : '') + (n === 0 ? ' livre' : '') + (n && n === ultima ? ' nova' : '')}>{n === 0 ? '★' : n}</span>
        })}
      </div>
      <div className="bg-falta">
        {c.gratis && <em>grátis</em>}
        {f.cheia === 0 ? <b>BINGO!</b> : f.linha === 0 ? <b>Linha! · faltam {f.cheia}</b> : f.linha === 1 ? <b className="quase">Falta 1 pra linha!</b> : <span>linha: faltam {f.linha} · cheia: {f.cheia}</span>}
      </div>
    </div>
  )
}

export default function Bingo({ onClose }: { onClose: () => void }) {
  const b = useStore(s => s.bingoDados), wallet = useStore(s => s.wallet), me = useStore(s => s.meId)
  const [now, setNow] = useState(Date.now())
  const [busy, setBusy] = useState(false)
  const [erro, setErro] = useState('')
  const off = useRef(0)

  // o relógio do servidor manda; a janela aberta pergunta de pouco em pouco (mais rápido durante o sorteio)
  useEffect(() => { if (b) off.current = b.agora - Date.now() }, [b])
  useEffect(() => { const t = setInterval(() => setNow(Date.now() + off.current), 250); return () => clearInterval(t) }, [])
  const sorteando = b?.atual.estado === 'jogando'
  useEffect(() => {
    void checarBingo(); void refreshWallet()
    const t = setInterval(() => { if (document.visibilityState === 'visible') void checarBingo() }, sorteando ? 1500 : 3000)
    return () => clearInterval(t)
  }, [sorteando])
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])

  const compra = async (gratis: boolean) => {
    setErro(''); setBusy(true)
    try { await comprarCartela(gratis) } catch (e) { setErro(e instanceof Error ? e.message : String(e)) } finally { setBusy(false) }
  }

  const slot = b?.slot ?? SLOT
  const atual = b?.atual, prox = b?.proxima
  const iniA = atual ? Date.parse(atual.inicio) : 0, iniP = prox ? Date.parse(prox.inicio) : 0
  // mostra a rodada que está rodando (ou a que acabou há pouco); fora disso, a sala espera a próxima
  const palco: BingoRodada | null = atual && (atual.estado === 'jogando' || atual.estado === 'paga' || atual.estado === 'cancelada') && atual.cartelas > 0 ? atual : null
  const bolas = palco?.bolas ?? []
  const saiu = new Set(bolas), ultima = bolas[bolas.length - 1]
  const proxBola = palco && palco.estado === 'jogando' && !palco.cheia ? iniA + ATRASO + bolas.length * PASSO - now : null
  const minhas = palco && palco.minhas.length ? palco.minhas : []
  const minhasProx = prox?.minhas ?? []
  const saldo = wallet?.balance ?? 0
  const potePrev = (prox?.cartelas ?? 0) * CARTELA + CASA

  const status = !b ? 'Abrindo o salão…'
    : !palco ? `Próxima rodada às ${hora(prox!.inicio)}`
    : palco.estado === 'cancelada' ? 'Rodada cancelada. As cartelas pagas foram devolvidas.'
    : palco.cheia ? 'BINGO! Rodada encerrada'
    : bolas.length === 0 ? 'O globo está girando…'
    : `Bola ${bolas.length} de 75`

  return (
    <Fundo className="modal-bg" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <section className="jan jg bg" role="dialog" aria-label="Salão de Bingo">
        <div className="jg-bar">
          <h2 className="bg-titulo">{[...LETRAS].map((l, i) => <span key={l} style={{ color: COR[i] }}>{l}</span>)}</h2>
          <span className="bg-sub">Salão dos cafezinhos</span>
          <span className="grow" />
          <span className="cs-saldo"><Ph n="coffee" size={16} fill /> <b>{wallet ? saldo : '…'}</b></span>
          <span className="cs-saldo lata" title="Latinhas">⚡ <b>{wallet ? wallet.latinhas : '…'}</b></span>
          <button className="btn ghost sm" onClick={onClose} aria-label="Fechar"><Ph n="x" size={18} /></button>
        </div>

        <div className="bg-corpo">
          <div className="bg-palco">
            <div className="bg-topo">
              <div className={'bg-globo' + (palco?.estado === 'jogando' && !palco.cheia ? ' gira' : '')} aria-hidden>
                <div className="bg-esfera">{Array.from({ length: 10 }, (_, i) => <i key={i} style={{ ['--c' as string]: COR[i % 5], ['--i' as string]: i, left: 14 + (i * 23) % 64, top: 56 + (i * 7) % 24 }} />)}</div>
                <div className="bg-base" />
              </div>
              <div className="bg-chamada">
                {ultima ? <Bola key={ultima} n={ultima} grande /> : <span className="bg-bola grande vazia">?</span>}
                <div>
                  <p className="bg-status">{status}</p>
                  {proxBola !== null && proxBola > 0 && <p className="bg-prox">próxima bola em {Math.ceil(proxBola / 1000)}s</p>}
                  <div className="bg-ultimas">{bolas.slice(-6, -1).reverse().map(n => <Bola key={n} n={n} />)}</div>
                </div>
              </div>
            </div>

            {palco?.linha && <div className="bg-venc linha">🎱 Linha na bola {palco.linha_idx}: <b>{nomes(palco.linha)}</b> · ☕ {palco.linha.reduce((s, w) => s + w.premio, 0)}</div>}
            {palco?.cheia && <div className="bg-venc cheia">
              🎉 BINGO na bola {palco.cheia_idx}: <b>{nomes(palco.cheia)}</b> · ☕ {palco.cheia.reduce((s, w) => s + w.premio, 0)} + ⚡1
              {Object.entries(palco.itens ?? {}).map(([u, it]) => <span key={u} className="bg-item">{primeiroNome(u)} ganhou <b>{itemName(it)}</b></span>)}
              {palco.cheia.some(w => w.u === me) && <div className="bg-festa" aria-hidden>{Array.from({ length: 24 }, (_, i) => <i key={i} style={{ left: (i * 41) % 100 + '%', animationDelay: (i % 8) * 0.12 + 's', background: COR[i % 5] }} />)}</div>}
            </div>}

            <div className="bg-painel" aria-label="Bolas sorteadas">
              {[...LETRAS].map((l, j) => (
                <div key={l} className="bg-lin">
                  <b style={{ background: COR[j] }}>{l}</b>
                  {Array.from({ length: 15 }, (_, i) => { const n = j * 15 + i + 1; return <span key={n} className={(saiu.has(n) ? 'on' : '') + (n === ultima ? ' nova' : '')} style={{ ['--c' as string]: COR[j] }}>{n}</span> })}
                </div>
              ))}
            </div>

            {minhas.length > 0 && <>
              <h3 className="bg-h">Suas cartelas nesta rodada</h3>
              <div className="bg-cartelas">{minhas.map(c => <CartelaV key={c.id} c={c} saiu={saiu} ultima={ultima} />)}</div>
            </>}
          </div>

          <aside className="bg-lado">
            <div className="bg-bloco destaque">
              <div className="bg-rh"><b>Próxima rodada</b><span className="grow" /><b className="bg-relogio">{prox ? mmss(iniP - now) : '…'}</b></div>
              <p className="bg-mini">às {prox ? hora(prox.inicio) : '…'} · uma rodada a cada {Math.round(slot / 60000)} min</p>
              <div className="bg-nums">
                <span><b>{prox?.jogadores ?? 0}</b> jogando</span>
                <span><b>{prox?.cartelas ?? 0}</b> cartelas</span>
                <span><b>☕ {potePrev}</b> no pote</span>
              </div>
              <div className="bg-btns">
                <button className="btn primary" disabled={busy || !b || minhasProx.length >= MAX_CARTELAS || saldo < CARTELA} onClick={() => void compra(false)}>Comprar cartela · ☕ {CARTELA}</button>
                {b?.gratis && <button className="btn soft" disabled={busy || minhasProx.length >= MAX_CARTELAS} onClick={() => void compra(true)}>🎁 Cartela grátis do dia</button>}
              </div>
              <p className="bg-mini">Você tem {minhasProx.length} de {MAX_CARTELAS} cartelas pra próxima. A rodada acontece mesmo com uma pessoa.</p>
              {erro && <p className="cs-erro">{erro}</p>}
              {minhasProx.length > 0 && <div className="bg-cartelas mini">{minhasProx.map(c => <CartelaV key={c.id} c={c} saiu={new Set()} />)}</div>}
            </div>

            <div className="bg-bloco">
              <b>Prêmios</b>
              <ul className="bg-premios">
                <li><span>1ª linha</span><b>{Math.round(LINHA_PCT * 100)}% do pote</b></li>
                <li><span>Cartela cheia</span><b>{100 - Math.round(LINHA_PCT * 100)}% + ⚡1 + item exclusivo</b></li>
              </ul>
              <div className="bg-raros">{RAROS_BINGO.map(i => <span key={i}>{itemName(i)}</span>)}</div>
              <p className="bg-mini">Itens que só saem no bingo: roupa, chapéu, óculos e animação. Sai um que você ainda não tem.</p>
            </div>

            {(palco?.gente?.length || prox?.gente?.length) ? <div className="bg-bloco">
              <b>Na sala</b>
              <div className="bg-gente">{(palco?.gente?.length ? palco.gente : prox!.gente!).map(g => <span key={g.u} className={g.u === me ? 'eu' : ''}>{primeiroNome(g.u)} <small>×{g.n}</small></span>)}</div>
            </div> : null}

            {!!b?.historico.length && <div className="bg-bloco">
              <b>Últimas rodadas</b>
              <ul className="bg-hist">
                {b.historico.map(h => (
                  <li key={h.inicio}>
                    <span>{hora(h.inicio)}</span>
                    <span className="grow">{nomes(h.cheia)}{Object.values(h.itens).length ? ' 🎁' : ''}</span>
                    <b>☕ {h.pote}</b>
                  </li>
                ))}
              </ul>
            </div>}
          </aside>
        </div>
      </section>
    </Fundo>
  )
}
