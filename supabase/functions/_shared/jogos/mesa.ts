import { comprarCarta, jogarCarta, novaMesa, novaMesaBaralho } from './cartas.ts'
import type { Carta, CorCarta, MesaCartas } from './cartas.ts'
import { avancar, emMovimento, montarMesa, pontoLivre, resolverTacada, MAX_V } from './sinuca.ts'
import type { Bola, Grupo } from './sinuca.ts'
export type TipoMesa = 'sinuca' | 'cartas' | 'baralho'
export type MesaFn = 'listar' | 'criar' | 'entrar' | 'estado' | 'acao' | 'sair'
export interface Tacada { angulo: number; forca: number; vez: 0 | 1; antes: Bola[] }
export interface SinucaMesa { bolas: Bola[]; vez: 0 | 1; grupos: [Grupo | null, Grupo | null]; vencedor: 0 | 1 | null; aviso: string; ultima?: Tacada }
export interface MesaRegistro { id: string; jogo: TipoMesa; dono: string; convidado: string | null; estado: 'espera' | 'jogando' | 'fim'; versao: number; dados: { cartas?: MesaCartas; sinuca?: SinucaMesa }; atualizado: string }
export type MesaResumo = Omit<MesaRegistro, 'dados'>
export interface CartasVista { mao: Carta[]; adversario: number; topo: Carta; cor: CorCarta; vez: 0 | 1; vencedor: 0 | 1 | null; monte: number; aviso: string; baralho: boolean; inicial: number }
export interface MesaVista extends MesaResumo { eu: 0 | 1; cartas?: CartasVista; sinuca?: SinucaMesa }
export type AcaoMesa = { tipo: 'comprar' } | { tipo: 'jogar'; carta: number; cor?: CorCarta } | { tipo: 'tacada'; angulo: number; forca: number }
export interface MesaPedido { id?: string; jogo?: TipoMesa; versao?: number; acao?: AcaoMesa }
export interface MesaResposta { mesas?: MesaResumo[]; mesa?: MesaVista }
export const tipoMesa = (v: unknown): v is TipoMesa => v === 'sinuca' || v === 'cartas' || v === 'baralho'
export function resumoMesa(m: MesaRegistro): MesaResumo { return { id: m.id, jogo: m.jogo, dono: m.dono, convidado: m.convidado, estado: m.estado, versao: m.versao, atualizado: m.atualizado } }
export function criarMesa(id: string, jogo: TipoMesa, dono: string): MesaRegistro {
  if (!tipoMesa(jogo) || !dono) throw new Error('Jogo ou jogador inválido.')
  return { id, jogo, dono, convidado: null, estado: 'espera', versao: 0, atualizado: new Date().toISOString(), dados: jogo === 'sinuca' ? { sinuca: { bolas: montarMesa(), vez: 0, grupos: [null, null], vencedor: null, aviso: 'Jogador 1 começa.' } } : { cartas: jogo === 'baralho' ? novaMesaBaralho() : novaMesa() } }
}
export function entrarMesa(m: MesaRegistro, user: string): MesaRegistro {
  if (m.dono === user || m.convidado === user) return m
  if (!user || m.estado !== 'espera' || m.convidado) throw new Error('Essa mesa já está ocupada.')
  return { ...m, convidado: user, estado: 'jogando', versao: m.versao + 1, atualizado: new Date().toISOString() }
}
export function visaoMesa(m: MesaRegistro, user: string): MesaVista {
  if (m.dono !== user && m.convidado !== user) throw new Error('Você não participa dessa mesa.')
  const eu = m.dono === user ? 0 : 1, c = m.dados.cartas
  const aviso = c?.vencedor !== null && c?.vencedor !== undefined ? (c.vencedor === eu ? 'Você venceu.' : 'O colega venceu.') : (c?.aviso ?? '').replace(/O computador/g, 'O jogador 2').replace(/Você/g, 'Jogador 1')
  return { ...resumoMesa(m), eu, ...(m.dados.sinuca ? { sinuca: m.dados.sinuca } : {}), ...(c ? { cartas: { mao: c.maos[eu], adversario: c.maos[eu === 0 ? 1 : 0].length, topo: c.descarte[c.descarte.length - 1], cor: c.cor, vez: c.vez, vencedor: c.vencedor, monte: c.monte.length, aviso: c.aviso.includes('saiu da partida') ? `${aviso} Um participante saiu da partida.` : aviso, baralho: !!c.baralho, inicial: c.inicial ?? 7 } } : {}) }
}
export function acaoMesa(m: MesaRegistro, user: string, versao: number, acao: AcaoMesa): MesaRegistro {
  const view = visaoMesa(m, user)
  if (versao !== m.versao) throw new Error('A mesa mudou. Atualizando a partida…')
  if (m.estado !== 'jogando' || !m.convidado) throw new Error('A partida não está em andamento.')
  const dados = m.dados
  if ((dados.cartas?.vez ?? dados.sinuca?.vez) !== view.eu) throw new Error('Aguarde sua vez.')
  const next: MesaRegistro = { ...m, dados: { ...dados }, versao: m.versao + 1, atualizado: new Date().toISOString() }
  if (dados.cartas) {
    const old = dados.cartas
    if (acao.tipo === 'comprar') next.dados.cartas = comprarCarta(old)
    else if (acao.tipo === 'jogar') {
      const i = old.maos[view.eu].findIndex(c => c.id === acao.carta)
      next.dados.cartas = jogarCarta(old, i, acao.cor)
    } else throw new Error('Jogada inválida para essa mesa.')
    if (next.dados.cartas === old) throw new Error('Essa carta não pode ser jogada.')
    if (next.dados.cartas!.vencedor !== null) next.estado = 'fim'
  } else if (dados.sinuca) {
    if (acao.tipo !== 'tacada' || !Number.isFinite(acao.angulo) || Math.abs(acao.angulo) > Math.PI * 4 || !Number.isFinite(acao.forca) || acao.forca < 5 || acao.forca > 100) throw new Error('Tacada inválida.')
    const old = dados.sinuca, bolas = old.bolas.map(b => ({ ...b })), antes = bolas.map(b => ({ ...b }))
    const ctx = { encacapadas: [] as number[], primeiro: null as number | null }
    const br = bolas.find(b => b.id === 0)!, speed = acao.forca / 100 * MAX_V
    br.vx = Math.cos(acao.angulo) * speed; br.vy = Math.sin(acao.angulo) * speed
    let step = 0
    while (emMovimento(bolas) && step++ < 3000) avancar(bolas, ctx)
    for (const b of bolas) { b.vx = 0; b.vy = 0 }
    const result = resolverTacada(old.vez, old.grupos, ctx, antes.filter(b => !b.fora && b.id > 0).map(b => b.id))
    if (result.falta || br.fora) { const p = pontoLivre(bolas); br.x = p.x; br.y = p.y; br.fora = false }
    next.dados.sinuca = { bolas, vez: result.vez, grupos: result.grupos, vencedor: result.fim?.vencedor ?? null, aviso: result.fim ? `Jogador ${result.fim.vencedor + 1} venceu. ${result.fim.motivo}` : result.aviso, ultima: { angulo: acao.angulo, forca: acao.forca, vez: old.vez, antes } }
    if (result.fim) next.estado = 'fim'
  } else throw new Error('Estado da mesa inválido.')
  return next
}
export function sairMesa(m: MesaRegistro, user: string): MesaRegistro {
  const v = visaoMesa(m, user)
  if (m.estado === 'fim') return m
  const vencedor = v.eu === 0 ? 1 : 0
  const dados = structuredClone(m.dados)
  if (dados.cartas) { dados.cartas.vencedor = vencedor; dados.cartas.aviso = 'O outro jogador saiu da partida.' }
  if (dados.sinuca) { dados.sinuca.vencedor = vencedor; dados.sinuca.aviso = 'O outro jogador saiu da partida.'; delete dados.sinuca.ultima }
  return { ...m, dados, estado: 'fim', versao: m.versao + 1, atualizado: new Date().toISOString() }
}
