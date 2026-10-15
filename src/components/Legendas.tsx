// Legendas com IA: sobe o vídeo (ou as imagens), escolhe o formato e o Gemini escreve 3 opções na voz
// da marca. O vídeo não sai inteiro do navegador: vão 12 quadros + o áudio em mono. O guia de voz é
// texto puro na tabela marcas_voz; gerente, Chefe ou adm editam aqui mesmo.
import { useEffect, useRef, useState } from 'react'
import { gerar, marcas as lerMarcas, preparar, salvarGuia, type Formato, type Marca, type Opcao, type Preparado } from '../data/legenda'
import { Modal } from '../plano/ui'
import { canUseAI, useStore } from '../store'
import { Ph } from './Icon'
import type { PhName } from './ph'
import '../legendas.css'

const FORMATOS: { id: Formato; nome: string; ic: PhName }[] = [
  { id: 'reel', nome: 'Reels', ic: 'film-strip' },
  { id: 'carrossel', nome: 'Carrossel', ic: 'images' },
  { id: 'stories', nome: 'Stories', ic: 'video-camera' },
  { id: 'post', nome: 'Post', ic: 'note-blank' },
]
const texto = (o: Opcao) => o.legenda.trim() + (o.hashtags.length ? '\n\n' + o.hashtags.join(' ') : '')

export default function Legendas() {
  const podeEditar = useStore(s => canUseAI(s.meId))
  const [lista, setLista] = useState<Marca[]>([])
  const [marca, setMarca] = useState('meudestino')
  const [formato, setFormato] = useState<Formato>('reel')
  const [arquivos, setArquivos] = useState<File[]>([])
  const [prep, setPrep] = useState<Preparado | null>(null)
  const [contexto, setContexto] = useState('')
  const [espera, setEspera] = useState<{ t0: number; msg: string } | null>(null)
  const [agora, setAgora] = useState(Date.now())
  const [erro, setErro] = useState('')
  const [res, setRes] = useState<{ resumo: string; opcoes: Opcao[] } | null>(null)
  const [ajuste, setAjuste] = useState<Record<number, string>>({})
  const [copiado, setCopiado] = useState(-1)
  const [guia, setGuia] = useState<string | null>(null)
  const inp = useRef<HTMLInputElement>(null)

  useEffect(() => { lerMarcas().then(l => { setLista(l); if (l.length && !l.some(m => m.id === marca)) setMarca(l[0].id) }).catch(e => setErro(e.message)) }, [])
  useEffect(() => { if (!espera) return; const t = setInterval(() => setAgora(Date.now()), 500); return () => clearInterval(t) }, [espera])

  const escolher = (fs: FileList | null) => {
    const l = Array.from(fs ?? []).filter(f => /^(video|image)\//.test(f.type))
    if (!l.length) return
    const vid = l.find(f => f.type.startsWith('video/'))
    setArquivos(vid ? [vid] : l.slice(0, 10)); setPrep(null); setRes(null); setErro('')
    if (vid) setFormato(f => f === 'carrossel' || f === 'post' ? 'reel' : f)
    else setFormato(f => f === 'reel' ? (l.length > 1 ? 'carrossel' : 'post') : f)
  }

  async function rodar(extra?: { ajuste?: string; anterior?: string }) {
    setErro(''); const t0 = Date.now(); setAgora(t0)
    try {
      let p = prep
      if (!p && arquivos.length) { p = await preparar(arquivos, msg => setEspera({ t0, msg })); setPrep(p) }
      setEspera({ t0, msg: p?.video ? 'A IA está assistindo e escrevendo' : 'A IA está escrevendo' })
      const r = await gerar({ marca, formato, contexto, prep: p ?? undefined, ...extra })
      if (!r.opcoes?.length) throw new Error('A IA não devolveu opções. Tente de novo.')
      setRes(r); setAjuste({})
    } catch (e) { setErro(e instanceof Error ? e.message : String(e)) }
    finally { setEspera(null) }
  }

  const copiar = async (i: number, o: Opcao) => {
    await navigator.clipboard.writeText(texto(o)).catch(() => {})
    setCopiado(i); setTimeout(() => setCopiado(c => c === i ? -1 : c), 1600)
  }

  const m = lista.find(x => x.id === marca)
  const seg = espera ? Math.floor((agora - espera.t0) / 1000) : 0
  const pronto = arquivos.length > 0 || contexto.trim().length >= 10

  return (
    <div className="lg">
      <section className="lg-form">
        <div className="lg-linha">
          <label className="lg-campo">
            <span>Marca</span>
            <select value={marca} onChange={e => setMarca(e.target.value)} disabled={!!espera}>
              {lista.map(x => <option key={x.id} value={x.id}>{x.nome}</option>)}
            </select>
          </label>
          {m && <button className="btn ghost sm" onClick={() => setGuia(m.guia)}><Ph n="file-text" size={15} /> {podeEditar ? 'Identidade da marca' : 'Ver identidade'}</button>}
        </div>

        <div className="pd-seg lg-seg" role="tablist">
          {FORMATOS.map(f => <button key={f.id} className={formato === f.id ? 'on' : ''} onClick={() => setFormato(f.id)} disabled={!!espera}><Ph n={f.ic} size={15} /> {f.nome}</button>)}
        </div>

        <div className={'lg-drop' + (arquivos.length ? ' cheio' : '')}
          onClick={() => !espera && inp.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); if (!espera) escolher(e.dataTransfer.files) }}>
          <input ref={inp} type="file" accept="video/*,image/*" multiple hidden onChange={e => { escolher(e.target.files); e.target.value = '' }} />
          {prep?.previas.length ? <div className="lg-previas">{prep.previas.slice(0, 12).map((p, i) => <img key={i} src={p} alt="" />)}</div>
            : arquivos.length ? <p><Ph n={arquivos[0].type.startsWith('video/') ? 'film-strip' : 'images'} size={22} /> <b>{arquivos.length === 1 ? arquivos[0].name : `${arquivos.length} imagens`}</b></p>
            : <p><Ph n="upload-simple" size={24} /> <b>Solte o vídeo ou as imagens aqui</b><small>ou toque para escolher · vídeo até ~2 min (o áudio entra na análise)</small></p>}
          {arquivos.length > 0 && !espera && <button className="lg-tira" title="Tirar" onClick={e => { e.stopPropagation(); setArquivos([]); setPrep(null) }}><Ph n="x" size={14} /></button>}
        </div>

        <label className="lg-campo">
          <span>Contexto (opcional, mas ajuda muito)</span>
          <textarea rows={3} value={contexto} onChange={e => setContexto(e.target.value)} maxLength={2000} disabled={!!espera}
            placeholder="Ex.: Reels do resort de Pirenópolis, foco em famílias com criança, divulgar o plano de 7 diárias. Data de postagem: feriado." />
        </label>

        {espera ? (
          <div className="lg-espera" aria-live="polite">
            <span className="lg-giro" />
            <div><b>{espera.msg}…</b><small>{seg} s · costuma levar de 10 a 40 s{prep?.video || arquivos[0]?.type.startsWith('video/') ? ' (vídeo com áudio demora mais)' : ''}</small></div>
          </div>
        ) : (
          <button className="btn primary big lg-gerar" disabled={!pronto || !m} onClick={() => rodar()}><Ph n="sparkle" size={18} /> {res ? 'Gerar de novo' : 'Gerar legendas'}</button>
        )}
        {erro && <p className="lg-erro">{erro}</p>}
      </section>

      {res && (
        <section className="lg-res">
          {res.resumo && <p className="lg-resumo"><Ph n="eye" size={15} /> {res.resumo}</p>}
          {res.opcoes.map((o, i) => (
            <article key={i} className="lg-op">
              <header><b>{o.titulo}</b>
                <button className={'btn sm ' + (copiado === i ? 'primary' : 'ghost')} onClick={() => copiar(i, o)}><Ph n={copiado === i ? 'check' : 'copy'} size={15} /> {copiado === i ? 'Copiado' : 'Copiar'}</button>
              </header>
              <div className="lg-txt">{o.legenda}</div>
              {o.hashtags.length > 0 && <div className="lg-tags">{o.hashtags.join(' ')}</div>}
              <footer>
                <input value={ajuste[i] ?? ''} onChange={e => setAjuste(a => ({ ...a, [i]: e.target.value }))} maxLength={300} disabled={!!espera}
                  placeholder="Ajuste: mais curta, sem emoji, citar o preço…" onKeyDown={e => { if (e.key === 'Enter' && !espera) rodar({ ajuste: ajuste[i] || 'outra versão', anterior: texto(o) }) }} />
                <button className="btn ghost sm" disabled={!!espera} onClick={() => rodar({ ajuste: ajuste[i] || 'outra versão, com abordagem diferente', anterior: texto(o) })}><Ph n="pencil-simple-line" size={15} /> {ajuste[i] ? 'Ajustar' : 'Outra versão'}</button>
              </footer>
            </article>
          ))}
        </section>
      )}

      {guia !== null && m && (
        <Modal title={'Identidade · ' + m.nome} onClose={() => setGuia(null)} wide>
          <p className="lg-ajuda">A IA lê este texto antes de cada legenda. Escreva como explicaria a marca para alguém novo: voz, palavras que usa e que evita, regras de hashtag.</p>
          <textarea className="lg-guia" value={guia} onChange={e => setGuia(e.target.value)} readOnly={!podeEditar} maxLength={20000} />
          {podeEditar && <div className="lg-acts">
            <button className="btn ghost" onClick={() => setGuia(null)}>Cancelar</button>
            <button className="btn primary" onClick={async () => {
              try { await salvarGuia(m.id, guia); setLista(l => l.map(x => x.id === m.id ? { ...x, guia } : x)); setGuia(null) }
              catch (e) { setErro(e instanceof Error ? e.message : String(e)); setGuia(null) }
            }}>Salvar</button>
          </div>}
        </Modal>
      )}
    </div>
  )
}
