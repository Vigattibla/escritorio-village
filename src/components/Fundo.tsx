import { useLayoutEffect, useRef, type HTMLAttributes } from 'react'
import { createPortal } from 'react-dom'

/** se o navegador (extensão, modo escuro forçado, aba restaurada…) prender o fundo numa caixa menor que a tela, corrige em px */
export function useTelaCheia<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const fit = () => {
      el.style.removeProperty('top'); el.style.removeProperty('left'); el.style.removeProperty('width'); el.style.removeProperty('height'); el.style.removeProperty('right'); el.style.removeProperty('bottom')
      const vv = window.visualViewport
      const W = vv?.width ?? window.innerWidth, H = vv?.height ?? window.innerHeight
      const r = el.getBoundingClientRect()
      if (Math.abs(r.top) < 2 && Math.abs(r.left) < 2 && Math.abs(r.height - H) < 2 && Math.abs(r.width - W) < 2) return
      const cs = getComputedStyle(el)
      el.style.top = `${(parseFloat(cs.top) || 0) - r.top}px`; el.style.left = `${(parseFloat(cs.left) || 0) - r.left}px`
      el.style.right = 'auto'; el.style.bottom = 'auto'; el.style.width = `${W}px`; el.style.height = `${H}px`
    }
    fit()
    const t = window.setTimeout(fit, 120)
    window.addEventListener('resize', fit); window.visualViewport?.addEventListener('resize', fit)
    return () => { window.clearTimeout(t); window.removeEventListener('resize', fit); window.visualViewport?.removeEventListener('resize', fit) }
  }, [])
  return ref
}

/** fundo de janela: sempre no body, pra nenhum ancestral (transform, filter…) prender ou espremer a janela */
export function Fundo(p: HTMLAttributes<HTMLDivElement>) {
  const ref = useTelaCheia<HTMLDivElement>()
  return createPortal(<div ref={ref} {...p} />, document.body)
}
