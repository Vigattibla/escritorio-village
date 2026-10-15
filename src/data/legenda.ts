import { backend } from '.'
import { SupabaseBackend } from './supabase'

export type Formato = 'reel' | 'carrossel' | 'stories' | 'post'
export interface Marca { id: string; nome: string; guia: string; updated_at?: string }
export interface Opcao { titulo: string; legenda: string; hashtags: string[] }
export interface Midia { mime: string; data: string }
export interface Preparado { midia: Midia[]; video: boolean; duracao?: number; previas: string[] }

const FN = (import.meta.env.VITE_SUPABASE_URL as string) + '/functions/v1/legenda'
const demo = () => !(backend instanceof SupabaseBackend)

async function chama<T>(path: string, body?: unknown): Promise<T> {
  const r = await fetch(FN + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Authorization: 'Bearer ' + await (backend as SupabaseBackend).token(), apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).catch(() => { throw new Error('Não consegui falar com a IA. Confira a internet.') })
  const j = await r.json().catch(() => null)
  if (!r.ok) throw new Error(j?.error ?? `IA indisponível (${r.status}).`)
  return j as T
}

const GUIA_DEMO = 'MARCA: MeuDestino — clube de férias.\nVOZ: "você", frases curtas, números concretos.\n(no demo o guia é só de exemplo)'
let guiaDemo = GUIA_DEMO

export async function marcas(): Promise<Marca[]> {
  if (demo()) return [{ id: 'meudestino', nome: 'MeuDestino', guia: guiaDemo }]
  return (await chama<{ marcas: Marca[] }>('')).marcas
}

export async function salvarGuia(marca: string, guia: string) {
  if (demo()) { guiaDemo = guia; return }
  await chama('/guia', { marca, guia })
}

export async function gerar(b: { marca: string; formato: Formato; contexto?: string; ajuste?: string; anterior?: string; prep?: Preparado }) {
  const { prep, ...resto } = b
  if (demo()) {
    await new Promise(r => setTimeout(r, 2500))
    const ex = (t: string, l: string): Opcao => ({ titulo: t, legenda: l, hashtags: ['#meudestino', '#feriasemfamilia', '#resort'] })
    return {
      resumo: prep?.video ? 'Vídeo de exemplo.' : 'Peça de exemplo.',
      opcoes: [
        ex('Cena de férias', 'Piscina cheia, agenda vazia.\nA viagem já está paga e o valor já está travado.\nVocê só escolhe a data.\n\nConheça em meudestino.com'),
        ex('Número concreto', '7 diárias por ano, com data garantida.\nSem renegociar preço a cada temporada.\n\nLink na bio.'),
        ex('Curiosidade', 'E se a próxima viagem já estivesse resolvida?\nNo MeuDestino você assina, paga por mês e escolhe quando ir.\n\nChama no direct.'),
      ] as Opcao[],
    }
  }
  return chama<{ resumo: string; opcoes: Opcao[] }>('', { ...resto, midia: prep?.midia ?? [], video: !!prep?.video, duracao: prep?.duracao })
}

// ——— preparo da mídia no navegador: nada de subir o arquivo inteiro ———

const b64 = (u8: Uint8Array) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return btoa(s) }
const semPrefixo = (url: string) => url.slice(url.indexOf(',') + 1)

function quadro(src: CanvasImageSource, w: number, h: number, lado = 768) {
  const k = Math.min(1, lado / Math.max(w, h))
  const c = document.createElement('canvas')
  c.width = Math.round(w * k); c.height = Math.round(h * k)
  c.getContext('2d')!.drawImage(src, 0, 0, c.width, c.height)
  return c.toDataURL('image/jpeg', 0.8)
}

async function imagem(f: File) {
  const url = URL.createObjectURL(f)
  try {
    const img = new Image(); img.src = url; await img.decode()
    return quadro(img, img.naturalWidth, img.naturalHeight, 1024)
  } finally { URL.revokeObjectURL(url) }
}

/** áudio do vídeo em WAV 16 kHz mono, até `max` segundos. Sem trilha (ou formato que o navegador não lê) → null */
async function audioWav(f: File, max = 120): Promise<string | null> {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    const buf = await ctx.decodeAudioData(await f.arrayBuffer()).finally(() => ctx.close())
    const n = Math.min(buf.duration, max) * 16000 | 0
    const off = new OfflineAudioContext(1, n, 16000)
    const s = off.createBufferSource(); s.buffer = buf; s.connect(off.destination); s.start()
    const pcm = (await off.startRendering()).getChannelData(0)
    let pico = 0; for (let i = 0; i < pcm.length; i += 64) pico = Math.max(pico, Math.abs(pcm[i]))
    if (pico < 0.005) return null
    const out = new DataView(new ArrayBuffer(44 + pcm.length * 2))
    const str = (o: number, t: string) => { for (let i = 0; i < t.length; i++) out.setUint8(o + i, t.charCodeAt(i)) }
    str(0, 'RIFF'); out.setUint32(4, 36 + pcm.length * 2, true); str(8, 'WAVE'); str(12, 'fmt ')
    out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 1, true)
    out.setUint32(24, 16000, true); out.setUint32(28, 32000, true); out.setUint16(32, 2, true); out.setUint16(34, 16, true)
    str(36, 'data'); out.setUint32(40, pcm.length * 2, true)
    for (let i = 0; i < pcm.length; i++) out.setInt16(44 + i * 2, Math.max(-1, Math.min(1, pcm[i])) * 0x7fff, true)
    return b64(new Uint8Array(out.buffer))
  } catch { return null }
}

async function video(f: File, aviso: (t: string) => void, n = 12): Promise<Preparado> {
  const url = URL.createObjectURL(f)
  const v = document.createElement('video')
  v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url
  try {
    await new Promise<void>((ok, erro) => { v.onloadeddata = () => ok(); v.onerror = () => erro(new Error('O navegador não abriu esse vídeo. Tente exportar em MP4.')) })
    let dur = v.duration
    if (!isFinite(dur)) { v.currentTime = 1e9; await new Promise(ok => { v.onseeked = ok }); dur = v.duration } // webm gravado no navegador vem sem duração
    const previas: string[] = []
    for (let i = 0; i < n; i++) {
      aviso(`Lendo o vídeo: quadro ${i + 1} de ${n}`)
      v.currentTime = Math.min(dur - 0.05, (dur * (i + 0.5)) / n)
      await new Promise(ok => { v.onseeked = ok })
      previas.push(quadro(v, v.videoWidth, v.videoHeight))
    }
    aviso('Separando o áudio')
    const wav = await audioWav(f)
    const midia: Midia[] = previas.map(p => ({ mime: 'image/jpeg', data: semPrefixo(p) }))
    if (wav) midia.push({ mime: 'audio/wav', data: wav })
    return { midia, video: true, duracao: dur, previas }
  } finally { URL.revokeObjectURL(url) }
}

/** transforma os arquivos escolhidos em quadros/áudio leves pra mandar pra IA */
export async function preparar(arquivos: File[], aviso: (t: string) => void): Promise<Preparado> {
  const vid = arquivos.find(f => f.type.startsWith('video/'))
  if (vid) return video(vid, aviso)
  const imgs = arquivos.filter(f => f.type.startsWith('image/')).slice(0, 10)
  const previas: string[] = []
  for (const [i, f] of imgs.entries()) { aviso(`Preparando imagem ${i + 1} de ${imgs.length}`); previas.push(await imagem(f)) }
  return { midia: previas.map(p => ({ mime: 'image/jpeg', data: semPrefixo(p) })), video: false, previas }
}
