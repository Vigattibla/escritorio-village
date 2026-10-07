import { useState } from 'react'
import { makePassword, slugUser } from '../data/login'
import { RANKS } from '../game/ranks'
import { createAccount, run, setPassword, useStore } from '../store'

/** Só o Chefe: cria contas (usuário + senha) e troca senhas. Ninguém se cadastra sozinho. */
export default function Accounts() {
  const profiles = useStore(s => s.profiles)
  const [name, setName] = useState('')
  const [user, setUser] = useState('')
  const [pass, setPass] = useState(makePassword)
  const [rank, setRank] = useState(1)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [who, setWho] = useState('')
  const [newPass, setNewPass] = useState('')
  const people = Object.values(profiles).sort((a, b) => a.name.localeCompare(b.name))
  const waiting = people.filter(p => !p.avatar)
  const login = slugUser(user || name)

  const create = (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true); setMsg('')
    const n = name.trim()
    run(createAccount(login, pass, n, rank)
      .then(() => {
        setMsg(`Conta de ${n} criada. Passe para a pessoa: usuário "${login}" e a senha ${pass}`)
        setName(''); setUser(''); setPass(makePassword()); setRank(1)
      })
      .finally(() => setBusy(false)))
  }
  const reset = (e: React.FormEvent) => {
    e.preventDefault()
    const p = profiles[who]
    run(setPassword(who, newPass).then(() => {
      setMsg(`Senha de ${p?.name ?? 'alguém'} trocada para ${newPass}`)
      setWho(''); setNewPass('')
    }))
  }

  return (
    <details className="accounts">
      <summary>👑 Contas da equipe</summary>
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
            {RANKS.map((r, i) => i > 0 && <option key={i} value={i}>{r}</option>)}
          </select>
        </label>
        <button className="btn primary" disabled={busy || login.length < 2}>{busy ? 'Criando…' : `Criar conta${login ? ` "${login}"` : ''}`}</button>
      </form>

      <form onSubmit={reset}>
        <h3>Trocar senha</h3>
        <div className="row gap">
          <select className="grow" required value={who} onChange={e => setWho(e.target.value)}>
            <option value="">Pessoa…</option>
            {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <input className="grow" required minLength={6} value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="nova senha" spellCheck={false} />
          <button className="btn ghost sm" disabled={!who}>Trocar</button>
        </div>
      </form>

      {msg && <p className="ok">{msg}</p>}
      {waiting.length > 0 && <p className="muted small">Ainda não entraram: {waiting.map(p => p.name).join(', ')}</p>}
    </details>
  )
}
