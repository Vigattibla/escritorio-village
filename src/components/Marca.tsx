import { useEffect, useRef, useState } from 'react'
import { usePref } from '../prefs'
import { isChief } from '../game/ranks'
import { putRow, useStore } from '../store'
import { TENANT } from '../tenant'

const CACHE = 'ev:logo'
const cached = () => { try { return localStorage.getItem(CACHE) } catch { return null } }

/** reduz a foto no navegador (lado maior 256 px) para caber numa linha do banco */
function shrink(file: File): Promise<string> {
  return new Promise((ok, fail) => {
    const img = new Image()
    img.onload = () => {
      const k = Math.min(1, 256 / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k)
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(img.src)
      const webp = c.toDataURL('image/webp', 0.9)
      ok(webp.startsWith('data:image/webp') ? webp : c.toDataURL('image/png'))
    }
    img.onerror = () => fail(new Error('Não deu pra abrir essa imagem.'))
    img.src = URL.createObjectURL(file)
  })
}

/** a logo do cliente; fora do escritório (tela de entrada) usa a última vista neste aparelho */
export function LogoImg({ src }: { src?: string | null }) {
  return <img src={src || cached() || TENANT.logo} alt={TENANT.name} draggable={false} />
}

/** logo da barra lateral: adm ou Chefe clica e troca a foto */
export default function Marca() {
  const s = useStore(x => x)
  const me = s.profiles[s.meId!]
  const logo = s.rows.brand.marca?.logo ?? null
  // trocar a logo é opção de desenvolvedor
  const can = usePref('dev') && !!me && (me.is_admin || isChief(me))
  const [open, setOpen] = useState(false)
  const [msg, setMsg] = useState('')
  const file = useRef<HTMLInputElement>(null)
  useEffect(() => { try { if (logo) localStorage.setItem(CACHE, logo); else if (s.rows.brand.marca) localStorage.removeItem(CACHE) } catch { /* sem storage */ } }, [logo, s.rows.brand.marca])
  const save = async (v: string | null) => {
    setMsg('')
    try { await putRow('brand', { id: 'marca', logo: v, created_at: s.rows.brand.marca?.created_at ?? new Date().toISOString() }); setOpen(false) }
    catch (e) { setMsg(e instanceof Error ? e.message : 'Não deu pra salvar.') }
  }
  if (!can) return <span className="tlogo img"><LogoImg src={logo} /></span>
  return (
    <span className="tmarca">
      <button className="tlogo img" onClick={() => setOpen(!open)} title="Trocar logo" aria-expanded={open}><LogoImg src={logo} /></button>
      <input ref={file} type="file" accept="image/*" hidden onChange={async e => {
        const f = e.target.files?.[0]; e.target.value = ''
        if (!f) return
        try { await save(await shrink(f)) } catch (err) { setMsg(err instanceof Error ? err.message : 'Não deu pra abrir essa imagem.') }
      }} />
      {open && <>
        <div className="more-veil" onClick={() => setOpen(false)} />
        <div className="tmarca-pop">
          <small>Logo da empresa</small>
          <button onClick={() => file.current?.click()}>Escolher foto</button>
          {logo && <button onClick={() => save(null)}>Voltar à logo padrão</button>}
          {msg && <p className="tvazio">{msg}</p>}
        </div>
      </>}
    </span>
  )
}
