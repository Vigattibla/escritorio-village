// Aplica no Supabase os arquivos de supabase/migrations/ que ainda não rodaram (em ordem de nome).
// Roda no GitHub Actions antes de publicar. Precisa do segredo SUPABASE_ACCESS_TOKEN.
// node scripts/migrar.mjs --dry  → só lista o que falta
import { readdirSync, readFileSync } from 'node:fs'

const dir = new URL('../supabase/migrations/', import.meta.url)
const files = readdirSync(dir).filter(f => f.endsWith('.sql')).sort()
const token = process.env.SUPABASE_ACCESS_TOKEN
const ref = process.env.SUPABASE_PROJECT_REF || (process.env.VITE_SUPABASE_URL ?? '').match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1]

for (const f of files) if (!/^[\w.-]+\.sql$/.test(f)) throw new Error(`Nome de arquivo inválido: ${f}`)
if (!files.length) { console.log('Nenhuma migração.'); process.exit(0) }
if (!token || !ref) {
  console.log(`::warning::Sem SUPABASE_ACCESS_TOKEN/ref: ${files.length} migração(ões) não conferida(s).`)
  process.exit(0)
}

async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const body = await r.text()
  if (!r.ok) throw new Error(`${r.status}: ${body.slice(0, 500)}`)
  return JSON.parse(body || '[]')
}

await sql(`create schema if not exists ops;
create table if not exists ops.migrations (name text primary key, applied_at timestamptz not null default now());
revoke all on schema ops from public, anon, authenticated;`)
const done = new Set((await sql('select name from ops.migrations')).map(r => r.name))
const todo = files.filter(f => !done.has(f))
if (!todo.length) { console.log('Banco em dia.'); process.exit(0) }
if (process.argv.includes('--dry')) { console.log('Faltam:', todo.join(', ')); process.exit(0) }

for (const f of todo) {
  const body = readFileSync(new URL(f, dir), 'utf8')
  console.log(`→ ${f}`)
  await sql(`begin;\n${body}\n;\ninsert into ops.migrations (name) values ('${f}');\ncommit;`)
}
console.log(`Aplicadas: ${todo.length}`)
