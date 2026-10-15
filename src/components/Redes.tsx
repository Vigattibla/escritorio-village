import { useEffect, useState } from 'react'
import { linkedin } from '../data/linkedin'
import { addTask, fileUrl, run, setUi, useStore } from '../store'
import type { Attachment, Channel, Postagem, Task } from '../types'
import { Bell } from './Avisos'
import { Ph } from './Icon'
import MiniAvatar from './MiniAvatar'
import type { PhName } from './ph'
import { CHANNEL_KEYS, CHANNELS } from './v4'
import Estudio, { type AbaEstudio, useAprovaEstudio, usePuxar } from './Estudio'
import { lerAprovar, type ParaAprovar } from '../data/estudio'
import { rankOf } from '../game/ranks'

const ES_KEY = 'rd-estudio'
const lerAberto = () => { try { return localStorage.getItem(ES_KEY) === '1' } catch { return false } }
const gravarAberto = (v: boolean) => { try { localStorage.setItem(ES_KEY, v ? '1' : '0') } catch { /* sem storage */ } }

const quando = (iso: string | null) => iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).replace('.', '') : ''

/** redes agrupam os canais; só as com `auto` publicam sozinhas */
type Rede = { id: string; label: string; ic: PhName; cor: string; canais: Channel[]; auto?: boolean }
const REDES: Rede[] = [
  { id: 'instagram', label: 'Instagram', ic: 'instagram-logo', cor: '#C13584', canais: ['feed', 'reels', 'stories'] },
  { id: 'facebook', label: 'Facebook', ic: 'facebook-logo', cor: '#1877F2', canais: ['facebook'] },
  { id: 'linkedin', label: 'LinkedIn', ic: 'linkedin-logo', cor: '#0A66C2', canais: ['linkedin'], auto: true },
  { id: 'site', label: 'Site', ic: 'globe-simple', cor: '#1f7a3d', canais: ['site'] },
]
const redeDe = (c: Channel | null) => REDES.find(r => c && r.canais.includes(c))

type Col = { id: string; label: string; ic: PhName; dica: string }
const COLS: Col[] = [
  { id: 'producao', label: 'Em produção', ic: 'pencil-simple-line', dica: 'Escrevendo o texto e a arte' },
  { id: 'aprovacao', label: 'Em aprovação', ic: 'seal-check', dica: 'Esperando o aprovador' },
  { id: 'agendado', label: 'Agendado', ic: 'calendar-blank', dica: 'Aprovado, esperando a data' },
  { id: 'publicado', label: 'Publicado', ic: 'check-circle', dica: 'Já está no ar' },
  { id: 'erro', label: 'Não saiu', ic: 'flag-banner', dica: 'Abra o post para ver o motivo' },
]
const colDe = (t: Task, p: Postagem | undefined, agora: number) => {
  if (p) return p.estado === 'publicado' ? 'publicado' : p.estado === 'erro' ? 'erro' : 'agendado'
  if (t.status === 'review') return 'aprovacao'
  if (t.status === 'done') {
    if (redeDe(t.channel)?.auto) return 'erro' // concluída sem passar pela aprovação: não entrou na fila
    return t.publish_at && new Date(t.publish_at).getTime() > agora ? 'agendado' : 'publicado'
  }
  return 'producao'
}

/** aba Publicações: posts de todas as redes, do rascunho ao ar; o Estúdio (rank ≥2 ou adm) abre num painel ao lado */
export default function Redes({ estudio }: { estudio?: boolean }) {
  const tasks = useStore(s => s.tasks)
  const posts = useStore(s => s.rows.postagens)
  const [filtro, setFiltro] = useState('todas')
  const [novo, setNovo] = useState(false)
  const [agora] = useState(() => Date.now())
  const todas = Object.values(tasks).filter(t => t.channel && t.status !== 'declined')
  const lista = todas.filter(t => filtro === 'todas' || redeDe(t.channel)?.id === filtro)
    .sort((a, b) => (posts[b.id]?.quando ?? b.publish_at ?? b.created_at).localeCompare(posts[a.id]?.quando ?? a.publish_at ?? a.created_at))
  const conta = (id: string) => todas.filter(t => redeDe(t.channel)?.id === id).length
  const cols = COLS.filter(c => c.id !== 'erro' || lista.some(t => colDe(t, posts[t.id], agora) === 'erro'))
  const padrao = REDES.find(r => r.id === filtro)?.canais[0] ?? 'feed'
  const podeEs = useStore(s => !!s.meId && (!!s.profiles[s.meId]?.is_admin || rankOf(s.profiles[s.meId]) >= 2))
  const aprova = useAprovaEstudio()
  const [fila] = usePuxar(() => podeEs && aprova ? lerAprovar() : Promise.resolve([] as ParaAprovar[]), 30000)
  const [es, setEs] = useState<{ aba?: AbaEstudio; n: number } | null>(() => podeEs && (estudio || lerAberto()) ? { n: 0 } : null)
  const abrirEs = (aba?: AbaEstudio) => { setEs(e => ({ aba, n: (e?.n ?? 0) + 1 })); gravarAberto(true) }
  const fecharEs = () => { setEs(null); gravarAberto(false) }
  const nFila = fila?.length ?? 0
  return (
    <div className="quadro redes">
      <div className="qbar"><b className="grow"><Ph n="megaphone" size={18} /> Publicações</b><Bell /></div>
      <div className="rd-bar">
        <div className="rd-filtros" role="tablist">
          <button role="tab" aria-selected={filtro === 'todas'} className={filtro === 'todas' ? 'on' : ''} onClick={() => setFiltro('todas')}>Todas<span>{todas.length}</span></button>
          {REDES.map(r => (
            <button key={r.id} role="tab" aria-selected={filtro === r.id} className={filtro === r.id ? 'on' : ''} style={{ '--rc': r.cor } as React.CSSProperties} onClick={() => setFiltro(r.id)}>
              <Ph n={r.ic} size={15} />{r.label}<span>{conta(r.id)}</span>
            </button>
          ))}
        </div>
        <button className="btn primary sm" onClick={() => setNovo(true)}><Ph n="plus" size={14} />Novo post</button>
        {podeEs && <button className={'btn sm rd-es-btn' + (es ? ' ativo' : '')} aria-pressed={!!es} onClick={() => es ? fecharEs() : abrirEs()} title="Peça carrosséis pelos moldes do Estúdio e aprove o que ficou pronto">
          <Ph n="sparkle" size={14} />Pedir arte{nFila > 0 && <i>{nFila}</i>}
        </button>}
      </div>
      <div className="rd-corpo">
      <div className="rd-main">
      <Contas filtro={filtro} />
      <div className="rd-cols" style={{ '--n': cols.length } as React.CSSProperties}>
        {cols.map(c => {
          const ts = lista.filter(t => colDe(t, posts[t.id], agora) === c.id)
          return (
            <section key={c.id} className={'rd-col rd-' + c.id}>
              <h4 title={c.dica}><Ph n={c.ic} size={15} />{c.label}<span className="qcount">{ts.length}</span></h4>
              {c.id === 'producao' && (novo
                ? <Novo canal={padrao} fechar={() => setNovo(false)} />
                : <button className="rd-add" onClick={() => setNovo(true)}><Ph n="plus" size={14} />Novo post</button>)}
              {ts.map(t => <Card key={t.id} t={t} p={posts[t.id]} />)}
              {c.id === 'aprovacao' && nFila > 0 && <button className="rd-es-aviso" onClick={() => abrirEs('aprovar')}><Ph n="sparkle" size={15} />{nFila === 1 ? '1 peça do Estúdio' : `${nFila} peças do Estúdio`} esperando você</button>}
              {!ts.length && c.id !== 'producao' && !(c.id === 'aprovacao' && nFila > 0) && <p className="rd-vazio">{c.dica}</p>}
            </section>
          )
        })}
      </div>
      </div>
      {es && <><div className="rd-es-fundo" onClick={fecharEs} /><Estudio key={es.n} inicio={es.aba} fechar={fecharEs} /></>}
      </div>
    </div>
  )
}

/** cartão de criar, no topo de Em produção (estilo Trello) */
function Novo({ canal, fechar }: { canal: Channel; fechar: () => void }) {
  const meId = useStore(s => s.meId)!
  const [titulo, setTitulo] = useState('')
  const [ch, setCh] = useState<Channel>(canal)
  const criar = async () => {
    const t = await addTask(meId, titulo.trim() || `Post para ${CHANNELS[ch].label}`, null, '', 'todo', null, { channel: ch })
    fechar()
    setUi({ task: t.id })
  }
  return (
    <form className="rd-novo" onSubmit={e => { e.preventDefault(); run(criar()) }} onKeyDown={e => { if (e.key === 'Escape') fechar() }}>
      <textarea autoFocus rows={2} value={titulo} maxLength={140} placeholder="Assunto do post" onChange={e => setTitulo(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); run(criar()) } }} />
      <div className="rd-canais">
        {CHANNEL_KEYS.map(k => (
          <button type="button" key={k} className={'tag ' + CHANNELS[k].tag + (ch === k ? ' on' : '')} onClick={() => setCh(k)} aria-pressed={ch === k}>
            <Ph n={CHANNELS[k].ic} size={13} />{CHANNELS[k].label}
          </button>
        ))}
      </div>
      <small>{redeDe(ch)?.auto ? 'A descrição vira a legenda e as imagens vão junto. Aprovou, sai sozinho na data.' : 'Depois de aprovado, quem publica marca a tarefa como feita.'}</small>
      <div className="rd-novo-ac">
        <button className="btn primary sm" type="submit">Criar e abrir</button>
        <button className="btn ghost sm" type="button" onClick={fechar}>Cancelar</button>
      </div>
    </form>
  )
}

function Capa({ a }: { a: Attachment }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    fileUrl(a).then(u => live && setUrl(u)).catch(() => {})
    return () => { live = false }
  }, [a.path]) // eslint-disable-line react-hooks/exhaustive-deps
  return <div className="rd-capa">{url && <img src={url} alt="" loading="lazy" />}</div>
}

function Card({ t, p }: { t: Task; p?: Postagem }) {
  const dono = useStore(s => s.profiles[t.owner_id])
  const ch = t.channel ? CHANNELS[t.channel] : null
  const imgs = t.attachments.filter(a => a.type.startsWith('image/'))
  const data = p?.estado === 'publicado' ? p.em : p?.quando ?? t.publish_at
  const auto = redeDe(t.channel)?.auto
  return (
    <article className="rd-card" tabIndex={0} onClick={() => setUi({ task: t.id })} onKeyDown={e => { if (e.key === 'Enter') setUi({ task: t.id }) }}>
      {imgs[0] ? <Capa a={imgs[0]} /> : <div className="rd-capa vazia" style={{ '--rc': redeDe(t.channel)?.cor } as React.CSSProperties}>{ch && <Ph n={ch.ic} size={26} />}<small>Sem arte ainda</small></div>}
      <div className="rd-card-in">
        {ch && <span className={'tag ' + ch.tag}><Ph n={ch.ic} size={12} />{ch.label}{imgs.length > 1 && <em>· {imgs.length} imagens</em>}</span>}
        <b>{t.title}</b>
        {t.notes.trim() ? <p>{t.notes.trim()}</p> : <p className="rd-falta">Sem legenda ainda</p>}
        <footer>
          {dono && <span className="rd-quem" title={dono.name}><MiniAvatar avatar={dono.avatar} photo={dono.photo} name={dono.name} size={20} />{dono.name.split(' ')[0]}</span>}
          <span className="grow" />
          {data && <span className="rd-data"><Ph n="calendar-blank" size={13} />{quando(data)}</span>}
          {p?.link && <a href={p.link} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} title="Ver publicado"><Ph n="arrow-square-out" size={14} /></a>}
        </footer>
        {p?.estado === 'erro' && p.erro && <small className="li-erro">{p.erro}</small>}
        {!p && auto && t.status === 'done' && <small className="li-erro">Concluída sem aprovação, por isso não entrou na fila.</small>}
      </div>
    </article>
  )
}

/** contas por rede: LinkedIn conecta (só o adm); as outras ainda são postadas à mão */
function Contas({ filtro }: { filtro: string }) {
  const redes = REDES.filter(r => filtro === 'todas' || r.id === filtro)
  return (
    <div className="rd-contas">
      {redes.map(r => r.id === 'linkedin' ? <Conexao key={r.id} /> : (
        <div key={r.id} className="rd-conta manual" style={{ '--rc': r.cor } as React.CSSProperties}>
          <Ph n={r.ic} size={22} />
          <div className="grow"><b>{r.label}</b><small>Postagem manual</small></div>
        </div>
      ))}
    </div>
  )
}

/** conta do LinkedIn: só o adm conecta */
export function Conexao() {
  const meId = useStore(s => s.meId)!
  const adm = useStore(s => !!s.profiles[meId]?.is_admin)
  const rede = useStore(s => s.rows.redes.linkedin)
  const [busy, setBusy] = useState(false)
  const [erro, setErro] = useState('')
  const conectar = () => {
    setBusy(true); setErro('')
    linkedin<{ url: string }>({ a: 'conectar', volta: location.href.split('#')[0] }).then(r => { location.href = r.url }).catch(e => { setErro(e instanceof Error ? e.message : String(e)); setBusy(false) })
  }
  const [agora] = useState(() => Date.now())
  const vence = rede?.expira ? Math.round((new Date(rede.expira).getTime() - agora) / 86_400_000) : null
  return (
    <div className={'rd-conta' + (rede ? ' on' : '')} style={{ '--rc': '#0A66C2' } as React.CSSProperties}>
      <Ph n="linkedin-logo" size={22} />
      <div className="grow">
        <b>{rede ? rede.nome || 'LinkedIn conectado' : 'LinkedIn'}</b>
        <small>{rede ? `${rede.modo === 'empresa' ? 'Página da empresa' : 'Perfil pessoal'} · publica sozinho${vence !== null ? ` · vale mais ${Math.max(0, vence)} dia${vence === 1 ? '' : 's'}` : ''}` : adm ? 'Não conectado' : 'Não conectado · peça ao adm'}</small>
        {erro && <small className="li-erro">{erro}</small>}
      </div>
      {adm && <button className="btn ghost sm" disabled={busy} onClick={conectar}>{busy ? 'Abrindo…' : rede ? 'Reconectar' : 'Conectar'}</button>}
    </div>
  )
}
