import { useEffect, useRef, useState } from 'react'
import { download, driveOn, takeOpenAt, FOLDER, isImage, kb, list, mkdir, thumb, upload, type DFile } from '../data/drive'
import { Ph } from './Icon'
import type { PhName } from './ph'

type Crumb = { id: string; name: string }
type Sending = { key: string; name: string; p: number; err?: string }

const icon = (f: DFile): PhName => f.mime === FOLDER ? 'folder-simple' : f.mime.startsWith('image/') ? 'images' : f.mime.startsWith('video/') ? 'film-strip' : 'file-text'
const ids = (c: Crumb[]) => c.map(x => x.id)

export function Thumb({ path, f, px = 400 }: { path: string[]; f: DFile; px?: number }) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    if (!f.thumb && !isImage(f)) return
    let on = true, t = 0
    // foto recém-enviada pode demorar uns segundos no Google: tenta de novo duas vezes
    const go = (n: number) => thumb(path, f.id, px).then(u => on && setSrc(u), () => { if (on && n < 2) t = setTimeout(() => go(n + 1), 4000 * (n + 1)) })
    go(0)
    return () => { on = false; clearTimeout(t) }
  }, [f.id, px]) // eslint-disable-line react-hooks/exhaustive-deps
  return src ? <img src={src} alt="" draggable={false} /> : <Ph n={icon(f)} size={px > 400 ? 48 : 34} />
}

/** Pasta "Escritório Village" do Google Drive do Village: ver, enviar e baixar sem sair do site. */
export default function Arquivos() {
  const [crumbs, setCrumbs] = useState<Crumb[]>([])
  const [files, setFiles] = useState<DFile[] | null>(null)
  const [next, setNext] = useState<string | null>(null)
  const [err, setErr] = useState('')
  const [find, setFind] = useState('')
  const [view, setView] = useState<DFile | null>(null)
  const [getting, setGetting] = useState('')
  const [sending, setSending] = useState<Sending[]>([])
  const [over, setOver] = useState(false)
  const [secs, setSecs] = useState(0)
  const pick = useRef<HTMLInputElement>(null)
  const path = ids(crumbs)
  const here = crumbs.at(-1)?.id
  const hereRef = useRef(here)
  hereRef.current = here

  const open = async (c: Crumb[]) => {
    setFiles(null); setErr(''); setFind(''); setSecs(0)
    try {
      const r = await list(ids(c))
      setCrumbs(c.length ? c : [{ id: r.root, name: 'Escritório Village' }])
      setFiles(r.files); setNext(r.next)
    } catch (e) { setErr((e as Error).message) }
  }
  useEffect(() => { if (driveOn) open(takeOpenAt()) }, [])
  // espera explícita: conta os segundos enquanto o Drive não responde
  useEffect(() => {
    if (files || err) return
    const t = setInterval(() => setSecs(s => s + 1), 1000)
    return () => clearInterval(t)
  }, [files, err])

  const more = async () => {
    if (!next) return
    const r = await list(path, next).catch(e => { setErr(e.message); return null })
    if (r) { setFiles(f => [...(f ?? []), ...r.files]); setNext(r.next) }
  }

  const send = async (list: FileList | File[]) => {
    const at = path, dir = here
    for (const file of Array.from(list)) {
      const key = crypto.randomUUID()
      setSending(s => [...s, { key, name: file.name, p: 0 }])
      try {
        const f = await upload(at, file, p => setSending(s => s.map(x => x.key === key ? { ...x, p } : x)))
        setSending(s => s.filter(x => x.key !== key))
        if (hereRef.current === dir) setFiles(fs => [...(fs ?? []), f])
      } catch (e) {
        setSending(s => s.map(x => x.key === key ? { ...x, err: (e as Error).message } : x))
      }
    }
  }

  const newFolder = async () => {
    const name = prompt('Nome da nova pasta')?.trim()
    if (!name) return
    try { const f = await mkdir(path, name); setFiles(fs => [f, ...(fs ?? [])]) } catch (e) { setErr((e as Error).message) }
  }

  const get = async (f: DFile) => {
    setGetting(f.id)
    try { await download(path, f) } catch (e) { setErr((e as Error).message) } finally { setGetting('') }
  }

  const tap = (f: DFile) => f.mime === FOLDER ? open([...crumbs, { id: f.id, name: f.name }]) : isImage(f) ? setView(f) : get(f)

  if (!driveOn) return (
    <div className="quadro arquivos">
      <div className="panel empty-goal"><Ph n="folder-simple-dashed" size={36} /><b>Drive só no site oficial</b>
        <small className="muted">No modo demonstração não há conta do Google ligada.</small></div>
    </div>
  )

  const shown = files?.filter(f => f.name.toLowerCase().includes(find.trim().toLowerCase())) ?? []
  const folders = shown.filter(f => f.mime === FOLDER), rest = shown.filter(f => f.mime !== FOLDER)

  return (
    <div className={'quadro arquivos' + (over ? ' over' : '')}
      onDragOver={e => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setOver(true) } }}
      onDragLeave={e => e.currentTarget === e.target && setOver(false)}
      onDrop={e => { e.preventDefault(); setOver(false); if (e.dataTransfer.files.length) send(e.dataTransfer.files) }}>
      <div className="fl-head ar-head">
        <nav className="ar-path" aria-label="Pastas">
          {crumbs.map((c, i) => <span key={c.id}>{i > 0 && <Ph n="caret-right" size={14} />}
            {i < crumbs.length - 1 ? <button onClick={() => open(crumbs.slice(0, i + 1))}>{c.name}</button> : <h1>{c.name}</h1>}</span>)}
        </nav>
        <label className="ar-find"><Ph n="magnifying-glass" size={16} /><input value={find} onChange={e => setFind(e.target.value)} placeholder="Procurar nesta pasta" /></label>
        <button className="btn soft" onClick={newFolder} disabled={!here}><Ph n="folder-simple" size={18} />Nova pasta</button>
        <button className="btn primary" onClick={() => pick.current?.click()} disabled={!here}><Ph n="upload-simple" size={18} fill />Enviar</button>
        <input ref={pick} type="file" multiple hidden onChange={e => { if (e.target.files?.length) send(e.target.files); e.target.value = '' }} />
      </div>

      {err && <div className="panel ar-err"><Ph n="x" size={18} /><span className="grow">{err}</span><button className="btn soft" onClick={() => open(crumbs)}>Tentar de novo</button></div>}

      {sending.length > 0 && <div className="ar-send">
        {sending.map(s => <div key={s.key} className={'ar-sending' + (s.err ? ' bad' : '')}>
          <Ph n={s.err ? 'x' : 'upload-simple'} size={16} /><b className="grow">{s.name}</b>
          {s.err ? <><small>{s.err}</small><button className="iconbtn" onClick={() => setSending(x => x.filter(y => y.key !== s.key))} aria-label="Fechar"><Ph n="x" size={14} /></button></>
            : <><i className="ar-bar"><i style={{ width: Math.round(s.p * 100) + '%' }} /></i><small>{Math.round(s.p * 100)}%</small></>}
        </div>)}
      </div>}

      {!files && !err && <div className="empty-goal"><Ph n="circle-dashed" size={32} /><b>Abrindo a pasta no Drive…</b>
        <small className="muted">Costuma levar 1–3 segundos{secs > 0 ? ` · ${secs}s` : ''}{secs > 8 ? ' · o Google está demorando' : ''}</small></div>}

      {files && !shown.length && <div className="panel empty-goal"><Ph n="folder-simple-dashed" size={36} />
        <b>{find ? 'Nada com esse nome aqui' : 'Pasta vazia'}</b>
        {!find && <small className="muted">Arraste arquivos pra cá ou use “Enviar”. Vai direto pro Drive do Village.</small>}</div>}

      {folders.length > 0 && <div className="ar-folders">
        {folders.map(f => <button key={f.id} className="ar-folder" onClick={() => tap(f)}><Ph n="folder-simple" size={22} fill /><b>{f.name}</b></button>)}
      </div>}

      {rest.length > 0 && <div className="ar-grid">
        {rest.map(f => <div key={f.id} className="ar-file">
          <button className="ar-th" onClick={() => tap(f)} title={isImage(f) ? 'Ver' : 'Baixar'}><Thumb path={path} f={f} /></button>
          <div className="ar-meta">
            <b title={f.name}>{f.name}</b>
            <small className="muted">{f.size ? kb(f.size) + ' · ' : ''}{new Date(f.modified).toLocaleDateString('pt-BR')}</small>
          </div>
          <button className="iconbtn" onClick={() => get(f)} disabled={getting === f.id} aria-label={'Baixar ' + f.name} title="Baixar">
            <Ph n={getting === f.id ? 'circle-dashed' : 'download-simple'} size={18} /></button>
        </div>)}
      </div>}

      {next && <button className="btn soft ar-more" onClick={more}>Mostrar mais</button>}
      {over && <div className="ar-drop"><Ph n="upload-simple" size={40} fill /><b>Solte pra enviar para “{crumbs.at(-1)?.name}”</b></div>}

      {view && <div className="ar-view" onClick={() => setView(null)}>
        <div className="ar-view-box" onClick={e => e.stopPropagation()}>
          <Thumb path={path} f={view} px={1600} />
          <div className="ar-view-bar">
            <b className="grow">{view.name}</b>
            <button className="btn soft" onClick={() => get(view)} disabled={getting === view.id}><Ph n="download-simple" size={18} />{getting === view.id ? 'Baixando…' : 'Baixar original'}</button>
            <button className="iconbtn" onClick={() => setView(null)} aria-label="Fechar"><Ph n="x" size={18} /></button>
          </div>
        </div>
      </div>}
    </div>
  )
}
