// Bolão do cassino e latinhas ⚡ — espelho do SQL (202610150900_latinhas_bolao). Quem sorteia e paga é o servidor.
import type { CoffeeLine } from '../types'
import { RAROS_BOLAO } from '../shop/catalog'

export const SEMENTE = 30
export const BILHETE = 1
export const MAX_BILHETES = 5
export const LATINHA = 150
export const MAX_TROCAS = 2
export const latinhasDoPremio = (pote: number) => Math.min(10, 3 + Math.floor(pote / 50))
/** o primeiro bolão fecha na sexta 16/10/2026 */
export const ESTREIA = Date.parse('2026-10-16T20:00:00Z')

export interface Sorteio {
  fim: string; pote: number; bilhetes: number; vencedor: string | null; latinhas: number; item: string | null
  roleta: { u: string; n: number }[]; sorteado_em: string
}
export interface Bolao {
  fim: string; pote: number; bilhetes: number; gente: number; gratis: number; comprados: number; latinhas: number
  historico: Sorteio[]
}

/** próxima sexta 17h de Brasília (UTC−3, sem horário de verão) depois de ts */
export function fimDa(ts: number) {
  const SP = 3 * 3600e3, local = new Date(ts - SP)
  const dow = (local.getUTCDay() + 6) % 7 // seg = 0
  const seg = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - dow * 864e5
  let sexta = seg + 4 * 864e5 + 17 * 3600e3
  if (local.getTime() >= sexta) sexta += 7 * 864e5
  return sexta + SP
}

/** quantos bilhetes cada linha do extrato vale */
export const valeBilhete = (l: CoffeeLine) => l.reason === 'fase' || l.reason === 'bilhete' ? 1 : l.reason === 'meta' ? 2 : 0
const dentro = (l: CoffeeLine, fim: number) => { const t = Date.parse(l.created_at); return t >= fim - 7 * 864e5 && t < fim }

// ---------- motor da demo ----------
interface Caixa {
  me: string; extrato: () => CoffeeLine[]; lanca: (amount: number, reason: CoffeeLine['reason'], ref: string) => void
  latinhas: () => number; lancaLatinha: (amount: number, ref: string) => void
  sorteios: () => Sorteio[]; salva: (s: Sorteio[]) => void
  /** outras pessoas da demo e quantos bilhetes elas teriam */
  outros: () => { u: string; n: number }[]
}

export class BolaoDemo {
  private cx: Caixa
  constructor(cx: Caixa) { this.cx = cx }

  private pote(fim: number) {
    const log = this.cx.extrato().filter(l => dentro(l, fim))
    const casa = -log.filter(l => l.reason === 'aposta' || l.reason === 'premio').reduce((n, l) => n + l.amount, 0)
    const acum = this.cx.sorteios().find(s => Date.parse(s.fim) === fim - 7 * 864e5 && !s.vencedor)?.pote ?? 0
    return SEMENTE + Math.max(0, casa) - log.filter(l => l.reason === 'bilhete').reduce((n, l) => n + l.amount, 0) + acum
  }
  private meus(fim: number) {
    const log = this.cx.extrato().filter(l => dentro(l, fim))
    return { gratis: log.filter(l => l.reason !== 'bilhete').reduce((n, l) => n + valeBilhete(l), 0), comprados: log.filter(l => l.reason === 'bilhete').length }
  }
  private roleta(fim: number) {
    const m = this.meus(fim), eu = m.gratis + m.comprados
    return [...(eu ? [{ u: this.cx.me, n: eu }] : []), ...this.cx.outros()]
  }
  private sortear() {
    const fim = fimDa(Date.now()) - 7 * 864e5
    const hist = this.cx.sorteios()
    if (fim < ESTREIA || hist.some(s => Date.parse(s.fim) === fim)) return
    const pote = this.pote(fim), rol = this.roleta(fim).sort(() => Math.random() - 0.5), total = rol.reduce((n, x) => n + x.n, 0)
    let vencedor: string | null = null, item: string | null = null, lat = 0
    if (total) {
      let alvo = Math.floor(Math.random() * total)
      vencedor = rol.find(x => (alvo -= x.n) < 0)!.u
      lat = latinhasDoPremio(pote)
      if (vencedor === this.cx.me) {
        const ref = new Date(fim).toISOString().slice(0, 10)
        this.cx.lanca(pote, 'bolao', ref); this.cx.lancaLatinha(lat, 'bolao:' + ref)
        item = RAROS_BOLAO.find(i => !this.cx.extrato().some(l => l.reason === 'compra' && l.ref === i)) ?? null
        if (item) this.cx.lanca(0, 'compra', item)
      }
    }
    this.cx.salva([{ fim: new Date(fim).toISOString(), pote, bilhetes: total, vencedor, latinhas: lat, item, roleta: rol, sorteado_em: new Date().toISOString() }, ...hist].slice(0, 30))
  }
  estado(): Bolao {
    this.sortear()
    const fim = fimDa(Date.now()), m = this.meus(fim), rol = this.roleta(fim)
    return {
      fim: new Date(fim).toISOString(), pote: this.pote(fim), bilhetes: rol.reduce((n, x) => n + x.n, 0), gente: rol.length,
      ...m, latinhas: this.cx.latinhas(), historico: this.cx.sorteios().slice(0, 10),
    }
  }
  comprar(): Bolao {
    const fim = fimDa(Date.now()), n = this.meus(fim).comprados
    if (n >= MAX_BILHETES) throw new Error(`Limite de ${MAX_BILHETES} bilhetes comprados por semana. Bater meta dá bilhete grátis!`)
    const bal = this.cx.extrato().reduce((s, l) => s + l.amount, 0)
    if (bal < BILHETE) throw new Error(`Falta ${BILHETE - bal} cafezinho para um bilhete.`)
    this.cx.lanca(-BILHETE, 'bilhete', `${new Date(fim).toISOString().slice(0, 10)}:${n + 1}`)
    return this.estado()
  }
  trocar(): number {
    const fim = fimDa(Date.now())
    const n = this.cx.extrato().filter(l => l.reason === 'troca' && dentro(l, fim)).length
    if (n >= MAX_TROCAS) throw new Error(`Já trocou ${MAX_TROCAS} latinhas nesta semana. Volta na sexta depois das 17h.`)
    const bal = this.cx.extrato().reduce((s, l) => s + l.amount, 0)
    if (bal < LATINHA) throw new Error(`Faltam ${LATINHA - bal} cafezinhos para uma latinha.`)
    const ref = `${new Date(fim).toISOString().slice(0, 10)}:${n + 1}`
    this.cx.lanca(-LATINHA, 'troca', ref); this.cx.lancaLatinha(1, 'troca:' + ref)
    return this.cx.latinhas()
  }
}
