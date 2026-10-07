import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js'
import type { Backend, Handlers, Message, Pos, Profile, Snapshot, Task, TaskNote } from '../types'

function pt(e: { message: string }): Error {
  const m = e.message
  if (/invalid login/i.test(m)) return new Error('E-mail ou senha incorretos.')
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

  async signUp(email: string, password: string, name: string) {
    const { data, error } = await this.sb.auth.signUp({ email, password, options: { data: { name }, emailRedirectTo: location.origin + location.pathname } })
    if (error) throw pt(error)
    return data.session ? data.user!.id : null
  }

  async signIn(email: string, password: string) {
    const { data, error } = await this.sb.auth.signInWithPassword({ email, password })
    if (error) throw pt(error)
    return data.user.id
  }

  async signOut() { await this.sb.auth.signOut() }

  async accountName() {
    const { data } = await this.sb.auth.getUser()
    return (data.user?.user_metadata?.name as string | undefined) ?? data.user?.email?.split('@')[0] ?? ''
  }

  async loadAll(): Promise<Snapshot> {
    const [p, t, m, n] = await Promise.all([
      this.sb.from('profiles').select('*'),
      this.sb.from('tasks').select('*'),
      this.sb.from('messages').select('*').order('created_at', { ascending: false }).limit(400),
      this.sb.from('task_notes').select('*').order('created_at').limit(3000),
    ])
    const err = p.error ?? t.error ?? m.error
    if (err) throw pt(err)
    // task_notes só existe depois do SQL v3; sem ela o escritório abre igual
    const notes = n.error ? [] : (n.data as TaskNote[])
    return { profiles: p.data as Profile[], tasks: t.data as Task[], messages: (m.data as Message[]).reverse(), notes }
  }

  async upsertProfile(p: Profile) {
    const { rank: _rank, ...row } = p // cargo é do servidor
    const { data, error } = await this.sb.from('profiles').upsert(row).select().single()
    if (error) throw pt(error)
    return data as Profile
  }

  async setRank(target: string, rank: number) {
    const { error } = await this.sb.rpc('set_rank', { target, new_rank: rank })
    if (error) throw pt(error)
  }

  async uploadPhoto(userId: string, blob: Blob) {
    const path = `${userId}/rosto-${Date.now()}.png`
    const { error } = await this.sb.storage.from('avatars').upload(path, blob, { contentType: 'image/png', upsert: true })
    if (error) throw pt(error)
    return this.sb.storage.from('avatars').getPublicUrl(path).data.publicUrl
  }

  async upsertTask(t: Task) {
    const { error } = await this.sb.from('tasks').upsert(t)
    if (error) throw pt(error)
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
