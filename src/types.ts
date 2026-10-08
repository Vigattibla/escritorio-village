export type Dir = 'down' | 'up' | 'left' | 'right'
export type Outfit = 'camiseta' | 'moletom' | 'social' | 'vestido' | 'terno'
export type HairStyle = 'curto' | 'longo' | 'coque' | 'cacheado' | 'raspado'

export interface Avatar {
  skin: string
  hair: HairStyle
  hairColor: string
  outfit: Outfit
  top: string
  bottom: string
  shoes: string
  face: 'pixel' | 'foto'
  pixelPhoto: boolean
}

export interface Profile {
  id: string
  name: string
  role: string
  avatar: Avatar | null
  photo: string | null
  xp: number
  desk: number
  /** 1 Equipe · 2 Coordenação · 3 Gerência · 4 Chefe — só muda por setRank */
  rank: number
  /** adm: cria contas, troca senhas e define cargos (não é o mesmo que Chefe) */
  is_admin?: boolean
  created_at: string
}

/** inbox = pedido esperando aceite (fica no computador); review = esperando o mestre do projeto aprovar; declined = recusado */
export type TaskStatus = 'inbox' | 'todo' | 'doing' | 'review' | 'done' | 'declined'

/** Projeto: agrupa tarefas de várias pessoas; o mestre aprova ou reprova as entregas. */
export interface Project {
  id: string
  name: string
  /** mestre (dono) do projeto: aprova as entregas */
  master_id: string
  /** critérios de aprovação que valem para todas as tarefas do projeto */
  criteria: string[]
  color: string
  archived: boolean
  created_by: string
  created_at: string
}

/** Uma decisão do aprovador (fica o histórico na tarefa). */
export interface Review {
  by: string
  at: string
  ok: boolean
  /** justificativa (obrigatória ao reprovar) */
  reason: string
  /** critérios que não passaram */
  failed: string[]
}

export interface Task {
  id: string
  owner_id: string
  created_by: string
  title: string
  /** descrição / legenda */
  notes: string
  status: TaskStatus
  start: string | null
  due: string | null
  /** quem ajuda (a tarefa aparece na pasta dessas pessoas também) */
  collaborators: string[]
  attachments: Attachment[]
  position: number
  created_at: string
  done_at: string | null
  project_id: string | null
  /** critérios extras só desta tarefa (somam com os do projeto) */
  criteria: string[]
  reviews: Review[]
  priority: Priority | null
  checklist: CheckItem[]
  /** lembrete para o dono (ISO) */
  remind_at: string | null
  /** post: canal e horário de publicar (vai para a Agenda) */
  channel: Channel | null
  publish_at: string | null
  /** etapa personalizada do quadro (null = primeira etapa do tipo do status) */
  stage?: string | null
}

export type Channel = 'feed' | 'reels' | 'stories' | 'facebook' | 'site'

/** evento da agenda (não é tarefa) */
export interface CalEvent { id: string; title: string; day: string; time: string | null; created_by: string; created_at: string }

/** meta do mês: posts = posts publicados (tarefa com canal feita), tasks = tarefas feitas, manual = valor digitado */
export interface Goal {
  id: string; title: string; target: number; metric: 'posts' | 'tasks' | 'manual'; month: string
  reward: string; value: number; created_by: string; created_at: string
}

export type StickerKind = 'mandou-bem' | 'destaque' | 'pausa' | 'parabens' | 'top' | 'recorde'
/** adesivo que o gerente cola na tela de alguém (x/y = fração da tela) */
export interface Sticker { id: string; to_id: string; by_id: string; kind: StickerKind; text: string; x: number; y: number; created_at: string }

/** passo de um fluxo: vira tarefa ao enviar */
export interface FlowNode { id: string; title: string; owner: string | null; due: string | null; x: number; y: number; after: string[]; task_id: string | null }
export interface Flow { id: string; name: string; objective: string; nodes: FlowNode[]; created_by: string; created_at: string }

/** etapa do quadro (coluna). kind = como o sistema entende a etapa: aprovação, feito… */
export type StageKind = 'todo' | 'doing' | 'review' | 'done'
export interface Stage { id: string; label: string; kind: StageKind; pos: number; created_by: string; created_at: string }

/** grupo do chat: canal 'g:<id>'; aberto = qualquer um entra, fechado = só quem foi convidado */
export interface Group { id: string; name: string; icon: string; open: boolean; members: string[]; created_by: string; created_at: string }
export interface Rows { events: CalEvent; goals: Goal; stickers: Sticker; flows: Flow; stages: Stage; groups: Group }
export type RowTable = keyof Rows
export const ROW_TABLES: RowTable[] = ['events', 'goals', 'stickers', 'flows', 'stages', 'groups']

export type Priority = 'alta' | 'media' | 'baixa'
export interface CheckItem {
  id: string
  text: string
  done: boolean
}

export interface Attachment {
  id: string
  name: string
  /** caminho no storage (demo: chave local) */
  path: string
  type: string
  size: number
  by: string
  at: string
}

/** comentário no fio da tarefa */
export interface TaskNote {
  id: string
  task_id: string
  author_id: string
  body: string
  created_at: string
}

export interface Message {
  id: string
  channel: string
  sender_id: string
  body: string
  created_at: string
}

export interface Pos {
  x: number
  y: number
  dir: Dir
  moving: boolean
}

/** Proposta da IA do Gerente: ele revisa e só então distribui */
export interface AiItem {
  title: string
  owner_id: string
  due: string | null
  project_id: string | null
  notes: string
  /** por que essa pessoa */
  why: string
}
export interface AiProposal { summary: string; items: AiItem[] }
/** Vai junto do pedido: quem é o time e quanto cada um já tem aberto */
export interface AiContext {
  today: string
  me: { id: string; name: string; rank: number }
  people: { id: string; name: string; role: string; rank: number; open: number; late: number; online: boolean }[]
  projects: { id: string; name: string; master: string }[]
}
export type AiStage = 'pending' | 'working'

export interface Snapshot {
  profiles: Profile[]
  tasks: Task[]
  messages: Message[]
  notes: TaskNote[]
  projects: Project[]
  rows: { [K in RowTable]: Rows[K][] }
}

export interface AccountEdit { name: string; role: string; rank: number; is_admin: boolean; user: string }

export interface Handlers {
  profile(p: Profile): void
  profileDeleted(id: string): void
  task(t: Task): void
  taskDeleted(id: string): void
  message(m: Message): void
  note(n: TaskNote): void
  noteDeleted(id: string): void
  project(p: Project): void
  projectDeleted(id: string): void
  row<K extends RowTable>(table: K, r: Rows[K]): void
  rowDeleted(table: RowTable, id: string): void
  pos(id: string, p: Pos): void
  online(ids: string[]): void
}

export interface Backend {
  readonly mode: 'demo' | 'supabase'
  currentUserId(): Promise<string | null>
  /** sistema vazio: ninguém tem conta ainda, a primeira vira adm */
  needsSetup(): Promise<boolean>
  /** demo: cadastro livre. Servidor: só no primeiro acesso (cria o adm). null = precisa confirmar o e-mail */
  signUp(login: string, password: string, name: string): Promise<string | null>
  /** login = usuário ou e-mail */
  signIn(login: string, password: string): Promise<string>
  signOut(): Promise<void>
  accountName(): Promise<string>
  loadAll(): Promise<Snapshot>
  /** devolve o perfil como ficou salvo (o cargo é decidido no servidor) */
  upsertProfile(p: Profile): Promise<Profile>
  setRank(target: string, rank: number): Promise<void>
  /** só o adm: cria a conta já com perfil e cargo */
  createAccount(user: string, password: string, name: string, rank: number): Promise<Profile>
  /** só o adm */
  setPassword(target: string, password: string): Promise<void>
  /** só o adm: id → usuário de login */
  accountLogins(): Promise<Record<string, string>>
  /** só o adm: user vazio = mantém o login */
  updateAccount(target: string, a: AccountEdit): Promise<void>
  /** só o adm: tarefas e projetos vão para o herdeiro */
  deleteAccount(target: string, heir: string): Promise<void>
  uploadPhoto(userId: string, blob: Blob): Promise<string>
  upsertTask(t: Task): Promise<void>
  deleteTask(id: string): Promise<void>
  sendMessage(m: Message): Promise<void>
  /** devolve o caminho do arquivo guardado */
  uploadFile(taskId: string, file: File): Promise<string>
  /** link para abrir (ou baixar, com o nome dado) */
  fileUrl(path: string, download?: string): Promise<string>
  deleteFile(path: string): Promise<void>
  addNote(n: TaskNote): Promise<void>
  deleteNote(id: string): Promise<void>
  upsertProject(p: Project): Promise<void>
  deleteProject(id: string): Promise<void>
  /** agenda, metas, adesivos e fluxos */
  upsertRow<K extends RowTable>(table: K, r: Rows[K]): Promise<void>
  deleteRow(table: RowTable, id: string): Promise<void>
  /** entra (só em grupo aberto) ou sai de um grupo do chat */
  joinGroup(id: string, join: boolean): Promise<void>
  /** IA do Gerente: manda o pedido e espera a proposta (servidor: a ponte no PC roda o Claude) */
  askAI(prompt: string, ctx: AiContext, onStage: (s: AiStage) => void, signal: AbortSignal): Promise<AiProposal>
  /** a ponte do PC deu sinal de vida há pouco? */
  aiOnline(): Promise<boolean>
  connect(userId: string, h: Handlers): () => void
  sendPos(userId: string, p: Pos): void
}
