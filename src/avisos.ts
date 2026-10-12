// Avisos de datas chegando: data comemorativa e ação do plano com 1 semana de antecedência
// (tempo de montar uma campanha bem feita) e prazo das minhas tarefas. Cada aviso sai uma vez só.
import { dayKey } from './game/xp'
import { difDias, editaPlano, quando, quem, situacao } from './plano/core'
import { checagens, getState, notify } from './store'

const MAX = 4 // por rodada, pra não soltar uma enxurrada no primeiro acesso
const dm = (k: string) => `${k.slice(8, 10)}/${k.slice(5, 7)}`
const emDias = (d: number) => d === 0 ? 'hoje' : d === 1 ? 'amanhã' : `em ${d} dias`

function checarDatas() {
  const s = getState()
  const my = s.meId
  if (!my) return
  const eu = s.profiles[my]
  const key = `ev:avisos:${my}`
  let seen: Record<string, 1> = {}
  try { seen = JSON.parse(localStorage.getItem(key) ?? '{}') } catch { /* nada salvo */ }
  const hoje = dayKey(new Date())
  const fila: [string, string, Parameters<typeof notify>[1]][] = []
  const add = (k: string, text: string, extra: Parameters<typeof notify>[1]) => { if (!seen[k]) fila.push([k, text, extra]) }
  const { plano_acoes, plano_nucleos, plano_resp, equipes } = s.rows

  for (const a of Object.values(plano_acoes)) {
    const { dia } = quando(a)
    if (!dia || !a.texto.trim()) continue
    const d = difDias(dia, hoje)
    if (d < 0 || d > 7) continue
    if (plano_nucleos[a.nucleo]?.tipo === 'datas') {
      if (!editaPlano(eu)) continue
      if (d >= 2) add(`d:${a.id}:${dia}:sem`, `📅 ${a.texto} é ${emDias(d)} (${dm(dia)}). Uma semana pra montar a campanha.`, { go: { view: 'agenda' } })
      else add(`d:${a.id}:${dia}:vesp`, `📅 ${a.texto} é ${emDias(d)} (${dm(dia)}).`, { go: { view: 'agenda' } })
      continue
    }
    if (situacao(a, s.tasks) !== 'livre') continue
    const { pessoas } = quem(a, plano_resp, s.profiles, equipes)
    if (!(pessoas.includes(my) || (!pessoas.length && editaPlano(eu)))) continue
    if (d >= 3) add(`a:${a.id}:${dia}:sem`, `🗓 Ação do plano ${emDias(d)} (${dm(dia)}) e ainda fora do quadro: “${a.texto}”`, { go: { view: 'plano' } })
    else add(`a:${a.id}:${dia}:perto`, `⚠ ${d === 0 ? 'É hoje' : d === 1 ? 'Falta 1 dia' : `Faltam ${d} dias`} e a ação ainda não virou tarefa: “${a.texto}”`, { go: { view: 'plano' } })
  }

  for (const t of Object.values(s.tasks)) {
    if (!t.due || t.owner_id !== my || t.status === 'done' || t.status === 'declined') continue
    const due = t.due.slice(0, 10)
    const d = difDias(due, hoje)
    if (d === 1) add(`t:${t.id}:${due}:1`, `⏳ Vence amanhã: “${t.title}”`, { go: { task: t.id } })
    else if (d === 0) add(`t:${t.id}:${due}:0`, `⏳ Vence hoje: “${t.title}”`, { go: { task: t.id } })
    else if (d < 0 && d >= -3) add(`t:${t.id}:${due}:x`, `🔴 Atrasou: “${t.title}” venceu ${dm(due)}`, { go: { task: t.id } })
  }

  if (!fila.length) return
  for (const [k, text, extra] of fila.slice(0, MAX)) { seen[k] = 1; notify(text, extra) }
  // limpa o que já passou
  for (const k of Object.keys(seen)) { const dia = k.match(/\d{4}-\d{2}-\d{2}/)?.[0]; if (dia && difDias(hoje, dia) > 10) delete seen[k] }
  try { localStorage.setItem(key, JSON.stringify(seen)) } catch { /* sem espaço */ }
}

checagens.push(checarDatas)
