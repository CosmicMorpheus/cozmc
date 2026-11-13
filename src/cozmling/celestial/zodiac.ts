/* Small shared pieces: the twelve signs in zodiac order, planet names and glyphs, and angles. */
import { SIGNS } from '../domain/starprint'
import type { ZodiacSign } from '../types'
import type { BodyId, PointId } from './types'

/** Aries to Pisces, each covering 30° of the zodiac starting from the spring equinox. */
export const ZODIAC: ZodiacSign[] = SIGNS.map(s => s.sign)
export const BODIES: BodyId[] = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto']

export const norm360 = (deg: number) => ((deg % 360) + 360) % 360
/** -180 ≤ x < 180 */
export const wrap180 = (deg: number) => norm360(deg + 180) - 180
export const rad = (deg: number) => (deg * Math.PI) / 180
export const deg = (r: number) => (r * 180) / Math.PI
export const round6 = (x: number) => Math.round(x * 1e6) / 1e6
export const signAt = (lon: number): ZodiacSign => ZODIAC[Math.floor(norm360(lon) / 30) % 12]
export const degreeIn = (lon: number) => norm360(lon) % 30

/* Glyphs carry U+FE0E so phones show the symbol, not an emoji. */
const T = '︎'
export const POINTS: Record<PointId, { name: string; glyph: string; short: string }> = {
  sun: { name: 'Sun', glyph: `☉${T}`, short: 'Sun' },
  moon: { name: 'Moon', glyph: `☽${T}`, short: 'Moon' },
  mercury: { name: 'Mercury', glyph: `☿${T}`, short: 'Mercury' },
  venus: { name: 'Venus', glyph: `♀${T}`, short: 'Venus' },
  mars: { name: 'Mars', glyph: `♂${T}`, short: 'Mars' },
  jupiter: { name: 'Jupiter', glyph: `♃${T}`, short: 'Jupiter' },
  saturn: { name: 'Saturn', glyph: `♄${T}`, short: 'Saturn' },
  uranus: { name: 'Uranus', glyph: `♅${T}`, short: 'Uranus' },
  neptune: { name: 'Neptune', glyph: `♆${T}`, short: 'Neptune' },
  pluto: { name: 'Pluto', glyph: `♇${T}`, short: 'Pluto' },
  ascendant: { name: 'Rising sign', glyph: 'AC', short: 'Rising' },
  midheaven: { name: 'Midheaven', glyph: 'MC', short: 'Midheaven' },
}

/** 14°22′ (degrees and whole minutes into a sign; minutes are cut, never rounded up into the next sign). */
export function dms(degree: number): string {
  const d = Math.floor(degree), m = Math.floor((degree - d) * 60)
  return `${d}°${String(m).padStart(2, '0')}′`
}
export const ORDINAL = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th']
