import type { DFile } from './drive'

/** Drive de mentira pro modo demonstração: pastas e "fotos" desenhadas na hora, tudo em memória. */
const FOLDER = 'application/vnd.google-apps.folder'
const ROOT = 'demo-root'
const dia = (n: number) => new Date(Date.now() - n * 864e5).toISOString()
const pasta = (id: string, name: string, n: number): DFile => ({ id, name, mime: FOLDER, modified: dia(n), thumb: false, link: null, size: 0 })
const foto = (id: string, name: string, n: number, size = 2.4e6): DFile => ({ id, name, mime: 'image/jpeg', modified: dia(n), thumb: true, link: null, size })
const arq = (id: string, name: string, mime: string, n: number, size: number): DFile => ({ id, name, mime, modified: dia(n), thumb: false, link: null, size })

const tree: Record<string, DFile[]> = {
  [ROOT]: [
    pasta('d-camp', 'Campanhas 2026', 2), pasta('d-com', 'Comercial', 5), pasta('d-fotos', 'Fotos do resort', 1), pasta('d-rh', 'RH', 20),
    foto('f-piscina', 'piscina-por-do-sol.jpg', 1), foto('f-chale', 'chale-frente.jpg', 3), foto('f-cafe', 'cafe-da-manha.jpg', 4),
    arq('a-tabela', 'Tabela de tarifas outubro.pdf', 'application/pdf', 2, 840e3), arq('a-video', 'Reels feriado.mp4', 'video/mp4', 6, 48e6),
    arq('a-planilha', 'Ocupação 2026.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 9, 120e3),
  ],
  'd-camp': [pasta('d-crianca', 'Semana das Crianças', 3), foto('f-selo', 'selo-campanha.png', 3, 380e3), arq('a-brief', 'Briefing.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 7, 64e3)],
  'd-crianca': [foto('f-rec1', 'recreacao-1.jpg', 2), foto('f-rec2', 'recreacao-2.jpg', 2), arq('a-story', 'Story 9x16.mp4', 'video/mp4', 2, 12e6)],
  'd-com': [arq('a-apres', 'Apresentação para agências.pdf', 'application/pdf', 5, 6.2e6), foto('f-suite', 'suite-orquidea.jpg', 8), foto('f-lago', 'lago.jpg', 8)],
  'd-fotos': [foto('f-a1', 'aerea-1.jpg', 1, 5.1e6), foto('f-a2', 'aerea-2.jpg', 1, 4.8e6), foto('f-rest', 'restaurante.jpg', 2), foto('f-trilha', 'trilha.jpg', 2), foto('f-spa', 'spa.jpg', 4), foto('f-noite', 'fachada-noite.jpg', 6)],
  'd-rh': [],
}

// cenas desenhadas: céu, sol, chão — cada foto ganha uma paleta pelo nome
const PAL = [['#2440FF', '#FFE14D', '#0B8F5A'], ['#FF7A1A', '#FFF8EC', '#7A3B12'], ['#FF9ECF', '#FFE14D', '#2440FF'], ['#101014', '#FFE14D', '#2440FF'], ['#9FD8FF', '#FF7A1A', '#3E7B3A'], ['#EDE6D8', '#FF7A1A', '#101014']]
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)
function cena(id: string) {
  const h = hash(id), [ceu, sol, chao] = PAL[h % PAL.length], x = 20 + h % 60, y = 18 + (h >> 4) % 22
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 75"><rect width="100" height="75" fill="${ceu}"/><circle cx="${x}" cy="${y}" r="${9 + h % 7}" fill="${sol}"/>`
    + `<path d="M0 ${52 + h % 8} Q30 ${40 + (h >> 3) % 10} 60 ${50 + h % 6} T100 ${46 + (h >> 5) % 8} V75 H0z" fill="${chao}"/><path d="M0 66 Q50 58 100 66 V75 H0z" fill="${chao}" opacity=".6"/></svg>`
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
}

const where = (path: string[]) => path.at(-1) ?? ROOT
const espera = (ms = 350) => new Promise(r => setTimeout(r, ms))

export async function list(path: string[]) { await espera(); return { root: ROOT, files: [...(tree[where(path)] ?? [])], next: null } }
export async function mkdir(path: string[], name: string) {
  const f = pasta('d-' + crypto.randomUUID(), name, 0)
  tree[f.id] = []; (tree[where(path)] ??= []).unshift(f)
  return { ...f, root: ROOT }
}
const enviados = new Map<string, string>()
export async function thumb(_path: string[], id: string) { await espera(150 + hash(id) % 400); return enviados.get(id) ?? cena(id) }
export async function download(_path: string[], f: DFile) {
  const a = document.createElement('a')
  a.href = enviados.get(f.id) ?? (f.thumb ? cena(f.id) : URL.createObjectURL(new Blob(['Arquivo de demonstração: ' + f.name])))
  a.download = f.name; a.click()
}
export async function upload(path: string[], file: File, onProgress: (p: number) => void) {
  for (let i = 1; i <= 10; i++) { await espera(120); onProgress(i / 10) }
  const f: DFile = { id: 'u-' + crypto.randomUUID(), name: file.name, mime: file.type || 'application/octet-stream', modified: new Date().toISOString(), thumb: file.type.startsWith('image/'), link: null, size: file.size }
  if (f.thumb) enviados.set(f.id, URL.createObjectURL(file))
  ;(tree[where(path)] ??= []).push(f)
  return f
}
