import type { Gear } from '../types'

/** Peças do Almoxarifado que ficam na mesa: tampo, notebook, enfeite, chão do lado e cadeira. */
type C2D = CanvasRenderingContext2D
const OUT = '#1d1a2b'

function rect(c: C2D, color: string, x: number, y: number, w: number, h: number) {
  c.fillStyle = color
  c.fillRect(x, y, w, h)
}
function disc(c: C2D, cx: number, cy: number, r: number, color: string) {
  for (let dy = -r; dy <= r; dy++) {
    const h = Math.round(Math.sqrt((r + 0.4) ** 2 - dy * dy))
    rect(c, color, cx - h, cy + dy, 2 * h + 1, 1)
  }
}
const rgb = (x: number, t: number) => `hsl(${Math.round(x * 12 + t / 8) % 360} 90% 60%)`

const PAL: Record<string, string> = {
  o: OUT, k: '#2d2d33', K: '#17171c', g: '#f2c230', G: '#b8901c', n: '#8a5a36', N: '#5e3b22', y: '#FBC222', Y: '#c99412',
  z: '#e05a47', Z: '#a33a2c', i: '#bfe6ff', I: '#7fb7da', q: '#9aa0a6', Q: '#6b7078', v: '#3fa66b', V: '#2a7349',
  l: '#f28cb1', L: '#c9618a', u: '#3a6fd8', U: '#26489a', j: '#f39c35', d: '#e8c873', D: '#c49a45', E: '#0B235D',
  w: '#ffffff', W: '#d8dbe2', b: '#f4e6c8',
}
/** desenho em grade, com a última linha em yb */
function art(c: C2D, rows: string[], x: number, yb: number) {
  const top = yb - rows.length + 1
  rows.forEach((row, r) => {
    for (let k = 0; k < row.length; k++) {
      const col = PAL[row[k]]
      if (col) rect(c, col, x + k, top + r, 1, 1)
    }
  })
}

// ---------- tampo ----------
export const MESA: Record<string, { top: string; hi: string; front: string }> = {
  clara: { top: '#e1bd93', hi: '#ecd0ac', front: '#c09a6c' },
  escura: { top: '#6b3f22', hi: '#8a5530', front: '#4a2a16' },
  branca: { top: '#eef0f3', hi: '#ffffff', front: '#c9ced8' },
  preta: { top: '#2d2d33', hi: '#45454e', front: '#17171c' },
  rustica: { top: '#9c6b43', hi: '#b5825a', front: '#7a5030' },
  rosa: { top: '#f6b8cf', hi: '#fbd3e2', front: '#d98aa8' },
  azul: { top: '#0B235D', hi: '#1d3a80', front: '#071640' },
  vidro: { top: '#cfe9f5', hi: '#eef9fd', front: '#a9d3e6' },
  marmore: { top: '#eceae6', hi: '#ffffff', front: '#d7d3cc' },
  gamer: { top: '#2d2d33', hi: '#45454e', front: '#17171c' },
}
/** detalhe por cima do tampo pintado */
export function mesaExtra(c: C2D, mesa: string | undefined, x: number, y: number, w: number, t: number) {
  if (mesa === 'rustica') for (let k = 7; k < w; k += 8) rect(c, '#82552f', x + k, y + 3, 1, 7)
  if (mesa === 'azul') rect(c, '#FBC222', x, y + 10, w, 1)
  if (mesa === 'vidro') { rect(c, '#9aa0a6', x + 1, y + 11, 2, 4); rect(c, '#9aa0a6', x + w - 3, y + 11, 2, 4); rect(c, '#ffffff', x + 3, y + 3, 4, 1) }
  if (mesa === 'marmore') {
    for (let k = 0; k < w; k += 5) rect(c, '#bdb7ad', x + k + ((k / 5) % 2 ? 2 : 0), y + 4 + ((k / 5) % 3), 2, 1)
    rect(c, '#d4af37', x, y + 10, w, 1)
  }
  if (mesa === 'gamer') for (let k = 0; k < w; k++) rect(c, rgb(k, t), x + k, y + 12, 1, 1)
}

// ---------- notebook ----------
const LID: Record<string, [string, string]> = {
  preto: ['#3a3a42', '#2d2d33'], rosa: ['#f6b8cf', '#d98aa8'], azul: ['#4a90d9', '#2f6fb0'], branco: ['#f7f7f9', '#d8dbe2'],
  dourado: ['#e8c060', '#b8901c'], adesivos: ['#c9ced8', '#9aa3b5'], gamer: ['#2d2d33', '#17171c'],
}
export function drawNotebook(c: C2D, kind: string | undefined, m: number, y: number, glow: string, t: number) {
  if (kind === 'retro') {
    rect(c, OUT, m - 7, y - 4, 14, 12)
    rect(c, '#d9cfb0', m - 6, y - 3, 12, 10)
    rect(c, '#bfb48f', m - 4, y + 4, 8, 1); rect(c, '#bfb48f', m - 4, y + 6, 8, 1)
    rect(c, glow, m - 1, y, 2, 2)
    return
  }
  if (kind === 'maquina') {
    rect(c, OUT, m - 5, y - 5, 10, 7); rect(c, '#fbfbf8', m - 4, y - 4, 8, 6)
    rect(c, '#9aa0a6', m - 3, y - 2, 5, 1)
    rect(c, OUT, m - 7, y, 14, 8); rect(c, '#2d2d33', m - 6, y + 1, 12, 6)
    for (let k = 0; k < 5; k++) rect(c, '#d8dbe2', m - 5 + k * 2, y + 4, 1, 1)
    rect(c, glow === '#9aa3b5' ? '#45454e' : '#e05a47', m + 4, y + 2, 1, 1)
    return
  }
  if (kind === 'duplo') {
    for (const mx of [m - 12, m + 1]) {
      rect(c, OUT, mx, y - 3, 11, 9); rect(c, '#3a3a42', mx + 1, y - 2, 9, 7)
      rect(c, glow, mx + 5, y, 1, 2)
      rect(c, OUT, mx + 4, y + 6, 3, 2)
    }
    return
  }
  const [lid, base] = LID[kind ?? ''] ?? ['#c9ced8', '#9aa3b5']
  rect(c, OUT, m - 7, y - 1, 14, 8)
  rect(c, lid, m - 6, y, 12, 6)
  if (kind === 'dourado') rect(c, '#fff3c4', m - 5, y, 3, 1)
  if (kind === 'adesivos') {
    rect(c, '#e05a47', m - 5, y + 1, 2, 2); rect(c, '#3fa66b', m + 3, y + 3, 2, 1)
    rect(c, '#FBC222', m + 2, y, 1, 1); rect(c, '#f28cb1', m - 4, y + 4, 2, 1); rect(c, '#3a6fd8', m + 4, y + 1, 1, 1)
  }
  if (kind === 'gamer') for (let k = 0; k < 12; k++) rect(c, rgb(k, t), m - 6 + k, y + 5, 1, 1)
  rect(c, glow, m - 1, y + 2, 2, 2)
  rect(c, base, m - 7, y + 7, 14, 1)
}

// ---------- enfeite de mesa (até 8 de largura, base em yb) ----------
const DECOR: Record<string, string[]> = {
  cacto: ['..oo...', '.ovvo..', '.ovvoo.', '.ovvovo', 'oovvvo.', 'ovovvo.', '.ovvo..', 'ojjjjo.', '.ojjo..'],
  suculenta: ['.o.o.o.', 'ovovovo', '.ovVvo.', 'ovvvvvo', 'onnnnno', '.onnno.'],
  caneca: ['ooooo..', 'oEEEooo', 'oEyEo.o', 'oEEEooo', 'oEEEo..', '.ooo...'],
  retrato: ['ooooooo', 'onnnnno', 'oniiino', 'onvvvno', 'onnnnno', 'ooooooo'],
  pato: ['.ooo...', 'oyyyo..', 'oyoyjo.', 'oyyyo..', 'oyyyyoo', 'oyyyyyo', '.ooooo.'],
  abacaxi: ['.v.v.v.', '..vvv..', '..ovo..', '.ogggo.', 'ogGgGgo', 'ogggggo', 'oGgGgGo', '.ogggo.', '..ooo..'],
  livros: ['ooooooo', 'ozzzzzo', 'ooooooo', 'ouuuuuo', 'ooooooo', 'oyyyyyo', 'ooooooo'],
  cubo: ['ooooo', 'ozyvo', 'ouzyo', 'oyvzo', 'ooooo'],
  flores: ['.l...y.', 'lwl.yjy', '.l.v.y.', '..vvv..', '.ooooo.', '.oiiio.', '.oiiio.', '..ooo..'],
  cafe: ['ooooo..', 'owwwooo', 'owkwo.o', 'owwwooo', '.ooo...', 'ooooooo'],
  luminaria: ['..oooo.', '.okkkko', 'okkkkko', '.oyyyo.', '..o....', '..o....', '..o....', '.ooo...', 'okkko..'],
  globo: ['..ooo..', '.ouuvo.', 'ouvvuuo', 'ouuuvvo', '.ouvuo.', '..ooo..', '...o...', '.onnno.'],
  coqueiro: ['vv.vv..', '.vvvvv.', 'vv.n.vv', '...n...', '...n...', '..ono..', '.ojjjo.', '..ojo..'],
  radio: ['......o', '.....o.', 'ooooooo', 'okkkqqo', 'okokqqo', 'okkkqqo', 'ooooooo'],
  ampulheta: ['nnnnn', 'oiiio', '.odo.', '..o..', '.oio.', 'oiiio', 'nnnnn'],
  dino: ['...ooo.', '..ovvvo', '..ovovo', '..ovvo.', 'oovvvo.', '.ovvvvo', '.ovovo.', '.oo.oo.'],
  porquinho: ['.o..o..', 'ollllo.', 'olollLo', 'olllllo', '.olllo.', '.oo.oo.'],
  trofeu: ['ooooooo', 'ogggggo', 'oogggoo', '.ogggo.', '..ogo..', '..ogo..', '.ooooo.', '.oGGGo.', '.ooooo.'],
  aquario: ['oooooooo', 'oiiiiiio', 'oiiiiiio', 'oiiiiiio', 'oivivIio', 'oddddddo', 'oooooooo'],
  lava: ['..oo..', '.oqqo.', '.ozzo.', '.ozzo.', 'ozzzzo', 'ozzzzo', 'ozzzzo', '.oqqo.', 'oqqqqo', 'oooooo'],
  bonsai: ['.vvvv..', 'vvVvvv.', '.vv.vvv', '..nn.v.', '...n...', '..nn...', 'ozzzzzo', '.ooooo.'],
  gato: ['.o.o....', 'oqoqooo.', 'oqqqqqqo', 'oQqQqqqo', 'oqqqqqQo', '.oooooo.'],
}
export function drawDecor(c: C2D, kind: string, x: number, yb: number, t: number) {
  const rows = DECOR[kind]
  if (!rows) return
  art(c, rows, x, yb)
  const top = yb - rows.length + 1
  const ph = Math.floor(t / 400)
  if (kind === 'cafe') for (let k = 0; k < 3; k++) { const s = (ph + k) % 3; rect(c, 'rgba(255,255,255,.7)', x + 1 + ((s + k) % 2) * 2, top - 1 - s * 2, 1, 1) }
  if (kind === 'ampulheta') { const s = Math.floor(t / 600) % 3; rect(c, PAL.d, x + 2, top + 3 + (s % 2), 1, 1); rect(c, PAL.d, x + 1, top + 5, 3 - (s === 0 ? 1 : 0), 1) }
  if (kind === 'aquario') { const fx = Math.floor(t / 300) % 10; const px = fx < 5 ? fx : 9 - fx; rect(c, PAL.j, x + 1 + px, top + 2, 2, 1) }
  if (kind === 'lava') for (let k = 0; k < 2; k++) { const s = Math.floor(t / 500 + k * 2) % 5; rect(c, PAL.j, x + 2 + k, top + 6 - s, 1, 1) }
  if (kind === 'gato') { const s = Math.floor(t / 900) % 3; rect(c, 'rgba(255,255,255,.75)', x + 6 + (s % 2), top - 1 - s * 2, 1, 1) }
}

// ---------- do lado da mesa (até 14 de largura, base em yb) ----------
const FLOOR: Record<string, string[]> = {
  planta: ['...vv.....', '..vvVv.vv.', '.vVvvvvVv.', 'vvvvVvvvvv', '.vvvvvVvv.', 'vVv.vvvvVv', '.vvvvVvv..', '..vvvvvv..', '....nn....', '....nn....', '..oooooo..', '..ojjjjo..', '..ojjjjo..', '...ojjo...', '...oooo...'],
  galao: ['.oooooo.', 'oiiiiiio', 'oiIiiiio', 'oiiiiiio', '.oiiiio.', '..oooo..', '.oWWWWo.', '.oWzuWo.', '.oWWWWo.', '.oWWWWo.', '.oWWWWo.', '.oWWWWo.', '.oooooo.'],
  skate: ['.oooooooooooo.', 'ozzzzzzzzzzzzo', '.oooooooooooo.', '..oqo....oqo..', '...o......o...'],
  basquete: ['oooooooooo', 'owwwwwwwwo', 'owwozzowwo', 'owwwwwwwwo', 'oooooooooo', '...ojjo...', '....oo....', '.oqqqqqqo.', '.oqQqqQqo.', '.oqqqqqqo.', '.oqQqqQqo.', '.oqqqqqqo.', '..oooooo..'],
  boia: ['...oooooo...', '.oollwllloo.', 'olllooooLllo', 'oLlo....oLlo', 'olllooooLllo', '.oolllllloo.', '...oooooo...'],
  frigobar: ['oooooooooo', 'oWwwwwwwqo', 'oWwwlwwwqo', 'oWwwwwwkqo', 'oooooooooo', 'oWwwwwwwqo', 'oWwwwwwkqo', 'oWwwwwwkqo', 'oWwwwwwwqo', 'oWwwwwwwqo', 'oooooooooo', '.o......o.'],
  guardasol: ['.....oooo.....', '...oozwzwoo...', '..ozwzwzwzwo..', '.ozwzwzwzwzwo.', 'ozwzwzwzwzwzwo', 'oooooooooooooo', '......on......', '......on......', '......on......', '......on......', '......on......', '......on......', '......on......', '......on......', '......on......', '......on......', '....oooooo....', '....oddddo....'],
  violao: ['..onno..', '...on...', '...on...', '...on...', '...on...', '..onno..', '.onnnno.', 'onnnnnno', 'onnkknno', 'onnkknno', '.onnnno.', 'onnnnnno', 'onnNNnno', 'onnnnnno', '.onnnno.', '..oooo..'],
  cachorro: ['..ooo.........', '.onnno........', 'onknnnooooooo.', 'onnnnnnnnnnnno', '.ooNnnnnnnnnno', '...onnnnnnnno.', '...ono.ono.o..', '...oo..oo.....'],
}
export function drawFloor(c: C2D, kind: string, x: number, yb: number, t: number) {
  if (kind === 'ventilador') {
    const cx = x + 6, cy = yb - 15
    rect(c, OUT, cx - 1, cy, 3, 14); rect(c, '#9aa0a6', cx, cy, 1, 14)
    rect(c, OUT, cx - 5, yb - 1, 11, 2); rect(c, '#6b7078', cx - 4, yb - 1, 9, 1)
    disc(c, cx, cy, 6, OUT); disc(c, cx, cy, 5, '#d8dbe2')
    const a = t / 90
    for (let k = 0; k < 3; k++) {
      const ang = a + (k * Math.PI * 2) / 3
      for (let r = 1; r <= 4; r++) rect(c, '#3a6fd8', Math.round(cx + Math.cos(ang) * r), Math.round(cy + Math.sin(ang) * r), 1, 1)
    }
    rect(c, OUT, cx, cy, 1, 1)
    return
  }
  const rows = FLOOR[kind]
  if (!rows) return
  art(c, rows, x, yb)
  if (kind === 'cachorro') {
    const top = yb - rows.length + 1, up = Math.floor(t / 250) % 2
    rect(c, OUT, x + 13, top + 1 + up, 1, 2); rect(c, PAL.n, x + 13, top + 2 + up, 1, 1)
  }
}

// ---------- cadeira (atrás do personagem; seat = onde ele senta) ----------
/** assento + coluna + base de rodinhas; a mesa cobre a parte de baixo quando a cadeira está encostada */
function seatBase(c: C2D, sx: number, sy: number, col: string, hi: string, w = 16, wheels = true) {
  rect(c, OUT, sx - w / 2, sy - 12, w, 5); rect(c, col, sx - w / 2 + 1, sy - 11, w - 2, 3); rect(c, hi, sx - w / 2 + 1, sy - 11, w - 2, 1)
  if (!wheels) { rect(c, OUT, sx - w / 2 + 1, sy - 7, 2, 6); rect(c, OUT, sx + w / 2 - 3, sy - 7, 2, 6); return }
  rect(c, OUT, sx - 1, sy - 7, 3, 3); rect(c, '#6b7078', sx, sy - 7, 1, 3)
  rect(c, OUT, sx - 6, sy - 4, 13, 2)
  for (const k of [-7, -1, 5]) { rect(c, OUT, sx + k, sy - 3, 3, 3); rect(c, '#45454e', sx + k + 1, sy - 2, 1, 1) }
}
const SIMPLE: Record<string, [string, string]> = {
  rosa: ['#f28cb1', '#f9b3cc'], verde: ['#3fa66b', '#5cc487'], amarela: ['#FBC222', '#ffd965'],
}
export function drawChair(c: C2D, style: string | undefined, sx: number, sy: number, boss: boolean) {
  if (style === 'banquinho') {
    rect(c, OUT, sx - 6, sy - 14, 12, 4); rect(c, '#8a5a36', sx - 5, sy - 13, 10, 2)
    for (const k of [-5, 3]) rect(c, OUT, sx + k, sy - 10, 2, 9)
    rect(c, OUT, sx - 5, sy - 5, 10, 1)
    return
  }
  if (style === 'bola') {
    disc(c, sx, sy - 10, 8, OUT); disc(c, sx, sy - 10, 7, '#3a6fd8')
    rect(c, '#7fb7da', sx - 4, sy - 14, 3, 2)
    return
  }
  if (style === 'poltrona') {
    seatBase(c, sx, sy, '#8e6a48', '#a07c58', 20, false)
    rect(c, OUT, sx - 10, sy - 25, 20, 15); rect(c, '#7a5a3a', sx - 9, sy - 24, 18, 13)
    rect(c, '#8e6a48', sx - 7, sy - 23, 14, 3)
    for (const k of [-4, 0, 4]) rect(c, '#5e4430', sx + k, sy - 19, 1, 1)
    rect(c, OUT, sx - 12, sy - 17, 4, 8); rect(c, '#5e4430', sx - 11, sy - 16, 2, 6)
    rect(c, OUT, sx + 8, sy - 17, 4, 8); rect(c, '#5e4430', sx + 9, sy - 16, 2, 6)
    return
  }
  if (style === 'gamer-vermelha' || style === 'gamer-azul') {
    const col = style === 'gamer-vermelha' ? '#e05a47' : '#3a6fd8'
    seatBase(c, sx, sy, '#2d2d33', col)
    rect(c, OUT, sx - 8, sy - 33, 16, 23); rect(c, '#2d2d33', sx - 7, sy - 32, 14, 21)
    rect(c, OUT, sx - 10, sy - 30, 3, 7); rect(c, col, sx - 9, sy - 29, 1, 5)
    rect(c, OUT, sx + 7, sy - 30, 3, 7); rect(c, col, sx + 8, sy - 29, 1, 5)
    rect(c, col, sx - 5, sy - 31, 2, 19); rect(c, col, sx + 3, sy - 31, 2, 19)
    rect(c, '#45454e', sx - 3, sy - 30, 6, 3)
    return
  }
  if (style === 'trono') {
    seatBase(c, sx, sy, '#a33a2c', '#c94a3c', 20, false)
    rect(c, OUT, sx - 10, sy - 36, 20, 26)
    rect(c, '#d4af37', sx - 9, sy - 35, 18, 24)
    rect(c, '#a33a2c', sx - 6, sy - 31, 12, 19)
    rect(c, '#c94a3c', sx - 5, sy - 30, 10, 2)
    for (const k of [-9, -1, 7]) { rect(c, OUT, sx + k, sy - 39, 3, 3); rect(c, '#f2c230', sx + k + 1, sy - 38, 1, 2) }
    rect(c, '#e05a47', sx - 1, sy - 34, 2, 2)
    return
  }
  if (style === 'executiva' || (boss && !style)) {
    const [base, hi, dk] = style === 'executiva' ? ['#2d2d33', '#45454e', '#17171c'] : ['#7a2e3a', '#93404a', '#5a1f2c']
    seatBase(c, sx, sy, base, hi, 18)
    rect(c, OUT, sx - 9, sy - 31, 18, 20)
    rect(c, base, sx - 8, sy - 30, 16, 18)
    rect(c, hi, sx - 6, sy - 28, 12, 3)
    rect(c, dk, sx - 1, sy - 24, 2, 10)
    if (boss) rect(c, '#FBC222', sx - 2, sy - 30, 4, 1)
    rect(c, OUT, sx - 11, sy - 18, 3, 7); rect(c, OUT, sx + 8, sy - 18, 3, 7)
    return
  }
  const [base, hi] = SIMPLE[style ?? ''] ?? ['#4a4048', '#605560']
  seatBase(c, sx, sy, base, hi)
  rect(c, OUT, sx - 7, sy - 23, 14, 12)
  rect(c, base, sx - 6, sy - 22, 12, 10)
  rect(c, hi, sx - 5, sy - 21, 10, 2)
}

export type DeskLook = Pick<Gear, 'mesa' | 'notebook' | 'enfeite' | 'chao' | 'cadeira'>
