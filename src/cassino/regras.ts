/** Cassino dos cafezinhos — espelho do SQL (202610142000_cassino.sql). No servidor quem sorteia e paga é o banco;
 *  aqui o motor só roda na demo e dá as tabelas de pagamento pra tela. */
export type JogoCassino = 'caca' | 'roleta' | 'crash' | 'blackjack' | 'minas'
export type TipoRoleta = 'vermelho' | 'preto' | 'par' | 'impar' | 'baixo' | 'alto' | 'duzia1' | 'duzia2' | 'duzia3' | 'numero'
export interface Escolha { tipo?: TipoRoleta; n?: number; alvo?: number; minas?: number }

/** o que o jogador vê da rodada (cassino_vista) */
export interface Rodada {
  id: string; jogo: JogoCassino; aposta: number; aberta: boolean; premio: number; saldo: number; retomada?: boolean
  resultado: { rolos?: number[]; mult?: number; n?: number; ponto?: number; alvo?: number; fim?: string; casa?: number }
  mao?: number[]; pontos?: number; dobrou?: boolean; banca?: number[]; banca_pontos?: number
  n?: number; abertas?: number[]; mult?: number; proximo?: number; minas?: number[] | null
}

export const MIN = 1
export const MAX = 100

// caça-níquel: cereja, café, limão, sino, estrela, diamante, sete (pesos em 32)
export const SIMBOLOS = ['🍒', '☕', '🍋', '🔔', '⭐', '💎', '7️⃣']
export const PESOS = [9, 7, 6, 4, 3, 2, 1]
export const TRES = [4, 6, 10, 15, 25, 50, 100]
export const DOIS = [1, 1.5, 1.5, 2, 3, 4, 8]

export const VERMELHOS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]
/** ordem dos números na roda europeia */
export const RODA = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26]
export const corDe = (n: number) => n === 0 ? 'verde' : VERMELHOS.includes(n) ? 'vermelho' : 'preto'

export function multCaca(r: number[]) {
  if (r[0] === r[1] && r[1] === r[2]) return TRES[r[0]]
  if (r[0] === r[1] || r[0] === r[2]) return DOIS[r[0]]
  if (r[1] === r[2]) return DOIS[r[1]]
  return 0
}

export function multRoleta(tipo: TipoRoleta, num: number | undefined, n: number) {
  if (tipo === 'numero') return num === n ? 36 : 0
  if (n === 0) return 0
  const ok = { vermelho: VERMELHOS.includes(n), preto: !VERMELHOS.includes(n), par: n % 2 === 0, impar: n % 2 === 1, baixo: n <= 18, alto: n >= 19,
    duzia1: n <= 12, duzia2: n >= 13 && n <= 24, duzia3: n >= 25 }[tipo]
  return ok ? (tipo.startsWith('duzia') ? 3 : 2) : 0
}

/** campo minado: multiplicador depois de k casas limpas com n minas (3% da casa) */
export function multMinas(n: number, k: number) {
  let m = 0.97
  if (k <= 0) return 1
  for (let i = 0; i < k; i++) m *= (25 - i) / (25 - n - i)
  return Math.round(m * 100) / 100
}

/** carta 0..51: valor = c % 13 (0 = A, 9..12 = 10 J Q K), naipe = c / 13 */
export function pontos(m: number[]) {
  let t = 0, ases = 0
  for (const c of m) { const v = c % 13; if (v === 0) { t += 11; ases++ } else t += v >= 9 ? 10 : v + 1 }
  while (t > 21 && ases > 0) { t -= 10; ases-- }
  return t
}
export const FACE = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
export const NAIPE = ['♠', '♥', '♦', '♣']

// ---------- motor da demo ----------
interface Interna {
  id: string; jogo: JogoCassino; aposta: number; escolha: Escolha; aberta: boolean; premio: number; resultado: Rodada['resultado']
  baralho?: number[]; mao?: number[]; banca?: number[]; dobrou?: boolean; minas?: number[]; abertas: number[]
}
/** a carteira de quem joga: saldo e lançamento no extrato */
export interface Caixa { saldo(): number; lanca(amount: number, reason: 'aposta' | 'premio', ref: string): void }

const rnd = (n: number) => Math.floor(Math.random() * n)
const embaralha = <T,>(a: T[]) => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1);[a[i], a[j]] = [a[j], a[i]] } return a }

export class Mesa {
  private cx: Caixa; private rodadas: Interna[]; private salva: (r: Interna[]) => void
  constructor(cx: Caixa, rodadas: Interna[], salva: (r: Interna[]) => void) { this.cx = cx; this.rodadas = rodadas; this.salva = salva }

  private debita(valor: number, ref: string) {
    if (!Number.isInteger(valor) || valor < MIN || valor > MAX) throw new Error(`Aposte de ${MIN} a ${MAX} cafezinhos.`)
    const s = this.cx.saldo()
    if (s < valor) throw new Error(`Faltam ${valor - s} cafezinhos.`)
    this.cx.lanca(-valor, 'aposta', ref)
  }
  private fecha(r: Interna, valor: number, res: Rodada['resultado']) {
    r.aberta = false; r.premio = valor; r.resultado = { ...r.resultado, ...res }
    if (valor > 0) this.cx.lanca(valor, 'premio', r.id)
  }
  private vista(r: Interna): Rodada {
    const v: Rodada = { id: r.id, jogo: r.jogo, aposta: r.aposta, aberta: r.aberta, premio: r.premio, resultado: r.resultado, saldo: this.cx.saldo() }
    if (r.jogo === 'blackjack') {
      const b = r.aberta ? r.banca!.slice(0, 1) : r.banca!
      Object.assign(v, { mao: r.mao, pontos: pontos(r.mao!), dobrou: !!r.dobrou, banca: b, banca_pontos: pontos(b) })
    } else if (r.jogo === 'minas') {
      const n = r.minas!.length, k = r.abertas.length
      Object.assign(v, { n, abertas: r.abertas, mult: multMinas(n, k), proximo: multMinas(n, k + 1), minas: r.aberta ? null : r.minas })
    }
    return v
  }
  private nova(jogo: JogoCassino, aposta: number, escolha: Escolha): Interna {
    const r: Interna = { id: crypto.randomUUID(), jogo, aposta, escolha, aberta: true, premio: 0, resultado: {}, abertas: [] }
    this.debita(aposta, r.id)
    this.rodadas.unshift(r)
    this.rodadas.splice(200)
    return r
  }
  private banca(r: Interna) {
    const total = r.aposta * (r.dobrou ? 2 : 1), p = pontos(r.mao!)
    if (p > 21) return this.fecha(r, 0, { fim: 'estourou' })
    while (pontos(r.banca!) < 17) r.banca!.push(r.baralho!.shift()!)
    const b = pontos(r.banca!)
    if (b > 21 || p > b) this.fecha(r, total * 2, { fim: b > 21 ? 'banca_estourou' : 'ganhou' })
    else if (p === b) this.fecha(r, total, { fim: 'empate' })
    else this.fecha(r, 0, { fim: 'perdeu' })
  }

  jogar(jogo: JogoCassino, aposta: number, e: Escolha): Rodada {
    if (jogo === 'roleta' && (!e.tipo || (e.tipo === 'numero' && (e.n == null || e.n < 0 || e.n > 36)))) throw new Error('Escolha onde apostar na mesa.')
    const alvo = Math.round((e.alvo ?? 0) * 100) / 100
    if (jogo === 'crash' && (alvo < 1.01 || alvo > 100)) throw new Error('O alvo vai de 1,01x a 100x.')
    const r = this.nova(jogo, aposta, e)
    if (jogo === 'caca') {
      const rolos = [0, 1, 2].map(() => { let x = rnd(32); return PESOS.findIndex(p => (x -= p) < 0) })
      const mult = multCaca(rolos)
      this.fecha(r, Math.floor(aposta * mult), { rolos, mult })
    } else if (jogo === 'roleta') {
      const n = rnd(37), mult = multRoleta(e.tipo!, e.n, n)
      this.fecha(r, Math.floor(aposta * mult), { n, mult })
    } else {
      const ponto = Math.min(1000, Math.max(1, Math.floor(97 / (1 - Math.random())) / 100))
      const mult = alvo <= ponto ? alvo : 0
      this.fecha(r, Math.floor(aposta * mult), { ponto, alvo, mult })
    }
    this.salva(this.rodadas)
    return this.vista(r)
  }

  abrir(jogo: JogoCassino, aposta: number, e: Escolha): Rodada {
    const velha = this.rodadas.find(r => r.jogo === jogo && r.aberta)
    if (velha) return { ...this.vista(velha), retomada: true }
    if (jogo === 'minas' && (!e.minas || e.minas < 1 || e.minas > 24)) throw new Error('Escolha de 1 a 24 minas.')
    const r = this.nova(jogo, aposta, e)
    if (jogo === 'minas') r.minas = embaralha([...Array(25).keys()]).slice(0, e.minas)
    else {
      const d = embaralha([...Array(52).keys()])
      r.mao = [d[0], d[2]]; r.banca = [d[1], d[3]]; r.baralho = d.slice(4); r.dobrou = false
      const p = pontos(r.mao), b = pontos(r.banca)
      if (p === 21 && b === 21) this.fecha(r, aposta, { fim: 'empate' })
      else if (p === 21) this.fecha(r, Math.floor(aposta * 2.5), { fim: 'blackjack' })
      else if (b === 21) this.fecha(r, 0, { fim: 'banca_blackjack' })
    }
    this.salva(this.rodadas)
    return this.vista(r)
  }

  acao(id: string, acao: string, casa?: number): Rodada {
    const r = this.rodadas.find(x => x.id === id)
    if (!r) throw new Error('Rodada não encontrada.')
    if (!r.aberta) return this.vista(r)
    if (r.jogo === 'blackjack') {
      if (acao === 'dobrar') {
        if (r.mao!.length !== 2) throw new Error('Só dá pra dobrar com as 2 primeiras cartas.')
        this.debita(r.aposta, r.id + ':dobro')
        r.dobrou = true; r.mao!.push(r.baralho!.shift()!); this.banca(r)
      } else if (acao === 'pedir') {
        r.mao!.push(r.baralho!.shift()!)
        if (pontos(r.mao!) >= 21) this.banca(r)
      } else if (acao === 'parar') this.banca(r)
      else throw new Error('Jogada desconhecida.')
    } else {
      const n = r.minas!.length
      if (acao === 'abrir') {
        if (casa == null || casa < 0 || casa > 24) throw new Error('Casa inválida.')
        if (!r.abertas.includes(casa)) {
          r.abertas.push(casa)
          if (r.minas!.includes(casa)) this.fecha(r, 0, { fim: 'mina', casa })
          else if (r.abertas.length === 25 - n) this.fecha(r, Math.floor(r.aposta * multMinas(n, r.abertas.length)), { fim: 'limpou' })
        }
      } else if (acao === 'sacar') {
        if (!r.abertas.length) throw new Error('Abra pelo menos uma casa antes de sacar.')
        this.fecha(r, Math.floor(r.aposta * multMinas(n, r.abertas.length)), { fim: 'sacou' })
      } else throw new Error('Jogada desconhecida.')
    }
    this.salva(this.rodadas)
    return this.vista(r)
  }

  estado(jogo: JogoCassino): Rodada | null {
    const r = this.rodadas.find(x => x.jogo === jogo && x.aberta)
    return r ? this.vista(r) : null
  }
}
