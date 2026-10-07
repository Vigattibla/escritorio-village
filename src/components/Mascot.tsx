import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { mascotSprite, type MascotFrame } from '../chibi/mascot'
import { setUi, unread, useStore, type Notice } from '../store'

declare global {
  interface Window {
    documentPictureInPicture?: { requestWindow(o: { width: number; height: number }): Promise<Window>; window: Window | null }
  }
}

const SHOW_MS = 7000
const ago = (t: number) => {
  const m = Math.round((Date.now() - t) / 60000)
  return m < 1 ? 'agora' : m < 60 ? `${m} min` : `${Math.round(m / 60)} h`
}

/** Vila desenhado com o relógio da janela onde está (a aba principal fica lenta quando escondida). */
function Chick({ win, talking, size }: { win: Window; talking: boolean; size: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [frame, setFrame] = useState<MascotFrame>('idle')
  useEffect(() => {
    let alive = true, n = 0
    const tick = () => {
      if (!alive) return
      n++
      setFrame(talking ? (n % 2 ? 'talk' : 'idle') : n % 25 === 0 ? 'blink' : 'idle')
      win.setTimeout(tick, talking ? 160 : 140)
    }
    const id = win.setTimeout(tick, 140)
    return () => { alive = false; win.clearTimeout(id) }
  }, [win, talking])
  useEffect(() => {
    const cv = ref.current!
    cv.width = cv.height = 16
    const ctx = cv.getContext('2d')!
    ctx.clearRect(0, 0, 16, 16)
    ctx.drawImage(mascotSprite(frame), 0, 0)
  }, [frame])
  return <canvas ref={ref} className="chick" style={{ width: size, height: size }} />
}

function useCounts() {
  const s = useStore(x => x)
  const pend = Object.values(s.tasks).filter(t => t.owner_id === s.meId && t.status === 'inbox').length
  const chans = new Set(s.messages.map(m => m.channel))
  const msgs = [...chans].reduce((n, ch) => n + unread(s, ch), 0)
  return { pend, msgs, notices: s.notices }
}

function useLatest(notices: Notice[], win: Window) {
  const [, force] = useState(0)
  const n = notices[0]
  const live = !!n && Date.now() - n.at < SHOW_MS
  useEffect(() => {
    if (!live) return
    const id = win.setTimeout(() => force(x => x + 1), SHOW_MS - (Date.now() - n!.at) + 50)
    return () => win.clearTimeout(id)
  }, [live, n, win])
  return live ? n : null
}

function go(n: Notice) {
  window.focus()
  if (n.go) setUi(n.go)
}

function PipView({ win }: { win: Window }) {
  const { pend, msgs, notices } = useCounts()
  const latest = useLatest(notices, win)
  return (
    <div className="pip">
      <div className="pip-top">
        <Chick win={win} talking={!!latest} size={72} />
        <div className="pip-bubble">{latest ? latest.text : pend + msgs ? 'Tem coisa esperando por você!' : 'Tudo tranquilo por aqui. 🌿'}</div>
      </div>
      <div className="pip-counts">
        <span>📌 {pend} pedido(s)</span>
        <span>💬 {msgs} não lida(s)</span>
      </div>
      <ul className="pip-feed">
        {notices.slice(0, 4).map(n => <li key={n.id} onClick={() => go(n)}><span>{n.text}</span><i>{ago(n.at)}</i></li>)}
        {notices.length === 0 && <li className="muted">Os avisos do escritório aparecem aqui.</li>}
      </ul>
    </div>
  )
}

export default function Mascot() {
  const { pend, msgs, notices } = useCounts()
  const pipOpen = useStore(s => s.pipOpen)
  const [pipWin, setPipWin] = useState<Window | null>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const latest = useLatest(notices, window)
  const supported = !!window.documentPictureInPicture

  // título da aba com contador
  useEffect(() => {
    const n = pend + msgs
    document.title = n ? `(${n}) Escritório Village` : 'Escritório Village'
  }, [pend, msgs])

  const popOut = async () => {
    if (!window.documentPictureInPicture) return
    setBusy(true)
    try {
      if ('Notification' in window && Notification.permission === 'default') setPerm(await Notification.requestPermission())
      const w = await window.documentPictureInPicture.requestWindow({ width: 280, height: 320 })
      for (const sheet of [...document.styleSheets]) {
        try {
          const style = w.document.createElement('style')
          style.textContent = [...sheet.cssRules].map(r => r.cssText).join('\n')
          w.document.head.appendChild(style)
        } catch {
          if (sheet.href) { const l = w.document.createElement('link'); l.rel = 'stylesheet'; l.href = sheet.href; w.document.head.appendChild(l) }
        }
      }
      w.document.title = 'Vila · Escritório Village'
      w.document.body.className = 'pip-body'
      w.addEventListener('pagehide', () => { setPipWin(null); setUi({ pipOpen: false }) })
      setPipWin(w)
      setUi({ pipOpen: true })
    } finally {
      setBusy(false)
    }
  }
  const [perm, setPerm] = useState(() => ('Notification' in window ? Notification.permission : 'denied'))
  const askNotif = () => { Notification.requestPermission().then(setPerm) }

  return (
    <>
      <div className={'mascot' + (open ? ' open' : '')}>
        {latest && !open && !pipOpen && (
          <button className="mascot-bubble" onClick={() => go(latest)}>{latest.text}</button>
        )}
        {open && (
          <div className="mascot-panel">
            <header className="row gap">
              <b className="grow">Vila · avisos</b>
              <button className="x" onClick={() => setOpen(false)} aria-label="Fechar">×</button>
            </header>
            <ul className="feed">
              {notices.slice(0, 12).map(n => <li key={n.id} onClick={() => go(n)}><span>{n.text}</span><i>{ago(n.at)}</i></li>)}
              {notices.length === 0 && <li className="muted">Ainda sem avisos. Quando alguém te pedir algo, mandar mensagem ou entrar no time, eu aviso.</li>}
            </ul>
            <div className="mascot-actions">
              {supported ? (
                <button className="btn primary sm" disabled={busy || pipOpen} onClick={popOut}>
                  {pipOpen ? 'Vila está fora da aba ✓' : busy ? 'Abrindo janelinha…' : '🪟 Levar o Vila pra fora da aba'}
                </button>
              ) : (
                <p className="muted small">Seu navegador não abre a janelinha flutuante (use Chrome ou Edge). Os avisos chegam como notificação.</p>
              )}
              {perm === 'default' && <button className="btn ghost sm" onClick={askNotif}>🔔 Ativar notificações</button>}
              {perm === 'denied' && <p className="muted small">Notificações bloqueadas no navegador.</p>}
            </div>
          </div>
        )}
        <button className="mascot-btn" onClick={() => setOpen(o => !o)} title="Vila — avisos do escritório">
          <Chick win={window} talking={!!latest && !pipOpen} size={56} />
          {pend + msgs > 0 && <span className="badge">{pend + msgs}</span>}
        </button>
      </div>
      {pipWin && createPortal(<PipView win={pipWin} />, pipWin.document.body)}
    </>
  )
}
