import { useLayoutEffect, useRef } from 'react'

/** Pílula escura que desliza até o botão ativo do .seg (vai como filho do próprio .seg). */
export default function SegInd() {
  const r = useRef<HTMLElement>(null)
  useLayoutEffect(() => {
    const ind = r.current, seg = ind?.parentElement
    if (!ind || !seg) return
    const place = () => {
      const on = seg.querySelector<HTMLElement>(':scope > button.on')
      ind.style.opacity = on ? '1' : '0'
      if (on) { ind.style.transform = `translateX(${on.offsetLeft}px)`; ind.style.width = on.offsetWidth + 'px' }
    }
    place()
    // primeira colocação sem deslizar; depois anima
    requestAnimationFrame(() => ind.classList.add('ready'))
    const ro = new ResizeObserver(place); ro.observe(seg)
    return () => ro.disconnect()
  })
  return <i ref={r} className="seg-ind" aria-hidden />
}
