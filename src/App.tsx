import { useEffect } from 'react'
import Auth from './screens/Auth'
import Creator from './screens/Creator'
import Office from './screens/Office'
import { boot, useStore } from './store'

export default function App() {
  const phase = useStore(s => s.phase)
  useEffect(() => { boot() }, [])
  if (phase === 'loading') return <div className="loading">Abrindo o escritório…</div>
  if (phase === 'auth') return <Auth />
  if (phase === 'creator') return <Creator />
  return <Office />
}
