// Escreve o texto do relatório semanal de uma pessoa a partir das tarefas concluídas e das descrições.
// Usa o Gemini (plano gratuito); a chave fica só no secret da função, nunca no site.
// Quem chama precisa estar logado no escritório.
// Secrets: GEMINI_API_KEY, GEMINI_MODEL (opcional).
import { createClient } from 'jsr:@supabase/supabase-js@2'

const env = (k: string) => Deno.env.get(k) ?? ''
class Http extends Error { constructor(public status: number, msg: string) { super(msg) } }

interface Tarefa { titulo: string; projeto?: string; descricao?: string; itens?: string[]; ajudou?: string; dia?: string }
const corta = (s: unknown, n: number) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n)

async function member(req: Request) {
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer /, '')
  const sb = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), { global: { headers: { Authorization: 'Bearer ' + jwt } } })
  const { data } = await sb.auth.getUser(jwt)
  if (!data.user) throw new Http(401, 'Entre no escritório primeiro.')
  const { data: p } = await sb.from('profiles').select('id').eq('id', data.user.id).maybeSingle()
  if (!p) throw new Http(403, 'Sem perfil no escritório.')
}

// tamanho do texto pelo que a pessoa contou: quanto mais material (resumo + descrições), mais longo,
// até o espaço que sobra na folha A4 depois da lista de tarefas (2 colunas, ~22px por linha)
const palavras = (s: string) => s.split(/\s+/).filter(Boolean).length
function tam(ts: Tarefa[], resumo: string) {
  const material = palavras(resumo) + ts.reduce((a, t) => a + palavras(`${t.descricao ?? ''} ${(t.itens ?? []).join(' ')}`), 0)
  const linhas = Math.floor((1030 - 140 - Math.ceil(ts.length / 2) * 22) / 20)
  const max = Math.max(250, linhas * 14)
  const alvo = Math.min(max, Math.max(120, Math.round(material * 0.8 + ts.length * 18)))
  return { min: Math.round(alvo * 0.8), max: alvo, cheio: alvo >= max }
}

function pedido(b: { nome?: string; cargo?: string; semana?: string; tarefas?: Tarefa[]; resumo?: string }) {
  const ts = (b.tarefas ?? []).slice(0, 60).map(t => {
    const l = [`- ${corta(t.titulo, 160)}`]
    if (t.projeto) l.push(`  projeto: ${corta(t.projeto, 80)}`)
    if (t.ajudou) l.push(`  (ajudou ${corta(t.ajudou, 40)})`)
    if (t.dia) l.push(`  dia: ${corta(t.dia, 20)}`)
    if (t.descricao) l.push(`  o que foi feito: ${corta(t.descricao, 1200)}`)
    if (t.itens?.length) l.push(`  itens: ${t.itens.slice(0, 20).map(i => corta(i, 120)).join('; ')}`)
    return l.join('\n')
  })
  const resumo = corta(b.resumo, 3000)
  const tm = tam(b.tarefas ?? [], resumo)
  if (!ts.length && !resumo) throw new Http(400, 'Escreva um resumo ou conclua alguma tarefa primeiro.')
  return `Você escreve o relatório semanal de trabalho de uma pessoa de uma equipe de marketing, em português do Brasil.
Pessoa: ${corta(b.nome, 80)}${b.cargo ? ` (${corta(b.cargo, 60)})` : ''}
Semana: ${corta(b.semana, 40)}

${resumo ? `Resumo da semana, nas palavras da pessoa (fonte principal):\n${resumo}\n\n` : ''}Tarefas concluídas no quadro${ts.length ? ':\n' + ts.join('\n') : ': nenhuma registrada.'}

Escreva o relatório em primeira pessoa, tom profissional e direto. Junte o resumo e as tarefas sem repetir a mesma entrega duas vezes. Organize e melhore a escrita, mas não exagere nem invente nada que não esteja acima.
Formato: um parágrafo curto de resumo da semana; depois uma lista com "- " de uma linha por entrega (o que foi feito e para quê, quando der pra saber); no fim, uma linha "Próximos passos:" só se as descrições indicarem algo pendente.
Tamanho: entre ${tm.min} e ${tm.max} palavras. ${tm.cheio ? 'Tem bastante coisa: junte entregas parecidas numa linha só para caber numa folha A4 junto com a lista de tarefas.' : 'Quando a pessoa descreveu bastante, aproveite os detalhes dela (o que fez, para quem, resultado) em vez de resumir demais; quando há pouco material, seja breve e não encha linguiça.'} Termine sempre a última frase.
Texto simples, sem markdown além dos "- ", sem títulos, sem emojis.`
}

async function gemini(prompt: string) {
  const key = env('GEMINI_API_KEY')
  if (!key) throw new Http(503, 'A IA ainda não foi ligada (falta a chave do Gemini).')
  const model = env('GEMINI_MODEL') || 'gemini-flash-latest'
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0.4, maxOutputTokens: 8192 } }),
  })
  const j = await r.json().catch(() => null)
  if (r.status === 429) throw new Http(429, 'A IA gratuita chegou no limite agora. Tente de novo em um minuto.')
  if (!r.ok) throw new Http(502, `Gemini ${r.status}: ${corta(j?.error?.message, 200)}`)
  // modelo que pensa gasta parte do limite pensando: se cortou, avisa em vez de entregar texto pela metade
  if (j?.candidates?.[0]?.finishReason === 'MAX_TOKENS') throw new Http(502, 'A IA cortou o texto no meio. Tente de novo.')
  const txt = (j?.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? '').join('').trim()
  if (!txt) throw new Http(502, 'A IA não devolveu texto. Tente de novo.')
  return txt
}

Deno.serve(async req => {
  const origin = req.headers.get('Origin') ?? ''
  const cors = {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
  try {
    await member(req)
    return json({ texto: await gemini(pedido(await req.json())) })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, e instanceof Http ? e.status : 500)
  }
})
