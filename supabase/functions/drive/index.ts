// Ponte com o Google Drive do Village: lista pastas, mostra miniaturas, baixa e recebe arquivos.
// Acessa o Drive em nome da conta do Village (refresh token nos secrets da função); quem chama
// precisa estar logado no escritório. Só enxerga a pasta raiz e o que estiver dentro dela
// (ou atalhos colocados nela). Não apaga nada.
// Secrets: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN, DRIVE_ROOT_ID (opcional).
import { createClient } from 'jsr:@supabase/supabase-js@2'

const env = (k: string) => Deno.env.get(k) ?? ''
const API = 'https://www.googleapis.com/drive/v3'
const UP = 'https://www.googleapis.com/upload/drive/v3'
const FOLDER = 'application/vnd.google-apps.folder'
const SHORTCUT = 'application/vnd.google-apps.shortcut'
const ROOT_NAME = 'Escritório Village'
const FIELDS = 'id,name,mimeType,size,modifiedTime,thumbnailLink,webViewLink,shortcutDetails'
const ID = /^[\w-]{10,100}$/

class Http extends Error { constructor(public status: number, msg: string) { super(msg) } }

let tok = { v: '', exp: 0 }
async function gtoken() {
  if (tok.exp > Date.now() + 60_000) return tok.v
  if (!env('GOOGLE_REFRESH_TOKEN')) throw new Http(503, 'Drive ainda não conectado.')
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: new URLSearchParams({ client_id: env('GOOGLE_CLIENT_ID'), client_secret: env('GOOGLE_CLIENT_SECRET'), refresh_token: env('GOOGLE_REFRESH_TOKEN'), grant_type: 'refresh_token' }),
  })
  const j = await r.json()
  if (!r.ok) throw new Http(503, 'O Google recusou o acesso ao Drive (' + (j.error_description ?? j.error) + '). Autorize de novo.')
  tok = { v: j.access_token, exp: Date.now() + j.expires_in * 1000 }
  return tok.v
}
async function g(url: string, init: RequestInit = {}) {
  const r = await fetch(url.startsWith('http') ? url : API + url, { ...init, headers: { Authorization: 'Bearer ' + await gtoken(), ...(init.headers ?? {}) } })
  if (!r.ok) throw new Http(r.status === 404 ? 404 : 502, `Drive ${r.status}: ${(await r.text()).slice(0, 300)}`)
  return r
}
const q = (s: string) => encodeURIComponent(s)

let rootId = env('DRIVE_ROOT_ID')
async function folderIn(parent: string, name: string) {
  const j = await (await g(`/files?q=${q(`name = '${name.replace(/'/g, "\\'")}' and mimeType = '${FOLDER}' and '${parent}' in parents and trashed = false`)}&fields=files(id)`)).json()
  if (j.files[0]) return j.files[0].id as string
  const c = await (await g('/files?fields=id', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, mimeType: FOLDER, parents: [parent] }) })).json()
  return c.id as string
}
async function root() { return rootId ||= await folderIn('root', ROOT_NAME) }

// "id está dentro de parent" (direto ou por atalho), lembrado por 10 min
const okPair = new Map<string, number>()
async function childOf(parent: string, id: string) {
  const k = parent + '/' + id
  if ((okPair.get(k) ?? 0) > Date.now()) return true
  const f = await (await g(`/files/${id}?fields=parents`)).json()
  let yes = (f.parents ?? []).includes(parent)
  if (!yes) {
    const j = await (await g(`/files?q=${q(`'${parent}' in parents and mimeType = '${SHORTCUT}' and trashed = false`)}&fields=files(shortcutDetails)&pageSize=500`)).json()
    yes = j.files.some((s: { shortcutDetails?: { targetId: string } }) => s.shortcutDetails?.targetId === id)
  }
  if (yes) okPair.set(k, Date.now() + 600_000)
  return yes
}
/** caminho de pastas desde a raiz; devolve a última */
async function walk(path: unknown) {
  const ids = Array.isArray(path) ? path : []
  if (ids.length > 30 || !ids.every(i => typeof i === 'string' && ID.test(i))) throw new Http(400, 'Caminho inválido.')
  const r = await root()
  if (!ids.length) return r
  if (ids[0] !== r) throw new Http(403, 'Fora da pasta do escritório.')
  for (let i = 1; i < ids.length; i++) if (!await childOf(ids[i - 1], ids[i])) throw new Http(403, 'Fora da pasta do escritório.')
  return ids.at(-1) as string
}
async function fileIn(path: unknown, id: unknown) {
  const dir = await walk(path)
  if (typeof id !== 'string' || !ID.test(id) || !await childOf(dir, id)) throw new Http(403, 'Arquivo fora da pasta.')
  return id
}

type GFile = { id: string; name: string; mimeType: string; size?: string; modifiedTime: string; thumbnailLink?: string; webViewLink?: string; shortcutDetails?: { targetId: string; targetMimeType: string } }
const shape = (f: GFile) => f.shortcutDetails
  ? { id: f.shortcutDetails.targetId, name: f.name, mime: f.shortcutDetails.targetMimeType, modified: f.modifiedTime, thumb: false, link: null, size: 0 }
  : { id: f.id, name: f.name, mime: f.mimeType, modified: f.modifiedTime, thumb: !!f.thumbnailLink, link: f.webViewLink ?? null, size: Number(f.size ?? 0) }

async function multipart(parent: string, name: string, mime: string, body: Uint8Array) {
  const b = 'ev' + crypto.randomUUID()
  const head = new TextEncoder().encode(`--${b}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify({ name, parents: [parent] })}\r\n--${b}\r\nContent-Type: ${mime}\r\n\r\n`)
  const tail = new TextEncoder().encode(`\r\n--${b}--`)
  const all = new Uint8Array(head.length + body.length + tail.length)
  all.set(head); all.set(body, head.length); all.set(tail, head.length + body.length)
  return (await g(`${UP}/files?uploadType=multipart&fields=id`, { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${b}` }, body: all })).json()
}

/** o backup diário (GitHub Actions) se identifica com o token de gestão do próprio projeto */
async function backup(req: Request, name: string) {
  const ref = env('SUPABASE_URL').match(/https:\/\/([a-z0-9]+)\./)?.[1]
  const t = req.headers.get('x-backup-token') ?? ''
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}`, { headers: { Authorization: 'Bearer ' + t } })
  if (!t || !r.ok) throw new Http(401, 'Sem permissão.')
  if (!/^[\w.-]{1,80}$/.test(name)) throw new Http(400, 'Nome inválido.')
  const dir = await folderIn(await root(), 'Backups')
  return multipart(dir, name, 'application/octet-stream', new Uint8Array(await req.arrayBuffer()))
}

async function member(req: Request) {
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer /, '')
  const sb = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), { global: { headers: { Authorization: 'Bearer ' + jwt } } })
  const { data } = await sb.auth.getUser(jwt)
  if (!data.user) throw new Http(401, 'Entre no escritório primeiro.')
  const { data: p } = await sb.from('profiles').select('id').eq('id', data.user.id).maybeSingle()
  if (!p) throw new Http(403, 'Sem perfil no escritório.')
}

Deno.serve(async req => {
  const origin = req.headers.get('Origin') ?? ''
  const cors = {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Expose-Headers': 'content-disposition',
    Vary: 'Origin',
  }
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
  try {
    const u = new URL(req.url)
    if (u.searchParams.get('a') === 'backup') return json(await backup(req, u.searchParams.get('name') ?? ''))
    await member(req)
    const b = await req.json()
    switch (b.a) {
      case 'list': {
        const dir = await walk(b.path)
        const page = typeof b.page === 'string' && /^[\w-]+$/.test(b.page) ? `&pageToken=${b.page}` : ''
        const j = await (await g(`/files?q=${q(`'${dir}' in parents and trashed = false`)}&orderBy=folder,name_natural&pageSize=200&fields=nextPageToken,files(${FIELDS})${page}`)).json()
        return json({ root: await root(), files: j.files.map(shape), next: j.nextPageToken ?? null })
      }
      case 'thumb': {
        const id = await fileIn(b.path, b.id)
        const f = await (await g(`/files/${id}?fields=thumbnailLink`)).json()
        if (!f.thumbnailLink) throw new Http(404, 'Sem miniatura.')
        const px = Math.min(Math.max(Number(b.px) || 400, 100), 1600)
        const img = await g(f.thumbnailLink.replace(/=s\d+$/, `=s${px}`))
        return new Response(img.body, { headers: { ...cors, 'Content-Type': img.headers.get('Content-Type') ?? 'image/jpeg', 'Cache-Control': 'private, max-age=3600' } })
      }
      case 'file': {
        const id = await fileIn(b.path, b.id)
        const f = await (await g(`/files/${id}?fields=name,mimeType`)).json()
        const google = f.mimeType.startsWith('application/vnd.google-apps.')
        const r = await g(google ? `/files/${id}/export?mimeType=application/pdf` : `/files/${id}?alt=media`)
        const name = google ? f.name + '.pdf' : f.name
        return new Response(r.body, { headers: { ...cors, 'Content-Type': r.headers.get('Content-Type') ?? 'application/octet-stream', 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(name)}` } })
      }
      case 'mkdir': {
        const dir = await walk(b.path)
        const name = String(b.name ?? '').trim().slice(0, 120)
        if (!name) throw new Http(400, 'Dê um nome pra pasta.')
        const c = await (await g(`/files?fields=${FIELDS}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, mimeType: FOLDER, parents: [dir] }) })).json()
        return json(shape(c))
      }
      case 'upload': {
        // sessão de envio: o navegador manda o arquivo direto pro Google, sem passar por aqui
        const dir = await walk(b.path)
        const name = String(b.name ?? '').slice(0, 200) || 'arquivo'
        const r = await g(`${UP}/files?uploadType=resumable&fields=${FIELDS}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Upload-Content-Type': String(b.mime || 'application/octet-stream'), 'X-Upload-Content-Length': String(Number(b.size) || 0), Origin: origin },
          body: JSON.stringify({ name, parents: [dir] }),
        })
        return json({ url: r.headers.get('Location') })
      }
    }
    throw new Http(400, 'Ação desconhecida.')
  } catch (e) {
    const status = e instanceof Http ? e.status : 500
    return json({ error: e instanceof Error ? e.message : String(e) }, status)
  }
})
