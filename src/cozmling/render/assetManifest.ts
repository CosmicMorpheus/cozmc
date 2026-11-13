/* The art for each adventurer look, and where things attach to it.

   What is here now is PLACEHOLDER art, cut from the concept sheets so the layout can be judged.
   It is flat (one image per look), so skin colour can't be changed on it yet. Production art
   replaces these entries one for one: `layers` and the anchors are what it will fill in.

   Positions are fractions of the full image: [across, down]. */
import type { ZodiacSign } from '../types'

export interface AdventurerArt {
  placeholder: boolean
  /** The whole figure, transparent background. */
  full: string
  /** width ÷ height of that image. */
  aspect: number
  /** A head-and-shoulders portrait made for small sizes (not the full figure shrunk). */
  compact: string
  /** How tall it stands in the Star Loft, as a share of the scene's height. */
  stands: number
  /** Is the orb already painted into the image? If not, the scene draws one at `orbHand`. */
  orbBaked: boolean
  anchors: { feet: [number, number]; head: [number, number]; chestGlyph: [number, number]; orbHand: [number, number]; /** reserved for the familiar; not used yet */ familiarFloor: [number, number] }
  /** Production art only: separate, aligned layers (body, skin mask, face, outfit, prop, orb). */
  layers?: Partial<Record<'body' | 'skin' | 'face' | 'outfit' | 'prop' | 'orb', string>>
}

const P = '/assets/cozmling/placeholder'
const ART: Partial<Record<`${ZodiacSign}-${'a' | 'b'}`, AdventurerArt>> = {
  'scorpio-a': { placeholder: true, full: `${P}/scorpio-a.webp`, aspect: 564 / 960, compact: `${P}/scorpio-a-sm.webp`, stands: 0.66, orbBaked: true, anchors: { feet: [0.5, 0.97], head: [0.55, 0.18], chestGlyph: [0.6, 0.33], orbHand: [0.86, 0.2], familiarFloor: [1.5, 0.97] } },
  'scorpio-b': { placeholder: true, full: `${P}/scorpio-b.webp`, aspect: 708 / 720, compact: `${P}/scorpio-b-sm.webp`, stands: 0.5, orbBaked: false, anchors: { feet: [0.5, 0.96], head: [0.27, 0.22], chestGlyph: [0.4, 0.5], orbHand: [0.02, 0.5], familiarFloor: [1.4, 0.96] } },
  'taurus-a': { placeholder: true, full: `${P}/taurus-a.webp`, aspect: 850 / 700, compact: `${P}/taurus-a-sm.webp`, stands: 0.5, orbBaked: false, anchors: { feet: [0.5, 0.97], head: [0.6, 0.25], chestGlyph: [0.55, 0.6], orbHand: [0.98, 0.3], familiarFloor: [1.3, 0.97] } },
  'taurus-b': { placeholder: true, full: `${P}/taurus-b.webp`, aspect: 637 / 720, compact: `${P}/taurus-b-sm.webp`, stands: 0.56, orbBaked: false, anchors: { feet: [0.5, 0.97], head: [0.5, 0.14], chestGlyph: [0.52, 0.62], orbHand: [1.0, 0.36], familiarFloor: [1.5, 0.97] } },
}

/** The art for a look, or undefined when it hasn't been made yet (the renderer then draws a stand-in). */
export const artFor = (sign: ZodiacSign, look: 'a' | 'b'): AdventurerArt | undefined => ART[`${sign}-${look}`]
/** The signs that have any art at all. */
export const signsWithArt = (): ZodiacSign[] => [...new Set(Object.keys(ART).map(k => k.split('-')[0] as ZodiacSign))]
export const LOFT_ROOM = '/assets/rooms/star-loft.webp'
