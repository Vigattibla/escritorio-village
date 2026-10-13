import { useEffect, useMemo, useRef, useState } from 'react'
import { acervo, kb, thumb, type AFoto, type APasta } from '../data/drive'
import { Ph } from './Icon'

/** Todas as fotos do Drive (só adm), organizadas por produto, ano e pasta. Só lê: não move nada no Drive. */

const PRODUTOS = ['Casa de Campo', 'Meu Destino', 'Village Convention', 'Village Resort', 'Outros'] as const
type Produto = typeof PRODUTOS[number]
const sem = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const produtoDe = (caminho: string): Produto => {
  const c = sem(caminho)
  return /casa de campo/.test(c) ? 'Casa de Campo' : /meu ?destino/.test(c) ? 'Meu Destino' : /convention|convencao|centro de eventos/.test(c) ? 'Village Convention'
    : /resort|village/.test(c) ? 'Village Resort' : 'Outros'
}

type Indice = { fotos: AFoto[]; pastas: APasta[]; em: string }
// guardado no navegador (IndexedDB): pode ter dezenas de milhares de fotos, não cabe no localStorage
const DB = 'ev-acervo'
const abrir = () => new Promise<IDBDatabase>((ok, ruim) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore('k'); r.onsuccess = () => ok(r.result); r.onerror = () => ruim(r.error) })
async function lerIndice(): Promise<Indice | null> {
  try { const db = await abrir(); return await new Promise(ok => { const r = db.transaction('k').objectStore('k').get('indice'); r.onsuccess = () => ok(r.result ?? null); r.onerror = () => ok(null) }) } catch { return null }
}
async function gravarIndice(v: Indice) {
  try { const db = await abrir(); db.transaction('k', 'readwrite').objectStore('k').put(v, 'indice') } catch { /* sem cache: lê de novo na próxima */ }
}

function Mini({ id, px = 300 }: { id: string; px?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [src, setSrc] = useState('')
  const [ver, setVer] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(e => { if (e[0].isIntersecting) { setVer(true); io.disconnect() } }, { rootMargin: '300px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  useEffect(() => {
    if (!ver) return
    let on = true
    thumb(null, id, px).then(u => on && setSrc(u), () => {})
    return () => { on = false }
  }, [ver, id, px])
  return <div ref={ref} className="ac-mini">{src ? <img src={src} alt="" draggable={false} /> : <Ph n="images" size={26} />}</div>
}

const POR_PASTA = 18, SECOES = 20

export default function Acervo({ onClose }: { onClose: () => void }) {
  const [ind, setInd] = useState<Indice | null>(null)
  const [carregou, setCarregou] = useState(false)
  const [lendo, setLendo] = useState<{ fase: string; n: number } | null>(null)
  const [secs, setSecs] = useState(0)
  const [err, setErr] = useState('')
  const [prod, setProd] = useState<Produto | 'todos'>('todos')
  const [ano, setAno] = useState('todos')
  const [find, setFind] = useState('')
  const [unicas, setUnicas] = useState(true)
  const [abertas, setAbertas] = useState<Set<string>>(new Set())
  const [mais, setMais] = useState({ k: '', n: SECOES })
  const [view, setView] = useState<AFoto | null>(null)

  useEffect(() => { lerIndice().then(v => { setInd(v); setCarregou(true) }) }, [])
  useEffect(() => {
    if (!lendo) return
    const t0 = Date.now(), t = setInterval(() => setSecs(Math.round((Date.now() - t0) / 1000)), 1000)
    return () => { clearInterval(t); setSecs(0) }
  }, [!!lendo]) // eslint-disable-line react-hooks/exhaustive-deps

  const ler = async () => {
    setErr('')
    try {
      const pastas: APasta[] = [], fotos: AFoto[] = []
      let next: string | null | undefined
      setLendo({ fase: 'pastas', n: 0 })
      do { const r: { items: APasta[]; next: string | null } = await acervo('pastas', next ?? undefined); pastas.push(...r.items); next = r.next; setLendo({ fase: 'pastas', n: pastas.length }) } while (next)
      next = undefined
      setLendo({ fase: 'fotos', n: 0 })
      do { const r: { items: AFoto[]; next: string | null } = await acervo('fotos', next ?? undefined); fotos.push(...r.items); next = r.next; setLendo({ fase: 'fotos', n: fotos.length }) } while (next)
      const v = { fotos, pastas, em: new Date().toISOString() }
      setInd(v); gravarIndice(v)
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)) }
    setLendo(null)
  }

  // caminho de cada pasta, de cima pra baixo
  const caminho = useMemo(() => {
    const m = new Map((ind?.pastas ?? []).map(p => [p[0], p]))
    const memo = new Map<string, string>()
    const de = (id: string, n = 0): string => {
      if (memo.has(id)) return memo.get(id)!
      const p = m.get(id)
      const c = !p ? '' : n > 40 ? p[1] : [de(p[2], n + 1), p[1]].filter(Boolean).join(' / ')
      memo.set(id, c)
      return c
    }
    return (id: string) => de(id) || 'Sem pasta'
  }, [ind])

  const tudo = useMemo(() => (ind?.fotos ?? []).map(f => { const c = caminho(f[2]); return { f, c, p: produtoDe(c + ' / ' + f[1]), a: f[3].slice(0, 4) } }), [ind, caminho])
  const repet = useMemo(() => {
    const m = new Map<string, number>()
    for (const { f } of tudo) if (f[4]) m.set(f[4], (m.get(f[4]) ?? 0) + 1)
    return m
  }, [tudo])
  const anos = useMemo(() => [...new Set(tudo.map(x => x.a))].sort().reverse(), [tudo])
  const busca = sem(find.trim())
  // filtro novo volta para as primeiras pastas
  const chave = [prod, ano, busca, unicas].join('|')
  const quantas = mais.k === chave ? mais.n : SECOES

  const filtradas = useMemo(() => {
    const vistas = new Set<string>()
    return tudo
      .filter(x => (prod === 'todos' || x.p === prod) && (ano === 'todos' || x.a === ano) && (!busca || sem(x.c + ' ' + x.f[1]).includes(busca)))
      .sort((a, b) => PRODUTOS.indexOf(a.p) - PRODUTOS.indexOf(b.p) || a.c.localeCompare(b.c, 'pt-BR', { numeric: true }) || a.f[1].localeCompare(b.f[1], 'pt-BR', { numeric: true }))
      .filter(x => { if (!unicas || !x.f[4]) return true; if (vistas.has(x.f[4])) return false; vistas.add(x.f[4]); return true })
  }, [tudo, prod, ano, busca, unicas])

  const secoes = useMemo(() => {
    const m = new Map<string, { c: string; p: Produto; fotos: AFoto[] }>()
    for (const x of filtradas) { const k = x.f[2] || '-'; if (!m.has(k)) m.set(k, { c: x.c, p: x.p, fotos: [] }); m.get(k)!.fotos.push(x.f) }
    return [...m.entries()]
  }, [filtradas])
  const contaProd = (p: Produto) => tudo.filter(x => x.p === p).length
  const seq = useMemo(() => secoes.slice(0, quantas).flatMap(([k, s]) => abertas.has(k) ? s.fotos : s.fotos.slice(0, POR_PASTA)), [secoes, quantas, abertas])
  const vi = view ? seq.indexOf(view) : -1
  const nRep = tudo.length - new Set(tudo.map(x => x.f[4] || x.f[0])).size

  useEffect(() => {
    if (!view) return
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setView(null)
      else if (e.key === 'ArrowLeft' && vi > 0) setView(seq[vi - 1])
      else if (e.key === 'ArrowRight' && vi < seq.length - 1) setView(seq[vi + 1])
    }
    addEventListener('keydown', k)
    return () => removeEventListener('keydown', k)
  }, [view, vi, seq])

  return (
    <div className="quadro arquivos ar2 acervo">
      <div className="qhead ar-top">
        <div className="grow">
          <div className="ar-tit">
            <button className="iconbtn" onClick={onClose} aria-label="Voltar para Arquivos"><Ph n="caret-left" size={20} /></button>
            <h1>Fotos do Drive</h1>
          </div>
          <div className="sub">Todas as fotos do Drive do Village, organizadas por produto, ano e pasta. Só você (adm) vê esta tela, e ela não mexe em nada no Drive.</div>
        </div>
        {ind && !lendo && <button className="btn soft" onClick={ler}><Ph n="magnifying-glass" size={18} />Ler de novo</button>}
      </div>

      {err && <div className="panel ar-err"><Ph n="x" size={18} /><span className="grow">{err}</span><button className="btn soft" onClick={ler}>Tentar de novo</button></div>}

      {lendo && <div className="panel ac-lendo">
        <Ph n="circle-dashed" size={20} />
        <span className="grow"><b>{lendo.fase === 'pastas' ? `Lendo as pastas… ${lendo.n.toLocaleString('pt-BR')}` : `Juntando as fotos… ${lendo.n.toLocaleString('pt-BR')}`}</b>
          <small className="muted"> · o Google entrega mil por vez, cerca de 1 a 2 segundos cada · {secs}s</small></span>
      </div>}

      {carregou && !ind && !lendo && <div className="ar-vazio">
        <Ph n="images" size={48} />
        <b>Ainda não li o Drive</b>
        <small className="muted">Eu passo por todas as pastas e junto as fotos aqui. Num Drive grande pode levar alguns minutos; o contador mostra o andamento.</small>
        <button className="btn accent" onClick={ler}><Ph n="magnifying-glass" size={18} />Ler o Drive todo</button>
      </div>}

      {ind && <>
        <div className="ar-tools">
          <label className="ar-find"><Ph n="magnifying-glass" size={16} /><input value={find} onChange={e => setFind(e.target.value)} placeholder="Procurar por pasta ou nome" /></label>
          <label className="ac-uni"><input type="checkbox" checked={unicas} onChange={e => setUnicas(e.target.checked)} />Esconder repetidas{nRep > 0 && <small>{nRep.toLocaleString('pt-BR')}</small>}</label>
        </div>
        <div className="ar-chips ac-chips">
          <button className={'qchip' + (prod === 'todos' ? ' on' : '')} onClick={() => setProd('todos')}>Todos<small>{tudo.length.toLocaleString('pt-BR')}</small></button>
          {PRODUTOS.map(p => { const n = contaProd(p); return n > 0 && <button key={p} className={'qchip' + (prod === p ? ' on' : '')} onClick={() => setProd(p)}>{p}<small>{n.toLocaleString('pt-BR')}</small></button> })}
        </div>
        <div className="ar-chips ac-chips">
          <button className={'qchip' + (ano === 'todos' ? ' on' : '')} onClick={() => setAno('todos')}>Todos os anos</button>
          {anos.map(a => <button key={a} className={'qchip' + (ano === a ? ' on' : '')} onClick={() => setAno(a)}>{a}</button>)}
        </div>
        <small className="muted ac-info">{filtradas.length.toLocaleString('pt-BR')} fotos em {secoes.length.toLocaleString('pt-BR')} pastas · lido em {new Date(ind.em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</small>

        {secoes.slice(0, quantas).map(([k, s]) => {
          const aberta = abertas.has(k)
          return <section key={k} className="ar-sec ac-sec">
            <h4><span className="ac-prod">{s.p}</span><span className="grow ac-cam" title={s.c}>{s.c}</span><small>{s.fotos.length}</small></h4>
            <div className="ac-grade">
              {(aberta ? s.fotos : s.fotos.slice(0, POR_PASTA)).map(f => <button key={f[0]} className="ac-foto" onClick={() => setView(f)} title={f[1]}>
                <Mini id={f[0]} />{repet.get(f[4])! > 1 && <span className="ac-rep" title={`Está em ${repet.get(f[4])} lugares`}><Ph n="copy" size={12} />{repet.get(f[4])}</span>}
              </button>)}
            </div>
            {s.fotos.length > POR_PASTA && <button className="btn soft sm ac-mais" onClick={() => setAbertas(x => { const n = new Set(x); if (aberta) n.delete(k); else n.add(k); return n })}>
              {aberta ? 'Mostrar menos' : `Ver as ${s.fotos.length}`}</button>}
          </section>
        })}
        {secoes.length > quantas && <button className="btn soft ar-more" onClick={() => setMais({ k: chave, n: quantas + SECOES })}>Mostrar mais pastas ({(secoes.length - quantas).toLocaleString('pt-BR')})</button>}
        {!filtradas.length && <div className="ar-vazio"><b>Nenhuma foto com esse filtro</b></div>}
      </>}

      {view && <div className="ar-view" onClick={() => setView(null)}>
        <div className="ar-view-box" onClick={e => e.stopPropagation()}>
          <div className="ar-view-img">
            <Mini key={view[0]} id={view[0]} px={1600} />
            {vi > 0 && <button className="ar-nav prev" onClick={() => setView(seq[vi - 1])} aria-label="Foto anterior"><Ph n="caret-left" size={24} /></button>}
            {vi >= 0 && vi < seq.length - 1 && <button className="ar-nav next" onClick={() => setView(seq[vi + 1])} aria-label="Próxima foto"><Ph n="caret-right" size={24} /></button>}
          </div>
          <div className="ar-view-bar">
            <span className="grow ac-vtxt"><b>{view[1]}</b><small>{caminho(view[2])} · {view[3].split('-').reverse().join('/')}{view[5] ? ' · ' + kb(view[5]) : ''}{repet.get(view[4])! > 1 ? ` · está em ${repet.get(view[4])} lugares` : ''}</small></span>
            <a className="btn soft" href={`https://drive.google.com/file/d/${view[0]}/view`} target="_blank" rel="noreferrer"><Ph n="arrow-square-out" size={18} />Abrir no Drive</a>
            <button className="iconbtn" onClick={() => setView(null)} aria-label="Fechar"><Ph n="x" size={18} /></button>
          </div>
        </div>
      </div>}
    </div>
  )
}
