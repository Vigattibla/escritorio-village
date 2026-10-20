export type JogoClassico = 'cobrinha' | 'penalti' | 'memoria' | 'reflexo'
export type Jogo = JogoClassico | 'sinuca' | 'cartas'
export interface JogoProps { partida: string; onPts: (n: number) => void; onFim: (n: number) => void; onErro: (msg: string) => void }
export const treinoDe = (j: Jogo) => j === 'sinuca' || j === 'cartas'
export const JOGOS: { id: Jogo; nome: string; onde: string; dica: string }[] = [
  { id: 'sinuca', nome: 'Sinuca 8-ball', onde: 'Mesa de sinuca', dica: 'Duas pessoas no mesmo aparelho. Encaçape seu grupo e deixe a bola 8 por último.' },
  { id: 'cartas', nome: 'Cartas', onde: 'Mesa de cartas', dica: 'Estilo UNO, contra o computador. Combine cor ou valor; vence quem zerar a mão.' },
  { id: 'cobrinha', nome: 'Cobrinha', onde: 'Fliperama', dica: 'Setas, WASD ou arraste. Pegue o café e não bata.' },
  { id: 'penalti', nome: 'Pênalti', onde: 'Pebolim', dica: 'Espaço ou clique pra chutar. Mire longe do goleiro: 10 cobranças.' },
  { id: 'memoria', nome: 'Memória', onde: 'Mesa de jogos', dica: 'Ache os 8 pares. Menos erros e menos tempo valem mais.' },
  { id: 'reflexo', nome: 'Reflexo', onde: 'Videogame', dica: 'Clique nos alvos por 30 segundos. Clique no vazio tira ponto.' },
]

/** Só resultados dos jogos validados pelo servidor entram no ranking mensal. */
export function rankingJogos(rows: { user_id: string; jogo: string; mes: string; dept: string; pontos: number }[], mes: string, dept: string, jogo?: Jogo) {
  const best = new Map<string, Map<string, number>>()
  for (const r of rows) {
    if (r.mes !== mes || r.dept !== dept || (jogo && r.jogo !== jogo) || !['cobrinha', 'penalti', 'memoria', 'reflexo'].includes(r.jogo) || !Number.isFinite(r.pontos) || r.pontos <= 0) continue
    const games = best.get(r.user_id) ?? new Map<string, number>()
    games.set(r.jogo, Math.max(games.get(r.jogo) ?? 0, r.pontos)); best.set(r.user_id, games)
  }
  return [...best].map(([id, games]) => [id, [...games.values()].reduce((a, b) => a + b, 0)] as [string, number]).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
}
