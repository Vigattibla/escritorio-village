import { backend } from '.'
import { SupabaseBackend } from './supabase'
import type { Attachment } from '../types'

/** Estúdio da VPS: chat (só adm) e canais com calendário (coordenação encaixa publicação no meio) pelo REST; RLS garante */
const URL_ = (import.meta.env.VITE_SUPABASE_URL as string) + '/rest/v1/'

export type ChatMsg = { id: string; papel: 'eu' | 'estudio'; texto: string; estado: 'novo' | 'lendo' | 'feito' | 'erro'; criado_em: string }
export type Pedido = { id: string; task_id: string | null; molde: string; pilar: string | null; texto: string; quando: string | null; estado: 'espera' | 'fila' | 'gerando' | 'pronto' | 'erro' | 'pulado'; passo: string | null; erro: string | null; criado_em: string; criado_por: string; canal: string | null; origem: 'avulso' | 'calendario' | 'extra'; gerar_em: string | null }
export type Pilar = { id: string; nome: string; temas: string[] }
export type Canal = { id: string; nome: string; rede: string; molde: string | null; ativo: boolean; dias: number[]; hora: string; antecedencia: number; pilares: Pilar[]; ordem: number }
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
const CAMPOS = 'id,task_id,molde,pilar,texto,quando,estado,passo,erro,criado_em,criado_por,canal,origem,gerar_em'
export const lerCanais = () => rest<Canal[]>('estudio_canais?select=*&order=ordem')
/** calendário do canal: duas semanas pra trás até o fim do que já foi planejado */
export const lerAgenda = (canal: string) =>
  rest<Pedido[]>(`estudio_pedidos?select=${CAMPOS}&canal=eq.${encodeURIComponent(canal)}&quando=gte.${encodeURIComponent(new Date(Date.now() - 14 * 864e5).toISOString())}&order=quando.asc&limit=80`)
/** publicação no meio: o banco herda o molde do canal e agenda a geração */
export const encaixar = (p: { canal: string; texto: string; pilar: string | null; quando: string }) =>
  rest('estudio_pedidos', { method: 'POST', body: { ...p, origem: 'extra' }, prefer: 'return=minimal' })
export const mudarPedido = (id: string, campos: Partial<Pick<Pedido, 'texto' | 'estado' | 'gerar_em' | 'pilar'>>) =>
  rest(`estudio_pedidos?id=eq.${id}`, { method: 'PATCH', body: { ...campos, atualizado_em: new Date().toISOString() }, prefer: 'return=minimal' })
export const salvarCanal = (id: string, campos: Partial<Omit<Canal, 'id'>>) => rest(`estudio_canais?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', body: campos, prefer: 'return=minimal' })
export const planejar = () => rest<number>('rpc/estudio_planejar', { method: 'POST', body: {} })
export const cancelarPedido = (id: string) => rest(`estudio_pedidos?id=eq.${id}`, { method: 'DELETE', prefer: 'return=minimal' })
export const lerSinal = () => rest<Sinal[]>('estudio_sinal?select=id,visto,info&order=visto.desc&limit=1').then(l => l[0] ?? null)

/** peça do Estúdio esperando decisão (só quem tem a marca Aprova Estúdio recebe) */
export type ParaAprovar = { pedido: string; task_id: string; titulo: string; legenda: string; anexos: Attachment[]; publicar: string | null; canal: string | null; canal_nome: string | null; pilar: string | null; assunto: string; ajustes: number; entregue: string }
export const lerAprovar = () => rest<ParaAprovar[]>('rpc/estudio_para_aprovar', { method: 'POST', body: {} })
export const decidir = (tid: string, ok: boolean, motivo = '') => rest('rpc/estudio_decidir', { method: 'POST', body: { tid, ok, motivo } })
export const marcarAprovador = (alvo: string, sim: boolean) => rest('rpc/estudio_marcar', { method: 'POST', body: { alvo, sim } })
