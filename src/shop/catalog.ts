import type { GearSlot } from '../types'

/** Almoxarifado: tudo que se compra com cafezinhos. id = 'categoria:arte' (o servidor guarda o preço pelo id). */
export type Slot = 'cabelo' | 'roupa' | GearSlot
export type Tier = 1 | 2 | 3 | 4
export interface Item { id: string; slot: Slot; art: string; name: string; tier: Tier; price: number; tint?: string }

export const PRICE: Record<Tier, number> = { 1: 30, 2: 60, 3: 120, 4: 250 }
export const TIER_NAME: Record<Tier, string> = { 1: 'Do estoque', 2: 'Caprichado', 3: 'Raro', 4: 'Lendário' }

export const SLOTS: { id: Slot; label: string; who: 'eu' | 'mesa' }[] = [
  { id: 'cabelo', label: 'Cabelo', who: 'eu' },
  { id: 'roupa', label: 'Roupa', who: 'eu' },
  { id: 'chapeu', label: 'Cabeça', who: 'eu' },
  { id: 'rosto', label: 'Rosto', who: 'eu' },
  { id: 'animacao', label: 'Animação', who: 'eu' },
  { id: 'plaquinha', label: 'Plaquinha', who: 'eu' },
  { id: 'mesa', label: 'Mesa', who: 'mesa' },
  { id: 'cadeira', label: 'Cadeira', who: 'mesa' },
  { id: 'notebook', label: 'Notebook', who: 'mesa' },
  { id: 'enfeite', label: 'Enfeite de mesa', who: 'mesa' },
  { id: 'chao', label: 'Do lado da mesa', who: 'mesa' },
]

// [arte, nome, nível, cor?]
type Row = [string, string, Tier, string?]
const RAW: Record<Slot, Row[]> = {
  cabelo: [
    ['franja', 'Franjinha', 1], ['rabo', 'Rabo de cavalo', 1], ['chanel', 'Chanel', 1], ['topete', 'Topete', 1], ['ondulado', 'Ondulado', 1], ['careca', 'Careca lustrosa', 1],
    ['moicano', 'Moicano', 2], ['tranca', 'Trança lateral', 2], ['black', 'Black power', 2], ['chiquinha', 'Maria-chiquinha', 2], ['espetado', 'Espetado de anime', 2],
    ['mullet', 'Mullet de reunião', 3], ['samurai', 'Coque samurai', 3], ['dread', 'Dread', 3],
  ],
  roupa: [
    ['regata', 'Regata de sexta', 1], ['polo', 'Polo', 1], ['listrada', 'Listrada', 1], ['avental', 'Avental', 1],
    ['xadrez', 'Xadrez de lenhador', 2], ['jaqueta', 'Jaqueta jeans', 2], ['colete', 'Colete', 2], ['uniforme', 'Uniforme Village', 2], ['jardineira', 'Jardineira', 2], ['cardiga', 'Cardigã da vó', 2], ['time', 'Camisa de time', 2],
    ['macacao', 'Macacão', 3], ['havaiana', 'Camisa florida', 3], ['blazer', 'Blazer de apresentação', 3], ['salvavidas', 'Salva-vidas da piscina', 3], ['chef', 'Dólmã de chef', 3],
  ],
  chapeu: [
    ['bone-azul', 'Boné azul', 1, '#3a6fd8'], ['bone-vermelho', 'Boné vermelho', 1, '#e05a47'], ['bone-amarelo', 'Boné amarelo', 1, '#FBC222'], ['bone-preto', 'Boné preto', 1, '#2d2d33'],
    ['gorro-vermelho', 'Gorro vermelho', 1, '#e05a47'], ['gorro-azul', 'Gorro azul', 1, '#3a6fd8'], ['gorro-verde', 'Gorro verde', 1, '#3fa66b'],
    ['laco-rosa', 'Laço rosa', 1, '#f28cb1'], ['laco-vermelho', 'Laço vermelho', 1, '#e05a47'], ['viseira', 'Viseira', 1, '#FBC222'], ['bandana', 'Bandana', 1],
    ['palha', 'Chapéu de palha', 2], ['flores', 'Tiara de flores', 2], ['fone-preto', 'Fone de ouvido', 2, '#2d2d33'], ['fone-rosa', 'Fone rosinha', 2, '#f28cb1'],
    ['capacete', 'Capacete de obra', 2], ['gato', 'Orelhinha de gato', 2, '#2d2d33'], ['antena', 'Anteninha', 2],
    ['cozinheiro', 'Touca de chef', 3], ['cartola', 'Cartola', 3], ['cowboy', 'Chapéu de caubói', 3], ['helice', 'Boné de hélice', 3, '#3a6fd8'],
    ['coroa', 'Coroa de chefe do café', 4],
  ],
  rosto: [
    ['oculos-redondo', 'Óculos redondo', 1], ['oculos-quadrado', 'Óculos de planilha', 1], ['bigode', 'Bigode', 1], ['cavanhaque', 'Cavanhaque', 1], ['sardas', 'Sardas', 1],
    ['oculos-escuro', 'Óculos escuro', 2], ['oculos-3d', 'Óculos 3D', 2], ['barba', 'Barba cheia', 2], ['pirata', 'Tapa-olho de pirata', 2],
    ['monoculo', 'Monóculo de diretor', 3], ['mascara', 'Máscara de herói', 3],
  ],
  mesa: [
    ['clara', 'Madeira clara', 1], ['escura', 'Madeira escura', 1], ['branca', 'Branca', 1],
    ['preta', 'Preta fosca', 2], ['rustica', 'Rústica de demolição', 2], ['rosa', 'Rosa', 2], ['azul', 'Azul Village', 2],
    ['vidro', 'Vidro', 3], ['marmore', 'Mármore com dourado', 3],
    ['gamer', 'Gamer com LED', 4],
  ],
  cadeira: [
    ['banquinho', 'Banquinho', 1], ['rosa', 'Cadeira rosa', 1], ['verde', 'Cadeira verde', 1], ['amarela', 'Cadeira amarela', 1],
    ['bola', 'Bola de pilates', 2], ['poltrona', 'Poltrona do vô', 2],
    ['gamer-vermelha', 'Gamer vermelha', 3], ['gamer-azul', 'Gamer azul', 3], ['executiva', 'Executiva de couro', 3],
    ['trono', 'Trono', 4],
  ],
  notebook: [
    ['preto', 'Preto', 1], ['rosa', 'Rosa', 1], ['azul', 'Azul', 1],
    ['branco', 'Branquinho de grife', 2], ['adesivos', 'Cheio de adesivo', 2],
    ['dourado', 'Dourado', 3], ['gamer', 'Gamer RGB', 3], ['retro', 'Monitor de tubo', 3], ['maquina', 'Máquina de escrever', 3],
    ['duplo', 'Dois monitores', 4],
  ],
  enfeite: [
    ['cacto', 'Cacto', 1], ['suculenta', 'Suculenta', 1], ['caneca', 'Caneca Village', 1], ['retrato', 'Porta-retrato', 1], ['pato', 'Patinho de borracha', 1], ['abacaxi', 'Abacaxi', 1], ['livros', 'Pilha de livros', 1], ['cubo', 'Cubo mágico', 1], ['flores', 'Vaso de flores', 1],
    ['cafe', 'Xícara fumegando', 2], ['luminaria', 'Luminária', 2], ['globo', 'Globo', 2], ['coqueiro', 'Coqueirinho', 2], ['radio', 'Radinho', 2], ['ampulheta', 'Ampulheta', 2], ['dino', 'Dinossauro', 2], ['porquinho', 'Cofrinho', 2],
    ['trofeu', 'Troféu', 3], ['aquario', 'Aquário', 3], ['lava', 'Luminária de lava', 3], ['bonsai', 'Bonsai', 3],
    ['gato', 'Gato dormindo', 4],
  ],
  chao: [
    ['planta', 'Planta grande', 1], ['galao', 'Galão de água', 1], ['skate', 'Skate', 1],
    ['ventilador', 'Ventilador', 2], ['basquete', 'Lixeira de basquete', 2], ['boia', 'Boia de piscina', 2],
    ['frigobar', 'Frigobar', 3], ['guardasol', 'Guarda-sol', 3], ['violao', 'Violão', 3],
    ['cachorro', 'Cachorro do escritório', 4],
  ],
  animacao: [
    ['folhas', 'Folhinhas', 1], ['bolhas', 'Bolhas de sabão', 1], ['vapor', 'Vapor de café', 1],
    ['coracoes', 'Corações', 2], ['estrelas', 'Estrelinhas', 2], ['notas', 'Notas musicais', 2],
    ['faiscas', 'Faíscas', 3], ['nuvem', 'Nuvem de segunda-feira', 3], ['raio', 'Raio de prazo', 3], ['borboletas', 'Borboletas', 3],
    ['arco', 'Arco-íris', 4], ['aureola', 'Auréola de funcionário do mês', 4],
  ],
  plaquinha: [
    ['amarela', 'Amarela', 1], ['verde', 'Verde', 1], ['rosa', 'Rosa', 1], ['roxa', 'Roxa', 1], ['laranja', 'Laranja', 1],
    ['dourada', 'Dourada brilhante', 3], ['neon', 'Neon', 3],
    ['arco', 'Arco-íris', 4],
  ],
}

export const ITEMS: Item[] = (Object.keys(RAW) as Slot[]).flatMap(slot =>
  RAW[slot].map(([art, name, tier, tint]) => ({ id: `${slot}:${art}`, slot, art, name, tier, price: PRICE[tier], tint })))
export const ITEM: Record<string, Item> = Object.fromEntries(ITEMS.map(i => [i.id, i]))

/** arte base de variações de cor (bone-azul → bone) */
export const baseArt = (art: string) => art.replace(/-(azul|vermelho|amarelo|preto|verde|rosa)$/, '')
export const tintOf = (slot: Slot, art: string) => ITEM[`${slot}:${art}`]?.tint
