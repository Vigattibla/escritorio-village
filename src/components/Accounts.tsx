import { useEffect, useState } from 'react'
import { makePassword, slugUser } from '../data/login'
import { RANKS, outranks, rankOf } from '../game/ranks'
import { accountLogins, createAccount, deleteAccount, deptList, deptName, hasCanais, run, saveDept, setDept, setDeptLook, setDoor, setPassword, updateAccount, useStore } from '../store'
import { FlagPicker } from './Bandeira'
import { SLOTS } from '../office/andar'
import { deptOf } from '../game/ranks'
import type { AccountEdit, Dept, Profile } from '../types'

/** adm: cria, edita e exclui contas. Gerência/Chefe: cria e edita a própria equipe (cargo abaixo do dela). Ninguém se cadastra sozinho. */
export default function Accounts({ open }: { open?: boolean }) {
  const profiles = useStore(s => s.profiles)
  const meId = useStore(s => s.meId)
  const [name, setName] = useState('')
  const [user, setUser] = useState('')
  const [pass, setPass] = useState(makePassword)
  const [rank, setRank] = useState(1)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [who, setWho] = useState('')
  const [newPass, setNewPass] = useState('')
  const [edit, setEdit] = useState<AccountEdit | null>(null)
  const [logins, setLogins] = useState<Record<string, string>>({})
  const [killing, setKilling] = useState(false)
  const [heir, setHeir] = useState('')
  const depts = deptList({ rows: useStore(s => s.rows) })
  const me = profiles[meId ?? '']
  const adm = !!me?.is_admin
  const all = Object.values(profiles).sort((a, b) => a.name.localeCompare(b.name))
  const people = adm ? all : all.filter(p => p.id !== me?.id && !p.is_admin && outranks(me, p))
  const ranks = RANKS.map((r, i) => ({ r, i })).filter(({ i }) => i > 0 && (adm || i < rankOf(me)))
  const move = (dept: string) => {
    const name = profiles[who]?.name ?? 'A pessoa'
    setBusy(true); setMsg('')
    run(setDept(who, dept).then(() => setMsg(`${name} agora está na sala ${deptName(dept)}. As tarefas abertas foram junto.`)).finally(() => setBusy(false)))
  }
  const waiting = people.filter(p => !p.avatar)
  const login = slugUser(user || name)

  const create = (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true); setMsg('')
    const n = name.trim()
    run(createAccount(login, pass, n, rank)
      .then(() => {
        setMsg(`Conta de ${n} criada. Passe para a pessoa: usuário "${login}" e a senha ${pass}`)
        setName(''); setUser(''); setPass(makePassword()); setRank(1); loadLogins()
      })
      .finally(() => setBusy(false)))
  }
  const loadLogins = () => { accountLogins().then(setLogins, () => {}) }
  useEffect(() => { if (open) loadLogins() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const pick = (id: string) => {
    const p = profiles[id]
    setWho(id); setNewPass(''); setKilling(false); setHeir(meId ?? ''); setMsg('')
    setEdit(p ? { name: p.name, role: p.role ?? '', rank: p.rank ?? 1, is_admin: !!p.is_admin, user: logins[id] ?? '' } : null)
  }
  const save = (e: React.FormEvent) => {
    e.preventDefault()
    if (!edit) return
    const name = edit.name.trim()
    const user = slugUser(edit.user)
    const renamed = !!user && user !== logins[who]
    setBusy(true); setMsg('')
    run(updateAccount(who, { ...edit, user: renamed ? user : '' })
      .then(() => newPass ? setPassword(who, newPass) : undefined)
      .then(() => {
        setMsg(`Conta de ${name} salva.` + (renamed ? ` Novo usuário: "${user}".` : '') + (newPass ? ` Nova senha: ${newPass}` : ''))
        setNewPass(''); loadLogins()
      })
      .finally(() => setBusy(false)))
  }
  const remove = () => {
    const name = profiles[who]?.name ?? 'a conta'
    setBusy(true)
    run(deleteAccount(who, heir).then(() => {
      setMsg(`${name} foi excluído(a). As tarefas e projetos passaram para ${profiles[heir]?.name ?? 'o herdeiro'}.`)
      setWho(''); setEdit(null); setKilling(false)
    }).finally(() => setBusy(false)))
  }

  return (
    <details className="accounts" open={open} onToggle={e => { if ((e.target as HTMLDetailsElement).open) loadLogins() }}>
      <summary>🔑 Contas da equipe {adm ? '(adm)' : `· sala ${deptName(deptOf(me))}`}</summary>
      <form onSubmit={create}>
        <h3>Nova conta</h3>
        <label>Nome<input required value={name} onChange={e => setName(e.target.value)} maxLength={40} placeholder="Maria Souza" /></label>
        <div className="row gap">
          <label className="grow">Usuário
            <input value={user} onChange={e => setUser(e.target.value)} placeholder={slugUser(name) || 'maria'} autoCapitalize="none" spellCheck={false} />
          </label>
          <label className="grow">Senha
            <span className="row gap"><input className="grow" required minLength={6} value={pass} onChange={e => setPass(e.target.value)} spellCheck={false} />
              <button type="button" className="btn ghost sm" onClick={() => setPass(makePassword())} title="Gerar outra">🎲</button></span>
          </label>
        </div>
        <label>Cargo
          <select value={rank} onChange={e => setRank(Number(e.target.value))}>
            {ranks.map(({ r, i }) => <option key={i} value={i}>{r}</option>)}
          </select>
        </label>
        <button className="btn primary" disabled={busy || login.length < 2}>{busy ? 'Criando…' : `Criar conta${login ? ` "${login}"` : ''}`}</button>
      </form>

      <form onSubmit={save}>
        <h3>Editar conta</h3>
        <select required value={who} onChange={e => pick(e.target.value)}>
          <option value="">Escolha a pessoa…</option>
          {people.map(p => <option key={p.id} value={p.id}>{p.name}{logins[p.id] ? ` (${logins[p.id]})` : ''}</option>)}
        </select>
        {edit && <>
          <div className="row gap">
            <label className="grow">Nome<input required maxLength={40} value={edit.name} onChange={e => setEdit({ ...edit, name: e.target.value })} /></label>
            <label className="grow">Função<input maxLength={40} value={edit.role} onChange={e => setEdit({ ...edit, role: e.target.value })} placeholder="Designer, Vendas…" /></label>
          </div>
          <div className="row gap">
            <label className="grow">Usuário
              <input value={edit.user} onChange={e => setEdit({ ...edit, user: e.target.value })} placeholder={logins[who] ?? ''} autoCapitalize="none" spellCheck={false} />
            </label>
            <label className="grow">Nova senha
              <span className="row gap"><input className="grow" minLength={6} value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="deixe vazio p/ manter" spellCheck={false} />
                <button type="button" className="btn ghost sm" onClick={() => setNewPass(makePassword())} title="Gerar">🎲</button></span>
            </label>
          </div>
          <div className="row gap">
            <label className="grow">Cargo
              <select value={edit.rank} onChange={e => setEdit({ ...edit, rank: Number(e.target.value) })}>
                {ranks.map(({ r, i }) => <option key={i} value={i}>{r}</option>)}
              </select>
            </label>
            {adm && <label className="grow">Sala
              <select value={deptOf(profiles[who])} disabled={busy} onChange={e => move(e.target.value)}>
                {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </label>}
            {adm && <label className="acc-check"><input type="checkbox" checked={edit.is_admin} disabled={who === meId}
              onChange={e => setEdit({ ...edit, is_admin: e.target.checked })} /> Adm (mexe nas contas)</label>}
          </div>
          <div className="row gap">
            <button className="btn primary" disabled={busy}>{busy ? 'Salvando…' : 'Salvar'}</button>
            {adm && who !== meId && !killing && <button type="button" className="btn danger-ghost" onClick={() => setKilling(true)}>Excluir conta…</button>}
          </div>
          {killing && <div className="acc-kill">
            <b>Excluir {profiles[who]?.name} de vez?</b>
            <small>As mensagens e notas dela somem. As tarefas e projetos passam para:</small>
            <select value={heir} onChange={e => setHeir(e.target.value)}>
              {people.filter(p => p.id !== who).map(p => <option key={p.id} value={p.id}>{p.name}{p.id === meId ? ' (eu)' : ''}</option>)}
            </select>
            <div className="row gap">
              <button type="button" className="btn danger" disabled={busy || !heir} onClick={remove}>{busy ? 'Excluindo…' : 'Excluir de vez'}</button>
              <button type="button" className="btn ghost" onClick={() => setKilling(false)}>Cancelar</button>
            </div>
          </div>}
        </>}
      </form>

      {adm ? <Salas depts={depts} people={people} /> : <small className="muted">A conta nova já entra na sua sala. Excluir conta, dar adm ou mudar alguém de sala: fale com o adm.</small>}

      {msg && <p className="ok">{msg}</p>}
      {waiting.length > 0 && <p className="muted small">Ainda não entraram: {waiting.map(p => p.name).join(', ')}</p>}
    </details>
  )
}

const COLORS = ['#FBC222', '#4F8EF7', '#3DBE8B', '#E8664F', '#A77BF3', '#F28BB8', '#2BB3C0', '#8A8F98']

/** salas do andar: criar, renomear, mudar a cor (o Marketing não sai) */
function Salas({ depts, people }: { depts: Dept[]; people: Profile[] }) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(COLORS[1])
  const [names, setNames] = useState<Record<string, string>>({})
  const [pick, setPick] = useState(-1)
  const add = (e: React.FormEvent) => {
    e.preventDefault()
    run(saveDept({ name, color, slot: pick }).then(() => { setName(''); setPick(-1) }))
  }
  return (
    <div className="acc-salas">
      <h3>Salas do andar</h3>
      {Array.from({ length: SLOTS }, (_, k) => {
        const d = depts.find(x => x.floor === 1 && x.slot === k)
        if (!d) return pick === k
          ? <form key={k} onSubmit={add} className="row gap acc-sala">
              <input type="color" value={color} onChange={e => setColor(e.target.value)} title="Cor da sala" />
              <input className="grow" required autoFocus maxLength={40} value={name} onChange={e => setName(e.target.value)} placeholder="Nome da sala (ex.: Comercial)" />
              <button className="btn primary sm" disabled={!name.trim()}>Criar sala</button>
              <button type="button" className="btn ghost sm" onClick={() => setPick(-1)}>Cancelar</button>
            </form>
          : <div key={k} className="row gap acc-sala vazia">
              <span className="acc-sala-dot" />
              <span className="grow muted">Porta {k + 1} · sala vazia (cinza no corredor, ninguém entra)</span>
              <button type="button" className="btn ghost sm" onClick={() => setPick(k)}>Montar sala aqui</button>
            </div>
        const n = names[d.id] ?? d.name
        const count = people.filter(p => deptOf(p) === d.id).length
        return (
          <div key={d.id} className="row gap acc-sala">
            <input type="color" value={d.color} title="Cor da sala" onChange={e => run(saveDept({ id: d.id, name: d.name, color: e.target.value }))} />
            <input className="grow" maxLength={40} value={n} onChange={e => setNames({ ...names, [d.id]: e.target.value })} />
            <small className="muted">{count} {count === 1 ? 'pessoa' : 'pessoas'}</small>
            {n.trim() && n !== d.name && <button type="button" className="btn ghost sm" onClick={() => run(saveDept({ id: d.id, name: n, color: d.color }))}>Renomear</button>}
            <button type="button" className="btn ghost sm" title="Fechada: só quem é da sala (e a Chefe) entra; os outros batem na porta" onClick={() => run(setDoor(d.id, d.door_open === false))}>{d.door_open === false ? '🔒 Porta fechada' : '🚪 Porta aberta'}</button>
            <label className="acc-canais" title="Sala que publica: aparecem posts, canais (Feed, Reels…) e a meta de posts"><input type="checkbox" checked={hasCanais(d.id)} onChange={e => run(setDeptLook(d.id, { canais: e.target.checked }))} />Publica posts</label>
            <label className="acc-canais" title="Sala que vende: quadro de quartos, metas de venda e placar"><input type="checkbox" checked={!!d.vendas} onChange={e => run(setDeptLook(d.id, { vendas: e.target.checked }))} />Vende</label>
            <div className="acc-flag"><small className="muted">Bandeira</small><FlagPicker d={d} /></div>
          </div>
        )
      })}
      <small className="muted">Cada sala tem quadro, agenda, metas e chat próprios. Mude a pessoa de sala em "Editar conta".</small>
    </div>
  )
}
