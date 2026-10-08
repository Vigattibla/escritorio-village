import { run, setDeptLook } from '../store'
import { EMBLEMA_KEYS, EMBLEMAS } from '../office/bandeira'
import type { Dept } from '../types'

/** emblema da bandeira em SVG (mesmo desenho do pixel do andar) */
export function Emblema({ k, size = 15, color = 'currentColor' }: { k: string; size?: number; color?: string }) {
  const e = EMBLEMAS[k]
  if (!e) return null
  return (
    <svg width={size} height={size} viewBox="0 0 5 5" shapeRendering="crispEdges" aria-hidden>
      {e.px.flatMap((row, j) => [...row].map((ch, i) => (ch === '#' ? <rect key={`${i}-${j}`} x={i} y={j} width={1} height={1} fill={color} /> : null)))}
    </svg>
  )
}

/** escolha da bandeira que fica pendurada na porta da sala */
export function FlagPicker({ d }: { d: Dept }) {
  const cur = d.flag ?? null
  return (
    <div className="flagpick" role="radiogroup" aria-label="Bandeira da porta">
      <button type="button" role="radio" aria-checked={!cur} className={!cur ? 'on' : ''} title="Lisa" onClick={() => run(setDeptLook(d.id, { flag: null }))}><i style={{ background: d.color }} /></button>
      {EMBLEMA_KEYS.map(k => (
        <button type="button" role="radio" aria-checked={cur === k} key={k} className={cur === k ? 'on' : ''} title={EMBLEMAS[k].label} onClick={() => run(setDeptLook(d.id, { flag: k }))}>
          <Emblema k={k} />
        </button>
      ))}
    </div>
  )
}
