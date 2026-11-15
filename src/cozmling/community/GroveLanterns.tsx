/* The Grove's twelve zodiac lanterns, Aries to Pisces. Each is the same glass lantern (the brand package's
   artwork), lit or dark on its own, with its sign drawn on the glass; they fill in zodiac order as the
   community's shared count rises. One garland of twelve where there's room, two rows of six on a phone
   (communityHatch.css). */
import { Glyph } from '../components/Glyph'
import { signInfo } from '../domain/starprint'
import { GROVE_SIGNS } from './communityHatch'

export function GroveLanterns({ lit }: { lit: number }) {
  const shown = Math.max(0, Math.min(GROVE_SIGNS.length, lit))
  return (
    <ol className="community-hatch__lanterns" role="list" aria-label="Zodiac lanterns" data-lit-count={shown}>
      {GROVE_SIGNS.map((sign, index) => {
        const { name, element } = signInfo(sign)
        const on = index < shown
        return (
          <li key={sign} className="community-hatch__lantern" data-sign={sign} data-element={element} data-lit={on} title={name}>
            <span className="community-hatch__globe" aria-hidden="true" />
            {/* strokes for every sign: a font's zodiac characters come out as emoji on some phones */}
            <Glyph sign={sign} size={28} className="community-hatch__sign" drawn />
            <span className="sr-only">{name} lantern: {on ? 'lit' : 'unlit'}</span>
          </li>
        )
      })}
    </ol>
  )
}
