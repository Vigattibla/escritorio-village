/* Turmeo Widget: a página que roda dentro do programinha do PC (Turmeo.exe).
   Sem React, só supabase-js: abre rápido e pesa pouco. Conversa com a casca por window.chrome.webview. */
import { createClient, type RealtimeChannel } from '@supabase/supabase-js'
import { toEmail } from '../data/login'
import type { Priority, TaskStatus } from '../types'
import './widget.css'

type T = {
  id: string; owner_id: string; created_by: string; title: string; status: TaskStatus
  due: string | null; due_time?: string | null; priority: Priority | null; remind_at: string | null
  position: number; created_at: string
}
type Tela = 'carregando' | 'login' | 'barra' | 'painel'

const URL_SB = import.meta.env.VITE_SUPABASE_URL as string
const CHAVE = import.meta.env.VITE_SUPABASE_ANON_KEY as string
const CAPTCHA = import.meta.env.VITE_TURNSTILE_SITEKEY as string | undefined
const sb = createClient(URL_SB, CHAVE)
const APP = new URL('./', location.href).href

// ---------- casca (Turmeo.exe) ----------
type WV = { postMessage: (m: unknown) => void; addEventListener: (t: 'message', f: (e: { data: Record<string, unknown> }) => void) => void }
const wv = (window as unknown as { chrome?: { webview?: WV } }).chrome?.webview
const casca = (m: Record<string, unknown>) => wv?.postMessage(m)
const abrir = (url: string) => (wv ? casca({ t: 'abrir', url }) : window.open(url, '_blank'))

// ---------- estado ----------
const S = {
  tela: 'carregando' as Tela,
  uid: '', nome: '', foto: '' as string | null,
  tarefas: [] as T[], nomes: {} as Record<string, string>,
  erro: '', ocupado: false, menu: false, iniciar: false, versao: '',
  carregou: false, mexendo: '' as string,
  captcha: null as string | null,
}
const visto = new Set<string>()
let canal: RealtimeChannel | null = null

const el = document.getElementById('w')!
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

// ---------- datas ----------
const hoje = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
function quando(t: T) {
  if (!t.due) return ''
  const h = hoje(), [y, m, d] = t.due.split('-').map(Number)
  const dt = new Date(y, m - 1, d), dias = Math.round((dt.getTime() - new Date(h + 'T00:00').getTime()) / 864e5)
  const hora = t.due_time ? ' · ' + t.due_time : ''
  if (dias === 0) return 'hoje' + hora
  if (dias === 1) return 'amanhã' + hora
  if (dias === -1) return 'ontem'
  if (dias < 0) return `há ${-dias} dias`
  if (dias < 7) return dt.toLocaleDateString('pt-BR', { weekday: 'long' }) + hora
  return dt.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }).replace('.', '') + hora
}
const grupo = (t: T) => t.status === 'inbox' ? 'chegou' : !t.due ? 'sem' : t.due < hoje() ? 'atrasada' : t.due === hoje() ? 'hoje' : 'depois'

// ---------- Meo (cabeça em pixel, igual ao do app) ----------
const meo = (feliz = false, cor = '#26324F') => `<svg class="meo" viewBox="1 0 16 10" shape-rendering="crispEdges" aria-hidden="true">
<g class="or-e"><path fill="${cor}" d="M3 0h2v1h-2z M2 1h4v1h-4z"/><path fill="#FF9ECF" d="M3 1h2v1h-2z"/></g>
<g class="or-d"><path fill="${cor}" d="M13 0h2v1h-2z M12 1h4v1h-4z"/><path fill="#FF9ECF" d="M13 1h2v1h-2z"/></g>
<path fill="${cor}" d="M2 2h14v1h-14z M1 3h16v6h-16z M2 9h14v1h-14z"/>
${feliz ? '<path fill="#FFF8EC" d="M4 5h1v1h-1z M5 4h1v1h-1z M6 5h1v1h-1z M11 5h1v1h-1z M12 4h1v1h-1z M13 5h1v1h-1z"/>'
    : '<g class="olhos"><path fill="#FFF8EC" d="M4 4h2v3h-2z M12 4h2v3h-2z"/><path fill="#101014" d="M4 5h1v2h-1z M12 5h1v2h-1z"/></g>'}
<path fill="#FF9ECF" d="M8 7h2v1h-2z"/></svg>`

// ícones de linha, 16px
const ic: Record<string, string> = {
  abrir: '<path d="M6 3h7v7M13 3 5.5 10.5M11 9v4H3V5h4"/>',
  play: '<path d="M5 3.5v9l7-4.5z"/>',
  pausa: '<path d="M5.5 3.5v9M10.5 3.5v9"/>',
  ok: '<path d="m3.5 8.5 3 3 6-7"/>',
  mais: '<circle cx="3.5" cy="8" r=".9"/><circle cx="8" cy="8" r=".9"/><circle cx="12.5" cy="8" r=".9"/>',
  baixo: '<path d="m4 6 4 4 4-4"/>',
  cima: '<path d="m4 10 4-4 4 4"/>',
  sair: '<path d="M9.5 3H13v10H9.5M6.5 5 3.5 8l3 3M3.5 8H10"/>',
  lixo: '<path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5"/>',
  x: '<path d="m4 4 8 8M12 4l-8 8"/>',
  grip: '<circle cx="6" cy="4" r=".9"/><circle cx="10" cy="4" r=".9"/><circle cx="6" cy="8" r=".9"/><circle cx="10" cy="8" r=".9"/><circle cx="6" cy="12" r=".9"/><circle cx="10" cy="12" r=".9"/>',
  liga: '<path d="M8 2.5v5M4.6 4.6a5 5 0 1 0 6.8 0"/>',
}
const I = (n: string) => `<svg class="i" viewBox="0 0 16 16" aria-hidden="true">${ic[n]}</svg>`

// ---------- desenho ----------
function desenhar() {
  document.body.dataset.tela = S.tela
  if (S.tela === 'carregando') el.innerHTML = `<div class="barra"><span class="cab">${meo()}</span><span class="txt"><b>Turmeo</b><small>abrindo…</small></span></div>`
  else if (S.tela === 'login') el.innerHTML = telaLogin()
  else if (S.tela === 'barra') el.innerHTML = telaBarra()
  else el.innerHTML = telaPainel()
  if (S.tela === 'login') montarCaptcha()
  medir()
}

function telaLogin() {
  return `<form class="card login" id="f-login" autocomplete="on">
  <div class="topo arrasta">${meo()}<div><b>Turmeo no seu PC</b><small>Entre com a mesma conta do Turmeo</small></div>
    <button type="button" class="ib solto" data-a="esconder" title="Esconder">${I('baixo')}</button></div>
  <label>Usuário<input name="u" autocomplete="username" required autofocus placeholder="nome.sobrenome"></label>
  <label>Senha<input name="p" type="password" autocomplete="current-password" required></label>
  <div id="cap"></div>
  ${S.erro ? `<p class="erro">${esc(S.erro)}</p>` : ''}
  <button class="btn" ${S.ocupado ? 'disabled' : ''}>${S.ocupado ? 'Entrando…' : 'Entrar'}</button>
  ${wv ? `<button type="button" class="link" data-a="desinstalar">${I('lixo')} Desinstalar o widget deste PC</button>` : ''}
</form>`
}

function contagem() {
  const abertas = S.tarefas.filter(t => t.owner_id === S.uid)
  const chegou = abertas.filter(t => t.status === 'inbox').length
  const atras = abertas.filter(t => grupo(t) === 'atrasada').length
  const hj = abertas.filter(t => grupo(t) === 'hoje').length
  return { total: abertas.length, chegou, atras, hj }
}

function telaBarra() {
  const c = contagem()
  const prox = S.tarefas.find(t => t.owner_id === S.uid && t.status === 'doing') ?? ordenadas().find(t => t.owner_id === S.uid && t.status !== 'inbox')
  const titulo = c.total === 0 ? 'Tudo em dia' : c.hj ? `${c.hj} pra hoje` : `${c.total} ${c.total === 1 ? 'tarefa' : 'tarefas'}`
  const sub = c.atras ? `<em>${c.atras} atrasada${c.atras > 1 ? 's' : ''}</em>` + (prox ? ' · ' + esc(prox.title) : '') : prox ? (prox.status === 'doing' ? 'fazendo: ' : 'próxima: ') + esc(prox.title) : 'nada pendente'
  return `<div class="barra${c.chegou ? ' chama' : ''}">
  <span class="grip arrasta" title="Arraste pra mudar de lugar">${I('grip')}</span>
  <button class="corpo" data-a="abrirPainel">
    <span class="cab">${meo(c.total === 0)}</span>
    <span class="txt"><b>${titulo}</b><small>${sub}</small></span>
    ${c.chegou ? `<span class="pino" title="Pedidos novos">${c.chegou}</span>` : ''}
    <span class="seta">${I('cima')}</span>
  </button>
</div>`
}

function ordenadas() {
  const pr = { alta: 0, media: 1, baixa: 2 } as Record<string, number>
  return [...S.tarefas].sort((a, b) =>
    (a.status === 'doing' ? 0 : 1) - (b.status === 'doing' ? 0 : 1)
    || (a.due ?? '9999').localeCompare(b.due ?? '9999')
    || (a.due_time ?? '99').localeCompare(b.due_time ?? '99')
    || (pr[a.priority ?? ''] ?? 3) - (pr[b.priority ?? ''] ?? 3)
    || a.position - b.position)
}

const GRUPOS: [string, string][] = [['chegou', 'Chegou pra você'], ['atrasada', 'Atrasadas'], ['hoje', 'Hoje'], ['depois', 'Próximos dias'], ['sem', 'Sem prazo']]

function linha(t: T) {
  const minha = t.owner_id === S.uid
  const q = quando(t), g = grupo(t)
  const quem = !minha ? `<span class="chip">ajudando ${esc(S.nomes[t.owner_id] ?? '')}</span>` : t.status === 'inbox' && t.created_by !== S.uid ? `<span class="chip">de ${esc(S.nomes[t.created_by] ?? 'alguém')}</span>` : ''
  const acao = !minha ? ''
    : t.status === 'inbox' ? `<button class="mini cheio" data-a="aceitar" data-id="${t.id}">${I('ok')}Aceitar</button>`
    : t.status === 'todo' ? `<button class="mini" data-a="comecar" data-id="${t.id}" title="Começar">${I('play')}Começar</button>`
    : t.status === 'doing' ? `<button class="mini" data-a="pausar" data-id="${t.id}" title="Pausar">${I('pausa')}</button>` : ''
  return `<li class="t ${t.status} ${S.mexendo === t.id ? 'mexe' : ''}">
  <span class="bol ${t.priority ?? ''}" title="${t.priority ? 'prioridade ' + t.priority : ''}"></span>
  <button class="tt" data-a="ver" data-id="${t.id}" title="Abrir no Turmeo">
    <span class="nome">${esc(t.title)}</span>
    <span class="meta">${t.status === 'doing' ? '<span class="chip faz">fazendo</span>' : ''}${t.status === 'review' ? '<span class="chip apr">em aprovação</span>' : ''}${q ? `<span class="chip ${g === 'atrasada' ? 'quente' : g === 'hoje' ? 'hj' : ''}">${esc(q)}</span>` : ''}${quem}</span>
  </button>
  <span class="acoes">${acao}<button class="ib" data-a="ver" data-id="${t.id}" title="Abrir no Turmeo">${I('abrir')}</button></span>
</li>`
}

function telaPainel() {
  const lista = ordenadas()
  const blocos = GRUPOS.map(([g, nome]) => {
    const ts = lista.filter(t => grupo(t) === g)
    return ts.length ? `<section class="g ${g}"><h3>${nome}<span>${ts.length}</span></h3><ul>${ts.map(linha).join('')}</ul></section>` : ''
  }).join('')
  const primeiro = S.nome.split(' ')[0]
  const data = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
  return `<div class="card painel">
  <header class="arrasta">
    <span class="cab">${meo(!S.tarefas.length)}</span>
    <div class="ola"><b>Oi, ${esc(primeiro)}</b><small>${data}</small></div>
    <button class="ib" data-a="menu" title="Opções">${I('mais')}</button>
    <button class="ib" data-a="fecharPainel" title="Recolher">${I('baixo')}</button>
  </header>
  ${S.menu ? menu() : ''}
  <div class="rolo">${blocos || `<div class="vazio">${meo(true)}<b>Tudo em dia</b><small>Quando chegar tarefa nova, eu aviso aqui.</small></div>`}</div>
  ${S.erro ? `<p class="erro">${esc(S.erro)}</p>` : ''}
  <footer><button class="btn" data-a="turmeo">Abrir o Turmeo ${I('abrir')}</button></footer>
</div>`
}

function menu() {
  const foto = S.foto ? `<img src="${esc(S.foto)}" alt="">` : `<span>${esc(S.nome.slice(0, 1).toUpperCase())}</span>`
  return `<div class="menu" role="menu">
  <div class="conta">${foto}<div><b>${esc(S.nome)}</b><small>conta conectada</small></div></div>
  <button data-a="trocar">${I('sair')} Trocar de conta</button>
  ${wv ? `<button data-a="iniciar" class="tog ${S.iniciar ? 'on' : ''}">${I('liga')} Abrir quando o Windows ligar<span class="sw"></span></button>
  <button data-a="fechar">${I('x')} Fechar o widget</button>
  <button data-a="desinstalar" class="perigo">${I('lixo')} Desinstalar deste PC</button>` : ''}
  ${S.versao ? `<small class="ver">versão ${esc(S.versao)}</small>` : ''}
</div>`
}

// tamanho: a casca ajusta a janela ao conteúdo
let ultimo = ''
function medir() {
  // setTimeout e não requestAnimationFrame: com a janela ainda escondida o rAF não roda
  setTimeout(() => {
    const r = (el.firstElementChild as HTMLElement | null)?.getBoundingClientRect()
    if (!r) return
    const k = `${Math.ceil(r.width)}x${Math.ceil(r.height)}`
    if (k === ultimo) return
    ultimo = k
    casca({ t: 'tam', w: Math.ceil(r.width), h: Math.ceil(r.height) })
  }, 0)
}
new ResizeObserver(() => medir()).observe(el)

// ---------- captcha (Turnstile) ----------
let capId: string | null = null
type TS = { render: (el: HTMLElement, o: Record<string, unknown>) => string; reset: (id: string) => void }
function montarCaptcha() {
  const alvo = document.getElementById('cap')
  if (!CAPTCHA || !alvo) return
  const w = window as unknown as { turnstile?: TS }
  const render = () => { capId = w.turnstile!.render(alvo, { sitekey: CAPTCHA, language: 'pt-br', appearance: 'interaction-only', callback: (t: string) => { S.captcha = t }, 'expired-callback': () => { S.captcha = null } }) }
  if (w.turnstile) return render()
  const s = document.createElement('script')
  s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
  s.onload = render
  document.head.appendChild(s)
}

// ---------- dados ----------
async function entrar(u: string, p: string) {
  S.ocupado = true; S.erro = ''; desenhar()
  const { error } = await sb.auth.signInWithPassword({ email: toEmail(u), password: p, options: S.captcha ? { captchaToken: S.captcha } : undefined })
  S.ocupado = false
  if (error) {
    S.erro = /invalid login/i.test(error.message) ? 'Usuário ou senha incorretos.' : /captcha/i.test(error.message) ? 'Confirme que não é robô e tente de novo.' : /rate|too many/i.test(error.message) ? 'Muitas tentativas. Espere uns minutos.' : error.message
    S.captcha = null
    desenhar()
    const w = window as unknown as { turnstile?: TS }
    if (capId) w.turnstile?.reset(capId)
  }
}

async function comecar(uid: string) {
  S.uid = uid
  const { data: p } = await sb.from('profiles').select('id, name, photo').eq('id', uid).maybeSingle()
  S.nome = p?.name ?? ''
  S.foto = p?.photo ?? null
  S.tela = 'barra'; S.carregou = false; visto.clear()
  await carregar()
  canal?.unsubscribe()
  canal = sb.channel('widget-' + uid)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => agendar())
    .subscribe()
}

let timer = 0
const agendar = () => { clearTimeout(timer); timer = window.setTimeout(carregar, 400) }

async function carregar() {
  if (!S.uid) return
  const { data, error } = await sb.from('tasks')
    .select('id, owner_id, created_by, title, status, due, due_time, priority, remind_at, position, created_at')
    .or(`owner_id.eq.${S.uid},collaborators.cs.{${S.uid}}`)
    .in('status', ['inbox', 'todo', 'doing', 'review'])
  if (error) { S.erro = 'Não deu pra buscar as tarefas agora.'; desenhar(); return }
  S.erro = ''
  const lista = data as T[]
  // aviso de tarefa nova (só depois da primeira carga)
  for (const t of lista) {
    if (S.carregou && !visto.has(t.id) && t.owner_id === S.uid && t.created_by !== S.uid)
      casca({ t: 'avisar', titulo: t.status === 'inbox' ? 'Pedido novo no Turmeo' : 'Tarefa nova no Turmeo', texto: t.title })
    visto.add(t.id)
  }
  S.carregou = true
  S.tarefas = lista
  const faltam = [...new Set(lista.flatMap(t => [t.owner_id, t.created_by]))].filter(id => id && !S.nomes[id])
  if (faltam.length) {
    const { data: ps } = await sb.from('profiles').select('id, name').in('id', faltam)
    for (const p of ps ?? []) S.nomes[p.id] = p.name
  }
  desenhar()
}

// lembretes (remind_at) e virada do dia
let checado = Date.now()
setInterval(() => {
  const agora = Date.now()
  for (const t of S.tarefas) {
    const r = t.remind_at ? Date.parse(t.remind_at) : NaN
    if (t.owner_id === S.uid && r > checado && r <= agora) casca({ t: 'avisar', titulo: 'Lembrete', texto: t.title })
  }
  checado = agora
  if (S.tela === 'barra' || S.tela === 'painel') desenhar()
}, 30_000)
setInterval(() => { if (S.uid) carregar() }, 5 * 60_000)

async function mudar(id: string, status: TaskStatus) {
  S.mexendo = id; desenhar()
  const { error } = await sb.from('tasks').update({ status, position: Date.now() }).eq('id', id)
  S.mexendo = ''
  if (error) S.erro = /row-level|permiss/i.test(error.message) ? 'Sem permissão pra mudar essa tarefa.' : 'Não deu pra salvar. Tente de novo.'
  await carregar()
}

async function trocarConta() {
  canal?.unsubscribe(); canal = null
  await sb.auth.signOut()
  Object.assign(S, { uid: '', nome: '', foto: null, tarefas: [], menu: false, erro: '', tela: 'login' as Tela })
  desenhar()
}

// ---------- eventos ----------
el.addEventListener('click', e => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-a]')
  if (!b) { if (S.menu && !(e.target as HTMLElement).closest('.menu')) { S.menu = false; desenhar() } return }
  const a = b.dataset.a!, id = b.dataset.id ?? ''
  if (a !== 'menu' && a !== 'iniciar') S.menu = false
  if (a === 'abrirPainel') { S.tela = 'painel'; casca({ t: 'focar' }) }
  else if (a === 'fecharPainel') S.tela = 'barra'
  else if (a === 'menu') S.menu = !S.menu
  else if (a === 'ver') abrir(APP + '#tarefa=' + id)
  else if (a === 'turmeo') abrir(APP)
  else if (a === 'comecar') return void mudar(id, 'doing')
  else if (a === 'pausar') return void mudar(id, 'todo')
  else if (a === 'aceitar') return void mudar(id, 'todo')
  else if (a === 'trocar') return void trocarConta()
  else if (a === 'iniciar') { S.iniciar = !S.iniciar; casca({ t: 'iniciar', on: S.iniciar }) }
  else if (a === 'fechar') return void casca({ t: 'sair' })
  else if (a === 'desinstalar') return void casca({ t: 'desinstalar' })
  else if (a === 'esconder') return void casca({ t: 'esconder' })
  desenhar()
})
el.addEventListener('submit', e => {
  e.preventDefault()
  const f = new FormData(e.target as HTMLFormElement)
  entrar(String(f.get('u') ?? ''), String(f.get('p') ?? ''))
})
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return
  if (S.menu) S.menu = false
  else if (S.tela === 'painel') S.tela = 'barra'
  desenhar()
})

wv?.addEventListener('message', e => {
  const m = e.data
  if (m.t === 'info') { S.iniciar = !!m.iniciar; S.versao = String(m.versao ?? '') }
  else if (m.t === 'trocarConta') return void trocarConta()
  else if (m.t === 'abrirPainel' && S.uid) S.tela = 'painel'
  else if (m.t === 'desfoco' && S.tela === 'painel') { S.tela = 'barra'; S.menu = false }
  else return
  desenhar()
})

// ---------- começo ----------
desenhar()
if (import.meta.env.DEV && location.search.includes('demo')) demo()
else sb.auth.getSession().then(({ data }) => {
  if (data.session) comecar(data.session.user.id)
  else { S.tela = 'login'; desenhar() }
})

// só no npm run dev: ?demo mostra a barra com tarefas de mentira (nada vai pro banco)
function demo() {
  const d = (n: number) => { const x = new Date(Date.now() + n * 864e5); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}` }
  const t = (id: string, title: string, status: TaskStatus, due: string | null, priority: Priority | null, extra: Partial<T> = {}): T =>
    ({ id, owner_id: 'eu', created_by: 'eu', title, status, due, due_time: null, priority, remind_at: null, position: 0, created_at: '', ...extra })
  Object.assign(S, {
    uid: 'eu', nome: 'Gustavo Vigatti', tela: location.search.includes('painel') ? 'painel' : 'barra',
    nomes: { ana: 'Ana Paula', leo: 'Leonardo' },
    tarefas: [
      t('1', 'Arte do feriado de novembro pro feed', 'inbox', d(2), 'alta', { created_by: 'ana' }),
      t('2', 'Reel da Semana das Crianças', 'doing', d(0), 'alta', { due_time: '16:00' }),
      t('3', 'Revisar cardápio A3 do restaurante', 'todo', d(-2), 'media'),
      t('4', 'Fotos novas da Casa de Campo', 'todo', d(0), null),
      t('5', 'Carrossel MeuDestino Santorini', 'review', d(1), 'media'),
      t('6', 'Busdoor de dezembro', 'todo', d(5), 'baixa', { owner_id: 'leo' }),
      t('7', 'Organizar pasta de vetores', 'todo', null, null),
    ],
  })
  desenhar()
}
sb.auth.onAuthStateChange((ev, s) => {
  if (ev === 'SIGNED_IN' && s && s.user.id !== S.uid) comecar(s.user.id)
  if (ev === 'SIGNED_OUT' && S.uid) { S.uid = ''; S.tela = 'login'; desenhar() }
})
