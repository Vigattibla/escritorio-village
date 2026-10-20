import { useCallback, useEffect, useState } from 'react'
import Cassino from './Cassino'
import Bingo from './Bingo'
import Game from './Game'
import Jogos from './Jogos'
import SalaEditor from './SalaEditor'
import Loja from './Loja'
import Armario from './Armario'
import type { Jogo } from '../office/world'
import BloqueioJogos from './BloqueioJogos'
import { Bell, Toast } from './Avisos'
import FloatChat from './FloatChat'
import { Ph } from './Icon'
import { confirmar } from './Dialogo'
import { ITEMS } from '../shop/catalog'
import { cassinoPainel, cassinoPresente, cassinoTaxa, primeiroNome, refreshWallet, setUi, signOut, torneioCriar, useStore } from '../store'
import type { CassinoPainel, Torneio } from '../types'

// conta "só cassino": joga, cuida do imposto da casa e marca torneios (tudo com teto no servidor)
const JOGO: Record<Torneio['jogo'], string> = { todos: 'Todos os jogos', caca: 'Caça-níquel', roleta: 'Roleta', blackjack: 'Blackjack', crash: 'Crash', minas: 'Minas' }
const hora = (iso: string) => new Date(iso).toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })

export default function ContaCassino() {
  const eu = useStore(s => (s.meId ? s.profiles[s.meId] : undefined))
  const wallet = useStore(s => s.wallet)
  const [aberto, setAberto] = useState<'cassino' | 'bingo' | null>(null)
  // painel do cassino, sala de jogos ou loja de roupas (sem os painéis do escritório)
  const [view, setView] = useState<'painel' | 'sala' | 'loja'>('painel')
  const sala = view === 'sala'
  const [arrumando, setArrumando] = useState(false)
  const armario = useStore(s => s.armario)
  // "Ir ao Almoxarifado" do armário pede a view loja do store
  const uiView = useStore(s => s.view)
  useEffect(() => { if (uiView === 'loja') { setView('loja'); setArrumando(false); setUi({ view: 'quadro' }) } }, [uiView])
  const uiCassino = useStore(s => s.cassino), uiBingo = useStore(s => s.bingo), uiJogo = useStore(s => s.jogo)
  const [p, setP] = useState<CassinoPainel | null>(null)
  const [erro, setErro] = useState('')
  const [taxa, setTaxa] = useState(10)
  const [jogo, setJogo] = useState<Torneio['jogo']>('todos')
  const [premio, setPremio] = useState(30)
  const [horas, setHoras] = useState(3)
  const [busy, setBusy] = useState(false)
  // presente: cafezinho ou item da loja pra alguém do escritório
  const gente = useStore(s => s.profiles)
  const pessoas = Object.values(gente).filter(x => !x.cassino && x.id !== eu?.id).sort((a, b) => a.name.localeCompare(b.name))
  const [para, setPara] = useState('')
  const [tipo, setTipo] = useState<'cafe' | 'item'>('cafe')
  const [valor, setValor] = useState(10)
  const [item, setItem] = useState('')
  const [nota, setNota] = useState('')
  const [deu, setDeu] = useState('')

  const carrega = useCallback(async () => {
    try { const r = await cassinoPainel(); setP(r); setTaxa(r.taxa) } catch (e) { setErro((e as Error).message) }
  }, [])
  useEffect(() => { void carrega(); void refreshWallet() }, [carrega])
  useEffect(() => { if (!aberto) void carrega() }, [aberto, carrega])

  const faz = async (fn: () => Promise<unknown>) => {
    setBusy(true); setErro('')
    try { await fn(); await carrega() } catch (e) { setErro((e as Error).message) } finally { setBusy(false) }
  }
  const salvaTaxa = async () => {
    if (!p || taxa === p.taxa) return
    const ok = await confirmar(`Mudar o imposto para ${taxa}%?`, { text: 'Só dá pra mudar uma vez por dia e o aviso sai no canal geral. Sai das apostas perdidas: quem joga não paga a mais.', ok: 'Mudar imposto', ic: 'coffee' })
    if (ok) await faz(() => cassinoTaxa(taxa))
  }
  const criaTorneio = async () => {
    const ok = await confirmar(`Abrir torneio de ${premio} ☕?`, { text: `${JOGO[jogo]} por ${horas} h. O prêmio sai do seu saldo agora; ganha quem lucrar mais no período. Se menos de 2 pessoas fecharem no lucro, o prêmio volta pra você.`, ok: 'Abrir torneio', ic: 'trophy' })
    if (ok) await faz(() => torneioCriar(jogo, premio, horas))
  }

  const hoje = new Date().toDateString()
  const dadosHoje = (wallet?.log ?? []).filter(l => l.reason === 'presente' && l.amount < 0 && new Date(l.created_at).toDateString() === hoje)
  const sobra = Math.max(0, 90 - dadosHoje.reduce((n, l) => n - l.amount, 0)), presentesHoje = dadosHoje.length
  const custo = tipo === 'cafe' ? valor : ITEMS.find(i => i.id === item)?.price ?? 0
  const darPresente = async () => {
    const quem = gente[para]
    if (!quem || !custo) return
    const oque = tipo === 'cafe' ? `${valor} ☕` : ITEMS.find(i => i.id === item)?.name ?? 'o item'
    const ok = await confirmar(`Dar ${oque} pra ${quem.name}?`, { text: `Sai do seu saldo (${custo} ☕). O aviso aparece no canal geral.`, ok: 'Dar presente', ic: 'gift' })
    if (!ok) return
    setDeu('')
    await faz(async () => { await cassinoPresente(para, valor, tipo === 'item' ? item : null, nota); setDeu(`Presente entregue pra ${quem.name}.`); setNota('') })
  }
  const c = p?.casa
  const t = p?.torneio
  const saldo = wallet?.balance ?? 0
  return (
    <div className="cc">
      <header className="cc-top">
        <span className="cc-logo">🎰</span>
        <div className="grow"><b>{eu?.name ?? 'Cassino'}</b><small>Gerente do cassino</small></div>
        {view !== 'painel' && <button className="btn ghost sm" onClick={() => { setView('painel'); setArrumando(false) }}>Painel</button>}
        {view !== 'sala' && <button className="btn ghost sm" onClick={() => { setView('sala'); setArrumando(false) }}>🎰 Andar</button>}
        {view !== 'loja' && <button className="btn ghost sm" onClick={() => { setView('loja'); setArrumando(false) }}>👕 Loja</button>}
        <Bell />
        <span className="cs-saldo"><Ph n="coffee" size={16} fill /> <b>{wallet ? saldo : '…'}</b></span>
        <button className="btn ghost sm" onClick={() => void signOut()}>Sair</button>
      </header>

      {sala ? <section className="cc-sala">
        {arrumando ? <SalaEditor comodo onClose={() => setArrumando(false)} /> : <div className="game-wrap"><Game />
          <button className="btn primary sm game-edit" onClick={() => setArrumando(true)}>🪚 Arrumar sala de jogos</button></div>}
      </section> : view === 'loja' ? <section className="cc-loja"><Loja /></section> :
      <main className="cc-main">
        <section className="cc-jogos">
          <button className="cc-card cassino" onClick={() => setAberto('cassino')}><span>🎲</span><b>Cassino</b><small>Caça-níquel, roleta, blackjack, crash e minas</small></button>
          <button className="cc-card bingo" onClick={() => setAberto('bingo')}><span>🎱</span><b>Salão de Bingo</b><small>Cartelas e sorteio com todo mundo</small></button>
        </section>

        {erro && <p className="cs-erro">{erro}</p>}

        {c && <section className="cc-box">
          <h2>Hoje na casa</h2>
          <div className="cc-nums">
            <div><b>{c.perdido}</b><small>☕ apostados e perdidos</small></div>
            <div><b>{c.pago}<i>/{c.teto}</i></b><small>☕ de imposto pra você</small></div>
            <div><b>+{c.mesada}</b><small>☕ de mesada por dia</small></div>
            <div><b>{c.semana}<i>/3</i></b><small>torneios na semana</small></div>
          </div>
          <div className="cc-taxa">
            <label className="grow">Imposto da casa <b>{taxa}%</b>
              <input type="range" min={0} max={15} step={1} value={taxa} disabled={!c.podeMudar || busy} onChange={e => setTaxa(Number(e.target.value))} />
            </label>
            <button className="btn primary sm" disabled={!c.podeMudar || busy || taxa === p.taxa} onClick={salvaTaxa}>Salvar</button>
          </div>
          <small className="jg-note">{c.podeMudar ? 'De 0 a 15%, sobre as apostas que os outros perdem. Muda uma vez por dia.' : 'Imposto já mudou hoje. Amanhã dá pra trocar de novo.'} Teto de {c.teto} ☕ por dia.</small>
        </section>}

        <section className="cc-box">
          <h2><Ph n="trophy" size={18} /> Torneio</h2>
          {t ? <div className="cc-tor">
            <p><b>{JOGO[t.jogo]}</b> · prêmio <b>{t.premio} ☕</b> · termina {hora(t.fim)}</p>
            {t.placar?.length ? <ol>{t.placar.map(l => <li key={l.u}><span className="grow">{primeiroNome(l.u)}</span><small>{l.rodadas} rodadas</small><b className={l.lucro > 0 ? 'pos' : 'neg'}>{l.lucro > 0 ? '+' : ''}{l.lucro}</b></li>)}</ol>
              : <small className="jg-note">Ninguém jogou ainda.</small>}
            <small className="jg-note">Só um torneio por vez. Você não entra no placar.</small>
          </div> : c && c.semana >= 3 ? <small className="jg-note">Já foram 3 torneios nesta semana. Na próxima dá pra abrir de novo.</small> : <div className="cc-form">
            <label>Jogo<select value={jogo} onChange={e => setJogo(e.target.value as Torneio['jogo'])}>
              {Object.entries(JOGO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select></label>
            <label>Prêmio (☕)<input type="number" min={10} max={100} value={premio} onChange={e => setPremio(Math.max(10, Math.min(100, Math.round(Number(e.target.value) || 10))))} /></label>
            <label>Duração (h)<input type="number" min={1} max={12} value={horas} onChange={e => setHoras(Math.max(1, Math.min(12, Math.round(Number(e.target.value) || 1))))} /></label>
            <button className="btn primary" disabled={busy || saldo < premio} onClick={criaTorneio}>{saldo < premio ? 'Saldo curto' : 'Abrir torneio'}</button>
          </div>}
          {!!p?.historico.length && <div className="cs-hist cc-hist">
            <small>Últimos torneios</small>
            {p.historico.map(h => <div key={h.id}><span className="grow">{JOGO[h.jogo]} · {h.premio} ☕</span><b>{h.estado === 'pago' && h.vencedor ? primeiroNome(h.vencedor) : h.estado === 'cancelado' ? 'cancelado' : 'devolvido'}</b></div>)}
          </div>}
        </section>

        <section className="cc-box">
          <h2><Ph n="gift" size={18} /> Presente</h2>
          {presentesHoje >= 3 || sobra < 1 ? <small className="jg-note">Já foram os presentes de hoje. Amanhã tem mais.</small> : <div className="cc-form">
            <label>Pra quem<select value={para} onChange={e => { setPara(e.target.value); setDeu('') }}>
              <option value="">Escolha…</option>
              {pessoas.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select></label>
            <label>O quê<select value={tipo} onChange={e => setTipo(e.target.value as 'cafe' | 'item')}>
              <option value="cafe">Cafezinhos</option><option value="item">Item da loja</option>
            </select></label>
            {tipo === 'cafe' ? <label>Quantos (☕)<input type="number" min={1} max={Math.min(30, sobra)} value={valor} onChange={e => setValor(Math.max(1, Math.min(30, sobra, Math.round(Number(e.target.value) || 1))))} /></label>
              : <label>Item<select value={item} onChange={e => setItem(e.target.value)}>
                <option value="">Escolha…</option>
                {ITEMS.filter(i => i.price <= sobra).map(i => <option key={i.id} value={i.id}>{i.name} · {i.price} ☕</option>)}
              </select></label>}
            <label className="cc-nota">Recado (opcional)<input maxLength={80} value={nota} onChange={e => setNota(e.target.value)} placeholder="Parabéns pela semana!" /></label>
            <button className="btn primary" disabled={busy || !para || !custo || custo > sobra || saldo < custo} onClick={darPresente}>{saldo < custo ? 'Saldo curto' : 'Dar presente'}</button>
          </div>}
          {deu && <small className="jg-note">✓ {deu}</small>}
          <small className="jg-note">Sai do seu saldo. Até 3 presentes e 90 ☕ por dia (sobram {sobra} ☕ hoje). Cafezinho: de 1 a 30 por vez.</small>
        </section>
      </main>}

      {aberto === 'cassino' && <Cassino onClose={() => setAberto(null)} />}
      {aberto === 'bingo' && <Bingo onClose={() => setAberto(null)} />}
      {/* na sala: as máquinas abrem pelo store, igual no escritório */}
      {uiCassino && <Cassino inicial={typeof uiCassino === 'string' ? uiCassino : undefined} onClose={() => setUi({ cassino: false })} />}
      {uiBingo && <Bingo onClose={() => setUi({ bingo: false })} />}
      {uiJogo && <Jogos inicio={uiJogo as Jogo} onClose={() => setUi({ jogo: null })} />}
      {armario && <Armario onClose={() => setUi({ armario: false })} />}
      <FloatChat />
      <BloqueioJogos />
      <Toast />
    </div>
  )
}
