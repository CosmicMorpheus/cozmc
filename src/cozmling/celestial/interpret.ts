/* ============================================================
   WHAT A SKY MIGHT MEAN: symbolic words, written for COZMC.

   This file only reads a chart; it never changes one. Everything here is phrased as symbol and
   possibility ("symbolises", "may"), never as a fixed trait or a prediction: a Cozmling's sky
   offers themes, and the life it shares with its player decides who it becomes.
   ============================================================ */
import { signInfo, ELEMENTS } from '../domain/starprint'
import type { ZodiacSign } from '../types'
import type { Aspect, AspectKind, BodyId, CelestialBirthRecord, MoonPhaseName, Pattern, PointId } from './types'
import type { DailyCelestialReport, TransitAspect } from './daily'
import { clockText } from './observatory'
import { BODIES, dms, ORDINAL, POINTS } from './zodiac'

const THEME: Record<PointId, string> = {
  sun: 'its core spark: what it is drawn toward, and what makes it shine',
  moon: 'its relationship with comfort, familiarity and feeling safe',
  mercury: 'its curiosity, and the way it makes sense of things and shares them',
  venus: 'what it finds beautiful, and the way it shows affection',
  mars: 'its courage, and the way it rushes in or takes its time',
  jupiter: 'where it grows, and its sense of hope and generosity',
  saturn: 'patience, and the lessons that take time to learn',
  uranus: 'surprise, invention and its need to be itself',
  neptune: 'dreams, imagination and quiet hunches',
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
  libra: 'fair, graceful and drawn to harmony', scorpio: 'thoughtful, deeply curious and loyal', sagittarius: 'adventurous, hopeful and free',
  capricorn: 'determined, practical and quietly ambitious', aquarius: 'inventive, independent and open to friendship', pisces: 'dreamy, gentle and full of imagination',
}
export const HOUSE: string[] = [
  'itself, and first impressions', 'comfort, keepsakes and what it values', 'curiosity, chatter and the places close by', 'home, roots and feeling safe',
  'play, creativity and joy', 'daily routines, care and small tasks', 'close friendships and partners', 'trust, sharing and meeting change together',
  'adventure, faraway places and big ideas', 'goals, purpose and being seen', 'friends, community and shared hopes', 'dreams, rest and quiet time alone',
]
export const ASPECT_WORDS: Record<AspectKind, { word: string; phrase: string; mood: 'blend' | 'flow' | 'tension' }> = {
  conjunction: { word: 'conjunct', phrase: 'a blend in which each theme can color the other', mood: 'blend' },
  sextile: { word: 'sextile', phrase: 'a possible opening for the two themes to work together', mood: 'flow' },
  square: { word: 'square', phrase: 'a tension that can invite a fresh approach', mood: 'tension' },
  trine: { word: 'trine', phrase: 'a harmony that can feel easy to draw on', mood: 'flow' },
  opposition: { word: 'opposite', phrase: 'two different pulls that can invite balance', mood: 'tension' },
}
const PHASE_MEANING: Record<MoonPhaseName, string> = {
  'New Moon': 'a symbol of beginning something small', 'Waxing Crescent': 'a symbol of hopes taking shape', 'First Quarter': 'a symbol of choosing a next step',
  'Waxing Gibbous': 'a symbol of trying and adjusting', 'Full Moon': 'a symbol of noticing a fuller picture', 'Waning Gibbous': 'a symbol of sharing what was learned',
  'Last Quarter': 'a symbol of reviewing and making room', 'Waning Crescent': 'a symbol of resting before starting again',
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
  if (body?.retrograde) lines.push(`At its birth, ${POINTS[id].name} appeared to move backward in the sky as seen from Earth. Astronomers call this retrograde motion. As a symbol, it can suggest looking back or trying again.`)
  else if (body?.stationary) lines.push(`${POINTS[id].name} appeared nearly still in the sky as seen from Earth. It was near a reversal in its apparent motion. As a symbol, it can suggest a moment of pause.`)
  if (SLOW.has(id)) lines.push(`${POINTS[id].name} can spend years in one sign, so many Cozmlings share this placement. ${body?.house ? 'Its house and connections to other points add detail to the birth chart.' : 'Its connections to other points add detail to the chart.'}`)
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
  if (p.kind === 'stellium') return { title: `A stellium in ${signName(p.sign!)}`, lines: [`${and(list)} gathered in ${signName(p.sign!)}. This group can bring one theme into focus. Here, it suggests something ${TONE[p.sign!]}.`] }
  if (p.kind === 'grand-trine') return { title: `A grand trine${p.element ? ` in ${ELEMENTS[p.element].name.toLowerCase()}` : ''}`, lines: [`${and(list)} make a triangle of trines, often read as themes that may work together with ease.`] }
  if (p.kind === 'T-square') return { title: 'A T-square', lines: [`${list[0]} and ${list[1]} face each other across the chart and both form squares with ${list[2]}. This can suggest a tension worth looking at from different sides.`] }
  return { title: 'A grand cross', lines: [`${and(list)} form a cross of squares and oppositions, often read as several pulls that may invite balance.`] }
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

export const DISCLAIMER = 'These sky readings offer symbols for a Cozmling’s voice. Its story unfolds through shared experiences and the choices you make together.'

/* ---------------- today's sky ---------------- */

const THE: Partial<Record<BodyId, string>> = { sun: 'the Sun', moon: 'the Moon' }
const theBody = (b: BodyId) => THE[b] ?? POINTS[b].name
const Cap = (s: string) => s[0].toUpperCase() + s.slice(1)
/** What each of today's planets brings to the day. */
const TODAY: Record<BodyId, string> = {
  moon: 'today’s mood', sun: 'today’s light', mercury: 'today’s ideas and conversations', venus: 'today’s warmth and fondness', mars: 'today’s energy and courage',
  jupiter: 'this season’s growth', saturn: 'this season’s lessons', uranus: 'these years’ surprises', neptune: 'these years’ dreams', pluto: 'these years’ deep changes',
}
const TOWARD: Record<AspectKind, string> = { conjunction: 'meets', sextile: 'forms a sextile with', square: 'forms a square with', trine: 'flows with', opposition: 'stands opposite' }
const TOWARD_PAST: Record<AspectKind, string> = { conjunction: 'met', sextile: 'formed a sextile with', square: 'formed a square with', trine: 'flowed with', opposition: 'stood opposite' }
const thatDay = (s: string) => s.replace('today’s', 'that day’s')
/** One of today's planets as story symbolism, never a cause: “This sky symbol can bring today’s mood to mind”. */
const symbol = (today: string) => `This sky symbol can bring ${today} to mind`
const natalName = (name: string, p: PointId) => `${name}’s ${p === 'ascendant' ? 'Rising sign' : p === 'midheaven' ? 'Midheaven' : POINTS[p].name}`

export const transitTitle = (t: TransitAspect, name: string) => `${Cap(theBody(t.a))} ${ASPECT_WORDS[t.kind].word} ${natalName(name, t.b)}`

/** What one of today's transits might mean for this Cozmling. `on`: the day, when it is an earlier day's (told in the past). */
export function transitReading(t: TransitAspect, name: string, timeZone: string, on?: string): Reading {
  const was = on ? 'was' : 'is'
  const when = t.exactAt != null
    ? `It ${was} exact at ${clockText(t.exactAt, timeZone)}, your time.`
    : `At midday it ${was} ${dms(t.orb)} from exact, ${t.applying ? 'and still drawing closer' : 'and already easing off'}.`
  return {
    title: transitTitle(t, name),
    lines: [
      on ? `On ${on}, ${theBody(t.a)} ${TOWARD_PAST[t.kind]} ${natalName(name, t.b)}. ${symbol(thatDay(TODAY[t.a]))}, alongside ${SHORT[t.b]}: ${ASPECT_WORDS[t.kind].phrase}.`
        : `Today ${theBody(t.a)} ${TOWARD[t.kind]} ${natalName(name, t.b)}. ${symbol(TODAY[t.a])}, alongside ${SHORT[t.b]}: ${ASPECT_WORDS[t.kind].phrase}.`,
      when,
      'A theme to play with, if it feels right. It doesn’t decide anything.',
    ],
  }
}

/** The day in a line: its strongest transit, or a quiet sky. */
export function todayHeadline(r: DailyCelestialReport, name: string): string {
  const t = r.transits[0]
  return t ? `${Cap(theBody(t.a))} ${TOWARD[t.kind]} ${natalName(name, t.b)}` : `A quiet sky for ${name}: nothing close to its own sky today`
}

/**
 * The sky's own news for the day: the Moon, planets turning or changing sign, and who is retrograde.
 * moonNow: where the Moon is right now (it moves about 13° a day), told in the present; without it, the
 * Moon is told as it was at midday. past: an earlier day's report, told in the past.
 */
export function skyNotes(r: DailyCelestialReport, name: string, o: { moonNow?: { sign: ZodiacSign; house: number | null; phase: DailyCelestialReport['moonPhase'] } | null; past?: boolean } = {}): string[] {
  const out: string[] = [], v = (now: string, then: string) => (o.past ? then : now)
  const live = !o.past && o.moonNow ? o.moonNow : null
  const moon = live ?? { sign: r.sky.moon.sign, house: r.sky.moon.house, phase: r.moonPhase }, pct = Math.round(moon.phase.illumination * 100)
  out.push(`${live ? 'The Moon is' : `At midday the Moon ${v('is', 'was')}`} in ${signName(moon.sign)}, ${moon.phase.name.toLowerCase()} and ${pct}% lit${moon.house ? `, passing through ${name}’s ${ORDINAL[moon.house - 1]} house (${HOUSE[moon.house - 1]})` : ''}.`)
  for (const i of r.ingresses) if (i.body !== 'moon') out.push(`${Cap(theBody(i.body))} ${v('moves', 'moved')} from ${signName(i.from)} into ${signName(i.to)} at ${clockText(i.at, r.timeZone)}.`)
  const moonIn = r.ingresses.find(i => i.body === 'moon')
  if (moonIn) out.push(`The Moon ${v('moves', 'moved')} from ${signName(moonIn.from)} into ${signName(moonIn.to)} at ${clockText(moonIn.at, r.timeZone)}.`)
  for (const s of r.stations) out.push(`${Cap(theBody(s.body))} ${v('turns', 'turned')} ${s.turns} at ${clockText(s.at, r.timeZone)}.`)
  const back = BODIES.filter(b => r.sky[b].retrograde && !r.stations.some(s => s.body === b)).map(b => POINTS[b].name)
  if (back.length) out.push(`${back.length === 1 ? `${back[0]} ${v('is', 'was')}` : `${back.slice(0, -1).join(', ')} and ${back[back.length - 1]} ${v('are', 'were')}`} retrograde.`)
  return out
}

/** Where one of today's planets is, and which part of this Cozmling's own sky it is passing through. `on`: an earlier day's (at its midday, told in the past). */
export function todayPlacementReading(b: BodyId, p: { sign: ZodiacSign; degree: number; retrograde: boolean }, house: number | null, name: string, on?: string): Reading {
  const lines = on
    ? [`At midday on ${on}, ${theBody(b)} was in ${signName(p.sign)}, at ${dms(p.degree)}${p.retrograde ? ', seeming to move backwards (retrograde)' : ''}. ${symbol(thatDay(TODAY[b]))}. In ${signName(p.sign)}, that may have come across as ${TONE[p.sign]}.`]
    : [`Today ${theBody(b)} is in ${signName(p.sign)}, at ${dms(p.degree)}${p.retrograde ? ', seeming to move backwards (retrograde)' : ''}. ${symbol(TODAY[b])}. In ${signName(p.sign)}, that may come across as ${TONE[p.sign]}.`]
  if (house) lines.push(`It ${on ? 'was' : 'is'} passing through ${name}’s ${ORDINAL[house - 1]} house, the part of its sky linked with ${HOUSE[house - 1]}.`)
  return { title: `${Cap(theBody(b))} in ${signName(p.sign)} ${on ? `on ${on}` : 'today'}`, lines }
}
