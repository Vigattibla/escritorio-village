import { useEffect, useRef } from 'react'
import { DEFAULT_AVATAR, drawAvatar, onPhotoLoad } from '../chibi/sprite'
import type { Avatar } from '../types'

/** Busto do chibi (cabeça + tronco), escalado em pixels inteiros. */
export default function MiniAvatar({ avatar, photo, size = 36, dim = false }: { avatar: Avatar | null; photo: string | null; size?: number; dim?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
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
  }, [avatar, photo, size])
  return <canvas ref={ref} className={'mini-av' + (dim ? ' dim' : '')} style={{ width: size, height: size }} />
}
