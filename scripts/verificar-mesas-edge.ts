// Integra o handler real com Auth/PostgREST simulados, sem acessar produção.
import type { MesaRegistro } from '../supabase/functions/_shared/jogos/mesa.ts'
let handler: (r: Request) => Promise<Response>
Object.defineProperty(Deno, 'serve', { value: (h: typeof handler) => { handler = h } })
Deno.env.set('SUPABASE_URL', 'https://mesas.test')
Deno.env.set('SUPABASE_ANON_KEY', 'anon-test')
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'service-test')
const users = { a: '11111111-1111-4111-8111-111111111111', b: '22222222-2222-4222-8222-222222222222', c: '33333333-3333-4333-8333-333333333333' }
const rows: MesaRegistro[] = []
const reply = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { 'Content-Type': 'application/json' } })
globalThis.fetch = async (input, init) => {
  const req = new Request(input, init), u = new URL(req.url)
  if (u.pathname === '/auth/v1/user') {
    const token = req.headers.get('authorization')?.replace('Bearer ', '') as keyof typeof users
    return users[token] ? reply({ id: users[token] }) : reply({ message: 'Invalid token' }, 401)
  }
  if (u.pathname !== '/rest/v1/mesas_online') throw new Error('Unexpected URL ' + u.pathname)
  const matches = (r: MesaRegistro) => [...u.searchParams].every(([k, v]) => {
    if (['select', 'order', 'limit', 'or'].includes(k)) return true
    const actual = r[k as keyof MesaRegistro]
    if (v.startsWith('eq.')) return String(actual) === v.slice(3)
    if (v === 'is.null') return actual === null
    if (v.startsWith('in.')) return v.slice(4, -1).split(',').includes(String(actual))
    throw new Error('Unexpected filter ' + v)
  })
  if (req.method === 'POST') { rows.push(await req.json()); return reply(null, 201) }
  if (req.method === 'PATCH') { const patch = await req.json(), selected = rows.filter(matches); for (const r of selected) Object.assign(r, patch); return reply(selected) }
  const selected = rows.filter(matches)
  if (req.headers.get('accept')?.includes('vnd.pgrst.object')) return selected.length ? reply(selected[0]) : reply({ code: 'PGRST116', details: '0 rows' }, 406)
  return reply(selected)
}
await import('../supabase/functions/mesas/index.ts')
let checks = 0
const ok = (v: unknown, label: string) => { if (!v) throw new Error(label); checks++ }
const call = async (who: string, body: unknown) => {
  const res = await handler(new Request('https://mesas.test/functions/v1/mesas', { method: 'POST', headers: who ? { Authorization: 'Bearer ' + who } : {}, body: JSON.stringify(body) }))
  return { status: res.status, body: await res.json() }
}
ok((await call('', { fn: 'listar' })).status === 401, 'Requer autenticação')
ok((await call('invalid', { fn: 'listar' })).status === 401, 'Rejeita token inválido')
ok((await call('a', { fn: 'invalida' })).status === 400, 'Valida operação')
for (const jogo of ['cartas', 'baralho', 'sinuca']) {
  const created = await call('a', { fn: 'criar', jogo })
  ok(created.status === 200 && created.body.mesa.estado === 'espera', 'Cria ' + jogo)
  const id = created.body.mesa.id
  ok((await call('a', { fn: 'criar', jogo })).body.mesa.id === id, 'Criar é idempotente')
  ok((await call('c', { fn: 'estado', id })).status === 403, 'Estado privado')
  const joined = await call('b', { fn: 'entrar', id })
  ok(joined.status === 200 && joined.body.mesa.eu === 1, 'Convidado entra')
  ok((await call('c', { fn: 'entrar', id })).status === 400, 'Terceiro recusado')
  ok((await call('b', { fn: 'acao', id, versao: 1, acao: { tipo: 'comprar' } })).status === 400, 'Turno validado')
  const own = (await call('a', { fn: 'estado', id })).body.mesa
  ok(!('dados' in own) && (!own.cartas || !('maos' in own.cartas) && typeof own.cartas.monte === 'number'), 'Sem mão alheia/deck')
  const acao = jogo === 'sinuca' ? { tipo: 'tacada', angulo: 0, forca: 50 } : { tipo: 'comprar' }
  const both = await Promise.all([call('a', { fn: 'acao', id, versao: 1, acao }), call('a', { fn: 'acao', id, versao: 1, acao })])
  ok(both.filter(r => r.status === 200).length === 1 && both.filter(r => r.status === 409).length === 1, 'CAS rejeita jogada duplicada')
  ok((await call('c', { fn: 'sair', id })).status === 403, 'Estranho não encerra')
  ok((await call('b', { fn: 'sair', id })).body.mesa.estado === 'fim', 'Saída encerra')
}
console.log(`${checks} verificações do handler HTTP passaram: autenticação, privacidade e concorrência.`)
