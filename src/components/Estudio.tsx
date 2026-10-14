import { useEffect, useRef, useState } from 'react'
import { cancelarPedido, estudioReal, lerChat, lerPedidos, lerSinal, mandarChat, pedir, type ChatMsg, type Pedido, type Sinal } from '../data/estudio'
import { notify, setUi, useStore } from '../store'
import { Bell } from './Avisos'
import { Ph } from './Icon'
import '../estudio.css'

const PILARES = [['', 'Pilar: o Estúdio escolhe'], ['rh', 'RH: integração e treinamento'], ['estrutura', 'Estrutura e capacidade'], ['prova', 'Prova e confiança'], ['experiencia', 'Experiência completa'], ['logistica', 'Logística sem dor']] as const
const ESTADO: Record<Pedido['estado'], string> = { fila: 'Na fila', gerando: 'Gerando', pronto: 'Pronto', erro: 'Deu erro' }
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

/** Estúdio da VPS dentro do Turmeo: conversa (o Claude roda lá) + pedidos de carrossel. Só adm. */
export default function Estudio() {
  const adm = useStore(s => !!(s.meId && s.profiles[s.meId]?.is_admin))
  const [msgs, puxarChat, erroChat] = usePuxar(lerChat, 2500)
  const [pedidos, puxarPedidos] = usePuxar(lerPedidos, 4000)
  const [sinal] = usePuxar<Sinal | null>(lerSinal, 15000)
  const [agora, setAgora] = useState(() => Date.now())
  useEffect(() => { const i = setInterval(() => setAgora(Date.now()), 10000); return () => clearInterval(i) }, [])
  const online = !!sinal && agora - new Date(sinal.visto).getTime() < 90000
  if (!adm) return <div className="quadro"><div className="qbar"><b className="grow">Estúdio</b><Bell /></div><p className="es-vazio">Só o adm usa o Estúdio por aqui.</p></div>
  return (
    <div className="quadro es">
      <div className="qbar">
        <b className="grow es-tit"><Ph n="sparkle" size={18} /> Estúdio</b>
        <span className={'es-sinal' + (online ? ' on' : '')} title={sinal ? 'Visto ' + hora(sinal.visto) : 'Nunca ligou'}>
          <i />{!estudioReal() ? 'Demo' : online ? (sinal?.info.ocupado ? 'Ligado · trabalhando' : 'Ligado') : 'Desligado'}
        </span>
        <Bell />
      </div>
      <div className="es-grade">
        <Conversa msgs={msgs ?? []} erro={erroChat} puxar={puxarChat} />
        <Pedidos lista={pedidos ?? []} puxar={puxarPedidos} />
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

function Pedidos({ lista, puxar }: { lista: Pedido[]; puxar: () => void }) {
  const [texto, setTexto] = useState('')
  const [pilar, setPilar] = useState('')
  const [dia, setDia] = useState('')
  const [busy, setBusy] = useState(false)
  const mandar = async () => {
    if (texto.trim().length < 3 || busy) return
    setBusy(true)
    try {
      await pedir({ texto: texto.trim(), pilar: pilar || null, quando: dia ? new Date(dia + 'T10:00:00-03:00').toISOString() : null })
      setTexto(''); setDia(''); puxar()
    } catch (e) { notify((e as Error).message) } finally { setBusy(false) }
  }
  return (
    <section className="es-pedidos tbox">
      <header><b className="grow">Carrossel Convention · LinkedIn</b></header>
      <div className="es-form">
        <textarea value={texto} onChange={e => setTexto(e.target.value)} maxLength={2000} rows={2} placeholder="Assunto (ex.: integração de novos funcionários sem sair da cidade)" />
        <div className="es-linha">
          <select value={pilar} onChange={e => setPilar(e.target.value)}>{PILARES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          <input type="date" value={dia} onChange={e => setDia(e.target.value)} title="Dia de publicar (opcional)" />
          <button className="tbtn acc" disabled={texto.trim().length < 3 || busy} onClick={mandar}>Pedir</button>
        </div>
      </div>
      <ul className="es-lista">
        {!lista.length && <li className="es-vazio">Nenhum pedido ainda. O que ficar pronto vira tarefa em aprovação no quadro.</li>}
        {lista.map(p => (
          <li key={p.id} className={'es-ped ' + p.estado}>
            <span className="es-est">{ESTADO[p.estado]}</span>
            <div className="grow">
              <b>{p.texto}</b>
              <small>{p.pilar ? p.pilar + ' · ' : ''}{p.quando ? 'publicar ' + hora(p.quando) : 'sem data'}{p.estado === 'gerando' && p.passo ? ' · ' + p.passo : ''}</small>
              {p.estado === 'erro' && p.erro && <small className="li-erro">{p.erro}</small>}
            </div>
            {p.estado === 'pronto' && p.task_id && <button className="tlink" onClick={() => setUi({ task: p.task_id! })}>Abrir</button>}
            {(p.estado === 'fila' || p.estado === 'erro') && <button className="tlink" onClick={() => cancelarPedido(p.id).then(puxar, e => notify(e.message))} title="Tirar da fila">Tirar</button>}
          </li>
        ))}
      </ul>
    </section>
  )
}
