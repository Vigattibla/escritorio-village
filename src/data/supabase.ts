import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js'
import { slugUser, toEmail } from './login'
import type { AiContext, AiProposal, AiStage, Backend, Handlers, Message, Pos, Profile, Project, Snapshot, Task, TaskNote } from '../types'

function pt(e: { message: string }): Error {
  const m = e.message
  if (/invalid login/i.test(m)) return new Error('Usuário ou senha incorretos.')
  if (/already registered/i.test(m)) return new Error('Esse e-mail já tem conta. Use "Entrar".')
  if (/password/i.test(m) && /6/.test(m)) return new Error('A senha precisa de pelo menos 6 caracteres.')
  if (/row-level security/i.test(m)) return new Error('Sem permissão para isso.')
  if (/exceeded the maximum allowed size|payload too large/i.test(m)) return new Error('Arquivo grande demais (máx. 20 MB).')
  if (/email not confirmed/i.test(m)) return new Error('Confirme seu e-mail antes de entrar (veja sua caixa de entrada).')
  return new Error(m)
}

export class SupabaseBackend implements Backend {
  readonly mode = 'supabase' as const
  private sb: SupabaseClient
  private office: RealtimeChannel | null = null

  constructor(url: string, key: string) {
    this.sb = createClient(url, key)
  }

  async currentUserId() {
    const { data } = await this.sb.auth.getSession()
    return data.session?.user.id ?? null
  }

  async needsSetup() {
    const { data, error } = await this.sb.rpc('needs_setup')
    return !error && data === true
  }

  async signUp(login: string, password: string, name: string) {
    const user = slugUser(login)
    const { error } = await this.sb.rpc('setup_admin', { p_user: user, p_pass: password, p_name: name })
    if (error) throw pt(error)
    return this.signIn(user, password)
  }

  async signIn(login: string, password: string) {
    const { data, error } = await this.sb.auth.signInWithPassword({ email: toEmail(login), password })
    if (error) throw pt(error)
    return data.user.id
  }

  async signOut() { await this.sb.auth.signOut() }

  async accountName() {
    const { data } = await this.sb.auth.getUser()
    return (data.user?.user_metadata?.name as string | undefined) ?? data.user?.email?.split('@')[0] ?? ''
  }

  async loadAll(): Promise<Snapshot> {
    const [p, t, m, n, pj] = await Promise.all([
      this.sb.from('profiles').select('*'),
      this.sb.from('tasks').select('*'),
      this.sb.from('messages').select('*').order('created_at', { ascending: false }).limit(400),
      this.sb.from('task_notes').select('*').order('created_at').limit(3000),
      this.sb.from('projects').select('*').order('created_at'),
    ])
    const err = p.error ?? t.error ?? m.error
    if (err) throw pt(err)
    // task_notes só existe depois do SQL v3; sem ela o escritório abre igual
    const notes = n.error ? [] : (n.data as TaskNote[])
    // projects só existe depois do SQL v7
    const projects = pj.error ? [] : (pj.data as Project[])
    return { profiles: p.data as Profile[], tasks: t.data as Task[], messages: (m.data as Message[]).reverse(), notes, projects }
  }

  async upsertProfile(p: Profile) {
    const { rank: _rank, is_admin: _adm, ...row } = p // cargo e adm são do servidor
    const { data, error } = await this.sb.from('profiles').upsert(row).select().single()
    if (error) throw pt(error)
    return data as Profile
  }

  async setRank(target: string, rank: number) {
    const { error } = await this.sb.rpc('set_rank', { target, new_rank: rank })
    if (error) throw pt(error)
  }

  async createAccount(user: string, password: string, name: string, rank: number) {
    const { data, error } = await this.sb.rpc('admin_create_user', { p_user: user, p_pass: password, p_name: name, p_rank: rank })
    if (error) throw pt(error)
    const p = await this.sb.from('profiles').select('*').eq('id', data as string).single()
    if (p.error) throw pt(p.error)
    return p.data as Profile
  }

  async setPassword(target: string, password: string) {
    const { error } = await this.sb.rpc('admin_set_password', { target, p_pass: password })
    if (error) throw pt(error)
  }

  async uploadPhoto(userId: string, blob: Blob) {
    const path = `${userId}/rosto-${Date.now()}.png`
    const { error } = await this.sb.storage.from('avatars').upload(path, blob, { contentType: 'image/png', upsert: true })
    if (error) throw pt(error)
    return this.sb.storage.from('avatars').getPublicUrl(path).data.publicUrl
  }

  async upsertTask(t: Task) {
    // antes do SQL v7 essas colunas não existem: só manda quando têm algo
    const { project_id, criteria, reviews, ...base } = t
    const row = project_id || criteria.length || reviews.length ? t : base
    const { error } = await this.sb.from('tasks').upsert(row)
    if (error) throw pt(error)
  }

  async upsertProject(p: Project) {
    const { error } = await this.sb.from('projects').upsert(p)
    if (error) throw pt(error)
  }

  async deleteProject(id: string) {
    const { error } = await this.sb.from('projects').delete().eq('id', id)
    if (error) throw pt(error)
  }

  async askAI(prompt: string, context: AiContext, onStage: (s: AiStage) => void, signal: AbortSignal) {
    const { data, error } = await this.sb.from('ai_requests').insert({ asked_by: context.me.id, prompt, context }).select('id').single()
    if (error) throw pt(error)
    const t0 = Date.now()
    while (!signal.aborted) {
      await new Promise(r => setTimeout(r, 2000))
      const { data: r, error: e } = await this.sb.from('ai_requests').select('status, result, error').eq('id', data.id).single()
      if (e) throw pt(e)
      if (r.status === 'done') return r.result as AiProposal
      if (r.status === 'error') throw new Error(r.error || 'A IA não conseguiu montar a proposta.')
      onStage(r.status)
      if (r.status === 'pending' && Date.now() - t0 > 45000) throw new Error('A IA do seu PC não respondeu. Ela está ligada? (veja “Ligar a IA neste PC”)')
      if (Date.now() - t0 > 240000) throw new Error('A IA demorou demais. Tente de novo com um pedido menor.')
    }
    throw new Error('Cancelado.')
  }

  async aiOnline() {
    const { data: { session } } = await this.sb.auth.getSession()
    if (!session) return false
    const { data } = await this.sb.from('ai_bridge').select('seen_at').eq('id', session.user.id).maybeSingle()
    return !!data && Date.now() - new Date(data.seen_at).getTime() < 90000
  }

  async deleteTask(id: string) {
    const { error } = await this.sb.from('tasks').delete().eq('id', id)
    if (error) throw pt(error)
  }

  async sendMessage(m: Message) {
    const { error } = await this.sb.from('messages').insert(m)
    if (error) throw pt(error)
  }

  async uploadFile(taskId: string, file: File) {
    if (file.size > 20 * 1024 * 1024) throw new Error('Arquivo grande demais (máx. 20 MB).')
    const safe = file.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w.-]+/g, '_').slice(-80)
    const path = `${taskId}/${crypto.randomUUID().slice(0, 8)}-${safe}`
    const { error } = await this.sb.storage.from('anexos').upload(path, file, { contentType: file.type || 'application/octet-stream' })
    if (error) throw pt(error)
    return path
  }

  private urls = new Map<string, { url: string; until: number }>()
  async fileUrl(path: string, download?: string) {
    const key = path + '|' + (download ?? '')
    const hit = this.urls.get(key)
    if (hit && hit.until > Date.now()) return hit.url
    const { data, error } = await this.sb.storage.from('anexos').createSignedUrl(path, 3600, download ? { download } : undefined)
    if (error) throw pt(error)
    this.urls.set(key, { url: data.signedUrl, until: Date.now() + 50 * 60000 })
    return data.signedUrl
  }

  async deleteFile(path: string) {
    const { error } = await this.sb.storage.from('anexos').remove([path])
    if (error) throw pt(error)
  }

  async addNote(n: TaskNote) {
    const { error } = await this.sb.from('task_notes').insert(n)
    if (error) throw pt(error)
  }

  async deleteNote(id: string) {
    const { error } = await this.sb.from('task_notes').delete().eq('id', id)
    if (error) throw pt(error)
  }

  connect(userId: string, h: Handlers) {
    const db = this.sb
      .channel('db')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, pl => {
        if (pl.eventType !== 'DELETE') h.profile(pl.new as Profile)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, pl => {
        if (pl.eventType === 'DELETE') h.taskDeleted((pl.old as { id: string }).id)
        else h.task(pl.new as Task)
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, pl => h.message(pl.new as Message))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_notes' }, pl => {
        if (pl.eventType === 'DELETE') h.noteDeleted((pl.old as { id: string }).id)
        else h.note(pl.new as TaskNote)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, pl => {
        if (pl.eventType === 'DELETE') h.projectDeleted((pl.old as { id: string }).id)
        else h.project(pl.new as Project)
      })
      .subscribe()

    const office = this.sb.channel('office', { config: { presence: { key: userId }, broadcast: { self: false } } })
    office
      .on('presence', { event: 'sync' }, () => h.online(Object.keys(office.presenceState())))
      .on('broadcast', { event: 'pos' }, ({ payload }) => h.pos(payload.id as string, payload.p as Pos))
      .subscribe(async status => {
        if (status === 'SUBSCRIBED') await office.track({ at: Date.now() })
      })
    this.office = office

    return () => {
      this.sb.removeChannel(db)
      this.sb.removeChannel(office)
      this.office = null
    }
  }

  sendPos(userId: string, p: Pos) {
    this.office?.send({ type: 'broadcast', event: 'pos', payload: { id: userId, p } })
  }
}
