import type { Backend } from '../types'
import { DemoBackend } from './demo'
import { SupabaseBackend } from './supabase'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

// ?demo força o modo local (teste sem mexer no banco)
export const backend: Backend = url && key && !new URLSearchParams(location.search).has('demo') ? new SupabaseBackend(url, key) : new DemoBackend()
