import { useEffect, useRef, useState } from 'react'
import PhotoPicker from '../components/PhotoPicker'
import { BOTTOMS, DEFAULT_AVATAR, drawAvatar, HAIR_COLORS, HAIR_STYLES, onPhotoLoad, OUTFITS, SHOES, SKINS, SPRITE_H, SPRITE_W, TOPS } from '../chibi/sprite'
import { backend } from '../data'
import { getState, saveProfile, setUi, signOut } from '../store'
import type { Avatar, Dir } from '../types'

const DIRS: Dir[] = ['down', 'right', 'up', 'left']
const pickOne = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)]

function Preview({ av, photo, walk }: { av: Avatar; photo: string | null; walk: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [dir, setDir] = useState(0)
  useEffect(() => {
    const cv = ref.current!
    const k = 9
    cv.width = SPRITE_W * k; cv.height = SPRITE_H * k
    const ctx = cv.getContext('2d')!
    let raf = 0
    const loop = (t: number) => {
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, cv.width, cv.height)
      ctx.setTransform(k, 0, 0, k, 0, 0)
      const f = walk ? ([1, 0, 2, 0] as const)[Math.floor(t / 140) % 4] : 0
      drawAvatar(ctx, av, photo, 0, 0, DIRS[dir], f)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    const off = photo ? onPhotoLoad(photo, () => {}) : undefined
    return () => { cancelAnimationFrame(raf); off?.() }
  }, [av, photo, walk, dir])
  return (
    <div className="preview">
      <canvas ref={ref} className="pixel" />
      <div className="row gap center">
        <button className="btn ghost sm" onClick={() => setDir(d => (d + 3) % 4)} aria-label="Girar">⟲</button>
        <button className="btn ghost sm" onClick={() => setDir(d => (d + 1) % 4)} aria-label="Girar">⟳</button>
      </div>
    </div>
  )
}

function Swatches({ colors, value, onPick }: { colors: string[]; value: string; onPick: (c: string) => void }) {
  return (
    <div className="swatches">
      {colors.map(c => <button key={c} className={'sw' + (c === value ? ' on' : '')} style={{ background: c }} onClick={() => onPick(c)} aria-label={c} />)}
      <label className="sw custom" title="Outra cor"><input type="color" value={value} onChange={e => onPick(e.target.value)} />+</label>
    </div>
  )
}

export default function Creator() {
  const s = getState()
  const prev = s.meId ? s.profiles[s.meId] : undefined
  const [name, setName] = useState(prev?.name ?? s.accountName)
  const [role, setRole] = useState(prev?.role ?? '')
  const [av, setAv] = useState<Avatar>(prev?.avatar ?? DEFAULT_AVATAR)
  const [photo, setPhoto] = useState<string | null>(prev?.photo ?? null)
  const [picking, setPicking] = useState(false)
  const [walk, setWalk] = useState(true)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const editing = !!prev?.avatar
  const upd = (p: Partial<Avatar>) => setAv(a => ({ ...a, ...p }))

  const random = () => setAv(a => ({
    ...a, skin: pickOne(SKINS), hair: pickOne(HAIR_STYLES).id, hairColor: pickOne(HAIR_COLORS), outfit: pickOne(OUTFITS).id,
    top: pickOne(TOPS), bottom: pickOne(BOTTOMS), shoes: pickOne(SHOES),
  }))

  const uploaded = async (b: Blob) => {
    const url = await backend.uploadPhoto(s.meId!, b)
    setPhoto(url)
    upd({ face: 'foto' })
    setPicking(false)
  }

  const save = async () => {
    setBusy(true); setErr('')
    try { await saveProfile({ name, role, avatar: { ...av, face: av.face === 'foto' && photo ? 'foto' : 'pixel' }, photo }) }
    catch (e) { setErr((e as Error).message) }
    finally { setBusy(false) }
  }

  return (
    <div className="creator">
      <div className="creator-card">
        <header>
          <h1>{editing ? 'Editar personagem' : 'Monte seu personagem'}</h1>
          <p className="muted">É assim que a equipe vai te ver no escritório. Dá pra mudar depois.</p>
        </header>
        <div className="creator-grid">
          <div className="creator-left">
            <Preview av={av} photo={av.face === 'foto' ? photo : null} walk={walk} />
            <label className="row gap small"><input type="checkbox" checked={walk} onChange={e => setWalk(e.target.checked)} /> Andando</label>
            <button className="btn ghost sm" onClick={random}>🎲 Aleatório</button>
          </div>
          <div className="creator-right">
            <div className="two">
              <label>Nome<input value={name} onChange={e => setName(e.target.value)} maxLength={40} /></label>
              <label>Função<input value={role} onChange={e => setRole(e.target.value)} placeholder="Ex.: Recepção" maxLength={40} /></label>
            </div>

            <fieldset>
              <legend>Rosto</legend>
              <div className="seg">
                <button className={av.face === 'pixel' ? 'on' : ''} onClick={() => upd({ face: 'pixel' })}>Pixel</button>
                <button className={av.face === 'foto' ? 'on' : ''} onClick={() => (photo ? upd({ face: 'foto' }) : setPicking(true))}>Minha foto</button>
              </div>
              {picking && <PhotoPicker onDone={uploaded} onCancel={() => setPicking(false)} />}
              {!picking && av.face === 'foto' && photo && (
                <div className="row gap">
                  <label className="row gap small"><input type="checkbox" checked={av.pixelPhoto} onChange={e => upd({ pixelPhoto: e.target.checked })} /> Foto pixelada (combina com o estilo)</label>
                  <button className="btn ghost sm" onClick={() => setPicking(true)}>Trocar foto</button>
                </div>
              )}
            </fieldset>

            <fieldset>
              <legend>Pele</legend>
              <Swatches colors={SKINS} value={av.skin} onPick={c => upd({ skin: c })} />
            </fieldset>

            <fieldset>
              <legend>Cabelo</legend>
              <div className="chips">
                {HAIR_STYLES.map(h => <button key={h.id} className={'opt' + (av.hair === h.id ? ' on' : '')} onClick={() => upd({ hair: h.id })}>{h.label}</button>)}
              </div>
              <Swatches colors={HAIR_COLORS} value={av.hairColor} onPick={c => upd({ hairColor: c })} />
            </fieldset>

            <fieldset>
              <legend>Roupa</legend>
              <div className="chips">
                {OUTFITS.map(o => <button key={o.id} className={'opt' + (av.outfit === o.id ? ' on' : '')} onClick={() => upd({ outfit: o.id })}>{o.label}</button>)}
              </div>
              <div className="sub">Parte de cima</div>
              <Swatches colors={TOPS} value={av.top} onPick={c => upd({ top: c })} />
              {av.outfit !== 'vestido' && <><div className="sub">Parte de baixo</div><Swatches colors={BOTTOMS} value={av.bottom} onPick={c => upd({ bottom: c })} /></>}
              <div className="sub">Sapatos</div>
              <Swatches colors={SHOES} value={av.shoes} onPick={c => upd({ shoes: c })} />
            </fieldset>
          </div>
        </div>
        {err && <p className="err">{err}</p>}
        <footer className="row gap end">
          {editing ? <button className="btn ghost" onClick={() => setUi({ editing: false })} disabled={busy}>Cancelar</button>
            : <button className="btn ghost" onClick={() => signOut()} disabled={busy}>Sair</button>}
          <button className="btn primary big" onClick={save} disabled={busy || picking || !name.trim()}>
            {busy ? 'Salvando…' : editing ? 'Salvar' : 'Entrar no escritório →'}
          </button>
        </footer>
      </div>
    </div>
  )
}
