import { useEffect, useMemo, useState } from 'react'
import { addTask, dmChannel, run, setUi, team, useStore } from '../store'
import { dayKey } from '../game/xp'
import Icon, { Ph } from './Icon'
import MiniAvatar from './MiniAvatar'
import Game from './Game'
import { CHANNELS, currentGoal, daysLeft, first, goalProgress, hm, localDay } from './v4'

/** Faixa “Escritório agora”: o escritório em filme — você primeiro, depois cada um que está na sala. */
export function Live({ small = false }: { small?: boolean }) {
  const meId = useStore(s => s.meId)!
  const profiles = useStore(s => s.profiles)
  const online = useStore(s => s.online)
  const tasks = useStore(s => s.tasks)
  const people = team(profiles).filter(p => p.avatar)
  const here = [meId, ...people.filter(p => p.id !== meId && online.has(p.id)).map(p => p.id)]
  const key = here.join(',')
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)
  const [dip, setDip] = useState(false)
  const focus = here[i % here.length]
  useEffect(() => {
    if (paused || here.length < 2) return
    const t = setInterval(() => {
      setDip(true)
      setTimeout(() => { setI(n => n + 1); setDip(false) }, 380)
    }, 7000)
    return () => clearInterval(t)
  }, [paused, key, here.length])
  const cut = (n: number) => { setDip(true); setTimeout(() => { setI(n); setDip(false) }, 300) }
  const p = profiles[focus]
  const doing = Object.values(tasks).find(t => t.owner_id === focus && t.status === 'doing')

  return (
    <section className={'live' + (small ? ' sm' : '')}>
      {!small && (
        <div className="live-h">
          <span className="pulse" /><h3>Escritório agora</h3><small>{here.length} de {people.length} na sala</small>
          <div className="who-tabs">
            {[meId, ...people.map(p => p.id).filter(id => id !== meId)].map(id => {
              const n = here.indexOf(id)
              return (
                <button key={id} className={id === focus ? 'on' : n < 0 ? 'off' : ''} onClick={() => n >= 0 && cut(n)} disabled={n < 0} title={n < 0 ? 'Fora da sala' : undefined}>
                  <MiniAvatar avatar={profiles[id]?.avatar ?? null} photo={profiles[id]?.photo ?? null} name={profiles[id]?.name} size={24} dim={n < 0} />
                  {id === meId ? 'Você' : first(profiles[id])}
                </button>
              )
            })}
          </div>
        </div>
      )}
      <div className={'cine-box' + (small ? ' sm' : '')}>
        <Game cine focus={focus} />
        <div className="vig" />
        <div className={'dip' + (dip ? ' on' : '')} />
        <span className={'live-pill' + (paused ? ' paused' : '')}>{paused ? <><Ph n="pause" size={11} fill />CÂMERA PARADA</> : <><span className="pulse" />AO VIVO</>}</span>
        {p && (
          <div className={'cap' + (dip ? ' out' : '')} key={focus}>
            <MiniAvatar avatar={p.avatar} photo={p.photo} name={p.name} size={30} />
            <div><b>{focus === meId ? 'Você' : p.name}</b><small>{doing ? `Fazendo: ${doing.title}` : p.role || 'Na sala'}</small></div>
          </div>
        )}
        {!small && (
          <div className="cine-ctl">
            <button className={paused ? 'on' : ''} onClick={() => setPaused(x => !x)} aria-label={paused ? 'Voltar a passar entre as pessoas' : 'Parar a câmera nesta pessoa'} title={paused ? 'Voltar a passar entre as pessoas' : 'Parar a câmera nesta pessoa'}>
              {paused ? <Icon n="play" size={14} /> : <Ph n="pause" size={16} fill />}
            </button>
            <button onClick={() => setUi({ view: 'escritorio', drawer: false, viewing: focus })}><Ph n="corners-out" size={16} />Abrir escritório</button>
          </div>
        )}
      </div>
    </section>
  )
}

/** Painel “Seu dia”: o que vence hoje, posts agendados e o próximo lembrete. */
export function SeuDia() {
  const meId = useStore(s => s.meId)!
  const tasks = useStore(s => s.tasks)
  const [adding, setAdding] = useState(false)
  const [txt, setTxt] = useState('')
  const [at, setAt] = useState('')
  const today = dayKey(new Date())
  const mine = Object.values(tasks).filter(t => t.owner_id === meId && t.status !== 'done' && t.status !== 'declined')
  const due = mine.filter(t => t.due === today)
  const hi = due.filter(t => t.priority === 'alta').length
  const posts = Object.values(tasks).filter(t => t.publish_at && localDay(t.publish_at) === today && t.status !== 'declined' && (t.owner_id === meId || t.created_by === meId))
    .sort((a, b) => a.publish_at!.localeCompare(b.publish_at!))
  const nextPost = posts.find(t => t.publish_at! > new Date().toISOString()) ?? posts[0]
  const rem = mine.filter(t => t.remind_at && t.remind_at > new Date().toISOString()).sort((a, b) => a.remind_at!.localeCompare(b.remind_at!))[0]
  const title = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
  const save = (e: React.FormEvent) => {
    e.preventDefault()
    if (!txt.trim() || !at) return
    run(addTask(meId, txt.trim(), null, '', 'todo', null, { remind_at: new Date(at).toISOString() }))
    setTxt(''); setAt(''); setAdding(false)
  }

  return (
    <div className="panel day">
      <div className="day-h">
        <div><div className="eyebrow">Seu dia</div><h2>{title[0].toUpperCase() + title.slice(1).replace('-feira', '')}</h2></div>
      </div>
      <button className="li" onClick={() => setUi({ view: 'quadro', drawer: false })}>
        <span className="tile ink"><Icon n="check" /></span>
        <div><b>{due.length ? `${due.length} ${due.length > 1 ? 'tarefas vencem' : 'tarefa vence'} hoje` : 'Nada vence hoje'}</b>
          <small>{hi ? `${hi} com prioridade alta` : `${mine.length} abertas com você`}</small></div>
      </button>
      <button className="li" onClick={() => setUi({ view: 'agenda' })}>
        <span className="tile pink"><Ph n={nextPost?.channel ? CHANNELS[nextPost.channel].ic : 'instagram-logo'} size={18} /></span>
        <div><b>{posts.length ? `${posts.length} ${posts.length > 1 ? 'posts agendados' : 'post agendado'}` : 'Sem post hoje'}</b>
          <small>{nextPost ? `Próximo: ${nextPost.title}, ${hm(nextPost.publish_at!)}` : 'Veja a agenda da semana'}</small></div>
      </button>
      {rem && (
        <button className="li" onClick={() => setUi({ task: rem.id })}>
          <span className="tile amber"><Ph n="bell" size={18} /></span>
          <div><b>Lembrete {localDay(rem.remind_at!) === today ? `às ${hm(rem.remind_at!)}` : new Date(rem.remind_at!).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}</b><small>{rem.title}</small></div>
        </button>
      )}
      {adding && (
        <form className="remind-form" onSubmit={save}>
          <input autoFocus placeholder="Lembrar de…" value={txt} maxLength={120} onChange={e => setTxt(e.target.value)} />
          <input type="datetime-local" value={at} onChange={e => setAt(e.target.value)} aria-label="Quando" />
          <div className="row"><button className="btn primary sm" disabled={!txt.trim() || !at}>Salvar</button><button type="button" className="btn ghost sm" onClick={() => setAdding(false)}>Cancelar</button></div>
        </form>
      )}
      {!adding && <button className="btn soft wide" onClick={() => setAdding(true)}><Ph n="bell" size={16} />Criar lembrete</button>}
    </div>
  )
}

/** Anel + degraus + quem ajudou + recompensa. */
export function MetaCard({ onOpen, compact = false }: { onOpen?: () => void; compact?: boolean }) {
  const goals = useStore(s => s.rows.goals)
  const tasks = useStore(s => s.tasks)
  const profiles = useStore(s => s.profiles)
  const projects = useStore(s => s.projects)
  const g = currentGoal(Object.values(goals))
  const list = useMemo(() => Object.values(tasks), [tasks])
  if (!g) return (
    <button className="panel gcard empty" onClick={() => setUi({ view: 'metas' })}>
      <div className="eyebrow">Meta da equipe</div><b>Nenhuma meta neste mês</b><small>Abrir Metas</small>
    </button>
  )
  const pr = goalProgress(g, list, projects)
  const month = new Date(g.month + '-02').toLocaleDateString('pt-BR', { month: 'long' })
  const tops = Object.entries(pr.by).sort((a, b) => b[1] - a[1]).slice(0, 3)
  return (
    <div className={'panel gcard' + (compact ? ' compact' : '')} role="button" tabIndex={0} onClick={onOpen ?? (() => setUi({ view: 'metas' }))} onKeyDown={e => { if (e.key === 'Enter') setUi({ view: 'metas' }) }}>
      <div className="eyebrow">Meta da equipe · {month}</div>
      <div className="g-row">
        <Ring pct={pr.pct} size={compact ? 64 : 92} />
        <div><h3>{g.title}</h3><div className="big"><b>{pr.value}</b> de {g.target}</div>
          <div className="left">{pr.hit ? 'Meta batida!' : `faltam ${g.target - pr.value} · ${daysLeft(g.month)} dias`}</div></div>
      </div>
      {compact ? <div className="gbar"><i style={{ width: pr.pct + '%' }} /></div> : <Steps pct={pr.pct} target={g.target} />}
      {tops.length > 0 && (
        <div className="contrib">
          <div className="faces">{tops.map(([id]) => <MiniAvatar key={id} avatar={profiles[id]?.avatar ?? null} photo={profiles[id]?.photo ?? null} name={profiles[id]?.name} size={24} />)}</div>
          <span>{tops.map(([id, n]) => `${first(profiles[id])} ${n}`).join(' · ')}</span>
        </div>
      )}
      {g.reward && compact && <div className="reward-l"><Ph n="gift" size={15} fill /><span>{g.reward}</span></div>}
      {g.reward && !compact && <div className="reward"><span className="tile"><Ph n="gift" size={18} fill /></span><div><small>Recompensa ao bater</small><b>{g.reward}</b></div></div>}
    </div>
  )
}

export function Ring({ pct, size = 92 }: { pct: number; size?: number }) {
  const [v, setV] = useState(0)
  useEffect(() => { const t = requestAnimationFrame(() => setV(pct)); return () => cancelAnimationFrame(t) }, [pct])
  const C = 2 * Math.PI * 38
  return (
    <div className="gring" style={{ width: size, height: size }}>
      <svg viewBox="0 0 92 92"><circle className="bgc" cx="46" cy="46" r="38" /><circle className="fg" cx="46" cy="46" r="38" style={{ strokeDasharray: C, strokeDashoffset: C * (1 - v / 100) }} /></svg>
      <b>{pct}<span>%</span></b>
    </div>
  )
}

export function Steps({ pct, target }: { pct: number; target: number }) {
  return (
    <div className="steps">
      <div className="rail2" /><div className="fill" style={{ width: pct + '%' }} />
      {[25, 50, 75].map(q => (
        <span key={q} className={pct >= q ? 'ok' : ''} style={{ left: q + '%' }}>
          {pct >= q ? <Ph n="check" size={12} fill /> : Math.ceil((target * q) / 100)}
        </span>
      ))}
      <span className={'end' + (pct >= 100 ? ' ok' : '')} style={{ left: '100%' }}><Ph n="gift" size={14} fill /></span>
    </div>
  )
}

/** Chat da equipe em miniatura (canal Geral); o completo abre no balão. */
/** Agora na equipe: quem está aqui, no que cada um está mexendo e quanto já saiu hoje. Toque abre conversa. */
export function TeamNow() {
  const meId = useStore(s => s.meId)!
  const profiles = useStore(s => s.profiles)
  const tasks = useStore(s => s.tasks)
  const online = useStore(s => s.online)
  const today = localDay(new Date().toISOString())
  const people = team(profiles).filter(p => p.avatar && p.id !== meId).map(p => {
    const mine = Object.values(tasks).filter(t => t.owner_id === p.id)
    const doing = mine.filter(t => t.status === 'doing').sort((a, b) => b.position - a.position)[0]
    const done = mine.filter(t => t.done_at && localDay(t.done_at) === today).length
    return { p, doing, done, on: online.has(p.id) }
  }).sort((a, b) => +b.on - +a.on || +!!b.doing - +!!a.doing || a.p.name.localeCompare(b.p.name))
  const here = people.filter(x => x.on).length
  const doneAll = people.reduce((n, x) => n + x.done, 0)
  return (
    <div className="panel pteam">
      <div className="ch-hd"><div className="eyebrow">Agora na equipe</div>
        <span className="muted tsum">{here} aqui · {doneAll} {doneAll === 1 ? 'feita' : 'feitas'} hoje</span>
      </div>
      {people.length === 0 && <small className="muted">Ninguém mais entrou ainda.</small>}
      <ul className="tlist">
        {people.map(({ p, doing, done, on }) => (
          <li key={p.id}>
            <button className={'tperson' + (on ? ' on' : '')} onClick={() => setUi({ chatOpen: true, channel: dmChannel(meId, p.id) })} aria-label={`Conversar com ${first(p)}`}>
              <span className="tav"><MiniAvatar avatar={p.avatar} photo={p.photo} name={p.name} size={32} dim={!on} /><i /></span>
              <span className="tinfo"><b>{first(p)}</b>
                <small className={doing ? '' : 'muted'}>{doing ? <><Ph n="pencil-simple-line" size={12} /><span>{doing.title}</span></> : on ? 'Livre agora' : 'Fora'}</small>
              </span>
              {done > 0 && <span className="tdone" title={`${done} feitas hoje`}><Ph n="check" size={12} />{done}</span>}
              <span className="tchat"><Ph n="chat-circle-dots" size={15} /></span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function Side() {
  return (
    <aside className="qside">
      <SeuDia />
      <MetaCard />
      <TeamNow />
    </aside>
  )
}
