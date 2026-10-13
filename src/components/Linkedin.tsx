import { useEffect, useState } from 'react'
import { linkedin } from '../data/linkedin'
import { notify, useStore } from '../store'
import type { Task } from '../types'
import { Ph } from './Icon'

const quando = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
const ESTADO = { agendado: 'Agendado', publicando: 'Publicando…', publicado: 'Publicado', erro: 'Não saiu' } as const

/** volta do LinkedIn depois de conectar (#linkedin=ok ou o motivo) */
export function useVoltaLinkedin(pronto: boolean) {
  useEffect(() => {
    if (!pronto) return
    const m = location.hash.match(/^#linkedin=(.*)$/)
    if (!m) return
    history.replaceState(null, '', location.pathname + location.search)
    notify(m[1] === 'ok' ? 'LinkedIn conectado. Posts aprovados já saem sozinhos.' : 'O LinkedIn não conectou: ' + decodeURIComponent(m[1]))
  }, [pronto])
}

/** caixa do post no LinkedIn: conexão, fila, link e erro */
export function LinkedinBox({ t }: { t: Task }) {
  const meId = useStore(s => s.meId)!
  const adm = useStore(s => !!s.profiles[meId]?.is_admin)
  const rede = useStore(s => s.rows.redes.linkedin)
  const post = useStore(s => s.rows.postagens[t.id])
  const [busy, setBusy] = useState('')
  const [erro, setErro] = useState('')
  const vai = (k: string, f: () => Promise<unknown>) => { setBusy(k); setErro(''); f().catch(e => setErro(e instanceof Error ? e.message : String(e))).finally(() => setBusy('')) }
  const conectar = () => vai('c', async () => { const r = await linkedin<{ url: string }>({ a: 'conectar', volta: location.href.split('#')[0] }); location.href = r.url })
  const agora = () => vai('a', () => linkedin({ a: 'agora', id: t.id }))
  const podeAgora = adm || post?.aprovado_por === meId
  const vence = rede?.expira ? Math.round((new Date(rede.expira).getTime() - Date.now()) / 86_400_000) : null
  const semTexto = !t.notes.trim()
  return (
    <div className="li-box">
      <div className="li-top"><Ph n="linkedin-logo" /> <b>LinkedIn</b>
        {post ? <span className={'li-estado ' + post.estado}>{busy === 'a' ? 'Publicando…' : ESTADO[post.estado]}</span>
          : <span className="li-estado">{t.status === 'done' ? 'Fora da fila' : 'Sai quando for aprovado'}</span>}
      </div>
      {!rede && <p className="li-msg">Nenhuma conta conectada.{adm ? '' : ' Peça ao adm para conectar.'}</p>}
      {rede && <p className="li-msg">Publica como <b>{rede.nome || 'conta conectada'}</b>{vence !== null && vence < 15 ? ` · conexão vence em ${Math.max(0, vence)} dia${vence === 1 ? '' : 's'}` : ''}</p>}
      {post?.estado === 'agendado' && <p className="li-msg">Sai em {quando(post.quando)} (confere a cada 5 min).</p>}
      {post?.estado === 'publicado' && post.link && <a className="li-link" href={post.link} target="_blank" rel="noreferrer"><Ph n="arrow-square-out" /> Ver no LinkedIn</a>}
      {post?.estado === 'erro' && post.erro && <p className="li-erro">{post.erro}</p>}
      {semTexto && !post && <p className="li-msg">A descrição da tarefa vira a legenda; as imagens anexadas vão junto.</p>}
      {erro && <p className="li-erro">{erro}</p>}
      <div className="li-acoes">
        {adm && <button className="btn ghost sm" disabled={!!busy} onClick={conectar}>{busy === 'c' ? 'Abrindo o LinkedIn…' : rede ? 'Conectar de novo' : 'Conectar LinkedIn'}</button>}
        {post && (post.estado === 'erro' || post.estado === 'agendado') && podeAgora && <button className="btn primary sm" disabled={!!busy} onClick={agora}>{busy === 'a' ? 'Publicando… (até 30 s)' : post.estado === 'erro' ? 'Tentar de novo' : 'Publicar agora'}</button>}
      </div>
    </div>
  )
}
