import { PH, type PhName } from './ph'
/** Ícones de traço (desenhos do Lucide, licença ISC). */
const P = {
  board: <><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M8 7v7M12 7v4M16 7v9" /></>,
  office: <><rect width="16" height="20" x="4" y="2" rx="2" /><path d="M9 22v-4h6v4M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01" /></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
  bell: <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></>,
  chat: <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />,
  check: <><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></>,
  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5M21 12H9" /></>,
  plus: <path d="M5 12h14M12 5v14" />,
  search: <><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></>,
  sparkles: <path d="M9.94 15.5a2 2 0 0 0-1.44-1.44l-6.13-1.58a.5.5 0 0 1 0-.96L8.5 9.94A2 2 0 0 0 9.94 8.5l1.58-6.14a.5.5 0 0 1 .96 0l1.58 6.14a2 2 0 0 0 1.44 1.44l6.14 1.58a.5.5 0 0 1 0 .96l-6.14 1.58a2 2 0 0 0-1.44 1.44l-1.58 6.14a.5.5 0 0 1-.96 0z" />,
  calendar: <><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>,
  user: <><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>,
  folder: <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />,
  x: <path d="M18 6 6 18M6 6l12 12" />,
  chart: <path d="M3 3v18h18M18 17V9M13 17V5M8 17v-3" />,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  cols: <><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M9 3v18M15 3v18" /></>,
  rows: <><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M3 9h18M3 15h18" /></>,
  play: <path d="M6 3 20 12 6 21Z" />,
  pause: <><rect x="14" y="4" width="4" height="16" rx="1" /><rect x="6" y="4" width="4" height="16" rx="1" /></>,
  trash: <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />,
  clock: <><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>,
  clip: <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />,
  send: <><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></>,
  minus: <path d="M5 12h14" />,
  locate: <><path d="M2 12h3M19 12h3M12 2v3M12 19v3" /><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="3" /></>,
  tick: <path d="M20 6 9 17l-5-5" />,
  flag: <path d="M4 22V4M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1" />,
  list: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
  alarm: <><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2 2M5 3 2 6M22 6l-3-3" /></>,
}
export type IconName = keyof typeof P

export default function Icon({ n, size = 16 }: { n: IconName; size?: number }) {
  return (
    <svg className="ic" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {P[n]}
    </svg>
  )
}

/** Ícone de área (Phosphor): duotone parado, cheio quando ativo. */
export function Ph({ n, size = 20, fill = false }: { n: PhName; size?: number; fill?: boolean }) {
  return <svg className="ph" width={size} height={size} viewBox="0 0 256 256" fill="currentColor" aria-hidden="true" dangerouslySetInnerHTML={{ __html: PH[n][fill ? 1 : 0] }} />
}
