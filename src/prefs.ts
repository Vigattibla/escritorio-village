import { useSyncExternalStore } from 'react'

/** preferências deste aparelho (modo desenvolvedor, destacar minhas tarefas…) */
type Prefs = { dev: boolean; destaque: boolean; navMini: boolean }
const KEY = 'ev:prefs'
const DEF: Prefs = { dev: false, destaque: true, navMini: false }
let cur: Prefs = (() => { try { return { ...DEF, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') } } catch { return DEF } })()
const subs = new Set<() => void>()

export function setPref<K extends keyof Prefs>(k: K, v: Prefs[K]) {
  cur = { ...cur, [k]: v }
  try { localStorage.setItem(KEY, JSON.stringify(cur)) } catch { /* sem storage */ }
  subs.forEach(f => f())
}
export function usePref<K extends keyof Prefs>(k: K): Prefs[K] {
  return useSyncExternalStore(f => { subs.add(f); return () => subs.delete(f) }, () => cur[k])
}
