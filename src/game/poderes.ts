import type { Poder, PoderTipo } from '../types'

// Mesmos tipos e efeitos do supabase/migrations/202610281000_poderes.sql
export const PODERES: Record<PoderTipo, { nome: string; emoji: string; cor: string; desc: string }> = {
  ima: { nome: 'Ímã', emoji: '🧲', cor: '#E5484D', desc: '+50% nos cafezinhos de dia, fase e meta' },
  coringa: { nome: 'Coringa', emoji: '🃏', cor: '#8E4EC6', desc: '1 bilhete grátis por dia no bolão' },
  mesada: { nome: 'Mesada', emoji: '💰', cor: '#30A46C', desc: '+15 cafezinhos por dia' },
  megafone: { nome: 'Megafone', emoji: '📣', cor: '#F76B15', desc: 'manda 1 aviso pro escritório inteiro' },
  turbo: { nome: 'Turbo', emoji: '⚡', cor: '#FBC222', desc: 'anda 2× mais rápido' },
  chefe: { nome: 'Chefe por um dia', emoji: '👑', cor: '#0B235D', desc: 'pode arrumar qualquer sala' },
  visao: { nome: 'Visão', emoji: '👁️', cor: '#0090FF', desc: 'vê quem tem mais bilhetes no bolão' },
}

export const ativo = (p: Poder, now = Date.now()) => new Date(p.inicio).getTime() <= now && new Date(p.fim).getTime() > now

/** poder ativo de alguém (o mais novo); com `tipo`, só daquele tipo */
export const poderDe = (poderes: Record<string, Poder>, uid: string | null | undefined, tipo?: PoderTipo, now = Date.now()) =>
  uid ? Object.values(poderes).filter(p => p.user_id === uid && (!tipo || p.tipo === tipo) && ativo(p, now)).sort((a, b) => b.inicio.localeCompare(a.inicio))[0] : undefined

/** avisos do megafone que ainda aparecem (24h depois de dados, enquanto o poder vale) */
export const avisosMegafone = (poderes: Record<string, Poder>, now = Date.now()) =>
  Object.values(poderes).filter(p => p.aviso && p.avisado_em && now - new Date(p.avisado_em).getTime() < 864e5).sort((a, b) => b.avisado_em!.localeCompare(a.avisado_em!))

export const ateQuando = (iso: string) => new Date(iso).toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })
