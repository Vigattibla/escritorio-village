import type { Dept, PlanoAcao, PlanoMes, PlanoNucleo, PlanoResp, Rows } from '../types'
import { MESES } from './datas'
import { key, readXlsx, type Sheet } from './xlsx'

/**
 * Planilha "matriz": coluna A = núcleos (stakeholders), cabeçalho com "MACROPROCESSO/NÚCLEO",
 * cada mês em 3 colunas (D · RESP. · MÊS/AA). Linhas acima do cabeçalho = faixas do mês/bimestre.
 */
export interface Importado { ciclo: string; meses: PlanoMes[]; nucleos: PlanoNucleo[]; acoes: PlanoAcao[]; resp: PlanoResp[] }

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
const MES_N = MESES.map(norm)

function mesDe(s: string) {
  const m = /^([a-z]+)\s*[/\-. ]\s*(\d{2,4})$/.exec(norm(s))
  if (!m) return null
  const i = MES_N.findIndex(n => n === m[1] || n.slice(0, 3) === m[1].slice(0, 3))
  if (i < 0) return null
  const y = m[2].length === 2 ? 2000 + +m[2] : +m[2]
  return `${y}-${String(i + 1).padStart(2, '0')}`
}

/** valor de uma célula, olhando a mesclagem que a cobre */
function at(sh: Sheet, r: number, c: number) {
  const v = sh.cells.get(key(r, c))
  if (v) return v
  const m = sh.merges.find(m => r >= m.r0 && r <= m.r1 && c >= m.c0 && c <= m.c1)
  return m ? sh.cells.get(key(m.r0, m.c0)) ?? '' : ''
}

const FAIXAS: [RegExp, keyof Pick<PlanoMes, 'tematica' | 'principal' | 'campanha' | 'oferta' | 'persona'>][] = [
  [/temat/, 'tematica'], [/principal|bimestre/, 'principal'], [/oferta|mecanica|produto/, 'oferta'], [/persona|foco/, 'persona'], [/campanha/, 'campanha'],
]
const LIM = { tematica: 400, principal: 300, campanha: 300, oferta: 2000, persona: 2000 }

/** palpite de sala para cada sigla da legenda (só se existir uma sala com nome parecido) */
const PALPITE: [RegExp, RegExp][] = [
  [/^(dir|mkt|perf|cont|des|vid)$/, /marketing|mkt/], [/^(com|b2b)$/, /comercial|vendas|reserva/], [/^conv$/, /convention|evento|corporat/],
  [/^sac$/, /sac|atendimento|relacionamento/], [/^rec$/, /recrea|lazer/], [/^(ope|rh\/ope)$/, /opera/], [/^ti$/, /\bti\b|tecnolog|sistema/],
  [/^fin$/, /financ/], [/^rh$/, /\brh\b|pessoas|gente/],
]

export async function importar(file: File, depts: Dept[], atual: { [K in 'plano_meses' | 'plano_acoes' | 'plano_resp']: Record<string, Rows[K]> }): Promise<Importado> {
  const sheets = await readXlsx(file)
  let sh: Sheet | undefined, h = 0
  for (const s of sheets) {
    // o cabeçalho é a linha com o rótulo na coluna A e um mês logo depois (aba de instruções também cita "núcleo")
    for (const [k, v] of s.cells) if (k.endsWith(':1') && /macroprocesso|nucleo|stakeholder/.test(norm(v)) && mesDe(at(s, +k.split(':')[0], 4))) { h = +k.split(':')[0]; sh = s; break }
    if (sh) break
  }
  if (!sh) throw new Error('Não achei o cabeçalho “MACROPROCESSO / NÚCLEO” na coluna A.')

  // meses: a cada 3 colunas a partir de B, o título fica na terceira
  const cols: { mes: string; c: number }[] = []
  for (let c = 2; c < 400; c += 3) {
    const mes = mesDe(at(sh, h, c + 2))
    if (!mes) break
    cols.push({ mes, c })
  }
  if (!cols.length) throw new Error('Não achei os meses no cabeçalho (ex.: OUTUBRO/26).')
  const ciclo = cols[0].mes
  const now = new Date().toISOString()

  const meses: PlanoMes[] = cols.map(({ mes }) => {
    const old = atual.plano_meses[`${ciclo}:${mes}`]
    return { id: `${ciclo}:${mes}`, ciclo, mes, tematica: '', principal: '', campanha: '', oferta: '', persona: '', estrategia: old?.estrategia ?? '', created_at: old?.created_at ?? now }
  })
  for (let r = 1; r < h; r++) {
    const lab = norm(sh.cells.get(key(r, 1)) ?? '')
    const f = lab && FAIXAS.find(([re]) => re.test(lab))?.[1]
    if (!f) continue
    cols.forEach(({ c }, i) => {
      const v = at(sh, r, c) || at(sh, r, c + 1) || at(sh, r, c + 2)
      if (v && !meses[i][f]) meses[i][f] = v.slice(0, LIM[f])
    })
  }

  // núcleos: blocos da coluna A (mesclados na vertical)
  let maxR = h
  for (const k of sh.cells.keys()) maxR = Math.max(maxR, +k.split(':')[0])
  const nucleos: PlanoNucleo[] = [], acoes: PlanoAcao[] = []
  let cur: PlanoNucleo | null = null, linha = 0
  for (let r = h + 1; r <= maxR; r++) {
    const own = sh.cells.get(key(r, 1))
    const merged = sh.merges.some(m => m.c0 === 1 && r > m.r0 && r <= m.r1)
    if (own && !merged) {
      cur = { id: `${ciclo}:n${nucleos.length}`, ciclo, nome: own.slice(0, 120), pos: nucleos.length, tipo: /calend|datas comemor/.test(norm(own)) ? 'datas' : 'acoes', created_at: now }
      nucleos.push(cur)
      linha = 0
    } else linha++
    if (!cur) continue
    for (const { mes, c } of cols) {
      const texto = sh.cells.get(key(r, c + 2))
      if (!texto) continue
      const id = `${ciclo}:${cur.pos}:${linha}:${mes}`
      const old = atual.plano_acoes[id]
      acoes.push({
        id, ciclo, nucleo: cur.id, pos: linha, mes, dia: (sh.cells.get(key(r, c)) ?? '').slice(0, 40), resp: (sh.cells.get(key(r, c + 1)) ?? '').toUpperCase().slice(0, 60),
        texto: texto.slice(0, 1000), estrategia: old?.estrategia ?? '', dept: old?.dept ?? null, pessoas: old?.pessoas ?? [], tarefas: old?.tarefas ?? [],
        created_by: old?.created_by ?? null, created_at: old?.created_at ?? now,
      })
    }
  }

  // legenda de siglas (aba de instruções): coluna A = sigla, B = quem é
  const resp: PlanoResp[] = []
  for (const s of sheets) for (const [k, v] of s.cells) {
    const [r, c] = k.split(':').map(Number)
    if (c !== 1 || !/^[A-Z]{2,5}(\/[A-Z]{2,5})?$/.test(v)) continue
    const nome = s.cells.get(key(r, 2))
    if (!nome || nome.length > 80 || resp.some(x => x.id === v)) continue
    const old = atual.plano_resp[v]
    const guess = PALPITE.find(([re]) => re.test(v.toLowerCase()))?.[1]
    const dept = old?.dept ?? (guess ? depts.find(d => guess.test(norm(d.name)) || guess.test(d.id))?.id ?? null : null)
    resp.push({ id: v, nome, dept, pessoas: old?.pessoas ?? [], created_at: old?.created_at ?? now })
  }
  return { ciclo, meses, nucleos, acoes, resp }
}
