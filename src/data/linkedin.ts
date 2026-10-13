import { backend } from '.'
import { SupabaseBackend } from './supabase'

const FN = (import.meta.env.VITE_SUPABASE_URL as string) + '/functions/v1/linkedin'

/** chama a função linkedin (conectar, desconectar, publicar agora) */
export async function linkedin<T = Record<string, unknown>>(b: { a: 'conectar' | 'desconectar' | 'agora'; id?: string; volta?: string }): Promise<T> {
  if (!(backend instanceof SupabaseBackend)) throw new Error('No demo o LinkedIn não publica de verdade.')
  const r = await fetch(FN, { method: 'POST', headers: { Authorization: 'Bearer ' + await backend.token(), apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string, 'Content-Type': 'application/json' }, body: JSON.stringify(b) })
    .catch(() => { throw new Error('Não consegui falar com o servidor. Confira a internet.') })
  const j = await r.json().catch(() => null)
  if (!r.ok) throw new Error(j?.error ?? `LinkedIn indisponível (${r.status}).`)
  return j as T
}
