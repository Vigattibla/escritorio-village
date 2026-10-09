import type { Ajuste, Profile, Quarto, Tier, Venda, VendasCfg } from '../types'
import { dayKey } from './xp'
import { deptOf, rankOf } from './ranks'
import { hasVendas, type State } from '../store'

export const hoje = () => dayKey(new Date())
/** soma n dias a um YYYY-MM-DD (meio-dia pra não tropeçar no horário de verão) */
export const addDia = (d: string, n: number) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n); return dayKey(x) }
export const noites = (a: string, b: string) => Math.round((new Date(b + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime()) / 864e5)
/** venda ocupa da noite da entrada até a noite antes da saída */
export const cobre = (v: Venda, d: string) => v.entrada <= d && d < v.saida
export const mesDe = (iso: string) => dayKey(iso).slice(0, 7)

/** quartos livres no dia: contagem manual (se houver) menos o que vendeu depois dela; senão total menos vendido */
export function livres(q: Quarto, dia: string, vendas: Venda[], aj?: Ajuste) {
  const vs = vendas.filter(v => v.quarto_id === q.id && cobre(v, dia) && (!aj || v.created_at > aj.created_at))
  return Math.max(0, (aj ? aj.livres : q.total) - vs.reduce((n, v) => n + v.qtd, 0))
}

export const CFG0: VendasCfg = { id: 'cfg', pts_venda: 10, pts_mil: 10, tiers: [], premios: [], pasta: null, created_at: '' }
export const pontos = (v: Pick<Venda, 'valor'>, c: VendasCfg) => c.pts_venda + Math.round(v.valor / 1000 * c.pts_mil)
const porMin = (t: Tier[]) => [...t].sort((a, b) => a.min - b.min)
export const tierOf = (pts: number, t: Tier[]) => porMin(t).filter(x => x.min <= pts).pop() ?? null
export const proxTier = (pts: number, t: Tier[]) => porMin(t).find(x => x.min > pts) ?? null

export const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

/** igual ao banco: manda_vendas / ve_vendas / edita_campanha — só o setor de vendas (e o admin) */
export const vende = (p: Profile | undefined, s: State) => !!p && hasVendas(deptOf(p), s)
export const manda = (p: Profile | undefined, s: State) => !!p && (!!p.is_admin || (vende(p, s) && rankOf(p) >= 3))
export const ve = (p: Profile | undefined, s: State) => !!p && (!!p.is_admin || vende(p, s))
export const editaCampanha = manda

export interface Placar { id: string; pts: number; valor: number; n: number }
export function placar(vendas: Venda[], mes: string, c: VendasCfg) {
  const by: Record<string, Placar> = {}
  for (const v of vendas) {
    if (mesDe(v.created_at) !== mes) continue
    const r = by[v.user_id] ??= { id: v.user_id, pts: 0, valor: 0, n: 0 }
    r.pts += pontos(v, c); r.valor += Number(v.valor); r.n++
  }
  return by
}
