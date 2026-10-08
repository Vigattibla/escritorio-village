import { useEffect, useRef, useState } from 'react'
import { download, driveOn, FOLDER, isImage, list, mkdir, setOpenAt, thumb, upload, type DFile } from '../data/drive'
import { setUi } from '../store'
import type { DriveLink } from '../types'
import { Thumb } from './Arquivos'
import { Ph } from './Icon'

type Crumb = DriveLink['crumbs'][number]
const ids = (c: Crumb[]) => c.map(x => x.id)
export const folderName = (l: DriveLink) => l.crumbs.at(-1)?.name ?? 'Pasta'

/** Escolher (ou criar) uma pasta dentro de "Escritório Village". */
export function FolderPicker({ start, onPick, onClose }: { start?: DriveLink | null; onPick: (l: DriveLink) => void; onClose: () => void }) {
  const [crumbs, setCrumbs] = useState<Crumb[]>([])
  const [dirs, setDirs] = useState<DFile[] | null>(null)
  const [err, setErr] = useState('')
  const [secs, setSecs] = useState(0)
  const open = async (c: Crumb[]) => {
    setDirs(null); setErr(''); setSecs(0)
    try {
      const r = await list(ids(c))
      setCrumbs(c.length ? c : [{ id: r.root, name: 'Escritório Village' }])
      setDirs(r.files.filter(f => f.mime === FOLDER))
    } catch (e) { setErr((e as Error).message) }
  }
  useEffect(() => { open(start?.crumbs ?? []) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (dirs || err) return
    const t = setInterval(() => setSecs(s => s + 1), 1000)
    return () => clearInterval(t)
  }, [dirs, err])
  const add = async () => {
    const name = prompt('Nome da nova pasta')?.trim()
    if (!name) return
    try { const f = await mkdir(ids(crumbs), name); open([...crumbs, { id: f.id, name: f.name }]) } catch (e) { setErr((e as Error).message) }
  }

  return (
    <div className="modal-bg fp-bg" onMouseDown={e => e.target === e.currentTarget && onClose()} onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }}>
      <div className="task-modal fp">
        <header className="task-top"><Ph n="folder-simple" size={18} fill /><b className="grow">Escolher pasta do Drive</b>
          <button className="btn ghost sm" onClick={onClose} aria-label="Fechar">✕</button></header>
        <nav className="fp-path" aria-label="Pastas">
          {crumbs.map((c, i) => <span key={c.id}>{i > 0 && <Ph n="caret-right" size={12} />}
            <button onClick={() => open(crumbs.slice(0, i + 1))} disabled={i === crumbs.length - 1}>{c.name}</button></span>)}
        </nav>
        <div className="fp-list">
          {err && <p className="ar-err-in">{err} <button className="btn soft sm" onClick={() => open(crumbs)}>Tentar de novo</button></p>}
          {!dirs && !err && <p className="muted small">Abrindo a pasta… costuma levar 1–3 s{secs > 0 ? ` · ${secs}s` : ''}</p>}
          {dirs?.map(f => <button key={f.id} className="fp-dir" onClick={() => open([...crumbs, { id: f.id, name: f.name }])}>
            <Ph n="folder-simple" size={20} fill /><b className="grow">{f.name}</b><Ph n="caret-right" size={14} /></button>)}
          {dirs && !dirs.length && <p className="muted small">Sem subpastas aqui.</p>}
        </div>
        <footer className="task-foot">
          <button className="btn soft sm" onClick={add} disabled={!dirs}><Ph n="plus" size={16} />Nova pasta aqui</button>
          <span className="grow" />
          <button className="btn primary sm" onClick={() => onPick({ crumbs })} disabled={!dirs || !crumbs.length}>Usar “{crumbs.at(-1)?.name ?? '…'}”</button>
        </footer>
      </div>
    </div>
  )
}

/**
 * Pasta do Drive dentro da tarefa: miniaturas dos arquivos e envio direto pra ela.
 * `own` = pasta da própria tarefa; senão é a do projeto (herdada).
 */
export function FolderBox({ link, own, edit, suggest, base, onLink, onZoom }: {
  link: DriveLink | null; own: boolean; edit: boolean; suggest: string; base: DriveLink | null
  onLink: (l: DriveLink | null) => void; onZoom: (url: string) => void
}) {
  const [files, setFiles] = useState<DFile[] | null>(null)
  const [err, setErr] = useState('')
  const [picking, setPicking] = useState(false)
  const [sending, setSending] = useState<{ key: string; name: string; p: number }[]>([])
  const [over, setOver] = useState(false)
  const [busy, setBusy] = useState(false)
  const pick = useRef<HTMLInputElement>(null)
  const path = link ? ids(link.crumbs) : []
  const key = path.join('/')

  useEffect(() => {
    if (!link) return
    let on = true
    setFiles(null); setErr('')
    list(path).then(r => on && setFiles(r.files), e => on && setErr((e as Error).message))
    return () => { on = false }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!driveOn) return null

  const create = async () => {
    setBusy(true); setErr('')
    try {
      const at = base?.crumbs ?? []
      const f = await mkdir(ids(at), suggest.slice(0, 120) || 'Tarefa')
      onLink({ crumbs: [...(at.length ? at : [{ id: f.root, name: 'Escritório Village' }]), { id: f.id, name: f.name }] })
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  const send = async (fs: File[]) => {
    if (!link || !fs.length) return
    for (const file of fs) {
      const k = crypto.randomUUID()
      setSending(s => [...s, { key: k, name: file.name, p: 0 }])
      try {
        const f = await upload(path, file, p => setSending(s => s.map(x => x.key === k ? { ...x, p } : x)))
        setFiles(x => [...(x ?? []), f])
      } catch (e) { setErr((e as Error).message) } finally { setSending(s => s.filter(x => x.key !== k)) }
    }
  }
  const tap = async (f: DFile) => {
    if (f.mime === FOLDER) { setOpenAt([...link!.crumbs, { id: f.id, name: f.name }]); setUi({ view: 'arquivos', task: null }); return }
    try { if (isImage(f)) onZoom(await thumb(path, f.id, 1600)); else await download(path, f) } catch (e) { setErr((e as Error).message) }
  }
  const picker = picking && <FolderPicker start={link ?? base} onClose={() => setPicking(false)} onPick={l => { setPicking(false); onLink(l) }} />

  if (!link) return edit ? (
    <div className="field">
      <h3>Pasta no Drive</h3>
      <div className="fb-empty">
        <Ph n="folder-simple-dashed" size={22} />
        <span className="grow muted small">Fotos e arquivos desta tarefa direto no Drive do Village.</span>
        <button className="btn soft sm" onClick={create} disabled={busy}>{busy ? 'Criando…' : <><Ph n="plus" size={14} />Criar pasta</>}</button>
        <button className="btn ghost sm" onClick={() => setPicking(true)}>Vincular existente</button>
      </div>
      {err && <p className="ar-err-in">{err}</p>}
      {picker}
    </div>
  ) : null

  return (
    <div className={'field fb' + (over ? ' over' : '')}
      onDragOver={e => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); e.stopPropagation(); setOver(true) } }}
      onDragLeave={e => e.currentTarget === e.target && setOver(false)}
      onDrop={e => { e.preventDefault(); e.stopPropagation(); setOver(false); send([...e.dataTransfer.files]) }}>
      <div className="fb-head">
        <h3 className="grow"><Ph n="folder-simple" size={16} fill /> {folderName(link)}
          {!own && <small className="muted"> · pasta do projeto</small>}
          {files && <span className="count">{files.length}</span>}</h3>
        <button className="btn ghost sm" onClick={() => { setOpenAt(link.crumbs); setUi({ view: 'arquivos', task: null }) }} title="Abrir na aba Arquivos">Abrir<Ph n="arrow-right" size={14} /></button>
        {edit && <button className="btn ghost sm" onClick={() => setPicking(true)}>Trocar</button>}
        {edit && own && <button className="btn ghost sm" onClick={() => onLink(null)} title="Desvincular (a pasta continua no Drive)">✕</button>}
      </div>
      {err && <p className="ar-err-in">{err}</p>}
      {!files && !err && <p className="muted small">Abrindo a pasta no Drive…</p>}
      <div className="fb-grid">
        {files?.map(f => <button key={f.id} className="fb-th" onClick={() => tap(f)} title={f.name}>
          {f.mime === FOLDER ? <Ph n="folder-simple" size={26} fill /> : <Thumb path={path} f={f} px={300} />}
          <small>{f.name}</small>
        </button>)}
        {sending.map(s => <div key={s.key} className="fb-th sending"><i className="ar-bar"><i style={{ width: Math.round(s.p * 100) + '%' }} /></i><small>{s.name}</small></div>)}
        <button className="fb-th add" onClick={() => pick.current?.click()} title="Enviar fotos e arquivos pro Drive">
          <Ph n="upload-simple" size={22} /><small>Enviar ou arrastar</small></button>
      </div>
      <input ref={pick} type="file" multiple hidden onChange={e => { send([...(e.target.files ?? [])]); e.target.value = '' }} />
      {picker}
    </div>
  )
}
