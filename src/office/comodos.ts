import { BOSS_DESK } from './base'
import type { Obj, Piso, Sala } from './sala'
import type { Dir } from '../types'
import type { Prop } from './vida'

/** o que cada sala do andar é: o setor, a sala do gerente, os cômodos de uso comum e a sala ainda vazia */
export type Kind = 'dept' | 'gerente' | 'reuniao' | 'cozinha' | 'jogos' | 'bingo' | 'banheiro' | 'vaga'
/** cômodo que é de todo mundo do andar (sempre aberto) */
export const COMUM = new Set<Kind>(['cozinha', 'jogos', 'bingo', 'banheiro'])

/** lugar onde o boneco fica fazendo alguma coisa quando a pessoa está fora do app (tile da sala) */
export interface Spot {
  x: number; y: number; dir: Dir
  /** o que aparece no balão */
  act: string
  /** quanto tempo fica (ms, mín e máx) */
  ms: [number, number]
  /** some de vista enquanto está lá (cabine do banheiro) */
  some?: boolean
  /** objeto na mão enquanto está lá */
  prop?: Prop
  /** objeto que continua na mão depois de sair (caneca de café indo pra mesa) */
  leva?: Prop
  /** emoji no balão (☕, 💧) */
  icon?: string
  /** pula de susto ao chegar */
  susto?: boolean
}

export interface Comodo { nome: string; cor: string; top: boolean; sala: () => Sala; spots: Spot[] }

/** cômodo w x h tiles (cada um no tamanho que faz sentido; o andar se ajusta) */
function monta(piso: Piso, w: number, h: number, itens: [string, number, number, number?][]): Sala {
  const objs: Obj[] = itens.map(([k, x, y, d], i) => (d === undefined ? { id: i + 1, k, x, y } : { id: i + 1, k, x, y, d }))
  return {
    piso: Array.from({ length: h }, () => Array.from({ length: w }, () => piso)),
    div: Array.from({ length: h }, () => Array<boolean>(w).fill(false)),
    objs,
  }
}

const S = (x: number, y: number, dir: Dir, act: string, a: number, b: number, some?: boolean, extra?: Partial<Spot>): Spot => ({ x, y, dir, act, ms: [a * 1000, b * 1000], ...(some ? { some } : {}), ...extra })

/** onde fica o desentupidor, no banheiro (ponto de passagem da cena do vaso entupido; não é sorteado) */
export const DESENTUPIDOR: Spot = S(12, 3, 'up', 'Cadê o desentupidor?', 2, 3, false, { leva: 'desentupidor' })

/** Pra crescer o andar no futuro: novo tipo aqui + móveis em sala.ts + entrar na ordem do andar (Game.tsx). */
export const COMODOS: Record<Exclude<Kind, 'dept' | 'vaga'>, Comodo> = {
  cozinha: {
    nome: 'Cozinha', cor: '#e0893e', top: true,
    sala: () => monta('ceramica', 22, 16, [
      ['geladeira', 1, 2], ['fogao', 3, 2], ['pia-cozinha', 4, 2], ['micro-ondas', 6, 2], ['balcao', 7, 2],
      ['espresso', 14, 2], ['vitrine-doces', 15, 2], ['bebedouro', 20, 2],
      ['relogio', 2, 0], ['menu-giz', 10, 0], ['janela', 12, 0], ['janela', 17, 0], ['cartaz', 19, 0],
      ['mesa-jantar', 3, 7], ['mesa-jantar', 13, 7],
      ['bistro', 2, 11], ['bistro', 17, 11],
      ['planta', 1, 14], ['planta', 20, 14],
    ]),
    spots: [
      S(14, 3, 'up', 'Tomando um café', 20, 60, false, { prop: 'caneca', icon: '☕' }), S(15, 3, 'up', 'Escolhendo um doce', 15, 40),
      S(1, 3, 'up', 'Pegando um lanche', 10, 30), S(3, 3, 'up', 'Esquentando o almoço', 30, 90),
      S(6, 3, 'up', 'Esquentando a marmita', 30, 80), S(20, 3, 'up', 'Bebendo água', 8, 20, false, { prop: 'copo', icon: '💧' }),
      S(4, 3, 'up', 'Lavando a louça', 20, 50, false, { prop: 'louca', icon: '🍽️' }), S(5, 3, 'up', 'Lavando a caneca', 10, 25, false, { prop: 'lavaCaneca', icon: '🧼' }),
      S(4, 6, 'down', 'Almoçando', 60, 180), S(5, 9, 'up', 'Almoçando', 60, 180),
      S(14, 6, 'down', 'Lanchando', 40, 120), S(15, 9, 'up', 'Conversando', 40, 120),
      S(2, 10, 'down', 'Café rapidinho', 20, 60, false, { prop: 'caneca', icon: '☕' }), S(17, 10, 'down', 'Café rapidinho', 20, 60, false, { prop: 'caneca', icon: '☕' }),
    ],
  },
  banheiro: {
    nome: 'Banheiro', cor: '#5fb3c9', top: true,
    sala: () => monta('azulejo', 14, 12, [
      ['cabine', 1, 2], ['cabine', 3, 2], ['cabine', 5, 2],
      ['pia-banheiro', 8, 2], ['pia-banheiro', 10, 2], ['lixeira', 12, 2], ['toalheiro', 12, 0],
      ['planta', 1, 10], ['planta', 12, 10],
    ]),
    spots: [
      S(2, 4, 'up', 'Ocupado', 25, 70, true), S(4, 4, 'up', 'Ocupado', 25, 70, true), S(6, 4, 'up', 'Ocupado', 25, 70, true),
      S(8, 3, 'up', 'Lavando as mãos', 8, 20), S(10, 3, 'up', 'Arrumando o cabelo', 10, 25), S(11, 3, 'up', 'Lavando as mãos', 8, 20),
    ],
  },
  jogos: {
    nome: 'Sala de jogos', cor: '#8e5bd6', top: false,
    // esquerda: videogame, pebolim, sinuca, tabuleiro e fliperamas; direita: o cassino; meio livre pra porta
    sala: () => monta('carpete', 28, 16, [
      // parede de vidro: nada de móvel alto embaixo da decoração; porta fica no meio (13-14)
      ['tv-grande', 2, 0], ['neon', 6, 0], ['alvo-dardos', 11, 0], ['letreiro-cassino', 18, 0],
      ['tapete-gamer', 1, 3], ['console', 2, 2], ['pufe', 1, 4], ['pufe', 4, 4], ['sofa', 1, 6],
      ['estante', 8, 2], ['pebolim', 8, 5],
      ['sinuca', 3, 9], ['mesa-jantar', 8, 10], ['cadeira-reuniao', 8, 12], ['cadeira-reuniao', 11, 12],
      ['fliperama', 2, 13], ['fliperama', 3, 13], ['fliperama', 4, 13], ['fliperama', 5, 13],
      ['vitrine-doces', 9, 14], ['espresso', 11, 14], ['bistro', 13, 13],
      ['tapete-cassino', 17, 5],
      ['caca-niquel', 23, 2], ['caca-niquel', 24, 2], ['caca-niquel', 25, 2], ['caca-niquel', 26, 2],
      ['mesa-roleta', 19, 6], ['mesa-cartas', 19, 10], ['totem-crash', 26, 6], ['totem-minas', 26, 9],
      ['caixa-fichas', 22, 13], ['maquina-refri', 26, 13],
      ['planta', 1, 11], ['planta', 16, 14],
    ]),
    spots: [
      S(2, 4, 'up', 'No videogame', 60, 200), S(3, 4, 'up', 'No videogame', 60, 200),
      S(9, 3, 'up', 'Escolhendo um jogo', 15, 40),
      S(9, 4, 'down', 'No pebolim', 40, 120), S(9, 6, 'up', 'No pebolim', 40, 120),
      S(2, 9, 'right', 'Jogando sinuca', 60, 180), S(7, 10, 'left', 'Jogando sinuca', 60, 180),
      S(9, 9, 'down', 'Jogo de tabuleiro', 60, 180), S(10, 12, 'up', 'Jogo de tabuleiro', 60, 180),
      S(2, 14, 'up', 'No fliperama', 30, 90), S(4, 14, 'up', 'No fliperama', 30, 90), S(5, 14, 'up', 'No fliperama', 30, 90),
      S(23, 3, 'up', 'No caça-níquel', 30, 90), S(25, 3, 'up', 'No caça-níquel', 30, 90),
      S(18, 6, 'right', 'Na roleta', 40, 120), S(23, 7, 'left', 'Na roleta', 40, 120), S(21, 8, 'up', 'Na roleta', 40, 120),
      S(19, 12, 'up', 'No blackjack', 40, 120), S(21, 12, 'up', 'No blackjack', 40, 120),
      S(12, 14, 'left', 'Pegando um café', 10, 30, false, { prop: 'caneca', icon: '☕' }), S(14, 14, 'up', 'Lanchando', 30, 90),
      S(26, 7, 'up', 'No crash', 20, 60), S(26, 10, 'up', 'Nas minas', 20, 60),
    ],
  },
  bingo: {
    nome: 'Salão de Bingo', cor: '#d6457f', top: false,
    // palco com o globo no fundo, mesas dos dois lados; corredor do meio livre pra porta (7-8)
    sala: () => monta('carpete', 16, 16, [
      ['letreiro-bingo', 9, 0], ['painel-bingo', 13, 0],
      ['tapete-bingo', 2, 4], ['palco-bingo', 5, 11],
      ['mesa-bingo', 2, 5], ['cadeira-reuniao', 2, 6], ['cadeira-reuniao', 4, 6],
      ['mesa-bingo', 11, 5], ['cadeira-reuniao', 11, 6], ['cadeira-reuniao', 13, 6],
      ['mesa-bingo', 2, 8], ['cadeira-reuniao', 2, 9], ['cadeira-reuniao', 4, 9],
      ['mesa-bingo', 11, 8], ['cadeira-reuniao', 11, 9], ['cadeira-reuniao', 13, 9],
      ['globo-bingo', 7, 12], ['banca-cartelas', 1, 13], ['maquina-refri', 14, 13],
      ['planta', 1, 11], ['planta', 14, 11],
    ]),
    spots: [
      S(2, 6, 'up', 'Jogando bingo', 60, 200), S(4, 6, 'up', 'Jogando bingo', 60, 200),
      S(11, 6, 'up', 'Jogando bingo', 60, 200), S(13, 6, 'up', 'Jogando bingo', 60, 200),
      S(2, 9, 'up', 'Jogando bingo', 60, 200), S(4, 9, 'up', 'Jogando bingo', 60, 200),
      S(11, 9, 'up', 'Jogando bingo', 60, 200), S(13, 9, 'up', 'Jogando bingo', 60, 200),
      S(9, 12, 'left', 'Cantando as bolas', 40, 120), S(2, 14, 'up', 'Comprando cartela', 10, 30),
    ],
  },
  gerente: {
    nome: 'Sala do gerente', cor: '#26324F', top: false,
    sala: () => monta('madeira', 16, 14, [
      ['tapete-chefe', 5, 5], ['mesa-chefe', 6, 7, BOSS_DESK], ['cadeira-reuniao', 6, 9], ['cadeira-reuniao', 8, 9],
      ['estante', 2, 11], ['arquivo', 12, 11], ['sofa', 10, 10],
      ['planta', 1, 2], ['planta', 14, 11],
      ['janela', 3, 0], ['quadro-branco', 7, 0], ['relogio', 11, 0], ['janela', 12, 0],
    ]),
    spots: [],
  },
  reuniao: {
    nome: 'Sala de reunião', cor: '#3f7f6e', top: false,
    // mesa grande no meio, TV e quadro na parede; corredor de baixo livre pra porta (7-8)
    sala: () => monta('carpete', 16, 14, [
      ['quadro-branco', 2, 0], ['tv', 7, 0], ['relogio', 10, 0], ['janela', 12, 0],
      ['mesa-reuniao', 5, 5],
      ['cadeira-reuniao', 5, 4], ['cadeira-reuniao', 7, 4], ['cadeira-reuniao', 9, 4],
      ['cadeira-reuniao', 5, 9], ['cadeira-reuniao', 9, 9],
      ['cadeira-reuniao', 4, 6], ['cadeira-reuniao', 10, 6],
      ['bebedouro', 14, 2], ['planta', 1, 2], ['planta', 14, 11],
    ]),
    spots: [
      S(5, 4, 'down', 'Em reunião', 60, 200), S(7, 4, 'down', 'Em reunião', 60, 200), S(9, 4, 'down', 'Apresentando', 40, 150),
      S(5, 9, 'up', 'Em reunião', 60, 200), S(9, 9, 'up', 'Anotando', 40, 150),
      S(4, 6, 'right', 'Em call', 40, 150), S(10, 6, 'left', 'Em reunião', 60, 200),
      S(3, 2, 'up', 'No quadro', 20, 60), S(14, 3, 'up', 'Bebendo água', 8, 20, false, { prop: 'copo', icon: '💧' }),
    ],
  },
}

export const comodoOf = (k: Kind) => (k === 'dept' || k === 'vaga' ? null : COMODOS[k])
