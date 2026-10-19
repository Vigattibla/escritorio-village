import { toEmail, validUser } from './login'
import { dayKey } from '../game/xp'
import { deptOf, outranks, rankOf } from '../game/ranks'
import type { CoffeeLine, Dept, JogoRes, Goal, Wallet, Group, RowTable, Rows, AccountEdit, AiContext, AiProposal, AiStage, Avatar, Backend, Handlers, Message, Pos, Profile, Project, Parceria, Poder, PoderTipo, Registro, Requisicao, Snapshot, Task, TaskNote, CassinoPainel, Torneio } from '../types'
import { ROW_TABLES } from '../types'
import { counts, DAY, MAX_GOALS, payouts, WELCOME } from '../shop/economy'
import { ITEM } from '../shop/catalog'
import { Mesa, type Escolha, type JogoCassino } from '../cassino/regras'
import { BolaoDemo, type Sorteio } from '../cassino/bolao'
import { BingoDemo, SLOT } from '../cassino/bingo'
import { localDay } from '../components/v4'
import { erroBloqueio, vigiar } from '../game/vigia'

// Modo demonstração: tudo no localStorage deste navegador. Abas diferentes = pessoas diferentes
// (a sessão fica no sessionStorage), sincronizadas por BroadcastChannel.

interface Account { id: string; email: string; hash: string; name: string }
/** cassino da demo: rodadas fechadas (placar), comissão do dia, imposto e torneios */
const CS = { fim: 'ev:cassino:fim', casa: 'ev:cassino:casa', cfg: 'ev:cassino:cfg', tor: 'ev:cassino:torneios' }
interface Fim { u: string; jogo: JogoCassino; gasto: number; premio: number; t: number }
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
      write(K.row + 'depts', { marketing: { id: 'marketing', name: 'Marketing', color: '#0B235D', floor: 1, slot: 0, canais: true, flag: 'megafone', created_at: new Date(0).toISOString() } })
    if (!localStorage.getItem(K.row + 'quartos')) seedVendas()
    if (!read<Record<string, Dept>>(K.row + 'depts', {}).obras) seedSetores()
    if (!read<Record<string, Dept>>(K.row + 'depts', {}).reservas) seedAndar3()
    if (!localStorage.getItem('ev:seed:comercial')) seedComercial()
    if (!localStorage.getItem('ev:seed:achados')) seedAchados()
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
    p = { ...p, rank: all[p.id]?.rank ?? (adm ? 1 : 3), is_admin: all[p.id]?.is_admin ?? !adm, dept: all[p.id]?.dept, cassino: all[p.id]?.cassino }
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

  async setCurtains(dept: string, open: boolean) {
    const me = read<Record<string, Profile>>(K.prof, {})[sessionStorage.getItem(K.session) ?? '']
    const d = read<Record<string, Dept>>(K.row + 'depts', {})[dept]
    if (!d) throw new Error('Essa sala não existe.')
    if (!(me?.is_admin || me?.rank === 4 || ((me?.rank ?? 1) >= 3 && (me?.dept || 'marketing') === dept))) throw new Error('Só o gerente da sala, a Chefe ou o adm mexem na cortina.')
    await this.upsertRow('depts', { ...d, curtains_open: open })
  }

  async setSalaGerente(dept: string, on: boolean) {
    const me = read<Record<string, Profile>>(K.prof, {})[sessionStorage.getItem(K.session) ?? '']
    const d = read<Record<string, Dept>>(K.row + 'depts', {})[dept]
    if (!d) throw new Error('Essa sala não existe.')
    if (!(me?.is_admin || me?.rank === 4 || ((me?.rank ?? 1) >= 3 && (me?.dept || 'marketing') === dept))) throw new Error('Só o gerente da sala, a Chefe ou o adm escolhem a sala do gerente.')
    await this.upsertRow('depts', { ...d, sala_gerente: on })
  }

  async setDeptLook(dept: string, flag: string | null, canais: boolean, vendas?: boolean) {
    const me = read<Record<string, Profile>>(K.prof, {})[sessionStorage.getItem(K.session) ?? '']
    const d = read<Record<string, Dept>>(K.row + 'depts', {})[dept]
    if (!d) throw new Error('Essa sala não existe.')
    if (!(me?.is_admin || me?.rank === 4 || ((me?.rank ?? 1) >= 3 && (me?.dept || 'marketing') === dept))) throw new Error('Só o gerente da sala, a Chefe ou o adm mudam a sala.')
    await this.upsertRow('depts', { ...d, flag, canais, vendas: vendas ?? d.vendas })
  }

  async setDeptTipo(dept: string, tipo: string | null) {
    const me = read<Record<string, Profile>>(K.prof, {})[sessionStorage.getItem(K.session) ?? '']
    const d = read<Record<string, Dept>>(K.row + 'depts', {})[dept]
    if (!d) throw new Error('Essa sala não existe.')
    if (!(me?.is_admin || me?.rank === 4 || ((me?.rank ?? 1) >= 3 && (me?.dept || 'marketing') === dept))) throw new Error('Só o gerente da sala, a Chefe ou o adm mudam o tipo do setor.')
    await this.upsertRow('depts', { ...d, tipo, abas: null })
  }

  async setDeptAbas(dept: string, abas: string[] | null) {
    const me = read<Record<string, Profile>>(K.prof, {})[sessionStorage.getItem(K.session) ?? '']
    const d = read<Record<string, Dept>>(K.row + 'depts', {})[dept]
    if (!d) throw new Error('Essa sala não existe.')
    if (!(me?.is_admin || me?.rank === 4 || ((me?.rank ?? 1) >= 3 && (me?.dept || 'marketing') === dept))) throw new Error('Só o gerente da sala, a Chefe ou o adm escolhem as abas.')
    await this.upsertRow('depts', { ...d, abas })
  }

  async parceria(de: string, para: string, modulo: string, acao: 'pedir' | 'aceitar' | 'recusar' | 'sair') {
    const me = read<Record<string, Profile>>(K.prof, {})[sessionStorage.getItem(K.session) ?? '']
    const gere = (d: string) => !!(me?.is_admin || me?.rank === 4 || ((me?.rank ?? 1) >= 3 && (me?.dept || 'marketing') === d))
    const all = read<Record<string, Parceria>>(K.row + 'parcerias', {})
    const p = Object.values(all).find(x => x.de === de && x.para === para && x.modulo === modulo)
    if (acao === 'pedir') {
      if (!gere(de)) throw new Error('Só o gerente da sala, a Chefe ou o adm pedem parceria.')
      if (p && p.status !== 'recusado') return p
      const n: Parceria = { id: p?.id ?? crypto.randomUUID(), de, para, modulo: modulo as Parceria['modulo'], status: 'pendente', por: me?.id ?? null, decidido_por: null, created_at: new Date().toISOString() }
      await this.upsertRow('parcerias', n)
      return n
    } else if (acao === 'sair') {
      if (!gere(de) && !gere(para)) throw new Error('Só o gerente de um dos lados, a Chefe ou o adm encerram.')
      if (p) await this.deleteRow('parcerias', p.id)
      return null
    } else {
      if (!gere(para)) throw new Error('Quem aceita é o gerente da sala dona, a Chefe ou o adm.')
      if (!p) throw new Error('Esse pedido não existe mais.')
      const n: Parceria = { ...p, status: acao === 'aceitar' ? 'aceito' : 'recusado', decidido_por: me?.id ?? null }
      await this.upsertRow('parcerias', n)
      return n
    }
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

  /** adm: tudo. Gerência/Chefe: só quem tem cargo menor na equipe dela (igual ao manages_account do banco) */
  private manager(target?: string, rank?: number) {
    const all = read<Record<string, Profile>>(K.prof, {}), me = all[sessionStorage.getItem(K.session) ?? '']
    if (me?.is_admin) return me
    const t = target ? all[target] : undefined
    if (!me || rankOf(me) < 3 || (target && (!t || t.is_admin || t.id === me.id || !outranks(me, t)))) throw new Error('Você não pode mexer nessa conta.')
    if (rank !== undefined && rank >= rankOf(me)) throw new Error('Você só dá cargos abaixo do seu.')
    return me
  }

  /** demo: mesma regra do requisicao_mudar, sem checar cargo */
  async requisicaoMudar(id: string, acao: string, p: Record<string, unknown>) {
    const r = read<Record<string, Requisicao>>(K.row + 'requisicoes', {})[id]
    const u = await this.currentUserId()
    if (!r || !u) throw new Error('Esse pedido não existe mais.')
    let n: Requisicao = { ...r, em: new Date().toISOString() }
    if (acao === 'editar') n = { ...n, ...(p as Partial<Requisicao>) }
    else if (acao === 'itens') {
      const meus = ((p.itens ?? []) as Requisicao['itens']).map(i => ({ ...i, por: u }))
      n.itens = p.todos ? (p.itens as Requisicao['itens']) : [...r.itens.filter(i => i.por !== u), ...meus]
    } else if (acao === 'apoio') {
      if (!r.coletivo) throw new Error('Apoio só em lista coletiva.')
      n.apoios = r.apoios.includes(u) ? r.apoios.filter(x => x !== u) : [...r.apoios, u]
    } else if (acao === 'status') {
      const st = p.status as Requisicao['status'], motivo = String(p.motivo ?? '').trim()
      if (st === 'recusado' && !motivo) throw new Error('Diga o motivo da recusa.')
      const txt = { aberto: 'Reaberto', aprovado: 'Aprovado', recusado: 'Recusado: ' + motivo, entregue: r.tipo === 'folga' ? 'Concluído' : 'Entregue', cancelado: 'Cancelado' }[st]
      n = { ...n, status: st, motivo: st === 'aberto' ? '' : motivo, decidido_por: st === 'aberto' ? null : st === 'cancelado' ? r.decidido_por : u,
        historico: [...r.historico, { em: n.em, por: u, txt: motivo && st !== 'recusado' ? `${txt} — ${motivo}` : txt }] }
    }
    await this.upsertRow('requisicoes', n)
    return n
  }

  async planoAgendar(id: string, data: string | null, dono: string | null) {
    const a = read<Record<string, Rows['plano_acoes']>>(K.row + 'plano_acoes', {})[id]
    if (!a) throw new Error('Essa ação não está mais no plano.')
    await this.upsertRow('plano_acoes', { ...a, data, dono })
  }

  async planoReservar(id: string, tarefa: string) {
    const a = read<Record<string, Rows['plano_acoes']>>(K.row + 'plano_acoes', {})[id]
    if (!a) throw new Error('Essa ação não está mais no plano.')
    if (a.tarefas.length) return false
    await this.upsertRow('plano_acoes', { ...a, tarefas: [tarefa] })
    return true
  }

  async planoSoltar(id: string, tarefa: string) {
    const a = read<Record<string, Rows['plano_acoes']>>(K.row + 'plano_acoes', {})[id]
    if (a) await this.upsertRow('plano_acoes', { ...a, tarefas: a.tarefas.filter(t => t !== tarefa) })
  }

  async createAccount(user: string, password: string, name: string, rank: number, dept?: string) {
    const me = this.manager(undefined, rank)
    if (!validUser(user)) throw new Error('Usuário inválido: use letras, números, ponto ou traço.')
    if (password.length < 6) throw new Error('A senha precisa de pelo menos 6 caracteres.')
    const accs = read<Account[]>(K.acc, [])
    const email = toEmail(user)
    if (accs.some(a => a.email === email)) throw new Error('Esse usuário já existe.')
    const id = crypto.randomUUID()
    accs.push({ id, email, hash: await sha(password), name: name.trim() })
    write(K.acc, accs)
    const p: Profile = { id, name: name.trim() || user, role: '', avatar: null, photo: null, xp: 0, desk: -1, rank, created_at: new Date().toISOString(), ...(me.is_admin ? (dept ? { dept } : {}) : { dept: deptOf(me) }) }
    await this.upsertProfileRaw(p)
    return p
  }

  async setPassword(target: string, password: string) {
    this.manager(target)
    if (password.length < 6) throw new Error('A senha precisa de pelo menos 6 caracteres.')
    const accs = read<Account[]>(K.acc, [])
    const acc = accs.find(a => a.id === target)
    if (!acc) throw new Error('Conta não encontrada.')
    acc.hash = await sha(password)
    write(K.acc, accs)
  }

  async accountLogins() {
    const me = sessionStorage.getItem(K.session) ?? ''
    const ok = (id: string) => { try { return id === me || !!this.manager(id) } catch { return false } }
    return Object.fromEntries(read<Account[]>(K.acc, []).filter(a => ok(a.id)).map(a => [a.id, a.email.split('@')[0]]))
  }

  async updateAccount(target: string, a: AccountEdit) {
    const me = target === sessionStorage.getItem(K.session) ? (this.chief(), null) : this.manager(target, a.rank)
    if (me && !me.is_admin && a.is_admin) throw new Error('Só o adm dá acesso de adm.')
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

  async saveTrail(userId: string, dia: string, pts: number[]) { localStorage.setItem(`ev:demo:trilha:${dia}:${userId}`, JSON.stringify(pts)) }
  async loadTrails(dia: string) {
    const pre = `ev:demo:trilha:${dia}:`, out: { user_id: string; pts: number[] }[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!
      if (k.startsWith(pre)) try { out.push({ user_id: k.slice(pre.length), pts: JSON.parse(localStorage.getItem(k)!) }) } catch { /* ignora */ }
    }
    return out
  }
  async pruneTrails() {}

  async upsertRow<K extends RowTable>(k: K, r: Rows[K]) {
    const all = read<Record<string, Rows[K]>>(K.row + k, {})
    all[r.id] = r
    write(K.row + k, all)
    this.post({ t: 'row', k, r })
  }

  async upsertRows<K extends RowTable>(k: K, rs: Rows[K][]) {
    const all = read<Record<string, Rows[K]>>(K.row + k, {})
    for (const r of rs) all[r.id] = r
    write(K.row + k, all)
    for (const r of rs) this.post({ t: 'row', k, r })
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
    const lat = read<{ amount: number }[]>('ev:latinhas:' + sessionStorage.getItem(K.session), [])
    return { balance: log.reduce((n, l) => n + l.amount, 0), owned: log.filter(l => l.reason === 'compra').map(l => l.ref), log, latinhas: lat.reduce((n, l) => n + l.amount, 0) }
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

  /** cassino da demo: o mesmo motor do SQL rodando aqui, extrato na carteira da pessoa */
  private mesa() {
    const me = sessionStorage.getItem(K.session)
    if (!me) throw new Error('Entre de novo para apostar.')
    const ck = 'ev:coffee:' + me, rk = 'ev:cassino:' + me
    return new Mesa({
      saldo: () => read<CoffeeLine[]>(ck, []).reduce((n, l) => n + l.amount, 0),
      lanca: (amount, reason, ref) => { const log = read<CoffeeLine[]>(ck, []); this.credit(log, amount, reason, ref, []); write(ck, log) },
      fechou: (jogo, gasto, premio) => {
        write(CS.fim, [{ u: me, jogo, gasto, premio, t: Date.now() }, ...read<Fim[]>(CS.fim, [])].slice(0, 2000))
        if (premio === 0) this.comissao(me, gasto)
      },
    }, read(rk, []), r => write(rk, r))
  }

  // ---------- conta do cassino (espelho de 202610291000_conta_cassino.sql) ----------
  private gerente() { return Object.values(read<Record<string, Profile>>(K.prof, {})).find(p => p.cassino) }
  private lanca(u: string, amount: number, reason: CoffeeLine['reason'], ref: string) {
    const k = 'ev:coffee:' + u, log = read<CoffeeLine[]>(k, [])
    this.credit(log, amount, reason, ref, []); write(k, log)
  }
  private comissao(perdedor: string, valor: number) {
    const g = this.gerente(), hoje = localDay(new Date().toISOString())
    if (!g || g.id === perdedor || valor < 1) return
    const taxa = read(CS.cfg, { taxa: 10, mudou: '' }).taxa
    let c = read(CS.casa, { dia: hoje, perdido: 0, devido: 0, pago: 0 })
    if (c.dia !== hoje) c = { dia: hoje, perdido: 0, devido: 0, pago: 0 }
    c.perdido += valor; c.devido += valor * taxa
    const dev = Math.min(50, Math.floor(c.devido / 100)) - c.pago
    if (dev >= 1) { c.pago += dev; this.lanca(g.id, dev, 'casa', `${hoje}:${c.pago}`) }
    write(CS.casa, c)
  }
  private placar(t: Torneio) {
    const prof = read<Record<string, Profile>>(K.prof, {}), i = Date.parse(t.inicio), f = Date.parse(t.fim), m = new Map<string, { lucro: number; rodadas: number }>()
    for (const r of read<Fim[]>(CS.fim, [])) {
      if (r.t < i || r.t >= f || (t.jogo !== 'todos' && r.jogo !== t.jogo) || prof[r.u]?.cassino) continue
      const x = m.get(r.u) ?? { lucro: 0, rodadas: 0 }
      x.lucro += r.premio - r.gasto; x.rodadas++; m.set(r.u, x)
    }
    return [...m].map(([u, x]) => ({ u, ...x })).sort((a, b) => b.lucro - a.lucro || a.rodadas - b.rodadas)
  }
  private torneioFechar() {
    const ts = read<Torneio[]>(CS.tor, [])
    for (const t of ts) {
      if (t.estado !== 'aberto' || Date.parse(t.fim) > Date.now()) continue
      const p = this.placar(t)
      if (p.filter(x => x.lucro > 0).length >= 2) { Object.assign(t, { estado: 'pago', vencedor: p[0].u, lucro: p[0].lucro }); this.lanca(p[0].u, t.premio, 'torneio', 'v:' + t.id) }
      else { t.estado = 'devolvido'; this.lanca(t.criado_por, t.premio, 'torneio', 'd:' + t.id) }
    }
    write(CS.tor, ts)
    return ts
  }
  async cassinoPainel(): Promise<CassinoPainel> {
    const me = read<Record<string, Profile>>(K.prof, {})[sessionStorage.getItem(K.session) ?? '']
    if (!me) throw new Error('Entre de novo.')
    const ts = this.torneioFechar(), aberto = ts.find(t => t.estado === 'aberto'), hoje = localDay(new Date().toISOString())
    const cfg = read(CS.cfg, { taxa: 10, mudou: '' }), c = read(CS.casa, { dia: hoje, perdido: 0, devido: 0, pago: 0 }), g = this.gerente()
    const mes = g ? read<CoffeeLine[]>('ev:coffee:' + g.id, []).filter(l => l.reason === 'casa' && Date.parse(l.created_at) > Date.now() - 30 * 86400_000).reduce((n, l) => n + l.amount, 0) : 0
    return {
      torneio: aberto ? { ...aberto, placar: this.placar(aberto).slice(0, 5) } : null,
      historico: ts.filter(t => t.estado !== 'aberto').slice(0, 8),
      taxa: cfg.taxa,
      casa: me.cassino || me.is_admin ? {
        perdido: c.dia === hoje ? c.perdido : 0, pago: c.dia === hoje ? c.pago : 0, teto: 50, mesada: 20, podeMudar: cfg.mudou !== hoje, mesAberto: mes,
        semana: ts.filter(t => t.criado_por === g?.id && t.estado !== 'cancelado' && Date.parse(t.created_at ?? t.inicio) > Date.now() - 7 * 86400_000).length,
      } : null,
    }
  }
  async cassinoMesada() {
    const me = read<Record<string, Profile>>(K.prof, {})[sessionStorage.getItem(K.session) ?? '']
    if (!me?.cassino) return 0
    const log = this.coffee(), out: CoffeeLine[] = []
    this.credit(log, 20, 'mesada', localDay(new Date().toISOString()), out)
    write('ev:coffee:' + me.id, log)
    return out.length ? 20 : 0
  }
  async cassinoTaxa(taxa: number) {
    const me = read<Record<string, Profile>>(K.prof, {})[sessionStorage.getItem(K.session) ?? '']
    if (!me?.cassino) throw new Error('Só a conta do cassino muda o imposto.')
    if (!Number.isInteger(taxa) || taxa < 0 || taxa > 15) throw new Error('O imposto vai de 0 a 15 por cento.')
    const cfg = read(CS.cfg, { taxa: 10, mudou: '' }), hoje = localDay(new Date().toISOString())
    if (cfg.taxa === taxa) return
    if (cfg.mudou === hoje) throw new Error('O imposto só muda uma vez por dia. Amanhã dá pra trocar de novo.')
    write(CS.cfg, { taxa, mudou: hoje })
  }
  async torneioCriar(jogo: Torneio['jogo'], premio: number, horas: number) {
    const me = read<Record<string, Profile>>(K.prof, {})[sessionStorage.getItem(K.session) ?? '']
    if (!me?.cassino) throw new Error('Só a conta do cassino cria torneio.')
    if (!Number.isInteger(premio) || premio < 10 || premio > 100) throw new Error('O prêmio vai de 10 a 100 cafezinhos.')
    if (!Number.isInteger(horas) || horas < 1 || horas > 12) throw new Error('O torneio dura de 1 a 12 horas.')
    const ts = this.torneioFechar()
    if (ts.some(t => t.estado === 'aberto')) throw new Error('Já tem um torneio rolando. Espere ele acabar.')
    if (ts.filter(t => t.criado_por === me.id && t.estado !== 'cancelado' && Date.parse(t.created_at ?? t.inicio) > Date.now() - 7 * 86400_000).length >= 3) throw new Error('Limite de 3 torneios por semana.')
    const bal = this.coffee().reduce((n, l) => n + l.amount, 0)
    if (bal < premio) throw new Error(`O prêmio sai do seu saldo: faltam ${premio - bal} cafezinhos.`)
    const agora = new Date(), t: Torneio = { id: crypto.randomUUID(), criado_por: me.id, jogo, premio, inicio: agora.toISOString(), fim: new Date(agora.getTime() + horas * 3600_000).toISOString(), estado: 'aberto', vencedor: null, lucro: null, created_at: agora.toISOString() }
    write(CS.tor, [t, ...ts])
    this.lanca(me.id, -premio, 'torneio', 'p:' + t.id)
  }
  async torneioCancelar(id: string) {
    if (!read<Record<string, Profile>>(K.prof, {})[sessionStorage.getItem(K.session) ?? '']?.is_admin) throw new Error('Só o adm cancela torneio.')
    const ts = read<Torneio[]>(CS.tor, []), t = ts.find(x => x.id === id && x.estado === 'aberto')
    if (!t) throw new Error('Esse torneio já acabou.')
    t.estado = 'cancelado'; write(CS.tor, ts)
    this.lanca(t.criado_por, t.premio, 'torneio', 'd:' + t.id)
  }
  async setCassino(id: string, on: boolean) {
    const all = read<Record<string, Profile>>(K.prof, {})
    if (!all[sessionStorage.getItem(K.session) ?? '']?.is_admin) throw new Error('Só o adm marca a conta do cassino.')
    const t = all[id]
    if (!t) throw new Error('Conta não encontrada.')
    if (on && t.is_admin) throw new Error('Conta de adm não pode ser a conta do cassino.')
    if (on && Object.values(all).some(p => p.cassino && p.id !== id)) throw new Error('Já existe uma conta do cassino. Desmarque a outra primeiro.')
    await this.upsertProfileRaw({ ...t, cassino: on })
  }

  /** vigia dos jogos (mesmas regras do SQL): bloqueado → erro marcado; senão conta a partida */
  private limiteDia() { return read<Record<string, Profile>>(K.prof, {})[sessionStorage.getItem(K.session) ?? '']?.cassino ? 480 : 240 }
  private vigia() {
    const k = 'ev:vigia:' + sessionStorage.getItem(K.session), ts = read<number[]>(k, [])
    const b = vigiar(ts, Date.now(), this.limiteDia())
    if (b) throw erroBloqueio(b)
    write(k, [...ts.filter(t => t > Date.now() - 2 * 86400_000), Date.now()])
  }
  async jogosBloqueio() { return vigiar(read<number[]>('ev:vigia:' + sessionStorage.getItem(K.session), []), Date.now(), this.limiteDia()) }
  async cassinoJogar(jogo: JogoCassino, aposta: number, e: Escolha) { this.vigia(); return this.mesa().jogar(jogo, aposta, e) }
  async cassinoAbrir(jogo: JogoCassino, aposta: number, e: Escolha) { if (!(await this.mesa().estado(jogo))) this.vigia(); return this.mesa().abrir(jogo, aposta, e) }
  async cassinoAcao(id: string, acao: string, casa?: number) { return this.mesa().acao(id, acao, casa) }
  async cassinoEstado(jogo: JogoCassino) { return this.mesa().estado(jogo) }

  /** sala de jogos da demo: mesmo jogo do SQL, sem teto; quem grava o recorde é o app */
  private partidas = new Map<string, { cartas: number[]; t0: number; pend: number | null; achadas: number[]; erros: number }>()
  async jogos(fn: 'iniciar' | 'fim' | 'virar', a: Record<string, unknown>): Promise<JogoRes> {
    if (fn === 'iniciar') {
      this.vigia()
      const id = crypto.randomUUID()
      this.partidas.set(id, { cartas: Array.from({ length: 16 }, (_, i) => i % 8).map(f => ({ f, k: Math.random() })).sort((x, y) => x.k - y.k).map(x => x.f), t0: 0, pend: null, achadas: [], erros: 0 })
      return { id }
    }
    const p = this.partidas.get(String(a.p_id))
    if (!p) throw new Error('Partida não encontrada.')
    if (fn === 'fim') { this.partidas.delete(String(a.p_id)); return { pontos: Math.max(0, Math.round(Number(a.p_pontos) || 0)), valeu: true, local: true } }
    const pos = Number(a.p_pos)
    if (!p.t0) p.t0 = Date.now()
    if (p.pend === null || p.pend === pos) { p.pend = pos; return { pos, f: p.cartas[pos], erros: p.erros } }
    const outra = p.pend, par = p.cartas[outra] === p.cartas[pos]
    p.pend = null
    if (par) p.achadas.push(outra, pos); else p.erros++
    if (p.achadas.length < 16) return { pos, f: p.cartas[pos], outra, par, erros: p.erros }
    const seg = Math.floor((Date.now() - p.t0) / 1000)
    return { pos, f: p.cartas[pos], outra, par, erros: p.erros, fim: true, seg, pontos: Math.max(100, 1000 - p.erros * 30 - seg * 5), local: true }
  }

  /** bolão da demo: o resto do time entra com bilhetes fixos por semana */
  private bolao() {
    const me = sessionStorage.getItem(K.session)
    if (!me) throw new Error('Entre de novo.')
    const ck = 'ev:coffee:' + me, lk = 'ev:latinhas:' + me
    const lat = () => read<{ amount: number; ref: string }[]>(lk, [])
    return new BolaoDemo({
      me,
      extrato: () => read<CoffeeLine[]>(ck, []),
      lanca: (amount, reason, ref) => { const log = read<CoffeeLine[]>(ck, []); this.credit(log, amount, reason, ref, []); write(ck, log) },
      latinhas: () => lat().reduce((n, l) => n + l.amount, 0),
      lancaLatinha: (amount, ref) => { const l = lat(); if (!l.some(x => x.ref === ref)) write(lk, [{ amount, ref }, ...l]) },
      sorteios: () => read<Sorteio[]>('ev:bolao', []),
      salva: v => write('ev:bolao', v),
      outros: () => Object.keys(read<Record<string, Profile>>(K.prof, {})).filter(id => id !== me).slice(0, 5).map((u, i) => ({ u, n: 1 + ((i * 3 + 2) % 5) })),
    })
  }
  /** poderes da demo: mesmo sorteio do SQL (segunda 9h, 3 pessoas, peso por fase/meta), guardado em ev:row:poderes */
  async poderesEstado(): Promise<Poder[]> {
    const me = sessionStorage.getItem(K.session)
    if (!me) throw new Error('Entre de novo.')
    const all = read<Record<string, Poder>>(K.row + 'poderes', {})
    const d = new Date(); d.setHours(d.getHours() - 9); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); d.setHours(9, 0, 0, 0)
    const sem = d.toISOString(), now = Date.now()
    if (!Object.values(all).some(p => p.semana === sem)) {
      const log = this.coffee(), desde = d.getTime() - 7 * 864e5
      const pts = (u: string) => u !== me ? 0 : log.filter(l => new Date(l.created_at).getTime() >= desde && new Date(l.created_at).getTime() < d.getTime()).reduce((n, l) => n + (l.reason === 'fase' ? 1 : l.reason === 'meta' ? 2 : 0), 0)
      const gente = Object.values(read<Record<string, Profile>>(K.prof, {})).filter(p => p.avatar).map(p => ({ u: p.id, k: Math.pow(Math.random(), 1 / (1 + pts(p.id))) })).sort((a, b) => b.k - a.k).slice(0, 3)
      let tipos: PoderTipo[] = ['ima', 'coringa', 'mesada', 'megafone', 'turbo', 'chefe', 'visao']
      const horas: Record<PoderTipo, number> = { ima: 48, coringa: 72, mesada: 72, megafone: 24, turbo: 168, chefe: 24, visao: 96 }
      const novos = gente.map(({ u }) => {
        const tipo = tipos[Math.floor(Math.random() * tipos.length)]
        tipos = tipos.filter(t => t !== tipo)
        return { id: crypto.randomUUID(), user_id: u, tipo, motivo: 'sorteio', semana: sem, inicio: new Date(now).toISOString(), fim: new Date(now + horas[tipo] * 36e5).toISOString(), aviso: null, avisado_em: null, created_at: new Date(now).toISOString() } as Poder
      })
      await this.upsertRows('poderes', novos)
      for (const p of novos) await this.sendMessage({ id: crypto.randomUUID(), channel: 'geral', sender_id: p.user_id, body: `✨ Ganhei o poder ${p.tipo} no sorteio da semana.`, created_at: p.created_at })
      for (const p of novos) all[p.id] = p
    }
    const hoje = localDay(new Date().toISOString()), log = this.coffee()
    for (const p of Object.values(all)) if (p.user_id === me && (p.tipo === 'mesada' || p.tipo === 'coringa') && new Date(p.inicio).getTime() <= now && new Date(p.fim).getTime() > now)
      this.credit(log, p.tipo === 'mesada' ? 15 : 0, p.tipo === 'mesada' ? 'poder' : 'coringa', `${p.tipo}:${p.id}:${hoje}`, [])
    write('ev:coffee:' + me, log)
    return Object.values(all).filter(p => new Date(p.fim).getTime() > now - 7 * 864e5)
  }
  async megafone(texto: string) {
    const me = sessionStorage.getItem(K.session), t = texto.trim()
    if (t.length < 1 || t.length > 200) throw new Error('O aviso precisa ter de 1 a 200 letras.')
    const now = Date.now(), p = Object.values(read<Record<string, Poder>>(K.row + 'poderes', {})).find(p => p.user_id === me && p.tipo === 'megafone' && !p.aviso && new Date(p.fim).getTime() > now)
    if (!p || !me) throw new Error('Você não tem megafone para usar.')
    await this.upsertRow('poderes', { ...p, aviso: t, avisado_em: new Date(now).toISOString() })
    await this.sendMessage({ id: crypto.randomUUID(), channel: 'geral', sender_id: me, body: '📣 ' + t, created_at: new Date(now).toISOString() })
  }
  async visaoBolao() {
    const me = sessionStorage.getItem(K.session), now = Date.now()
    if (!Object.values(read<Record<string, Poder>>(K.row + 'poderes', {})).some(p => p.user_id === me && p.tipo === 'visao' && new Date(p.fim).getTime() > now)) throw new Error('Só quem tem o poder Visão vê isso.')
    const b = this.bolao(), e = await b.estado()
    return [...Object.keys(read<Record<string, Profile>>(K.prof, {})).filter(id => id !== me).slice(0, 5).map((u, i) => ({ u, n: 1 + ((i * 3 + 2) % 5) })), { u: me!, n: e.gratis + e.comprados }].sort((a, b) => b.n - a.n).slice(0, 5)
  }
  async bolaoEstado() { return this.bolao().estado() }
  async bolaoComprar() { return this.bolao().comprar() }
  async trocarLatinha() { return this.bolao().trocar() }

  /** bingo da demo: o resto do time joga toda rodada; ev:bingo:slot (segundos) acelera pra teste */
  private bingo() {
    const me = sessionStorage.getItem(K.session)
    if (!me) throw new Error('Entre de novo.')
    const ck = 'ev:coffee:' + me, lk = 'ev:latinhas:' + me
    const lat = () => read<{ amount: number; ref: string }[]>(lk, [])
    return new BingoDemo({
      me,
      extrato: () => read<CoffeeLine[]>(ck, []),
      lanca: (amount, reason, ref) => { const log = read<CoffeeLine[]>(ck, []); this.credit(log, amount, reason, ref, []); write(ck, log) },
      latinhas: () => lat().reduce((n, l) => n + l.amount, 0),
      lancaLatinha: (amount, ref) => { const l = lat(); if (!l.some(x => x.ref === ref)) write(lk, [{ amount, ref }, ...l]) },
      rodadas: () => read('ev:bingo', []),
      salva: v => write('ev:bingo', v),
      outros: () => Object.keys(read<Record<string, Profile>>(K.prof, {})).filter(id => id !== me).slice(0, 4),
      slot: (Number(localStorage.getItem('ev:bingo:slot')) || SLOT / 1000) * 1000,
    })
  }
  async bingoEstado() { return this.bingo().estado() }
  async bingoComprar(gratis: boolean) { this.vigia(); return this.bingo().comprar(gratis) }

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
/** Comercial de exemplo: sala que vende, quadro de quartos, vendas do mês, metas, tiers/prêmios e campanhas */
function seedVendas() {
  const now = new Date(), t0 = new Date(0).toISOString()
  const dia = (d: number) => dayKey(new Date(now.getTime() + d * 864e5))
  const ago = (h: number) => new Date(now.getTime() - h * 36e5).toISOString()
  const depts = read<Record<string, Dept>>(K.row + 'depts', {})
  if (!depts.comercial) write(K.row + 'depts', { ...depts, comercial: { id: 'comercial', name: 'Comercial', color: '#FF7A1A', floor: 1, slot: 1, vendas: true, flag: 'cifrao', created_at: t0 } })
  const q = (id: string, nome: string, total: number, pos: number, cor: string) => ({ id, nome, total, pos, cor, ativo: true, created_by: null, created_at: t0 })
  const quartos = [q('q-chale', 'Chalé', 12, 1, '#2440FF'), q('q-suite', 'Suíte Orquídea', 6, 2, '#FF7A1A'), q('q-familia', 'Apto Família', 8, 3, '#FF9ECF'), q('q-tulipa', 'Cubo Tulipa', 4, 4, '#3fa66b')]
  write(K.row + 'quartos', Object.fromEntries(quartos.map(x => [x.id, x])))
  const v = (user_id: string, quarto_id: string, de: number, noites: number, qtd: number, valor: number, h: number) =>
    ({ id: crypto.randomUUID(), user_id, quarto_id, entrada: dia(de), saida: dia(de + noites), qtd, valor, nota: null, created_by: user_id, created_at: ago(h) })
  const vendas = [
    v('demo-ana', 'q-chale', 1, 2, 2, 2380, 3), v('demo-ana', 'q-suite', 3, 3, 1, 2970, 20), v('demo-ana', 'q-familia', 0, 2, 1, 1560, 30),
    v('demo-bruno', 'q-chale', 2, 2, 3, 3570, 5), v('demo-bruno', 'q-tulipa', 5, 1, 1, 690, 50),
    v('demo-carla', 'q-suite', 1, 2, 2, 3960, 8), v('demo-carla', 'q-chale', 4, 3, 2, 3570, 26), v('demo-carla', 'q-familia', 6, 2, 3, 4680, 70), v('demo-carla', 'q-chale', -2, 2, 1, 1190, 96),
  ]
  write(K.row + 'vendas', Object.fromEntries(vendas.map(x => [x.id, x])))
  write(K.row + 'ajustes', {})
  const mes = dia(0).slice(0, 7)
  write(K.row + 'metas_venda', {
    [mes + ':time']: { id: mes + ':time', user_id: null, mes, alvo: 60000, created_by: null, created_at: t0 },
    [mes + ':demo-ana']: { id: mes + ':demo-ana', user_id: 'demo-ana', mes, alvo: 15000, created_by: 'demo-ana', created_at: t0 },
  })
  write(K.row + 'vendas_cfg', { cfg: {
    id: 'cfg', pts_venda: 10, pts_mil: 10, pasta: null, created_at: t0,
    tiers: [{ nome: 'Bronze', min: 0, cor: '#C98A4B' }, { nome: 'Prata', min: 100, cor: '#9AA3B5' }, { nome: 'Ouro', min: 250, cor: '#E8B400' }, { nome: 'Diamante', min: 500, cor: '#2440FF' }],
    premios: [{ titulo: 'Jantar no restaurante', regra: 'valor', alvo: 15000 }, { titulo: 'Day off', regra: 'pontos', alvo: 400 }, { titulo: 'Vale-presente R$ 200', regra: 'vendas', alvo: 10 }],
  } })
  const c = (titulo: string, texto: string, de: number, ate: number, cor: string, link: string | null) =>
    ({ id: crypto.randomUUID(), titulo, texto, inicio: dia(de), fim: dia(ate), cor, pasta: null, link, created_by: 'demo-bruno', created_at: t0 })
  const camps = [
    c('Semana das Crianças', 'Pacote família com 2 noites + recreação o dia todo. Argumento: monitores das 8h às 22h, duas turmas por idade.', -3, 4, '#FF7A1A', null),
    c('Feriado de novembro', 'Pré-venda com 10% até dia 20. Mínimo de 3 noites nos chalés.', 0, 30, '#2440FF', null),
  ]
  write(K.row + 'campanhas', Object.fromEntries(camps.map(x => [x.id, x])))
}

/** outros setores de exemplo no 2º andar (obras, governança, recepção, A&B), cada um com as abas do seu tipo e alguns registros */
function seedSetores() {
  const now = new Date(), t0 = new Date(0).toISOString()
  const dia = (d: number) => dayKey(new Date(now.getTime() + d * 864e5))
  const ago = (h: number) => new Date(now.getTime() - h * 36e5).toISOString()
  const depts = read<Record<string, Dept>>(K.row + 'depts', {})
  const d = (id: string, name: string, color: string, slot: number, tipo: string, flag: string): Dept => ({ id, name, color, floor: 2, slot, tipo, flag, created_at: t0 })
  write(K.row + 'depts', {
    ...depts,
    obras: d('obras', 'Obras', '#C98A4B', 0, 'obras', 'martelo'),
    governanca: d('governanca', 'Governança', '#3fa66b', 1, 'governanca', 'cama'),
    recepcao: d('recepcao', 'Recepção', '#2440FF', 2, 'recepcao', 'sino'),
    ab: d('ab', 'Alimentos e bebidas', '#E8B400', 3, 'ab', 'xicara'),
  })
  let pos = 0
  const r = (dept: string, modulo: string, titulo: string, status: string, campos: Record<string, unknown> = {}, h = 2): Registro =>
    ({ id: crypto.randomUUID(), dept, modulo, titulo, status, campos, pos: pos++, por: 'demo-ana', created_at: ago(h), em: ago(h) })
  const regs = [
    r('obras', 'obras', 'Reforma dos chalés 1 a 4', 'andamento', { local: 'Chalés', resp: 'demo-bruno', previsao: dia(20), avanco: 45, orcamento: 180000, gasto: 72000 }),
    r('obras', 'obras', 'Deck da piscina', 'planejada', { local: 'Piscina', previsao: dia(45), orcamento: 38000 }),
    r('obras', 'obras', 'Telhado do restaurante', 'parada', { local: 'Restaurante', resp: 'demo-carla', previsao: dia(-3), avanco: 70, orcamento: 52000, gasto: 41000 }),
    r('obras', 'obras', 'Playground novo', 'vistoria', { local: 'Gramado', previsao: dia(2), avanco: 95, orcamento: 24000, gasto: 23100 }),
    r('obras', 'diarioobra', 'Equipe de 6. Reboco do chalé 2 terminado, começou o 3.', 'nota', { turno: 'Manhã' }, 5),
    r('obras', 'diarioobra', 'Chuva parou a obra do telhado às 14h. Lona colocada.', 'pendente', { turno: 'Tarde' }, 26),
    r('obras', 'diarioobra', 'Chegaram 40 sacos de argamassa e o piso do deck.', 'nota', { turno: 'Manhã' }, 30),
    r('obras', 'compras', 'Telhas cerâmicas', 'pedido', { qtd: '600 un', fornecedor: 'Cerâmica Sul', valor: 4800, previsao: dia(5) }),
    ...['101', '102', '103', '104', '105', '106', '201', '202', '203', '204', '205', '206'].map((q, i) =>
      r('governanca', 'uhs', q, ['suja', 'limpando', 'limpa', 'inspecionada', 'ocupada', 'ocupada', 'suja', 'limpa', 'bloqueada', 'ocupada', 'inspecionada', 'suja'][i], { bloco: q[0] === '1' ? 'Bloco A' : 'Bloco B', camareira: i % 2 ? 'demo-carla' : 'demo-ana' })),
    r('governanca', 'rotina', 'Conferir frigobar dos quartos ocupados', 'ativo', { turno: 'Manhã', resp: 'demo-carla' }),
    r('governanca', 'rotina', 'Levar enxoval sujo pra lavanderia', 'ativo', { turno: 'Tarde' }),
    r('governanca', 'estoque', 'Toalha de banho', 'ok', { qtd: 38, min: 60, unid: 'un', local: 'Rouparia' }),
    r('governanca', 'estoque', 'Sabonete', 'ok', { qtd: 240, min: 100, unid: 'un', local: 'Almoxarifado' }),
    r('governanca', 'estoque', 'Papel higiênico', 'ok', { qtd: 12, min: 20, unid: 'pct', local: 'Almoxarifado' }),
    r('recepcao', 'chegadas', 'Família Souza', 'previsto', { quarto: 'Chalé 3', entrada: dia(0), saida: dia(2), pessoas: 4 }),
    r('recepcao', 'chegadas', 'Marina e Paulo', 'chegou', { quarto: 'Suíte 2', entrada: dia(0), saida: dia(3), pessoas: 2 }),
    r('recepcao', 'chegadas', 'Grupo Escola Alfa', 'previsto', { quarto: 'Aptos 201–206', entrada: dia(1), saida: dia(3), pessoas: 28 }),
    r('recepcao', 'pedhosp', 'Berço no quarto', 'aberto', { quarto: '104', tipo: 'Berço / cama extra', quando: '15:00' }),
    r('recepcao', 'pedhosp', 'Late check-out até 14h', 'andamento', { quarto: 'Chalé 1', tipo: 'Late check-out', resp: 'demo-ana' }),
    r('recepcao', 'turno', 'Hóspede do 203 pediu travesseiro extra, já entregue', 'nota', { turno: 'Noite' }, 10),
    r('recepcao', 'turno', 'Ar do 105 pingando, chamado aberto pra manutenção', 'pendente', { turno: 'Manhã' }, 3),
    r('ab', 'cardapio', 'Pão de queijo, frutas e omelete', 'ok', { dia: dia(0), hora: '07:00', publico: 'Café da manhã', local: 'Restaurante' }),
    r('ab', 'cardapio', 'Feijoada completa', 'ok', { dia: dia(0), hora: '12:00', publico: 'Almoço', local: 'Restaurante', resp: 'demo-bruno' }),
    r('ab', 'cardapio', 'Massas ao molho', 'ok', { dia: dia(1), hora: '19:30', publico: 'Jantar', local: 'Restaurante' }),
    r('ab', 'cardapio', 'Petiscos e sucos', 'ok', { dia: dia(2), hora: '15:00', publico: 'Lanche', local: 'Bar da piscina' }),
    r('ab', 'estoque', 'Óleo de soja', 'ok', { qtd: 4, min: 10, unid: 'L', local: 'Despensa' }),
    r('ab', 'estoque', 'Arroz', 'ok', { qtd: 50, min: 20, unid: 'kg', local: 'Despensa' }),
    r('ab', 'rotina', 'Conferir temperatura das câmaras frias', 'ativo', { turno: 'Abertura', resp: 'demo-bruno' }),
    // escala da semana inteira (seg a dom): cozinha todo dia com uma folga, salão no almoço, bar no fim de semana
    ...[0, 1, 2, 3, 4, 5, 6].flatMap(k => {
      const off = k - (now.getDay() + 6) % 7, fds = k >= 4
      return [
        r('ab', 'escala', 'Cozinheiro', k === 2 ? 'cancelada' : 'ok', { dia: dia(off), hora: '06:00', resp: 'demo-bruno', local: 'Cozinha', publico: 'Manhã', ...(k === 2 ? { obs: 'Folga' } : {}) }),
        r('ab', 'escala', 'Garçom', 'ok', { dia: dia(off), hora: '11:00', resp: 'demo-ana', local: 'Restaurante', publico: 'Intermediário' }),
        ...(fds ? [r('ab', 'escala', 'Bar da piscina', 'ok', { dia: dia(off), hora: '14:00', resp: 'demo-carla', local: 'Bar', publico: 'Tarde' })] : []),
      ]
    }),
  ]
  gravaRegs(regs)
}

/** semear de novo não duplica: sai o que já havia desses setores */
function gravaRegs(regs: Registro[]) {
  const novos = new Set(regs.map(x => x.dept))
  const antes = Object.entries(read<Record<string, Registro>>(K.row + 'registros', {})).filter(([, x]) => !novos.has(x.dept))
  write(K.row + 'registros', { ...Object.fromEntries(antes), ...Object.fromEntries(regs.map(x => [x.id, x])) })
}

/** 3º andar de exemplo: central de reservas, RH, manutenção e recreação */
function seedAndar3() {
  const now = new Date(), t0 = new Date(0).toISOString()
  const dia = (d: number) => dayKey(new Date(now.getTime() + d * 864e5))
  const ago = (h: number) => new Date(now.getTime() - h * 36e5).toISOString()
  const seg = (k: number) => dia(k - (now.getDay() + 6) % 7)
  const d = (id: string, name: string, color: string, slot: number, tipo: string, flag: string): Dept => ({ id, name, color, floor: 3, slot, tipo, flag, created_at: t0 })
  write(K.row + 'depts', {
    ...read<Record<string, Dept>>(K.row + 'depts', {}),
    reservas: d('reservas', 'Central de reservas', '#7A4BD1', 0, 'reservas', 'balao'),
    rh: d('rh', 'RH', '#D14B7A', 1, 'rh', 'coracao'),
    manutencao: d('manutencao', 'Manutenção', '#5B6B7A', 2, 'manutencao', 'chave'),
    recreacao: d('recreacao', 'Recreação', '#FF7A1A', 3, 'recreacao', 'sol'),
  })
  let pos = 0
  const r = (dept: string, modulo: string, titulo: string, status: string, campos: Record<string, unknown> = {}, h = 2): Registro =>
    ({ id: crypto.randomUUID(), dept, modulo, titulo, status, campos, pos: pos++, por: 'demo-ana', created_at: ago(h), em: ago(h) })
  const prog: [number, string, string, string, string][] = [
    [0, '09:00', 'Gincana na piscina', 'Piscina', 'Todas as idades'], [0, '15:00', 'Oficina de pintura', 'Salão', '04 a 07'],
    [1, '10:00', 'Caça ao tesouro', 'Gramado', '08 a 12'], [2, '16:00', 'Futebol de sabão', 'Campo', 'Adolescentes'],
    [3, '09:30', 'Hidroginástica', 'Piscina', 'Adultos'], [4, '20:00', 'Cinema ao ar livre', 'Gramado', 'Família'],
    [5, '10:00', 'Tirolesa', 'Mata', '08 a 12'], [5, '15:00', 'Teatro de fantoches', 'Salão', '04 a 07'], [6, '11:00', 'Passeio a cavalo', 'Haras', 'Família'],
  ]
  gravaRegs([
    r('reservas', 'reservas', 'Família Andrade', 'cotacao', { tel: '(31) 99876-1122', entrada: dia(6), saida: dia(9), adultos: 2, criancas: 2, quarto: 'Chalé família', canal: 'WhatsApp', valor: 3900 }),
    r('reservas', 'reservas', 'Marina e Paulo', 'pagamento', { tel: '(31) 98765-4433', entrada: dia(13), saida: dia(15), adultos: 2, quarto: 'Suíte Orquídea', canal: 'Instagram', valor: 2100 }),
    r('reservas', 'reservas', 'Grupo Souza (3 quartos)', 'confirmada', { entrada: dia(2), saida: dia(4), adultos: 6, criancas: 3, quarto: '3 apartamentos', canal: 'Telefone', valor: 6300 }),
    r('reservas', 'reservas', 'Carlos Lima', 'contato', { tel: '(11) 97654-2211', entrada: dia(20), saida: dia(22), adultos: 2, canal: 'Site' }),
    r('reservas', 'grupos', 'Casamento Júlia & Rafa', 'bloqueio', { resp: 'Júlia', entrada: dia(40), saida: dia(42), quartos: 18, pessoas: 60, opcao: dia(7) }),
    r('reservas', 'grupos', 'Convenção farmacêutica', 'contrato', { resp: 'Patrícia', entrada: dia(25), saida: dia(27), quartos: 30, pessoas: 80, opcao: dia(-2) }),
    r('reservas', 'retornos', 'Família Andrade', 'aberto', { tel: '(31) 99876-1122', quando: dia(0), assunto: 'Confirmar se fecham o chalé' }),
    r('reservas', 'retornos', 'Carlos Lima', 'sem', { tel: '(11) 97654-2211', quando: dia(-1), assunto: 'Mandou mensagem pelo site' }),
    r('reservas', 'turno', 'Booking com overbooking no feriado: segurei 2 chalés', 'pendente', { turno: 'Tarde' }, 4),
    r('rh', 'admissao', 'Luana Ribeiro', 'entrevista', { cargo: 'Camareira', setor: 'Governança', inicio: dia(10) }),
    r('rh', 'admissao', 'Diego Martins', 'docs', { cargo: 'Garçom', setor: 'A&B', inicio: dia(3) }),
    r('rh', 'admissao', 'Renata Alves', 'triagem', { cargo: 'Recepcionista', setor: 'Recepção' }),
    r('rh', 'admissao', 'Tiago Rocha', 'contratado', { cargo: 'Monitor', setor: 'Recreação', inicio: dia(-5) }),
    r('rh', 'ferias', 'Bruno', 'aprovado', { tipo: 'Férias', inicio: dia(15), fim: dia(29), cobre: 'demo-carla' }),
    r('rh', 'ferias', 'Ana', 'pedido', { tipo: 'Folga', inicio: dia(4), fim: dia(4) }),
    r('rh', 'avisos', 'Exame periódico: todos até sexta, no posto da cidade', 'pendente', {}, 20),
    r('rh', 'avisos', 'Uniforme novo chega segunda; trocar na rouparia', 'nota', {}, 48),
    ...[0, 2, 4, 5, 6].map(k => r('rh', 'escala', 'Plantão do RH', 'ok', { dia: seg(k), hora: '08:00', resp: 'demo-ana', local: 'RH', publico: 'Manhã' })),
    r('manutencao', 'os', 'Ar do 105 pingando', 'atendimento', { local: 'Apto 105', cat: 'Ar-condicionado', urg: 'Alta', resp: 'demo-bruno', prazo: dia(0) }),
    r('manutencao', 'os', 'Lâmpada queimada no corredor B', 'aberta', { local: 'Bloco B', cat: 'Elétrica', urg: 'Baixa', prazo: dia(2) }),
    r('manutencao', 'os', 'Bomba da piscina fazendo barulho', 'peca', { local: 'Piscina', cat: 'Piscina', urg: 'Média', resp: 'demo-bruno', prazo: dia(-1) }),
    r('manutencao', 'os', 'Porta do chalé 3 emperrando', 'resolvida', { local: 'Chalé 3', cat: 'Marcenaria', urg: 'Média' }),
    r('manutencao', 'rotina', 'Medir cloro e pH da piscina', 'ativo', { turno: 'Abertura', resp: 'demo-bruno' }),
    r('manutencao', 'rotina', 'Ronda nos quadros de luz', 'ativo', { turno: 'Tarde' }),
    r('manutencao', 'estoque', 'Lâmpada LED 9W', 'ok', { qtd: 6, min: 20, unid: 'un', local: 'Oficina' }),
    r('manutencao', 'estoque', 'Cloro granulado', 'ok', { qtd: 30, min: 10, unid: 'kg', local: 'Casa de máquinas' }),
    r('manutencao', 'compras', 'Selo mecânico da bomba', 'cotando', { qtd: '1 un', fornecedor: 'Piscinas BH', valor: 380, previsao: dia(3) }),
    ...prog.map(([k, hora, t, local, publico]) => r('recreacao', 'programacao', t, 'ok', { dia: seg(k), hora, local, publico, resp: k % 2 ? 'demo-carla' : 'demo-ana' })),
    r('recreacao', 'rotina', 'Conferir coletes da piscina', 'ativo', { turno: 'Abertura' }),
    r('recreacao', 'estoque', 'Tinta guache', 'ok', { qtd: 8, min: 12, unid: 'pote', local: 'Salão' }),
  ])
}

/** registros de exemplo da sala Comercial: funil, eventos e retornos */
function seedComercial() {
  localStorage.setItem('ev:seed:comercial', '1')
  const now = new Date()
  const dia = (d: number) => dayKey(new Date(now.getTime() + d * 864e5))
  const ago = (h: number) => new Date(now.getTime() - h * 36e5).toISOString()
  let pos = 0
  const r = (modulo: string, titulo: string, status: string, campos: Record<string, unknown> = {}, h = 2): Registro =>
    ({ id: crypto.randomUUID(), dept: 'comercial', modulo, titulo, status, campos, pos: pos++, por: 'demo-carla', created_at: ago(h), em: ago(h) })
  const regs = [
    r('leads', 'Patrícia (RH)', 'proposta', { empresa: 'Farmácia Vida', origem: 'Indicação', valor: 42000, retorno: dia(-1) }),
    r('leads', 'Marcos', 'contato', { empresa: 'Escola Horizonte', origem: 'Prospecção', valor: 15000, retorno: dia(0) }),
    r('leads', 'Agência Rota Sul', 'novo', { empresa: 'Rota Sul Viagens', origem: 'Agência', retorno: dia(3) }),
    r('leads', 'Cláudia', 'negociacao', { empresa: 'Construtora Pilar', origem: 'Feira', valor: 68000, retorno: dia(5) }),
    r('leads', 'Igreja São José', 'ganho', { origem: 'Indicação', valor: 21000 }, 30),
    r('eventos', 'Casamento Júlia & Rafa', 'fechado', { cliente: 'Júlia', data: dia(40), convidados: 120, espaco: 'Gramado', valor: 58000 }),
    r('eventos', 'Aniversário 15 anos Bia', 'proposta', { cliente: 'Sônia', data: dia(5), convidados: 80, espaco: 'Salão', valor: 18000 }),
    r('eventos', 'Confraternização Pilar', 'consulta', { cliente: 'Construtora Pilar', data: dia(24), convidados: 150, espaco: 'Restaurante' }),
    r('eventos', 'Batizado Theo', 'fechado', { cliente: 'Renata', data: dia(3), convidados: 40, espaco: 'Quiosque', valor: 6500 }),
    r('eventos', 'Bodas de prata', 'realizado', { cliente: 'Sr. Antônio', data: dia(-6), convidados: 60, espaco: 'Salão', valor: 12000 }, 200),
    r('retornos', 'Sônia', 'aberto', { quando: dia(0), assunto: 'Cardápio do aniversário' }),
    r('retornos', 'Marcos', 'aberto', { quando: dia(-2), assunto: 'Mandar proposta revisada' }),
    r('retornos', 'Rota Sul Viagens', 'sem', { quando: dia(4), assunto: 'Tarifário de agência' }),
  ]
  write(K.row + 'registros', { ...read<Record<string, Registro>>(K.row + 'registros', {}), ...Object.fromEntries(regs.map(x => [x.id, x])) })
}

/** achados e perdidos da recepção: um guardado há mais de 30 dias, um sem dono, um devolvido */
function seedAchados() {
  localStorage.setItem('ev:seed:achados', '1')
  const now = new Date()
  const dia = (d: number) => dayKey(new Date(now.getTime() + d * 864e5))
  const ago = (h: number) => new Date(now.getTime() - h * 36e5).toISOString()
  let pos = 0
  const r = (titulo: string, status: string, campos: Record<string, unknown>, h = 2): Registro =>
    ({ id: crypto.randomUUID(), dept: 'recepcao', modulo: 'achados', titulo, status, campos, pos: pos++, por: 'demo-ana', created_at: ago(h), em: ago(h) })
  const regs = [
    r('Óculos de sol preto', 'guardado', { local: 'Piscina', data: dia(-2), guarda: 'Gaveta da recepção' }),
    r('Boné infantil azul', 'guardado', { local: 'Parquinho', data: dia(-41), guarda: 'Caixa de achados', dono: '' }, 980),
    r('Carregador de celular', 'guardado', { local: 'Apto 108', data: dia(-5), guarda: 'Gaveta da recepção', dono: 'Sr. Henrique (31) 99811-2030' }),
    r('Toalha de praia estampada', 'devolvido', { local: 'Quiosque', data: dia(-8), guarda: 'Rouparia', dono: 'Família Andrade' }, 30),
  ]
  write(K.row + 'registros', { ...read<Record<string, Registro>>(K.row + 'registros', {}), ...Object.fromEntries(regs.map(x => [x.id, x])) })
}

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
      ? [{ id: crypto.randomUUID(), to_id: sessionStorage.getItem(K.session)!, by_id: 'demo-carla', kind: 'mandou-bem', text: 'Mandou bem no Reels!', x: 0.95, y: 0.95, created_at: iso(20) }]
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
