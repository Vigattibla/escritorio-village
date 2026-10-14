import { useEffect, useState } from 'react'
import { backend } from '../data'
import { SupabaseBackend } from '../data/supabase'
import { confirmar } from './Dialogo'
import { Ph } from './Icon'

interface Chave { id: string; nome: string; dica: string; criado: string; usado: string | null }
const URL_FN = (import.meta.env.VITE_SUPABASE_URL as string ?? 'https://SEU-PROJETO.supabase.co') + '/functions/v1/tarefas'
const sbk = backend instanceof SupabaseBackend ? backend : null
// no ?demo a chave é de mentira e fica só nesta aba
let demo: Chave[] = []

type Aba = 'claude' | 'gemini' | 'codex' | 'webhook' | 'email'
const ABAS: [Aba, string][] = [['claude', 'Claude Code'], ['gemini', 'Gemini CLI'], ['codex', 'Codex CLI'], ['webhook', 'Webhook'], ['email', 'E-mail']]

function receita(a: Aba, k: string): { passos: string; codigo: string } {
  switch (a) {
    case 'claude': return { passos: 'Rode no terminal uma vez. Depois é só pedir no chat: "anota uma tarefa pra Ana: arte do feriado até sexta".',
      codigo: `claude mcp add --transport http --scope user turmeo ${URL_FN} --header "Authorization: Bearer ${k}"` }
    case 'gemini': return { passos: 'Rode no terminal uma vez (ou cole o bloco em ~/.gemini/settings.json, dentro de "mcpServers").',
      codigo: `gemini mcp add --transport http --scope user turmeo ${URL_FN} -H "Authorization: Bearer ${k}"\n\n"turmeo": { "httpUrl": "${URL_FN}", "headers": { "Authorization": "Bearer ${k}" } }` }
    case 'codex': return { passos: 'Cole no fim de ~/.codex/config.toml e guarde a chave numa variável do sistema (Windows: rode o setx e reabra o terminal).',
      codigo: `[mcp_servers.turmeo]\nurl = "${URL_FN}"\nbearer_token_env_var = "TURMEO_TOKEN"\n\nsetx TURMEO_TOKEN ${k}` }
    case 'webhook': return { passos: 'Qualquer automação (Zapier, Make, n8n, Atalhos do iPhone, GPT com Actions) cria tarefa com um POST. Campos: titulo, para, prazo (AAAA-MM-DD, DD/MM, amanhã, sexta), notas, prioridade.',
      codigo: `curl -X POST ${URL_FN}/nova \\\n  -H "Authorization: Bearer ${k}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"titulo":"Arte do feriado","para":"Ana","prazo":"sexta"}'` }
    case 'email': return { passos: 'Aponte o e-mail de entrada de um serviço (Cloudflare Email Routing, Postmark, Mailgun ou SendGrid) pra este endereço. Assunto vira o título; no começo do texto dá pra escrever "Para: Ana" e "Prazo: sexta".',
      codigo: `${URL_FN}/email?t=${k}` }
  }
}

/** Conectar IA: chaves pessoais pra criar tarefa pelo chat do Claude, Gemini, Codex, webhook ou e-mail */
export default function Conectar({ onClose }: { onClose: () => void }) {
  const [chaves, setChaves] = useState<Chave[]>([])
  const [nova, setNova] = useState('')
  const [nome, setNome] = useState('')
  const [aba, setAba] = useState<Aba>('claude')
  const [busy, setBusy] = useState(false)
  const [erro, setErro] = useState('')
  const [copiado, setCopiado] = useState(false)
  const carregar = () => (sbk ? sbk.chaves() : Promise.resolve(demo)).then(setChaves, e => setErro(e.message))
  useEffect(() => { void carregar() }, [])
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])

  const gerar = async () => {
    setBusy(true); setErro('')
    try {
      const n = nome.trim() || ABAS.find(x => x[0] === aba)![1]
      let k: string
      if (sbk) k = await sbk.criarChave(n)
      else {
        k = 'tv_demo' + Math.random().toString(16).slice(2, 14)
        demo = [{ id: crypto.randomUUID(), nome: n, dica: k.slice(-4), criado: new Date().toISOString(), usado: null }, ...demo]
      }
      setNova(k); setNome(''); await carregar()
    } catch (e) { setErro((e as Error).message) }
    setBusy(false)
  }
  const apagar = async (c: Chave) => {
    if (!await confirmar(`Apagar a chave "${c.nome}"? O que estiver usando ela para de funcionar na hora.`, { ok: 'Apagar', danger: true })) return
    try {
      if (sbk) await sbk.apagarChave(c.id); else demo = demo.filter(x => x.id !== c.id)
      await carregar()
    } catch (e) { setErro((e as Error).message) }
  }
  const r = receita(aba, nova || 'SUA_CHAVE')
  const copiar = () => { void navigator.clipboard.writeText(r.codigo).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 1500) }) }
  const quando = (s: string | null) => s ? new Date(s).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : 'nunca'

  return (
    <div className="modal-bg" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <section className="jan cx" role="dialog" aria-label="Conectar IA">
        <header className="cx-h">
          <Ph n="link" size={22} />
          <div className="grow"><b>Conectar IA</b><small>Crie tarefas no quadro falando com o Claude, Gemini, Codex ou qualquer automação.</small></div>
          <button className="iconbtn" onClick={onClose} aria-label="Fechar"><Ph n="x" size={18} /></button>
        </header>

        <nav className="cx-abas">{ABAS.map(([k, l]) => <button key={k} className={aba === k ? 'on' : ''} onClick={() => setAba(k)}>{l}</button>)}</nav>

        {nova
          ? <div className="cx-nova"><Ph n="check-circle" size={16} /><span className="grow">Chave criada. Ela já está no código abaixo e <b>não aparece de novo</b>: copie agora.</span></div>
          : <div className="cx-gerar">
              <input value={nome} onChange={e => setNome(e.target.value)} maxLength={60} placeholder={`Nome da chave (ex.: ${ABAS.find(x => x[0] === aba)![1]} do notebook)`} />
              <button className="btn primary" disabled={busy} onClick={gerar}>{busy ? 'Gerando…' : 'Gerar chave'}</button>
            </div>}

        <p className="cx-passos">{r.passos}</p>
        <div className="cx-cod"><pre>{r.codigo}</pre><button className="btn ghost sm" onClick={copiar}>{copiado ? 'Copiado' : 'Copiar'}</button></div>
        <p className="cx-aviso">A chave age como você: quem tiver ela cria e muda tarefas no seu nome. Não mande em grupo nem coloque em site público.</p>

        {erro && <p className="err">{erro}</p>}
        {chaves.length > 0 && <div className="cx-lista">
          <b>Suas chaves</b>
          {chaves.map(c => <div key={c.id} className="cx-ch">
            <Ph n="link" size={15} /><span className="grow">{c.nome} <small>…{c.dica} · criada {quando(c.criado)} · usada {quando(c.usado)}</small></span>
            <button className="btn danger-ghost sm" onClick={() => apagar(c)}>Apagar</button>
          </div>)}
        </div>}
      </section>
    </div>
  )
}
