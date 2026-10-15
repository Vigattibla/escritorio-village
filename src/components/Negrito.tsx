// Negrito nos textos: Ctrl+B na seleção de qualquer campo de texto envolve com **…**
// (aperta de novo pra tirar). Na exibição, <Negrito> mostra o trecho em negrito.

if (typeof document !== 'undefined') {
  document.addEventListener('keydown', e => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey || e.key.toLowerCase() !== 'b') return
    const el = e.target
    if (!(el instanceof HTMLTextAreaElement) || el.readOnly || el.disabled) return
    e.preventDefault()
    const { selectionStart: a, selectionEnd: b, value: v } = el
    const sel = v.slice(a, b)
    if (sel.startsWith('**') && sel.endsWith('**') && sel.length >= 4) {
      troca(el, a, b, sel.slice(2, -2), a, b - 4)
    } else if (v.slice(a - 2, a) === '**' && v.slice(b, b + 2) === '**') {
      troca(el, a - 2, b + 2, sel, a - 2, b - 2)
    } else {
      troca(el, a, b, `**${sel}**`, a + 2, b + 2)
    }
  })
}

// execCommand mantém o Ctrl+Z e dispara o onChange do React
function troca(el: HTMLTextAreaElement, a: number, b: number, txt: string, s0: number, s1: number) {
  el.setSelectionRange(a, b)
  if (!document.execCommand('insertText', false, txt)) el.setRangeText(txt, a, b)
  el.setSelectionRange(s0, s1)
}

export default function Negrito({ text }: { text: string }) {
  const partes = text.split(/\*\*([^*][\s\S]*?)\*\*/g)
  if (partes.length === 1) return <>{text}</>
  return <>{partes.map((p, i) => (i % 2 ? <b key={i}>{p}</b> : p))}</>
}
