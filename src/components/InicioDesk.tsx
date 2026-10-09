import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { dayKey } from '../game/xp'
import { deptOf } from '../game/ranks'
import { acceptRequest, canEnter, canMove, deptList, deptName, hasCanais, knock, openSala, run, setStatus, setUi, team, toApprove, useStore } from '../store'
import type { Task } from '../types'
import { TENANT } from '../tenant'
import { Bell } from './Avisos'
import Game from './Game'
import { MeoEspia } from './Meo'
import MiniAvatar from './MiniAvatar'
import TIcon from './TIcon'
import { first } from './v4'

const hello = () => { const h = new Date().getHours(); return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite' }
const ORDER = { doing: 0, review: 1, inbox: 2, todo: 3, done: 4, declined: 5 }
const mins = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + (m || 0) }

/** a sala ao vivo: câmera passa por quem está; as abas trocam de sala, a porta bate nas que estão fechadas */
function Sala() {
  const s = useStore(x => x)
  const meId = s.meId!
  const people = team(s.profiles, s).filter(p => p.avatar)
  const here = [meId, ...people.filter(p => p.id !== meId && s.online.has(p.id)).map(p => p.id)]
  const [i, setI] = useState(0)
  const [dip, setDip] = useState(false)
  const [porta, setPorta] = useState(false)
  const [toc, setToc] = useState('')
  useEffect(() => {
    if (here.length < 2) return
    const t = setInterval(() => { setDip(true); setTimeout(() => { setI(n => n + 1); setDip(false) }, 380) }, 7000)
    return () => clearInterval(t)
  }, [here.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!toc) return; const t = setTimeout(() => setToc(''), 4000); return () => clearTimeout(t) }, [toc])
  const focus = here[i % here.length]
  const depts = deptList(s)
  const others = depts.filter(d => d.id !== s.sala)
  const p = s.profiles[focus]
  const doing = Object.values(s.tasks).find(t => t.owner_id === focus && t.status === 'doing')
  const names = here.filter(id => id !== meId).map(id => first(s.profiles[id]))
  const bater = async (id: string) => {
    setPorta(false)
    try { await knock(id); setToc(`Toc, toc! Avisamos quem cuida da sala ${deptName(id, s)}.`) }
    catch (e) { setToc(e instanceof Error ? e.message : 'Não deu pra bater agora.') }
  }
  return (
    <section className="tsala">
      <div className="tsala-cine"><Game cine focus={focus} /><div className={'dip' + (dip ? ' on' : '')} /></div>
      <div className="tsala-top">
        <span className="tvivo"><i />ao vivo</span>
        <span className="tsala-tabs">
          {depts.map(d => {
            const n = team(s.profiles, { sala: d.id }).length
            const on = d.id === s.sala
            const pode = canEnter(d.id, s)
            return <button key={d.id} className={on ? 'on' : ''} title={on ? undefined : pode ? `Ver a sala ${d.name}` : 'Porta fechada: clique para bater'}
              onClick={() => { if (!on) void (pode ? run(openSala(d.id)) : bater(d.id)) }}>{d.name}<i>{n}</i></button>
          })}
        </span>
      </div>
      <div className="tsala-bot">
        {p && <span className="tpill">
          <MiniAvatar avatar={p.avatar} photo={p.photo} name={p.name} size={26} />
          <span><b>{focus === meId ? 'Você' : first(p)}</b>{doing ? <> · {doing.title}</> : focus === meId && names.length ? <> · com {names.slice(0, 2).join(' e ')}{names.length > 2 ? ` e mais ${names.length - 2}` : ''}</> : ' · na sala'}</span>
        </span>}
        <span className="tsala-acts">
          {others.length > 0 && <span className="tporta">
            <button className="tbtn creme lg" onClick={() => setPorta(!porta)} aria-expanded={porta}><TIcon n="escritorio" size={20} />Bater na porta</button>
            {porta && <>
              <div className="more-veil" onClick={() => setPorta(false)} />
              <div className="tpedir-pop tporta-pop">
                <small>Bater na porta de qual sala?</small>
                {others.map(d => <button key={d.id} onClick={() => bater(d.id)}>
                  <i className="sala-dot" style={{ background: d.color }} /><b className="grow">{d.name}</b><small>{team(s.profiles, { sala: d.id }).length} na sala</small>
                </button>)}
              </div>
            </>}
          </span>}
          <button className="tbtn acc lg" onClick={() => setUi({ view: 'escritorio', drawer: false })}>Entrar na sala</button>
        </span>
      </div>
      {toc && <span className="ttoc" role="status">{toc}</span>}
      <span className="tsala-espia"><MeoEspia size={42} color={TENANT.acc} /></span>
    </section>
  )
}

function Pedir() {
  const s = useStore(x => x)
  const [open, setOpen] = useState(false)
  const people = Object.values(s.profiles).filter(p => p.id !== s.meId)
    .sort((a, b) => Number(deptOf(b) === s.sala) - Number(deptOf(a) === s.sala) || a.name.localeCompare(b.name))
  return (
    <span className="tpedir">
      <button className="tbtn branco lg" onClick={() => setOpen(!open)} aria-expanded={open}><TIcon n="pedir" size={20} />Pedir algo</button>
      {open && <>
        <div className="more-veil" onClick={() => setOpen(false)} />
        <div className="tpedir-pop">
          <small>Pedir para quem?</small>
          {people.map(p => (
            <button key={p.id} onClick={() => { setOpen(false); setUi({ requestTo: p.id }) }}>
              <MiniAvatar avatar={p.avatar} photo={p.photo} name={p.name} size={28} />
              <b className="grow">{p.name}</b><span className="tsetor">{deptName(deptOf(p), s)}</span>
            </button>
          ))}
          {!people.length && <p className="tvazio">Ninguém mais na equipe ainda.</p>}
        </div>
      </>}
    </span>
  )
}

function Busca() {
  const [q, setQ] = useState('')
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); ref.current?.focus() } }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [])
  return (
    <form className="tbusca" onSubmit={e => { e.preventDefault(); try { sessionStorage.setItem('ev:q:find', q) } catch { /* sem storage */ } setUi({ view: 'quadro', drawer: false }) }}>
      <TIcon n="busca" size={20} />
      <input ref={ref} value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar tarefa no quadro" aria-label="Buscar tarefa" />
      <kbd>Ctrl K</kbd>
    </form>
  )
}

function Check({ t }: { t: Task }) {
  const done = t.status === 'done'
  return <button className={'tcheck' + (done ? ' on' : '')} disabled={!canMove(t)} onClick={e => { e.stopPropagation(); run(setStatus(t.id, done ? 'todo' : 'done')) }}
    aria-label={done ? 'Reabrir' : 'Concluir'}>{done && <TIcon n="ok" size={24} />}</button>
}

/** Desktop: a sala ao vivo no alto; embaixo o meu dia, a agenda, os pedidos e o quadro numa linha. */
export default function InicioDesk() {
  const s = useStore(x => x)
  const me = s.profiles[s.meId!]
  if (!me) return null
  const today = dayKey(new Date())
  const now = new Date().getHours() * 60 + new Date().getMinutes()
  const all = Object.values(s.tasks)
  const open = all.filter(t => t.status !== 'done' && t.status !== 'declined')
  const mine = open.filter(t => t.owner_id === me.id && t.status !== 'inbox')
    .sort((a, b) => ORDER[a.status] - ORDER[b.status] || (a.due ?? '9').localeCompare(b.due ?? '9'))
  const doneToday = all.filter(t => t.owner_id === me.id && t.status === 'done' && t.done_at && dayKey(t.done_at) === today)
  const late = mine.filter(t => t.due && t.due < today).length
  const rows = [...doneToday.slice(0, 1), ...mine].slice(0, 4)
  const pedidos = open.filter(t => t.owner_id === me.id && t.status === 'inbox').sort((a, b) => b.created_at.localeCompare(a.created_at))
  const approve = toApprove(s).length
  const canais = hasCanais(s.sala, s)
  const ev = [
    ...Object.values(s.rows.events).filter(e => e.day === today).map(e => ({ id: e.id, time: e.time, title: e.title, task: null as string | null })),
    ...(canais ? open.filter(t => t.publish_at && dayKey(t.publish_at) === today)
      .map(t => ({ id: t.id, time: new Date(t.publish_at!).toTimeString().slice(0, 5) as string | null, title: 'Post: ' + t.title, task: t.id as string | null })) : []),
  ].sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''))
  const next = ev.find(e => e.time && mins(e.time) >= now - 30)
  const week = Date.now() - 7 * 864e5
  const cols = [
    { k: 'A fazer', d: 'esperando alguém pegar', n: open.filter(t => t.status === 'todo').length, c: '#CFC6B4' },
    { k: 'Fazendo', d: 'em andamento', n: open.filter(t => t.status === 'doing').length, c: 'var(--acc)' },
    { k: 'Aprovação', d: 'esperando o ok', n: open.filter(t => t.status === 'review').length, c: '#FFC600' },
    { k: 'Feito', d: 'nos últimos 7 dias', n: all.filter(t => t.status === 'done' && t.done_at && Date.parse(t.done_at) >= week).length, c: '#1F9D55' },
  ]
  const date = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
  const sala = deptName(s.sala, s)
  const when = (t: Task) => {
    if (!t.due) return null
    if (t.due < today) return <span className="tchip tang"><TIcon n="alerta" size={16} />atrasada</span>
    if (t.due === today) return <span className="tchip tang"><TIcon n="prazo" size={16} />hoje</span>
    return <small className="twhen">{new Date(t.due + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}</small>
  }

  return (
    <div className="tinicio">
      <div className="ttop">
        <Busca />
        <span className="grow" />
        <Bell />
        <Pedir />
        <button className="tbtn acc2 lg" onClick={() => setUi({ sheet: true })}><TIcon n="mais" size={20} />Nova tarefa</button>
      </div>
      <div className="thead">
        <div><small>{date[0].toUpperCase() + date.slice(1)}</small><h1>{hello()}, {first(me)}</h1></div>
        <span className="tresumo">
          <span><b>{mine.length}</b>na sua lista</span>
          <span><b>{pedidos.length}</b>pedido{pedidos.length === 1 ? '' : 's'} novo{pedidos.length === 1 ? '' : 's'}</span>
          <span><b>{ev.length}</b>na agenda hoje</span>
          {late > 0 && <button className="tchip tang lg" onClick={() => setUi({ view: 'quadro', drawer: false })}><TIcon n="alerta" size={18} />{late} atrasada{late > 1 ? 's' : ''}</button>}
        </span>
      </div>
      <div className="tlinha1">
        <Sala />
        <section className="tbox tdia">
          <header><TIcon n="lista" size={24} /><h2>Meu dia</h2><small>{doneToday.length} de {doneToday.length + mine.length}</small>
            <button className="tlink" onClick={() => setUi({ sheet: true })}><TIcon n="mais" size={20} />Adicionar</button></header>
          {!rows.length && <p className="tvazio">Nada pendente. Bom momento pra pegar um pedido.</p>}
          {rows.map(t => {
            const by = s.profiles[t.created_by]
            const p = t.project_id ? s.projects[t.project_id] : null
            const sub = [p?.name ?? deptName(deptOf(t), s), by && by.id !== me.id ? `pedido de ${first(by)}` : ''].filter(Boolean).join(' · ')
            return (
              <div key={t.id} className={'trow' + (t.status === 'done' ? ' done' : '')} onClick={() => setUi({ task: t.id })} role="button" tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && setUi({ task: t.id })}>
                <Check t={t} />
                <div className="grow"><b>{t.title}</b><small>{t.status === 'review' ? 'esperando aprovação' : t.status === 'doing' ? 'fazendo · ' + sub : sub}</small></div>
                {t.status !== 'done' && when(t)}
              </div>
            )
          })}
          <footer><button className="tlink" onClick={() => setUi({ view: 'quadro', drawer: false })}>Ver tudo no quadro</button></footer>
        </section>
      </div>
      <div className="tlinha2">
        <section className="tbox tagenda">
          <header><TIcon n="agenda" size={22} /><h2>Agenda de hoje</h2></header>
          {!ev.length && <p className="tvazio">Nada marcado hoje.</p>}
          {ev.slice(0, 4).map(e => {
            const d = e.time ? mins(e.time) - now : null
            const extra = e !== next || d === null ? '' : d > 0 && d <= 90 ? ` · daqui a ${d} min` : d <= 0 ? ' · agora' : ''
            return (
              <button key={e.id} className={'tev' + (e === next ? ' on' : '')} onClick={() => e.task ? setUi({ task: e.task }) : setUi({ view: 'agenda', drawer: false })}>
                <i /><span><small>{(e.time ?? 'dia todo') + extra}</small><b>{e.title}</b></span>
              </button>
            )
          })}
          <footer><button className="tlink" onClick={() => setUi({ view: 'agenda', drawer: false })}>Abrir agenda</button></footer>
        </section>
        <section className="tbox tpedidos">
          <header><TIcon n="pedir" size={22} /><h2>Pedidos pra você</h2>{pedidos.length > 0 && <span className="tchip tang">{pedidos.length}</span>}</header>
          {!pedidos.length && !approve && <p className="tvazio">Nenhum pedido esperando.</p>}
          {pedidos.slice(0, 3).map((t, k) => {
            const by = s.profiles[t.created_by]
            return (
              <div key={t.id} className="tped">
                <MiniAvatar avatar={by?.avatar ?? null} photo={by?.photo ?? null} name={by?.name} size={34} />
                <div className="grow">
                  <span className="tped-h"><b>{first(by)}</b>{by && <span className="tsetor">{deptName(deptOf(by), s)}</span>}</span>
                  <span className="tped-t">{t.title}</span>
                  {k === 0 && <span className="tped-a">
                    <button className="tbtn acc sm" onClick={() => run(acceptRequest(t.id))}>Aceitar</button>
                    <button className="tbtn sm" onClick={() => setUi({ task: t.id })}>Ver</button>
                  </span>}
                </div>
                {k > 0 && <button className="tbtn sm" onClick={() => setUi({ task: t.id })}>Ver</button>}
              </div>
            )
          })}
          {approve > 0 && <button className="tapr" onClick={() => setUi({ view: 'quadro', drawer: false, qApprove: true })}>
            <TIcon n="ok" size={20} /><span className="grow">{approve} esperando sua aprovação</span><b>Ver</b></button>}
          <footer><button className="tlink" onClick={() => setUi({ view: 'quadro', drawer: false })}>Ver pedidos no quadro</button></footer>
        </section>
        <section className="tbox tquadro">
          <header><TIcon n="quadro" size={22} /><h2>Quadro {/(a|ção|gem|dade)$/i.test(sala) ? 'da' : 'do'} {sala}</h2>
            <button className="tlink" onClick={() => setUi({ view: 'quadro', drawer: false })}>Abrir</button></header>
          <div className="tq">
            {cols.map(c => (
              <button key={c.k} className="tq-n" style={{ '--c': c.c } as CSSProperties}
                onClick={() => setUi(c.k === 'Aprovação' && approve ? { view: 'quadro', drawer: false, qApprove: true } : { view: 'quadro', drawer: false })}>
                <b>{c.n}</b><span>{c.k}</span><small>{c.d}</small>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
