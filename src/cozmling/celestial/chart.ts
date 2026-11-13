/* ============================================================
   CASTING A BIRTH CHART.

   castChart() turns one moment and one place into a CelestialBirthRecord: where the Sun, Moon
   and planets were, which way each was moving, the Rising sign and Midheaven, the houses, the
   aspects between them, any larger patterns, and the Moon's phase. The same inputs always give
   the same chart. Nothing in it is random, and nothing that can't be known is filled in.

   hatchWithSky() is what happens when an egg hatches: the chart is cast for the chosen birthday
   at the hatch minute, and saved in the same write as the hatch itself.
   ============================================================ */
import { hatch } from '../domain/care'
import { signInfo } from '../domain/starprint'
import type { Companion, Starprint, ZodiacSign } from '../types'
import { findAspects, findPatterns, NATAL_ORBS, type AspectPoint } from './aspects'
import { astronomyEngine, type CelestialEphemerisProvider } from './ephemeris'
import { birthdayBounds, birthMoment, ORIGIN_OBSERVATORY, wallClock, wallClockText } from './observatory'
import type { AnglePoint, BodyId, Birthplace, CelestialBirthRecord, MoonPhaseName, Placement } from './types'
import { BODIES, deg, degreeIn, norm360, rad, round6, signAt, ZODIAC } from './zodiac'
import { legacySkyOption } from './options'
import { placeShapeProblem, placeTag, zoneSupported } from './birthplace'
import { ENGINE } from './version'

export { legacySkyOption, starprintDisagrees } from './options'
export { ENGINE }
export const ENGINE_TAG = `${ENGINE.name}-${ENGINE.version}`
export const OBSERVATORY_TAG = `${ORIGIN_OBSERVATORY.id}-${ORIGIN_OBSERVATORY.version}`

/* Below these speeds (degrees a day) a planet counts as stationary: about to turn, or just turned. */
const STATION: Record<BodyId, number> = { sun: 0, moon: 0, mercury: 0.1, venus: 0.07, mars: 0.04, jupiter: 0.01, saturn: 0.005, uranus: 0.002, neptune: 0.001, pluto: 0.001 }

/** The Rising sign (Ascendant) and Midheaven from the local sidereal angle (RAMC), the obliquity and the latitude.
    The Ascendant is where the ecliptic meets the horizon in the east. Inside the polar circles the usual formula can
    give the other meeting point, setting in the west, so the one rising in the east is always taken (engine version 2;
    this matches the Swiss Ephemeris, and changes nothing outside the polar circles). */
export function anglesFrom(ramcDeg: number, obliquityDeg: number, latitudeDeg: number): { ascendant: number; midheaven: number } {
  const r = rad(ramcDeg), e = rad(obliquityDeg), f = rad(latitudeDeg)
  let ascendant = norm360(deg(Math.atan2(Math.cos(r), -(Math.sin(r) * Math.cos(e) + Math.tan(f) * Math.sin(e)))))
  const l = rad(ascendant), ra = Math.atan2(Math.sin(l) * Math.cos(e), Math.cos(l))
  if (Math.sin(r - ra) > 0) ascendant = norm360(ascendant + 180)          // west of the meridian: that is the Descendant
  return { ascendant, midheaven: norm360(deg(Math.atan2(Math.sin(r), Math.cos(r) * Math.cos(e)))) }
}

const PHASES: MoonPhaseName[] = ['New Moon', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous', 'Full Moon', 'Waning Gibbous', 'Last Quarter', 'Waning Crescent']
/** The eight traditional phases, each 45° wide and centred on its exact moment. */
export const moonPhaseName = (angle: number): MoonPhaseName => PHASES[Math.floor(norm360(angle + 22.5) / 45) % 8]

const point = (lon: number): AnglePoint => ({ lon: round6(norm360(lon)), sign: signAt(lon), degree: round6(degreeIn(lon)) })

const momentAccuracy = (rule: CelestialBirthRecord['rule'], place: Birthplace): string =>
  rule === 'chosen-day-hatch-minute' ? `To the second: the birthday its player chose, at the time of day its egg hatched, on ${place.fictional ? 'the observatory’s' : `${place.name}’s`} clock.`
  : rule === 'hatch-moment' ? 'To the second: the moment its egg hatched, as this browser recorded it.'
  : 'To the second: the moment its sky was given.'

export interface CastInput {
  companionId: string
  kind: CelestialBirthRecord['kind']
  rule: CelestialBirthRecord['rule']
  /** The moment to read the sky for (cut to whole seconds). */
  ms: number
  birthday: string | null
  hatchedAt: number | null
  displayTimeZone: string
  calculatedAt: number
  /** false when only the day is known: then there is no Rising sign, Midheaven or houses. */
  timeKnown?: boolean
  omitted?: { field: string; why: string }[]
  place?: Birthplace
  provider?: CelestialEphemerisProvider
}

export function castChart(i: CastInput): CelestialBirthRecord {
  const p = i.provider ?? astronomyEngine, place = i.place ?? ORIGIN_OBSERVATORY
  const ms = Math.floor(i.ms / 1000) * 1000
  const bodies = {} as Record<BodyId, Placement>
  for (const b of BODIES) {
    const pos = p.position(b, ms), speed = p.speed(b, ms)
    bodies[b] = { lon: round6(pos.lon), lat: round6(pos.lat), sign: signAt(pos.lon), degree: round6(degreeIn(pos.lon)), speed: round6(speed), retrograde: speed < 0, stationary: Math.abs(speed) < STATION[b], house: null }
  }

  const omitted = [...(i.omitted ?? [])]
  let angles: CelestialBirthRecord['angles'] = null, houses: ZodiacSign[] | null = null
  if (i.timeKnown !== false) {
    const ramc = norm360(p.siderealTime(ms) * 15 + place.longitude)
    const a = anglesFrom(ramc, p.obliquity(ms), place.latitude)
    angles = { ascendant: point(a.ascendant), midheaven: point(a.midheaven) }
    const first = ZODIAC.indexOf(angles.ascendant.sign)
    houses = ZODIAC.map((_, k) => ZODIAC[(first + k) % 12])
    for (const b of BODIES) bodies[b].house = ((ZODIAC.indexOf(bodies[b].sign) - first + 12) % 12) + 1
  } else {
    omitted.push({ field: 'Rising sign, Midheaven and houses', why: 'They change every few minutes, and the time of birth isn’t known.' })
  }

  const points: AspectPoint[] = BODIES.map(b => ({ id: b, lon: bodies[b].lon, speed: bodies[b].speed }))
  if (angles) points.push({ id: 'ascendant', lon: angles.ascendant.lon, speed: null }, { id: 'midheaven', lon: angles.midheaven.lon, speed: null })
  const aspects = findAspects(points, NATAL_ORBS)
  const phase = p.moonPhase(ms)

  return {
    schema: 1,
    companionId: i.companionId,
    kind: i.kind,
    rule: i.rule,
    moment: { utc: new Date(ms).toISOString(), ms, birthday: i.birthday, hatchedAt: i.hatchedAt, observatoryLocal: wallClockText(wallClock(ms, place.timeZone)), displayTimeZone: i.displayTimeZone },
    birthplace: { ...place },
    engine: { name: ENGINE.name, version: ENGINE.version, library: p.library.name, libraryVersion: p.library.version },
    zodiac: 'tropical',
    houseSystem: 'whole-sign',
    bodies,
    angles,
    houses,
    moonPhase: { angle: round6(phase), name: moonPhaseName(phase), illumination: round6((1 - Math.cos(rad(phase))) / 2) },
    aspects,
    patterns: findPatterns(bodies, aspects),
    calculatedAt: i.calculatedAt,
    accuracy: { positions: `Within about 1 arcminute (${p.library.name} ${p.library.version}).`, moment: momentAccuracy(i.rule, place) },
    omitted,
  }
}

/* ---------------- the Sun's sign on a chosen birthday ---------------- */

export interface BirthdaySign {
  /** Its sign if it hatched at `at` (on the observatory's clock). */
  sign: ZodiacSign
  /** Set when the Sun changes sign during that day: which sign it is then depends on the hatch minute. */
  cusp: { before: ZodiacSign; after: ZodiacSign; at: number } | null
}

/** The Sun's sign for a chosen birthday, if the egg hatched at `at`. Null if it isn't a real date. */
export function sunSignOnBirthday(birthday: string, at: number, provider: CelestialEphemerisProvider = astronomyEngine, place: Birthplace = ORIGIN_OBSERVATORY): BirthdaySign | null {
  const bounds = birthdayBounds(birthday, place), ms = birthMoment(birthday, at, place)
  if (!bounds || ms == null) return null
  const sunSign = (t: number) => signAt(provider.position('sun', t).lon)
  const first = sunSign(bounds.start), last = sunSign(bounds.end), sign = sunSign(ms)
  if (first === last) return { sign, cusp: null }
  let lo = bounds.start, hi = bounds.end            // the Sun moves about 1° a day, so it can change sign at most once in a day
  while (hi - lo > 1000) { const mid = Math.floor((lo + hi) / 2); if (sunSign(mid) === first) lo = mid; else hi = mid }
  return { sign, cusp: { before: first, after: last, at: hi } }
}

/** The Starprint shown while it is still an egg: its sign if it hatched now, on its birthplace's clock. Fixed for good at hatch. */
export function provisionalStarprint(birthday: string, now: number, place: Birthplace = ORIGIN_OBSERVATORY): Starprint | null {
  const s = sunSignOnBirthday(birthday, now, astronomyEngine, place)
  if (!s) return null
  const info = signInfo(s.sign)
  return { chosenBirthday: birthday, coreSign: s.sign, element: info.element, archetype: info.archetype, status: 'partial', engineVersion: ENGINE_TAG, observatoryVersion: placeTag(place), birthplace: place }
}
/** Where an adventurer's birth sky is read: the place chosen at adoption, or the COZMC default if none was recorded. */
export const birthplaceOf = (s: Starprint): Birthplace => (s.birthplace && !placeShapeProblem(s.birthplace) ? s.birthplace : ORIGIN_OBSERVATORY)

/* ---------------- reading a Cozmling's sky ---------------- */

/** Its Starprint made final from the sky it was born under. */
function finalStarprint(s: Starprint, sky: CelestialBirthRecord): Starprint {
  const info = signInfo(sky.bodies.sun.sign)
  return { ...s, coreSign: info.sign, element: info.element, archetype: info.archetype, status: 'calculated', engineVersion: ENGINE_TAG, observatoryVersion: placeTag(sky.birthplace), moon: sky.bodies.moon.sign, ...(sky.angles ? { rising: sky.angles.ascendant.sign } : {}) }
}

/**
 * The egg hatches, and its sky is read in the same moment. For an adventurer, the chart is the
 * chosen birthday at this minute on its birthplace's clock (the COZMC default unless another place
 * was chosen at adoption), and its Starprint becomes final (on a cusp birthday, the hatch minute
 * decides between the two signs). A first-version Cozmling just hatches, as it always has: its sky
 * is only read if its player asks.
 */
export function hatchWithSky(c: Companion, now: number, displayTimeZone: string): Companion | null {
  const hatched = hatch(c, now)
  if (!hatched || hatched.kind !== 'adventurer' || hatched.celestial) return hatched
  const place = birthplaceOf(hatched.starprint)
  // a birthplace whose time zone this browser can't read: it hatches, and its sky is read later where it can be (never at another place)
  if (!zoneSupported(place.timeZone)) return hatched
  const ms = birthMoment(hatched.starprint.chosenBirthday, now, place)
  if (ms == null) return hatched
  const sky = castChart({ companionId: hatched.companionId, kind: 'birth', rule: 'chosen-day-hatch-minute', ms, birthday: hatched.starprint.chosenBirthday, hatchedAt: now, displayTimeZone, calculatedAt: now, place })
  return { ...hatched, celestial: sky, starprint: finalStarprint(hatched.starprint, sky) }
}

/**
 * An adventurer that hatched before its sky could be read (on this preview before skies existed,
 * or while the astronomy couldn't load). Both inputs are on record, so its real birth chart is
 * read now: nothing is guessed. Its Starprint is only made final if the sign agrees.
 */
export function readSkyLate(c: Companion, now: number, displayTimeZone: string): Companion | null {
  if (c.kind !== 'adventurer' || c.celestial || c.hatch.status !== 'hatched' || c.hatch.hatchedAt == null) return null
  const place = birthplaceOf(c.starprint)
  if (!zoneSupported(place.timeZone)) return null
  const ms = birthMoment(c.starprint.chosenBirthday, c.hatch.hatchedAt, place)
  if (ms == null) return null
  const sky = castChart({ companionId: c.companionId, kind: 'birth', rule: 'chosen-day-hatch-minute', ms, birthday: c.starprint.chosenBirthday, hatchedAt: c.hatch.hatchedAt, displayTimeZone, calculatedAt: now, place })
  return { ...c, celestial: sky, starprint: sky.bodies.sun.sign === c.starprint.coreSign ? finalStarprint(c.starprint, sky) : c.starprint }
}

/**
 * A first-version Cozmling's sky, at its player's request.
 * 'birth': it hatched at a recorded moment, so that is its birth sky.
 * 'awakening': its hatch moment was never recorded (it came back from a wallet note), so it is
 * given the sky of right now, clearly called an awakening and never presented as its birth.
 */
export function readLegacySky(c: Companion, now: number, displayTimeZone: string, choice: 'birth' | 'awakening'): Companion | null {
  if (c.kind !== 'legacy' || c.celestial) return null
  const option = legacySkyOption(c)
  if (option !== choice) return null
  if (choice === 'birth') {
    const sky = castChart({ companionId: c.companionId, kind: 'birth', rule: 'hatch-moment', ms: c.hatch.hatchedAt!, birthday: null, hatchedAt: c.hatch.hatchedAt, displayTimeZone, calculatedAt: now })
    return { ...c, celestial: sky }
  }
  const sky = castChart({
    companionId: c.companionId, kind: 'awakening', rule: 'awakening-moment', ms: now, birthday: null, hatchedAt: null, displayTimeZone, calculatedAt: now,
    omitted: [{ field: 'Birth sky', why: `The moment ${c.legacy.pet.name} hatched was never recorded (it was brought back from a wallet note), so its birth sky can’t be known. This is the sky at its awakening instead.` }],
  })
  return { ...c, celestial: sky }
}
