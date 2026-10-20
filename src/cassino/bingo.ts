// Salão de Bingo — espelho do SQL (202610161000_bingo). Quem sorteia, confere e paga é o servidor.
import type { CoffeeLine } from '../types'

export const CARTELA = 1
/** o que a casa põe no pote de toda rodada */
export const CASA = 10
export const MAX_CARTELAS = 4
export const SLOT = 900e3
/** a bola k (1..75) aparece em início + ATRASO + (k-1)·PASSO */
export const ATRASO = 5e3
export const PASSO = 3e3
export const LINHA_PCT = 0.3
/** itens que só saem pra quem faz cartela cheia (ordem = ordem do SQL) */
export const RAROS_BINGO = ['roupa:paete', 'roupa:smoking', 'chapeu:cantor', 'rosto:oculos-estrela', 'animacao:confete', 'animacao:bolinhas']
export const LETRAS = 'BINGO'

export interface Cartela { id: number; numeros: number[]; gratis: boolean }
export interface BingoVenc { u: string; n: number; premio: number }
export type BingoFase = 'aberta' | 'jogando' | 'paga' | 'cancelada'
export interface BingoRodada {
  inicio: string; estado: BingoFase; pote: number; cartelas: number; jogadores: number
  /** só as bolas que já apareceram */
  bolas: number[]
  linha?: BingoVenc[] | null; linha_idx?: number | null
  cheia?: BingoVenc[] | null; cheia_idx?: number | null
  itens?: Record<string, string>
  gente?: { u: string; n: number }[]
  minhas: Cartela[]
}
export interface BingoHist { inicio: string; pote: number; jogadores: number; cartelas: number; linha: BingoVenc[]; cheia: BingoVenc[]; itens: Record<string, string>; bolas: number }
export interface Bingo { agora: number; slot?: number; atual: BingoRodada; proxima: BingoRodada; gratis: boolean; latinhas: number; historico: BingoHist[] }

export const letraDe = (n: number) => LETRAS[Math.floor((n - 1) / 15)]
/** as 12 linhas da cartela (índices coluna a coluna: c*5+r) */
export const LINHAS: number[][] = [
  ...[0, 1, 2, 3, 4].map(r => [0, 1, 2, 3, 4].map(c => c * 5 + r)),
  ...[0, 1, 2, 3, 4].map(c => [0, 1, 2, 3, 4].map(r => c * 5 + r)),
  [0, 6, 12, 18, 24], [4, 8, 12, 16, 20],
]
/** quantas faltam pra fechar a melhor linha / a cartela */
export function faltam(nums: number[], saiu: Set<number>) {
  const ok = (i: number) => nums[i] === 0 || saiu.has(nums[i])
  return { linha: Math.min(...LINHAS.map(l => l.filter(i => !ok(i)).length)), cheia: nums.filter((_, i) => !ok(i)).length }
}
/** em que bola (1..) a cartela fecha linha e fica cheia */
export function marcas(nums: number[], bolas: number[]) {
  const pos = new Map(bolas.map((b, i) => [b, i + 1]))
  const at = (i: number) => (nums[i] ? pos.get(nums[i]) ?? 999 : 0)
  return { linha: Math.min(...LINHAS.map(l => Math.max(...l.map(at)))), cheia: Math.max(...nums.map((_, i) => at(i))) }
}
export function novaCartela(): number[] {
  const out: number[] = []
  for (let c = 0; c < 5; c++) {
    const col = Array.from({ length: 15 }, (_, i) => c * 15 + i + 1).sort(() => Math.random() - 0.5).slice(0, 5)
    if (c === 2) col[2] = 0
    out.push(...col)
  }
  return out
}
/** bolas que já deveriam ter aparecido em `agora` */
export const vistasEm = (inicio: number, agora: number) => Math.max(0, Math.floor((agora - inicio - ATRASO) / PASSO) + 1)

// ---------- motor da demo ----------
interface CartelaDemo extends Cartela { u: string; linha?: number; cheia?: number }
interface RodadaDemo { inicio: number; bolas: number[]; estado: BingoFase; cartelas: CartelaDemo[]; linha_idx?: number; cheia_idx?: number; linha_v?: BingoVenc[]; cheia_v?: BingoVenc[]; itens?: Record<string, string> }
interface Caixa {
  me: string; extrato: () => CoffeeLine[]; lanca: (amount: number, reason: CoffeeLine['reason'], ref: string) => void
  latinhas: () => number; lancaLatinha: (amount: number, ref: string) => void
  rodadas: () => RodadaDemo[]; salva: (r: RodadaDemo[]) => void
  /** outras pessoas da demo que jogam sempre */
  outros: () => string[]
  /** duração da rodada (a demo pode acelerar pra teste) */
  slot: number
}

export class BingoDemo {
  private cx: Caixa
  constructor(cx: Caixa) { this.cx = cx }
  private get slot() { return this.cx.slot }
  private proxima() { return (Math.floor(Date.now() / this.slot) + 1) * this.slot }
  private garante(rs: RodadaDemo[], inicio: number) {
    let r = rs.find(x => x.inicio === inicio)
    if (!r) {
      r = { inicio, bolas: Array.from({ length: 75 }, (_, i) => i + 1).sort(() => Math.random() - 0.5), estado: 'aberta', cartelas: [] }
      // o resto do time sempre joga com 1 ou 2 cartelas
      this.cx.outros().forEach((u, i) => {
        for (let k = 0; k < 1 + ((i + inicio / this.slot) % 2); k++) r!.cartelas.push({ id: Math.floor(Math.random() * 1e9), u, numeros: novaCartela(), gratis: false })
      })
      rs.unshift(r)
    }
    return r
  }
  private rodar(rs: RodadaDemo[]) {
    const now = Date.now()
    for (const r of rs) {
      if (r.estado === 'aberta' && r.inicio <= now) {
        const gente = new Set(r.cartelas.map(c => c.u))
        if (gente.size < 1) {
          r.cartelas.filter(c => c.u === this.cx.me && !c.gratis).forEach(c => this.cx.lanca(CARTELA, 'bingo', 'r:' + c.id))
          r.estado = 'cancelada'
          continue
        }
        for (const c of r.cartelas) Object.assign(c, marcas(c.numeros, r.bolas))
        r.linha_idx = Math.min(...r.cartelas.map(c => c.linha!))
        r.cheia_idx = Math.min(...r.cartelas.map(c => c.cheia!))
        const pote = (r.cartelas.length * CARTELA + CASA), lp = Math.floor(pote * LINHA_PCT)
        const venc = (k: 'linha' | 'cheia', idx: number, pool: number) => {
          const cs = r.cartelas.filter(c => c[k] === idx), per = Math.floor(pool / cs.length)
          const by = new Map<string, number>()
          cs.forEach(c => by.set(c.u, (by.get(c.u) ?? 0) + 1))
          return [...by].map(([u, n]) => ({ u, n, premio: n * per }))
        }
        r.linha_v = venc('linha', r.linha_idx, lp)
        r.cheia_v = venc('cheia', r.cheia_idx, pote - lp)
        r.estado = 'jogando'
      }
      if (r.estado === 'jogando' && now >= r.inicio + 8e3 + (r.cheia_idx! - 1) * PASSO) {
        const ep = String(r.inicio / 1000)
        r.itens = {}
        for (const w of r.linha_v!) if (w.u === this.cx.me) this.cx.lanca(w.premio, 'bingo', 'l:' + ep)
        for (const w of r.cheia_v!) {
          const dono = (i: string) => w.u === this.cx.me && this.cx.extrato().some(l => l.reason === 'compra' && l.ref === i)
          const livres = RAROS_BINGO.filter(i => !dono(i))
          const it = livres[Math.floor(Math.random() * livres.length)]
          if (it) r.itens[w.u] = it
          if (w.u !== this.cx.me) continue
          this.cx.lanca(w.premio, 'bingo', 'k:' + ep)
          this.cx.lancaLatinha(1, 'bingo:k:' + ep)
          if (it) this.cx.lanca(0, 'compra', it)
        }
        r.estado = 'paga'
      }
    }
  }
  private json(r: RodadaDemo | undefined, inicio: number, now: number): BingoRodada {
    if (!r) return { inicio: new Date(inicio).toISOString(), estado: 'aberta', pote: 0, cartelas: 0, jogadores: 0, bolas: [], minhas: [], gente: [] }
    const n = r.estado === 'jogando' || r.estado === 'paga' ? Math.min(r.cheia_idx!, vistasEm(r.inicio, now)) : 0
    const by = new Map<string, number>()
    r.cartelas.forEach(c => by.set(c.u, (by.get(c.u) ?? 0) + 1))
    const viu = (i?: number) => i !== undefined && n >= i
    return {
      inicio: new Date(r.inicio).toISOString(), estado: r.estado, pote: r.estado === 'cancelada' ? 0 : (r.cartelas.length * CARTELA + CASA),
      cartelas: r.cartelas.length, jogadores: by.size, bolas: r.bolas.slice(0, n),
      linha: viu(r.linha_idx) ? r.linha_v : null, linha_idx: viu(r.linha_idx) ? r.linha_idx : null,
      cheia: viu(r.cheia_idx) ? r.cheia_v : null, cheia_idx: viu(r.cheia_idx) ? r.cheia_idx : null,
      itens: viu(r.cheia_idx) ? r.itens ?? {} : {},
      gente: [...by].map(([u, k]) => ({ u, n: k })),
      minhas: r.cartelas.filter(c => c.u === this.cx.me).map(({ id, numeros, gratis }) => ({ id, numeros, gratis })),
    }
  }
  estado(): Bingo {
    const rs = this.cx.rodadas(), now = Date.now()
    const atual = Math.floor(now / this.slot) * this.slot
    this.garante(rs, this.proxima())
    this.rodar(rs)
    const keep = rs.filter(r => r.inicio >= now - 6 * 3600e3).slice(0, 40)
    this.cx.salva(keep)
    const hoje = new Date(now - 3 * 3600e3).toISOString().slice(0, 10)
    return {
      agora: now, slot: this.slot,
      atual: this.json(rs.find(r => r.inicio === atual), atual, now),
      proxima: this.json(rs.find(r => r.inicio === this.proxima()), this.proxima(), now),
      gratis: !this.cx.extrato().some(l => l.reason === 'bingo' && l.ref === 'g:' + hoje),
      latinhas: this.cx.latinhas(),
      historico: keep.filter(r => r.estado === 'paga').slice(0, 8).map(r => ({
        inicio: new Date(r.inicio).toISOString(), pote: (r.cartelas.length * CARTELA + CASA), jogadores: new Set(r.cartelas.map(c => c.u)).size, cartelas: r.cartelas.length,
        linha: r.linha_v ?? [], cheia: r.cheia_v ?? [], itens: r.itens ?? {}, bolas: r.cheia_idx ?? 0,
      })),
    }
  }
  comprar(gratis: boolean): Bingo {
    const rs = this.cx.rodadas(), r = this.garante(rs, this.proxima())
    if (r.cartelas.filter(c => c.u === this.cx.me).length >= MAX_CARTELAS) throw new Error(`Máximo de ${MAX_CARTELAS} cartelas por rodada.`)
    const id = Math.floor(Math.random() * 1e9)
    if (gratis) {
      const hoje = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10)
      if (this.cx.extrato().some(l => l.reason === 'bingo' && l.ref === 'g:' + hoje)) throw new Error('A cartela grátis de hoje já foi. Volta amanhã!')
      this.cx.lanca(0, 'bingo', 'g:' + hoje)
    } else {
      const bal = this.cx.extrato().reduce((s, l) => s + l.amount, 0)
      if (bal < CARTELA) throw new Error(`Falta ${CARTELA - bal} cafezinho para uma cartela.`)
      this.cx.lanca(-CARTELA, 'bingo', 'c:' + id)
    }
    r.cartelas.push({ id, u: this.cx.me, numeros: novaCartela(), gratis })
    this.cx.salva(rs)
    return this.estado()
  }
}
