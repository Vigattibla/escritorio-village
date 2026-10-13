import { useEffect } from 'react'
import Auth from './screens/Auth'
import Creator from './screens/Creator'
import Office from './screens/Office'
import { boot, useStore } from './store'
import './avisos'
import { useVoltaLinkedin } from './components/Linkedin'

export default function App() {
  const phase = useStore(s => s.phase)
  const sala = useStore(s => s.sala)
  useEffect(() => { boot() }, [])
  useVoltaLinkedin(phase !== 'loading' && phase !== 'auth' && phase !== 'creator')
  if (phase === 'loading') return <div className="loading">Abrindo o escritório…</div>
  if (phase === 'auth') return <Auth />
  if (phase === 'creator') return <Creator />
  return <Office key={sala} />
}
