import { backend } from '.'
import { SupabaseBackend } from './supabase'

export interface DFile { id: string; name: string; mime: string; modified: string; thumb: boolean; link: string | null; size: number }
export const FOLDER = 'application/vnd.google-apps.folder'
export const driveOn = backend instanceof SupabaseBackend
const FN = (import.meta.env.VITE_SUPABASE_URL as string) + '/functions/v1/drive'

async function call(body: object) {
  if (!(backend instanceof SupabaseBackend)) throw new Error('O Drive só funciona no site oficial.')
  const r = await fetch(FN, { method: 'POST', headers: { Authorization: 'Bearer ' + await backend.token(), apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    .catch(() => { throw new Error('Não consegui falar com o Drive. Confira a internet.') })
  if (!r.ok) throw new Error((await r.json().catch(() => null))?.error ?? `Drive indisponível (${r.status}).`)
  return r
}

export async function list(path: string[], page?: string) {
  return (await call({ a: 'list', path, page })).json() as Promise<{ root: string; files: DFile[]; next: string | null }>
}
export async function mkdir(path: string[], name: string) {
  return (await call({ a: 'mkdir', path, name })).json() as Promise<DFile>
}

// miniaturas: no máximo 4 de cada vez, guardadas enquanto a página estiver aberta
const thumbs = new Map<string, Promise<string>>()
let busy = 0
const waiting: (() => void)[] = []
export function thumb(path: string[], id: string, px = 400) {
  const k = id + '@' + px
  if (!thumbs.has(k)) {
    const p = (async () => {
      if (busy >= 4) await new Promise<void>(r => waiting.push(r))
      busy++
      try { return URL.createObjectURL(await (await call({ a: 'thumb', path, id, px })).blob()) }
      finally { busy--; waiting.shift()?.() }
    })()
    p.catch(() => thumbs.delete(k))
    thumbs.set(k, p)
  }
  return thumbs.get(k)!
}

export async function download(path: string[], f: DFile) {
  const r = await call({ a: 'file', path, id: f.id })
  const name = decodeURIComponent(r.headers.get('content-disposition')?.match(/filename\*=UTF-8''(.+)$/)?.[1] ?? encodeURIComponent(f.name))
  const a = document.createElement('a')
  a.href = URL.createObjectURL(await r.blob())
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 60_000)
}

/** pede a sessão de envio e manda o arquivo direto pro Google, avisando o progresso (0–1) */
export async function upload(path: string[], file: File, onProgress: (p: number) => void) {
  const { url } = await (await call({ a: 'upload', path, name: file.name, mime: file.type, size: file.size })).json()
  return new Promise<DFile>((ok, fail) => {
    const x = new XMLHttpRequest()
    x.open('PUT', url)
    x.upload.onprogress = e => e.lengthComputable && onProgress(e.loaded / e.total)
    x.onload = () => {
      if (x.status >= 300) return fail(new Error(`O Drive recusou "${file.name}" (${x.status}).`))
      const g = JSON.parse(x.responseText)
      ok({ id: g.id, name: g.name, mime: g.mimeType, modified: g.modifiedTime, thumb: !!g.thumbnailLink, link: g.webViewLink ?? null, size: Number(g.size ?? file.size) })
    }
    x.onerror = () => fail(new Error(`Falhou o envio de "${file.name}". Confira a internet.`))
    x.send(file)
  })
}

export const isImage = (f: DFile) => f.mime.startsWith('image/')
export const kb = (n: number) => (n < 1e6 ? Math.max(1, Math.round(n / 1e3)) + ' KB' : n < 1e9 ? (n / 1e6).toFixed(1).replace('.', ',') + ' MB' : (n / 1e9).toFixed(1).replace('.', ',') + ' GB')
