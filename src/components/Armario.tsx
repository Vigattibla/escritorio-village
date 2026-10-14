import { useEffect, useState } from 'react'
import { drawAvatar } from '../chibi/sprite'
import { drawAnim } from '../office/anim'
import { ITEMS, SLOTS, TIER_NAME, type Item } from '../shop/catalog'
import { equip, owns, run, setUi, useStore } from '../store'
import type { Gear } from '../types'
import { Fundo } from './Fundo'
import { Ph } from './Icon'
import { Plate, Thumb, deskScene, wear } from './Loja'
import { Px } from './Px'

/** Armário: só o que a pessoa já tem, separado por gaveta; clique veste ou tira */
export default function Armario({ onClose }: { onClose: () => void }) {
  const wallet = useStore(s => s.wallet)
  const p = useStore(s => (s.meId ? s.profiles[s.meId] : undefined))
  const [hover, setHover] = useState<Item | null>(null)
  const [busy, setBusy] = useState('')
  const [erro, setErro] = useState('')
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  if (!p?.avatar) return null
  const av = p.avatar, gear = av.gear ?? {}, first = p.name.split(' ')[0]
  const meus = ITEMS.filter(i => owns(i.id, wallet))
  const prev = hover ? wear(av, hover.slot, hover.art) : av
  const using = (i: Item) => i.slot === 'cabelo' ? av.hair === i.art : i.slot === 'roupa' ? av.outfit === i.art : gear[i.slot as keyof Gear] === i.art
  const toggle = (i: Item) => {
    const off = using(i) && i.slot !== 'cabelo' && i.slot !== 'roupa'
    setBusy(i.id); setErro('')
    run(equip(i.slot, off ? null : i.art).catch(e => setErro((e as Error).message)).finally(() => { setBusy(''); setHover(null) }))
  }
  const gavetas = SLOTS.map(s => ({ ...s, itens: meus.filter(i => i.slot === s.id) })).filter(g => g.itens.length)

  return (
    <Fundo className="modal-bg" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <section className="jan jg ar" role="dialog" aria-label="Meu armário">
        <div className="jg-bar">
          <h2>🚪 Meu armário</h2>
          <span className="ar-sub">{meus.length} {meus.length === 1 ? 'coisa' : 'coisas'} suas</span>
          <span className="grow" />
          <button className="btn ghost sm" onClick={onClose} aria-label="Fechar"><Ph n="x" size={18} /></button>
        </div>
        <div className="ar-corpo">
          <aside className="ar-espelho">
            <div className="lj-stage">
              <Px w={40} h={44} s={5} draw={(c, t) => { drawAvatar(c, prev, null, 12, 12, 'down', Math.floor(t / 400) % 3 === 1 ? 1 : 0); drawAnim(c, prev.gear?.animacao, 20, 15, t) }} />
              <Plate kind={prev.gear?.plaquinha} name={first} />
            </div>
            <Px w={90} h={60} s={3} className="lj-desk" draw={(c, t) => deskScene(c, prev, t, 6, 4)} />
            <small className="muted">{hover ? <>Passe o mouse pra ver; clique pra {using(hover) ? 'tirar' : 'vestir'}.</> : 'Clique numa peça pra vestir ou tirar.'}</small>
            {erro && <div className="lj-msg err">{erro}</div>}
            <button className="btn soft sm" onClick={() => { onClose(); setUi({ view: 'loja', drawer: false }) }}><Ph n="coffee" size={16} /> Ir ao Almoxarifado</button>
          </aside>
          <div className="ar-gavetas">
            {!gavetas.length && <div className="ar-vazio">
              <b>Seu armário está vazio.</b>
              <span>Compre no Almoxarifado ou ganhe no bingo e no bolão: tudo que for seu aparece aqui.</span>
            </div>}
            {gavetas.map(g => <div key={g.id} className="ar-gaveta">
              <h4>{g.label} <small>{g.itens.length}</small></h4>
              <div className="lj-grid">
                {g.itens.map(i => {
                  const on = using(i)
                  return <button key={i.id} disabled={busy === i.id} className={`lj-card t${i.tier}${on ? ' use' : ''}`}
                    onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={() => toggle(i)}>
                    <Thumb it={i} av={av} name={first} />
                    <b>{i.name}</b>
                    <span className="lj-tier">{i.bingo ? '🎱 Do bingo' : i.bolao ? '🍀 Do bolão' : TIER_NAME[i.tier]}</span>
                    <span className="lj-price">{busy === i.id ? '…' : on ? '✓ Usando' : 'Vestir'}</span>
                  </button>
                })}
              </div>
            </div>)}
          </div>
        </div>
      </section>
    </Fundo>
  )
}
