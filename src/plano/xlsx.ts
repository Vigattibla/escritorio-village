/** Leitor mínimo de .xlsx no navegador: zip (DecompressionStream) + XML. Só texto das células e mesclagens. */

export interface Sheet { name: string; cells: Map<string, string>; merges: { r0: number; c0: number; r1: number; c1: number }[] }

const td = new TextDecoder()

async function unzip(buf: ArrayBuffer): Promise<Map<string, Uint8Array>> {
  const u8 = new Uint8Array(buf), dv = new DataView(buf)
  let eocd = -1
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break }
  if (eocd < 0) throw new Error('Arquivo não é uma planilha .xlsx')
  const n = dv.getUint16(eocd + 10, true)
  let p = dv.getUint32(eocd + 16, true)
  const out = new Map<string, Uint8Array>()
  for (let k = 0; k < n; k++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break
    const method = dv.getUint16(p + 10, true), size = dv.getUint32(p + 20, true)
    const nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true)
    const local = dv.getUint32(p + 42, true)
    const name = td.decode(u8.subarray(p + 46, p + 46 + nl))
    p += 46 + nl + xl + cl
    if (!name.endsWith('.xml') && !name.endsWith('.rels')) continue
    const start = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true)
    const raw = u8.subarray(start, start + size)
    if (method === 0) out.set(name, raw)
    else if (method === 8) out.set(name, new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer()))
  }
  return out
}

const xml = (b: Uint8Array | undefined) => new DOMParser().parseFromString(b ? td.decode(b) : '<x/>', 'application/xml')
const kids = (el: Element | Document, tag: string) => Array.from(el.getElementsByTagNameNS('*', tag))

/** 'AK8' → [linha 8, coluna 37] (1-based) */
export function ref(a: string): [number, number] {
  const m = /^([A-Z]+)(\d+)$/.exec(a.replace(/\$/g, ''))
  if (!m) return [0, 0]
  let c = 0
  for (const ch of m[1]) c = c * 26 + ch.charCodeAt(0) - 64
  return [+m[2], c]
}
export const key = (r: number, c: number) => r + ':' + c

export async function readXlsx(file: File | Blob): Promise<Sheet[]> {
  const z = await unzip(await file.arrayBuffer())
  const shared = kids(xml(z.get('xl/sharedStrings.xml')), 'si').map(si => kids(si, 't').map(t => t.textContent ?? '').join(''))
  const rels = new Map(kids(xml(z.get('xl/_rels/workbook.xml.rels')), 'Relationship').map(r => [r.getAttribute('Id') ?? '', r.getAttribute('Target') ?? '']))
  return kids(xml(z.get('xl/workbook.xml')), 'sheet').map(sh => {
    const rid = sh.getAttribute('r:id') ?? sh.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') ?? ''
    const tgt = (rels.get(rid) ?? '').replace(/^\/?xl\//, '').replace(/^\//, '')
    const doc = xml(z.get('xl/' + tgt))
    const cells = new Map<string, string>()
    for (const c of kids(doc, 'c')) {
      const [r, col] = ref(c.getAttribute('r') ?? '')
      const t = c.getAttribute('t')
      const v = kids(c, 'v')[0]?.textContent ?? ''
      const s = t === 's' ? shared[+v] ?? '' : t === 'inlineStr' ? kids(c, 't').map(x => x.textContent ?? '').join('') : v
      if (r && s.trim()) cells.set(key(r, col), s.trim())
    }
    const merges = kids(doc, 'mergeCell').map(m => {
      const [a, b = a] = (m.getAttribute('ref') ?? '').split(':')
      const [r0, c0] = ref(a), [r1, c1] = ref(b)
      return { r0, c0, r1, c1 }
    })
    return { name: sh.getAttribute('name') ?? '', cells, merges }
  })
}
