// Ponte da IA do Gerente: roda no PC que tem o Claude Code logado (assinatura, sem API key).
// O app grava o pedido em ai_requests; aqui pegamos, rodamos `claude -p` e devolvemos a proposta.
// Uso: node ponte/ia.mjs   (precisa de ponte/.env.local com SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY)
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = path.dirname(fileURLToPath(import.meta.url))
for (const l of (fs.existsSync(path.join(DIR, '.env.local')) ? fs.readFileSync(path.join(DIR, '.env.local'), 'utf8') : '').split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const URL_ = (process.env.SUPABASE_URL || '').replace(/\/$/, '')
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const TESTE = process.argv.includes('--teste')
if (!TESTE && (!URL_ || !KEY)) { console.error('Falta SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY em ponte/.env.local'); process.exit(1) }
const MODEL = process.env.IA_MODELO || 'sonnet'
const HOME = process.env.USERPROFILE || process.env.HOME || ''
const CLAUDE = process.env.CLAUDE_BIN || ['.local/bin/claude.exe', '.local/bin/claude'].map(p => path.join(HOME, p)).find(p => fs.existsSync(p)) || 'claude'
const SYSTEM = path.join(DIR, 'distribuidor.md')
const LIMITE_MS = 200000

const SCHEMA = JSON.stringify({
  type: 'object', additionalProperties: false, required: ['summary', 'items'],
  properties: {
    summary: { type: 'string' },
    items: {
      type: 'array', maxItems: 20,
      items: {
        type: 'object', additionalProperties: false,
        required: ['title', 'owner_id', 'due', 'project_id', 'notes', 'why'],
        properties: {
          title: { type: 'string' }, owner_id: { type: 'string' },
          due: { type: ['string', 'null'] }, project_id: { type: ['string', 'null'] },
          notes: { type: 'string' }, why: { type: 'string' },
        },
      },
    },
  },
})

const log = (...a) => console.log(new Date().toLocaleTimeString('pt-BR'), ...a)
async function rest(method, p, body, extra = {}) {
  const r = await fetch(`${URL_}/rest/v1/${p}`, {
    method,
    headers: { apikey: KEY, authorization: `Bearer ${KEY}`, 'content-type': 'application/json', prefer: 'return=representation', ...extra },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!r.ok) throw new Error(`${method} ${p.split('?')[0]}: ${r.status} ${(await r.text()).slice(0, 200)}`)
  const t = await r.text()
  return t ? JSON.parse(t) : null
}
const now = () => new Date().toISOString()

function claude(prompt) {
  return new Promise((resolve, reject) => {
    const args = ['-p', '--output-format', 'json', '--json-schema', SCHEMA, '--system-prompt-file', SYSTEM,
      '--setting-sources', 'project', '--strict-mcp-config', '--tools', '', '--no-session-persistence', '--model', MODEL]
    const filho = spawn(CLAUDE, args, { cwd: DIR, windowsHide: true, env: { ...process.env, MAX_THINKING_TOKENS: '0', CLAUDE_CODE_ENTRYPOINT: 'escritorio-ia' } })
    let out = '', err = ''
    const t = setTimeout(() => { filho.kill(); reject(new Error('O Claude demorou demais.')) }, LIMITE_MS)
    filho.stdout.setEncoding('utf8').on('data', c => { out += c })
    filho.stderr.setEncoding('utf8').on('data', c => { err += c })
    filho.on('error', e => { clearTimeout(t); reject(new Error(`Não consegui abrir o Claude (${CLAUDE}): ${e.message}`)) })
    filho.on('close', cod => {
      clearTimeout(t)
      let j
      try { j = JSON.parse(out) } catch { return reject(new Error(err.trim().split('\n').slice(-2).join(' ') || `Claude saiu com código ${cod}`)) }
      if (j.is_error || !j.structured_output) return reject(new Error(String(j.result || j.subtype || 'O Claude não devolveu a proposta.').slice(0, 300)))
      resolve({ out: j.structured_output, s: Math.round((j.duration_ms || 0) / 1000) })
    })
    filho.stdin.end(prompt)
  })
}

let ocupado = false
async function rodada() {
  if (ocupado) return
  ocupado = true
  try {
    const desde = new Date(Date.now() - 5 * 60000).toISOString()
    const fila = await rest('GET', `ai_requests?status=eq.pending&created_at=gte.${desde}&order=created_at.asc&limit=1&select=id,prompt,context`)
    const req = fila?.[0]
    if (!req) return
    // pega o pedido só se ainda estiver pendente (duas pontes não pegam o mesmo)
    const meu = await rest('PATCH', `ai_requests?id=eq.${req.id}&status=eq.pending`, { status: 'working', updated_at: now() })
    if (!meu?.length) return
    log('pedido', req.id.slice(0, 8), '—', req.prompt.slice(0, 60).replace(/\s+/g, ' '))
    try {
      const { out, s } = await claude(`CONTEXTO:\n${JSON.stringify(req.context)}\n\nPEDIDO DO GESTOR:\n${req.prompt}`)
      await rest('PATCH', `ai_requests?id=eq.${req.id}`, { status: 'done', result: out, updated_at: now() })
      log('ok', `${out.items?.length ?? 0} tarefa(s) em ${s}s`)
    } catch (e) {
      await rest('PATCH', `ai_requests?id=eq.${req.id}`, { status: 'error', error: String(e.message).slice(0, 500), updated_at: now() })
      log('erro', e.message)
    }
  } catch (e) {
    log('falha na fila:', e.message)
  } finally { ocupado = false }
}

async function batimento() {
  try { await rest('POST', 'ai_bridge?on_conflict=id', { id: 'pc', seen_at: now(), model: MODEL }, { prefer: 'resolution=merge-duplicates,return=minimal' }) }
  catch (e) { log('batimento falhou:', e.message) }
}
async function faxina() {
  // pedidos esquecidos e histórico antigo
  try {
    await rest('PATCH', `ai_requests?status=in.(pending,working)&updated_at=lt.${new Date(Date.now() - 10 * 60000).toISOString()}`, { status: 'error', error: 'Expirou sem resposta.', updated_at: now() }, { prefer: 'return=minimal' })
    await rest('DELETE', `ai_requests?created_at=lt.${new Date(Date.now() - 7 * 86400000).toISOString()}`, null, { prefer: 'return=minimal' })
  } catch (e) { log('faxina falhou:', e.message) }
}

if (TESTE) {
  // node ponte/ia.mjs --teste  → roda o Claude com um time de exemplo, sem tocar no Supabase
  const ctx = { today: new Date().toISOString().slice(0, 10), me: { id: 'g1', name: 'Gerente', rank: 3 },
    people: [{ id: 'g1', name: 'Gerente', role: 'Gerência', rank: 3, open: 2, late: 0, online: true },
      { id: 'b1', name: 'Bruno', role: 'Marketing', rank: 1, open: 1, late: 0, online: true },
      { id: 'c1', name: 'Carla', role: 'Eventos', rank: 2, open: 4, late: 1, online: false },
      { id: 'a1', name: 'Ana', role: 'Recepção', rank: 1, open: 0, late: 0, online: true }],
    projects: [{ id: 'p1', name: 'Semana das Crianças', master: 'Carla' }] }
  const t0 = Date.now()
  const r = await claude(`CONTEXTO:
${JSON.stringify(ctx)}

PEDIDO DO GESTOR:
Semana das Crianças: arte do feed até sexta, orçamento de brinquedos e avisar os hóspedes na chegada`)
  console.log(JSON.stringify(r.out, null, 2), `
${Math.round((Date.now() - t0) / 1000)}s`)
  process.exit(0)
}

log(`Ponte da IA ligada · modelo ${MODEL} · ${CLAUDE}`)
await batimento(); await faxina()
setInterval(batimento, 30000)
setInterval(faxina, 30 * 60000)
setInterval(rodada, 3000)
rodada()
