import { useEffect, useRef } from 'react'

type C2D = CanvasRenderingContext2D

/** canvas pixelado; draw recebe o tempo pra animar; z = zoom só de CSS (miniaturas) */
export function Px({ w, h, s, draw, className, z = 1 }: { w: number; h: number; s: number; draw: (c: C2D, t: number) => void; className?: string; z?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const fn = useRef(draw)
  fn.current = draw
  useEffect(() => {
    let id = 0
    const tick = (t: number) => {
      const c = ref.current?.getContext('2d')
      if (c) { c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, w * s, h * s); c.imageSmoothingEnabled = false; c.setTransform(s, 0, 0, s, 0, 0); fn.current(c, t) }
      id = requestAnimationFrame(tick)
    }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [w, h, s])
  return <canvas ref={ref} width={w * s} height={h * s} className={className} style={{ width: w * s * z, height: h * s * z, imageRendering: 'pixelated' }} />
}
