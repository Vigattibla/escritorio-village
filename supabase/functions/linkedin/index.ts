// Publicação no LinkedIn. O adm conecta a conta uma vez (OAuth); os tokens ficam cifrados na tabela social_tokens,
// que o site não lê. Post = tarefa com canal 'linkedin' aprovada: legenda = descrição, imagens = anexos.
// Rotas: POST {a:'conectar'|'agora'|'desconectar'} (logado) · GET /callback (volta do LinkedIn) · POST /tick (cron/trigger).
// Secrets: LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET, LINKEDIN_MODO ('pessoal' | 'empresa', padrão pessoal),
// LINKEDIN_ORG_ID (opcional, número da página), LINKEDIN_VERSION (opcional, AAAAMM), LINKEDIN_SCOPES (opcional).
import { createClient } from 'jsr:@supabase/supabase-js@2'

const env = (k: string) => Deno.env.get(k) ?? ''
class Http extends Error { constructor(public status: number, msg: string) { super(msg) } }

const SB_URL = env('SUPABASE_URL')
const CALLBACK = SB_URL + '/functions/v1/linkedin/callback'
const MODO = env('LINKEDIN_MODO') === 'empresa' ? 'empresa' : 'pessoal'
const SCOPES = env('LINKEDIN_SCOPES') || (MODO === 'empresa' ? 'w_organization_social r_organization_admin' : 'openid profile w_member_social')
const VERSAO = env('LINKEDIN_VERSION') || '202609'
const SITE = /^(https:\/\/[a-z0-9-]+\.github\.io|http:\/\/localhost:\d+|http:\/\/127\.0\.0\.1:\d+)$/
const admin = () => createClient(SB_URL, env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } })

// ---------- cifra dos tokens (AES-GCM com chave tirada do client secret) ----------
const enc = new TextEncoder(), dec = new TextDecoder()
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const unb64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))
async function chave() {
  const h = await crypto.subtle.digest('SHA-256', enc.encode('escritorio-linkedin:' + env('LINKEDIN_CLIENT_SECRET')))
  return crypto.subtle.importKey('raw', h, 'AES-GCM', false, ['encrypt', 'decrypt'])
}
async function cifra(v: unknown) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const c = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await chave(), enc.encode(JSON.stringify(v))))
  return b64(iv) + '.' + b64(c)
}
async function decifra<T>(s: string): Promise<T> {
  const [iv, c] = s.split('.')
  return JSON.parse(dec.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, await chave(), unb64(c))))
}
async function assina(s: string) {
  const k = await crypto.subtle.importKey('raw', enc.encode(env('LINKEDIN_CLIENT_SECRET')), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return b64(new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(s))))
}

// ---------- quem chama ----------
async function member(req: Request) {
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer /, '')
  const sb = createClient(SB_URL, env('SUPABASE_ANON_KEY'), { global: { headers: { Authorization: 'Bearer ' + jwt } } })
  const { data } = await sb.auth.getUser(jwt)
  if (!data.user) throw new Http(401, 'Entre no escritório primeiro.')
  const { data: p } = await sb.from('profiles').select('id,is_admin').eq('id', data.user.id).maybeSingle()
  if (!p) throw new Http(403, 'Sem perfil no escritório.')
  return { ...(p as { id: string; is_admin: boolean }), sb }
}

// ---------- tokens ----------
interface Tokens { access: string; exp: number; refresh?: string; rexp?: number }
async function guarda(t: Tokens, extra: Record<string, unknown> = {}) {
  const db = admin()
  const { error } = await db.from('redes').upsert({ id: 'linkedin', modo: MODO, expira: new Date(t.exp).toISOString(), refresh_expira: t.rexp ? new Date(t.rexp).toISOString() : null, em: new Date().toISOString(), ...extra })
  if (error) throw new Http(500, error.message)
  const r = await db.from('social_tokens').upsert({ id: 'linkedin', dados: await cifra(t), em: new Date().toISOString() })
  if (r.error) throw new Http(500, r.error.message)
}
async function troca(body: Record<string, string>) {
  const r = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: env('LINKEDIN_CLIENT_ID'), client_secret: env('LINKEDIN_CLIENT_SECRET'), ...body }),
  })
  const j = await r.json()
  if (!r.ok) throw new Http(502, 'O LinkedIn recusou (' + (j.error_description ?? j.error ?? r.status) + ').')
  const now = Date.now()
  return { access: j.access_token, exp: now + j.expires_in * 1000, refresh: j.refresh_token, rexp: j.refresh_token_expires_in ? now + j.refresh_token_expires_in * 1000 : undefined } as Tokens
}
async function token() {
  const { data } = await admin().from('social_tokens').select('dados').eq('id', 'linkedin').maybeSingle()
  if (!data) throw new Http(503, 'LinkedIn não conectado. O adm precisa conectar a conta.')
  let t = await decifra<Tokens>(data.dados)
  if (t.exp < Date.now() + 86_400_000 && t.refresh && (t.rexp ?? Infinity) > Date.now()) {
    const n = await troca({ grant_type: 'refresh_token', refresh_token: t.refresh })
    t = { ...n, refresh: n.refresh ?? t.refresh, rexp: n.rexp ?? t.rexp }
    await guarda(t)
  }
  if (t.exp < Date.now()) throw new Http(503, 'O acesso ao LinkedIn venceu. O adm precisa conectar de novo.')
  return t.access
}
async function li(path: string, init: RequestInit = {}, tk?: string) {
  const r = await fetch(path.startsWith('http') ? path : 'https://api.linkedin.com' + path, {
    ...init,
    headers: { Authorization: 'Bearer ' + (tk ?? await token()), 'LinkedIn-Version': VERSAO, 'X-Restli-Protocol-Version': '2.0.0', ...(init.headers ?? {}) },
  })
  if (!r.ok) throw new Http(502, `LinkedIn ${r.status}: ${(await r.text()).slice(0, 300)}`)
  return r
}

// ---------- conectar ----------
async function conectar(origem: string, volta: string, uid: string) {
  if (!env('LINKEDIN_CLIENT_ID')) throw new Http(503, 'Faltam as chaves do app do LinkedIn no Supabase.')
  if (!SITE.test(origem)) throw new Http(400, 'Endereço do site não reconhecido.')
  const st = b64(enc.encode(JSON.stringify({ u: uid, v: volta.startsWith(origem) ? volta : origem, t: Date.now() })))
  const state = st + '.' + await assina(st)
  return 'https://www.linkedin.com/oauth/v2/authorization?' + new URLSearchParams({ response_type: 'code', client_id: env('LINKEDIN_CLIENT_ID'), redirect_uri: CALLBACK, scope: SCOPES, state })
}
async function callback(u: URL) {
  const [st, sig] = (u.searchParams.get('state') ?? '').split('.')
  if (!st || sig !== await assina(st)) throw new Http(400, 'Pedido de conexão inválido.')
  const s = JSON.parse(dec.decode(unb64(st))) as { u: string; v: string; t: number }
  if (Date.now() - s.t > 15 * 60_000) throw new Http(400, 'O pedido de conexão expirou. Tente de novo.')
  const { data: p } = await admin().from('profiles').select('is_admin').eq('id', s.u).maybeSingle()
  if (!p?.is_admin) throw new Http(403, 'Só o adm conecta o LinkedIn.')
  if (u.searchParams.get('error')) return s.v + '#linkedin=' + encodeURIComponent(u.searchParams.get('error_description') ?? 'recusado')
  const t = await troca({ grant_type: 'authorization_code', code: u.searchParams.get('code') ?? '', redirect_uri: CALLBACK })
  let autor = '', nome = ''
  if (MODO === 'pessoal') {
    const me = await (await li('/v2/userinfo', {}, t.access)).json()
    autor = 'urn:li:person:' + me.sub; nome = me.name ?? ''
  } else {
    let org = env('LINKEDIN_ORG_ID')
    if (!org) {
      const j = await (await li('/rest/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED', {}, t.access)).json()
      org = String(j.elements?.[0]?.organization ?? '').split(':').pop() ?? ''
    }
    if (!org) throw new Http(403, 'Essa conta não administra nenhuma página.')
    autor = 'urn:li:organization:' + org
    const o = await li('/rest/organizations/' + org, {}, t.access).then(r => r.json()).catch(() => ({}))
    nome = o.localizedName ?? 'Página ' + org
  }
  await guarda(t, { autor, nome, conectado_por: s.u })
  return s.v + '#linkedin=ok'
}

// ---------- publicar ----------
// texto do LinkedIn ("little text"): escapa os reservados; #palavra vira hashtag
const LT = /[\\|{}@[\]()<>#*_~]/g
const legenda = (s: string) => s.split(/(#[\p{L}\p{N}_]+)/u).map(p => /^#[\p{L}\p{N}_]+$/u.test(p) ? `{hashtag|\\#|${p.slice(1)}}` : p.replace(LT, c => '\\' + c)).join('')

interface Anexo { name: string; path: string; type: string }
async function sobeImagem(autor: string, a: Anexo) {
  const db = admin()
  const { data: f, error } = await db.storage.from('anexos').download(a.path)
  if (error || !f) throw new Http(502, 'Não consegui ler o anexo ' + a.name + '.')
  const j = await (await li('/rest/images?action=initializeUpload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ initializeUploadRequest: { owner: autor } }) })).json()
  const up = await fetch(j.value.uploadUrl, { method: 'PUT', headers: { Authorization: 'Bearer ' + await token() }, body: await f.arrayBuffer() })
  if (!up.ok) throw new Http(502, `Envio da imagem ${a.name} falhou (${up.status}).`)
  return j.value.image as string
}
async function publica(id: string) {
  const db = admin()
  const { data: t } = await db.from('tasks').select('id,title,notes,attachments,channel,status').eq('id', id).maybeSingle()
  if (!t || t.channel !== 'linkedin' || t.status !== 'done') throw new Http(409, 'A tarefa não está aprovada para o LinkedIn.')
  const { data: rede } = await db.from('redes').select('autor').eq('id', 'linkedin').maybeSingle()
  if (!rede?.autor) throw new Http(503, 'LinkedIn não conectado. O adm precisa conectar a conta.')
  const texto = String(t.notes ?? '').trim()
  if (!texto) throw new Http(400, 'Sem legenda: escreva o texto do post na descrição.')
  if (texto.length > 3000) throw new Http(400, 'A legenda passa de 3.000 caracteres (limite do LinkedIn).')
  const anexos = (t.attachments ?? []) as Anexo[]
  if (anexos.some(a => a.type.startsWith('video/'))) throw new Http(400, 'Vídeo no LinkedIn ainda não está pronto; por enquanto só texto e imagens.')
  const imgs = anexos.filter(a => /^image\/(jpeg|png|gif)$/.test(a.type)).slice(0, 20)
  const ids = []
  for (const a of imgs) ids.push(await sobeImagem(rede.autor, a))
  const content = ids.length === 1 ? { content: { media: { id: ids[0], altText: t.title.slice(0, 120) } } }
    : ids.length > 1 ? { content: { multiImage: { images: ids.map(i => ({ id: i, altText: t.title.slice(0, 120) })) } } } : {}
  const r = await li('/rest/posts', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      author: rede.autor, commentary: legenda(texto), visibility: 'PUBLIC', lifecycleState: 'PUBLISHED', isReshareDisabledByAuthor: false,
      distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] }, ...content,
    }),
  })
  const urn = r.headers.get('x-restli-id') ?? ''
  return { urn, link: urn ? `https://www.linkedin.com/feed/update/${urn}/` : null }
}
async function tick() {
  const db = admin()
  // ficou "publicando" por mais de 15 min: pode ter saído ou não, então não tenta de novo sozinho
  await db.from('postagens').update({ estado: 'erro', erro: 'Interrompido no meio. Confira no LinkedIn antes de tentar de novo.' }).eq('estado', 'publicando').lt('em', new Date(Date.now() - 15 * 60_000).toISOString())
  const { data, error } = await db.rpc('postagens_pegar', { n: 5 })
  if (error) throw new Http(500, error.message)
  const feitos: string[] = []
  for (const p of (data ?? []) as { id: string }[]) {
    try {
      const r = await publica(p.id)
      await db.from('postagens').update({ estado: 'publicado', urn: r.urn, link: r.link, erro: null, em: new Date().toISOString() }).eq('id', p.id)
      feitos.push(p.id)
    } catch (e) {
      await db.from('postagens').update({ estado: 'erro', erro: (e instanceof Error ? e.message : String(e)).slice(0, 500), em: new Date().toISOString() }).eq('id', p.id)
    }
  }
  return { feitos: feitos.length, vistos: data?.length ?? 0 }
}

Deno.serve(async req => {
  const origin = req.headers.get('Origin') ?? ''
  const cors = { 'Access-Control-Allow-Origin': origin || '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS', Vary: 'Origin' }
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
  const u = new URL(req.url)
  try {
    if (u.pathname.endsWith('/callback')) {
      try { return Response.redirect(await callback(u), 302) } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        return new Response(`<!doctype html><meta charset="utf-8"><title>LinkedIn</title><p style="font:16px system-ui;padding:24px">Não deu para conectar: ${msg.replace(/[<>&]/g, '')}</p>`, { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
      }
    }
    if (u.pathname.endsWith('/tick')) return json(await tick())
    const eu = await member(req)
    const b = await req.json()
    switch (b.a) {
      case 'conectar':
        if (!eu.is_admin) throw new Http(403, 'Só o adm conecta o LinkedIn.')
        return json({ url: await conectar(origin, String(b.volta ?? ''), eu.id) })
      case 'desconectar':
        if (!eu.is_admin) throw new Http(403, 'Só o adm desconecta o LinkedIn.')
        await admin().from('redes').delete().eq('id', 'linkedin')
        return json({ ok: true })
      case 'agora': {
        // adm ou quem aprovou: põe de volta na fila (erro) ou adianta (agendado)
        const db = admin()
        const { data: p } = await db.from('postagens').select('estado,aprovado_por').eq('id', String(b.id ?? '')).maybeSingle()
        if (!p) throw new Http(404, 'Esse post não está na fila.')
        if (!eu.is_admin && p.aprovado_por !== eu.id) throw new Http(403, 'Só o adm ou quem aprovou publica agora.')
        if (p.estado !== 'agendado' && p.estado !== 'erro') throw new Http(409, p.estado === 'publicado' ? 'Já foi publicado.' : 'Está publicando agora.')
        await db.from('postagens').update({ estado: 'agendado', quando: new Date().toISOString(), erro: null }).eq('id', b.id)
        return json(await tick())
      }
    }
    throw new Http(400, 'Ação desconhecida.')
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, e instanceof Http ? e.status : 500)
  }
})
