export type CorCarta = 'vermelho' | 'amarelo' | 'verde' | 'azul'
export type ValorCarta = number | '+2' | 'pular' | 'inverter' | 'coringa' | '+4'
export interface Carta { id: number; cor: CorCarta | null; valor: ValorCarta }
export interface MesaCartas { maos: [Carta[], Carta[]]; monte: Carta[]; descarte: Carta[]; cor: CorCarta; vez: 0 | 1; vencedor: 0 | 1 | null; aviso: string }
export const CORES: CorCarta[] = ['vermelho', 'amarelo', 'verde', 'azul']
const shuffle = <T,>(xs: T[], random = Math.random) => { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a }
export function novaMesa(random = Math.random): MesaCartas {
  let id = 0; const deck: Carta[] = []
  for (const cor of CORES) {
    deck.push({ id: id++, cor, valor: 0 })
    for (let n = 0; n < 2; n++) for (const valor of [1, 2, 3, 4, 5, 6, 7, 8, 9, '+2', 'pular', 'inverter'] as ValorCarta[]) deck.push({ id: id++, cor, valor })
  }
  for (let n = 0; n < 4; n++) for (const valor of ['coringa', '+4'] as const) deck.push({ id: id++, cor: null, valor })
  const monte = shuffle(deck, random), a = monte.splice(0, 7), b = monte.splice(0, 7)
  const first = monte.splice(monte.findIndex(c => typeof c.valor === 'number'), 1)[0]
  return { maos: [a, b], monte, descarte: [first], cor: first.cor!, vez: 0, vencedor: null, aviso: 'Sua vez. Comprar uma carta passa a vez.' }
}
const copy = (s: MesaCartas): MesaCartas => ({ ...s, maos: [[...s.maos[0]], [...s.maos[1]]], monte: [...s.monte], descarte: [...s.descarte] })
export const podeJogar = (s: MesaCartas, c: Carta) => !c.cor || c.cor === s.cor || c.valor === s.descarte[s.descarte.length - 1].valor
export function melhorCor(mao: Carta[]): CorCarta { return [...CORES].sort((a, b) => mao.filter(c => c.cor === b).length - mao.filter(c => c.cor === a).length)[0] }
function compra(s: MesaCartas, player: 0 | 1, n: number) {
  for (let i = 0; i < n; i++) {
    if (!s.monte.length && s.descarte.length > 1) { const top = s.descarte.pop()!; s.monte = shuffle(s.descarte); s.descarte = [top] }
    const card = s.monte.pop(); if (card) s.maos[player].push(card)
  }
}
export function comprarCarta(state: MesaCartas): MesaCartas {
  if (state.vencedor !== null) return state
  const s = copy(state); compra(s, s.vez, 1); s.vez = s.vez === 0 ? 1 : 0; s.aviso = 'Comprou uma carta e passou a vez.'; return s
}
export function jogarCarta(state: MesaCartas, index: number, cor: CorCarta = 'vermelho'): MesaCartas {
  const card = state.maos[state.vez][index]
  if (state.vencedor !== null || !Number.isInteger(index) || !card || !podeJogar(state, card) || !CORES.includes(cor)) return state
  const s = copy(state), jogador = s.vez, outro = jogador === 0 ? 1 : 0
  s.maos[jogador].splice(index, 1); s.descarte.push(card); s.cor = card.cor ?? cor
  if (card.valor === '+2' || card.valor === '+4') compra(s, outro, card.valor === '+2' ? 2 : 4)
  const pula = ['+2', '+4', 'pular', 'inverter'].includes(String(card.valor))
  s.vez = pula ? jogador : outro
  s.aviso = pula ? 'O adversário perde a vez.' : 'Carta jogada.'
  if (!s.maos[jogador].length) { s.vencedor = jogador; s.aviso = jogador === 0 ? 'Você venceu!' : 'O computador venceu.' }
  else if (s.maos[jogador].length === 1) s.aviso = jogador === 0 ? 'Última carta!' : 'O computador está com uma carta!'
  return s
}
export function turnoComputador(s: MesaCartas): MesaCartas {
  if (s.vez !== 1 || s.vencedor !== null) return s
  const i = s.maos[1].findIndex(c => podeJogar(s, c))
  return i < 0 ? comprarCarta(s) : jogarCarta(s, i, melhorCor(s.maos[1]))
}
