import type { Profile } from '../types'

// Mesmas regras do supabase/schema.sql (rank_of / set_rank / política de tarefas).
export const RANKS = ['', 'Equipe', 'Coordenação', 'Gerência', 'Chefe'] as const
export const MAX_RANK = 4

export const rankOf = (p: Profile | undefined) => Math.min(MAX_RANK, Math.max(1, p?.rank ?? 1))
/** Chefe vê a visão geral e mexe em qualquer tarefa */
export const isChief = (p: Profile | undefined) => rankOf(p) === MAX_RANK
export const rankName = (p: Profile | undefined) => RANKS[rankOf(p)]
/** sala (departamento) de uma pessoa ou linha; sem campo = Marketing (como o default do banco) */
export const DEPT0 = 'marketing'
export const deptOf = (x: { dept?: string | null } | undefined | null) => x?.dept || DEPT0
/** Quem senta na mesa do Gerente da sala: o primeiro com cargo Gerência (ordem alfabética) */
export const managerOf = (profiles: Record<string, Profile>, sala?: string) =>
  Object.values(profiles).filter(p => p.avatar && rankOf(p) === 3 && (!sala || deptOf(p) === sala)).sort((a, b) => a.name.localeCompare(b.name))[0]

/** manda em `b`: Chefe sempre; senão cargo maior na mesma sala (igual ao outranks do banco) */
export const outranks = (a: Profile | undefined, b: Profile | undefined) =>
  !!a && !!b && (isChief(a) || (rankOf(a) > rankOf(b) && deptOf(a) === deptOf(b)))

/** Pode colocar tarefa direto na pasta de `owner` (sem precisar de aceite)? */
export const canAssign = (me: Profile | undefined, owner: Profile | undefined) =>
  !!me && !!owner && (me.id === owner.id || outranks(me, owner))

/** Cargos que `me` pode dar a `target` (vazio = não pode mexer). */
export function ranksFor(me: Profile | undefined, target: Profile | undefined): number[] {
  if (me?.is_admin && target) return [1, 2, 3, 4]
  if (!me || !target || me.id === target.id || rankOf(target) >= rankOf(me) || (!isChief(me) && deptOf(me) !== deptOf(target))) return []
  return [...Array(rankOf(me)).keys()].map(i => i + 1)
}
