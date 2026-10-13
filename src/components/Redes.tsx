import { useState } from 'react'
import { linkedin } from '../data/linkedin'
import { addTask, run, setUi, useStore } from '../store'
import type { Postagem, Task } from '../types'
import { Bell } from './Avisos'
import { Ph } from './Icon'
import type { PhName } from './ph'

const quando = (iso: string | null) => iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).replace('.', '') : ''
type Col = { id: string; label: string; ic: PhName; dica: string }
const COLS: Col[] = [
  { id: 'producao', label: 'Em produção', ic: 'pencil-simple-line', dica: 'Escrevendo o texto e a arte' },
  { id: 'aprovacao', label: 'Em aprovação', ic: 'seal-check', dica: 'Esperando o aprovador' },
  { id: 'agendado', label: 'Agendado', ic: 'calendar-blank', dica: 'Aprovado: sai sozinho na data' },
  { id: 'publicado', label: 'Publicado', ic: 'check-circle', dica: 'Já está no LinkedIn' },
  { id: 'erro', label: 'Não saiu', ic: 'flag-banner', dica: 'Abra o post para ver o motivo' },
]
const colDe = (t: Task, p?: Postagem) => {
  if (p) return p.estado === 'publicado' ? 'publicado' : p.estado === 'erro' ? 'erro' : 'agendado'
  if (t.status === 'review') return 'aprovacao'
  if (t.status === 'done') return 'erro'
  return 'producao'
}

/** aba Redes: posts do LinkedIn do começo ao fim, e a conta conectada */
export default function Redes() {
  const meId = useStore(s => s.meId)!
  const tasks = useStore(s => s.tasks)
  const posts = useStore(s => s.rows.postagens)
  const [titulo, setTitulo] = useState('')
  const lista = Object.values(tasks).filter(t => t.channel === 'linkedin' && t.status !== 'declined')
    .sort((a, b) => (posts[b.id]?.quando ?? b.publish_at ?? b.created_at).localeCompare(posts[a.id]?.quando ?? a.publish_at ?? a.created_at))
  const novo = async () => {
    const t = await addTask(meId, titulo || 'Post para o LinkedIn', null, '', 'todo', null, { channel: 'linkedin' })
    setTitulo('')
    setUi({ task: t.id })
  }
  return (
    <div className="quadro redes">
      <div className="qbar"><b className="grow"><Ph n="linkedin-logo" size={18} /> LinkedIn</b><Bell /></div>
      <div className="rd-top">
        <Conexao />
        <form className="rd-novo" onSubmit={e => { e.preventDefault(); run(novo()) }}>
          <input value={titulo} maxLength={140} placeholder="Assunto do novo post" onChange={e => setTitulo(e.target.value)} />
          <button className="btn primary sm" type="submit"><Ph n="plus" size={14} />Novo post</button>
          <small>A descrição vira a legenda, as imagens anexadas vão junto. Aprovou, sai na data marcada (sem data, na hora).</small>
        </form>
      </div>
      <div className="rd-cols">
        {COLS.map(c => {
          const ts = lista.filter(t => colDe(t, posts[t.id]) === c.id)
          return (
            <section key={c.id} className={'rd-col rd-' + c.id}>
              <h4 title={c.dica}><Ph n={c.ic} size={15} />{c.label}<span className="qcount">{ts.length}</span></h4>
              {ts.map(t => <Card key={t.id} t={t} p={posts[t.id]} />)}
              {!ts.length && <p className="rd-vazio">{c.dica}</p>}
            </section>
          )
        })}
      </div>
    </div>
  )
}

function Card({ t, p }: { t: Task; p?: Postagem }) {
  const dono = useStore(s => s.profiles[t.owner_id])
  const data = p?.estado === 'publicado' ? p.em : p?.quando ?? t.publish_at
  return (
    <article className="rd-card" onClick={() => setUi({ task: t.id })}>
      <b>{t.title}</b>
      {t.notes.trim() ? <p>{t.notes.trim()}</p> : <p className="rd-falta">Sem legenda ainda</p>}
      <footer>
        <span>{dono?.name.split(' ')[0] ?? ''}</span>
        {t.attachments.some(a => a.type.startsWith('image/')) && <span title="Imagens"><Ph n="images" size={13} />{t.attachments.filter(a => a.type.startsWith('image/')).length}</span>}
        <span className="grow" />
        {data && <span><Ph n="calendar-blank" size={13} />{quando(data)}</span>}
        {p?.link && <a href={p.link} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} title="Ver no LinkedIn"><Ph n="arrow-square-out" size={14} /></a>}
      </footer>
      {p?.estado === 'erro' && p.erro && <small className="li-erro">{p.erro}</small>}
      {!p && t.status === 'done' && <small className="li-erro">Concluída sem aprovação, por isso não entrou na fila.</small>}
    </article>
  )
}

/** conta conectada: só o adm conecta */
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
    <div className={'rd-conta' + (rede ? ' on' : '')}>
      <Ph n="linkedin-logo" size={28} />
      <div className="grow">
        <b>{rede ? rede.nome || 'Conta conectada' : 'LinkedIn não conectado'}</b>
        <small>{rede ? `${rede.modo === 'empresa' ? 'Página da empresa' : 'Perfil pessoal'}${vence !== null ? ` · conexão vale mais ${Math.max(0, vence)} dia${vence === 1 ? '' : 's'}` : ''}` : adm ? 'Conecte para os posts aprovados saírem sozinhos.' : 'Peça ao adm para conectar.'}</small>
        {erro && <small className="li-erro">{erro}</small>}
      </div>
      {adm && <button className="btn ghost sm" disabled={busy} onClick={conectar}>{busy ? 'Abrindo o LinkedIn…' : rede ? 'Conectar de novo' : 'Conectar'}</button>}
    </div>
  )
}
