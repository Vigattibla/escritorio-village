import { useCallback, useEffect, useRef, useState } from 'react'
import { backend } from '../../data'
import { getState, useStore } from '../../store'
import type { AcaoMesa, MesaResumo, MesaVista, TipoMesa } from '../../../supabase/functions/_shared/jogos/mesa.ts'
import type { JogoProps } from '../../jogos/catalogo'
import Sinuca from './Sinuca'
import Cartas from './Cartas'
import './mesas.css'

export default function MesaOnline({ jogo, ...props }: JogoProps & { jogo: TipoMesa }) {
  const [mesa, setMesa] = useState<MesaVista | null>(null)
  const [lista, setLista] = useState<MesaResumo[]>([])
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const vivo = useRef(true), geracao = useRef(0)
  const profiles = useStore(s => s.profiles), me = getState().meId
  useEffect(() => { vivo.current = true; return () => { vivo.current = false; geracao.current++ } }, [])
  const guardar = useCallback((m: MesaVista) => { if (vivo.current) setMesa(old => old?.id === m.id && old.versao > m.versao ? old : m) }, [])
  const id = mesa?.id
  useEffect(() => {
    let cancelado = false, rodando = false
    const carregar = async () => {
      if (rodando) return
      rodando = true
      try {
        const r = await backend.mesas(id ? 'estado' : 'listar', id ? { id } : { jogo })
        if (cancelado) return
        if (r.mesa) guardar(r.mesa); else setLista(r.mesas ?? [])
        setErro('')
      } catch (e) { if (!cancelado) setErro(e instanceof Error ? e.message : 'Falha de conexão. Tentando novamente…') }
      finally { rodando = false; if (!cancelado) setCarregando(false) }
    }
    void carregar()
    const timer = setInterval(() => void carregar(), id ? 2500 : 5000)
    return () => { cancelado = true; clearInterval(timer) }
  }, [id, jogo, guardar])
  const abrir = async (join?: string) => {
    if (ocupado) return
    setOcupado(true); setErro('')
    const g = geracao.current
    try { const r = await backend.mesas(join ? 'entrar' : 'criar', join ? { id: join } : { jogo }); if (g === geracao.current && r.mesa) guardar(r.mesa) }
    catch (e) { if (vivo.current) setErro(e instanceof Error ? e.message : 'Não foi possível abrir a mesa.') }
    finally { if (vivo.current) setOcupado(false) }
  }
  const acao = async (a: AcaoMesa) => {
    if (!mesa || ocupado) return
    setOcupado(true); setErro('')
    try { const r = await backend.mesas('acao', { id: mesa.id, versao: mesa.versao, acao: a }); if (r.mesa) guardar(r.mesa) }
    catch (e) {
      if (vivo.current) setErro(e instanceof Error ? e.message : 'Falha ao jogar. Atualizando a mesa…')
      try { const r = await backend.mesas('estado', { id: mesa.id }); if (r.mesa) guardar(r.mesa) } catch { /* próxima consulta tenta novamente */ }
    } finally { if (vivo.current) setOcupado(false) }
  }
  const sair = async () => {
    if (!mesa || ocupado) return
    setOcupado(true)
    try { await backend.mesas('sair', { id: mesa.id }); if (vivo.current) { geracao.current++; setMesa(null); setLista([]); setCarregando(true) } }
    catch (e) { if (vivo.current) setErro(e instanceof Error ? e.message : 'Não foi possível sair.') }
    finally { if (vivo.current) setOcupado(false) }
  }
  const nome = (u: string | null) => u ? profiles[u]?.name ?? 'Colega' : 'Aguardando alguém'
  return <div className="mesa-raiz mesa-online">
    {erro && <p className="mesa-aviso" role="alert">{erro}</p>}
    {!mesa ? <>
      <h3>Jogar com outra pessoa</h3><p>{backend.mode === 'demo' ? 'Na demonstração, use duas contas em abas deste navegador.' : 'Crie uma mesa ou entre na mesa de um colega. Cada pessoa joga no seu aparelho.'}</p>
      <button className="mesa-btn mesa-forte" disabled={ocupado} onClick={() => void abrir()}>Criar mesa</button>
      {carregando ? <p role="status">Buscando mesas…</p> : !lista.length ? <p>Nenhuma mesa aberta. Crie a primeira.</p> : <ul className="mesa-lista">{lista.map(m => <li key={m.id}><span>{nome(m.dono)} · {m.estado === 'espera' ? '1 vaga' : m.estado === 'fim' ? 'Encerrada' : 'Em andamento'}</span><button className="mesa-btn" disabled={ocupado} onClick={() => void abrir(m.id)}>{m.dono === me || m.convidado === me ? 'Retomar' : 'Entrar'}</button></li>)}</ul>}
    </> : <>
      <div className="mesa-online-top"><span>{nome(mesa.dono)} × {nome(mesa.convidado)} · Você é Jogador {mesa.eu + 1}</span><button className="mesa-btn" disabled={ocupado} onClick={() => void sair()}>{mesa.estado === 'fim' ? 'Voltar às mesas' : 'Sair da mesa'}</button></div>
      {mesa.estado === 'espera' ? <p className="mesa-aviso" role="status">Mesa criada. Peça ao colega para abrir {jogo === 'cartas' ? 'UNO' : jogo === 'baralho' ? 'Baralho' : 'Sinuca'} → Com pessoas online → entrar na sua mesa.</p> : jogo === 'sinuca' ? <Sinuca {...props} rede={{ mesa, ocupado, acao }} /> : <Cartas {...props} baralho={jogo === 'baralho'} rede={{ mesa, ocupado, acao }} />}
    </>}
  </div>
}
