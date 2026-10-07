import type { Profile } from '../types'

// Mesmas regras do supabase/schema.sql (rank_of / set_rank / política de tarefas).
export const RANKS = ['', 'Equipe', 'Coordenação', 'Gerência', 'Diretoria'] as const
export const MAX_RANK = 4

export const rankOf = (p: Profile | undefined) => Math.min(MAX_RANK, Math.max(1, p?.rank ?? 1))
export const rankName = (p: Profile | undefined) => RANKS[rankOf(p)]

/** Pode colocar tarefa direto na pasta de `owner` (sem precisar de aceite)? */
export const canAssign = (me: Profile | undefined, owner: Profile | undefined) =>
  !!me && !!owner && (me.id === owner.id || rankOf(me) > rankOf(owner))

/** Cargos que `me` pode dar a `target` (vazio = não pode mexer). */
export function ranksFor(me: Profile | undefined, target: Profile | undefined): number[] {
  if (!me || !target || me.id === target.id || rankOf(target) >= rankOf(me)) return []
  return [...Array(rankOf(me)).keys()].map(i => i + 1)
}
