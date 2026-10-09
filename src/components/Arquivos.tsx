import { useEffect, useMemo, useRef, useState } from 'react'
import { download, driveOn, takeOpenAt, FOLDER, isImage, kb, list, mkdir, thumb, upload, type DFile } from '../data/drive'
import { Bell } from './Avisos'
import { Ph } from './Icon'
import Meo from './Meo'
import SegInd from './SegInd'
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

type Tipo = 'tudo' | 'foto' | 'video' | 'doc'
const tipo = (f: DFile): Exclude<Tipo, 'tudo'> => isImage(f) ? 'foto' : f.mime.startsWith('video/') ? 'video' : 'doc'
const TIPOS: [Tipo, string][] = [['tudo', 'Tudo'], ['foto', 'Fotos'], ['video', 'Vídeos'], ['doc', 'Docs']]
const ext = (f: DFile) => (f.name.match(/\.([a-z0-9]{1,5})$/i)?.[1] ?? (f.mime.split('/')[1] ?? 'arq').slice(0, 4)).toUpperCase()
/** cor da capa de arquivo que não é foto */
const capa = (f: DFile) => f.mime.startsWith('video/') ? 'cobalto' : /pdf/.test(f.mime) ? 'tang' : /sheet|excel|csv/.test(f.mime) ? 'postit' : /presentation|powerpoint/.test(f.mime) ? 'chiclete' : 'areia'
const PASTAS = ['cobalto', 'postit', 'tang', 'chiclete', 'areia']
const corPasta = (f: DFile) => PASTAS[[...f.name].reduce((h, c) => h + c.charCodeAt(0), 0) % PASTAS.length]
const quando = (iso: string) => {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 864e5)
  return d < 1 ? 'hoje' : d < 2 ? 'ontem' : d < 7 ? `há ${d} dias` : new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')
}
const lerModo = (): 'grade' | 'lista' => { try { return localStorage.getItem('ev:arquivos:modo') === 'lista' ? 'lista' : 'grade' } catch { return 'grade' } }

/** Pasta "Escritório Village" do Google Drive do Village: ver, enviar e baixar sem sair do site. */
export default function Arquivos() {
  const [crumbs, setCrumbs] = useState<Crumb[]>([])
  const [files, setFiles] = useState<DFile[] | null>(null)
  const [next, setNext] = useState<string | null>(null)
  const [err, setErr] = useState('')
  const [find, setFind] = useState('')
  const [filtro, setFiltro] = useState<Tipo>('tudo')
  const [modo, setModoS] = useState(lerModo)
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
  const setModo = (m: 'grade' | 'lista') => { setModoS(m); try { localStorage.setItem('ev:arquivos:modo', m) } catch { /* sem storage */ } }

  const open = async (c: Crumb[]) => {
    setFiles(null); setErr(''); setFind(''); setFiltro('tudo'); setSecs(0)
    try {
      const r = await list(ids(c))
      setCrumbs(c.length ? c : [{ id: r.root, name: 'Escritório Village' }])
      setFiles(r.files); setNext(r.next)
    } catch (e) { setErr((e as Error).message) }
  }
  useEffect(() => { open(takeOpenAt()) }, [])
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

  const achados = useMemo(() => files?.filter(f => f.name.toLowerCase().includes(find.trim().toLowerCase())) ?? [], [files, find])
  const folders = filtro === 'tudo' ? achados.filter(f => f.mime === FOLDER) : []
  const soltos = achados.filter(f => f.mime !== FOLDER)
  const conta = (t: Tipo) => t === 'tudo' ? soltos.length : soltos.filter(f => tipo(f) === t).length
  // fotos primeiro, depois o resto; dentro de cada grupo, o mais novo antes
  const rest = soltos.filter(f => filtro === 'tudo' || tipo(f) === filtro)
    .sort((a, b) => Number(isImage(b)) - Number(isImage(a)) || b.modified.localeCompare(a.modified))
  const fotos = rest.filter(isImage)
  const vi = view ? fotos.findIndex(f => f.id === view.id) : -1

  // visualizador: setas passam as fotos, Esc fecha
  useEffect(() => {
    if (!view) return
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setView(null)
      if (e.key === 'ArrowRight' && fotos[vi + 1]) setView(fotos[vi + 1])
      if (e.key === 'ArrowLeft' && vi > 0) setView(fotos[vi - 1])
    }
    addEventListener('keydown', k)
    return () => removeEventListener('keydown', k)
  }, [view, fotos, vi])

  const baixar = (f: DFile) => <button className="iconbtn ar-dl" onClick={e => { e.stopPropagation(); get(f) }} disabled={getting === f.id} aria-label={'Baixar ' + f.name} title="Baixar">
    <Ph n={getting === f.id ? 'circle-dashed' : 'download-simple'} size={18} /></button>
  const tecla = (f: DFile) => (e: React.KeyboardEvent) => { if (e.key === 'Enter') tap(f) }

  return (
    <div className={'quadro arquivos ar2' + (over ? ' over' : '')}
      onDragOver={e => { if (here && e.dataTransfer.types.includes('Files')) { e.preventDefault(); setOver(true) } }}
      onDragLeave={e => e.currentTarget === e.target && setOver(false)}
      onDrop={e => { e.preventDefault(); setOver(false); if (here && e.dataTransfer.files.length) send(e.dataTransfer.files) }}>
      <div className="qbar"><span className="grow" /><Bell />
        <button className="btn soft" onClick={newFolder} disabled={!here}><Ph n="plus" size={18} />Nova pasta</button>
        <button className="btn accent" onClick={() => pick.current?.click()} disabled={!here}><Ph n="upload-simple" size={18} fill />Enviar</button>
        <input ref={pick} type="file" multiple hidden onChange={e => { if (e.target.files?.length) send(e.target.files); e.target.value = '' }} />
      </div>

      <div className="qhead ar-top">
        <div className="grow">
          {crumbs.length > 1 && <nav className="ar-trilha" aria-label="Pastas">
            {crumbs.slice(0, -1).map((c, i) => <span key={c.id}>{i > 0 && <Ph n="caret-right" size={12} />}<button onClick={() => open(crumbs.slice(0, i + 1))}>{c.name}</button></span>)}
          </nav>}
          <div className="ar-tit">
            {crumbs.length > 1 && <button className="iconbtn" onClick={() => open(crumbs.slice(0, -1))} aria-label="Voltar uma pasta"><Ph n="caret-left" size={20} /></button>}
            <h1>{crumbs.at(-1)?.name ?? 'Arquivos'}</h1>
          </div>
          <div className="sub">{driveOn ? 'Pasta do Village no Google Drive. Arraste arquivos pra cá pra enviar.' : 'Demonstração: um Drive de mentira, nada sai do seu computador.'}</div>
        </div>
      </div>

      <div className="ar-tools">
        <label className="ar-find"><Ph n="magnifying-glass" size={16} /><input value={find} onChange={e => setFind(e.target.value)} placeholder="Procurar nesta pasta" /></label>
        <div className="ar-chips">{TIPOS.map(([t, l]) => <button key={t} className={'qchip' + (filtro === t ? ' on' : '')} onClick={() => setFiltro(t)} disabled={!files}>
          {l}{files && <small>{conta(t)}</small>}</button>)}</div>
        <div className="seg ar-modo"><SegInd />
          <button className={modo === 'grade' ? 'on' : ''} onClick={() => setModo('grade')} aria-label="Grade" title="Grade"><Ph n="squares-four" size={18} /></button>
          <button className={modo === 'lista' ? 'on' : ''} onClick={() => setModo('lista')} aria-label="Lista" title="Lista"><Ph n="list-bullets" size={18} /></button>
        </div>
      </div>

      {err && <div className="panel ar-err"><Ph n="x" size={18} /><span className="grow">{err}</span><button className="btn soft" onClick={() => open(crumbs)}>Tentar de novo</button></div>}

      {sending.length > 0 && <div className="ar-send">
        {sending.map(s => <div key={s.key} className={'ar-sending' + (s.err ? ' bad' : '')}>
          <Ph n={s.err ? 'x' : 'upload-simple'} size={16} /><b className="grow">{s.name}</b>
          {s.err ? <><small>{s.err}</small><button className="iconbtn" onClick={() => setSending(x => x.filter(y => y.key !== s.key))} aria-label="Fechar"><Ph n="x" size={14} /></button></>
            : <><i className="ar-bar"><i style={{ width: Math.round(s.p * 100) + '%' }} /></i><small>{Math.round(s.p * 100)}%</small></>}
        </div>)}
      </div>}

      {!files && !err && <div className="ar-carrega">
        <div className="ar-esp">{Array.from({ length: 8 }, (_, i) => <i key={i} />)}</div>
        <small className="muted">Abrindo a pasta no Drive… costuma levar 1–3 segundos{secs > 0 ? ` · ${secs}s` : ''}{secs > 8 ? ' · o Google está demorando' : ''}</small>
      </div>}

      {files && !folders.length && !rest.length && <div className="ar-vazio">
        <Meo size={56} color="#2440FF" />
        <b>{find ? 'Nada com esse nome aqui' : filtro !== 'tudo' ? 'Nenhum desse tipo nesta pasta' : 'Pasta vazia'}</b>
        {!find && filtro === 'tudo' && <small className="muted">Arraste arquivos pra cá ou use “Enviar”.</small>}
      </div>}

      {folders.length > 0 && <section className="ar-sec">
        <h4>Pastas <small>{folders.length}</small></h4>
        <div className="ar-pastas">
          {folders.map(f => <button key={f.id} className={'ar-pasta ' + corPasta(f)} onClick={() => tap(f)}>
            <Ph n="folder-simple" size={22} fill /><b>{f.name}</b><small>{quando(f.modified)}</small>
          </button>)}
        </div>
      </section>}

      {rest.length > 0 && <section className="ar-sec">
        {folders.length > 0 && <h4>Arquivos <small>{rest.length}</small></h4>}
        {modo === 'grade' ? <div className="ar-grade">
          {rest.map(f => <div key={f.id} className={'ar-card ' + (isImage(f) ? 'foto' : 'doc ' + capa(f))} onClick={() => tap(f)} role="button" tabIndex={0}
            onKeyDown={tecla(f)} title={isImage(f) ? 'Ver ' + f.name : 'Baixar ' + f.name}>
            <div className="ar-th">{isImage(f) ? <Thumb path={path} f={f} /> : <><Ph n={icon(f)} size={34} />{f.mime.startsWith('video/') && <span className="ar-play"><Ph n="play" size={16} fill /></span>}<em>{ext(f)}</em></>}</div>
            <div className="ar-meta"><b>{f.name}</b><small>{f.size ? kb(f.size) + ' · ' : ''}{quando(f.modified)}</small></div>
            {baixar(f)}
          </div>)}
        </div> : <div className="panel ar-lista">
          {rest.map(f => <div key={f.id} className="ar-linha" onClick={() => tap(f)} role="button" tabIndex={0} onKeyDown={tecla(f)}>
            <span className={'ar-mini ' + (isImage(f) ? 'foto' : capa(f))}>{isImage(f) ? <Thumb path={path} f={f} px={120} /> : <Ph n={icon(f)} size={18} />}</span>
            <b className="grow">{f.name}</b>
            <span className="ar-tipo">{ext(f)}</span>
            <small className="ar-tam">{f.size ? kb(f.size) : '—'}</small>
            <small className="ar-dia">{quando(f.modified)}</small>
            {baixar(f)}
          </div>)}
        </div>}
      </section>}

      {next && <button className="btn soft ar-more" onClick={more}>Mostrar mais</button>}
      {over && <div className="ar-drop"><Meo size={72} color="#FFF8EC" /><b>Solta aqui que eu guardo</b><small>vai para “{crumbs.at(-1)?.name}”</small></div>}

      {view && <div className="ar-view" onClick={() => setView(null)}>
        <div className="ar-view-box" onClick={e => e.stopPropagation()}>
          <div className="ar-view-img">
            <Thumb path={path} f={view} px={1600} />
            {vi > 0 && <button className="ar-nav prev" onClick={() => setView(fotos[vi - 1])} aria-label="Foto anterior"><Ph n="caret-left" size={24} /></button>}
            {vi < fotos.length - 1 && <button className="ar-nav next" onClick={() => setView(fotos[vi + 1])} aria-label="Próxima foto"><Ph n="caret-right" size={24} /></button>}
          </div>
          <div className="ar-view-bar">
            <b className="grow">{view.name}</b>
            {fotos.length > 1 && <small>{vi + 1} de {fotos.length}</small>}
            <button className="btn soft" onClick={() => get(view)} disabled={getting === view.id}><Ph n="download-simple" size={18} />{getting === view.id ? 'Baixando…' : 'Baixar original'}</button>
            <button className="iconbtn" onClick={() => setView(null)} aria-label="Fechar"><Ph n="x" size={18} /></button>
          </div>
        </div>
      </div>}
    </div>
  )
}
