import { useEffect, useRef } from 'react'

/** Cloudflare Turnstile (anti-robô do login). Sem a chave do site, não aparece nem carrega nada.
 *  A prova vale uma vez só: depois de cada tentativa o login pede outra (reset). */
export const CAPTCHA_KEY = import.meta.env.VITE_TURNSTILE_SITEKEY as string | undefined

type TS = { render: (el: HTMLElement, o: Record<string, unknown>) => string; reset: (id: string) => void; remove: (id: string) => void }
declare global { interface Window { turnstile?: TS } }

let carregando: Promise<TS> | null = null
const carregar = () => carregando ??= new Promise<TS>((ok, falha) => {
  const s = document.createElement('script')
  s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
  s.async = true
  s.onload = () => (window.turnstile ? ok(window.turnstile) : falha(new Error('captcha')))
  s.onerror = () => { carregando = null; falha(new Error('Não deu para carregar a verificação anti-robô. Confira a internet.')) }
  document.head.appendChild(s)
})

export default function Captcha({ onToken, resetKey }: { onToken: (t: string | null) => void; resetKey: number }) {
  const el = useRef<HTMLDivElement>(null)
  const id = useRef<string | null>(null)
  useEffect(() => {
    if (!CAPTCHA_KEY) return
    let vivo = true
    carregar().then(ts => {
      if (!vivo || !el.current) return
      id.current = ts.render(el.current, {
        sitekey: CAPTCHA_KEY, language: 'pt-br', appearance: 'interaction-only',
        callback: (t: string) => onToken(t),
        'expired-callback': () => onToken(null),
        'error-callback': () => onToken(null),
      })
    }).catch(() => onToken(null))
    return () => { vivo = false; if (id.current) window.turnstile?.remove(id.current); id.current = null }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (resetKey && id.current) { onToken(null); window.turnstile?.reset(id.current) } }, [resetKey]) // eslint-disable-line react-hooks/exhaustive-deps
  return CAPTCHA_KEY ? <div ref={el} className="captcha" /> : null
}
