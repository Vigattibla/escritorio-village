import { backend } from '.'
import { SupabaseBackend } from './supabase'

export interface TarefaIA { titulo: string; projeto?: string; descricao?: string; itens?: string[]; ajudou?: string; dia?: string }
const FN = (import.meta.env.VITE_SUPABASE_URL as string) + '/functions/v1/relatorio-ia'

/** texto do relatório escrito pelo Gemini (função relatorio-ia). No demo devolve um texto de exemplo */
export async function textoRelatorio(b: { nome: string; cargo?: string; semana: string; resumo?: string; tarefas: TarefaIA[] }) {
  if (!(backend instanceof SupabaseBackend)) {
    await new Promise(r => setTimeout(r, 2500))
    return (b.resumo ? b.resumo + '\n\n' : '') + `Nesta semana concluí ${b.tarefas.length} entrega${b.tarefas.length === 1 ? '' : 's'}.\n` + b.tarefas.map(t => `- ${t.titulo}${t.descricao ? `: ${t.descricao}` : ''}`).join('\n') + '\n\n(texto de exemplo: no site oficial quem escreve é a IA)'
  }
  const r = await fetch(FN, { method: 'POST', headers: { Authorization: 'Bearer ' + await backend.token(), apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string, 'Content-Type': 'application/json' }, body: JSON.stringify(b) })
    .catch(() => { throw new Error('Não consegui falar com a IA. Confira a internet.') })
  const j = await r.json().catch(() => null)
  if (!r.ok) throw new Error(j?.error ?? `IA indisponível (${r.status}).`)
  return j.texto as string
}
