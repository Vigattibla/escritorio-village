import { useEffect, useRef } from 'react'
import { DEFAULT_AVATAR, drawAvatar, onPhotoLoad } from '../chibi/sprite'
import type { Avatar } from '../types'

const TINTS = ['#0B235D', '#C2410C', '#047857', '#7C3AED', '#B91C1C', '#0E7490', '#A16207', '#BE185D']
const initials = (name: string) => {
  const w = name.trim().split(/\s+/).filter(Boolean)
  return ((w[0]?.[0] ?? '') + (w.length > 1 ? w[w.length - 1][0] : '')).toUpperCase() || '?'
}
const tint = (name: string) => TINTS[[...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % TINTS.length]

/** Busto do chibi (cabeça + tronco), escalado em pixels inteiros. Quem ainda não montou o boneco aparece com as iniciais. */
export default function MiniAvatar({ avatar, photo, size = 36, dim = false, name }: { avatar: Avatar | null; photo: string | null; size?: number; dim?: boolean; name?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const blank = !avatar && !photo && !!name
  useEffect(() => {
    if (blank) return
    const cv = ref.current!
    const draw = () => {
      const dpr = window.devicePixelRatio || 1
      cv.width = cv.height = Math.round(size * dpr)
      const ctx = cv.getContext('2d')!
      const k = (size * dpr) / 20
      ctx.setTransform(k, 0, 0, k, 0, 0)
      ctx.imageSmoothingEnabled = false
      drawAvatar(ctx, avatar ?? DEFAULT_AVATAR, photo, 2, 0.5, 'down', 0)
    }
    draw()
    return photo ? onPhotoLoad(photo, draw) : undefined
  }, [avatar, photo, size, blank])
  if (blank) return <span className={'mini-av mini-ini' + (dim ? ' dim' : '')} title={`${name} ainda não montou o personagem`} style={{ width: size, height: size, background: tint(name!), fontSize: Math.max(8, Math.round(size * 0.4)) }}>{initials(name!)}</span>
  return <canvas ref={ref} className={'mini-av' + (dim ? ' dim' : '')} style={{ width: size, height: size }} />
}
