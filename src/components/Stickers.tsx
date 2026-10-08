import { useState } from 'react'
import { rankOf } from '../game/ranks'
import { dropRow, me, putRow, run, setUi, team, useStore } from '../store'
import type { Sticker, StickerKind } from '../types'
import Icon, { Ph } from './Icon'
import MiniAvatar from './MiniAvatar'
import { first, hm, KIND_KEYS, KINDS } from './v4'

export const canStick = () => rankOf(me()) >= 2

/** Adesivos colados na minha tela: arrasto para tirar da frente, fecho quando quiser. */
export function StickerLayer({ inline = false }: { inline?: boolean }) {
  const meId = useStore(s => s.meId)
  const rows = useStore(s => s.rows.stickers)
  const profiles = useStore(s => s.profiles)
  const [drag, setDrag] = useState<{ id: string; ox: number; oy: number; x: number; y: number } | null>(null)
  const mine = Object.values(rows).filter(s => s.to_id === meId).sort((a, b) => a.created_at.localeCompare(b.created_at))
  if (!mine.length) return null
  const W = window.innerWidth, H = window.innerHeight
  const clamp = (v: number) => Math.min(0.95, Math.max(0.02, v))
  return (
    <div className={inline ? 'stk-inline' : 'stk-layer'}>
      {mine.map((s, i) => {
        const k = KINDS[s.kind] ?? KINDS.recorde
        const x = drag?.id === s.id ? drag.x : s.x, y = drag?.id === s.id ? drag.y : s.y
        return (
          <div
            key={s.id} className={'sticker' + (drag?.id === s.id ? ' drag' : '')} style={inline ? { background: k.bg } : { left: `clamp(8px, calc(${x * 100}% - 110px), calc(100% - 236px))`, top: `clamp(8px, calc(${y * 100}% - 40px), calc(100% - 180px))`, background: k.bg, '--r': `${(i % 3) * 4 - 6}deg` } as React.CSSProperties}
            onPointerDown={e => { if (inline || (e.target as HTMLElement).closest('button')) return; e.currentTarget.setPointerCapture(e.pointerId); setDrag({ id: s.id, ox: e.clientX / W - s.x, oy: e.clientY / H - s.y, x: s.x, y: s.y }) }}
            onPointerMove={e => drag?.id === s.id && setDrag({ ...drag, x: clamp(e.clientX / W - drag.ox), y: clamp(e.clientY / H - drag.oy) })}
            onPointerUp={() => { if (drag && (drag.x !== s.x || drag.y !== s.y)) run(putRow('stickers', { ...s, x: drag.x, y: drag.y })); setDrag(null) }}
          >
            <span className="st-ic"><Ph n={k.ic} size={24} fill /></span>
            <div>{s.text}<small>{first(profiles[s.by_id])} colou aqui · {hm(s.created_at)}</small></div>
            <button className="x" onClick={() => run(dropRow('stickers', s.id))} aria-label="Tirar adesivo" title="Tirar adesivo"><Icon n="x" size={14} /></button>
          </div>
        )
      })}
    </div>
  )
}

/** Escolher adesivo, para quem e onde ele fica na tela da pessoa. */
export function StickerPicker() {
  const to = useStore(s => s.stickTo)
  const meId = useStore(s => s.meId)!
  const profiles = useStore(s => s.profiles)
  const [kind, setKind] = useState<StickerKind>('mandou-bem')
  const [text, setText] = useState('')
  const [who, setWho] = useState('')
  const [pos, setPos] = useState({ x: 0.72, y: 0.75 })
  if (to === null) return null
  const target = who || to
  const people = team(profiles).filter(p => p.avatar && p.id !== meId)
  const close = () => { setUi({ stickTo: null }); setText(''); setWho('') }
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!target) return
    const st: Sticker = { id: crypto.randomUUID(), to_id: target, by_id: meId, kind, text: text.trim() || KINDS[kind].label, x: pos.x, y: pos.y, created_at: new Date().toISOString() }
    run(putRow('stickers', st))
    close()
  }
  return (
    <div className="modal-bg" onMouseDown={e => e.target === e.currentTarget && close()} onKeyDown={e => e.key === 'Escape' && close()}>
      <form className="modal stk-modal" onSubmit={submit}>
        <h2>Colar adesivo</h2>
        <div className="stk-grid">
          {KIND_KEYS.map(k => (
            <button type="button" key={k} className={'stk' + (kind === k ? ' on' : '')} style={{ background: KINDS[k].bg }} onClick={() => setKind(k)}>
              <Ph n={KINDS[k].ic} size={22} fill />{KINDS[k].label}
            </button>
          ))}
        </div>
        <label>Recado (opcional)<input maxLength={60} value={text} onChange={e => setText(e.target.value)} placeholder={KINDS[kind].label} /></label>
        <div className="paste">Colar na tela de
          <div className="pk-faces">
            {people.map(p => (
              <button type="button" key={p.id} className={target === p.id ? 'on' : ''} onClick={() => setWho(p.id)} title={p.name}>
                <MiniAvatar avatar={p.avatar} photo={p.photo} name={p.name} size={30} />
              </button>
            ))}
          </div>
        </div>
        <div className="mini-screen" onClick={e => { const r = e.currentTarget.getBoundingClientRect(); setPos({ x: Math.min(0.9, Math.max(0.1, (e.clientX - r.left) / r.width)), y: Math.min(0.9, Math.max(0.1, (e.clientY - r.top) / r.height)) }) }}>
          <i className="ln" style={{ top: 16, width: 90 }} /><i className="ln" style={{ top: 34, width: 60 }} /><i className="ln" style={{ top: 58, width: 100 }} />
          <div className="ghost" style={{ left: `${pos.x * 100}%`, top: `${pos.y * 100}%`, background: KINDS[kind].bg }}>{text.trim() || KINDS[kind].label}</div>
        </div>
        <small className="muted">Clique na telinha para escolher onde fica. A pessoa pode arrastar ou tirar.</small>
        <footer className="row gap end">
          <button type="button" className="btn ghost" onClick={close}>Cancelar</button>
          <button className="btn primary" disabled={!target}>Colar{target ? ` para ${first(profiles[target])}` : ''}</button>
        </footer>
      </form>
    </div>
  )
}
