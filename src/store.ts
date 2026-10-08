import { useSyncExternalStore } from 'react'
import { backend } from './data'
import { canAssign, isChief, rankName, rankOf } from './game/ranks'
import { dayKey, taskXp } from './game/xp'
import { MAX_DESKS } from './office/world'
import type { Group, RowTable, Rows, Stage, StageKind, Sticker, AccountEdit, AiContext, AiItem, AiProposal, AiStage, Attachment, Avatar, Message, Pos, Profile, Project, Review, Task, TaskNote, TaskStatus } from './types'
import { ROW_TABLES } from './types'

export type Phase = 'loading' | 'auth' | 'creator' | 'office'
export type Tab = 'mesa' | 'aprovar' | 'avisos' | 'equipe' | 'chat' | 'geral'
/** quadro = trabalho do dia a dia (estilo Trello); escritório = visualização em pixel */
export type View = 'quadro' | 'escritorio' | 'agenda' | 'metas' | 'fluxos' | 'inicio' | 'arquivos'
export interface Go { tab?: Tab; viewing?: string; channel?: string; task?: string }
export interface Notice { id: string; text: string; at: number; from?: string; go?: Go }

export interface State {
  phase: Phase
  meId: string | null
  accountName: string
  error: string
  profiles: Record<string, Profile>
  tasks: Record<string, Task>
  messages: Message[]
  /** fio de comentários de todas as tarefas */
  notes: TaskNote[]
  projects: Record<string, Project>
  /** agenda, metas, adesivos, fluxos */
  rows: { [K in RowTable]: Record<string, Rows[K]> }
  online: Set<string>
  tab: Tab
  viewing: string | null
  channel: string
  reads: Record<string, string>
  requestTo: string | null
  /** tarefa aberta nos detalhes */
  task: string | null
  editing: boolean
  notices: Notice[]
  pipOpen: boolean
  view: View
  /** no quadro, painel lateral (equipe/chat/geral) aberto */
  drawer: boolean
  /** projeto aberto no quadro ('' = todos) */
  project: string
  /** editor de projeto: id, 'new' ou null */
  projectEdit: string | null
  /** caixa da IA do Gerente aberta */
  aiOpen: boolean
  /** chat flutuante (botão no canto) aberto */
  chatOpen: boolean
  /** sino de avisos aberto */
  bellOpen: boolean
  /** quadro filtrado só no que espera minha aprovação */
  qApprove: boolean
  /** fluxo aberto na tela Fluxos */
  flow: string | null
  /** criar tarefa em folha (celular / botão Nova tarefa) */
  sheet: boolean
  /** colar adesivo: id de quem recebe ('' = escolher) ou null */
  stickTo: string | null
}


const initial: State = {
  phase: 'loading', meId: null, accountName: '', error: '', profiles: {}, tasks: {}, messages: [], notes: [], projects: {}, rows: { events: {}, goals: {}, stickers: {}, flows: {}, stages: {}, groups: {} }, online: new Set(),
  tab: 'mesa', viewing: null, channel: 'geral', reads: {}, requestTo: null, task: null, editing: false, notices: [], pipOpen: false, view: 'quadro' as View, drawer: false,
  project: '', projectEdit: null, aiOpen: false, chatOpen: false, bellOpen: false, qApprove: false, flow: null, sheet: false, stickTo: null,
}

let state = initial
const subs = new Set<() => void>()
function set(patch: Partial<State>) {
  state = { ...state, ...patch }
  subs.forEach(f => f())
}
export const getState = () => state
export const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f) } }
export function useStore<T>(sel: (s: State) => T): T {
  return useSyncExternalStore(cb => { subs.add(cb); return () => subs.delete(cb) }, () => sel(state))
}

// Dados que mudam a cada quadro ficam fora do estado React.
export const positions = new Map<string, Pos>()
export const bubbles = new Map<string, { text: string; until: number }>()

export const dmChannel = (a: string, b: string) => 'dm:' + [a, b].sort().join(':')
/** canais que chegam até mim (grupo: o banco já filtra pelo RLS; quem não é membro não recebe aviso) */
export const isMyChannel = (ch: string, me: string) => ch === 'geral' || ch.startsWith('g:') || (ch.startsWith('dm:') && ch.split(':').includes(me))
export const groupChannel = (id: string) => 'g:' + id
export const groupOf = (ch: string, s: State = state) => (ch.startsWith('g:') ? s.rows.groups[ch.slice(2)] : undefined)
/** faço parte do canal? (geral e conversa: sempre; grupo: só membro) */
export const inChannel = (ch: string, s: State = state) => !ch.startsWith('g:') || !!(s.meId && groupOf(ch, s)?.members.includes(s.meId))
/** posso abrir o canal? (grupo aberto: qualquer um espia antes de entrar) */
export const seesChannel = (ch: string, s: State = state) => { const g = groupOf(ch, s); return !ch.startsWith('g:') || !!g && (g.open || inChannel(ch, s)) }
export const dmPeer = (ch: string, me: string) => ch.split(':').slice(1).find(id => id !== me) ?? me
export const me = () => (state.meId ? state.profiles[state.meId] : undefined)
export const nameOf = (id: string) => id === CHEFIA ? 'chefia' : state.profiles[id]?.name ?? 'Alguém'

/** linhas antigas (antes do SQL v3) não têm os campos novos */
const norm = (t: Task): Task => ({
  ...t, start: t.start ?? null, collaborators: t.collaborators ?? [], attachments: t.attachments ?? [],
  project_id: t.project_id ?? null, criteria: t.criteria ?? [], reviews: t.reviews ?? [],
  priority: t.priority ?? null, checklist: t.checklist ?? [], remind_at: t.remind_at ?? null,
  channel: t.channel ?? null, publish_at: t.publish_at ?? null, stage: t.stage ?? null, drive: t.drive ?? null,
})
export const involved = (t: Task, uid: string) => t.owner_id === uid || t.created_by === uid || t.collaborators.includes(uid)
/** Mexe nos detalhes: dono, autor, colaborador, cargo acima do dono ou Chefe. */
export function canEditTask(t: Task, uid = state.meId) {
  if (!uid) return false
  const my = state.profiles[uid]
  return involved(t, uid) || isChief(my) || canAssign(my, state.profiles[t.owner_id])
}
/** Muda a etapa: responsável, Chefe ou cargo acima do responsável (igual ao guard_task). */
export function canMove(t: Task, uid = state.meId) {
  if (!uid) return false
  const my = state.profiles[uid]
  return t.owner_id === uid || isChief(my) || canAssign(my, state.profiles[t.owner_id])
}
/** Passa para outra pessoa: Chefe, ou cargo acima de quem tem e de quem recebe. */
export function canReassign(t: Task, to: string, uid = state.meId) {
  const my = uid ? state.profiles[uid] : undefined
  if (!my || to === t.owner_id) return false
  const r = rankOf(my)
  return r === 4 || (r > rankOf(state.profiles[t.owner_id]) && r > rankOf(state.profiles[to]))
}
/** aprovador "qualquer cargo acima do responsável" (card sem projeto criado pelo próprio dono) */
export const CHEFIA = 'chefia'
/** Sem projeto, a entrega pode ir para aprovação se outra pessoa pediu ou se há cargo acima do responsável. */
export function canAskReview(t: Task) {
  if (t.project_id) return false
  return t.created_by !== t.owner_id || !isChief(state.profiles[t.owner_id])
}
/** Quem aprova: no projeto, o mestre (se não for ele quem faz). Sem projeto, só quando o card foi para Aprovação: quem pediu, senão a chefia. */
export function approverOf(t: Task): string | null {
  if (t.project_id) {
    const p = state.projects[t.project_id]
    return p && p.master_id !== t.owner_id ? p.master_id : null
  }
  if (t.status !== 'review') return null
  return t.created_by && t.created_by !== t.owner_id ? t.created_by : CHEFIA
}
/** Aprova ou reprova: o aprovador ou a Chefe; "chefia" = qualquer cargo acima do responsável. */
export function canApprove(t: Task, uid = state.meId) {
  const a = approverOf(t)
  if (!uid || !a) return false
  if (a === CHEFIA) return uid !== t.owner_id && (isChief(state.profiles[uid]) || rankOf(state.profiles[uid]) > rankOf(state.profiles[t.owner_id]))
  return a === uid || isChief(state.profiles[uid])
}
/** Critérios que valem para a tarefa: os do projeto + os dela. */
export const criteriaOf = (t: Task) => [...(t.project_id ? state.projects[t.project_id]?.criteria ?? [] : []), ...t.criteria]
/** Cria projeto: Coordenação para cima, ou o adm. */
export const canCreateProject = (uid = state.meId) => { const p = uid ? state.profiles[uid] : undefined; return !!p && (rankOf(p) >= 2 || !!p.is_admin) }
/** Edita o projeto: mestre, quem criou ou a Chefe. */
export function canEditProject(p: Project, uid = state.meId) {
  return !!uid && (p.master_id === uid || p.created_by === uid || isChief(state.profiles[uid]))
}
/** Quem está no projeto: mestre + todo mundo com tarefa nele. */
export function teamOf(pid: string) {
  const ids = new Set<string>()
  const p = state.projects[pid]
  if (p) ids.add(p.master_id)
  for (const t of Object.values(state.tasks)) if (t.project_id === pid) { ids.add(t.owner_id); t.collaborators.forEach(c => ids.add(c)) }
  return ids
}
/** Tarefas esperando a minha aprovação. */
/** Leva para Feito: quem aprova; no card que o próprio dono criou (aprovação da chefia é opcional), o dono também. */
export const canFinish = (t: Task, uid = state.meId) => canApprove(t, uid) || (approverOf(t) === CHEFIA && !!uid && t.owner_id === uid)
export const toApprove = (s: State) => Object.values(s.tasks).filter(t => t.status === 'review' && canApprove(t, s.meId))
/** O chat está na tela? */
const chatShown = () => state.chatOpen
/** conversas destacadas em janelinhas soltas (contam como vistas) */
export const floatChans = new Set<string>()

export function unread(s: State, ch: string) {
  if (!inChannel(ch, s)) return 0
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

function onProfileDeleted(id: string) {
  if (!state.profiles[id]) return
  const profiles = { ...state.profiles }
  delete profiles[id]
  set({ profiles, messages: state.messages.filter(m => m.sender_id !== id), notes: state.notes.filter(n => n.author_id !== id) })
}

function onTask(raw: Task) {
  const t = norm(raw)
  const prev = state.tasks[t.id]
  set({ tasks: { ...state.tasks, [t.id]: t } })
  const my = state.meId
  if (!my) return
  if (!prev && t.owner_id === my && t.created_by !== my) {
    if (t.status === 'inbox') notify(`${nameOf(t.created_by)} te pediu: “${t.title}”`, { from: t.created_by, go: { task: t.id } })
    else notify(`${nameOf(t.created_by)} colocou na sua pasta: “${t.title}”`, { from: t.created_by, go: { task: t.id } })
  }
  if (t.collaborators.includes(my) && !prev?.collaborators.includes(my) && t.owner_id !== my)
    notify(`${nameOf(t.owner_id)} te chamou para colaborar: “${t.title}” 🤝`, { from: t.owner_id, go: { task: t.id } })
  if (t.created_by === my && t.owner_id !== my && t.status !== prev?.status) {
    const who = nameOf(t.owner_id), go: Go = { task: t.id }
    if (t.status === 'done') notify(`${who} concluiu seu pedido: “${t.title}” ✅`, { from: t.owner_id, go })
    else if (t.status === 'declined') notify(`${who} recusou seu pedido: “${t.title}”`, { from: t.owner_id, go })
    else if (prev?.status === 'inbox' && t.status === 'todo') notify(`${who} aceitou seu pedido: “${t.title}”`, { from: t.owner_id, go })
  }
  if (prev && prev.owner_id !== my && t.owner_id === my) notify(`Uma tarefa passou para você: “${t.title}”`, { go: { task: t.id } })
  if (prev && prev.status !== 'review' && t.status === 'review' && (approverOf(t) === my || (approverOf(t) === CHEFIA && canApprove(t, my))) && t.owner_id !== my)
    notify(`${nameOf(t.owner_id)} enviou para aprovação: “${t.title}” 📥`, { from: t.owner_id, go: { tab: 'aprovar' } })
  // decisão nova: avisa o time do projeto (menos quem decidiu)
  const r = t.reviews.at(-1)
  if (prev && r && t.reviews.length > prev.reviews.length && r.by !== my && t.project_id && (teamOf(t.project_id).has(my) || involved(t, my))) {
    const proj = state.projects[t.project_id]?.name ?? 'projeto'
    const dono = t.owner_id === my ? 'Sua entrega' : `A entrega de ${nameOf(t.owner_id)}`
    notify(r.ok ? `✅ ${dono} foi aprovada por ${nameOf(r.by)}: “${t.title}” (${proj})`
      : `❌ ${dono} foi reprovada por ${nameOf(r.by)}: “${t.title}” (${proj}) — ${r.reason.slice(0, 90)}`, { from: r.by, go: { task: t.id } })
  }
}

function onRow<K extends RowTable>(k: K, r: Rows[K]) {
  const prev = state.rows[k][r.id]
  set({ rows: { ...state.rows, [k]: { ...state.rows[k], [r.id]: r } } })
  if (k === 'stickers' && !prev) {
    const st = r as Sticker
    if (st.to_id === state.meId && st.by_id !== state.meId) notify(`${nameOf(st.by_id)} colou um adesivo na sua tela: “${st.text}”`, { from: st.by_id })
  }
}

function onRowDeleted(k: RowTable, id: string) {
  const next = { ...state.rows[k] }
  delete next[id]
  set({ rows: { ...state.rows, [k]: next } })
}

/** grava e já mostra (o realtime confirma depois) */
export async function putRow<K extends RowTable>(k: K, r: Rows[K]) {
  onRow(k, r)
  await backend.upsertRow(k, r)
}

export async function dropRow(k: RowTable, id: string) {
  onRowDeleted(k, id)
  await backend.deleteRow(k, id)
}

function onProject(p: Project) {
  const prev = state.projects[p.id]
  set({ projects: { ...state.projects, [p.id]: { ...p, criteria: p.criteria ?? [] } } })
  const my = state.meId
  if (my && p.master_id === my && prev?.master_id !== my && p.created_by !== my)
    notify(`Você é o mestre do projeto “${p.name}” 🎯`, { from: p.created_by, go: { tab: 'aprovar' } })
}

function onProjectDeleted(id: string) {
  if (!state.projects[id]) return
  const projects = { ...state.projects }
  delete projects[id]
  set({ projects, project: state.project === id ? '' : state.project })
}

function onTaskDeleted(id: string) {
  if (!state.tasks[id]) return
  const tasks = { ...state.tasks }
  delete tasks[id]
  set({ tasks })
}

function onNote(n: TaskNote) {
  if (state.notes.some(x => x.id === n.id)) return
  set({ notes: [...state.notes, n] })
  const t = state.tasks[n.task_id], my = state.meId
  if (!t || !my || n.author_id === my || !involved(t, my) || state.task === t.id) return
  notify(`${nameOf(n.author_id)} comentou em “${t.title}”: ${n.body.slice(0, 80)}`, { from: n.author_id, go: { task: t.id } })
}

function onNoteDeleted(id: string) {
  if (state.notes.some(n => n.id === id)) set({ notes: state.notes.filter(n => n.id !== id) })
}

function onMessage(m: Message) {
  const my = state.meId
  if (!my || !isMyChannel(m.channel, my) || state.messages.some(x => x.id === m.id)) return
  set({ messages: [...state.messages, m].slice(-600) })
  if (m.sender_id === my) return
  bubbles.set(m.sender_id, { text: m.body, until: Date.now() + 6000 })
  const viewing = ((chatShown() && state.channel === m.channel) || floatChans.has(m.channel)) && !document.hidden
  if (viewing) return markRead(m.channel)
  if (!inChannel(m.channel)) return
  const where = m.channel === 'geral' ? ' (Geral)' : m.channel.startsWith('g:') ? ` (${groupOf(m.channel)?.name ?? 'grupo'})` : ''
  notify(`${nameOf(m.sender_id)}${where}: ${m.body.slice(0, 90)}`, { from: m.sender_id, go: { tab: 'chat', channel: m.channel } })
}

// ---------- ações ----------
let booted = false
let disconnect: (() => void) | null = null

// ---------- lembretes ----------
let remindTimer = 0
/** Avisa uma vez cada lembrete vencido das minhas tarefas (o "já avisei" fica no navegador). */
function checkReminders() {
  const my = state.meId
  if (!my) return
  const key = `ev:lembretes:${my}`
  let seen: Record<string, string> = {}
  try { seen = JSON.parse(localStorage.getItem(key) ?? '{}') } catch { /* nada salvo */ }
  const now = Date.now()
  let changed = false
  for (const t of Object.values(state.tasks)) {
    if (!t.remind_at || t.owner_id !== my || t.status === 'done' || t.status === 'declined') continue
    if (new Date(t.remind_at).getTime() > now || seen[t.id] === t.remind_at) continue
    seen[t.id] = t.remind_at
    changed = true
    notify(`⏰ Lembrete: “${t.title}”`, { go: { task: t.id } })
  }
  if (changed) try { localStorage.setItem(key, JSON.stringify(seen)) } catch { /* sem espaço */ }
}

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
    tasks: Object.fromEntries(snap.tasks.map(t => [t.id, norm(t)])),
    notes: snap.notes,
    projects: Object.fromEntries((snap.projects ?? []).map(p => [p.id, { ...p, criteria: p.criteria ?? [] }])),
    rows: {
      ...(Object.fromEntries(ROW_TABLES.map(k => [k, Object.fromEntries((snap.rows?.[k] ?? []).map(r => [r.id, r]))])) as State['rows']),
    },
    messages: snap.messages.filter(m => isMyChannel(m.channel, uid)),
    phase: mine?.avatar ? 'office' : 'creator',
    viewing: uid,
  })
  clearInterval(remindTimer)
  checkReminders()
  remindTimer = window.setInterval(checkReminders, 20000)
  disconnect?.()
  disconnect = backend.connect(uid, {
    profile: onProfile, profileDeleted: onProfileDeleted, task: onTask, taskDeleted: onTaskDeleted, message: onMessage, note: onNote, noteDeleted: onNoteDeleted,
    project: onProject, projectDeleted: onProjectDeleted, row: onRow, rowDeleted: onRowDeleted,
    pos: (id, p) => positions.set(id, p),
    online: ids => {
      const next = new Set(ids)
      if (next.size !== state.online.size || ids.some(id => !state.online.has(id))) set({ online: next })
    },
  })
}

export async function signOut() {
  clearInterval(remindTimer)
  disconnect?.()
  disconnect = null
  await backend.signOut()
  positions.clear()
  set({ ...initial, phase: 'auth' })
}

export function setUi(p: Partial<Pick<State, 'tab' | 'viewing' | 'channel' | 'requestTo' | 'editing' | 'pipOpen' | 'error' | 'task' | 'view' | 'drawer' | 'project' | 'projectEdit' | 'aiOpen' | 'chatOpen' | 'bellOpen' | 'qApprove' | 'flow' | 'sheet' | 'stickTo'>>) {
  // chat, avisos e aprovação não são mais páginas: viram painel flutuante, sino e filtro do quadro
  if (p.tab === 'chat') { const { tab: _, ...rest } = p; p = { ...rest, chatOpen: true } }
  else if (p.tab === 'avisos') { const { tab: _, ...rest } = p; p = { ...rest, bellOpen: true } }
  else if (p.tab === 'aprovar') { const { tab: _, ...rest } = p; p = { ...rest, view: 'quadro', drawer: false, qApprove: true } }
  set(p.tab && p.drawer === undefined && (p.view ?? state.view) === 'quadro' ? { ...p, drawer: true } : p)
  if (chatShown()) markRead(state.channel)
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

/** Mostra na hora; se o servidor recusar, volta como estava. */
async function putTask(t: Task) {
  const prev = state.tasks[t.id]
  set({ tasks: { ...state.tasks, [t.id]: t } })
  try {
    await backend.upsertTask(t)
  } catch (e) {
    if (state.tasks[t.id] === t) {
      const tasks = { ...state.tasks }
      if (prev) tasks[t.id] = prev
      else delete tasks[t.id]
      set({ tasks })
    }
    throw e
  }
}

/**
 * Na própria pasta ou de quem tem cargo menor: entra direto (na etapa pedida).
 * Senão (ou se `status` = 'inbox') vira pedido para a pessoa aceitar.
 */
export async function addTask(owner: string, title: string, due: string | null = null, notes = '', status: TaskStatus = 'todo', project: string | null = null, extra: Pick<Partial<Task>, 'priority' | 'remind_at' | 'channel' | 'publish_at' | 'notes' | 'stage' | 'drive'> = {}) {
  const direct = canAssign(me(), state.profiles[owner])
  if (status === 'review' || status === 'done') status = 'todo' // entrega passa pela etapa certa
  const t: Task = {
    id: crypto.randomUUID(), owner_id: owner, created_by: state.meId!, title: title.trim(), notes, status: direct && status !== 'inbox' ? status : 'inbox',
    start: null, due, collaborators: [], attachments: [], position: Date.now(), created_at: new Date().toISOString(),
    done_at: null, project_id: project || null, criteria: [], reviews: [],
    priority: extra.priority ?? null, checklist: [], remind_at: extra.remind_at ?? null,
    channel: extra.channel ?? null, publish_at: extra.publish_at ?? null, stage: extra.stage ?? null, drive: extra.drive ?? null,
  }
  await putTask(t)
  return t
}

/** XP conta ao entregar (aprovação ou feito). Reenvio depois de reprovar não paga de novo. */
const paid = (s: TaskStatus) => s === 'done' || s === 'review'

/** Etapas do quadro: as padrão até alguém da coordenação mexer; depois, as gravadas. */
export const DEFAULT_STAGES: Stage[] = [
  { id: 'todo', label: 'A fazer', kind: 'todo', pos: 1, created_by: '', created_at: '' },
  { id: 'doing', label: 'Fazendo', kind: 'doing', pos: 2, created_by: '', created_at: '' },
  { id: 'review', label: 'Aprovação', kind: 'review', pos: 3, created_by: '', created_at: '' },
  { id: 'done', label: 'Feito', kind: 'done', pos: 4, created_by: '', created_at: '' },
]
export const STAGE_KINDS: { kind: StageKind; label: string; hint: string }[] = [
  { kind: 'todo', label: 'A fazer', hint: 'Ainda não começou' },
  { kind: 'doing', label: 'Fazendo', hint: 'Em andamento' },
  { kind: 'review', label: 'Aprovação', hint: 'Esperando quem aprova' },
  { kind: 'done', label: 'Feito', hint: 'Concluída (conta nas metas)' },
]
// ---------- grupos do chat ----------
export const GROUP_ICONS = ['chat-circle-dots', 'megaphone', 'film-strip', 'images', 'instagram-logo', 'calendar-blank', 'target', 'trophy', 'star', 'folder-simple', 'gift', 'house', 'coffee', 'confetti', 'globe-simple', 'smiley'] as const
export const canEditGroup = (g: Group, p = me()) => !!p && (g.created_by === p.id || rankOf(p) >= 3)

export async function saveGroup(g: Pick<Group, 'name' | 'icon' | 'open' | 'members'> & { id?: string }) {
  const my = state.meId!
  const old = g.id ? state.rows.groups[g.id] : undefined
  const name = g.name.trim().slice(0, 40)
  if (!name) throw new Error('Dê um nome ao grupo.')
  const r: Group = {
    id: old?.id ?? crypto.randomUUID(), name, icon: g.icon, open: g.open,
    members: [...new Set([...(old ? [] : [my]), ...g.members])],
    created_by: old?.created_by ?? my, created_at: old?.created_at ?? new Date().toISOString(),
  }
  await putRow('groups', r)
  return r
}
export async function joinGroup(id: string, join: boolean) {
  const g = state.rows.groups[id], my = state.meId
  if (!g || !my) return
  onRow('groups', { ...g, members: join ? [...new Set([...g.members, my])] : g.members.filter(x => x !== my) })
  await backend.joinGroup(id, join)
  if (!join && state.channel === groupChannel(id) && !g.open) set({ channel: 'geral' })
}
export async function deleteGroup(id: string) {
  if (state.channel === groupChannel(id)) set({ channel: 'geral' })
  await dropRow('groups', id)
}

export function stageList(rows = state.rows.stages): Stage[] {
  const l = Object.values(rows)
  return (l.length ? l : DEFAULT_STAGES).slice().sort((a, b) => a.pos - b.pos)
}
/** coluna da tarefa: a etapa dela, se ainda existir e for do mesmo tipo; senão a primeira do tipo */
export function stageOf(t: Task, list = stageList()): string | null {
  const s = t.stage ? list.find(x => x.id === t.stage) : undefined
  if (s && s.kind === t.status) return s.id
  return (list.find(x => x.id === t.status) ?? list.find(x => x.kind === t.status))?.id ?? null
}
export const canEditStages = (p = me()) => rankOf(p) >= 2
/** grava a lista inteira (a primeira edição tira as etapas padrão do papel) */
export async function saveStages(next: Stage[]) {
  const now = new Date().toISOString()
  const had = state.rows.stages
  for (const [i, s] of next.entries()) {
    const r: Stage = { ...s, pos: i + 1, created_by: s.created_by || state.meId!, created_at: s.created_at || now }
    const old = had[r.id]
    if (!old || old.label !== r.label || old.kind !== r.kind || old.pos !== r.pos) await putRow('stages', r)
  }
}
export async function removeStage(id: string) {
  const list = stageList()
  const s = list.find(x => x.id === id)
  if (!s) return
  if (!list.some(x => x.kind === s.kind && x.id !== id)) throw new Error(`“${s.label}” é a única etapa do tipo ${STAGE_KINDS.find(k => k.kind === s.kind)!.label}. Renomeie em vez de excluir.`)
  if (!Object.keys(state.rows.stages).length) await saveStages(list)
  await dropRow('stages', id)
}

export async function setStatus(id: string, status: TaskStatus, position = Date.now(), stage: string | null = null) {
  const t = state.tasks[id]
  const my = me()
  if (!t || !my) return
  // quem não aprova, ao concluir, manda para aprovação
  if (status === 'done' && approverOf(t) && !canFinish(t)) { status = 'review'; stage = null }
  if (t.status === status) {
    // mesma etapa-tipo, coluna diferente (ex.: Fazendo → Revisão interna)
    if (stage !== (t.stage ?? null) && stageOf({ ...t, stage }) !== stageOf(t)) {
      if (!canMove(t)) throw new Error('Só quem é responsável (ou um cargo acima) muda a etapa dessa tarefa.')
      await putTask({ ...t, stage, position })
    }
    return
  }
  if (t.status === 'review') {
    // dono pode retirar; aprovador só aprova por aqui (reprovar pede justificativa)
    const withdraw = t.owner_id === my.id && status !== 'done'
    if (!withdraw && !(status === 'done' && canFinish(t)))
      throw new Error(canApprove(t) ? 'Para devolver, use Reprovar e explique o porquê.' : `Essa entrega está esperando a aprovação de ${nameOf(approverOf(t) ?? '')}.`)
  } else if (!canMove(t)) throw new Error('Só quem é responsável (ou um cargo acima) muda a etapa dessa tarefa.')
  const review: Review[] = t.status === 'review' && status === 'done' && canApprove(t) && t.owner_id !== my.id
    ? [{ by: my.id, at: new Date().toISOString(), ok: true, reason: '', failed: [] }] : []
  await putTask({ ...t, status, stage, position, done_at: status === 'done' ? new Date().toISOString() : null, reviews: [...t.reviews, ...review] })
  if (t.owner_id !== my.id) return // XP é de quem faz
  const redo = t.reviews.at(-1)?.ok === false
  const delta = paid(status) && !paid(t.status) ? (redo ? 0 : taskXp(t))
    : !paid(status) && paid(t.status) && !(redo && t.status === 'review') ? -taskXp(t) : 0
  if (!delta) return
  const xp = Math.max(0, my.xp + delta)
  const p = { ...my, xp }
  set({ profiles: { ...state.profiles, [my.id]: p } })
  set({ profiles: { ...state.profiles, [my.id]: await backend.upsertProfile(p) } })
}

/** Passa a tarefa para outra pessoa (mantém a etapa). */
export async function reassign(id: string, to: string, position = Date.now()) {
  const t = state.tasks[id]
  if (!t || t.owner_id === to) return
  if (!canReassign(t, to)) throw new Error(`Você não pode passar tarefas de ${nameOf(t.owner_id)} para ${nameOf(to)}. Peça a um cargo acima.`)
  await putTask({ ...t, owner_id: to, collaborators: t.collaborators.filter(x => x !== to), position })
}

/** Só muda a ordem dentro da lista. */
export async function placeTask(id: string, position: number) {
  const t = state.tasks[id]
  if (!t || t.position === position || !canEditTask(t)) return
  await putTask({ ...t, position })
}

/** Aprovador decide. Reprovar exige justificativa e volta a tarefa para "Fazendo". */
export async function review(id: string, ok: boolean, reason = '', failed: string[] = []) {
  const t = state.tasks[id]
  const my = me()
  if (!t || !my) return
  if (!canApprove(t)) throw new Error(approverOf(t) === CHEFIA ? 'Só um cargo acima do responsável aprova essa entrega.' : 'Só quem aprova essa entrega (ou a Chefe) pode decidir.')
  reason = reason.trim()
  if (!ok && reason.length < 3) throw new Error('Explique por que está reprovando.')
  const r: Review = { by: my.id, at: new Date().toISOString(), ok, reason: reason.slice(0, 1000), failed }
  await putTask({
    ...t, status: ok ? 'done' : 'doing', position: Date.now(), done_at: ok ? r.at : null, reviews: [...t.reviews, r],
  })
}

// ---------- IA do Gerente ----------
/** Gerência, Chefe ou adm */
export const canUseAI = (uid = state.meId) => { const p = uid ? state.profiles[uid] : undefined; return !!p && (rankOf(p) >= 3 || !!p.is_admin) }
export const aiOnline = () => backend.aiOnline()
function aiContext(): AiContext {
  const my = me()!, today = dayKey(new Date())
  const open = Object.values(state.tasks).filter(t => t.status === 'inbox' || t.status === 'todo' || t.status === 'doing' || t.status === 'review')
  return {
    today, me: { id: my.id, name: my.name, rank: rankOf(my) },
    people: Object.values(state.profiles).map(p => {
      const mine = open.filter(t => t.owner_id === p.id)
      return { id: p.id, name: p.name, role: p.role || rankName(p), rank: rankOf(p), open: mine.length, late: mine.filter(t => t.due && t.due < today).length, online: state.online.has(p.id) }
    }),
    projects: Object.values(state.projects).filter(p => !p.archived).map(p => ({ id: p.id, name: p.name, master: nameOf(p.master_id) })),
  }
}
/** Manda o pedido e devolve a proposta limpa (gente e projeto que existem, data válida) */
export async function askAI(prompt: string, onStage: (s: AiStage) => void, signal: AbortSignal): Promise<AiProposal> {
  if (!canUseAI()) throw new Error('A IA de distribuição é da Gerência.')
  const ctx = aiContext()
  const r = await backend.askAI(prompt.trim().slice(0, 4000), ctx, onStage, signal)
  const people = new Set(ctx.people.map(p => p.id)), projs = new Set(ctx.projects.map(p => p.id))
  const items = (Array.isArray(r?.items) ? r.items : []).slice(0, 20).map((i: Partial<AiItem>) => ({
    title: String(i.title ?? '').trim().slice(0, 140),
    owner_id: i.owner_id && people.has(i.owner_id) ? i.owner_id : '',
    due: typeof i.due === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(i.due) ? i.due : null,
    project_id: i.project_id && projs.has(i.project_id) ? i.project_id : null,
    notes: String(i.notes ?? '').slice(0, 2000),
    why: String(i.why ?? '').slice(0, 300),
  })).filter(i => i.title)
  return { summary: String(r?.summary ?? '').slice(0, 600), items }
}
/** Cria as tarefas aprovadas pelo Gerente (cada um recebe o aviso normal) */
export async function distribute(items: AiItem[]) {
  for (const i of items) await addTask(i.owner_id, i.title, i.due, i.notes, 'todo', i.project_id)
}

/** Coloca a tarefa num projeto (ou tira). */
export async function setProject(id: string, project: string | null) {
  const t = state.tasks[id]
  if (!t || t.project_id === project || !canEditTask(t)) return
  await putTask({ ...t, project_id: project })
}

export async function setCriteria(id: string, criteria: string[]) {
  const t = state.tasks[id]
  const c = criteria.map(x => x.trim()).filter(Boolean)
  if (!t || JSON.stringify(c) === JSON.stringify(t.criteria)) return
  await putTask({ ...t, criteria: c })
}

export async function saveProject(d: { id?: string; name: string; master_id: string; criteria: string[]; color: string; archived?: boolean; drive?: Project['drive'] }) {
  const prev = d.id ? state.projects[d.id] : undefined
  if (prev ? !canEditProject(prev) : !canCreateProject()) throw new Error('Sem permissão para mexer nesse projeto.')
  if (!d.name.trim()) throw new Error('Dê um nome ao projeto.')
  const p: Project = {
    id: prev?.id ?? crypto.randomUUID(), created_by: prev?.created_by ?? state.meId!, created_at: prev?.created_at ?? new Date().toISOString(),
    name: d.name.trim().slice(0, 80), master_id: d.master_id, color: d.color, archived: d.archived ?? prev?.archived ?? false,
    criteria: d.criteria.map(x => x.trim()).filter(Boolean).slice(0, 20),
    drive: d.drive !== undefined ? d.drive : prev?.drive ?? null,
  }
  const before = state.projects
  set({ projects: { ...state.projects, [p.id]: p } })
  try { await backend.upsertProject(p) } catch (e) { set({ projects: before }); throw e }
  return p
}

export async function removeProject(id: string) {
  const p = state.projects[id]
  if (!p) return
  if (!(p.created_by === state.meId || isChief(me()))) throw new Error('Só quem criou o projeto (ou a Chefe) apaga.')
  onProjectDeleted(id)
  set({ tasks: Object.fromEntries(Object.entries(state.tasks).map(([k, t]) => [k, t.project_id === id ? { ...t, project_id: null } : t])) })
  await backend.deleteProject(id)
}

export const acceptRequest = (id: string) => setStatus(id, 'todo')
export const declineRequest = (id: string) => setStatus(id, 'declined')

export async function setRank(target: string, rank: number) {
  const p = state.profiles[target]
  if (!p || p.rank === rank) return
  await backend.setRank(target, rank)
  set({ profiles: { ...state.profiles, [target]: { ...p, rank } } })
}

export async function createAccount(user: string, pass: string, name: string, rank: number) {
  const p = await backend.createAccount(user, pass, name, rank)
  set({ profiles: { ...state.profiles, [p.id]: p } })
}

export const setPassword = (target: string, pass: string) => backend.setPassword(target, pass)
export const accountLogins = () => backend.accountLogins()

export async function updateAccount(target: string, a: AccountEdit) {
  const p = state.profiles[target]
  if (!p) return
  await backend.updateAccount(target, a)
  set({ profiles: { ...state.profiles, [target]: { ...p, name: a.name.trim().slice(0, 40), role: a.role.trim().slice(0, 40), rank: a.rank, is_admin: a.is_admin } } })
}

/** tarefas e projetos da pessoa passam para o herdeiro; mensagens e notas dela somem */
export async function deleteAccount(target: string, heir: string) {
  await backend.deleteAccount(target, heir)
  const tasks = { ...state.tasks }
  for (const t of Object.values(tasks)) {
    if (t.owner_id !== target && t.created_by !== target && !t.collaborators.includes(target)) continue
    const owner = t.owner_id === target ? heir : t.owner_id
    tasks[t.id] = { ...t, owner_id: owner, created_by: t.created_by === target ? heir : t.created_by,
      collaborators: t.collaborators.filter(c => c !== target && c !== owner) }
  }
  const projects = { ...state.projects }
  for (const p of Object.values(projects)) if (p.master_id === target || p.created_by === target)
    projects[p.id] = { ...p, master_id: p.master_id === target ? heir : p.master_id, created_by: p.created_by === target ? heir : p.created_by }
  set({ tasks, projects })
  onProfileDeleted(target)
}

export async function renameTask(id: string, title: string) {
  const t = state.tasks[id]
  if (!t || !title.trim() || t.title === title.trim()) return
  await putTask({ ...t, title: title.trim() })
}

export async function removeTask(id: string) {
  const t = state.tasks[id]
  if (!t) return
  if (state.task === id) set({ task: null })
  onTaskDeleted(id)
  await backend.deleteTask(id)
  await Promise.allSettled(t.attachments.map(a => backend.deleteFile(a.path)))
}

type Details = Partial<Pick<Task, 'title' | 'notes' | 'start' | 'due' | 'collaborators' | 'priority' | 'checklist' | 'remind_at' | 'channel' | 'publish_at' | 'drive'>>
export async function updateTask(id: string, patch: Details) {
  const t = state.tasks[id]
  if (!t) return
  if (patch.title !== undefined && !(patch.title = patch.title.trim())) return
  if ((Object.keys(patch) as (keyof Details)[]).every(k => JSON.stringify(t[k]) === JSON.stringify(patch[k]))) return
  await putTask({ ...t, ...patch })
}

/** Sobe os arquivos e anexa à tarefa (relê a tarefa no fim pra não perder anexo de outra pessoa). */
export async function attachFiles(id: string, files: File[]) {
  const added: Attachment[] = []
  for (const f of files) {
    const path = await backend.uploadFile(id, f)
    added.push({ id: crypto.randomUUID(), name: f.name, path, type: f.type, size: f.size, by: state.meId!, at: new Date().toISOString() })
  }
  const t = state.tasks[id]
  if (t && added.length) await putTask({ ...t, attachments: [...t.attachments, ...added] })
}

export async function removeAttachment(id: string, attId: string) {
  const t = state.tasks[id]
  const a = t?.attachments.find(x => x.id === attId)
  if (!t || !a) return
  await putTask({ ...t, attachments: t.attachments.filter(x => x.id !== attId) })
  await backend.deleteFile(a.path).catch(() => { /* arquivo de outra pessoa: some só da lista */ })
}

export const fileUrl = (a: Attachment, download = false) => backend.fileUrl(a.path, download ? a.name : undefined)

export async function addNote(taskId: string, body: string) {
  const text = body.trim()
  if (!text || !state.meId) return
  const n: TaskNote = { id: crypto.randomUUID(), task_id: taskId, author_id: state.meId, body: text.slice(0, 2000), created_at: new Date().toISOString() }
  set({ notes: [...state.notes, n] })
  try { await backend.addNote(n) } catch (e) { onNoteDeleted(n.id); throw e }
}

export async function removeNote(id: string) {
  onNoteDeleted(id)
  await backend.deleteNote(id)
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
