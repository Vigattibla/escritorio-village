import { toEmail, validUser } from './login'
import { dayKey } from '../game/xp'
import type { CoffeeLine, Dept, Goal, Wallet, Group, RowTable, Rows, AccountEdit, AiContext, AiProposal, AiStage, Avatar, Backend, Handlers, Message, Pos, Profile, Project, Snapshot, Task, TaskNote } from '../types'
import { ROW_TABLES } from '../types'
import { counts, DAY, MAX_GOALS, payouts, WELCOME } from '../shop/economy'
import { ITEM } from '../shop/catalog'
import { localDay } from '../components/v4'

// Modo demonstração: tudo no localStorage deste navegador. Abas diferentes = pessoas diferentes
// (a sessão fica no sessionStorage), sincronizadas por BroadcastChannel.

interface Account { id: string; email: string; hash: string; name: string }
const K = { acc: 'ev:accounts', prof: 'ev:profiles', task: 'ev:tasks', msg: 'ev:messages', note: 'ev:notes', proj: 'ev:projects', file: 'ev:file:', seeded: 'ev:seeded', row: 'ev:row:', session: 'ev:session' }

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
  | { t: 'profileDel'; id: string }
  | { t: 'task'; task: Task }
  | { t: 'taskDel'; id: string }
  | { t: 'msg'; m: Message }
  | { t: 'note'; n: TaskNote }
  | { t: 'noteDel'; id: string }
  | { t: 'project'; p: Project }
  | { t: 'projectDel'; id: string }
  | { t: 'row'; k: RowTable; r: Rows[RowTable] }
  | { t: 'rowDel'; k: RowTable; id: string }
  | { t: 'pos'; id: string; p: Pos }
  | { t: 'hello'; id: string; p: Pos | null }
  | { t: 'bye'; id: string }

export class DemoBackend implements Backend {
  readonly mode = 'demo' as const
  private bc = new BroadcastChannel('escritorio-village')
  private lastPos: Pos | null = null

  private post(w: Wire) { this.bc.postMessage(w) }

  async currentUserId() { return sessionStorage.getItem(K.session) }

  async needsSetup() { return read<Account[]>(K.acc, []).length === 0 }

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
    if (!localStorage.getItem(K.row + 'depts'))
      write(K.row + 'depts', { marketing: { id: 'marketing', name: 'Marketing', color: '#0B235D', floor: 1, slot: 0, created_at: new Date(0).toISOString() } })
    return {
      profiles: Object.values(read<Record<string, Profile>>(K.prof, {})),
      tasks: Object.values(read<Record<string, Task>>(K.task, {})),
      messages: read<Message[]>(K.msg, []),
      notes: read<TaskNote[]>(K.note, []),
      projects: Object.values(read<Record<string, Project>>(K.proj, {})),
      rows: {
        ...(Object.fromEntries(ROW_TABLES.map(k => [k, Object.values(read<Record<string, unknown>>(K.row + k, {}))])) as Snapshot['rows']),
      },
    }
  }

  async upsertProfile(p: Profile) {
    const all = read<Record<string, Profile>>(K.prof, {})
    // como no servidor: cargo e adm não vêm do cliente; o primeiro a entrar sem adm vira adm
    const adm = Object.values(all).some(x => x.is_admin && x.id !== p.id)
    // demo: quem entra primeiro já é Coordenação, pra ver Metas, Fluxos e aprovações
    p = { ...p, rank: all[p.id]?.rank ?? (adm ? 1 : 3), is_admin: all[p.id]?.is_admin ?? !adm, dept: all[p.id]?.dept }
    all[p.id] = p
    write(K.prof, all)
    this.post({ t: 'profile', p })
    return p
  }

  async setRank(target: string, rank: number) {
    const all = read<Record<string, Profile>>(K.prof, {})
    const me = all[sessionStorage.getItem(K.session) ?? '']
    const mine = me?.rank ?? 1
    const t = all[target]
    if (!t || rank < 1 || rank > 4 || (!me?.is_admin && (t.id === me?.id || (t.rank ?? 1) >= mine || rank > mine)))
      throw new Error('Sem permissão para mudar esse cargo.')
    await this.upsertProfileRaw({ ...t, rank })
  }

  async setDoor(dept: string, open: boolean) {
    const me = read<Record<string, Profile>>(K.prof, {})[sessionStorage.getItem(K.session) ?? '']
    const d = read<Record<string, Dept>>(K.row + 'depts', {})[dept]
    if (!d) throw new Error('Essa sala não existe.')
    if (!(me?.is_admin || me?.rank === 4 || ((me?.rank ?? 1) >= 3 && (me?.dept || 'marketing') === dept))) throw new Error('Só o gerente da sala, a Chefe ou o adm mexem na porta.')
    await this.upsertRow('depts', { ...d, door_open: open })
  }

  async setDept(target: string, dept: string, desk: number) {
    const all = read<Record<string, Profile>>(K.prof, {})
    const me = all[sessionStorage.getItem(K.session) ?? '']
    const t = all[target]
    if (!t || !(me?.is_admin || me?.rank === 4)) throw new Error('Só o adm ou a Chefe muda alguém de sala.')
    if (!read<Record<string, Dept>>(K.row + 'depts', {})[dept]) throw new Error('Essa sala não existe.')
    if ((t.dept || 'marketing') === dept) return
    await this.upsertProfileRaw({ ...t, dept, desk })
    const tasks = read<Record<string, Task>>(K.task, {})
    for (const x of Object.values(tasks)) if (x.owner_id === target && x.status !== 'done' && x.status !== 'declined') {
      tasks[x.id] = { ...x, dept }
      this.post({ t: 'task', task: tasks[x.id] })
    }
    write(K.task, tasks)
  }

  private chief() {
    if (!read<Record<string, Profile>>(K.prof, {})[sessionStorage.getItem(K.session) ?? '']?.is_admin) throw new Error('Só o adm mexe nas contas.')
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

  async accountLogins() {
    this.chief()
    return Object.fromEntries(read<Account[]>(K.acc, []).map(a => [a.id, a.email.split('@')[0]]))
  }

  async updateAccount(target: string, a: AccountEdit) {
    this.chief()
    const p = read<Record<string, Profile>>(K.prof, {})[target]
    if (!p) throw new Error('Conta não encontrada.')
    if (!a.name.trim()) throw new Error('O nome não pode ficar vazio.')
    if (a.rank < 1 || a.rank > 4) throw new Error('Cargo inválido.')
    if (target === sessionStorage.getItem(K.session) && !a.is_admin) throw new Error('Você não pode tirar o seu próprio adm.')
    const accs = read<Account[]>(K.acc, [])
    const acc = accs.find(x => x.id === target)
    const user = a.user.trim().toLowerCase()
    if (user && acc) {
      if (!validUser(user)) throw new Error('Usuário inválido: use letras, números, ponto ou traço.')
      if (accs.some(x => x.email === toEmail(user) && x.id !== target)) throw new Error('Esse usuário já existe.')
      acc.email = toEmail(user)
    }
    if (acc) { acc.name = a.name.trim(); write(K.acc, accs) }
    await this.upsertProfileRaw({ ...p, name: a.name.trim().slice(0, 40), role: a.role.trim().slice(0, 40), rank: a.rank, is_admin: a.is_admin })
  }

  async deleteAccount(target: string, heir: string) {
    this.chief()
    if (target === sessionStorage.getItem(K.session)) throw new Error('Você não pode excluir a sua própria conta.')
    const profs = read<Record<string, Profile>>(K.prof, {})
    if (!profs[target]) throw new Error('Conta não encontrada.')
    if (!heir || heir === target || !profs[heir]) throw new Error('Escolha quem fica com as tarefas.')
    const tasks = read<Record<string, Task>>(K.task, {})
    for (const t of Object.values(tasks)) {
      const before = JSON.stringify(t)
      if (t.owner_id === target) t.owner_id = heir
      if (t.created_by === target) t.created_by = heir
      t.collaborators = t.collaborators.filter(c => c !== target && c !== t.owner_id)
      if (JSON.stringify(t) !== before) this.post({ t: 'task', task: t })
    }
    write(K.task, tasks)
    const projs = read<Record<string, Project>>(K.proj, {})
    for (const p of Object.values(projs)) {
      if (p.master_id !== target && p.created_by !== target) continue
      if (p.master_id === target) p.master_id = heir
      if (p.created_by === target) p.created_by = heir
      this.post({ t: 'project', p })
    }
    write(K.proj, projs)
    write(K.msg, read<Message[]>(K.msg, []).filter(m => m.sender_id !== target))
    write(K.note, read<TaskNote[]>(K.note, []).filter(n => n.author_id !== target))
    write(K.acc, read<Account[]>(K.acc, []).filter(a => a.id !== target))
    delete profs[target]
    write(K.prof, profs)
    this.post({ t: 'profileDel', id: target })
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
    const prev = all[t.id]
    t = { ...t, dept: prev && prev.owner_id === t.owner_id ? prev.dept : read<Record<string, Profile>>(K.prof, {})[t.owner_id]?.dept || 'marketing' }
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

  async upsertProject(p: Project) {
    const all = read<Record<string, Project>>(K.proj, {})
    all[p.id] = p
    write(K.proj, all)
    this.post({ t: 'project', p })
  }

  async askAI(prompt: string, ctx: AiContext, onStage: (s: AiStage) => void, signal: AbortSignal): Promise<AiProposal> {
    // demo não tem Claude: quebra o texto em itens e dá para quem tem menos coisa aberta
    const wait = (ms: number) => new Promise(r => setTimeout(r, ms))
    onStage('pending'); await wait(700); onStage('working'); await wait(1500)
    if (signal.aborted) throw new Error('Cancelado.')
    const parts = prompt.split(/\n|;/).map(s => s.replace(/^[\s•*\-\d.)]+/, '').trim()).filter(s => s.length > 2)
    const pool = ctx.people.filter(p => p.id !== ctx.me.id && p.rank < ctx.me.rank)
    const load = new Map(pool.map(p => [p.id, p.open]))
    const items = parts.slice(0, 12).map(title => {
      const p = [...pool].sort((a, b) => load.get(a.id)! - load.get(b.id)!)[0] ?? ctx.people[0]
      load.set(p.id, (load.get(p.id) ?? 0) + 1)
      return { title: title.slice(0, 140), owner_id: p.id, due: null, project_id: null, notes: '', why: `${p.name} tem menos tarefas abertas (demo, sem Claude).` }
    })
    return { summary: `Modo demo: ${items.length} tarefa(s) para quem está mais livre.`, items }
  }

  async aiOnline() { return true }

  async upsertRow<K extends RowTable>(k: K, r: Rows[K]) {
    const all = read<Record<string, Rows[K]>>(K.row + k, {})
    all[r.id] = r
    write(K.row + k, all)
    this.post({ t: 'row', k, r })
  }

  // carteira da demo: mesmas regras do claim_coffee do servidor, guardada por pessoa
  private coffee(): CoffeeLine[] { return read<CoffeeLine[]>('ev:coffee:' + sessionStorage.getItem(K.session), []) }
  private credit(log: CoffeeLine[], amount: number, reason: CoffeeLine['reason'], ref: string, out: CoffeeLine[]) {
    if (log.some(l => l.reason === reason && l.ref === ref)) return
    const l = { amount, reason, ref, created_at: new Date().toISOString() }
    log.unshift(l); out.push(l)
  }

  async wallet(): Promise<Wallet> {
    const log = this.coffee()
    return { balance: log.reduce((n, l) => n + l.amount, 0), owned: log.filter(l => l.reason === 'compra').map(l => l.ref), log }
  }

  async claimCoffee(): Promise<CoffeeLine[]> {
    const me = sessionStorage.getItem(K.session)
    if (!me) return []
    const log = this.coffee(), out: CoffeeLine[] = []
    this.credit(log, WELCOME, 'boasvindas', 'boasvindas', out)
    this.credit(log, DAY, 'dia', localDay(new Date().toISOString()), out)
    const tasks = Object.values(read<Record<string, Task>>(K.task, {}))
    const projects = read<Record<string, Project>>(K.proj, {})
    const sala = read<Record<string, Profile>>(K.prof, {})[me]?.dept || 'marketing'
    const goals = Object.values(read<Record<string, Goal>>(K.row + 'goals', {})).filter(g => (g.dept || 'marketing') === sala).sort((a, b) => a.created_at.localeCompare(b.created_at))
    const done = (g: Goal, upto: number) => tasks.filter(t => t.status === 'done' && (t.dept || 'marketing') === (g.dept || 'marketing') && t.done_at && new Date(t.done_at).getTime() < upto
      && localDay(t.done_at).startsWith(g.month) && (g.metric !== 'posts' || !!t.channel) && counts(t, projects)).length
    for (const g of goals) {
      const paidGoals = new Set(log.filter(l => (l.reason === 'fase' || l.reason === 'meta') && l.ref.startsWith(g.month + ':')).map(l => l.ref.split(':')[1]))
      if (!paidGoals.has(g.id) && paidGoals.size >= MAX_GOALS) continue
      const v = g.metric === 'manual' ? g.value : done(g, Infinity)
      const d = new Date(g.created_at); const midnight = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime()
      const b = g.metric === 'manual' ? g.base ?? 0 : done(g, midnight)
      for (const p of payouts(g, v, b)) this.credit(log, p.amount, p.reason, p.reason === 'fase' ? `${g.month}:${g.id}:${p.i}` : `${g.month}:${g.id}`, out)
    }
    write('ev:coffee:' + me, log)
    return out
  }

  async buyItem(id: string) {
    const me = sessionStorage.getItem(K.session)
    const it = ITEM[id]
    if (!me || !it) throw new Error('Item não existe.')
    const log = this.coffee()
    if (log.some(l => l.reason === 'compra' && l.ref === id)) return
    const bal = log.reduce((n, l) => n + l.amount, 0)
    if (bal < it.price) throw new Error(`Faltam ${it.price - bal} cafezinhos.`)
    this.credit(log, -it.price, 'compra', id, [])
    write('ev:coffee:' + me, log)
  }

  async joinGroup(id: string, join: boolean) {
    const all = read<Record<string, Group>>(K.row + 'groups', {})
    const g = all[id], me = sessionStorage.getItem(K.session)
    if (!g || !me) return
    if (join && !g.open) throw new Error('Esse grupo é só para convidados.')
    const members = join ? [...new Set([...g.members, me])] : g.members.filter(x => x !== me)
    await this.upsertRow('groups', { ...g, members })
  }

  async deleteRow(k: RowTable, id: string) {
    const all = read<Record<string, unknown>>(K.row + k, {})
    delete all[id]
    write(K.row + k, all)
    this.post({ t: 'rowDel', k, id })
  }

  async deleteProject(id: string) {
    const all = read<Record<string, Project>>(K.proj, {})
    delete all[id]
    write(K.proj, all)
    // como no servidor (on delete set null): as tarefas ficam, só saem do projeto
    const tasks = read<Record<string, Task>>(K.task, {})
    for (const t of Object.values(tasks)) if (t.project_id === id) { t.project_id = null; this.post({ t: 'task', task: t }) }
    write(K.task, tasks)
    this.post({ t: 'projectDel', id })
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
        case 'profileDel': h.profileDeleted(w.id); break
        case 'task': h.task(w.task); break
        case 'taskDel': h.taskDeleted(w.id); break
        case 'msg': h.message(w.m); break
        case 'note': h.note(w.n); break
        case 'noteDel': h.noteDeleted(w.id); break
        case 'project': h.project(w.p); break
        case 'projectDel': h.projectDeleted(w.id); break
        case 'row': h.row(w.k, w.r); break
        case 'rowDel': h.rowDeleted(w.k, w.id); break
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
  const dayAhead = (d: number) => dayKey(new Date(now.getTime() + d * 864e5))
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
  const proj: Project = {
    id: crypto.randomUUID(), name: 'Semana das Crianças', master_id: 'demo-carla', color: '#e8a33d', archived: false, created_by: 'demo-carla', created_at: iso(9500),
    criteria: ['Segue a identidade da campanha', 'Revisado (texto sem erro)', 'Aprovado com o cliente interno'],
  }
  const task = (owner: string, title: string, status: Task['status'], minAgo: number, by = owner, project_id: string | null = null): Task => ({
    id: crypto.randomUUID(), owner_id: owner, created_by: by, title, notes: '', status, start: null, due: null, collaborators: [], attachments: [], position: minAgo,
    created_at: iso(minAgo), done_at: status === 'done' ? iso(Math.max(1, minAgo - 30)) : null, project_id, criteria: [], reviews: [],
    priority: null, checklist: [], remind_at: null, channel: null, publish_at: null,
  })
  const tasks = [
    { ...task('demo-ana', 'Confirmar reservas do fim de semana', 'doing', 120), notes: 'Ligar para quem ainda não pagou o sinal. Conferir chalés 3 e 7.', collaborators: ['demo-carla'], priority: 'alta', due: dayAhead(0),
      checklist: [{ id: crypto.randomUUID(), text: 'Chalé 3', done: true }, { id: crypto.randomUUID(), text: 'Chalé 7', done: true }, { id: crypto.randomUUID(), text: 'Suíte Orquídea', done: true }, { id: crypto.randomUUID(), text: 'Chalé 12', done: false }, { id: crypto.randomUUID(), text: 'Suíte Tulipa', done: false }] },
    { ...task('demo-ana', 'Responder e-mails das agências', 'todo', 100), priority: 'baixa', remind_at: new Date(now.getTime() + 90e3).toISOString() },
    task('demo-ana', 'Imprimir check-ins de sexta', 'todo', 90, 'demo-carla'),
    task('demo-bruno', 'Foto da recepção pro site', 'inbox', 70, 'demo-ana'),
    task('demo-bruno', 'Arte do feed: Semana das Crianças', 'review', 200, 'demo-carla', proj.id),
    task('demo-ana', 'Inscrições das oficinas na recepção', 'doing', 110, 'demo-carla', proj.id),
    task('demo-bruno', 'Agendar stories da piscina', 'todo', 150),
    task('demo-bruno', 'Selecionar fotos do chalé', 'done', 300),
    { ...task('demo-carla', 'Checklist do evento de sábado', 'todo', 80), priority: 'media', due: dayAhead(-1), checklist: [{ id: crypto.randomUUID(), text: 'Som', done: true }, { id: crypto.randomUUID(), text: 'Mesas', done: false }, { id: crypto.randomUUID(), text: 'Decoração', done: false }] },
    { ...task('demo-carla', 'Orçamento da decoração', 'doing', 60), notes: 'Três orçamentos: flores, balões e iluminação.', collaborators: ['demo-bruno'], due: dayAhead(2) },
  ]
  // posts da agenda: tarefa com canal e horário
  const at = (d: number, h: number) => { const x = new Date(now); x.setDate(x.getDate() + d); x.setHours(h, 0, 0, 0); return x.toISOString() }
  const post = (owner: string, title: string, status: Task['status'], channel: Task['channel'], d: number, h: number): Task =>
    ({ ...task(owner, title, status, 400 - d, 'demo-carla'), channel, publish_at: at(d, h), due: dayAhead(d) })
  tasks.push(
    post('demo-bruno', 'Reels · Semana das Crianças', 'review', 'reels', 0, 16),
    post('demo-ana', 'Feed · Promo Day Use', 'todo', 'feed', 1, 12),
    post('demo-bruno', 'Stories · Café da manhã', 'todo', 'stories', 3, 9),
    post('demo-bruno', 'Facebook · Pacote Réveillon', 'todo', 'facebook', 6, 10),
    post('demo-ana', 'Site · Página Casa de Campo', 'doing', 'site', 9, 14),
    ...[-6, -5, -3, -2, -1].map((d, i) => ({ ...post(i % 2 ? 'demo-ana' : 'demo-bruno', ['Feed · Tour pela piscina', 'Stories · Bom dia', 'Reels · Oficina de pipa', 'Feed · Depoimento', 'Stories · Pôr do sol'][i], 'done', i % 2 ? 'stories' : 'feed', d, 10), done_at: at(d, 11) })),
  )
  const month = dayKey(now).slice(0, 7)
  const msgsMine: Message[] = []
  const rows = {
    events: [
      { id: crypto.randomUUID(), title: 'Feriado · Dia das Crianças', day: dayAhead(5), time: null, created_by: 'demo-carla', created_at: iso(500) },
      { id: crypto.randomUUID(), title: 'Reunião de pauta', day: dayAhead(2), time: '09:00', created_by: 'demo-carla', created_at: iso(500) },
    ],
    goals: [{ id: crypto.randomUUID(), title: 'Publicar 12 posts', target: 12, metric: 'posts', month, reward: 'Almoço da equipe no restaurante', value: 0, created_by: 'demo-carla', created_at: iso(600) }],
    stickers: sessionStorage.getItem(K.session)
      ? [{ id: crypto.randomUUID(), to_id: sessionStorage.getItem(K.session)!, by_id: 'demo-carla', kind: 'mandou-bem', text: 'Mandou bem no Reels!', x: 0.72, y: 0.78, created_at: iso(20) }]
      : [],
    flows: [{
      id: crypto.randomUUID(), name: 'Campanha de Natal 2026', objective: 'Vender 30 pacotes de Natal até 15/12', created_by: 'demo-carla', created_at: iso(300),
      nodes: [
        { id: 'n1', title: 'Briefing e oferta', owner: 'demo-carla', due: dayAhead(6), x: 260, y: 200, after: [], task_id: null },
        { id: 'n2', title: 'Fotos da ceia', owner: 'demo-bruno', due: dayAhead(13), x: 540, y: 90, after: ['n1'], task_id: null },
        { id: 'n3', title: 'Arte + texto do post', owner: 'demo-ana', due: dayAhead(17), x: 540, y: 320, after: ['n1'], task_id: null },
        { id: 'n4', title: 'Publicar Feed + Stories', owner: null, due: null, x: 820, y: 200, after: ['n2', 'n3'], task_id: null },
      ],
    }],
  }
  // quem está entrando já encontra trabalho: tarefas suas, um projeto seu e entregas esperando sua aprovação
  const me = sessionStorage.getItem(K.session)
  const projects = [proj]
  if (me) {
    const mine: Project = {
      id: crypto.randomUUID(), name: 'Day Use Verão', master_id: me, color: '#3fa66b', archived: false, created_by: me, created_at: iso(9400),
      criteria: ['Preço conferido com a reserva', 'Foto aprovada'],
    }
    projects.push(mine)
    const ck = (...l: [string, boolean][]) => l.map(([text, done]) => ({ id: crypto.randomUUID(), text, done }))
    tasks.push(
      { ...task(me, 'Fechar tabela de preços do Day Use', 'doing', 95, me, mine.id), priority: 'alta', due: dayAhead(0), notes: 'Adulto, criança até 12 e pacote família.',
        checklist: ck(['Adulto', true], ['Criança', true], ['Pacote família', false]) },
      { ...task(me, 'Revisar texto do site', 'todo', 85, 'demo-carla'), priority: 'media', due: dayAhead(0), collaborators: ['demo-ana'] },
      { ...task(me, 'Briefing das fotos de verão', 'todo', 75, me, mine.id), due: dayAhead(2) },
      { ...task(me, 'Responder parceria com agência de turismo', 'inbox', 30, 'demo-bruno'), notes: 'Querem 10% de comissão no Day Use. Ver se faz sentido.' },
      { ...post(me, 'Stories · Bastidores do Day Use', 'todo', 'stories', 2, 11), project_id: mine.id },
      { ...task(me, 'Planilha de hóspedes de setembro', 'done', 500), done_at: iso(400) },
      { ...task('demo-bruno', 'Arte do Day Use: carrossel 3 cards', 'review', 45, me, mine.id), notes: 'Mandei as 3 versões no anexo, a 2 é a minha preferida.' },
      { ...task('demo-ana', 'Lista de quiosques livres no sábado', 'review', 65, me, mine.id) },
      { ...task('demo-bruno', 'Vídeo curto da piscina', 'doing', 55, me, mine.id), due: dayAhead(1), collaborators: [me] },
    )
    msgsMine.push(
      { id: crypto.randomUUID(), channel: 'geral', sender_id: 'demo-bruno', body: 'Subi o carrossel do Day Use pra sua aprovação.', created_at: iso(44) },
      { id: crypto.randomUUID(), channel: 'geral', sender_id: 'demo-ana', body: 'Os quiosques 2 e 5 estão livres no sábado.', created_at: iso(15) },
    )
  }
  for (const [k, list] of Object.entries(rows)) write(K.row + k, Object.fromEntries(list.map(r => [r.id, r])))
  const notes: TaskNote[] = [
    { id: crypto.randomUUID(), task_id: tasks[0].id, author_id: 'demo-carla', body: 'O chalé 7 confirmou por WhatsApp agora há pouco.', created_at: iso(50) },
  ]
  const msgs: Message[] = [
    ...msgsMine,
    { id: crypto.randomUUID(), channel: 'geral', sender_id: 'demo-ana', body: 'Bom dia, time! ☀️', created_at: iso(180) },
    { id: crypto.randomUUID(), channel: 'geral', sender_id: 'demo-bruno', body: 'A arte do feed sai até as 16h 👀', created_at: iso(150) },
    { id: crypto.randomUUID(), channel: 'geral', sender_id: 'demo-carla', body: 'Quem puder, dá uma olhada no checklist de sábado depois.', created_at: iso(40) },
  ]
  write(K.prof, Object.fromEntries(people.map(p => [p.id, p])))
  write(K.task, Object.fromEntries(tasks.map(t => [t.id, t])))
  write(K.msg, msgs.sort((a, b) => a.created_at.localeCompare(b.created_at)))
  write(K.note, notes)
  write(K.proj, Object.fromEntries(projects.map(p => [p.id, p])))
  localStorage.setItem(K.seeded, '1')
}
