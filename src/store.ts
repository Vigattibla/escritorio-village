import { useSyncExternalStore } from 'react'
import { backend } from './data'
import { canAssign } from './game/ranks'
import { level, levelTitle, taskXp } from './game/xp'
import { MAX_DESKS } from './office/world'
import type { Avatar, Message, Pos, Profile, Task, TaskStatus } from './types'

export type Phase = 'loading' | 'auth' | 'creator' | 'office'
export type Tab = 'mesa' | 'equipe' | 'chat'
export type DeskView = 'pasta' | 'pc'
export interface Go { tab?: Tab; viewing?: string; channel?: string; desk?: string; deskView?: DeskView }
export interface Notice { id: string; text: string; at: number; from?: string; go?: Go }

export interface State {
  phase: Phase
  meId: string | null
  accountName: string
  error: string
  profiles: Record<string, Profile>
  tasks: Record<string, Task>
  messages: Message[]
  online: Set<string>
  tab: Tab
  viewing: string | null
  channel: string
  reads: Record<string, string>
  requestTo: string | null
  /** mesa aberta em tela cheia (id do dono) */
  desk: string | null
  deskView: DeskView
  editing: boolean
  notices: Notice[]
  pipOpen: boolean
}

const initial: State = {
  phase: 'loading', meId: null, accountName: '', error: '', profiles: {}, tasks: {}, messages: [], online: new Set(),
  tab: 'mesa', viewing: null, channel: 'geral', reads: {}, requestTo: null, desk: null, deskView: 'pasta', editing: false, notices: [], pipOpen: false,
}

let state = initial
const subs = new Set<() => void>()
function set(patch: Partial<State>) {
  state = { ...state, ...patch }
  subs.forEach(f => f())
}
export const getState = () => state
export function useStore<T>(sel: (s: State) => T): T {
  return useSyncExternalStore(cb => { subs.add(cb); return () => subs.delete(cb) }, () => sel(state))
}

// Dados que mudam a cada quadro ficam fora do estado React.
export const positions = new Map<string, Pos>()
export const bubbles = new Map<string, { text: string; until: number }>()

export const dmChannel = (a: string, b: string) => 'dm:' + [a, b].sort().join(':')
export const isMyChannel = (ch: string, me: string) => ch === 'geral' || (ch.startsWith('dm:') && ch.split(':').includes(me))
export const dmPeer = (ch: string, me: string) => ch.split(':').slice(1).find(id => id !== me) ?? me
export const me = () => (state.meId ? state.profiles[state.meId] : undefined)
export const nameOf = (id: string) => state.profiles[id]?.name ?? 'Alguém'

export function unread(s: State, ch: string) {
  const since = s.reads[ch] ?? ''
  return s.messages.filter(m => m.channel === ch && m.sender_id !== s.meId && m.created_at > since).length
}

// ---------- avisos (mascote, PiP, notificação do sistema) ----------
function notify(text: string, extra: Omit<Notice, 'id' | 'text' | 'at'> = {}) {
  const n: Notice = { id: crypto.randomUUID(), text, at: Date.now(), ...extra }
  set({ notices: [n, ...state.notices].slice(0, 30) })
  if (document.hidden && !state.pipOpen && 'Notification' in window && Notification.permission === 'granted') {
    const sys = new Notification('Escritório Village', { body: text, icon: './favicon.svg', tag: n.id })
    sys.onclick = () => { window.focus(); if (n.go) setUi(n.go); sys.close() }
  }
}

// ---------- realtime ----------
function onProfile(p: Profile) {
  const isNew = !state.profiles[p.id]
  set({ profiles: { ...state.profiles, [p.id]: p } })
  if (isNew && p.id !== state.meId) notify(`${p.name} entrou no time! 👋`, { from: p.id, go: { tab: 'equipe' } })
}

function onTask(t: Task) {
  const prev = state.tasks[t.id]
  set({ tasks: { ...state.tasks, [t.id]: t } })
  const my = state.meId
  if (!my) return
  if (!prev && t.owner_id === my && t.created_by !== my) {
    if (t.status === 'inbox') notify(`${nameOf(t.created_by)} te pediu: “${t.title}”`, { from: t.created_by, go: { desk: my, deskView: 'pc' } })
    else notify(`${nameOf(t.created_by)} colocou na sua pasta: “${t.title}”`, { from: t.created_by, go: { desk: my, deskView: 'pasta' } })
  }
  if (t.created_by === my && t.owner_id !== my && t.status !== prev?.status) {
    const who = nameOf(t.owner_id), go: Go = { desk: my, deskView: 'pc' }
    if (t.status === 'done') notify(`${who} concluiu seu pedido: “${t.title}” ✅`, { from: t.owner_id, go })
    else if (t.status === 'declined') notify(`${who} recusou seu pedido: “${t.title}”`, { from: t.owner_id, go })
    else if (prev?.status === 'inbox' && t.status === 'todo') notify(`${who} aceitou seu pedido: “${t.title}”`, { from: t.owner_id, go })
  }
}

function onTaskDeleted(id: string) {
  if (!state.tasks[id]) return
  const tasks = { ...state.tasks }
  delete tasks[id]
  set({ tasks })
}

function onMessage(m: Message) {
  const my = state.meId
  if (!my || !isMyChannel(m.channel, my) || state.messages.some(x => x.id === m.id)) return
  set({ messages: [...state.messages, m].slice(-600) })
  if (m.sender_id === my) return
  bubbles.set(m.sender_id, { text: m.body, until: Date.now() + 6000 })
  const viewing = state.tab === 'chat' && state.channel === m.channel && !document.hidden
  if (viewing) return markRead(m.channel)
  const where = m.channel === 'geral' ? ' (Geral)' : ''
  notify(`${nameOf(m.sender_id)}${where}: ${m.body.slice(0, 90)}`, { from: m.sender_id, go: { tab: 'chat', channel: m.channel } })
}

// ---------- ações ----------
let booted = false
let disconnect: (() => void) | null = null

export async function boot() {
  if (booted) return
  booted = true
  try {
    const uid = await backend.currentUserId()
    if (uid) await enter(uid)
    else set({ phase: 'auth' })
  } catch (e) {
    set({ phase: 'auth', error: (e as Error).message })
  }
}

export async function enter(uid: string) {
  const [snap, accountName] = await Promise.all([backend.loadAll(), backend.accountName()])
  let reads: Record<string, string> = {}
  try { reads = JSON.parse(localStorage.getItem(`ev:reads:${uid}`) ?? '{}') } catch { /* sem leituras salvas */ }
  const mine = snap.profiles.find(p => p.id === uid)
  set({
    meId: uid, accountName, error: '', reads,
    profiles: Object.fromEntries(snap.profiles.map(p => [p.id, p])),
    tasks: Object.fromEntries(snap.tasks.map(t => [t.id, t])),
    messages: snap.messages.filter(m => isMyChannel(m.channel, uid)),
    phase: mine?.avatar ? 'office' : 'creator',
    viewing: uid,
  })
  disconnect?.()
  disconnect = backend.connect(uid, {
    profile: onProfile, task: onTask, taskDeleted: onTaskDeleted, message: onMessage,
    pos: (id, p) => positions.set(id, p),
    online: ids => {
      const next = new Set(ids)
      if (next.size !== state.online.size || ids.some(id => !state.online.has(id))) set({ online: next })
    },
  })
}

export async function signOut() {
  disconnect?.()
  disconnect = null
  await backend.signOut()
  positions.clear()
  set({ ...initial, phase: 'auth' })
}

export function setUi(p: Partial<Pick<State, 'tab' | 'viewing' | 'channel' | 'requestTo' | 'editing' | 'pipOpen' | 'error' | 'desk' | 'deskView'>>) {
  set(p)
  if (state.tab === 'chat') markRead(state.channel)
}

export function markRead(ch: string) {
  if (!state.meId || unread(state, ch) === 0) return
  const last = state.messages.filter(m => m.channel === ch).at(-1)?.created_at ?? new Date().toISOString()
  const reads = { ...state.reads, [ch]: last }
  localStorage.setItem(`ev:reads:${state.meId}`, JSON.stringify(reads))
  set({ reads })
}

export async function saveProfile(d: { name: string; role: string; avatar: Avatar; photo: string | null }) {
  const uid = state.meId!
  const prev = state.profiles[uid]
  let desk = prev?.desk ?? -1
  if (desk < 0) {
    const taken = new Set(Object.values(state.profiles).map(p => p.desk))
    desk = [...Array(MAX_DESKS).keys()].find(i => !taken.has(i)) ?? Object.keys(state.profiles).length % MAX_DESKS
  }
  const p: Profile = {
    id: uid, xp: prev?.xp ?? 0, desk, rank: prev?.rank ?? 1, created_at: prev?.created_at ?? new Date().toISOString(),
    name: d.name.trim() || state.accountName || 'Sem nome', role: d.role.trim(), avatar: d.avatar, photo: d.photo,
  }
  const saved = await backend.upsertProfile(p)
  set({ profiles: { ...state.profiles, [uid]: saved }, phase: 'office', editing: false })
}

async function putTask(t: Task) {
  set({ tasks: { ...state.tasks, [t.id]: t } })
  await backend.upsertTask(t)
}

/** Na própria pasta ou de quem tem cargo menor: entra direto. Senão vira pedido no computador da pessoa. */
export async function addTask(owner: string, title: string, due: string | null = null, notes = '') {
  const direct = canAssign(me(), state.profiles[owner])
  const t: Task = {
    id: crypto.randomUUID(), owner_id: owner, created_by: state.meId!, title: title.trim(), notes, status: direct ? 'todo' : 'inbox',
    due, position: Date.now(), created_at: new Date().toISOString(), done_at: null,
  }
  await putTask(t)
}

export async function setStatus(id: string, status: TaskStatus) {
  const t = state.tasks[id]
  const my = me()
  if (!t || !my || t.owner_id !== my.id || t.status === status) return
  const wasDone = t.status === 'done'
  await putTask({ ...t, status, position: Date.now(), done_at: status === 'done' ? new Date().toISOString() : null })
  const delta = status === 'done' ? taskXp(t) : wasDone ? -taskXp(t) : 0
  if (!delta) return
  const xp = Math.max(0, my.xp + delta)
  const p = { ...my, xp }
  set({ profiles: { ...state.profiles, [my.id]: p } })
  set({ profiles: { ...state.profiles, [my.id]: await backend.upsertProfile(p) } })
  if (level(xp) > level(my.xp)) notify(`Subiu para o nível ${level(xp)} — ${levelTitle(xp)}! 🎉`, { go: { tab: 'mesa' } })
}

export const acceptRequest = (id: string) => setStatus(id, 'todo')
export const declineRequest = (id: string) => setStatus(id, 'declined')

export async function setRank(target: string, rank: number) {
  const p = state.profiles[target]
  if (!p || p.rank === rank) return
  await backend.setRank(target, rank)
  set({ profiles: { ...state.profiles, [target]: { ...p, rank } } })
}

export async function renameTask(id: string, title: string) {
  const t = state.tasks[id]
  if (!t || !title.trim() || t.title === title.trim()) return
  await putTask({ ...t, title: title.trim() })
}

export async function removeTask(id: string) {
  if (!state.tasks[id]) return
  onTaskDeleted(id)
  await backend.deleteTask(id)
}

export async function send(channel: string, body: string) {
  const text = body.trim()
  if (!text || !state.meId) return
  const m: Message = { id: crypto.randomUUID(), channel, sender_id: state.meId, body: text.slice(0, 1000), created_at: new Date().toISOString() }
  set({ messages: [...state.messages, m] })
  bubbles.set(state.meId, { text, until: Date.now() + 6000 })
  await backend.sendMessage(m)
}

/** Para ações disparadas por clique: mostra o erro em vez de engolir. */
export function run(p: Promise<unknown>) {
  p.catch(e => set({ error: (e as Error).message }))
}
