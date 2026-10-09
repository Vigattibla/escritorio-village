/** Meo, o gato da Turmeo: pixel 14×12, cantos retos. */
export default function Meo({ size = 28, color = '#FFF8EC' }: { size?: number; color?: string }) {
  return (
    <svg className="meo" width={size} height={Math.round(size * 12 / 14)} viewBox="0 0 14 12" shapeRendering="crispEdges" aria-hidden="true">
      <path fill={color} d="M1 0h2v1h-2z M11 0h2v1h-2z M1 1h3v1h-3z M10 1h3v1h-3z M1 2h12v1h-12z M0 3h14v7h-14z M1 10h12v1h-12z" />
      <path fill="#FF9ECF" d="M2 1h1v1h-1z M11 1h1v1h-1z M6 7h2v1h-2z" />
      <path fill="#101014" d="M3 5h2v2h-2z M9 5h2v2h-2z M5 8h1v1h-1z M8 8h1v1h-1z" />
    </svg>
  )
}

export const Wordmark = ({ size = 15 }: { size?: number }) => <b className="wordmark" style={{ fontSize: size }}>turmeo</b>

/** Meo espiando por cima de uma borda (patinhas embaixo). */
export function MeoEspia({ size = 42, color = '#26324F' }: { size?: number; color?: string }) {
  return (
    <svg className="meo" width={size} height={Math.round(size * 10 / 14)} viewBox="0 0 14 10" shapeRendering="crispEdges" aria-hidden="true">
      <path fill={color} d="M1 0h2v1h-2z M11 0h2v1h-2z M1 1h3v1h-3z M10 1h3v1h-3z M1 2h12v1h-12z M0 3h14v7h-14z" />
      <path fill="#FF9ECF" d="M2 1h1v1h-1z M11 1h1v1h-1z M6 7h2v1h-2z" />
      <path fill="#FFF8EC" d="M3 4h2v3h-2z M9 4h2v3h-2z M1 8h3v2h-3z M10 8h3v2h-3z" />
      <path fill="#101014" d="M4 5h1v2h-1z M10 5h1v2h-1z" />
    </svg>
  )
}

/** Meo sentado, encostado na borda da tela: pisca, mexe a orelha e o rabo; chamando = acena; feliz = olhinhos fechados */
export function MeoEncostado({ size = 60, color = '#26324F', mood = 'idle' }: { size?: number; color?: string; mood?: 'idle' | 'chamando' | 'feliz' }) {
  return (
    <svg className={'meo meo-enc ' + mood} width={size} height={size} viewBox="0 0 18 18" shapeRendering="crispEdges" aria-hidden="true">
      <path className="mo-rabo" fill={color} d="M0 15h3v1h-3z M0 12h1v3h-1z M1 11h1v1h-1z" />
      <path fill={color} d="M3 10h12v6h-12z" />
      <path fill="#FFF8EC" d="M7 11h5v4h-5z" opacity=".9" />
      <g className="mo-or-e"><path fill={color} d="M3 0h2v1h-2z M2 1h4v1h-4z" /><path fill="#FF9ECF" d="M3 1h2v1h-2z" /></g>
      <g className="mo-or-d"><path fill={color} d="M13 0h2v1h-2z M12 1h4v1h-4z" /><path fill="#FF9ECF" d="M13 1h2v1h-2z" /></g>
      <path fill={color} d="M2 2h14v1h-14z M1 3h16v6h-16z M2 9h14v1h-14z" />
      {mood === 'feliz'
        ? <path fill="#FFF8EC" d="M4 5h1v1h-1z M5 4h1v1h-1z M6 5h1v1h-1z M11 5h1v1h-1z M12 4h1v1h-1z M13 5h1v1h-1z" />
        : <g className="mo-olhos"><path fill="#FFF8EC" d="M4 4h2v3h-2z M12 4h2v3h-2z" /><path fill="#101014" d="M4 5h1v2h-1z M12 5h1v2h-1z" /></g>}
      <path fill="#FF9ECF" d="M8 7h2v1h-2z" />
      <path className="mo-pata-e" fill={color} d="M4 16h3v2h-3z" />
      <path className="mo-pata-d" fill={color} d="M11 16h3v2h-3z" />
    </svg>
  )
}
