import { dayKey } from './xp'

type P = { due: string | null; due_time?: string | null; status?: string }
/** "14:30" ou "" — o horário de entrega vai junto do prazo */
export const hm = (t: P) => (t.due && t.due_time ? t.due_time : '')
/** com horário, atrasa na hora marcada; sem, só no dia seguinte */
export function atrasada(t: P, now = new Date()) {
  if (!t.due || t.status === 'done') return false
  const today = dayKey(now)
  if (t.due !== today) return t.due < today
  return !!t.due_time && t.due_time < now.toTimeString().slice(0, 5)
}
