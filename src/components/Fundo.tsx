import type { HTMLAttributes } from 'react'
import { createPortal } from 'react-dom'

/** fundo de janela: sempre no body, pra nenhum ancestral (transform, filter…) prender ou espremer a janela */
export function Fundo(p: HTMLAttributes<HTMLDivElement>) {
  return createPortal(<div {...p} />, document.body)
}
