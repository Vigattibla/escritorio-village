// Legendas de redes sociais com a voz da marca. O navegador manda quadros do vídeo (ou as imagens)
// e o áudio em mono baixo; o Gemini olha, escuta e escreve 3 opções. O guia de voz vem da tabela
// marcas_voz, lido com o login da pessoa. A chave fica só no secret da função.
// GET  → marcas e guias.  POST → { opcoes }.  POST /guia → salva o guia (RLS: gerente, Chefe ou adm).
// Secrets: GEMINI_API_KEY, GEMINI_MODEL (opcional).
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'

const env = (k: string) => Deno.env.get(k) ?? ''
class Http extends Error { constructor(public status: number, msg: string) { super(msg) } }
const corta = (s: unknown, n: number) => String(s ?? '').trim().slice(0, n)

async function member(req: Request) {
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer /, '')
  const sb = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), { global: { headers: { Authorization: 'Bearer ' + jwt } } })
  const { data } = await sb.auth.getUser(jwt)
  if (!data.user) throw new Http(401, 'Entre no escritório primeiro.')
  const { data: p } = await sb.from('profiles').select('id').eq('id', data.user.id).maybeSingle()
  if (!p) throw new Http(403, 'Sem perfil no escritório.')
  return { sb, uid: data.user.id }
}

type Formato = 'reel' | 'carrossel' | 'stories' | 'post'
const FORMATO: Record<Formato, string> = {
  reel: 'Legenda de Reels (vídeo vertical). Primeira linha curta que prende, depois 2 a 5 linhas curtas com a mensagem, e um CTA calmo no fim.',
  carrossel: 'Legenda de carrossel. Primeira linha convida a passar as imagens; o corpo resume a ideia das imagens em ordem, sem repetir o texto que já está nelas; CTA no fim.',
  stories: 'Textos para uma sequência de stories. Na "legenda", uma tela por linha, no formato "Tela 1: …", "Tela 2: …" (3 a 5 telas, até 12 palavras cada); a última traz o CTA e uma sugestão de figurinha entre colchetes, como [enquete] ou [link]. Hashtags: no máximo 2.',
  post: 'Legenda de post de foto única. Curta: 2 a 4 linhas e um CTA.',
}

interface Midia { mime: string; data: string }
interface Pedido { marca?: string; formato?: Formato; contexto?: string; ajuste?: string; anterior?: string; midia?: Midia[]; video?: boolean; duracao?: number }

function prompt(guia: string, nome: string, b: Pedido) {
  const f = FORMATO[b.formato ?? 'reel'] ?? FORMATO.reel
  const midia = !b.midia?.length ? 'Não há mídia: escreva só a partir do contexto.'
    : b.video ? `Em anexo estão quadros em ordem de um vídeo de ${Math.round(b.duracao ?? 0)} s${b.midia.some(m => m.mime.startsWith('audio/')) ? ' e o áudio dele (preste atenção no que é falado e na música)' : ''}.`
    : `Em anexo estão as imagens da peça, em ordem.`
  return `Você é social media da marca ${nome} e escreve em português do Brasil.

GUIA DA MARCA (siga à risca; ele manda mais que qualquer costume de rede social):
${guia}

TAREFA: ${f}
${midia} Descreva o que realmente aparece ou é dito; não invente lugar, preço, número de diárias nem condição que não esteja na mídia ou no contexto.
${b.contexto ? `\nContexto de quem pediu (fonte de verdade para fatos): ${corta(b.contexto, 2000)}\n` : ''}${b.anterior ? `\nVersão anterior, que a pessoa quer mudar:\n${corta(b.anterior, 3000)}\nPedido de ajuste: ${corta(b.ajuste, 500) || 'outra abordagem'}\n` : b.ajuste ? `\nPedido extra: ${corta(b.ajuste, 500)}\n` : ''}
Entregue 3 opções com abordagens diferentes entre si (por exemplo: emoção da cena, benefício concreto, curiosidade). "titulo" = 2 a 4 palavras dizendo a abordagem. "legenda" = o texto pronto para colar, com quebras de linha, sem as hashtags. "hashtags" = lista sem repetir, cada uma começando com #.`
}

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    resumo: { type: 'STRING', description: 'uma frase sobre o que a mídia mostra' },
    opcoes: { type: 'ARRAY', items: { type: 'OBJECT', properties: { titulo: { type: 'STRING' }, legenda: { type: 'STRING' }, hashtags: { type: 'ARRAY', items: { type: 'STRING' } } }, required: ['titulo', 'legenda', 'hashtags'] } },
  },
  required: ['resumo', 'opcoes'],
}

async function gemini(text: string, midia: Midia[]) {
  const key = env('GEMINI_API_KEY')
  if (!key) throw new Http(503, 'A IA ainda não foi ligada (falta a chave do Gemini).')
  const model = env('GEMINI_MODEL') || 'gemini-flash-latest'
  const parts = [...midia.map(m => ({ inline_data: { mime_type: m.mime, data: m.data } })), { text }]
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig: { temperature: 0.8, maxOutputTokens: 8192, responseMimeType: 'application/json', responseSchema: SCHEMA } }),
  })
  const j = await r.json().catch(() => null)
  if (r.status === 429) throw new Http(429, 'A IA gratuita chegou no limite agora. Tente de novo em um minuto.')
  if (!r.ok) throw new Http(502, `Gemini ${r.status}: ${corta(j?.error?.message, 200)}`)
  if (j?.candidates?.[0]?.finishReason === 'MAX_TOKENS') throw new Http(502, 'A IA cortou o texto no meio. Tente de novo.')
  const txt = (j?.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? '').join('').trim()
  try { return JSON.parse(txt) } catch { throw new Http(502, 'A IA não devolveu as legendas. Tente de novo.') }
}

async function marcas(sb: SupabaseClient) {
  const { data, error } = await sb.from('marcas_voz').select('id, nome, guia, updated_at').order('nome')
  if (error) throw new Http(500, error.message)
  return data ?? []
}

Deno.serve(async req => {
  const origin = req.headers.get('Origin') ?? ''
  const cors = {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    Vary: 'Origin',
  }
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
  try {
    const { sb, uid } = await member(req)
    if (req.method === 'GET') return json({ marcas: await marcas(sb) })
    const b = await req.json()
    if (new URL(req.url).pathname.endsWith('/guia')) {
      const { data, error } = await sb.from('marcas_voz').update({ guia: corta(b.guia, 20000), updated_at: new Date().toISOString(), updated_by: uid }).eq('id', b.marca).select('id')
      if (error) throw new Http(500, error.message)
      if (!data?.length) throw new Http(403, 'Só gerente, Chefe ou adm editam o guia da marca.')
      return json({ ok: true })
    }
    const m = (await marcas(sb)).find(x => x.id === b.marca)
    if (!m) throw new Http(400, 'Marca não encontrada.')
    const midia: Midia[] = (Array.isArray(b.midia) ? b.midia : []).slice(0, 24)
      .filter((x: Midia) => /^(image|audio)\/[\w.+-]+$/.test(x?.mime ?? '') && typeof x.data === 'string')
    if (midia.reduce((a, x) => a + x.data.length, 0) > 18_000_000) throw new Http(413, 'Mídia grande demais. Use um vídeo mais curto ou menos imagens.')
    if (!midia.length && !corta(b.contexto, 10)) throw new Http(400, 'Mande um vídeo, imagens ou escreva o contexto.')
    const r = await gemini(prompt(m.guia, m.nome, b), midia)
    return json({ resumo: r.resumo ?? '', opcoes: (r.opcoes ?? []).slice(0, 3) })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, e instanceof Http ? e.status : 500)
  }
})
