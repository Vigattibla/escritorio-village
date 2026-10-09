import { useEffect, useState } from 'react'
import Meo, { Wordmark } from '../components/Meo'
import { TENANT } from '../tenant'
import { backend } from '../data'
import { enter, useStore } from '../store'

export default function Auth() {
  const startErr = useStore(s => s.error)
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [name, setName] = useState('')
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(startErr)
  const [info, setInfo] = useState('')
  const [setup, setSetup] = useState(false)
  useEffect(() => { backend.needsSetup().then(v => { setSetup(v); if (v) setMode('up') }) }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true); setErr(''); setInfo('')
    try {
      const uid = mode === 'up' ? await backend.signUp(user, pass, name) : await backend.signIn(user, pass)
      if (!uid) { setInfo('Conta criada! Confirme pelo link que chegou no seu e-mail e depois entre.'); setMode('in'); return }
      await enter(uid)
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth">
      <div className="auth-card">
        <div className="brand">
          <span className="tlogo lg">{TENANT.logo}</span>
          <div>
            <h1>{TENANT.name}</h1>
            <p className="muted">O escritório virtual da equipe: tarefas, pedidos e conversa num lugar só.</p>
          </div>
        </div>
        {setup && <p className="ok"><b>Primeiro acesso.</b> Crie a conta do adm: escolha seu usuário e senha. Depois você cria as contas da equipe.</p>}
        {backend.mode === 'demo' && !setup && (
          <div className="seg">
            <button className={mode === 'up' ? 'on' : ''} onClick={() => setMode('up')}>Criar conta</button>
            <button className={mode === 'in' ? 'on' : ''} onClick={() => setMode('in')}>Entrar</button>
          </div>
        )}
        <form onSubmit={submit}>
          {mode === 'up' && <label>Seu nome<input required value={name} onChange={e => setName(e.target.value)} autoComplete="name" maxLength={40} /></label>}
          <label>Usuário<input required value={user} onChange={e => setUser(e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="ex.: maria" /></label>
          <label>Senha<input required type="password" minLength={6} value={pass} onChange={e => setPass(e.target.value)} autoComplete={mode === 'up' ? 'new-password' : 'current-password'} /></label>
          {err && <p className="err">{err}</p>}
          {info && <p className="ok">{info}</p>}
          <button className="btn primary big" disabled={busy}>{busy ? (mode === 'up' ? 'Criando sua conta…' : 'Entrando…') : mode === 'up' ? 'Criar conta e montar meu personagem' : 'Entrar no escritório'}</button>
        </form>
        {backend.mode === 'supabase' && !setup && <p className="muted small center">Ainda não tem acesso? Peça ao adm para criar sua conta.</p>}
        {backend.mode === 'demo' && (
          <p className="demo-note">
            <b>Modo demonstração.</b> Os dados ficam só neste navegador. Abra outra aba para entrar como outra pessoa e ver tudo em tempo real.
          </p>
        )}
        <div className="tfeito">feito com <Meo size={16} color="#2440FF" /><Wordmark size={14} /></div>
      </div>
    </div>
  )
}
