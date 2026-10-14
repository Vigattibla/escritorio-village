import { backend } from '.'
import { SupabaseBackend } from './supabase'

/** Estúdio da VPS: chat (só adm) e fila de pedidos (coordenação também) pelo REST; RLS garante */
const URL_ = (import.meta.env.VITE_SUPABASE_URL as string) + '/rest/v1/'

export type ChatMsg = { id: string; papel: 'eu' | 'estudio'; texto: string; estado: 'novo' | 'lendo' | 'feito' | 'erro'; criado_em: string }
export type Pedido = { id: string; task_id: string | null; molde: string; pilar: string | null; texto: string; quando: string | null; estado: 'fila' | 'gerando' | 'pronto' | 'erro'; passo: string | null; erro: string | null; criado_em: string }
export type Sinal = { id: string; visto: string; info: { ocupado?: boolean; moldes?: string[] } }

export const estudioReal = () => backend instanceof SupabaseBackend

async function rest<T>(caminho: string, init: { method?: string; body?: unknown; prefer?: string } = {}): Promise<T> {
  if (!(backend instanceof SupabaseBackend)) throw new Error('No demo o Estúdio não está ligado.')
  const r = await fetch(URL_ + caminho, {
    method: init.method ?? 'GET',
    headers: { Authorization: 'Bearer ' + await backend.token(), apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string, 'Content-Type': 'application/json', ...(init.prefer ? { Prefer: init.prefer } : {}) },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  }).catch(() => { throw new Error('Não consegui falar com o servidor. Confira a internet.') })
  const t = await r.text()
  if (!r.ok) throw new Error(`Estúdio indisponível (${r.status}).`)
  return (t ? JSON.parse(t) : null) as T
}

export const lerChat = () => rest<ChatMsg[]>('estudio_chat?select=id,papel,texto,estado,criado_em&order=criado_em.desc&limit=60').then(l => l.reverse())
export const mandarChat = (texto: string) => rest('estudio_chat', { method: 'POST', body: { papel: 'eu', texto }, prefer: 'return=minimal' })
export const lerPedidos = () => rest<Pedido[]>('estudio_pedidos?select=id,task_id,molde,pilar,texto,quando,estado,passo,erro,criado_em&order=criado_em.desc&limit=15')
export const pedir = (p: { texto: string; pilar: string | null; quando: string | null; molde?: string }) =>
  rest('estudio_pedidos', { method: 'POST', body: { ...p, molde: p.molde || 'convention-linkedin' }, prefer: 'return=minimal' })
export const cancelarPedido = (id: string) => rest(`estudio_pedidos?id=eq.${id}`, { method: 'DELETE', prefer: 'return=minimal' })
export const lerSinal = () => rest<Sinal[]>('estudio_sinal?select=id,visto,info&order=visto.desc&limit=1').then(l => l[0] ?? null)
