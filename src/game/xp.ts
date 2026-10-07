import type { Task } from '../types'

export const XP_TASK = 10
export const XP_REQUEST = 5
export const DAILY_GOAL = 3
export const TITLES = ['Novato', 'Aprendiz', 'Colaborador', 'Destaque', 'Especialista', 'Veterano', 'Mestre', 'Lenda']

export const level = (xp: number) => Math.floor(Math.max(0, xp) / 100) + 1
export const levelTitle = (xp: number) => TITLES[Math.min(level(xp) - 1, TITLES.length - 1)]
export const levelProgress = (xp: number) => Math.max(0, xp) % 100
export const taskXp = (t: Task) => XP_TASK + (t.created_by !== t.owner_id ? XP_REQUEST : 0)

export function dayKey(d: Date | string) {
  const x = typeof d === 'string' ? new Date(d) : d
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}

export function doneToday(tasks: Task[], owner: string) {
  const today = dayKey(new Date())
  return tasks.filter(t => t.owner_id === owner && t.status === 'done' && t.done_at && dayKey(t.done_at) === today).length
}

/** Dias seguidos (terminando hoje ou ontem) com ao menos uma tarefa concluída. */
export function streak(tasks: Task[], owner: string) {
  const days = new Set(tasks.filter(t => t.owner_id === owner && t.done_at).map(t => dayKey(t.done_at!)))
  const d = new Date()
  if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1)
  let n = 0
  while (days.has(dayKey(d))) { n++; d.setDate(d.getDate() - 1) }
  return n
}
