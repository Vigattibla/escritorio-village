// Regras do plano que a Agenda e a aba Plano usam juntas: sigla → equipe → pessoa, dia da ação,
// dono automático (quem tem menos carga na semana) e a conversão em tarefa (uma vez só).
import { dayKey } from '../game/xp'
import { deptOf, rankOf } from '../game/ranks'
import { addTask, planoReservar, planoSoltar, putRow } from '../store'
import type { Equipe, PlanoAcao, PlanoMes, PlanoNucleo, PlanoResp, Profile, Task } from '../types'
import { nomeMes, parseDia } from './datas'

export const hoje = () => new Date().toISOString().slice(0, 7)
export const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
export const siglas = (resp: string) => resp.toUpperCase().split(/\s*(?:\/|,|\+|&|\bE\b)\s*/).map(x => x.trim()).filter(Boolean)

/** coluna/linha da ação: a sigla inteira se ela está na legenda; senão a primeira; '' = sem responsável */
export const chave = (a: PlanoAcao, resp: Record<string, PlanoResp>) => { const k = a.resp.trim().toUpperCase(); return resp[k] ? k : siglas(k)[0] ?? '' }
export const CORES = ['#2440FF', '#E8620C', '#1F9D55', '#C2189B', '#0E8FA8', '#7B4DFF', '#B88A00', '#D93A3F']
/** cor fixa por sigla (a primeira), igual em toda a tela */
export const corSig = (s: string) => { let h = 0; for (const c of siglas(s)[0] ?? s) h = (h * 31 + c.charCodeAt(0)) | 0; return s ? CORES[Math.abs(h) % CORES.length] : '#A39C8E' }

export const editaPlano = (p: Profile | undefined) => !!p && (!!p.is_admin || rankOf(p) === 4 || deptOf(p) === 'marketing')
/** marca quem é de cada equipe: gerente da sala, a Chefe ou o adm */
export const gereEquipe = (p: Profile | undefined, dept: string | null) => !!p && (!!p.is_admin || rankOf(p) === 4 || (rankOf(p) >= 3 && !!dept && deptOf(p) === dept))

export interface Ctx { resp: Record<string, PlanoResp>; profiles: Record<string, Profile>; meses: Record<string, PlanoMes>; nucleos: Record<string, PlanoNucleo>; equipes: Record<string, Equipe> }

export const respsDe = (a: PlanoAcao, resp: Record<string, PlanoResp>) => resp[a.resp.trim().toUpperCase()] ? [resp[a.resp.trim().toUpperCase()]] : siglas(a.resp).map(c => resp[c]).filter(Boolean)

/** quem recebe pela sigla: as pessoas dela e as das equipes ligadas a ela */
export const membros = (r: PlanoResp | undefined, equipes: Record<string, Equipe>, profiles: Record<string, Profile>) =>
  [...new Set([...(r?.pessoas ?? []), ...(r?.equipes ?? []).flatMap(e => equipes[e]?.pessoas ?? [])])].filter(id => profiles[id] && !profiles[id].cassino)
/** quem pode receber a ação: as pessoas da sigla e de todas as equipes ligadas a ela */
export function candidatos(a: PlanoAcao, resp: Record<string, PlanoResp>, profiles: Record<string, Profile>, equipes: Record<string, Equipe> = {}) {
  return [...new Set(respsDe(a, resp).flatMap(r => membros(r, equipes, profiles)))]
}

/** quem executa: o dono escolhido, as pessoas da ação; senão, a sigla (RESP.) ou alguém com esse nome; sala idem */
export function quem(a: PlanoAcao, resp: Record<string, PlanoResp>, profiles: Record<string, Profile>, equipes: Record<string, Equipe> = {}) {
  let pessoas = a.pessoas.filter(id => profiles[id] && !profiles[id].cassino)
  const rs = respsDe(a, resp)
  if (!pessoas.length) pessoas = candidatos(a, resp, profiles, equipes)
  if (!pessoas.length && a.resp && !rs.length) {
    const n = norm(a.resp.trim())
    pessoas = Object.values(profiles).filter(p => !p.cassino && n.length > 2 && norm(p.name).split(' ')[0] === n.split(' ')[0]).map(p => p.id).slice(0, 1)
  }
  if (a.dono && profiles[a.dono]) pessoas = [a.dono, ...pessoas.filter(id => id !== a.dono)]
  const dept = a.dept ?? rs.find(r => r.dept)?.dept ?? (pessoas[0] ? deptOf(profiles[pessoas[0]]) : null)
  return { pessoas, dept }
}

export type Sit = 'livre' | 'enviada' | 'fazendo' | 'feita'
export function situacao(a: PlanoAcao, tasks: Record<string, Task>): Sit {
  if (!a.tarefas.length) return 'livre'
  const ts = a.tarefas.map(id => tasks[id]).filter(Boolean)
  if (ts.length && ts.every(t => t.status === 'done')) return 'feita'
  if (ts.some(t => t.status === 'doing' || t.status === 'review')) return 'fazendo'
  return 'enviada'
}
export const SIT: Record<Sit, string> = { livre: 'Ainda não foi pro quadro', enviada: 'No quadro', fazendo: 'Em andamento', feita: 'Feita' }

const dt = (k: string) => new Date(k + 'T12:00:00')
export const somaDia = (k: string, n: number) => { const d = dt(k); d.setDate(d.getDate() + n); return dayKey(d) }
export const difDias = (a: string, b: string) => Math.round((dt(a).getTime() - dt(b).getTime()) / 864e5)
/** domingo da semana do dia */
export const semana = (k: string) => somaDia(k, -dt(k).getDay())

/** dia da ação na agenda: o que a equipe escolheu, senão o da planilha; semDia = "todo mês", "diário"… */
export function quando(a: PlanoAcao) {
  const p = parseDia(a.dia, a.mes)
  const semDia = p.start.endsWith('-01') && p.due.slice(0, 7) === a.mes && dt(p.due).getMonth() !== dt(somaDia(p.due, 1)).getMonth()
  const orig = semDia ? null : p.start
  const dia = a.data ?? orig
  const dur = semDia ? 0 : Math.max(0, difDias(p.due, p.start))
  return { dia, orig, movido: !!a.data && a.data !== orig, semDia: !dia, start: dia ?? p.start, due: dia ? somaDia(dia, dur) : p.due }
}

const aberta = (t: Task) => t.status !== 'done'
/**
 * dono de cada ação (só na tela, nada é gravado): já virou tarefa → dono da tarefa; escolhido → ele;
 * senão quem da equipe tem menos coisa na semana (tarefas abertas + ações já distribuídas).
 */
export function distribuir(acoes: PlanoAcao[], ctx: Ctx, tasks: Record<string, Task>) {
  const carga = new Map<string, number>()
  const soma = (id: string, sem: string) => carga.set(id + '|' + sem, (carga.get(id + '|' + sem) ?? 0) + 1)
  for (const t of Object.values(tasks)) if (aberta(t) && t.due) soma(t.owner_id, semana(t.due))
  const dono: Record<string, string | null> = {}
  const ordem = acoes.filter(a => ctx.nucleos[a.nucleo]?.tipo !== 'datas').map(a => ({ a, q: quando(a) }))
    .sort((x, y) => (x.q.dia ?? '9').localeCompare(y.q.dia ?? '9') || x.a.id.localeCompare(y.a.id))
  for (const { a, q } of ordem) {
    const t = a.tarefas.map(id => tasks[id]).find(Boolean)
    if (t) { dono[a.id] = t.owner_id; continue }
    if (a.dono && ctx.profiles[a.dono]) dono[a.id] = a.dono
    else if (a.pessoas.some(id => ctx.profiles[id])) dono[a.id] = a.pessoas.find(id => ctx.profiles[id])!
    else {
      const cs = candidatos(a, ctx.resp, ctx.profiles, ctx.equipes)
      const sem = q.dia ? semana(q.dia) : ''
      const c = cs.length ? cs.reduce((m, id) => (carga.get(id + '|' + sem) ?? 0) < (carga.get(m + '|' + sem) ?? 0) ? id : m, cs[0]) : null
      dono[a.id] = c ?? quem(a, ctx.resp, ctx.profiles, ctx.equipes).pessoas[0] ?? null
    }
    if (dono[a.id] && q.dia) soma(dono[a.id]!, semana(q.dia))
  }
  return dono
}
/** quantas coisas a pessoa tem na semana (tarefas abertas + ações do plano ainda soltas) */
export function cargaSemana(id: string, sem: string, tasks: Record<string, Task>, itens: { dono: string | null; dia: string | null; livre: boolean }[]) {
  const ate = somaDia(sem, 7)
  return Object.values(tasks).filter(t => t.owner_id === id && aberta(t) && t.due && t.due >= sem && t.due < ate).length
    + itens.filter(i => i.livre && i.dono === id && i.dia && i.dia >= sem && i.dia < ate).length
}

function corpo(a: PlanoAcao, ctx: Ctx) {
  const m = ctx.meses[`${a.ciclo}:${a.mes}`], n = ctx.nucleos[a.nucleo]
  const title = a.texto.length > 200 ? a.texto.slice(0, 197).trimEnd() + '…' : a.texto
  const notes = [
    `Plano de marketing · ${nomeMes(a.mes)}${m?.campanha ? ' · ' + m.campanha : ''}`,
    n ? `Núcleo: ${n.nome}` : '',
    a.texto.length > 200 ? a.texto : '',
    a.estrategia ? `Estratégia: ${a.estrategia}` : '',
    m?.estrategia ? `Estratégia do mês: ${m.estrategia}` : '',
  ].filter(Boolean).join('\n\n')
  const { start, due } = quando(a)
  return { title, notes, start: start < due ? start : null, due }
}

/** (aba Plano, quem edita) cria a tarefa no quadro de quem executa e guarda o vínculo na ação */
export async function mandar(a: PlanoAcao, ctx: Ctx) {
  const { pessoas } = quem(a, ctx.resp, ctx.profiles, ctx.equipes)
  if (!pessoas.length) throw new Error(`Escolha quem faz “${a.texto.slice(0, 40)}”.`)
  const c = corpo(a, ctx)
  const t = await addTask(pessoas[0], c.title, c.due, c.notes, 'todo', null, { start: c.start, collaborators: pessoas.slice(1) })
  await putRow('plano_acoes', { ...a, tarefas: [...a.tarefas, t.id] })
}

/** (Agenda, quem é da equipe) vira tarefa uma vez só: reserva o vínculo antes; false = alguém já começou */
export async function comecar(a: PlanoAcao, ctx: Ctx, dono: string) {
  const tid = crypto.randomUUID()
  if (!(await planoReservar(a.id, tid))) return false
  const c = corpo(a, ctx)
  try { await addTask(dono, c.title, c.due, c.notes, 'todo', null, { id: tid, start: c.start }) } catch (e) { await planoSoltar(a.id, tid).catch(() => undefined); throw e }
  return true
}
