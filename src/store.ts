import { pref } from './prefs'
import { useSyncExternalStore } from 'react'
import { backend } from './data'
import { canAssign, DEPT0, deptOf, isChief, outranks, pontoDaSala, rankName, rankOf } from './game/ranks'
import { chegada, HALL, SLOTS } from './office/andar'
import { dayKey, taskXp } from './game/xp'
import { MAX_DESKS } from './office/base'
import { parseSala } from './office/sala'
import { ITEM, type Slot } from './shop/catalog'
import { REASON } from './shop/economy'
import type { CalEvent, Equipe, ParModulo, Parceria, Poder, Requisicao, Snapshot, Group, RowTable, Rows, Stage, StageKind, Sticker, AccountEdit, AiContext, AiItem, AiProposal, AiStage, Attachment, Avatar, CoffeeLine, Gear, Message, Pos, Profile, Project, Review, Task, TaskNote, TaskStatus, Wallet } from './types'
import { ROW_TABLES } from './types'
import type { Backend } from './types'
import type { JogoCassino, Rodada } from './cassino/regras'
import type { Bolao } from './cassino/bolao'
import type { Bingo } from './cassino/bingo'
import { tipoDe } from './setor/tipos'
import { lerBloqueio, type Bloqueio } from './game/vigia'
import { ateQuando, PODERES } from './game/poderes'

export type Phase = 'loading' | 'auth' | 'creator' | 'office'
export type Tab = 'mesa' | 'aprovar' | 'avisos' | 'equipe' | 'chat' | 'geral'
/** quadro = trabalho do dia a dia (estilo Trello); escritório = visualização em pixel */
export type View = 'quadro' | 'escritorio' | 'agenda' | 'metas' | 'fluxos' | 'inicio' | 'arquivos' | 'loja' | 'vendas' | 'placar' | 'kit' | 'plano' | 'redes' | 'estudio' | 'pedidos' | 'legendas' | `m:${string}`
export interface Go { view?: View; tab?: Tab; viewing?: string; channel?: string; task?: string; cassino?: 'bolao'; bingo?: boolean; abasOpen?: boolean }
export type NoticeKind = 'data' | 'plano' | 'prazo' | 'lembrete' | 'pedido' | 'colab' | 'aprov' | 'msg' | 'adesivo' | 'loja' | 'time'
export interface Notice { id: string; text: string; at: number; from?: string; go?: Go; kind?: NoticeKind }

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
  /** de outros setores que esta sala acompanha (parceria aceita): só leitura, fora do quadro */
  parc: { tasks: Record<string, Task>; events: Record<string, CalEvent> }
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
  /** cafezinhos: saldo, itens e extrato (só o servidor credita) */
  wallet: Wallet | null
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
  /** quadro de quartos aberto em tela cheia (clique na lousa da sala de vendas) */
  lousa: boolean
  /** jogo aberto na sala de jogos */
  jogo: string | null
  /** cassino dos cafezinhos aberto */
  cassino: boolean | JogoCassino | 'bolao'
  /** bolão da semana (pote, meus bilhetes, sorteios) */
  bolao: Bolao | null
  /** salão de bingo aberto */
  bingo: boolean
  /** janela “Abas do setor” */
  abasOpen: boolean
  /** Conectar IA (chaves da ponte de tarefas) */
  conectar: boolean
  armario: boolean
  /** rodada atual/próxima do bingo */
  bingoDados: Bingo | null
  /** vigia dos jogos: jogos, cassino e bingo travados até `ate` */
  bloqueio: Bloqueio | null
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
  /** sala aberta: a minha; a Chefe pode abrir as outras */
  sala: string
  /** onde o meu boneco está: id da sala ou 'andar' (corredor). Visitante não troca o quadro, só a Chefe */
  here: string
}


/** link direto: …/#estudio (ou #pedidos, #agenda…) abre já na página; o app do celular usa #estudio no modo sem o PC */
const VIEWS: View[] = ['quadro', 'escritorio', 'agenda', 'metas', 'fluxos', 'inicio', 'arquivos', 'loja', 'vendas', 'placar', 'kit', 'plano', 'redes', 'estudio', 'pedidos', 'legendas']
function viewDaUrl(): View {
  const h = typeof location === 'undefined' ? '' : location.hash.slice(1)
  return (VIEWS as string[]).includes(h) ? h as View : 'quadro'
}

const initial: State = {
  phase: 'loading', meId: null, accountName: '', error: '', profiles: {}, tasks: {}, messages: [], notes: [], projects: {}, rows: { events: {}, goals: {}, stickers: {}, flows: {}, stages: {}, groups: {}, rooms: {}, carpenters: {}, depts: {}, brand: {}, quartos: {}, vendas: {}, ajustes: {}, metas_venda: {}, vendas_cfg: {}, campanhas: {}, caderno: {}, jogos_pontos: {}, plano_meses: {}, plano_nucleos: {}, plano_acoes: {}, plano_resp: {}, equipes: {}, relatorios: {}, redes: {}, postagens: {}, requisicoes: {}, parcerias: {}, registros: {}, poderes: {} }, parc: { tasks: {}, events: {} }, online: new Set(),
  tab: 'mesa', viewing: null, channel: 'geral', reads: {}, requestTo: null, task: null, editing: false, notices: [], pipOpen: false, view: viewDaUrl(), wallet: null, drawer: false,
  project: '', projectEdit: null, aiOpen: false, chatOpen: false, lousa: false, jogo: null, cassino: false, bolao: null, bingo: false, abasOpen: false, conectar: false, armario: false, bingoDados: null, bloqueio: null, bellOpen: false, qApprove: false, flow: null, sheet: false, stickTo: null, sala: DEPT0, here: DEPT0,
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
/** canais que chegam até mim (grupo: o banco já filtra pelo RLS; quem não é membro não recebe aviso; sala: a minha, a Chefe todas) */
export const isMyChannel = (ch: string, me: string) => ch === 'geral' || ch.startsWith('g:') || (ch.startsWith('dm:') && ch.split(':').includes(me))
  || (ch.startsWith('sala:') && (ch === salaChannel(deptOf(state.profiles[me])) || isChief(state.profiles[me])))
export const salaChannel = (id: string) => 'sala:' + id
export const groupChannel = (id: string) => 'g:' + id
export const groupOf = (ch: string, s: State = state) => (ch.startsWith('g:') ? s.rows.groups[ch.slice(2)] : undefined)
/** faço parte do canal? (geral e conversa: sempre; grupo: só membro) */
export const inChannel = (ch: string, s: State = state) => !ch.startsWith('g:') || !!(s.meId && groupOf(ch, s)?.members.includes(s.meId))
/** posso abrir o canal? (grupo aberto: qualquer um espia antes de entrar) */
export const seesChannel = (ch: string, s: State = state) => { const g = groupOf(ch, s); return !ch.startsWith('g:') || !!g && (g.open || inChannel(ch, s)) }
export const dmPeer = (ch: string, me: string) => ch.split(':').slice(1).find(id => id !== me) ?? me
export const me = () => (state.meId ? state.profiles[state.meId] : undefined)
/** minha sala */
export const myDept = (s: State = state) => deptOf(s.meId ? s.profiles[s.meId] : undefined)
/** salas do andar, na ordem */
export const deptList = (s: Pick<State, 'rows'> = state) => Object.values(s.rows.depts).sort((a, b) => a.floor - b.floor || a.slot - b.slot)
export const deptName = (id: string, s: State = state) => s.rows.depts[id]?.name ?? (id === DEPT0 ? 'Marketing' : id)
/** pessoas da sala aberta (o andar todo fica em `profiles`: conversa, nomes, visitas) */
export const team = (profiles: Record<string, Profile>, s: Pick<State, 'sala'> = state) => Object.values(profiles).filter(p => deptOf(p) === s.sala)
/** layout da sala (o Marketing herda o antigo 'escritorio') */
export const roomOf = (s: Pick<State, 'rows' | 'sala'> = state, sala = s.sala) => s.rows.rooms[sala] ?? (sala === DEPT0 ? s.rows.rooms['escritorio'] : undefined)
/** tabelas que são de uma sala só */
const DEPT_ROWS = new Set<RowTable>(['events', 'goals', 'stages', 'flows'])
/** o que entra no estado: as coisas da sala aberta; na minha sala, também o que é meu em outras (pedido que fiz, colaboração) */
const keepTask = (t: Task) => deptOf(t) === state.sala || (!!state.meId && state.sala === myDept() && involved(t, state.meId))
const keepProject = (p: Project) => deptOf(p) === state.sala || (state.sala === myDept() && (p.master_id === state.meId || p.created_by === state.meId))
const keepRow = (k: RowTable, r: unknown) => !DEPT_ROWS.has(k) || deptOf(r as { dept?: string }) === state.sala
/** a sala aberta (a minha) acompanha o módulo `mod` do setor `dono`? */
export const parceiroDe = (dono: string | undefined, mod: ParModulo, s: State = state) =>
  !!dono && dono !== s.sala && s.sala === myDept(s) && Object.values(s.rows.parcerias).some(p => p.de === s.sala && p.para === dono && p.modulo === mod && p.status === 'aceito')
const keepParcTask = (t: Task) => (!!(t.publish_at || t.due) && parceiroDe(deptOf(t), 'agenda')) || (!!t.channel && parceiroDe(deptOf(t), 'redes'))
const keepParcEvent = (e: CalEvent) => parceiroDe(deptOf(e), 'agenda')
export const nameOf = (id: string) => id === CHEFIA ? 'chefia' : state.profiles[id]?.name ?? 'Alguém'

/** linhas antigas (antes do SQL v3) não têm os campos novos */
const norm = (t: Task): Task => ({
  ...t, start: t.start ?? null, collaborators: t.collaborators ?? [], attachments: t.attachments ?? [],
  project_id: t.project_id ?? null, criteria: t.criteria ?? [], reviews: t.reviews ?? [],
  priority: t.priority ?? null, checklist: t.checklist ?? [], remind_at: t.remind_at ?? null,
  channel: t.channel ?? null, publish_at: t.publish_at ?? null, stage: t.stage ?? null, drive: t.drive ?? null,
})
export const involved = (t: Task, uid: string) => t.owner_id === uid || t.created_by === uid || t.collaborators.includes(uid)
/** a tarefa está com a pessoa: responsável ou colaborando */
export const comigo = (t: Task, uid: string) => t.owner_id === uid || t.collaborators.includes(uid)
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
  return outranks(my, state.profiles[t.owner_id]) && outranks(my, state.profiles[to])
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
  if (!uid || !a || t.estudio) return false // peça do Estúdio: aba Aprovar do Estúdio
  if (a === CHEFIA) return uid !== t.owner_id && outranks(state.profiles[uid], state.profiles[t.owner_id])
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
export const canFinish = (t: Task, uid = state.meId) => !t.estudio && canApprove(t, uid) || (approverOf(t) === CHEFIA && !!uid && t.owner_id === uid)
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
export function clearNotices() { set({ notices: [] }) }

export function notify(text: string, extra: Omit<Notice, 'id' | 'text' | 'at'> = {}) {
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
  if (isNew && p.id !== state.meId) notify(`${p.name} entrou no time!`, { kind: 'time', from: p.id, go: { tab: 'equipe' } })
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
  if (!keepTask(t)) { onTaskDeleted(t.id); return parcTask(t) }
  set({ tasks: { ...state.tasks, [t.id]: t } })
  const my = state.meId
  if (!my) return
  if (!prev && t.owner_id === my && t.created_by !== my) {
    if (t.status === 'inbox') notify(`${nameOf(t.created_by)} te pediu: “${t.title}”`, { kind: 'pedido', from: t.created_by, go: { task: t.id } })
    else notify(`${nameOf(t.created_by)} colocou na sua pasta: “${t.title}”`, { kind: 'pedido', from: t.created_by, go: { task: t.id } })
  }
  if (t.collaborators.includes(my) && !prev?.collaborators.includes(my) && t.owner_id !== my)
    notify(`${nameOf(t.owner_id)} te chamou para colaborar: “${t.title}”`, { kind: 'colab', from: t.owner_id, go: { task: t.id } })
  if (t.created_by === my && t.owner_id !== my && t.status !== prev?.status) {
    const who = nameOf(t.owner_id), go: Go = { task: t.id }
    if (t.status === 'done') notify(`${who} concluiu seu pedido: “${t.title}”`, { kind: 'pedido', from: t.owner_id, go })
    else if (t.status === 'declined') notify(`${who} recusou seu pedido: “${t.title}”`, { kind: 'pedido', from: t.owner_id, go })
    else if (prev?.status === 'inbox' && (t.status === 'todo' || t.status === 'doing')) notify(`${who} aceitou seu pedido: “${t.title}”`, { kind: 'pedido', from: t.owner_id, go })
  }
  // entrega aprovada/concluída: avisa os setores marcados (menos quem fez)
  if (prev && prev.status !== 'done' && t.status === 'done' && t.owner_id !== my && (t.avisar ?? []).some(id => state.rows.equipes[id]?.pessoas.includes(my)))
    notify(`Pronto pra usar: ${nameOf(t.owner_id)} entregou “${t.title}”`, { kind: 'pedido', from: t.owner_id, go: { task: t.id } })
  if (prev && prev.owner_id !== my && t.owner_id === my) notify(`Uma tarefa passou para você: “${t.title}”`, { kind: 'pedido', go: { task: t.id } })
  if (prev && prev.status !== 'review' && t.status === 'review' && (approverOf(t) === my || (approverOf(t) === CHEFIA && canApprove(t, my))) && t.owner_id !== my)
    notify(`${nameOf(t.owner_id)} enviou para aprovação: “${t.title}”`, { kind: 'aprov', from: t.owner_id, go: { tab: 'aprovar' } })
  // decisão nova: avisa o time do projeto (menos quem decidiu)
  const r = t.reviews.at(-1)
  if (prev && r && t.reviews.length > prev.reviews.length && r.by !== my && t.project_id && (teamOf(t.project_id).has(my) || involved(t, my))) {
    const proj = state.projects[t.project_id]?.name ?? 'projeto'
    const dono = t.owner_id === my ? 'Sua entrega' : `A entrega de ${nameOf(t.owner_id)}`
    notify(r.ok ? `${dono} foi aprovada por ${nameOf(r.by)}: “${t.title}” (${proj})`
      : `${dono} foi reprovada por ${nameOf(r.by)}: “${t.title}” (${proj}) — ${r.reason.slice(0, 90)}`, { kind: 'aprov', from: r.by, go: { task: t.id } })
  }
}

function onRow<K extends RowTable>(k: K, r: Rows[K]) {
  const prev = state.rows[k][r.id]
  if (k === 'events') parcEvent(r as CalEvent)
  if (!keepRow(k, r)) { if (prev) onRowDeleted(k, r.id); return }
  set({ rows: { ...state.rows, [k]: { ...state.rows[k], [r.id]: r } } })
  if (k === 'parcerias') mudouParceria(r as Parceria, prev as Parceria | undefined)
  if (k === 'requisicoes') avisoReq(r as Requisicao, prev as Requisicao | undefined)
  if (k === 'poderes' && !prev && (r as Poder).user_id === state.meId && Date.parse((r as Poder).fim) > Date.now()) {
    const po = PODERES[(r as Poder).tipo]
    notify(`${po.emoji} Você ganhou o poder ${po.nome}: ${po.desc}, até ${ateQuando((r as Poder).fim)}.`, { kind: 'loja' })
  }
  if (k === 'stickers' && !prev) {
    const st = r as Sticker
    if (st.to_id === state.meId && st.by_id !== state.meId) notify(`${nameOf(st.by_id)} colou um adesivo na sua tela: “${st.text}”`, { kind: 'adesivo', from: st.by_id })
  }
}

/** pedidos ao gerente: gerente vê o novo, o setor vê a lista coletiva, quem pediu vê a decisão */
function avisoReq(r: Requisicao, prev: Requisicao | undefined) {
  const my = state.meId
  if (!my || state.phase !== 'office') return
  const go: Go = { view: 'pedidos' }
  const eu = state.profiles[my]
  const gere = !!eu && ((!!eu.is_admin && pref('dev')) || rankOf(eu) === 4 || (rankOf(eu) >= 3 && deptOf(eu) === r.dept))
  if (!prev) {
    if (r.por === my) return
    if (gere) notify(`${nameOf(r.por)} fez um pedido: “${r.titulo}”`, { kind: 'pedido', from: r.por, go })
    else if (r.coletivo && deptOf(eu) === r.dept) notify(`Lista aberta: “${r.titulo}” — ponha o que você precisa`, { kind: 'pedido', from: r.por, go })
    return
  }
  if (prev.status === r.status) return
  const quem = r.historico.at(-1)?.por
  if (quem === my) return
  const txt = { aberto: 'foi reaberto', aprovado: 'foi aprovado', recusado: 'foi recusado', entregue: r.tipo === 'folga' ? 'foi concluído' : 'foi entregue', cancelado: 'foi cancelado' }[r.status]
  if (r.por === my) notify(`Seu pedido “${r.titulo}” ${txt}${r.motivo ? ` — ${r.motivo.slice(0, 90)}` : ''}`, { kind: 'pedido', from: quem, go })
  else if (r.coletivo && r.itens.some(i => i.por === my)) notify(`A lista “${r.titulo}” ${txt}`, { kind: 'pedido', from: quem, go })
  else if (gere && r.status === 'cancelado') notify(`${nameOf(r.por)} cancelou o pedido “${r.titulo}”`, { kind: 'pedido', from: r.por, go })
}

export async function novaReq(r: Requisicao) { await putRow('requisicoes', r) }
export async function mudarReq(id: string, acao: 'editar' | 'itens' | 'apoio' | 'status', p: Record<string, unknown> = {}) {
  const r = await backend.requisicaoMudar(id, acao, p)
  if (r) onRow('requisicoes', r)
}

function parcEvent(e: CalEvent | null, id = e?.id ?? '') {
  const has = !!state.parc.events[id], keep = !!e && keepParcEvent(e) && !keepRow('events', e)
  if (!has && !keep) return
  const events = { ...state.parc.events }
  if (keep && e) events[id] = e
  else delete events[id]
  set({ parc: { ...state.parc, events } })
}

/** parceria nova/decidida: avisa o outro lado; aceita/encerrada na minha sala → recarrega (o banco passa a mostrar/esconder) */
function mudouParceria(p: Parceria, prev: Parceria | undefined) {
  const my = state.meId
  if (!my || state.phase !== 'office') return
  const eu = state.profiles[my]
  const gere = (d: string) => !!eu && (!!eu.is_admin || rankOf(eu) === 4 || (rankOf(eu) >= 3 && deptOf(eu) === d))
  const mod = PAR_NOME[p.modulo]
  if (p.status === 'pendente' && prev?.status !== 'pendente' && p.por !== my && gere(p.para)) notify(`${deptName(p.de)} pediu pra acompanhar ${mod} da sua sala`, { kind: 'pedido', go: { abasOpen: true } })
  if (prev && prev.status !== p.status && p.status !== 'pendente' && p.decidido_por !== my && gere(p.de))
    notify(p.status === 'aceito' ? `${deptName(p.para)} aceitou: agora vocês acompanham ${mod} deles` : `${deptName(p.para)} recusou o pedido de acompanhar ${mod}`, { kind: 'pedido', go: { abasOpen: true } })
  if (p.de === state.sala && p.status === 'aceito' && prev?.status !== 'aceito') recarregar()
}
const recarregar = () => run(backend.loadAll().then(ingest))
export const PAR_NOME: Record<ParModulo, string> = { agenda: 'a Agenda', plano: 'o Plano', redes: 'as Publicações' }

function onRowDeleted(k: RowTable, id: string) {
  if (k === 'events') parcEvent(null, id)
  if (k === 'parcerias') { const p = state.rows.parcerias[id]; if (p?.de === state.sala && p.status === 'aceito') setTimeout(recarregar) }
  const next = { ...state.rows[k] }
  delete next[id]
  set({ rows: { ...state.rows, [k]: next } })
}

/** grava e já mostra (o realtime confirma depois) */
export async function putRow<K extends RowTable>(k: K, r: Rows[K]) {
  if (DEPT_ROWS.has(k) && !(r as { dept?: string }).dept) r = { ...r, dept: state.sala }
  onRow(k, r)
  await backend.upsertRow(k, r)
}

/** várias de uma vez (importação): mostra tudo e grava em lotes */
export async function putRows<K extends RowTable>(k: K, rs: Rows[K][]) {
  if (!rs.length) return
  set({ rows: { ...state.rows, [k]: { ...state.rows[k], ...Object.fromEntries(rs.map(r => [r.id, r])) } } })
  await backend.upsertRows(k, rs)
}

export async function dropRow(k: RowTable, id: string) {
  onRowDeleted(k, id)
  await backend.deleteRow(k, id)
}

function onProject(p: Project) {
  const prev = state.projects[p.id]
  if (!keepProject(p)) return onProjectDeleted(p.id)
  set({ projects: { ...state.projects, [p.id]: { ...p, criteria: p.criteria ?? [] } } })
  const my = state.meId
  if (my && p.master_id === my && prev?.master_id !== my && p.created_by !== my)
    notify(`Você é o mestre do projeto “${p.name}”`, { kind: 'aprov', from: p.created_by, go: { tab: 'aprovar' } })
}

function onProjectDeleted(id: string) {
  if (!state.projects[id]) return
  const projects = { ...state.projects }
  delete projects[id]
  set({ projects, project: state.project === id ? '' : state.project })
}

/** tarefa de um setor parceiro: entra só na agenda/publicações, nunca no quadro */
function parcTask(t: Task | null, id = t?.id ?? '') {
  const has = !!state.parc.tasks[id], keep = !!t && keepParcTask(t)
  if (!has && !keep) return
  const tasks = { ...state.parc.tasks }
  if (keep && t) tasks[id] = t
  else delete tasks[id]
  set({ parc: { ...state.parc, tasks } })
}

function onTaskDeleted(id: string) {
  parcTask(null, id)
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
  notify(`${nameOf(n.author_id)} comentou em “${t.title}”: ${n.body.slice(0, 80)}`, { kind: 'msg', from: n.author_id, go: { task: t.id } })
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
  notify(`${nameOf(m.sender_id)}${where}: ${m.body.slice(0, 90)}`, { kind: 'msg', from: m.sender_id, go: { tab: 'chat', channel: m.channel } })
}

// ---------- ações ----------
let booted = false
let disconnect: (() => void) | null = null

// ---------- lembretes ----------
let remindTimer = 0
let coffeeTimer = 0
/** verificações extras que rodam junto com os lembretes (ver avisos.ts) */
export const checagens: (() => void)[] = []
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
    notify(`Lembrete: “${t.title}”`, { kind: 'lembrete', go: { task: t.id } })
  }
  if (changed) try { localStorage.setItem(key, JSON.stringify(seen)) } catch { /* sem espaço */ }
  for (const c of checagens) try { c() } catch { /* aviso não pode derrubar o app */ }
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
    meId: uid, accountName, error: '', reads, sala: deptOf(mine), here: deptOf(mine),
    profiles: Object.fromEntries(snap.profiles.map(p => [p.id, p])),
    notes: snap.notes,
    phase: mine?.avatar ? 'office' : 'creator',
    viewing: uid,
  })
  ingest(snap)
  set({ messages: snap.messages.filter(m => isMyChannel(m.channel, uid)) })
  clearInterval(remindTimer)
  clearInterval(coffeeTimer)
  clearInterval(bingoTimer)
  void claim().then(() => checarBolao()).then(() => checarBingo()).then(() => checarPoderes())
  coffeeTimer = window.setInterval(() => { void claim(); void checarPoderes() }, 10 * 60000)
  // bingo: devagar no fundo (placar da sala, aviso de prêmio); a janela aberta acelera
  bingoTimer = window.setInterval(() => { if (!state.bingo && document.visibilityState === 'visible') void checarBingo() }, 60000)
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

/** tarefas, projetos e linhas da sala aberta */
function ingest(snap: Snapshot) {
  const tasks = snap.tasks.map(norm)
  set({
    tasks: Object.fromEntries(tasks.filter(keepTask).map(t => [t.id, t])),
    projects: Object.fromEntries((snap.projects ?? []).filter(keepProject).map(p => [p.id, { ...p, criteria: p.criteria ?? [] }])),
    rows: {
      ...(Object.fromEntries(ROW_TABLES.map(k => [k, Object.fromEntries((snap.rows?.[k] ?? []).filter(r => keepRow(k, r)).map(r => [r.id, r]))])) as State['rows']),
    },
  })
  // depois das parcerias no estado
  set({ parc: {
    tasks: Object.fromEntries(tasks.filter(t => !keepTask(t) && keepParcTask(t)).map(t => [t.id, t])),
    events: Object.fromEntries((snap.rows?.events ?? []).filter(e => !keepRow('events', e) && keepParcEvent(e)).map(e => [e.id, e])),
  } })
}

/** abre o andar de outro setor: a Chefe entra em qualquer um (leva o quadro junto); os outros visitam se a porta estiver aberta.
 *  Pelo elevador chega no corredor, na frente dele. */
export async function openSala(id: string, elevador = false) {
  if (id === state.sala || (id !== myDept() && !canEnter(id))) return
  const snap = await backend.loadAll()
  if (elevador) chegada.elevador = true
  set({ sala: id, here: elevador ? HALL : id, project: '', task: null, flow: null, viewing: state.meId })
  ingest(snap)
}

/** sala no lugar `slot` do andar */
export const slotDept = (slot: number, s: State = state) => Object.values(s.rows.depts).find(d => d.floor === 1 && d.slot === slot)
export const doorOpen = (id: string, s: State = state) => s.rows.depts[id]?.door_open !== false
export const curtainsOpen = (id: string, s: State = state) => s.rows.depts[id]?.curtains_open !== false
/** abre/fecha a porta: gerente da sala, a Chefe ou o adm */
export const canDoor = (id: string, s: State = state) => {
  const p = s.meId ? s.profiles[s.meId] : undefined
  return !!p && !!s.rows.depts[id] && (!!p.is_admin || isChief(p) || (rankOf(p) >= 3 && deptOf(p) === id))
}
/** entra: sala montada e porta aberta (a própria sala e a Chefe entram sempre) */
export const canEnter = (id: string, s: State = state) => {
  const p = s.meId ? s.profiles[s.meId] : undefined
  return !!s.rows.depts[id] && (doorOpen(id, s) || deptOf(p) === id || isChief(p))
}
export async function setDoor(id: string, open: boolean) {
  const d = state.rows.depts[id]
  if (!d || doorOpen(id) === open) return
  onRow('depts', { ...d, door_open: open })
  try { await backend.setDoor(id, open) } catch (e) { onRow('depts', d); throw e }
}
/** cortina do vidro: fechada, quem está fora não vê o que acontece na sala */
export async function setCurtains(id: string, open: boolean) {
  const d = state.rows.depts[id]
  if (!d || curtainsOpen(id) === open) return
  onRow('depts', { ...d, curtains_open: open })
  try { await backend.setCurtains(id, open) } catch (e) { onRow('depts', d); throw e }
}
/** sala só do gerente no andar (a mesa dele sai da sala do setor) */
export async function setSalaGerente(id: string, on: boolean) {
  const d = state.rows.depts[id]
  if (!d || !!d.sala_gerente === on) return
  onRow('depts', { ...d, sala_gerente: on })
  try { await backend.setSalaGerente(id, on) } catch (e) { onRow('depts', d); throw e }
}
/** agenda do plano: muda o dia/a pessoa da ação (volta se o servidor recusar) */
export async function planoAgendar(id: string, data: string | null, dono: string | null) {
  const a = state.rows.plano_acoes[id]
  if (!a) return
  onRow('plano_acoes', { ...a, data, dono })
  try { await backend.planoAgendar(id, data, dono) } catch (e) { onRow('plano_acoes', a); throw e }
}
export async function planoReservar(id: string, tarefa: string) {
  const a = state.rows.plano_acoes[id]
  if (!a || a.tarefas.length) return false
  onRow('plano_acoes', { ...a, tarefas: [tarefa] })
  try {
    const ok = await backend.planoReservar(id, tarefa)
    if (!ok && state.rows.plano_acoes[id]?.tarefas[0] === tarefa) onRow('plano_acoes', a)
    return ok
  } catch (e) { onRow('plano_acoes', a); throw e }
}
export async function planoSoltar(id: string, tarefa: string) {
  const a = state.rows.plano_acoes[id]
  if (a) onRow('plano_acoes', { ...a, tarefas: a.tarefas.filter(t => t !== tarefa) })
  await backend.planoSoltar(id, tarefa)
}
/** a sala trabalha com publicação? (posts, canais). Marketing antigo sem a coluna conta como sim */
export const hasCanais = (id: string = state.sala, s: State = state) => s.rows.depts[id]?.canais ?? id === DEPT0
/** bandeira da porta (ícone Phosphor) e se a sala publica: mesma regra da porta */
/** abas que a sala escolhe (início, quadro e escritório ficam sempre) */
export const ABAS: [string, string][] = [['agenda', 'Agenda'], ['plano', 'Plano'], ['redes', 'Publicações'], ['arquivos', 'Arquivos'], ['pedidos', 'Pedidos'], ['legendas', 'Legendas']]
/** padrão = o do tipo do setor (marcado ou deduzido pelo nome) */
export const abasPadrao = (id: string, s: Pick<State, 'rows'> = state) => tipoDe(s.rows.depts[id] ?? { id, name: id }).abas
/** abas ligadas da sala; parceria aceita liga o módulo mesmo se a sala não usa o seu */
export function abasDe(id: string = state.sala, s: State = state) {
  const out = new Set(s.rows.depts[id]?.abas ?? abasPadrao(id, s))
  for (const p of Object.values(s.rows.parcerias)) if (p.de === id && p.status === 'aceito') out.add(p.modulo)
  return out
}
export async function setDeptAbas(id: string, abas: string[] | null) {
  const d = state.rows.depts[id]
  if (!d) return
  onRow('depts', { ...d, abas })
  try { await backend.setDeptAbas(id, abas) } catch (e) { onRow('depts', d); throw e }
}
/** troca o tipo do setor (Reservas, Obras…): as abas voltam ao padrão do tipo */
export async function setDeptTipo(id: string, tipo: string | null) {
  const d = state.rows.depts[id]
  if (!d) return
  onRow('depts', { ...d, tipo, abas: null })
  try { await backend.setDeptTipo(id, tipo) } catch (e) { onRow('depts', d); throw e }
}
export async function parceria(de: string, para: string, modulo: ParModulo, acao: 'pedir' | 'aceitar' | 'recusar' | 'sair') {
  const r = await backend.parceria(de, para, modulo, acao)
  // aplica já (o realtime confirma depois; o demo não ecoa na mesma aba)
  if (r) onRow('parcerias', r)
  else { const p = Object.values(state.rows.parcerias).find(x => x.de === de && x.para === para && x.modulo === modulo); if (p) onRowDeleted('parcerias', p.id) }
}
/** a sala trabalha com vendas (quadro de quartos, placar) */
export const hasVendas = (id?: string, s: State = state) => !!s.rows.depts[id ?? myDept(s)]?.vendas
export async function setDeptLook(id: string, look: { flag?: string | null; canais?: boolean; vendas?: boolean }) {
  const d = state.rows.depts[id]
  if (!d) return
  const flag = look.flag !== undefined ? look.flag : d.flag ?? null
  const canais = look.canais ?? hasCanais(id)
  const vendas = look.vendas ?? !!d.vendas
  onRow('depts', { ...d, flag, canais, vendas })
  try { await backend.setDeptLook(id, flag, canais, vendas) } catch (e) { onRow('depts', d); throw e }
}
/** o boneco passou por uma porta. A Chefe leva o quadro junto; quem visita só vê a sala */
export function goTo(where: string) {
  if (where === state.here) return
  set({ here: where })
  if (where !== HALL && where !== state.sala && isChief(me())) run(openSala(where))
}
/** bate na porta fechada: avisa o gerente da sala (sem gerente, a Chefe) */
export async function knock(id: string) {
  const g = pontoDaSala(state.profiles, id, state.meId)
  if (!g || !state.meId || g.id === state.meId) throw new Error('Essa sala ainda não tem quem atenda a porta.')
  await send(dmChannel(state.meId, g.id), `🚪 Toc, toc! Estou na porta da sala ${deptName(id)}.`)
}

export async function signOut() {
  clearInterval(remindTimer)
  clearInterval(coffeeTimer)
  disconnect?.()
  disconnect = null
  await backend.signOut()
  positions.clear()
  set({ ...initial, phase: 'auth' })
}

export function setUi(p: Partial<Pick<State, 'tab' | 'viewing' | 'channel' | 'requestTo' | 'editing' | 'pipOpen' | 'error' | 'task' | 'view' | 'drawer' | 'project' | 'projectEdit' | 'aiOpen' | 'chatOpen' | 'lousa' | 'jogo' | 'cassino' | 'bingo' | 'abasOpen' | 'conectar' | 'armario' | 'bellOpen' | 'qApprove' | 'flow' | 'sheet' | 'stickTo'>>) {
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
  if (desk < 0) desk = freeDesk(myDept(), uid)
  if (desk < 0) desk = Object.keys(state.profiles).length % MAX_DESKS
  const p: Profile = {
    id: uid, xp: prev?.xp ?? 0, desk, rank: prev?.rank ?? 1, created_at: prev?.created_at ?? new Date().toISOString(), dept: prev?.dept,
    name: d.name.trim() || state.accountName || 'Sem nome', role: d.role.trim(), avatar: d.avatar, photo: d.photo,
  }
  const saved = await backend.upsertProfile(p)
  set({ profiles: { ...state.profiles, [uid]: saved }, phase: 'office', editing: false })
}

/** primeira mesa livre na sala `sala` (sala sem layout salvo = a sala original) */
export function freeDesk(sala: string, uid?: string) {
  const room = roomOf(state, sala)
  const taken = new Set(Object.values(state.profiles).filter(p => p.id !== uid && deptOf(p) === sala).map(p => p.desk))
  const free = parseSala(room?.data).objs.filter(o => o.k === 'mesa' && o.d !== undefined).map(o => o.d!).sort((a, b) => a - b)
  return free.find(i => !taken.has(i)) ?? free[taken.size % Math.max(1, free.length)] ?? -1
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
export async function addTask(owner: string, title: string, due: string | null = null, notes = '', status: TaskStatus = 'todo', project: string | null = null, extra: Pick<Partial<Task>, 'id' | 'priority' | 'remind_at' | 'due_time' | 'channel' | 'publish_at' | 'notes' | 'stage' | 'drive' | 'start' | 'collaborators' | 'equipe' | 'avisar'> = {}) {
  const direct = canAssign(me(), state.profiles[owner])
  if (status === 'review' || status === 'done') status = 'todo' // entrega passa pela etapa certa
  const t: Task = {
    id: extra.id ?? crypto.randomUUID(), owner_id: owner, created_by: state.meId!, title: title.trim(), notes, status: direct && status !== 'inbox' ? status : 'inbox',
    start: extra.start ?? null, due, due_time: (due && extra.due_time) || null, collaborators: (extra.collaborators ?? []).filter(c => c !== owner), attachments: [], position: Date.now(), created_at: new Date().toISOString(),
    done_at: null, project_id: project || null, criteria: [], reviews: [],
    priority: extra.priority ?? null, checklist: [], remind_at: extra.remind_at ?? null,
    channel: extra.channel ?? null, publish_at: extra.publish_at ?? null, stage: extra.stage ?? null, drive: extra.drive ?? null,
    dept: deptOf(state.profiles[owner]),
    ...(extra.equipe ? { equipe: extra.equipe, status: 'inbox' as const } : {}),
    ...(extra.avisar?.length ? { avisar: extra.avisar } : {}),
  }
  await putTask(t)
  return t
}

// ---------- funil do setor ----------
/** quem recebe os pedidos da equipe: gestor que é da equipe; senão gerência da sala dela; senão a Chefe */
export function gestorDe(e: Equipe | undefined, profiles = state.profiles): string | null {
  if (!e) return null
  const sala = e.dept ?? state.sala
  const ps = Object.values(profiles).sort((a, b) => rankOf(b) - rankOf(a) || a.name.localeCompare(b.name))
  return (ps.find(p => e.pessoas.includes(p.id) && rankOf(p) >= 3)
    ?? ps.find(p => deptOf(p) === sala && rankOf(p) === 3)
    ?? ps.find(p => rankOf(p) === 4)
    ?? ps.find(p => e.pessoas.includes(p.id)))?.id ?? null
}
/** pedido que ainda está no funil do setor */
export const noFunil = (t: Task) => !!t.equipe && t.status === 'inbox'
export const podeRepassar = (t: Task, uid = state.meId) => {
  const my = uid ? state.profiles[uid] : undefined
  return noFunil(t) && !!my && (t.owner_id === my.id || outranks(my, state.profiles[t.owner_id]))
}
/** alguém da equipe pega o pedido do funil para si */
export const podePegar = (t: Task, uid = state.meId) => noFunil(t) && !!uid && t.owner_id !== uid && !!state.rows.equipes[t.equipe!]?.pessoas.includes(uid)
export async function pegar(id: string) {
  const t = state.tasks[id], me = state.meId
  if (!t || !me || !(podePegar(t) || (noFunil(t) && t.owner_id === me))) throw new Error('Esse pedido não está no funil da sua equipe.')
  await putTask({ ...t, owner_id: me, status: 'todo', stage: null, collaborators: t.collaborators.filter(x => x !== me), position: Date.now() })
}
/** gestor tira do funil e passa para alguém (já entra em A fazer) */
export async function repassar(id: string, to: string) {
  const t = state.tasks[id]
  if (!t || !podeRepassar(t)) throw new Error('Só quem gerencia o setor passa esse pedido.')
  await putTask({ ...t, owner_id: to, status: 'todo', stage: null, collaborators: t.collaborators.filter(x => x !== to), position: Date.now() })
}
export async function setAvisar(id: string, avisar: string[]) {
  const t = state.tasks[id]
  if (!t) return
  await putTask({ ...t, avisar })
}

/** XP conta ao entregar (aprovação ou feito). Reenvio depois de reprovar não paga de novo. */
const paid = (s: TaskStatus) => s === 'done' || s === 'review'

/** Etapas do quadro: as padrão até alguém da coordenação mexer; depois, as gravadas. */
export const DEFAULT_STAGES: Stage[] = [
  { id: 'todo', label: 'A fazer', kind: 'todo', pos: 1, created_by: '', created_at: '' },
  { id: 'doing', label: 'Em andamento', kind: 'doing', pos: 2, created_by: '', created_at: '' },
  { id: 'review', label: 'Aprovação', kind: 'review', pos: 3, created_by: '', created_at: '' },
  { id: 'reprovado', label: 'Reprovado', kind: 'doing', pos: 4, created_by: '', created_at: '' },
  { id: 'aprovado', label: 'Aprovado', kind: 'done', pos: 5, created_by: '', created_at: '' },
  { id: 'done', label: 'Concluído', kind: 'done', pos: 6, created_by: '', created_at: '' },
]
/** etapa pelo nome (Reprovado/Aprovado): é para onde a decisão do aprovador manda a tarefa */
const etapaPorNome = (nome: string, kind: StageKind) => stageList().find(x => x.kind === kind && x.label.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase() === nome)?.id ?? null
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
  // o id da etapa é único no banco: as padrão das outras salas ganham o prefixo da sala
  const def = state.sala === DEPT0 ? DEFAULT_STAGES : DEFAULT_STAGES.map(x => ({ ...x, id: `${state.sala}-${x.id}` }))
  return (l.length ? l : def).slice().sort((a, b) => a.pos - b.pos)
}
/** coluna da tarefa: a etapa dela, se ainda existir e for do mesmo tipo; senão a primeira do tipo */
export function stageOf(t: Task, list = stageList()): string | null {
  const s = t.stage ? list.find(x => x.id === t.stage) : undefined
  if (s && s.kind === t.status) return s.id
  return (list.find(x => x.id === t.status || x.id.endsWith('-' + t.status)) ?? list.find(x => x.kind === t.status))?.id ?? null
}
export const canEditStages = (p = me()) => rankOf(p) >= 2
/** grava a lista inteira (a primeira edição tira as etapas padrão do papel) */
export async function saveStages(next: Stage[]) {
  const now = new Date().toISOString()
  const had = state.rows.stages
  for (const [i, s] of next.entries()) {
    const r: Stage = { ...s, pos: i + 1, created_by: s.created_by || state.meId!, created_at: s.created_at || now }
    const old = had[r.id]
    if (!old || old.label !== r.label || old.kind !== r.kind || old.pos !== r.pos || JSON.stringify(old.criteria ?? []) !== JSON.stringify(r.criteria ?? [])) await putRow('stages', r)
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
  if (review.length && !stage) stage = etapaPorNome('aprovado', 'done')
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
    ...t, status: ok ? 'done' : 'doing', stage: ok ? etapaPorNome('aprovado', 'done') : etapaPorNome('reprovado', 'doing'),
    position: Date.now(), done_at: ok ? r.at : null, reviews: [...t.reviews, r],
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
    people: team(state.profiles).map(p => {
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
    dept: prev?.dept ?? state.sala,
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

/** aceitou o pedido: entra no A fazer de quem aceitou */
export const acceptRequest = (id: string) => setStatus(id, 'todo')
export const declineRequest = (id: string) => setStatus(id, 'declined')

export async function setRank(target: string, rank: number) {
  const p = state.profiles[target]
  if (!p || p.rank === rank) return
  await backend.setRank(target, rank)
  set({ profiles: { ...state.profiles, [target]: { ...p, rank } } })
}

/** muda a pessoa de sala (vai pra primeira mesa livre de lá; as tarefas abertas vão junto) */
export async function setDept(target: string, dept: string) {
  const p = state.profiles[target]
  if (!p || deptOf(p) === dept) return
  const desk = freeDesk(dept, target)
  await backend.setDept(target, dept, desk)
  set({ profiles: { ...state.profiles, [target]: { ...p, dept, desk } } })
  ingest(await backend.loadAll())
}

/** cria ou renomeia uma sala (o id não muda depois de criado) */
export async function saveDept(d: { id?: string; name: string; color: string; slot?: number }) {
  const prev = d.id ? state.rows.depts[d.id] : undefined
  const name = d.name.trim().slice(0, 40)
  if (!name) return
  let id = prev?.id
  if (!id) {
    const base = name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'sala'
    id = base.length < 2 ? base + '-1' : base
    for (let i = 2; state.rows.depts[id]; i++) id = `${base}-${i}`
  }
  const used = new Set(Object.values(state.rows.depts).filter(x => x.floor === 1).map(x => x.slot))
  let slot = prev?.slot ?? d.slot ?? 0
  if (!prev && d.slot === undefined) while (used.has(slot)) slot++
  if (!prev && used.has(slot)) throw new Error('Esse lugar do andar já tem sala.')
  if (slot >= SLOTS) throw new Error(`O andar já está cheio (${SLOTS} salas).`)
  await putRow('depts', { id, name, color: d.color, floor: prev?.floor ?? 1, slot, created_at: prev?.created_at ?? new Date().toISOString() })
}

export async function createAccount(user: string, pass: string, name: string, rank: number, dept?: string) {
  const p = await backend.createAccount(user, pass, name, rank, dept)
  set({ profiles: { ...state.profiles, [p.id]: p } })
  return p
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

type Details = Partial<Pick<Task, 'title' | 'notes' | 'start' | 'due' | 'due_time' | 'collaborators' | 'priority' | 'checklist' | 'remind_at' | 'channel' | 'publish_at' | 'drive'>>
export async function updateTask(id: string, patch: Details) {
  const t = state.tasks[id]
  if (!t) return
  if (patch.title !== undefined && !(patch.title = patch.title.trim())) return
  if (patch.due === null) patch.due_time = null // sem dia, sem hora
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

// ---------- cafezinhos ----------
export async function refreshWallet() {
  try { set({ wallet: await backend.wallet() }) } catch { /* sem carteira por ora */ }
}

function coffeeText(l: CoffeeLine) {
  if (l.reason === 'boasvindas') return `🎁 +${l.amount} cafezinhos de boas-vindas! Já dá pra comprar algo no Almoxarifado.`
  if (l.reason === 'dia') return `☕ +${l.amount} cafezinhos — bom dia! Você bateu o ponto.`
  const g = state.rows.goals[l.ref.split(':')[1]]
  if (l.reason === 'meta') return `🎯 Meta batida${g ? `: “${g.title}”` : ''}! +${l.amount} cafezinhos.`
  return `🎯 ${REASON.fase}${g ? ` “${g.title}”` : ''} alcançada! +${l.amount} cafezinhos.`
}

/** pede ao servidor o que falta creditar (dia, boas-vindas, fases) e avisa o que entrou */
async function claim() {
  if (!state.meId) return
  try {
    const got = await backend.claimCoffee()
    for (const l of got.slice().reverse()) notify(coffeeText(l), { kind: 'loja', go: { view: 'loja' } })
  } catch { /* tenta de novo no próximo ciclo */ }
  await refreshWallet()
}

/** compra no servidor; quem confere o saldo e o preço é ele */
export async function buyItem(id: string) {
  await backend.buyItem(id)
  await refreshWallet()
}

// ---------- bolão ----------
let bolaoTimer = 0
const VISTO = 'ev:bolao:visto'
const lsGet = (k: string) => { try { return localStorage.getItem(k) ?? '' } catch { return '' } }
const lsSet = (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* sem storage */ } }
export const primeiroNome = (id: string | null) => !id ? 'Ninguém' : id === state.meId ? 'Você' : state.profiles[id]?.name.split(' ')[0] ?? 'Alguém'

function pegaBolao(b: Bolao) {
  set({ bolao: b })
  if (state.wallet) set({ wallet: { ...state.wallet, latinhas: b.latinhas } })
}

/** busca o bolão (o servidor sorteia se a sexta 17h passou) e anuncia o sorteio que a pessoa ainda não viu */
export async function checarBolao() {
  if (!state.meId) return
  try {
    const b = await backend.bolaoEstado()
    pegaBolao(b)
    const u = b.historico[0]
    if (u && lsGet(VISTO) !== u.fim) {
      lsSet(VISTO, u.fim)
      notify(u.vencedor
        ? `🍀 ${primeiroNome(u.vencedor)} ganhou o bolão: ${u.pote} cafezinhos + ${u.latinhas} latinhas ⚡`
        : `🍀 Ninguém concorreu ao bolão; os ${u.pote} cafezinhos acumularam pra esta semana.`, { kind: 'loja', go: { cassino: 'bolao' } })
      if (u.vencedor === state.meId) await refreshWallet()
    }
    clearTimeout(bolaoTimer)
    const ms = Date.parse(b.fim) - Date.now() + 5000
    if (ms < 2 ** 31 - 1) bolaoTimer = window.setTimeout(() => void checarBolao(), ms)
  } catch { /* tenta de novo quando abrir o bolão */ }
}

// ---------- bingo ----------
let bingoTimer = 0
const BINGO_VISTO = 'ev:bingo:visto'
function pegaBingo(b: Bingo) {
  set({ bingoDados: b })
  if (state.wallet) set({ wallet: { ...state.wallet, latinhas: b.latinhas } })
  const u = b.historico[0]
  if (!u || lsGet(BINGO_VISTO) >= u.inicio) return
  const primeira = !lsGet(BINGO_VISTO)
  lsSet(BINGO_VISTO, u.inicio)
  const me = state.meId, cheia = u.cheia.find(w => w.u === me), linha = u.linha.find(w => w.u === me)
  if (primeira || (!cheia && !linha)) return
  notify(cheia ? `🎉 BINGO! Você fez cartela cheia: ☕ ${cheia.premio} + 1 latinha ⚡${u.itens[me!] ? ' + item exclusivo' : ''}`
    : `🎱 Você fechou uma linha no bingo: ☕ ${linha!.premio}`, { kind: 'loja', go: { bingo: true } })
  void refreshWallet()
}
export async function checarBingo() {
  if (!state.meId) return
  try { pegaBingo(await backend.bingoEstado()) } catch { /* tenta no próximo giro */ }
}
export async function comprarCartela(gratis: boolean) {
  pegaBingo(await vigiado(backend.bingoComprar(gratis)))
  await refreshWallet()
}

// ---------- poderes ----------
/** sorteio da semana + mesada/coringa do dia; o servidor faz tudo, aqui só junta nas rows */
export async function checarPoderes() {
  if (!state.meId) return
  try {
    const ps = await backend.poderesEstado()
    for (const p of ps) if (JSON.stringify(state.rows.poderes[p.id]) !== JSON.stringify(p)) onRow('poderes', p)
    if (ps.some(p => p.user_id === state.meId && (p.tipo === 'mesada' || p.tipo === 'coringa'))) await refreshWallet()
  } catch { /* tenta no próximo giro */ }
}
export async function mandarMegafone(texto: string) {
  await backend.megafone(texto)
  await checarPoderes()
}

export async function comprarBilhete() {
  pegaBolao(await backend.bolaoComprar())
  await refreshWallet()
}

export async function trocarLatinha() {
  await backend.trocarLatinha()
  await refreshWallet()
  await checarBolao()
}

/** cassino: a jogada vai ao servidor e o saldo volta junto com o resultado */
export async function apostar(fn: (b: Backend) => Promise<Rodada | null>) {
  const r = await vigiado(fn(backend))
  if (r && state.wallet) set({ wallet: { ...state.wallet, balance: r.saldo } })
  return r
}

/** sala de jogos: partida e pontuação passam pelo servidor */
export const jogos = (fn: 'iniciar' | 'fim' | 'virar', args: Record<string, unknown> = {}) => vigiado(backend.jogos(fn, args))

/** vigia dos jogos: erro marcado pelo servidor vira o aviso de bloqueio (e fecha as mesas) */
async function vigiado<T>(p: Promise<T>): Promise<T> {
  try { return await p } catch (e) {
    const b = lerBloqueio(e)
    if (b) { set({ bloqueio: b, jogo: null, cassino: false, bingo: false }); throw new Error('Jogos bloqueados pela vigia.') }
    throw e
  }
}
export async function checarBloqueio() {
  try {
    const b = await backend.jogosBloqueio()
    set(b ? { bloqueio: b, jogo: null, cassino: false, bingo: false } : { bloqueio: null })
  } catch { /* sem resposta: o servidor recusa a partida de qualquer jeito */ }
}
export const fecharBloqueio = () => set({ bloqueio: null })

/** o que a pessoa já tem: comprado ou dado de graça no criador */
export const owns = (id: string, w = state.wallet) => !!w?.owned.includes(id)

/** veste/usa o item (ou tira, se art = null). Cabelo e roupa ficam no avatar, o resto no gear. */
export async function equip(slot: Slot, art: string | null) {
  const p = me()
  if (!p?.avatar) return
  if (art && !owns(`${slot}:${art}`)) throw new Error('Esse item ainda não é seu.')
  let avatar: Avatar = p.avatar
  if (slot === 'cabelo' || slot === 'roupa') {
    if (!art) return
    avatar = slot === 'cabelo' ? { ...avatar, hair: art as Avatar['hair'] } : { ...avatar, outfit: art as Avatar['outfit'] }
  } else {
    const gear: Gear = { ...avatar.gear }
    if (art) gear[slot] = art
    else delete gear[slot]
    avatar = { ...avatar, gear }
  }
  const saved = await backend.upsertProfile({ ...p, avatar })
  set({ profiles: { ...state.profiles, [p.id]: saved } })
}

export const itemName = (id: string) => ITEM[id]?.name ?? id
