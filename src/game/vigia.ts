/** vigia dos jogos: espelho de supabase/migrations/202610231000_jogos_vigia.sql (a demo usa daqui).
 *  ritmo de robô ou maratona sem pausa bloqueia jogos, cassino e bingo por um tempo. */
export type Motivo = 'ritmo' | 'seguido' | 'dia'
export interface Bloqueio { ate: string; motivo: Motivo }

export const MARCA = 'BLOQUEIO_JOGOS'
const MIN = 60_000

const minutos = (ts: number[]) => new Set(ts.map(t => Math.floor(t / MIN))).size
/** dia em São Paulo (UTC-3, sem horário de verão) */
const diaSP = (t: number) => Math.floor((t - 3 * 3600_000) / 86400_000)

/** ts = partidas aceitas (ms); null = liberado; limiteDia em minutos (conta do cassino: 480) */
export function vigiar(ts: number[], agora = Date.now(), limiteDia = 240): Bloqueio | null {
  if (!ts.length) return null
  const l = Math.max(...ts)
  let ate = 0, motivo: Motivo = 'ritmo'
  if (ts.filter(t => t > l - MIN).length >= 25) { ate = l + 3600_000; motivo = 'ritmo' }
  if (minutos(ts.filter(t => t > l - 120 * MIN)) >= 100 && l + 3 * 3600_000 > ate) { ate = l + 3 * 3600_000; motivo = 'seguido' }
  const d = diaSP(l), fim = (d + 1) * 86400_000 + 3 * 3600_000 + 6 * 3600_000
  if (minutos(ts.filter(t => diaSP(t) === d)) >= limiteDia && fim > ate) { ate = fim; motivo = 'dia' }
  return ate > agora ? { ate: new Date(ate).toISOString(), motivo } : null
}

export const erroBloqueio = (b: Bloqueio) => new Error(`${MARCA}|${b.ate}|${b.motivo}`)

/** lê a marca que o servidor (ou a demo) põe no erro */
export function lerBloqueio(e: unknown): Bloqueio | null {
  const m = String((e as Error)?.message ?? '').match(new RegExp(`${MARCA}\\|([^|]+)\\|(\\w+)`))
  return m ? { ate: new Date(m[1]).toISOString(), motivo: m[2] as Motivo } : null
}

export const MOTIVO: Record<Motivo, string> = {
  ritmo: 'partidas rápidas demais, em ritmo de robô',
  seguido: 'jogo quase sem pausa por 2 horas seguidas',
  dia: 'jogo demais no mesmo dia (passou do limite de horas)',
}
