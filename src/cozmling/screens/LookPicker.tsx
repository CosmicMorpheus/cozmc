/* The choices that make up how an adventurer looks: one of two looks, and a skin colour. Used when
   adopting and again in the wardrobe. Identity (the Starprint) is not here: nothing on this panel can
   change it. In the original scene (the default), Look A and Look B are the original Cozmling's two
   forms, the skin colour is its body colour, and its antenna glows in its element's colour. */
import type { CSSProperties } from 'react'
import { SKINS } from '../domain/adventurer'
import { ELEMENTS, signInfo } from '../domain/starprint'
import { artFor } from '../render/assetManifest'
import { OriginalPortrait } from '../components/OriginalPortrait'
import { ADVENTURER_SCENE, adventurerLook } from '../integrations/originalScene'
import type { ZodiacSign } from '../types'
import { Glyph } from '../components/Glyph'

export function LookPicker({ sign, look, skin, onLook, onSkin, idBase }: { sign: ZodiacSign; look: 'a' | 'b'; skin: string; onLook: (l: 'a' | 'b') => void; onSkin: (s: string) => void; idBase: string }) {
  const info = signInfo(sign), [o1, o2] = ELEMENTS[info.element].orb
  const original = ADVENTURER_SCENE === 'original'
  const flat = !original && (['a', 'b'] as const).some(l => artFor(sign, l)?.placeholder)
  return (
    <>
      <fieldset className="sl-looks">
        <legend>Look</legend>
        <div className="sl-looks__row" style={{ '--o1': o1, '--o2': o2, '--skin': SKINS.find(s => s.id === skin)?.color } as CSSProperties}>
          {(['a', 'b'] as const).map(l => {
            const art = original ? null : artFor(sign, l)
            return (
              <label key={l} className={`sl-look${look === l ? ' is-on' : ''}`}>
                <input type="radio" name={`${idBase}-look`} value={l} checked={look === l} onChange={() => onLook(l)} />
                <span className={`sl-look__art${original ? ' sl-look__art--pixel' : ''}`}>
                  {original ? <OriginalPortrait look={adventurerLook({ look: l, skin, element: info.element })} />
                    : art ? <img src={art.compact} alt="" width={256} height={256} /> : <Glyph sign={sign} size={44} />}
                </span>
                <span className="sl-look__name">Look {l.toUpperCase()}</span>
                {!original && !art && <span className="sl-look__note">art on its way</span>}
              </label>
            )
          })}
        </div>
      </fieldset>
      <fieldset className="sl-skins">
        <legend>Skin colour</legend>
        <div className="sl-skins__row">
          {SKINS.map(s => (
            <label key={s.id} className={`sl-skin${skin === s.id ? ' is-on' : ''}`} title={s.name}>
              <input type="radio" name={`${idBase}-skin`} value={s.id} checked={skin === s.id} onChange={() => onSkin(s.id)} />
              <span className="sl-skin__dot" style={{ background: s.color }} />
              <span className="sr-only">{s.name}</span>
            </label>
          ))}
        </div>
        <p className="sl-fine">Any Cozmling can have any skin colour: it never depends on the element.{original && <> Its antenna glows in its element’s colour ({ELEMENTS[info.element].name.toLowerCase()}).</>}{flat && <> The placeholder art can’t be recoloured yet, so for now your choice is saved and shown as the ring around the portrait.</>}</p>
      </fieldset>
    </>
  )
}
