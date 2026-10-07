import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js'
import type { Backend, Handlers, Message, Pos, Profile, Snapshot, Task } from '../types'

function pt(e: { message: string }): Error {
  const m = e.message
  if (/invalid login/i.test(m)) return new Error('E-mail ou senha incorretos.')
  if (/already registered/i.test(m)) return new Error('Esse e-mail já tem conta. Use "Entrar".')
  if (/password/i.test(m) && /6/.test(m)) return new Error('A senha precisa de pelo menos 6 caracteres.')
  if (/row-level security/i.test(m)) return new Error('Sem permissão para isso.')
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
    const [p, t, m] = await Promise.all([
      this.sb.from('profiles').select('*'),
      this.sb.from('tasks').select('*'),
      this.sb.from('messages').select('*').order('created_at', { ascending: false }).limit(400),
    ])
    const err = p.error ?? t.error ?? m.error
    if (err) throw pt(err)
    return { profiles: p.data as Profile[], tasks: t.data as Task[], messages: (m.data as Message[]).reverse() }
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
