/* ============================================================
   CelestialEphemerisProvider: where the planets really are.

   One small interface, so the rest of the system never depends on a particular library.
   The provider in use is Astronomy Engine (MIT licence, no dependencies of its own, about
   ±1 arcminute), pinned to one version so a chart worked out today can be worked out again
   identically. Swiss Ephemeris was not used: its AGPL licence would bind the whole site.

   Positions are geocentric and apparent (light-time and aberration included), on the true
   ecliptic and equinox of the date: the tropical zodiac.
   ============================================================ */
import { Body, GeoVector, MakeTime, MoonPhase, RotateVector, Rotation_EQD_ECT, Rotation_EQJ_ECT, SiderealTime, SphereFromVector } from 'astronomy-engine'
import type { BodyId } from './types'
import { deg, norm360, wrap180 } from './zodiac'

/** Must match the version installed (a test checks it). Changing it changes the engine's version too. */
export const LIBRARY = { name: 'astronomy-engine', version: '2.1.19' } as const

export interface EclipticPosition { lon: number; lat: number }
export interface CelestialEphemerisProvider {
  readonly library: { name: string; version: string }
  /** Tropical ecliptic longitude and latitude, degrees. */
  position(body: BodyId, ms: number): EclipticPosition
  /** Degrees per day along the zodiac; negative while retrograde. */
  speed(body: BodyId, ms: number): number
  /** Greenwich apparent sidereal time, hours. */
  siderealTime(ms: number): number
  /** The true obliquity of the ecliptic, degrees. */
  obliquity(ms: number): number
  /** The Moon's longitude minus the Sun's, 0–360 (0 = new, 180 = full). */
  moonPhase(ms: number): number
}

const BODY: Record<BodyId, Body> = {
  sun: Body.Sun, moon: Body.Moon, mercury: Body.Mercury, venus: Body.Venus, mars: Body.Mars,
  jupiter: Body.Jupiter, saturn: Body.Saturn, uranus: Body.Uranus, neptune: Body.Neptune, pluto: Body.Pluto,
}
const at = (ms: number) => MakeTime(new Date(ms))
const SPAN = 0.25 * 86_400_000          // speed: the change over half a day, centred on the moment

function position(body: BodyId, ms: number): EclipticPosition {
  const t = at(ms)
  const s = SphereFromVector(RotateVector(Rotation_EQJ_ECT(t), GeoVector(BODY[body], t, true)))
  return { lon: norm360(s.lon), lat: s.lat }
}

export const astronomyEngine: CelestialEphemerisProvider = {
  library: LIBRARY,
  position,
  speed: (body, ms) => wrap180(position(body, ms + SPAN).lon - position(body, ms - SPAN).lon) / 0.5,
  siderealTime: ms => SiderealTime(at(ms)),
  obliquity: ms => { const r = Rotation_EQD_ECT(at(ms)).rot; return deg(Math.acos(Math.max(-1, Math.min(1, r[2][2])))) },
  moonPhase: ms => norm360(MoonPhase(at(ms))),
}
