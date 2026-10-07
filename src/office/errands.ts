import { getState, subscribe } from '../store'
import type { Task } from '../types'

/** write = anota no quadro · fetch = pega arquivo na estante · store = guarda arquivo na estante */
export type ErrandKind = 'write' | 'fetch' | 'store'
export interface Errand { who: string; kind: ErrandKind; label: string; at: number }

const TTL = 90_000
const BULK = 5
const queue: Errand[] = []
let prev: Record<string, Task> | null = null
let prevMe: string | null = null

function push(who: string, kind: ErrandKind, label: string) {
  queue.push({ who, kind, label, at: Date.now() })
  if (queue.length > 40) queue.shift()
}

// Observa o quadro o tempo todo (mesmo fora da tela do escritório) e enfileira o que os bonecos vão fazer.
subscribe(() => {
  const s = getState()
  if (s.meId !== prevMe) { prevMe = s.meId; prev = null }
  if (!s.meId || s.tasks === prev) return
  if (prev === null) { prev = s.tasks; return }
  const old = prev
  prev = s.tasks
  const added = Object.values(s.tasks).filter(t => !old[t.id])
  if (added.length <= BULK) for (const t of added) if (t.status !== 'declined') push(t.owner_id, 'write', t.title)
  for (const t of Object.values(s.tasks)) {
    const o = old[t.id]
    if (!o) continue
    if (t.attachments.length > o.attachments.length) push(t.attachments[t.attachments.length - 1].by || t.owner_id, 'fetch', t.title)
    else if (t.status === 'done' && o.status !== 'done') push(t.owner_id, 'store', t.title)
    else if (t.owner_id !== o.owner_id) push(t.owner_id, 'write', t.title)
  }
})

/** Tira da fila tudo que ainda é recente. */
export function takeErrands(): Errand[] {
  const now = Date.now()
  return queue.splice(0).filter(e => now - e.at < TTL)
}

/** Riscos do quadro branco (cores), os mais novos no fim. */
export const boardMarks: string[] = []
const MARKS = ['#e05a47', '#4a90d9', '#3fa66b', '#8e5bd6', '#FBC222']
export function addMark() {
  boardMarks.push(MARKS[boardMarks.length % MARKS.length])
  if (boardMarks.length > 8) boardMarks.shift()
}
