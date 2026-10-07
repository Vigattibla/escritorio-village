// Ponte da IA: roda no PC de quem usa (gerente), com o Claude Code logado na conta dele (sem API key).
// O app grava o pedido em ai_requests; aqui pegamos os pedidos DESTA pessoa, rodamos `claude -p` e devolvemos a proposta.
// Entra no Supabase como a própria pessoa (chave pública + sessão dela), então só enxerga os próprios pedidos.
// Instalação: o botão "Ligar a IA neste PC" do app mostra o comando (ponte/instalar.ps1).
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = path.dirname(fileURLToPath(import.meta.url))
const CASA = path.join(process.env.LOCALAPPDATA || process.env.HOME || DIR, 'EscritorioVillage')
const SESSAO = path.join(CASA, 'sessao.json')
const lerJson = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')) } catch { return null } }
const CFG = lerJson(path.join(DIR, 'config.json')) || {}
const URL_ = (process.env.SUPABASE_URL || CFG.url || '').replace(/\/$/, '')
const ANON = process.env.SUPABASE_ANON_KEY || CFG.anon || ''
const TESTE = process.argv.includes('--teste')
if (!TESTE && (!URL_ || !ANON)) { console.error('Falta config.json (url/anon) ao lado da ponte.'); process.exit(1) }
const MODEL = process.env.IA_MODELO || 'sonnet'
const HOME = process.env.USERPROFILE || process.env.HOME || ''
function acharClaude() {
  if (process.env.CLAUDE_BIN) return { cmd: process.env.CLAUDE_BIN, pre: [] }
  const pastas = [path.join(HOME, '.local/bin'), ...(process.env.PATH || '').split(path.delimiter)]
  for (const d of pastas) for (const n of ['claude.exe', 'claude']) {
    const f = path.join(d, n)
    if (fs.existsSync(f) && fs.statSync(f).isFile()) return { cmd: f, pre: [] }
  }
  // instalação antiga via npm: claude.cmd não abre sem shell, então chama o cli.js direto
  const cli = path.join(process.env.APPDATA || '', 'npm/node_modules/@anthropic-ai/claude-code/cli.js')
  if (fs.existsSync(cli)) return { cmd: process.execPath, pre: [cli] }
  return null
}
const CLAUDE = acharClaude()
if (process.argv.includes('--onde-claude')) { console.log(CLAUDE ? CLAUDE.pre[0] || CLAUDE.cmd : ''); process.exit(CLAUDE ? 0 : 1) }
if (!CLAUDE) { console.error('Claude Code não encontrado neste PC.'); process.exit(3) }
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

const log = (...a) => console.log(new Date().toLocaleString('pt-BR'), ...a)
const now = () => new Date().toISOString()

// ---- sessão da pessoa (login uma vez no instalador; depois só renova) ----
const slug = u => u.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9._-]/g, '').slice(0, 30)
const toEmail = l => (l.includes('@') ? l.trim().toLowerCase() : `${slug(l)}@escritorio.village`)
let sessao = lerJson(SESSAO)
async function auth(grant, body) {
  const r = await fetch(`${URL_}/auth/v1/token?grant_type=${grant}`, { method: 'POST', headers: { apikey: ANON, 'content-type': 'application/json' }, body: JSON.stringify(body) })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) { const e = new Error(j.msg || j.error_description || j.message || `login ${r.status}`); e.status = r.status; throw e }
  sessao = { uid: j.user.id, refresh: j.refresh_token, access: j.access_token, ate: Date.now() + (j.expires_in || 3600) * 1000 }
  fs.mkdirSync(CASA, { recursive: true })
  fs.writeFileSync(SESSAO, JSON.stringify({ uid: sessao.uid, refresh: sessao.refresh }))
}
async function token() {
  if (!sessao?.refresh) throw Object.assign(new Error('sem login neste PC'), { fatal: true })
  if (!sessao.access || Date.now() > sessao.ate - 120000) {
    try { await auth('refresh_token', { refresh_token: sessao.refresh }) }
    catch (e) { if (e.status >= 400 && e.status < 500) e.fatal = true; throw e }
  }
  return sessao.access
}
async function rest(method, p, body, extra = {}) {
  const r = await fetch(`${URL_}/rest/v1/${p}`, {
    method,
    headers: { apikey: ANON, authorization: `Bearer ${await token()}`, 'content-type': 'application/json', prefer: 'return=representation', ...extra },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!r.ok) throw new Error(`${method} ${p.split('?')[0]}: ${r.status} ${(await r.text()).slice(0, 200)}`)
  const t = await r.text()
  return t ? JSON.parse(t) : null
}

function claude(prompt) {
  return new Promise((resolve, reject) => {
    const args = ['-p', '--output-format', 'json', '--json-schema', SCHEMA, '--system-prompt-file', SYSTEM,
      '--setting-sources', 'project', '--strict-mcp-config', '--tools', '', '--no-session-persistence', '--model', MODEL]
    const filho = spawn(CLAUDE.cmd, [...CLAUDE.pre, ...args], { cwd: DIR, windowsHide: true, env: { ...process.env, MAX_THINKING_TOKENS: '0', CLAUDE_CODE_ENTRYPOINT: 'escritorio-ia' } })
    let out = '', err = ''
    const t = setTimeout(() => { filho.kill(); reject(new Error('O Claude demorou demais.')) }, LIMITE_MS)
    filho.stdout.setEncoding('utf8').on('data', c => { out += c })
    filho.stderr.setEncoding('utf8').on('data', c => { err += c })
    filho.on('error', e => { clearTimeout(t); reject(new Error(`Não consegui abrir o Claude (${CLAUDE.cmd}): ${e.message}`)) })
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
    const fila = await rest('GET', `ai_requests?asked_by=eq.${sessao.uid}&status=eq.pending&created_at=gte.${desde}&order=created_at.asc&limit=1&select=id,prompt,context`)
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
    if (e.fatal) sair(e)
  } finally { ocupado = false }
}

async function batimento() {
  try { await rest('POST', 'ai_bridge?on_conflict=id', { id: sessao.uid, seen_at: now(), model: MODEL }, { prefer: 'resolution=merge-duplicates,return=minimal' }) }
  catch (e) { log('batimento falhou:', e.message); if (e.fatal) sair(e) }
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

function sair(e) {
  // sessão revogada/senha trocada: código 2 faz o iniciar.ps1 parar de religar
  log('login perdido:', e.message, '— rode o instalador de novo.')
  process.exit(2)
}

if (process.argv.includes('--entrar')) {
  // chamado pelo instalador: EV_LOGIN / EV_SENHA vêm do terminal da própria pessoa e não ficam gravados
  try { await auth('password', { email: toEmail(process.env.EV_LOGIN || ''), password: process.env.EV_SENHA || '' }) }
  catch (e) { console.error('Não entrou:', e.status === 400 ? 'usuário ou senha errados.' : e.message); process.exit(1) }
  console.log('ok'); process.exit(0)
}

try { await token() } catch (e) { if (e.fatal) sair(e); log('sem rede:', e.message) }
log(`Ponte da IA ligada · modelo ${MODEL} · ${CLAUDE.pre[0] || CLAUDE.cmd}`)
await batimento(); await faxina()
setInterval(batimento, 30000)
setInterval(faxina, 30 * 60000)
setInterval(rodada, 3000)
rodada()
