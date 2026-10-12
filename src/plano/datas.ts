/** Coluna "D" da planilha → início e prazo da tarefa. Ex.: '10', '1-10', '9 e 27', '30-02', '1ª SEG', 'última SEX', 'diário'. */

const DOW: Record<string, number> = { dom: 0, seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sab: 6, 'sáb': 6 }
const pad = (n: number) => String(n).padStart(2, '0')
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const fimDoMes = (y: number, m: number) => new Date(y, m, 0).getDate() // m 1-based

export const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
export const nomeMes = (mes: string, curto = false) => {
  const [y, m] = mes.split('-').map(Number)
  const n = MESES[m - 1] ?? mes
  return curto ? n.slice(0, 3) : `${n} ${y}`
}
export const somaMes = (mes: string, k: number) => {
  const [y, m] = mes.split('-').map(Number)
  const d = new Date(y, m - 1 + k, 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

/** n-ésimo dia da semana do mês (n = -1: o último) */
function nth(y: number, m: number, dow: number, n: number) {
  if (n < 0) {
    const d = new Date(y, m, 0)
    while (d.getDay() !== dow) d.setDate(d.getDate() - 1)
    return d
  }
  const d = new Date(y, m - 1, 1)
  while (d.getDay() !== dow) d.setDate(d.getDate() + 1)
  d.setDate(d.getDate() + 7 * (n - 1))
  return d
}

export function parseDia(dia: string, mes: string): { start: string; due: string } {
  const [y, m] = mes.split('-').map(Number)
  const last = fimDoMes(y, m)
  const todo = { start: `${mes}-01`, due: `${mes}-${pad(last)}` }
  const s = dia.trim().toLowerCase()
  if (!s) return todo
  const wd = Object.keys(DOW).find(k => new RegExp(`\\b${k}`).test(s))
  if (wd !== undefined) {
    if (/toda|semanal/.test(s)) return todo
    const ords = s.includes('últim') ? [-1] : [...s.matchAll(/(\d)\s*[ªa°º]/g)].map(x => +x[1])
    if (!ords.length) return todo
    const ds = ords.map(n => nth(y, m, DOW[wd], n)).filter(d => d.getMonth() === m - 1)
    return ds.length ? { start: iso(ds[0]), due: iso(ds[ds.length - 1]) } : todo
  }
  if (/diári|semanal|todo|mês|mes/.test(s)) return todo
  const nums = [...s.matchAll(/\d{1,2}/g)].map(x => +x[0]).filter(n => n >= 1 && n <= 31)
  if (!nums.length) return todo
  const a = Math.min(nums[0], last), b = nums[nums.length - 1]
  const start = `${mes}-${pad(a)}`
  if (b < a) return { start, due: `${somaMes(mes, 1)}-${pad(b)}` } // '30-02': vira o mês
  return { start, due: `${mes}-${pad(Math.min(b, last))}` }
}
