export type Dir = 'down' | 'up' | 'left' | 'right'
export type Outfit = 'camiseta' | 'moletom' | 'social' | 'vestido'
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

/** inbox = pedido esperando aceite (fica no computador); declined = recusado */
export type TaskStatus = 'inbox' | 'todo' | 'doing' | 'done' | 'declined'

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

export interface Snapshot {
  profiles: Profile[]
  tasks: Task[]
  messages: Message[]
  notes: TaskNote[]
}

export interface Handlers {
  profile(p: Profile): void
  task(t: Task): void
  taskDeleted(id: string): void
  message(m: Message): void
  note(n: TaskNote): void
  noteDeleted(id: string): void
  pos(id: string, p: Pos): void
  online(ids: string[]): void
}

export interface Backend {
  readonly mode: 'demo' | 'supabase'
  currentUserId(): Promise<string | null>
  /** só no demo (no servidor quem cria conta é o Chefe). null = precisa confirmar o e-mail */
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
  connect(userId: string, h: Handlers): () => void
  sendPos(userId: string, p: Pos): void
}
