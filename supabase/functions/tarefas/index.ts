// Ponte de tarefas pra fora do app, sempre com a chave pessoal (Turmeo → Meu menu → Conectar IA).
//   POST /tarefas         servidor MCP (Claude Code, Gemini CLI, Codex CLI, ChatGPT/Claude como conector)
//   POST /tarefas/nova    webhook: JSON {titulo, para?, prazo?, notas?, prioridade?}, formulário ou texto puro
//   POST /tarefas/email   e-mail recebido por um serviço (Postmark, Mailgun, SendGrid, Cloudflare): assunto = título
// A chave vai no cabeçalho Authorization: Bearer tv_..., em x-turmeo-token ou em ?t= (serviços de e-mail não mandam cabeçalho).
// Quem decide o que pode é o banco (funções api_* em 202610181000_api_tarefas.sql).
import { createClient } from 'jsr:@supabase/supabase-js@2'

const env = (k: string) => Deno.env.get(k) ?? ''
const sb = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'))
// só assina link de anexo, e só depois que api_tarefa_ler conferiu que a chave participa da tarefa
const adm = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'))
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-turmeo-token, content-type, mcp-session-id, mcp-protocol-version, apikey',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

async function rpc(fn: string, args: Record<string, unknown>) {
  const { data, error } = await sb.rpc(fn, args)
  if (error) throw new Error(error.message)
  return data
}

// ---------- datas: "2026-10-20", "20/10", "20/10/2026", "hoje", "amanhã", "sexta" ----------
const hojeSP = () => new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const DIAS = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado']
function prazo(v: unknown): string | null {
  const s = String(v ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  if (!s) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const h = hojeSP()
  if (s === 'hoje') return iso(h)
  if (s === 'amanha') return iso(new Date(h.getFullYear(), h.getMonth(), h.getDate() + 1))
  const dw = DIAS.findIndex(d => s.startsWith(d))
  if (dw >= 0) return iso(new Date(h.getFullYear(), h.getMonth(), h.getDate() + ((dw - h.getDay() + 7) % 7 || 7)))
  const m = s.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/)
  if (m) {
    let y = m[3] ? +m[3] : h.getFullYear()
    if (y < 100) y += 2000
    const d = new Date(y, +m[2] - 1, +m[1])
    if (!m[3] && d < new Date(h.getFullYear(), h.getMonth(), h.getDate())) d.setFullYear(y + 1)
    return iso(d)
  }
  throw new Error(`Não entendi o prazo "${v}". Use AAAA-MM-DD, DD/MM, hoje, amanhã ou o dia da semana.`)
}

const criar = (t: string, a: Record<string, unknown>) => rpc('api_tarefa_criar', {
  p_token: t, p_titulo: a.titulo ?? a.title, p_para: a.para ?? a.to ?? null, p_prazo: prazo(a.prazo ?? a.due),
  p_notas: a.notas ?? a.notes ?? a.descricao ?? '', p_prioridade: a.prioridade ?? a.priority ?? null,
})

// ---------- MCP (Streamable HTTP, sem sessão: cada POST é respondido em JSON) ----------
const VERSOES = ['2025-06-18', '2025-03-26', '2024-11-05']
function ferramentas() {
  const hoje = iso(hojeSP())
  return [
    {
      name: 'criar_tarefa',
      description: `Cria uma tarefa no quadro do Turmeo. Sem "para", vai pra minha pasta; com o nome de outra pessoa, vira pedido pra ela (ou tarefa direta se eu for o chefe dela). Hoje é ${hoje}.`,
      inputSchema: {
        type: 'object', required: ['titulo'],
        properties: {
          titulo: { type: 'string', description: 'Título curto, até 200 caracteres' },
          para: { type: 'string', description: 'Nome de quem faz (veja listar_pessoas). Vazio = eu' },
          prazo: { type: 'string', description: 'AAAA-MM-DD (também aceita DD/MM, hoje, amanhã, sexta)' },
          notas: { type: 'string', description: 'Descrição / detalhes' },
          prioridade: { type: 'string', enum: ['alta', 'media', 'baixa'] },
          checklist: { type: 'array', items: { type: 'string' }, description: 'Itens da lista (ex.: as peças de uma campanha)' },
        },
      },
    },
    {
      name: 'listar_tarefas',
      description: 'Lista as minhas tarefas (abertas e as concluídas nos últimos 7 dias), com id, situação e prazo.',
      inputSchema: { type: 'object', properties: { situacao: { type: 'string', enum: ['inbox', 'todo', 'doing', 'review', 'done'], description: 'Filtrar por situação (opcional)' } } },
    },
    {
      name: 'mover_tarefa',
      description: 'Muda a situação de uma tarefa minha: todo (a fazer), doing (fazendo) ou done (feito; se o projeto tem aprovador, vai pra aprovação).',
      inputSchema: { type: 'object', required: ['id', 'situacao'], properties: { id: { type: 'string' }, situacao: { type: 'string', enum: ['todo', 'doing', 'done'] } } },
    },
    {
      name: 'checklist_tarefa',
      description: 'Mexe no checklist de uma tarefa de que eu participo: marca/desmarca um item (pelo texto ou id), adiciona itens novos ou tira um item.',
      inputSchema: {
        type: 'object', required: ['id'],
        properties: {
          id: { type: 'string' },
          marcar: { type: 'string', description: 'Texto ou id do item a marcar' },
          feito: { type: 'boolean', description: 'true marca, false desmarca; vazio inverte' },
          adicionar: { type: 'array', items: { type: 'string' }, description: 'Itens novos no fim da lista' },
          tirar: { type: 'string', description: 'Texto ou id do item a remover' },
        },
      },
    },
    {
      name: 'comentar_tarefa',
      description: 'Escreve um comentário numa tarefa de que eu participo.',
      inputSchema: { type: 'object', required: ['id', 'texto'], properties: { id: { type: 'string' }, texto: { type: 'string' } } },
    },
    {
      name: 'ler_tarefa',
      description: 'Lê uma tarefa inteira: texto, checklist, comentários e anexos (com link que vale 1 hora).',
      inputSchema: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
    },
    {
      name: 'listar_pessoas',
      description: 'Lista as pessoas do escritório (nome, cargo, sala) pra escolher pra quem vai a tarefa.',
      inputSchema: { type: 'object', properties: {} },
    },
  ]
}

async function ler(t: string, id: string) {
  const d = await rpc('api_tarefa_ler', { p_token: t, p_id: id })
  for (const a of d.anexos ?? []) {
    const { data } = await adm.storage.from('anexos').createSignedUrl(a.caminho, 3600)
    a.link = data?.signedUrl ?? null
    delete a.caminho
  }
  return d
}

const checklist = (t: string, a: Record<string, unknown>) => rpc('api_tarefa_checklist', {
  p_token: t, p_id: a.id, p_item: a.marcar ?? null, p_feito: typeof a.feito === 'boolean' ? a.feito : null,
  p_adicionar: Array.isArray(a.adicionar) ? a.adicionar.map(String) : null, p_tirar: a.tirar ?? null,
})

async function chamar(t: string, nome: string, a: Record<string, unknown>) {
  switch (nome) {
    case 'criar_tarefa': {
      const r = await criar(t, a)
      const itens = Array.isArray(a.checklist) ? a.checklist : typeof a.checklist === 'string' ? a.checklist.split('\n') : []
      if (r?.id && itens.length) r.checklist = (await checklist(t, { id: r.id, adicionar: itens })).checklist
      return r
    }
    case 'checklist_tarefa': return checklist(t, a)
    case 'listar_tarefas': return rpc('api_tarefas', { p_token: t, p_situacao: a.situacao ?? null })
    case 'mover_tarefa': return rpc('api_tarefa_mover', { p_token: t, p_id: a.id, p_situacao: a.situacao })
    case 'comentar_tarefa': return rpc('api_comentar', { p_token: t, p_id: a.id, p_texto: a.texto })
    case 'ler_tarefa': return ler(t, String(a.id ?? ''))
    case 'listar_pessoas': return rpc('api_pessoas', { p_token: t })
  }
  throw new Error(`Ferramenta desconhecida: ${nome}`)
}

interface Msg { jsonrpc: '2.0'; id?: string | number | null; method: string; params?: Record<string, any> }
async function mcp(t: string, m: Msg) {
  const ok = (result: unknown) => ({ jsonrpc: '2.0', id: m.id, result })
  switch (m.method) {
    case 'initialize': {
      const pv = m.params?.protocolVersion
      return ok({ protocolVersion: VERSOES.includes(pv) ? pv : VERSOES[0], capabilities: { tools: {} },
        serverInfo: { name: 'turmeo-tarefas', version: '1.0.0' },
        instructions: 'Tarefas do quadro do Turmeo. Use criar_tarefa pra anotar algo que a pessoa pediu; confirme o título e pra quem antes se estiver ambíguo.' })
    }
    case 'ping': return ok({})
    case 'tools/list': return ok({ tools: ferramentas() })
    case 'tools/call':
      try {
        const r = await chamar(t, m.params?.name, m.params?.arguments ?? {})
        return ok({ content: [{ type: 'text', text: JSON.stringify(r, null, 1) }], structuredContent: Array.isArray(r) ? { itens: r } : r })
      } catch (e) {
        return ok({ content: [{ type: 'text', text: (e as Error).message }], isError: true })
      }
  }
  return { jsonrpc: '2.0', id: m.id, error: { code: -32601, message: 'Método não suportado: ' + m.method } }
}

// ---------- corpo do webhook / e-mail ----------
async function corpo(req: Request): Promise<Record<string, any>> {
  const ct = req.headers.get('content-type') ?? ''
  if (ct.includes('json')) return await req.json()
  if (ct.includes('form')) return Object.fromEntries((await req.formData()).entries())
  const txt = (await req.text()).trim()
  const [l1, ...resto] = txt.split('\n')
  return { titulo: l1, notas: resto.join('\n').trim() }
}
function doEmail(b: Record<string, any>) {
  const assunto = b.Subject ?? b.subject ?? b.headers?.subject ?? ''
  const texto = b.StrippedTextReply || b.TextBody || b['stripped-text'] || b['body-plain'] || b.text || b.plain || ''
  const de = b.From ?? b.from ?? b.sender ?? ''
  // "Para: Ana" / "Prazo: sexta" nas primeiras linhas do e-mail
  const campos: Record<string, string> = {}
  const linhas = String(texto).split(/\r?\n/)
  while (linhas.length && /^\s*(para|prazo|prioridade)\s*:/i.test(linhas[0])) {
    const [, k, v] = linhas.shift()!.match(/^\s*(\w+)\s*:\s*(.*)$/)!
    campos[k.toLowerCase()] = v.trim()
  }
  const notas = linhas.join('\n').trim()
  return { titulo: String(assunto).replace(/^\s*(re|fwd?|enc)\s*:\s*/i, '').trim(), ...campos, notas: (notas + (de ? `\n\n(e-mail de ${de})` : '')).trim().slice(0, 5000) }
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const url = new URL(req.url)
  const rota = url.pathname.replace(/\/+$/, '').split('/').pop()
  const t = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '') || req.headers.get('x-turmeo-token') || url.searchParams.get('t') || ''
  if (req.method === 'GET') return json({ ok: true, nome: 'Turmeo · tarefas', mcp: 'POST nesta URL', webhook: 'POST /nova', email: 'POST /email?t=CHAVE' })
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405)
  if (!t.startsWith('tv_')) return json({ error: 'Falta a chave (Authorization: Bearer tv_...). Gere em Turmeo → seu menu → Conectar IA.' }, 401)

  try {
    if (rota === 'nova') return json({ ok: true, tarefa: await criar(t, await corpo(req)) })
    if (rota === 'email') return json({ ok: true, tarefa: await criar(t, doEmail(await corpo(req))) })
    const b = await req.json()
    const lote = Array.isArray(b) ? b as Msg[] : [b as Msg]
    // a chave é conferida já no início, pra o cliente saber logo que está errada
    if (lote.some(m => m.method === 'initialize')) await rpc('api_tarefas', { p_token: t, p_situacao: 'inbox' })
    const resp = (await Promise.all(lote.map(m => m.id === undefined || m.id === null ? null : mcp(t, m)))).filter(Boolean)
    if (!resp.length) return new Response(null, { status: 202, headers: CORS })
    return json(Array.isArray(b) ? resp : resp[0])
  } catch (e) {
    const msg = (e as Error).message
    return json({ error: msg }, /chave/i.test(msg) ? 401 : 400)
  }
})
