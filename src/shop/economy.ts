import type { CoffeeLine, Goal, Project, Task } from '../types'

/** Economia dos cafezinhos — espelho do SQL (claim_coffee). Quem credita é só o servidor. */
export const WELCOME = 60
export const DAY = 10
export const PHASE = 5
export const FINAL = 20
/** metas pagas por pessoa por mês */
export const MAX_GOALS = 3

/** fases: alvo ≥ 4 → 25/50/75/100%; alvo menor → só o final */
export const steps = (target: number) =>
  target >= 4 ? [Math.ceil(target * 0.25), Math.ceil(target * 0.5), Math.ceil(target * 0.75), target] : [target]

/** quanto a meta inteira paga */
export const goalTotal = (target: number) => (steps(target).length - 1) * PHASE + FINAL

/** a tarefa só conta se outra pessoa participou: pediu, é mestre do projeto ou aprovou */
export function counts(t: Task, projects: Record<string, Project>) {
  if (t.created_by !== t.owner_id) return true
  const m = t.project_id ? projects[t.project_id]?.master_id : null
  if (m && m !== t.owner_id) return true
  return (t.reviews ?? []).some(r => r.ok && r.by !== t.owner_id)
}

/** fases a pagar: [ref-sufixo, valor] das que passaram da base e já foram alcançadas */
export function payouts(g: Goal, value: number, base: number): { i: number; amount: number; reason: 'fase' | 'meta' }[] {
  const s = steps(g.target)
  return s.flatMap((v, i) => v > base && value >= v
    ? [{ i: i + 1, amount: i < s.length - 1 ? PHASE : FINAL, reason: i < s.length - 1 ? 'fase' as const : 'meta' as const }] : [])
}

export const REASON: Record<CoffeeLine['reason'], string> = {
  dia: 'Dia de trabalho', boasvindas: 'Boas-vindas', fase: 'Fase da meta', meta: 'Meta batida', compra: 'Compra',
}
