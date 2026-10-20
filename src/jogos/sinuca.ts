export type Grupo = 'lisas' | 'listradas'
export interface Bola { id: number; x: number; y: number; vx: number; vy: number; fora: boolean }
export interface Contexto { encacapadas: number[]; primeiro: number | null }
export interface Fim { vencedor: 0 | 1; motivo: string }
export interface Resolucao { vez: 0 | 1; grupos: [Grupo | null, Grupo | null]; falta: boolean; aviso: string; fim: Fim | null }

export const L = 800
export const A = 400
export const R = 11
export const MAX_V = 6.5
const ATRITO = 0.994
const DESACEL = 0.003
const PARADA = 0.04
export const CACAPAS = [
  { x: 0, y: 0, r: 26 }, { x: L / 2, y: -2, r: 22 }, { x: L, y: 0, r: 26 },
  { x: 0, y: A, r: 26 }, { x: L / 2, y: A + 2, r: 22 }, { x: L, y: A, r: 26 },
]

export const grupoDe = (id: number): Grupo | null => (id >= 1 && id <= 7 ? 'lisas' : id >= 9 && id <= 15 ? 'listradas' : null)

export function montarMesa(): Bola[] {
  const bolas: Bola[] = [{ id: 0, x: 200, y: A / 2, vx: 0, vy: 0, fora: false }]
  const ordem = [1, 9, 2, 10, 8, 3, 11, 4, 12, 5, 13, 6, 14, 7, 15]
  const d = 2 * R + 0.6
  let k = 0
  for (let col = 0; col < 5; col++) {
    for (let l = 0; l <= col; l++) {
      bolas.push({ id: ordem[k++], x: 560 + col * d * 0.866, y: A / 2 + (l - col / 2) * d, vx: 0, vy: 0, fora: false })
    }
  }
  return bolas
}

export const emMovimento = (bolas: Bola[]) => bolas.some(b => !b.fora && (b.vx !== 0 || b.vy !== 0))

/** Um sub-passo de física. Muta as bolas e registra caçapas e primeiro toque da branca. */
export function avancar(bolas: Bola[], ctx: Contexto) {
  for (const b of bolas) {
    if (b.fora) continue
    b.x += b.vx; b.y += b.vy
    for (const c of CACAPAS) {
      if (Math.hypot(b.x - c.x, b.y - c.y) < c.r) { b.fora = true; b.vx = 0; b.vy = 0; ctx.encacapadas.push(b.id); break }
    }
    if (b.fora) continue
    if (b.x < R) { b.x = R; b.vx = Math.abs(b.vx) * 0.8 } else if (b.x > L - R) { b.x = L - R; b.vx = -Math.abs(b.vx) * 0.8 }
    if (b.y < R) { b.y = R; b.vy = Math.abs(b.vy) * 0.8 } else if (b.y > A - R) { b.y = A - R; b.vy = -Math.abs(b.vy) * 0.8 }
    const sp = Math.hypot(b.vx, b.vy)
    if (sp > 0) {
      const ns = sp * ATRITO - DESACEL
      if (ns < PARADA) { b.vx = 0; b.vy = 0 } else { b.vx *= ns / sp; b.vy *= ns / sp }
    }
  }
  for (let i = 0; i < bolas.length; i++) {
    const a = bolas[i]
    if (a.fora) continue
    for (let j = i + 1; j < bolas.length; j++) {
      const b = bolas[j]
      if (b.fora) continue
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy)
      if (d >= 2 * R || d === 0) continue
      const nx = dx / d, ny = dy / d, pen = (2 * R - d) / 2
      a.x -= nx * pen; a.y -= ny * pen; b.x += nx * pen; b.y += ny * pen
      if (ctx.primeiro === null && (a.id === 0 || b.id === 0)) ctx.primeiro = a.id === 0 ? b.id : a.id
      const dvn = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny
      if (dvn > 0) { a.vx -= dvn * nx; a.vy -= dvn * ny; b.vx += dvn * nx; b.vy += dvn * ny }
    }
  }
}

/** Ponto livre para a branca após falta, começando pelo ponto de saída. */
export function pontoLivre(bolas: Bola[]): { x: number; y: number } {
  const livre = (x: number, y: number) => bolas.every(b => b.fora || b.id === 0 || Math.hypot(b.x - x, b.y - y) > 2 * R + 1)
  for (let dx = 0; dx <= 160; dx += 8) {
    for (const x of dx === 0 ? [200] : [200 - dx, 200 + dx]) {
      for (let dy = 0; dy <= 160; dy += 8) for (const y of dy === 0 ? [A / 2] : [A / 2 + dy, A / 2 - dy]) if (livre(x, y)) return { x, y }
    }
  }
  return { x: 200, y: A / 2 }
}

/** Aplica as regras 8-ball depois que todas as bolas pararam. `antes` = ids em jogo antes da tacada. */
export function resolverTacada(vez: 0 | 1, grupos: [Grupo | null, Grupo | null], ctx: Contexto, antes: number[]): Resolucao {
  const outro: 0 | 1 = vez === 0 ? 1 : 0
  const gs: [Grupo | null, Grupo | null] = [grupos[0], grupos[1]]
  const enc = ctx.encacapadas, num = enc.filter(i => i !== 0 && i !== 8)
  let g = gs[vez]
  const limpo = g !== null && !antes.some(i => grupoDe(i) === g)
  const p = ctx.primeiro
  let falta = false, motivo = ''
  if (enc.includes(0)) { falta = true; motivo = 'A branca foi encaçapada.' }
  else if (p === null) { falta = true; motivo = 'A branca não tocou em nenhuma bola.' }
  else if (g === null) { if (p === 8) { falta = true; motivo = 'Primeiro toque na bola 8.' } }
  else if (limpo) { if (p !== 8) { falta = true; motivo = 'Era preciso tocar a bola 8 primeiro.' } }
  else if (grupoDe(p) !== g) { falta = true; motivo = 'Primeiro toque em bola que não é do seu grupo.' }
  if (enc.includes(8)) {
    const venceu = !falta && limpo
    return {
      vez, grupos: gs, falta, aviso: '',
      fim: venceu ? { vencedor: vez, motivo: 'Encaçapou a bola 8 depois de zerar o grupo.' }
        : { vencedor: outro, motivo: falta && limpo ? `Encaçapou a bola 8 com falta. ${motivo}` : 'Bola 8 encaçapada antes da hora.' },
    }
  }
  let atribuiu = ''
  if (g === null && !falta && num.length) {
    g = grupoDe(num[0]); gs[vez] = g; gs[outro] = g === 'lisas' ? 'listradas' : 'lisas'
    if (g) atribuiu = ` Jogador ${vez + 1} ficou com as ${g}.`
  }
  const proprias = g ? num.filter(i => grupoDe(i) === g).length : 0
  if (falta) return { vez: outro, grupos: gs, falta, aviso: `Falta: ${motivo} Jogador ${outro + 1} joga com a branca livre.`, fim: null }
  if (proprias > 0) return { vez, grupos: gs, falta, aviso: `Encaçapou! Jogador ${vez + 1} joga de novo.${atribuiu}`, fim: null }
  return { vez: outro, grupos: gs, falta, aviso: `Sem bola do grupo. Vez do jogador ${outro + 1}.${atribuiu}`, fim: null }
}
