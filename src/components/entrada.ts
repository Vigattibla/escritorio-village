import { stageList } from '../store'
import { conferir } from './Dialogo'

/** Etapa com critérios: quem move confirma o checklist antes. true = pode entrar. */
export async function podeEntrar(id: string | null | undefined) {
  const s = id ? stageList().find(x => x.id === id) : undefined
  const c = (s?.criteria ?? []).filter(Boolean)
  if (!s || !c.length) return true
  return conferir(`Entrar em “${s.label}”`, c, { text: 'Confirme os critérios da etapa.' })
}
