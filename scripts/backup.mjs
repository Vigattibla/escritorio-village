// Cópia do banco em SQL (dados de public + contas de auth), pra restaurar colando no SQL Editor do Supabase.
// Roda no GitHub Actions todo dia (backup.yml) com o mesmo SUPABASE_ACCESS_TOKEN da publicação.
// O arquivo sai daqui criptografado no workflow: o repositório é público.
// node scripts/backup.mjs saida.sql
import { writeFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'

const token = process.env.SUPABASE_ACCESS_TOKEN
const ref = process.env.SUPABASE_PROJECT_REF || (process.env.VITE_SUPABASE_URL ?? '').match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1]
const out = process.argv[2] ?? 'backup.sql'
if (!token || !ref) throw new Error('Sem SUPABASE_ACCESS_TOKEN/ref')

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

const tables = (await sql(`select table_schema || '.' || table_name as t from information_schema.tables
  where table_schema = 'public' and table_type = 'BASE TABLE' order by 1`)).map(r => r.t)
// quem aponta pra quem, pra inserir pai antes de filho
const fks = await sql(`select c.conrelid::regclass::text as child, c.confrelid::regclass::text as parent
  from pg_constraint c join pg_namespace n on n.oid = c.connamespace where c.contype = 'f' and n.nspname = 'public'`)
const norm = t => (t.includes('.') ? t : 'public.' + t)
const deps = new Map(tables.map(t => [t, new Set()]))
for (const { child, parent } of fks) if (norm(child) !== norm(parent)) deps.get(norm(child))?.add(norm(parent))
const order = []
const visit = (t, seen = new Set()) => {
  if (order.includes(t) || seen.has(t)) return
  seen.add(t)
  for (const p of deps.get(t) ?? []) if (deps.has(p)) visit(p, seen)
  order.push(t)
}
tables.forEach(t => visit(t))

const all = ['auth.users', 'auth.identities', ...order]
const tag = '$bk' + randomBytes(4).toString('hex') + '$'
const lines = [`-- Escritório Village · backup ${new Date().toISOString()}`, '-- Restaurar: colar no SQL Editor (linhas que já existem são puladas).', 'begin;']
const count = {}
for (const t of all) {
  const [{ j }] = await sql(`select coalesce(json_agg(x), '[]'::json) as j from ${t} x`)
  const json = JSON.stringify(j)
  if (json.includes(tag)) throw new Error('marcador repetido nos dados, rode de novo')
  count[t] = j.length
  if (!j.length) continue
  lines.push(`insert into ${t} select * from json_populate_recordset(null::${t}, ${tag}${json}${tag}) on conflict do nothing;`)
}
lines.push('commit;', '')
writeFileSync(out, lines.join('\n'))
console.log(Object.entries(count).map(([t, n]) => `${t}: ${n}`).join('\n'))
