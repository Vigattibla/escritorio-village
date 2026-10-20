import { createClient } from 'npm:@supabase/supabase-js@2'
import { acaoMesa, criarMesa, entrarMesa, resumoMesa, sairMesa, tipoMesa, visaoMesa } from '../_shared/jogos/mesa.ts'
import type { AcaoMesa, MesaPedido, MesaRegistro, MesaResposta } from '../_shared/jogos/mesa.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const MAX_BODY = 64 * 1024
const MAX_ATIVAS = 3
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const FNS = ['listar', 'criar', 'entrar', 'estado', 'acao', 'sair']

class Falha extends Error { status: number; constructor(status: number, msg: string) { super(msg); this.status = status } }

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

function acaoValida(a: unknown): a is AcaoMesa {
  if (!a || typeof a !== 'object') return false
  const x = a as Record<string, unknown>
  if (x.tipo === 'comprar') return true
  if (x.tipo === 'jogar') return Number.isInteger(x.carta) && (x.cor === undefined || typeof x.cor === 'string')
  if (x.tipo === 'tacada') return typeof x.angulo === 'number' && typeof x.forca === 'number'
  return false
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  try {
    if (req.method !== 'POST') throw new Falha(405, 'Método não permitido.')
    const url = Deno.env.get('SUPABASE_URL'), anon = Deno.env.get('SUPABASE_ANON_KEY'), service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!url || !anon || !service) throw new Falha(500, 'Serviço indisponível.')

    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
    if (!token) throw new Falha(401, 'Entre na sua conta para jogar online.')
    const { data: auth, error: authErr } = await createClient(url, anon, { auth: { persistSession: false } }).auth.getUser(token)
    const user = auth?.user?.id
    if (authErr || !user) throw new Falha(401, 'Sessão inválida. Entre novamente.')

    const texto = await req.text()
    if (texto.length > MAX_BODY || new TextEncoder().encode(texto).length > MAX_BODY) throw new Falha(400, 'Pedido grande demais.')
    let p: MesaPedido & { fn?: string }
    try { p = JSON.parse(texto) } catch { throw new Falha(400, 'Pedido inválido.') }
    if (!p || typeof p !== 'object' || typeof p.fn !== 'string' || !FNS.includes(p.fn)) throw new Falha(400, 'Operação inválida.')

    const db = createClient(url, service, { auth: { persistSession: false } })
    const carregar = async (): Promise<MesaRegistro> => {
      if (typeof p.id !== 'string' || !UUID.test(p.id)) throw new Falha(400, 'Mesa inválida.')
      const { data, error } = await db.from('mesas_online').select('*').eq('id', p.id).maybeSingle()
      if (error) throw new Falha(500, 'Não foi possível ler a mesa.')
      if (!data) throw new Falha(404, 'Mesa não encontrada.')
      return data as MesaRegistro
    }
    // Atualização com CAS: só grava se a versão ainda for a lida.
    const gravar = async (antiga: MesaRegistro, nova: MesaRegistro, extra?: (q: any) => any): Promise<MesaRegistro> => {
      let q = db.from('mesas_online').update({ convidado: nova.convidado, estado: nova.estado, versao: nova.versao, dados: nova.dados, atualizado: nova.atualizado })
        .eq('id', antiga.id).eq('versao', antiga.versao)
      if (extra) q = extra(q)
      const { data, error } = await q.select('*')
      if (error) throw new Falha(500, 'Não foi possível salvar a mesa.')
      if (!data || data.length === 0) throw new Falha(409, 'A mesa mudou. Atualizando a partida…')
      return data[0] as MesaRegistro
    }
    const regra = <T>(fn: () => T): T => { try { return fn() } catch (e) { throw new Falha(e instanceof Falha ? e.status : 400, e instanceof Error ? e.message : 'Pedido inválido.') } }
    const vista = (m: MesaRegistro) => regra(() => visaoMesa(m, user))
    const participa = (m: MesaRegistro) => { if (m.dono !== user && m.convidado !== user) throw new Falha(403, 'Você não participa dessa mesa.') }

    let out: MesaResposta = {}
    if (p.fn === 'listar') {
      const desde = new Date(Date.now() - 6 * 3600_000).toISOString()
      let q = db.from('mesas_online').select('id,jogo,dono,convidado,estado,versao,atualizado')
        .or(`and(estado.eq.espera,atualizado.gte.${desde}),and(dono.eq.${user},estado.neq.fim),and(convidado.eq.${user},estado.neq.fim),and(dono.eq.${user},atualizado.gte.${desde}),and(convidado.eq.${user},atualizado.gte.${desde})`)
        .order('atualizado', { ascending: false }).limit(50)
      if (p.jogo !== undefined) { if (!tipoMesa(p.jogo)) throw new Falha(400, 'Jogo inválido.'); q = q.eq('jogo', p.jogo) }
      const { data, error } = await q
      if (error) throw new Falha(500, 'Não foi possível listar as mesas.')
      out = { mesas: (data ?? []).map(m => resumoMesa({ ...(m as MesaRegistro), dados: {} })) }
    } else if (p.fn === 'criar') {
      if (!tipoMesa(p.jogo)) throw new Falha(400, 'Jogo inválido.')
      const { data: ativas, error } = await db.from('mesas_online').select('*').eq('dono', user).in('estado', ['espera', 'jogando'])
      if (error) throw new Falha(500, 'Não foi possível criar a mesa.')
      const repetida = (ativas ?? []).find(m => m.estado === 'espera' && m.jogo === p.jogo)
      if (repetida) out = { mesa: vista(repetida as MesaRegistro) }
      else {
        if ((ativas ?? []).length >= MAX_ATIVAS) throw new Falha(409, 'Você já tem mesas demais abertas. Saia de uma antes.')
        const nova = regra(() => criarMesa(crypto.randomUUID(), p.jogo!, user))
        const { error: e2 } = await db.from('mesas_online').insert({ id: nova.id, jogo: nova.jogo, dono: nova.dono, convidado: null, estado: nova.estado, versao: nova.versao, dados: nova.dados, atualizado: nova.atualizado })
        if (e2?.code === '23505') {
          const { data: existente } = await db.from('mesas_online').select('*').eq('dono', user).eq('jogo', p.jogo).eq('estado', 'espera').maybeSingle()
          if (existente) return json({ mesa: vista(existente as MesaRegistro) })
        }
        if (e2) throw new Falha(409, 'Não foi possível criar outra mesa. Retome ou saia de uma das suas mesas.')
        out = { mesa: vista(nova) }
      }
    } else if (p.fn === 'entrar') {
      const m = await carregar()
      if (m.dono === user || m.convidado === user) out = { mesa: vista(m) }
      else {
        const nova = regra(() => entrarMesa(m, user))
        const salva = await gravar(m, nova, q => q.eq('estado', 'espera').is('convidado', null))
        out = { mesa: vista(salva) }
      }
    } else if (p.fn === 'estado') {
      const m = await carregar()
      participa(m)
      out = { mesa: vista(m) }
    } else if (p.fn === 'acao') {
      if (!Number.isInteger(p.versao)) throw new Falha(400, 'Versão inválida.')
      if (!acaoValida(p.acao)) throw new Falha(400, 'Jogada inválida.')
      const m = await carregar()
      participa(m)
      if (p.versao !== m.versao) throw new Falha(409, 'A mesa mudou. Atualizando a partida…')
      const nova = regra(() => acaoMesa(m, user, p.versao!, p.acao!))
      out = { mesa: vista(await gravar(m, nova)) }
    } else {
      const m = await carregar()
      participa(m)
      const nova = regra(() => sairMesa(m, user))
      out = { mesa: vista(nova === m ? m : await gravar(m, nova)) }
    }
    return json(out)
  } catch (e) {
    if (e instanceof Falha) return json({ error: e.message }, e.status)
    return json({ error: 'Erro interno. Tente novamente.' }, 500)
  }
})
