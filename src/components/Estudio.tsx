import { useEffect, useRef, useState } from 'react'
import { cancelarPedido, encaixar, estudioReal, lerAgenda, lerCanais, lerChat, lerSinal, mandarChat, mudarPedido, planejar, salvarCanal, type Canal, type ChatMsg, type Pedido, type Sinal } from '../data/estudio'
import { notify, setUi, useStore } from '../store'
import { Bell } from './Avisos'
import { Ph } from './Icon'
import { rankOf } from '../game/ranks'
import '../estudio.css'

const ESTADO: Record<Pedido['estado'], string> = { fila: 'Na fila', gerando: 'Gerando', pronto: 'Pronto', erro: 'Deu erro', pulado: 'Pulado' }
const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
/** moldes que o adm cria no Estúdio (a VPS anuncia os prontos no sinal) */
const MOLDE: Record<string, string> = { 'convention-linkedin': 'Convention · LinkedIn', 'meudestino-guia': 'MeuDestino · guia' }
const nomeMolde = (m: string) => MOLDE[m] ?? m
const dia = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }).replace('.', '')
const hora = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).replace('.', '')

/** liga a cada poucos segundos enquanto a tela está aberta e visível */
function usePuxar<T>(ler: () => Promise<T>, ms: number): [T | null, () => void, string] {
  const [v, setV] = useState<T | null>(null)
  const [erro, setErro] = useState('')
  const ref = useRef(ler)
  useEffect(() => { ref.current = ler })
  const puxar = () => { if (document.visibilityState === 'visible') ref.current().then(x => { setV(x); setErro('') }, e => setErro(String(e.message ?? e))) }
  useEffect(() => { puxar(); const i = setInterval(puxar, ms); return () => clearInterval(i) }, [ms]) // eslint-disable-line react-hooks/exhaustive-deps
  return [v, puxar, erro]
}

/** Estúdio da VPS dentro do Turmeo. Cada canal (rede/marca) segue seu calendário sozinho; a coordenação encaixa publicação no meio
 *  e abre o que ficou pronto. Adm: conversa (o Claude roda lá, cria moldes) e ajusta os canais. */
export default function Estudio() {
  const adm = useStore(s => !!(s.meId && s.profiles[s.meId]?.is_admin))
  const coord = useStore(s => !!s.meId && rankOf(s.profiles[s.meId]) >= 2)
  const [msgs, puxarChat, erroChat] = usePuxar(() => adm ? lerChat() : Promise.resolve([] as ChatMsg[]), 2500)
  const [canais, puxarCanais] = usePuxar(lerCanais, 60000)
  const [escolha, setEscolha] = useState('')
  const canal = canais?.find(c => c.id === escolha) ?? canais?.[0] ?? null
  const [sinal] = usePuxar<Sinal | null>(lerSinal, 15000)
  const [agora, setAgora] = useState(() => Date.now())
  useEffect(() => { const i = setInterval(() => setAgora(Date.now()), 10000); return () => clearInterval(i) }, [])
  const online = !!sinal && agora - new Date(sinal.visto).getTime() < 90000
  if (!adm && !coord) return <div className="quadro"><div className="qbar"><b className="grow">Estúdio</b><Bell /></div><p className="es-vazio">O Estúdio é da coordenação. Peça uma publicação pra sua coordenação.</p></div>
  return (
    <div className="quadro es">
      <div className="qbar">
        <b className="grow es-tit"><Ph n="sparkle" size={18} /> Estúdio</b>
        <span className={'es-sinal' + (online ? ' on' : '')} title={sinal ? 'Visto ' + hora(sinal.visto) : 'Nunca ligou'}>
          <i />{!estudioReal() ? 'Demo' : online ? (sinal?.info.ocupado ? 'Ligado · trabalhando' : 'Ligado') : 'Desligado'}
        </span>
        <Bell />
      </div>
      <div className={'es-grade' + (adm ? '' : ' so-canal')}>
        {adm && <Conversa msgs={msgs ?? []} erro={erroChat} puxar={puxarChat} />}
        <section className="es-canal tbox">
          <nav className="es-canais">
            {(canais ?? []).map(c => (
              <button key={c.id} className={'es-aba' + (c.id === canal?.id ? ' on' : '')} onClick={() => setEscolha(c.id)}>
                {c.nome}<small>{c.rede === 'linkedin' ? 'LinkedIn' : c.rede}{!c.ativo && ' · parado'}</small>
              </button>
            ))}
          </nav>
          {canal ? <CanalView key={canal.id} canal={canal} adm={adm} moldes={sinal?.info.moldes ?? []} recarregar={puxarCanais} />
            : <p className="es-vazio">{canais ? 'Nenhum canal ainda.' : 'Carregando…'}</p>}
        </section>
      </div>
    </div>
  )
}

function Conversa({ msgs, erro, puxar }: { msgs: ChatMsg[]; erro: string; puxar: () => void }) {
  const [txt, setTxt] = useState('')
  const [busy, setBusy] = useState(false)
  const fim = useRef<HTMLDivElement>(null)
  const ultimo = msgs.at(-1)
  useEffect(() => { fim.current?.scrollIntoView({ block: 'end' }) }, [msgs.length, ultimo?.texto.length])
  const esperando = msgs.some(m => m.papel === 'eu' && (m.estado === 'novo' || m.estado === 'lendo'))
  const enviar = async () => {
    const t = txt.trim()
    if (!t || busy) return
    setBusy(true)
    try { await mandarChat(t); setTxt(''); puxar() } catch (e) { notify((e as Error).message) } finally { setBusy(false) }
  }
  return (
    <section className="es-chat tbox">
      <header><b className="grow">Conversa</b><button className="tlink" onClick={() => setTxt('/novo ')} title="Começa uma conversa nova (o Estúdio esquece a anterior)">Nova conversa</button></header>
      <div className="es-msgs">
        {!msgs.length && <p className="es-vazio">Peça qualquer coisa: “faz 3 carrosséis de RH pra novembro”, “o que tem na fila?”, “refaz o slide 2 do último”. Ele executa no Estúdio da VPS.</p>}
        {msgs.map(m => (
          <div key={m.id} className={'es-msg ' + m.papel + (m.estado === 'erro' ? ' erro' : '')}>
            <p>{m.texto || (m.estado === 'lendo' ? 'Pensando…' : m.estado === 'novo' ? '' : '…')}</p>
            <small>{hora(m.criado_em)}{m.papel === 'eu' && m.estado === 'novo' && ' · esperando o Estúdio'}{m.papel === 'estudio' && m.estado === 'lendo' && ' · trabalhando'}</small>
          </div>
        ))}
        <div ref={fim} />
      </div>
      {erro && <small className="li-erro">{erro}</small>}
      <div className="es-escrever">
        <textarea value={txt} onChange={e => setTxt(e.target.value)} maxLength={20000} rows={2} placeholder={esperando ? 'O Estúdio está respondendo… pode mandar a próxima' : 'Escreva pro Estúdio'}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() } }} />
        <button className="tbtn acc" disabled={!txt.trim() || busy} onClick={enviar} aria-label="Enviar"><Ph n="paper-plane-tilt" size={18} /></button>
      </div>
    </section>
  )
}

/** um canal: ritmo, publicação no meio e o calendário (planejado + encaixado) */
function CanalView({ canal, adm, moldes, recarregar }: { canal: Canal; adm: boolean; moldes: string[]; recarregar: () => void }) {
  const [agenda, puxar] = usePuxar(() => lerAgenda(canal.id), 5000)
  const meId = useStore(s => s.meId)
  const nomes = useStore(s => s.profiles)
  const [ajustar, setAjustar] = useState(false)
  const pilarNome = (id: string | null) => canal.pilares.find(p => p.id === id)?.nome ?? id ?? ''
  const ritmo = canal.dias.length ? `${canal.dias.map(d => SEMANA[d]).join(', ')} · ${canal.hora.slice(0, 5)} · gera ${canal.antecedencia} dia${canal.antecedencia === 1 ? '' : 's'} antes` : 'sem dias definidos'
  const acao = (f: () => Promise<unknown>) => f().then(puxar, e => notify((e as Error).message))
  return (
    <>
      <header>
        <div className="grow">
          <b>{canal.nome}</b>
          <small className="muted es-ritmo">{canal.ativo ? ritmo : canal.molde ? 'Parado: o calendário não anda' : 'Sem molde ainda: o adm cria pela conversa'}{canal.molde && ' · ' + nomeMolde(canal.molde)}</small>
        </div>
        {adm && <button className="tlink" onClick={() => setAjustar(!ajustar)}>{ajustar ? 'Fechar' : 'Ajustar canal'}</button>}
      </header>
      {adm && ajustar && <Ajustes canal={canal} moldes={moldes} pronto={() => { setAjustar(false); recarregar(); puxar() }} />}
      {canal.molde && <Encaixar canal={canal} puxar={puxar} />}
      <ul className="es-lista">
        {agenda && !agenda.length && <li className="es-vazio">{canal.ativo ? 'O calendário aparece aqui assim que o Estúdio planejar.' : 'Nada no calendário.'}</li>}
        {(agenda ?? []).map(p => {
          const agendado = p.estado === 'fila' && !!p.gerar_em && new Date(p.gerar_em).getTime() > Date.now()
          const meu = p.criado_por === meId
          return (
            <li key={p.id} className={'es-ped ' + (agendado ? 'agendado' : p.estado)}>
              <span className="es-dia">{p.quando ? dia(p.quando) : '—'}</span>
              <div className="grow">
                <Assunto p={p} editar={adm && p.estado === 'fila'} salvar={texto => acao(() => mudarPedido(p.id, { texto }))} />
                <small>
                  {p.origem === 'extra' ? 'No meio' + (nomes[p.criado_por]?.name ? ' · ' + nomes[p.criado_por].name : '') : 'Calendário'}
                  {p.pilar && ' · ' + pilarNome(p.pilar)}
                  {agendado && p.gerar_em && ' · gera ' + hora(p.gerar_em)}
                  {p.estado === 'gerando' && p.passo && ' · ' + p.passo}
                </small>
                {p.estado === 'erro' && p.erro && <small className="li-erro">{p.erro}</small>}
              </div>
              <span className="es-est">{agendado ? 'Agendado' : ESTADO[p.estado]}</span>
              {p.estado === 'pronto' && p.task_id && <button className="tlink" onClick={() => setUi({ task: p.task_id! })}>Abrir</button>}
              {adm && agendado && <button className="tlink" onClick={() => acao(() => mudarPedido(p.id, { gerar_em: new Date().toISOString() }))} title="Gera já, sem esperar a antecedência">Gerar já</button>}
              {adm && p.estado === 'erro' && <button className="tlink" onClick={() => acao(() => mudarPedido(p.id, { estado: 'fila', gerar_em: new Date().toISOString() }))}>Tentar de novo</button>}
              {adm && p.origem === 'calendario' && p.estado === 'fila' && <button className="tlink" onClick={() => acao(() => mudarPedido(p.id, { estado: 'pulado' }))} title="Não publica nesse dia">Pular</button>}
              {adm && p.estado === 'pulado' && <button className="tlink" onClick={() => acao(() => mudarPedido(p.id, { estado: 'fila' }))}>Voltar</button>}
              {p.origem !== 'calendario' && (adm || meu) && (p.estado === 'fila' || p.estado === 'erro') && <button className="tlink" onClick={() => acao(() => cancelarPedido(p.id))} title="Tira do calendário">Tirar</button>}
            </li>
          )
        })}
      </ul>
    </>
  )
}

/** assunto do item; o adm troca o tema enquanto ainda não foi gerado */
function Assunto({ p, editar, salvar }: { p: Pedido; editar: boolean; salvar: (t: string) => void }) {
  const [txt, setTxt] = useState<string | null>(null)
  if (txt === null) return <b className={editar ? 'es-editavel' : ''} title={editar ? 'Clique pra trocar o assunto' : undefined} onClick={() => editar && setTxt(p.texto)}>{p.texto}</b>
  const ok = () => { const t = txt.trim(); if (t.length >= 3 && t !== p.texto) salvar(t); setTxt(null) }
  return <input className="es-assunto" autoFocus value={txt} maxLength={2000} onChange={e => setTxt(e.target.value)} onBlur={ok}
    onKeyDown={e => { if (e.key === 'Enter') ok(); if (e.key === 'Escape') setTxt(null) }} />
}

function Encaixar({ canal, puxar }: { canal: Canal; puxar: () => void }) {
  const [texto, setTexto] = useState('')
  const [pilar, setPilar] = useState('')
  const [quando, setQuando] = useState('')
  const [busy, setBusy] = useState(false)
  const ok = texto.trim().length >= 3 && !!quando && !busy
  const mandar = async () => {
    if (!ok) return
    setBusy(true)
    try {
      await encaixar({ canal: canal.id, texto: texto.trim(), pilar: pilar || null, quando: new Date(`${quando}T${canal.hora.slice(0, 5)}:00-03:00`).toISOString() })
      setTexto(''); setQuando(''); puxar()
    } catch (e) { notify((e as Error).message) } finally { setBusy(false) }
  }
  return (
    <div className="es-form">
      <textarea value={texto} onChange={e => setTexto(e.target.value)} maxLength={2000} rows={2} placeholder="Publicação no meio do calendário: diga o assunto (ex.: treinamento de brigada desta semana)" />
      <div className="es-linha">
        {canal.pilares.length > 0 && <select value={pilar} onChange={e => setPilar(e.target.value)}><option value="">Pilar: o Estúdio escolhe</option>{canal.pilares.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</select>}
        <input type="date" value={quando} min={new Date().toISOString().slice(0, 10)} onChange={e => setQuando(e.target.value)} title="Dia de publicar" />
        <button className="tbtn acc" disabled={!ok} onClick={mandar}>Agendar</button>
      </div>
      <small className="muted">O Estúdio gera {canal.antecedencia} dia{canal.antecedencia === 1 ? '' : 's'} antes do dia escolhido (ou na hora, se estiver perto) e manda pra aprovação.</small>
    </div>
  )
}

/** só adm: molde, dias, hora e antecedência; ao salvar o calendário é refeito */
function Ajustes({ canal, moldes, pronto }: { canal: Canal; moldes: string[]; pronto: () => void }) {
  const [f, setF] = useState({ ativo: canal.ativo, molde: canal.molde ?? '', dias: canal.dias, hora: canal.hora.slice(0, 5), antecedencia: canal.antecedencia })
  const [busy, setBusy] = useState(false)
  const lista = [...new Set([...moldes, ...(canal.molde ? [canal.molde] : [])])]
  const salvar = async () => {
    setBusy(true)
    try {
      await salvarCanal(canal.id, { ativo: f.ativo && !!f.molde, molde: f.molde || null, dias: [...f.dias].sort(), hora: f.hora, antecedencia: f.antecedencia })
      const n = await planejar()
      notify(n ? `Calendário atualizado: ${n} ${n === 1 ? 'publicação nova' : 'publicações novas'}.` : 'Canal salvo.')
      pronto()
    } catch (e) { notify((e as Error).message) } finally { setBusy(false) }
  }
  return (
    <div className="es-ajustes">
      <label className="es-check"><input type="checkbox" checked={f.ativo} onChange={e => setF({ ...f, ativo: e.target.checked })} /> Seguir o calendário</label>
      <div className="es-linha">
        <select value={f.molde} onChange={e => setF({ ...f, molde: e.target.value })} title="Molde"><option value="">Sem molde</option>{lista.map(m => <option key={m} value={m}>{nomeMolde(m)}</option>)}</select>
        <input type="time" value={f.hora} onChange={e => setF({ ...f, hora: e.target.value })} title="Hora de publicar" />
        <label className="es-num">gera <input type="number" min={0} max={30} value={f.antecedencia} onChange={e => setF({ ...f, antecedencia: Math.max(0, Math.min(30, +e.target.value || 0)) })} /> dias antes</label>
      </div>
      <div className="es-dias">
        {SEMANA.map((s, i) => <button key={s} className={'es-d' + (f.dias.includes(i) ? ' on' : '')} onClick={() => setF({ ...f, dias: f.dias.includes(i) ? f.dias.filter(x => x !== i) : [...f.dias, i] })}>{s}</button>)}
        <button className="tbtn acc" disabled={busy} onClick={salvar}>Salvar</button>
      </div>
      {!f.molde && <small className="muted">Sem molde o canal não gera. Crie o molde pela conversa e escolha aqui.</small>}
    </div>
  )
}
