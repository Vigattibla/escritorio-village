import { toEmail, validUser } from './login'
import type { Avatar, Backend, Handlers, Message, Pos, Profile, Snapshot, Task, TaskNote } from '../types'

// Modo demonstração: tudo no localStorage deste navegador. Abas diferentes = pessoas diferentes
// (a sessão fica no sessionStorage), sincronizadas por BroadcastChannel.

interface Account { id: string; email: string; hash: string; name: string }
const K = { acc: 'ev:accounts', prof: 'ev:profiles', task: 'ev:tasks', msg: 'ev:messages', note: 'ev:notes', file: 'ev:file:', seeded: 'ev:seeded', session: 'ev:session' }

function read<T>(k: string, fb: T): T {
  try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : fb } catch { return fb }
}
function write(k: string, v: unknown) { localStorage.setItem(k, JSON.stringify(v)) }

async function sha(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('')
}

type Wire =
  | { t: 'profile'; p: Profile }
  | { t: 'task'; task: Task }
  | { t: 'taskDel'; id: string }
  | { t: 'msg'; m: Message }
  | { t: 'note'; n: TaskNote }
  | { t: 'noteDel'; id: string }
  | { t: 'pos'; id: string; p: Pos }
  | { t: 'hello'; id: string; p: Pos | null }
  | { t: 'bye'; id: string }

export class DemoBackend implements Backend {
  readonly mode = 'demo' as const
  private bc = new BroadcastChannel('escritorio-village')
  private lastPos: Pos | null = null

  private post(w: Wire) { this.bc.postMessage(w) }

  async currentUserId() { return sessionStorage.getItem(K.session) }

  async signUp(login: string, password: string, name: string) {
    const accs = read<Account[]>(K.acc, [])
    const email = toEmail(login)
    if (accs.some(a => a.email === email)) throw new Error('Esse usuário já existe. Use "Entrar".')
    if (password.length < 6) throw new Error('A senha precisa de pelo menos 6 caracteres.')
    const id = crypto.randomUUID()
    accs.push({ id, email, hash: await sha(password), name: name.trim() })
    write(K.acc, accs)
    sessionStorage.setItem(K.session, id)
    return id
  }

  async signIn(login: string, password: string) {
    const acc = read<Account[]>(K.acc, []).find(a => a.email === toEmail(login))
    if (!acc || acc.hash !== (await sha(password))) throw new Error('Usuário ou senha incorretos.')
    sessionStorage.setItem(K.session, acc.id)
    return acc.id
  }

  async signOut() { sessionStorage.removeItem(K.session) }

  async accountName() {
    const id = sessionStorage.getItem(K.session)
    return read<Account[]>(K.acc, []).find(a => a.id === id)?.name ?? ''
  }

  async loadAll(): Promise<Snapshot> {
    if (!localStorage.getItem(K.seeded)) seed()
    return {
      profiles: Object.values(read<Record<string, Profile>>(K.prof, {})),
      tasks: Object.values(read<Record<string, Task>>(K.task, {})),
      messages: read<Message[]>(K.msg, []),
      notes: read<TaskNote[]>(K.note, []),
    }
  }

  async upsertProfile(p: Profile) {
    const all = read<Record<string, Profile>>(K.prof, {})
    // como no servidor: cargo não vem do cliente; o primeiro sem chefe vira chefe
    const boss = Object.values(all).some(x => x.rank === 4 && x.id !== p.id)
    p = { ...p, rank: all[p.id]?.rank ?? (boss ? 1 : 4) }
    all[p.id] = p
    write(K.prof, all)
    this.post({ t: 'profile', p })
    return p
  }

  async setRank(target: string, rank: number) {
    const all = read<Record<string, Profile>>(K.prof, {})
    const mine = all[sessionStorage.getItem(K.session) ?? '']?.rank ?? 1
    const t = all[target]
    if (!t || t.id === sessionStorage.getItem(K.session) || (t.rank ?? 1) >= mine || rank < 1 || rank > mine)
      throw new Error('Sem permissão para mudar esse cargo.')
    await this.upsertProfileRaw({ ...t, rank })
  }

  private chief() {
    if (read<Record<string, Profile>>(K.prof, {})[sessionStorage.getItem(K.session) ?? '']?.rank !== 4) throw new Error('Só o Chefe mexe nas contas.')
  }

  async createAccount(user: string, password: string, name: string, rank: number) {
    this.chief()
    if (!validUser(user)) throw new Error('Usuário inválido: use letras, números, ponto ou traço.')
    if (password.length < 6) throw new Error('A senha precisa de pelo menos 6 caracteres.')
    const accs = read<Account[]>(K.acc, [])
    const email = toEmail(user)
    if (accs.some(a => a.email === email)) throw new Error('Esse usuário já existe.')
    const id = crypto.randomUUID()
    accs.push({ id, email, hash: await sha(password), name: name.trim() })
    write(K.acc, accs)
    const p: Profile = { id, name: name.trim() || user, role: '', avatar: null, photo: null, xp: 0, desk: -1, rank, created_at: new Date().toISOString() }
    await this.upsertProfileRaw(p)
    return p
  }

  async setPassword(target: string, password: string) {
    this.chief()
    if (password.length < 6) throw new Error('A senha precisa de pelo menos 6 caracteres.')
    const accs = read<Account[]>(K.acc, [])
    const acc = accs.find(a => a.id === target)
    if (!acc) throw new Error('Conta não encontrada.')
    acc.hash = await sha(password)
    write(K.acc, accs)
  }

  private async upsertProfileRaw(p: Profile) {
    const all = read<Record<string, Profile>>(K.prof, {})
    all[p.id] = p
    write(K.prof, all)
    this.post({ t: 'profile', p })
  }

  uploadPhoto(_userId: string, blob: Blob) {
    return new Promise<string>((res, rej) => {
      const fr = new FileReader()
      fr.onload = () => res(fr.result as string)
      fr.onerror = () => rej(new Error('Não consegui ler a foto.'))
      fr.readAsDataURL(blob)
    })
  }

  async upsertTask(t: Task) {
    const all = read<Record<string, Task>>(K.task, {})
    all[t.id] = t
    write(K.task, all)
    this.post({ t: 'task', task: t })
  }

  async deleteTask(id: string) {
    const all = read<Record<string, Task>>(K.task, {})
    delete all[id]
    write(K.task, all)
    this.post({ t: 'taskDel', id })
  }

  async sendMessage(m: Message) {
    const all = read<Message[]>(K.msg, [])
    all.push(m)
    write(K.msg, all.slice(-500))
    this.post({ t: 'msg', m })
  }

  async uploadFile(_taskId: string, file: File) {
    if (file.size > 1.5 * 1024 * 1024) throw new Error('No modo demo os arquivos vão até 1,5 MB (no site real, 20 MB).')
    const data = await new Promise<string>((res, rej) => {
      const fr = new FileReader()
      fr.onload = () => res(fr.result as string)
      fr.onerror = () => rej(new Error('Não consegui ler o arquivo.'))
      fr.readAsDataURL(file)
    })
    const path = crypto.randomUUID()
    try { localStorage.setItem(K.file + path, data) } catch { throw new Error('Sem espaço no navegador para esse arquivo (modo demo).') }
    return path
  }

  async fileUrl(path: string) {
    const d = localStorage.getItem(K.file + path)
    if (!d) throw new Error('Arquivo não encontrado.')
    return d
  }

  async deleteFile(path: string) { localStorage.removeItem(K.file + path) }

  async addNote(n: TaskNote) {
    write(K.note, [...read<TaskNote[]>(K.note, []), n].slice(-2000))
    this.post({ t: 'note', n })
  }

  async deleteNote(id: string) {
    write(K.note, read<TaskNote[]>(K.note, []).filter(n => n.id !== id))
    this.post({ t: 'noteDel', id })
  }

  connect(userId: string, h: Handlers) {
    const seen = new Map<string, number>()
    const emit = () => {
      const now = Date.now()
      h.online([userId, ...[...seen].filter(([, t]) => now - t < 7000).map(([id]) => id)])
    }
    const onMsg = (e: MessageEvent<Wire>) => {
      const w = e.data
      switch (w.t) {
        case 'profile': h.profile(w.p); break
        case 'task': h.task(w.task); break
        case 'taskDel': h.taskDeleted(w.id); break
        case 'msg': h.message(w.m); break
        case 'note': h.note(w.n); break
        case 'noteDel': h.noteDeleted(w.id); break
        case 'pos': seen.set(w.id, Date.now()); h.pos(w.id, w.p); break
        case 'hello': {
          const novo = !seen.has(w.id)
          seen.set(w.id, Date.now())
          if (w.p) h.pos(w.id, w.p)
          if (novo) { emit(); hello() }
          break
        }
        case 'bye': seen.delete(w.id); emit(); break
      }
    }
    const hello = () => this.post({ t: 'hello', id: userId, p: this.lastPos })
    const bye = () => this.post({ t: 'bye', id: userId })
    this.bc.addEventListener('message', onMsg)
    window.addEventListener('pagehide', bye)
    hello()
    emit()
    const iv = setInterval(() => { hello(); emit() }, 2500)
    return () => {
      clearInterval(iv)
      bye()
      this.bc.removeEventListener('message', onMsg)
      window.removeEventListener('pagehide', bye)
    }
  }

  sendPos(userId: string, p: Pos) {
    this.lastPos = p
    this.post({ t: 'pos', id: userId, p })
  }
}

// ---- equipe de exemplo ----
function seed() {
  const now = new Date()
  const dayAhead = (d: number) => new Date(now.getTime() + d * 864e5).toISOString().slice(0, 10)
  const iso = (minAgo: number) => new Date(now.getTime() - minAgo * 60000).toISOString()
  const av = (a: Partial<Avatar>): Avatar => ({
    skin: '#f6c9a3', hair: 'curto', hairColor: '#2b1d16', outfit: 'camiseta', top: '#0B235D', bottom: '#2c3e66',
    shoes: '#1f1f24', face: 'pixel', pixelPhoto: true, ...a,
  })
  const people: Profile[] = [
    { id: 'demo-ana', name: 'Ana', role: 'Recepção', avatar: av({ skin: '#e2aa7e', hair: 'longo', hairColor: '#2b1d16', outfit: 'vestido', top: '#e05a47', shoes: '#7a4a2a' }), photo: null, xp: 240, desk: 1, rank: 1, created_at: iso(9000) },
    { id: 'demo-bruno', name: 'Bruno', role: 'Marketing', avatar: av({ skin: '#8d5a3b', hair: 'cacheado', outfit: 'moletom', top: '#3fa66b', bottom: '#1f1f24', shoes: '#f4f4f4' }), photo: null, xp: 410, desk: 2, rank: 2, created_at: iso(8000) },
    { id: 'demo-carla', name: 'Carla', role: 'Eventos', avatar: av({ skin: '#ffe3cc', hair: 'coque', hairColor: '#d9a441', outfit: 'social', top: '#0B235D', bottom: '#2c3e66' }), photo: null, xp: 130, desk: 5, rank: 3, created_at: iso(7000) },
  ]
  const task = (owner: string, title: string, status: Task['status'], minAgo: number, by = owner): Task => ({
    id: crypto.randomUUID(), owner_id: owner, created_by: by, title, notes: '', status, start: null, due: null, collaborators: [], attachments: [], position: minAgo,
    created_at: iso(minAgo), done_at: status === 'done' ? iso(Math.max(1, minAgo - 30)) : null,
  })
  const tasks = [
    { ...task('demo-ana', 'Confirmar reservas do fim de semana', 'doing', 120), notes: 'Ligar para quem ainda não pagou o sinal. Conferir chalés 3 e 7.', collaborators: ['demo-carla'] },
    task('demo-ana', 'Responder e-mails das agências', 'todo', 100),
    task('demo-ana', 'Imprimir check-ins de sexta', 'todo', 90, 'demo-carla'),
    task('demo-bruno', 'Foto da recepção pro site', 'inbox', 70, 'demo-ana'),
    task('demo-bruno', 'Arte do feed: Semana das Crianças', 'doing', 200),
    task('demo-bruno', 'Agendar stories da piscina', 'todo', 150),
    task('demo-bruno', 'Selecionar fotos do chalé', 'done', 300),
    task('demo-carla', 'Checklist do evento de sábado', 'todo', 80),
    { ...task('demo-carla', 'Orçamento da decoração', 'doing', 60), notes: 'Três orçamentos: flores, balões e iluminação.', collaborators: ['demo-bruno'], due: dayAhead(2) },
  ]
  const notes: TaskNote[] = [
    { id: crypto.randomUUID(), task_id: tasks[0].id, author_id: 'demo-carla', body: 'O chalé 7 confirmou por WhatsApp agora há pouco.', created_at: iso(50) },
  ]
  const msgs: Message[] = [
    { id: crypto.randomUUID(), channel: 'geral', sender_id: 'demo-ana', body: 'Bom dia, time! ☀️', created_at: iso(180) },
    { id: crypto.randomUUID(), channel: 'geral', sender_id: 'demo-bruno', body: 'A arte do feed sai até as 16h 👀', created_at: iso(150) },
    { id: crypto.randomUUID(), channel: 'geral', sender_id: 'demo-carla', body: 'Quem puder, dá uma olhada no checklist de sábado depois.', created_at: iso(40) },
  ]
  write(K.prof, Object.fromEntries(people.map(p => [p.id, p])))
  write(K.task, Object.fromEntries(tasks.map(t => [t.id, t])))
  write(K.msg, msgs)
  write(K.note, notes)
  localStorage.setItem(K.seeded, '1')
}
