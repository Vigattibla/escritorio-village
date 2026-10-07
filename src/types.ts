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
  /** 1 Equipe · 2 Coordenação · 3 Gerência · 4 Diretoria — só muda por setRank */
  rank: number
  created_at: string
}

/** inbox = pedido esperando aceite (fica no computador); declined = recusado */
export type TaskStatus = 'inbox' | 'todo' | 'doing' | 'done' | 'declined'

export interface Task {
  id: string
  owner_id: string
  created_by: string
  title: string
  notes: string
  status: TaskStatus
  due: string | null
  position: number
  created_at: string
  done_at: string | null
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
}

export interface Handlers {
  profile(p: Profile): void
  task(t: Task): void
  taskDeleted(id: string): void
  message(m: Message): void
  pos(id: string, p: Pos): void
  online(ids: string[]): void
}

export interface Backend {
  readonly mode: 'demo' | 'supabase'
  currentUserId(): Promise<string | null>
  /** null = conta criada, mas precisa confirmar o e-mail */
  signUp(email: string, password: string, name: string): Promise<string | null>
  signIn(email: string, password: string): Promise<string>
  signOut(): Promise<void>
  accountName(): Promise<string>
  loadAll(): Promise<Snapshot>
  /** devolve o perfil como ficou salvo (o cargo é decidido no servidor) */
  upsertProfile(p: Profile): Promise<Profile>
  setRank(target: string, rank: number): Promise<void>
  uploadPhoto(userId: string, blob: Blob): Promise<string>
  upsertTask(t: Task): Promise<void>
  deleteTask(id: string): Promise<void>
  sendMessage(m: Message): Promise<void>
  connect(userId: string, h: Handlers): () => void
  sendPos(userId: string, p: Pos): void
}
