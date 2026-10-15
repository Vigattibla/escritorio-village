import { usePref } from '../prefs'
import { useEffect, useRef, useState } from 'react'
import { cancelarPedido, decidir, encaixar, lerAprovar, marcarAprovador, type ParaAprovar, estudioReal, lerAgenda, lerCanais, lerChat, lerSinal, mandarChat, mudarPedido, planejar, salvarCanal, type Canal, type ChatMsg, type Pedido, type Sinal } from '../data/estudio'
import { fileUrl, notify, setUi, useStore } from '../store'
import type { Attachment } from '../types'
import { Bell } from './Avisos'
import { Ph } from './Icon'
import { rankOf } from '../game/ranks'
import '../estudio.css'

const ESTADO: Record<Pedido['estado'], string> = { espera: 'Falta material', fila: 'Na fila', gerando: 'Gerando', pronto: 'Pronto', erro: 'Deu erro', pulado: 'Pulado' }
const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
/** moldes que o adm cria no Estúdio (a VPS anuncia os prontos no sinal) */
const MOLDE: Record<string, string> = { 'convention-linkedin': 'Convention · LinkedIn', 'meudestino-guia': 'MeuDestino · guia' }
const nomeMolde = (m: string) => MOLDE[m] ?? m
const dia = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }).replace('.', '')
const hora = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).replace('.', '')

/** liga a cada poucos segundos enquanto a tela está aberta e visível */
export function usePuxar<T>(ler: () => Promise<T>, ms: number): [T | null, () => void, string] {
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
/** quem vê a fila de aprovação do Estúdio (dono ou marcado como aprovador) */
export function useAprovaEstudio() {
  const adm = useStore(s => !!(s.meId && s.profiles[s.meId]?.is_admin))
  const dono = useStore(s => !!s.meId && (!!s.profiles[s.meId]?.estudio_dono || (adm && !Object.values(s.profiles).some(p => p.estudio_dono))))
  return useStore(s => dono || !!(s.meId && s.profiles[s.meId]?.aprova_estudio))
}

export type AbaEstudio = 'aprovar' | 'canais' | 'conversa'

/** painel: o Estúdio mora dentro de Publicações, numa coluna à direita (folha de baixo no celular) */
export default function Estudio({ fechar, inicio }: { fechar?: () => void; inicio?: AbaEstudio }) {
  const adm = useStore(s => !!(s.meId && s.profiles[s.meId]?.is_admin))
  const coord = useStore(s => !!s.meId && rankOf(s.profiles[s.meId]) >= 2)
  // a conversa é só do dono do Estúdio (sem dono marcado ainda, vale o adm)
  // e só aparece com o modo desenvolvedor ligado (menu do perfil)
  const dev = usePref('dev')
  const dono = useStore(s => !!s.meId && (!!s.profiles[s.meId]?.estudio_dono || (adm && !Object.values(s.profiles).some(p => p.estudio_dono))))
  const chat = dono && dev
  const aprova = useStore(s => dono || !!(s.meId && s.profiles[s.meId]?.aprova_estudio))
  const [msgs, puxarChat, erroChat] = usePuxar(() => chat ? lerChat() : Promise.resolve([] as ChatMsg[]), 2500)
  const [fila, puxarFila] = usePuxar(() => aprova ? lerAprovar() : Promise.resolve([] as ParaAprovar[]), 15000)
  const [aba, setAba] = useState<AbaEstudio | null>(inicio ?? null)
  const vendo: AbaEstudio = (aba === 'conversa' && !chat) ? 'canais' : aba ?? (aprova && (!(adm || coord) || (fila?.length ?? 0) > 0) ? 'aprovar' : 'canais')
  const [canais, puxarCanais] = usePuxar(lerCanais, 60000)
  const [escolha, setEscolha] = useState('')
  const canal = canais?.find(c => c.id === escolha) ?? canais?.[0] ?? null
  const [sinal] = usePuxar<Sinal | null>(lerSinal, 15000)
  const [agora, setAgora] = useState(() => Date.now())
  useEffect(() => { const i = setInterval(() => setAgora(Date.now()), 10000); return () => clearInterval(i) }, [])
  const online = !!sinal && agora - new Date(sinal.visto).getTime() < 90000
  const sinalEl = <span className={'es-sinal' + (online ? ' on' : '')} title={sinal ? 'Visto ' + hora(sinal.visto) : 'Nunca ligou'}>
    <i />{!estudioReal() ? 'Demo' : online ? (sinal?.info.ocupado ? 'Ligado · trabalhando' : 'Ligado') : 'Desligado'}
  </span>
  const canalEl = <section className="es-canal tbox">
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
  if (fechar) {
    const abas: [AbaEstudio, string][] = [...(aprova ? [['aprovar', 'Aprovar'] as [AbaEstudio, string]] : []), ['canais', 'Pedir arte'], ...(chat ? [['conversa', 'Conversa'] as [AbaEstudio, string]] : [])]
    return (
      <aside className={'es es-painel es-p-' + vendo} aria-label="Estúdio">
        <header className="es-p-top">
          <b className="grow es-tit"><Ph n="sparkle" size={18} /> Estúdio</b>
          {sinalEl}
          <button className="es-fechar" onClick={fechar} aria-label="Fechar o Estúdio" title="Fechar"><Ph n="x" size={18} /></button>
        </header>
        {abas.length > 1 && <nav className="es-abas">
          {abas.map(([id, label]) => <button key={id} className={vendo === id ? 'ativo' : ''} onClick={() => setAba(id)}>{label}{id === 'aprovar' && !!fila?.length && <i>{fila.length}</i>}</button>)}
        </nav>}
        {vendo === 'conversa' ? <Conversa msgs={msgs ?? []} erro={erroChat} puxar={puxarChat} />
          : vendo === 'aprovar' ? <Aprovar fila={fila} puxar={puxarFila} dono={dono} /> : canalEl}
      </aside>
    )
  }
  if (!adm && !coord && !aprova) return <div className="quadro"><div className="qbar"><b className="grow">Estúdio</b><Bell /></div><p className="es-vazio">O Estúdio é da coordenação. Peça uma publicação pra sua coordenação.</p></div>
  return (
    <div className="quadro es">
      <div className="qbar">
        <b className="grow es-tit"><Ph n="sparkle" size={18} /> Estúdio</b>
        {sinalEl}
        <Bell />
      </div>
      <div className={'es-grade' + (chat ? '' : ' so-canal') + (vendo === 'aprovar' ? ' aprovando' : '')}>
        {chat && <Conversa msgs={msgs ?? []} erro={erroChat} puxar={puxarChat} />}
        <div className="es-lado">
        {aprova && (adm || coord) && <nav className="es-abas">
          <button className={vendo === 'aprovar' ? 'ativo' : ''} onClick={() => setAba('aprovar')}>Aprovar{!!fila?.length && <i>{fila.length}</i>}</button>
          <button className={vendo === 'canais' ? 'ativo' : ''} onClick={() => setAba('canais')}>Canais</button>
        </nav>}
        {vendo === 'aprovar' ? <Aprovar fila={fila} puxar={puxarFila} dono={dono} /> : canalEl}
        </div>
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
                <Assunto p={p} editar={adm && (p.estado === 'fila' || p.estado === 'espera')} salvar={texto => acao(() => mudarPedido(p.id, { texto }))} />
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
              {adm && p.estado === 'espera' && <button className="tlink" onClick={() => acao(() => mudarPedido(p.id, { estado: 'fila' }))} title="Fotos e assunto prontos: o Estúdio gera na antecedência do canal">Liberar</button>}
              {adm && p.origem === 'calendario' && (p.estado === 'fila' || p.estado === 'espera') && <button className="tlink" onClick={() => acao(() => mudarPedido(p.id, { estado: 'pulado' }))} title="Não publica nesse dia">Pular</button>}
              {adm && p.estado === 'pulado' && <button className="tlink" onClick={() => acao(() => mudarPedido(p.id, { estado: p.origem === 'calendario' ? 'espera' : 'fila' }))}>Voltar</button>}
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

/** fila de aprovação: só peça gerada, slides grandes lado a lado, legenda e dia de publicar */
function Aprovar({ fila, puxar, dono }: { fila: ParaAprovar[] | null; puxar: () => void; dono: boolean }) {
  const [quem, setQuem] = useState(false)
  return (
    <section className="es-aprovar tbox">
      <header>
        <b className="grow">Aprovar</b>
        {dono && <button className="tlink" onClick={() => setQuem(!quem)}>{quem ? 'Fechar' : 'Quem aprova'}</button>}
      </header>
      {dono && quem && <QuemAprova />}
      {fila && !fila.length && <p className="es-vazio">Nada esperando aprovação. Quando o Estúdio terminar uma peça, ela aparece aqui.</p>}
      {!fila && <p className="es-vazio">Carregando…</p>}
      {(fila ?? []).map(p => <Peca key={p.task_id + p.ajustes} p={p} puxar={puxar} />)}
    </section>
  )
}

function Peca({ p, puxar }: { p: ParaAprovar; puxar: () => void }) {
  const [ajuste, setAjuste] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [aberta, setAberta] = useState<number | null>(null)
  const slides = p.anexos.filter(a => a.type.startsWith('image/') || a.type.startsWith('video/'))
  const outros = p.anexos.filter(a => !slides.includes(a))
  const vai = async (ok: boolean) => {
    if (busy) return
    if (!ok && (ajuste ?? '').trim().length < 3) { notify('Diga o que ajustar.'); return }
    setBusy(true)
    try {
      await decidir(p.task_id, ok, ok ? '' : ajuste!.trim())
      notify(ok ? 'Aprovada.' + (p.canal_nome ? ' Vai pra fila de publicar.' : '') : 'Pedido de ajuste enviado: o Estúdio refaz e volta pra cá.')
      puxar()
    } catch (e) { notify((e as Error).message) } finally { setBusy(false) }
  }
  return (
    <article className="es-peca">
      <div className="es-peca-top">
        <div className="grow">
          <b>{p.titulo}</b>
          <small className="muted">{[p.canal_nome, p.assunto, p.ajustes ? `${p.ajustes}º ajuste` : ''].filter(Boolean).join(' · ')}</small>
        </div>
        <span className="es-quando"><Ph n="calendar-blank" size={14} />{p.publicar ? 'Publica ' + hora(p.publicar) : 'Sem data'}</span>
      </div>
      <div className="es-slides">
        {slides.map((a, i) => <Slide key={a.id} a={a} n={i + 1} abrir={() => setAberta(i)} />)}
        {!slides.length && <p className="es-vazio">Sem imagem anexada.</p>}
      </div>
      {outros.length > 0 && <small className="muted">+ {outros.map(a => a.name).join(', ')}</small>}
      {p.legenda && <div className="es-legenda"><small>Legenda</small><p>{p.legenda}</p></div>}
      {ajuste === null
        ? <div className="es-decidir">
            <button className="tbtn" disabled={busy} onClick={() => setAjuste('')}>Pedir ajuste</button>
            <button className="tbtn acc" disabled={busy} onClick={() => vai(true)}><Ph n="check" size={16} /> Aprovar</button>
          </div>
        : <div className="es-form">
            <textarea autoFocus rows={3} maxLength={1000} value={ajuste} onChange={e => setAjuste(e.target.value)} placeholder="O que ajustar? Ex.: trocar a foto do slide 2, título mais curto, tirar o número 1.400" />
            <div className="es-decidir">
              <button className="tbtn" disabled={busy} onClick={() => setAjuste(null)}>Cancelar</button>
              <button className="tbtn acc" disabled={busy || ajuste.trim().length < 3} onClick={() => vai(false)}>Mandar ajuste</button>
            </div>
          </div>}
      {aberta !== null && slides[aberta] && <Grande a={slides[aberta]} fechar={() => setAberta(null)}
        ir={d => setAberta((aberta + d + slides.length) % slides.length)} />}
    </article>
  )
}

function useUrl(a: Attachment) {
  const [url, setUrl] = useState('')
  useEffect(() => { let vivo = true; fileUrl(a).then(u => vivo && setUrl(u), () => {}); return () => { vivo = false } }, [a.path]) // eslint-disable-line react-hooks/exhaustive-deps
  return url
}

function Slide({ a, n, abrir }: { a: Attachment; n: number; abrir: () => void }) {
  const url = useUrl(a)
  return (
    <button className="es-slide" onClick={abrir} title="Ver grande">
      {url ? (a.type.startsWith('video/') ? <video src={url} muted playsInline preload="metadata" /> : <img src={url} alt={a.name} loading="lazy" />) : <span className="es-slide-vazio" />}
      <i>{n}</i>
    </button>
  )
}

function Grande({ a, fechar, ir }: { a: Attachment; fechar: () => void; ir: (d: number) => void }) {
  const url = useUrl(a)
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') fechar(); if (e.key === 'ArrowRight') ir(1); if (e.key === 'ArrowLeft') ir(-1) }
    addEventListener('keydown', k); return () => removeEventListener('keydown', k)
  })
  return (
    <div className="es-grande" onClick={fechar}>
      <button className="es-seta" onClick={e => { e.stopPropagation(); ir(-1) }} aria-label="Anterior"><Ph n="caret-left" size={28} /></button>
      {url && (a.type.startsWith('video/') ? <video src={url} controls autoPlay onClick={e => e.stopPropagation()} /> : <img src={url} alt={a.name} onClick={e => e.stopPropagation()} />)}
      <button className="es-seta" onClick={e => { e.stopPropagation(); ir(1) }} aria-label="Próximo"><Ph n="caret-right" size={28} /></button>
    </div>
  )
}

/** só o dono: marca quem pode aprovar as peças do Estúdio */
function QuemAprova() {
  const profiles = useStore(s => s.profiles)
  const [marca, setMarca] = useState<Record<string, boolean>>({})
  const pessoas = Object.values(profiles).filter(p => !p.estudio_dono).sort((a, b) => a.name.localeCompare(b.name))
  const tem = (id: string) => marca[id] ?? !!profiles[id]?.aprova_estudio
  const trocar = (id: string) => {
    const sim = !tem(id)
    setMarca(m => ({ ...m, [id]: sim }))
    marcarAprovador(id, sim).catch(e => { setMarca(m => ({ ...m, [id]: !sim })); notify((e as Error).message) })
  }
  return (
    <div className="es-ajustes">
      <small className="muted">Quem tem a marca <b>Aprova Estúdio</b> vê esta fila e decide. Você sempre pode.</small>
      <div className="es-dias">
        {pessoas.map(p => <button key={p.id} className={'es-d' + (tem(p.id) ? ' on' : '')} onClick={() => trocar(p.id)}>{p.name}</button>)}
      </div>
    </div>
  )
}
