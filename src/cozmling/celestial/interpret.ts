/* ============================================================
   WHAT A SKY MIGHT MEAN: symbolic words, written for COZMC.

   This file only reads a chart; it never changes one. Everything here is phrased as symbol and
   possibility ("symbolises", "may"), never as a fixed trait or a prediction: a Cozmling's sky
   offers themes, and the life it shares with its player decides who it becomes.
   ============================================================ */
import { signInfo, ELEMENTS } from '../domain/starprint'
import type { ZodiacSign } from '../types'
import type { Aspect, AspectKind, CelestialBirthRecord, MoonPhaseName, Pattern, PointId } from './types'
import { dms, ORDINAL, POINTS } from './zodiac'

const THEME: Record<PointId, string> = {
  sun: 'its core spark: what it is drawn toward, and what makes it shine',
  moon: 'its relationship with comfort, familiarity and feeling safe',
  mercury: 'its curiosity, and the way it makes sense of things and shares them',
  venus: 'what it finds beautiful, and the way it shows affection',
  mars: 'its courage, and the way it rushes in or takes its time',
  jupiter: 'where it grows, and its sense of hope and generosity',
  saturn: 'patience, and the lessons that take time to learn',
  uranus: 'surprise, invention and its need to be itself',
  neptune: 'dreams, imagination and quiet intuition',
  pluto: 'deep change, and the strength it finds when things are hard',
  ascendant: 'the way it first meets the world, and how others first see it',
  midheaven: 'what it reaches for in the long run',
}
/** The same, in two or three words, for aspects. */
export const SHORT: Record<PointId, string> = {
  sun: 'its spark', moon: 'its feelings', mercury: 'its thinking', venus: 'its affection', mars: 'its drive', jupiter: 'its hopes',
  saturn: 'its patience', uranus: 'its originality', neptune: 'its dreams', pluto: 'its inner strength', ascendant: 'its first impressions', midheaven: 'its long-term aims',
}
export const TONE: Record<ZodiacSign, string> = {
  aries: 'bold, eager and quick to begin', taurus: 'steady, patient and fond of comfort', gemini: 'curious, lively and full of questions',
  cancer: 'tender, protective and close to home', leo: 'warm-hearted, playful and proud', virgo: 'careful, thoughtful and helpful',
  libra: 'fair, graceful and drawn to harmony', scorpio: 'deep, private and fiercely loyal', sagittarius: 'adventurous, hopeful and free',
  capricorn: 'determined, practical and quietly ambitious', aquarius: 'inventive, independent and friendly to all', pisces: 'dreamy, gentle and full of imagination',
}
export const HOUSE: string[] = [
  'itself, and first impressions', 'comfort, keepsakes and what it values', 'curiosity, chatter and the places close by', 'home, roots and feeling safe',
  'play, creativity and joy', 'daily routines, care and being useful', 'close friendships and partners', 'trust, secrets and deep bonds',
  'adventure, faraway places and big ideas', 'goals, purpose and being seen', 'friends, community and shared hopes', 'dreams, rest and quiet time alone',
]
export const ASPECT_WORDS: Record<AspectKind, { word: string; phrase: string; mood: 'blend' | 'flow' | 'tension' }> = {
  conjunction: { word: 'conjunct', phrase: 'blended together, so each colours the other', mood: 'blend' },
  sextile: { word: 'sextile', phrase: 'an easy opening between them, there for the taking', mood: 'flow' },
  square: { word: 'square', phrase: 'a creative tension that pushes it to grow', mood: 'tension' },
  trine: { word: 'trine', phrase: 'a natural, flowing harmony', mood: 'flow' },
  opposition: { word: 'opposite', phrase: 'a balancing act between two pulls', mood: 'tension' },
}
const PHASE_MEANING: Record<MoonPhaseName, string> = {
  'New Moon': 'a time of fresh beginnings', 'Waxing Crescent': 'a time of hopeful first steps', 'First Quarter': 'a time of courage and choosing',
  'Waxing Gibbous': 'a time of practice and polish', 'Full Moon': 'a time of things coming into the light', 'Waning Gibbous': 'a time of sharing what has been learned',
  'Last Quarter': 'a time of letting go and turning a corner', 'Waning Crescent': 'a time of rest and quiet dreaming',
}
const SLOW = new Set<PointId>(['uranus', 'neptune', 'pluto'])
const signName = (s: ZodiacSign) => signInfo(s).name

export interface Reading { title: string; lines: string[] }

/** "Moon in Taurus": what that placement symbolises for this Cozmling. */
export function placementReading(sky: CelestialBirthRecord, name: string, id: PointId): Reading {
  const body = id === 'ascendant' || id === 'midheaven' ? null : sky.bodies[id]
  const p = body ?? (id === 'ascendant' || id === 'midheaven' ? sky.angles?.[id] : undefined)
  if (!p) return { title: POINTS[id].name, lines: ['This can’t be known without the time of birth.'] }
  const sign = signName(p.sign)
  const title = id === 'ascendant' ? `${sign} rising` : `${POINTS[id].name} in ${sign}`
  const lines = [
    `${name}’s ${POINTS[id].name} symbolises ${THEME[id]}. In ${sign}, that may come across as ${TONE[p.sign]}.`,
  ]
  if (body?.house) lines.push(`It sits in the ${ORDINAL[body.house - 1]} house, the part of its sky linked with ${HOUSE[body.house - 1]}.`)
  if (body?.retrograde) lines.push(`${POINTS[id].name} was retrograde when it was born: seen from Earth, it seemed to drift backwards. That is often read as energy turned inward, worked out slowly and in its own way.`)
  else if (body?.stationary) lines.push(`${POINTS[id].name} was standing almost still, about to change direction, which is often read as a placement felt strongly.`)
  if (SLOW.has(id)) lines.push(`${POINTS[id].name} moves so slowly that every Cozmling born within a few years shares this sign${body?.house ? '; its house is what makes it personal' : ''}.`)
  if (id === 'sun' || id === 'moon' || id === 'ascendant') lines.push('As its experiences grow, this may become part of how it understands the world.')
  return { title, lines }
}

const pairName = (id: PointId) => (id === 'ascendant' ? 'the Rising sign' : id === 'midheaven' ? 'the Midheaven' : POINTS[id].name)
export const aspectTitle = (a: Aspect) => `${POINTS[a.a].name} ${ASPECT_WORDS[a.kind].word} ${POINTS[a.b].name}`

export function aspectReading(a: Aspect): Reading {
  const w = ASPECT_WORDS[a.kind]
  const how = a.applying == null ? '' : a.applying ? ' It was still tightening.' : ' It was already loosening.'
  return {
    title: aspectTitle(a),
    lines: [`${pairName(a.a)[0].toUpperCase()}${pairName(a.a).slice(1)} and ${pairName(a.b)} were ${dms(a.separation)} apart, ${dms(a.orb)} from an exact ${a.kind}: ${w.phrase}, between ${SHORT[a.a]} and ${SHORT[a.b]}.${how}`],
  }
}

export function patternReading(p: Pattern): Reading {
  const list = p.points.map(x => POINTS[x].name)
  const and = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`)
  if (p.kind === 'stellium') return { title: `A stellium in ${signName(p.sign!)}`, lines: [`${and(list)} gathered in ${signName(p.sign!)}. A crowd like this is often read as a theme that runs through the whole chart: here, something ${TONE[p.sign!]}.`] }
  if (p.kind === 'grand-trine') return { title: `A grand trine${p.element ? ` in ${ELEMENTS[p.element].name.toLowerCase()}` : ''}`, lines: [`${and(list)} make a triangle of trines, often read as a gift that comes easily.`] }
  if (p.kind === 'T-square') return { title: 'A T-square', lines: [`${list[0]} and ${list[1]} pull against each other while both lean on ${list[2]}: often read as a drive to grow through challenges.`] }
  return { title: 'A grand cross', lines: [`${and(list)} form a cross of squares and oppositions, often read as great strength built through balance.`] }
}

export function moonPhaseReading(sky: CelestialBirthRecord, name: string): Reading {
  const pct = Math.round(sky.moonPhase.illumination * 100)
  return { title: sky.moonPhase.name, lines: [`${name} was ${sky.kind === 'birth' ? 'born' : 'given its sky'} under a ${sky.moonPhase.name.toLowerCase()}, ${pct}% lit: ${PHASE_MEANING[sky.moonPhase.name]}.`] }
}

/** Sun, Moon and Rising, in a few words. */
export function bigThree(sky: CelestialBirthRecord): string {
  const parts = [`Sun in ${signName(sky.bodies.sun.sign)}`, `Moon in ${signName(sky.bodies.moon.sign)}`]
  if (sky.angles) parts.push(`${signName(sky.angles.ascendant.sign)} rising`)
  return parts.join(', ')
}

export const DISCLAIMER = 'Astrology here is a way of telling stories, not a prediction. Its sky offers symbols to play with; who it becomes is decided by the life you share.'
