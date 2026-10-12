import { BOSS_DESK } from './base'
import type { Obj, Piso, Sala } from './sala'
import type { Dir } from '../types'

/** o que cada sala do andar é: o setor, a sala do gerente, os cômodos de uso comum e a sala ainda vazia */
export type Kind = 'dept' | 'gerente' | 'cozinha' | 'jogos' | 'banheiro' | 'vaga'
/** cômodo que é de todo mundo do andar (sempre aberto) */
export const COMUM = new Set<Kind>(['cozinha', 'jogos', 'banheiro'])

/** lugar onde o boneco fica fazendo alguma coisa quando a pessoa está fora do app (tile da sala) */
export interface Spot {
  x: number; y: number; dir: Dir
  /** o que aparece no balão */
  act: string
  /** quanto tempo fica (ms, mín e máx) */
  ms: [number, number]
  /** some de vista enquanto está lá (cabine do banheiro) */
  some?: boolean
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

const S = (x: number, y: number, dir: Dir, act: string, a: number, b: number, some?: boolean): Spot => ({ x, y, dir, act, ms: [a * 1000, b * 1000], ...(some ? { some } : {}) })

/** Pra crescer o andar no futuro: novo tipo aqui + móveis em sala.ts + entrar na ordem do andar (Game.tsx). */
export const COMODOS: Record<Exclude<Kind, 'dept' | 'vaga'>, Comodo> = {
  cozinha: {
    nome: 'Cozinha', cor: '#e0893e', top: true,
    sala: () => monta('ceramica', 22, 16, [
      ['geladeira', 1, 2], ['fogao', 3, 2], ['pia-cozinha', 4, 2], ['micro-ondas', 6, 2], ['balcao', 7, 2],
      ['espresso', 14, 2], ['vitrine-doces', 15, 2], ['bebedouro', 18, 2], ['planta', 20, 2],
      ['janela', 2, 0], ['cartaz', 7, 0], ['menu-giz', 9, 0], ['relogio', 12, 0], ['janela', 16, 0],
      ['mesa-jantar', 3, 7], ['mesa-jantar', 13, 7],
      ['bistro', 2, 11], ['bistro', 17, 11],
      ['planta', 1, 14], ['planta', 20, 14], ['planta', 8, 7], ['planta', 11, 7],
    ]),
    spots: [
      S(14, 3, 'up', 'Tomando um café', 20, 60), S(15, 3, 'up', 'Escolhendo um doce', 15, 40),
      S(1, 3, 'up', 'Pegando um lanche', 10, 30), S(3, 3, 'up', 'Esquentando o almoço', 30, 90),
      S(6, 3, 'up', 'Esquentando a marmita', 30, 80), S(18, 3, 'up', 'Bebendo água', 8, 20),
      S(4, 6, 'down', 'Almoçando', 60, 180), S(5, 9, 'up', 'Almoçando', 60, 180),
      S(14, 6, 'down', 'Lanchando', 40, 120), S(15, 9, 'up', 'Conversando', 40, 120),
      S(2, 10, 'down', 'Café rapidinho', 20, 60), S(17, 10, 'down', 'Café rapidinho', 20, 60),
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
    sala: () => monta('carpete', 28, 16, [
      ['sinuca', 11, 6], ['pebolim', 4, 7],
      ['fliperama', 2, 13], ['fliperama', 3, 13], ['fliperama', 4, 13], ['fliperama', 5, 13],
      ['tapete-gamer', 20, 11], ['sofa', 19, 9], ['console', 20, 13], ['pufe', 18, 12], ['pufe', 24, 12],
      ['estante', 21, 3], ['mesa-jantar', 10, 11], ['cadeira-reuniao', 10, 13], ['cadeira-reuniao', 13, 13],
      ['planta', 1, 2], ['planta', 26, 2], ['planta', 26, 14], ['planta', 8, 14],
    ]),
    spots: [
      S(10, 6, 'right', 'Jogando sinuca', 60, 180), S(15, 7, 'left', 'Jogando sinuca', 60, 180),
      S(5, 6, 'down', 'No pebolim', 40, 120), S(5, 8, 'up', 'No pebolim', 40, 120),
      S(2, 14, 'up', 'No fliperama', 30, 90), S(4, 14, 'up', 'No fliperama', 30, 90), S(5, 14, 'up', 'No fliperama', 30, 90),
      S(20, 12, 'down', 'No videogame', 60, 200), S(22, 12, 'down', 'No videogame', 60, 200),
      S(22, 4, 'up', 'Escolhendo um jogo', 15, 40),
      S(11, 10, 'down', 'Jogo de tabuleiro', 60, 180), S(12, 13, 'up', 'Jogo de tabuleiro', 60, 180),
    ],
  },
  gerente: {
    nome: 'Sala do gerente', cor: '#26324F', top: false,
    sala: () => monta('madeira', 16, 14, [
      ['tapete-chefe', 5, 5], ['mesa-chefe', 6, 7, BOSS_DESK], ['cadeira-reuniao', 6, 9], ['cadeira-reuniao', 8, 9],
      ['estante', 2, 11], ['arquivo', 12, 11], ['sofa', 10, 10],
      ['planta', 1, 2], ['planta', 14, 2], ['planta', 1, 11], ['planta', 14, 11],
    ]),
    spots: [],
  },
}

export const comodoOf = (k: Kind) => (k === 'dept' || k === 'vaga' ? null : COMODOS[k])
