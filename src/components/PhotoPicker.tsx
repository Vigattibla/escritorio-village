import { useEffect, useRef, useState } from 'react'

const BOX = 220
const OUT = 192

/** Escolhe e enquadra o rosto num círculo; devolve um PNG 192x192. */
export default function PhotoPicker({ onDone, onCancel }: { onDone: (b: Blob) => Promise<void>; onCancel: () => void }) {
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [zoom, setZoom] = useState(1)
  const [off, setOff] = useState({ x: 0, y: 0 })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const cv = useRef<HTMLCanvasElement>(null)
  const dragging = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)

  const base = img ? BOX / Math.min(img.width, img.height) : 1
  const draw = (c: CanvasRenderingContext2D, size: number) => {
    if (!img) return
    const k = size / BOX, s = base * zoom * k
    c.clearRect(0, 0, size, size)
    c.drawImage(img, size / 2 - (img.width * s) / 2 + off.x * k, size / 2 - (img.height * s) / 2 + off.y * k, img.width * s, img.height * s)
  }

  useEffect(() => {
    const c = cv.current?.getContext('2d')
    if (c) draw(c, BOX)
  })

  const pick = (f: File | undefined) => {
    if (!f) return
    if (!f.type.startsWith('image/')) return setErr('Escolha um arquivo de imagem.')
    const url = URL.createObjectURL(f)
    const im = new Image()
    im.onload = () => { setImg(im); setZoom(1); setOff({ x: 0, y: 0 }); setErr('') }
    im.onerror = () => setErr('Não consegui abrir essa imagem.')
    im.src = url
  }

  const confirm = async () => {
    const out = document.createElement('canvas')
    out.width = out.height = OUT
    const c = out.getContext('2d')!
    c.beginPath(); c.arc(OUT / 2, OUT / 2, OUT / 2, 0, Math.PI * 2); c.clip()
    draw(c, OUT)
    const blob = await new Promise<Blob | null>(r => out.toBlob(r, 'image/png'))
    if (!blob) return setErr('Falha ao gerar a foto.')
    setBusy(true); setErr('')
    try { await onDone(blob) } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <div className="photo-picker">
      {!img ? (
        <label className="drop">
          <input type="file" accept="image/*" onChange={e => pick(e.target.files?.[0])} hidden />
          <span>📷</span>
          <b>Escolher foto do rosto</b>
          <small className="muted">De frente, rosto bem iluminado. Você ajusta o enquadramento depois.</small>
        </label>
      ) : (
        <>
          <div
            className="crop"
            style={{ width: BOX, height: BOX }}
            onPointerDown={e => { (e.target as Element).setPointerCapture(e.pointerId); dragging.current = { x: e.clientX, y: e.clientY, ox: off.x, oy: off.y } }}
            onPointerMove={e => { const d = dragging.current; if (d) setOff({ x: d.ox + e.clientX - d.x, y: d.oy + e.clientY - d.y }) }}
            onPointerUp={() => { dragging.current = null }}
          >
            <canvas ref={cv} width={BOX} height={BOX} />
            <div className="ring" />
          </div>
          <label className="row gap small">Zoom<input type="range" min={1} max={4} step={0.01} value={zoom} onChange={e => setZoom(+e.target.value)} /></label>
          <p className="muted small">Arraste para centralizar o rosto no círculo.</p>
        </>
      )}
      {err && <p className="err">{err}</p>}
      <div className="row gap end">
        <button type="button" className="btn ghost sm" onClick={onCancel} disabled={busy}>Cancelar</button>
        {img && <button type="button" className="btn ghost sm" onClick={() => setImg(null)} disabled={busy}>Trocar</button>}
        {img && <button type="button" className="btn primary sm" onClick={confirm} disabled={busy}>{busy ? 'Enviando foto… (alguns segundos)' : 'Usar esta foto'}</button>}
      </div>
    </div>
  )
}
