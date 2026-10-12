import { useEffect, useRef, useState } from 'react'
import { dayKey } from '../game/xp'
import { canEditTask, me, run, team, updateTask, useStore } from '../store'
import { textoRelatorio } from '../data/ia'
import type { Profile, Task } from '../types'
import { Ph } from './Icon'
import MiniAvatar from './MiniAvatar'
import { Fundo } from './Fundo'

/** segunda-feira da semana de d, deslocada n semanas */
export const segunda = (n = 0, d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7) + n * 7); return x }
const curto = (d: Date) => d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }).replace('.', '')
const local = (k: string) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d) }
const dia = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric' }).replace('.', '')

/** Relatório da semana: o que cada um concluiu. As concluídas de semanas passadas saem do quadro e ficam guardadas aqui. */
export default function Relatorio({ onClose }: { onClose: () => void }) {
  const s = useStore(x => x)
  const [n, setN] = useState(0)
  // período escolhido à mão (de/até, inclusive); null = semana das setas
  const [per, setPer] = useState<{ de: string; ate: string } | null>(null)
  const [quem, setQuem] = useState<string | null>(me()?.id ?? null)
  const ini = per ? local(per.de) : segunda(n)
  const fim = per ? new Date(local(per.ate).getTime() + 864e5 + 36e5) : segunda(n + 1)
  fim.setHours(0, 0, 0, 0)
  const atual = !per && n === 0
  const a = dayKey(ini), b = dayKey(fim)
  const hoje = dayKey(new Date())
  const tasks = Object.values(s.tasks)
  const naSemana = (iso: string | null) => !!iso && dayKey(iso) >= a && dayKey(iso) < b
  const gente = team(s.profiles, s).filter(p => p.avatar).sort((x, y) => x.name.localeCompare(y.name))
  const linhas = gente.map(p => {
    const meu = (t: Task) => t.owner_id === p.id
    const feitas = tasks.filter(t => meu(t) && t.status === 'done' && naSemana(t.done_at)).sort((x, y) => x.done_at!.localeCompare(y.done_at!))
    const ajudou = tasks.filter(t => !meu(t) && t.collaborators.includes(p.id) && t.status === 'done' && naSemana(t.done_at))
    const abertas = tasks.filter(t => meu(t) && (t.status === 'todo' || t.status === 'doing' || t.status === 'review'))
    const atrasadas = abertas.filter(t => t.due && t.due < hoje)
    const refeitas = tasks.filter(t => meu(t) && t.reviews.some(r => r.ok === false && naSemana(r.at)))
    return { p, feitas, ajudou, abertas, atrasadas, refeitas }
  })
  const sel = linhas.find(l => l.p.id === quem) ?? null
  const vis = sel ? [sel] : linhas
  const total = vis.reduce((m, l) => m + l.feitas.length, 0)
  const close = () => onClose()
  const caixa = useRef<HTMLDivElement>(null)
  // na impressão o relatório encolhe até caber numa folha A4
  useEffect(() => {
    const antes = () => {
      const el = caixa.current
      if (!el) return
      el.style.zoom = ''; el.classList.add('rel-imp')
      const folha = 273 * 96 / 25.4
      el.style.zoom = String(Math.min(1, folha / el.scrollHeight))
    }
    const depois = () => { const el = caixa.current; if (el) { el.classList.remove('rel-imp'); el.style.zoom = '' } }
    window.addEventListener('beforeprint', antes); window.addEventListener('afterprint', depois)
    return () => { window.removeEventListener('beforeprint', antes); window.removeEventListener('afterprint', depois) }
  }, [])
  return (
    <Fundo className="modal-bg" onMouseDown={e => e.target === e.currentTarget && close()} onKeyDown={e => e.key === 'Escape' && close()}>
      <div ref={caixa} className="rel" role="dialog" aria-label="Relatório da semana">
        <header className="rel-top">
          <div className="grow">
            <h2>{sel ? `Relatório de ${sel.p.name.split(' ')[0]}` : 'Relatório da equipe'}</h2>
            <small>{curto(ini)} – {curto(new Date(fim.getTime() - 864e5))} · {total} concluída{total === 1 ? '' : 's'}</small>
          </div>
          {per ? (
            <div className="rel-sem rel-dias no-print">
              <label>de <input type="date" value={per.de} max={per.ate} onChange={e => e.target.value && setPer({ ...per, de: e.target.value })} /></label>
              <label>até <input type="date" value={per.ate} min={per.de} max={hoje} onChange={e => e.target.value && setPer({ ...per, ate: e.target.value })} /></label>
              <button className="iconbtn" onClick={() => setPer(null)} aria-label="Voltar para semanas"><Ph n="x" size={16} /></button>
            </div>
          ) : (
            <div className="rel-sem no-print">
              <button className="iconbtn" onClick={() => setN(n - 1)} aria-label="Semana anterior"><Ph n="caret-left" size={18} /></button>
              <b>{n === 0 ? 'Esta semana' : n === -1 ? 'Semana passada' : `${-n} semanas atrás`}</b>
              <button className="iconbtn" onClick={() => setN(n + 1)} disabled={n >= 0} aria-label="Próxima semana"><Ph n="caret-right" size={18} /></button>
              <button className="iconbtn" onClick={() => setPer({ de: a, ate: dayKey(new Date(Math.min(fim.getTime() - 864e5, Date.now()))) })} aria-label="Escolher os dias" title="Escolher os dias"><Ph n="calendar-dots" size={18} /></button>
            </div>
          )}
          <button className="btn soft no-print" onClick={() => print()}><Ph n="printer" size={18} />Imprimir / PDF</button>
          <button className="btn ghost sm no-print" onClick={close} aria-label="Fechar">✕</button>
        </header>
        <div className="rel-quem no-print" role="tablist" aria-label="De quem é o relatório">
          {linhas.map(({ p }) => <button key={p.id} type="button" role="tab" aria-selected={quem === p.id} className={quem === p.id ? 'on' : ''} onClick={() => setQuem(p.id)}>
            <MiniAvatar avatar={p.avatar} photo={p.photo} name={p.name} size={22} />{p.name.split(' ')[0]}</button>)}
          <button type="button" role="tab" aria-selected={!sel} className={!sel ? 'on' : ''} onClick={() => setQuem(null)}><Ph n="users-three" size={16} />Equipe toda</button>
        </div>
        <div className="rel-lista">
          {vis.map(({ p, feitas, ajudou, abertas, atrasadas, refeitas }) => (
            <section key={p.id} className="rel-p">
              <header>
                <MiniAvatar avatar={p.avatar} photo={p.photo} name={p.name} size={36} />
                <span className="grow"><b>{p.name}</b><small>{p.role}</small></span>
                <span className="rel-n"><b>{feitas.length}</b>concluída{feitas.length === 1 ? '' : 's'}</span>
                {ajudou.length > 0 && <span className="rel-n"><b>{ajudou.length}</b>ajudou</span>}
                {atual && <span className="rel-n"><b>{abertas.length}</b>em aberto</span>}
                {atual && atrasadas.length > 0 && <span className="rel-n tang"><b>{atrasadas.length}</b>atrasada{atrasadas.length === 1 ? '' : 's'}</span>}
                {refeitas.length > 0 && <span className="rel-n"><b>{refeitas.length}</b>refeita{refeitas.length === 1 ? '' : 's'}</span>}
              </header>
              {sel && <TextoIA key={p.id + a + b} p={p} de={a} ate={b} onAbrir={(de, ate) => setPer({ de, ate: dayKey(new Date(local(ate).getTime() - 864e5 + 36e5)) })} semana={`${curto(ini)} a ${curto(new Date(fim.getTime() - 864e5))}`} ts={[...feitas, ...ajudou]} proj={id => (id ? s.projects[id]?.name : undefined)} />}
              {feitas.length + ajudou.length === 0 ? <p className="rel-vazio">Nada concluído {per ? 'nesses dias' : 'nesta semana'}.</p> : sel ? (
                <div className="rel-ts">
                  {[...feitas, ...ajudou].map(t => <Item key={t.id} t={t} proj={t.project_id ? s.projects[t.project_id]?.name : undefined} de={t.owner_id !== p.id ? s.profiles[t.owner_id]?.name.split(' ')[0] ?? 'alguém' : undefined} />)}
                </div>
              ) : (
                <ul>
                  {feitas.map(t => <li key={t.id}><Ph n="check-circle" size={16} fill /><span className="grow">{t.title}{t.project_id && s.projects[t.project_id] && <small> · {s.projects[t.project_id].name}</small>}</span><small>{dia(t.done_at!)}</small></li>)}
                  {ajudou.map(t => <li key={t.id} className="aj"><Ph n="hand-heart" size={16} /><span className="grow">{t.title}<small> · de {s.profiles[t.owner_id]?.name.split(' ')[0] ?? 'alguém'}</small></span><small>{dia(t.done_at!)}</small></li>)}
                </ul>
              )}
            </section>
          ))}
        </div>
      </div>
    </Fundo>
  )
}

/** tarefa no relatório individual: o que foi feito, com a descrição. Se faltar descrição, quem pode editar escreve ali mesmo */
function Item({ t, proj, de }: { t: Task; proj?: string; de?: string }) {
  const pode = canEditTask(t)
  const feitos = t.checklist.filter(c => c.done)
  return (
    <article className={'rel-t' + (de ? ' aj' : '')}>
      <header>
        <Ph n={de ? 'hand-heart' : 'check-circle'} size={18} fill={!de} />
        <b className="grow">{t.title}</b>
        <small>{dia(t.done_at!)}</small>
      </header>
      {(proj || de) && <small className="rel-t-meta">{[proj, de && `ajudou ${de}`].filter(Boolean).join(' · ')}</small>}
      {t.notes.trim() ? <p className="rel-t-desc">{t.notes.trim()}</p>
        : pode ? <textarea className="rel-t-esc no-print" rows={2} maxLength={4000} placeholder="Conte o que foi feito nessa tarefa (vai para a descrição dela)" aria-label={`Descrição de ${t.title}`}
            onBlur={e => e.target.value.trim() && run(updateTask(t.id, { notes: e.target.value.trim() }))} />
        : <p className="rel-t-desc vazio">Sem descrição.</p>}
      {feitos.length > 0 && <ul className="rel-t-ck">{feitos.map(c => <li key={c.id}><Ph n="check" size={13} />{c.text}</li>)}</ul>}
    </article>
  )
}

/** texto corrido do relatório escrito pela IA a partir das tarefas e descrições; dá pra mexer e copiar */
// último relatório de cada pessoa, guardado neste navegador: { de, ate (exclusivo), semana, texto, resumo, em }
interface Salvo { de: string; ate: string; semana: string; texto: string; resumo: string; em: string }
const chave = (id: string) => 'rel-ia:' + id
const lerSalvo = (id: string): Salvo | null => { try { return JSON.parse(localStorage.getItem(chave(id)) ?? 'null') } catch { return null } }

function TextoIA({ p, de, ate, onAbrir, semana, ts, proj }: { p: Profile; de: string; ate: string; onAbrir: (de: string, ate: string) => void; semana: string; ts: Task[]; proj: (id: string | null) => string | undefined }) {
  const [salvo] = useState(() => lerSalvo(p.id))
  const igual = salvo?.de === de && salvo?.ate === ate
  const [txt, setTxt] = useState(igual ? salvo.texto : '')
  const [resumo, setResumo] = useState(igual ? salvo.resumo : '')
  useEffect(() => {
    if (!txt.trim()) return
    try { localStorage.setItem(chave(p.id), JSON.stringify({ de, ate, semana, texto: txt, resumo, em: new Date().toISOString() } satisfies Salvo)) } catch { /* sem armazenamento: só não guarda */ }
  }, [txt, resumo, p.id, de, ate, semana])
  const [rodando, setRodando] = useState<number | null>(null)
  const [seg, setSeg] = useState(0)
  const [erro, setErro] = useState('')
  const [copiou, setCopiou] = useState(false)
  useEffect(() => {
    if (rodando === null) return
    const i = window.setInterval(() => setSeg(Math.round((Date.now() - rodando) / 1000)), 500)
    return () => window.clearInterval(i)
  }, [rodando])
  const gerar = async () => {
    setErro(''); setSeg(0); setRodando(Date.now())
    try {
      setTxt(await textoRelatorio({
        nome: p.name, cargo: p.role || undefined, semana, resumo: resumo.trim() || undefined,
        tarefas: ts.map(t => ({ titulo: t.title, projeto: proj(t.project_id), descricao: t.notes.trim() || undefined, itens: t.checklist.filter(c => c.done).map(c => c.text), ajudou: t.owner_id !== p.id ? 'outra pessoa' : undefined, dia: t.done_at ? dia(t.done_at) : undefined })),
      }))
    } catch (e) { setErro(e instanceof Error ? e.message : String(e)) }
    setRodando(null)
  }
  const copiar = async () => { await navigator.clipboard.writeText(txt).catch(() => {}); setCopiou(true); window.setTimeout(() => setCopiou(false), 1500) }
  return (
    <section className={'rel-ia' + (txt ? ' tem' : '')}>
      <header className="no-print">
        <i className="rel-ia-ic"><Ph n="sparkle" size={16} fill /></i>
        <span className="grow"><b>Texto do relatório</b><small>{rodando !== null ? `Escrevendo com a IA… ${seg}s (costuma levar de 5 a 15s)` : txt ? 'Fica salvo aqui. Revise antes de mandar: dá pra editar.' : 'Conte do seu jeito o que fez; a IA junta com as tarefas abaixo e escreve o relatório.'}</small></span>
        {txt && rodando === null && <button type="button" className="btn ghost sm" onClick={() => run(copiar())}><Ph n={copiou ? 'check' : 'copy'} size={16} />{copiou ? 'Copiado' : 'Copiar'}</button>}
        <button type="button" className="btn soft sm" onClick={() => run(gerar())} disabled={rodando !== null || (!ts.length && !resumo.trim())}>{rodando !== null ? <span className="rel-ia-gira" aria-hidden /> : <Ph n="sparkle" size={16} />}{txt ? 'Escrever de novo' : 'Escrever com IA'}</button>
        {txt && rodando === null && <button type="button" className="btn ghost sm" onClick={() => setTxt('')}>Voltar ao resumo</button>}
      </header>
      {salvo && !igual && rodando === null && <p className="rel-ia-salvo no-print"><Ph n="calendar-dots" size={14} />Último relatório salvo: {salvo.semana}, feito em {new Date(salvo.em).toLocaleDateString('pt-BR')}<button type="button" className="btn ghost sm" onClick={() => onAbrir(salvo.de, salvo.ate)}>Abrir</button></p>}
      {!txt && <textarea className="rel-ia-tx no-print" value={resumo} onChange={e => setResumo(e.target.value)} rows={3} maxLength={3000} disabled={rodando !== null}
        placeholder="Ex.: fechei a tabela do Day Use com o comercial, gravei dois reels da Semana das Crianças, ajudei a Carla no texto do site…" aria-label="Seu resumo da semana" />}
      {erro && <p className="rel-ia-erro no-print">{erro}</p>}
      {txt && <><textarea className="rel-ia-tx no-print" value={txt} onChange={e => setTxt(e.target.value)} rows={Math.min(14, txt.split('\n').length + 2)} aria-label="Texto do relatório" />
        <p className="rel-ia-imp">{txt}</p></>}
    </section>
  )
}
