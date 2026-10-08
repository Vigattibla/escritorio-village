import type { Channel, Goal, Profile, StickerKind, Task } from '../types'
import type { PhName } from './ph'

/** Canais de publicação: rótulo, ícone e cor da etiqueta */
export const CHANNELS: Record<Channel, { label: string; ic: PhName; tag: string }> = {
  feed: { label: 'Feed', ic: 'instagram-logo', tag: 'pink' },
  reels: { label: 'Reels', ic: 'film-strip', tag: 'lilac' },
  stories: { label: 'Stories', ic: 'circle-dashed', tag: 'amber' },
  facebook: { label: 'Facebook', ic: 'facebook-logo', tag: 'blue' },
  site: { label: 'Site', ic: 'globe-simple', tag: 'green' },
}
export const CHANNEL_KEYS = Object.keys(CHANNELS) as Channel[]

/** Adesivos: cor do papel, ícone e frase padrão */
export const KINDS: Record<StickerKind, { bg: string; ic: PhName; label: string }> = {
  'mandou-bem': { bg: '#FFE27A', ic: 'hand-heart', label: 'Mandou bem!' },
  destaque: { bg: '#E4E9CF', ic: 'star', label: 'Destaque da semana' },
  pausa: { bg: '#E3E7EE', ic: 'coffee', label: 'Faz uma pausa' },
  parabens: { bg: '#FCE7F1', ic: 'confetti', label: 'Parabéns!' },
  top: { bg: '#EFE9FD', ic: 'trophy', label: 'Você é top' },
  recorde: { bg: '#FFF1DB', ic: 'note-blank', label: 'Recado' },
}
export const KIND_KEYS = Object.keys(KINDS) as StickerKind[]

export const first = (p: Profile | undefined) => p?.name.split(' ')[0] ?? 'Alguém'
export const monthKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
export const daysLeft = (month: string) => {
  const [y, m] = month.split('-').map(Number)
  const end = new Date(y, m, 0, 23, 59)
  return Math.max(0, Math.ceil((end.getTime() - Date.now()) / 864e5))
}
export const hm = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
export const localDay = (iso: string) => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

/** Progresso da meta: posts = tarefas com canal feitas no mês; tarefas = feitas no mês; manual = valor */
export function goalProgress(g: Goal, tasks: Task[]) {
  const done = tasks.filter(t => t.status === 'done' && t.done_at && localDay(t.done_at).startsWith(g.month) && (g.metric !== 'posts' || !!t.channel))
  const value = g.metric === 'manual' ? g.value : done.length
  const by: Record<string, number> = {}
  if (g.metric !== 'manual') for (const t of done) by[t.owner_id] = (by[t.owner_id] ?? 0) + 1
  const pct = g.target > 0 ? Math.min(100, Math.round((value / g.target) * 100)) : 0
  return { value, pct, by, hit: value >= g.target && g.target > 0 }
}

/** meta do mês corrente (a primeira criada) */
export const currentGoal = (goals: Goal[]) => goals.filter(g => g.month === monthKey()).sort((a, b) => a.created_at.localeCompare(b.created_at))[0]
