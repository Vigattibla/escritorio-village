import { useState } from 'react'
import { Ph } from './Icon'
import { confirmar } from './Dialogo'

/** Windows: widget de tarefas no canto da tela (repo turmeo-widget; o exe se instala sozinho, sem admin) */
export const windows = /Windows NT/.test(navigator.userAgent) && !/Mobi|Android/.test(navigator.userAgent)
const KEY = 'ev:widgetAviso'
export async function baixarWidget() {
  if (!await confirmar('Turmeo no canto da tela', { text: 'Um programinha que mostra suas tarefas no canto do Windows e avisa quando chega pedido novo. Baixe, abra o Turmeo.exe e entre com a sua conta. Se o Windows avisar "protegeu o computador", clique em Mais informações → Executar assim mesmo. Pra tirar: menu ⋯ do widget → Desinstalar.', ok: 'Baixar', ic: 'download-simple' })) return
  try { localStorage.setItem(KEY, '1') } catch { /* sem storage */ }
  location.href = new URL('app/Turmeo.exe', location.href.split(/[?#]/)[0]).href
}

/** cartãozinho no canto, uma vez por aparelho; some ao baixar ou fechar */
export default function WidgetAviso() {
  const [on, setOn] = useState(() => { try { return windows && !localStorage.getItem(KEY) } catch { return false } })
  if (!on) return null
  const fechar = () => { try { localStorage.setItem(KEY, '1') } catch { /* sem storage */ } setOn(false) }
  return (
    <div className="wdg-aviso" role="status">
      <Ph n="download-simple" size={22} />
      <span className="grow"><b>Turmeo no canto da tela</b><small>Veja suas tarefas e receba avisos no Windows, sem abrir o site.</small></span>
      <button className="btn primary sm" onClick={() => void baixarWidget().then(() => { try { if (localStorage.getItem(KEY)) setOn(false) } catch { /* */ } })}>Baixar</button>
      <button className="iconbtn" onClick={fechar} aria-label="Agora não" title="Agora não"><Ph n="x" size={16} /></button>
    </div>
  )
}
