/* ============================================================
   THE LIVING SKY: where the planets are now, and how that meets a Cozmling's birth sky.

   skyAt()     where everything is at a moment (the same astronomy and zodiac as a birth chart).
   readDaily() a Cozmling's report for one calendar day in its player's time zone: today's
               positions (and which of its own houses each is passing through), the Moon, any
               planet changing sign or direction that day, and the angles today's planets make to
               its birth chart ("transits"), ranked for a day's story.

   The report is read for midday in the player's time zone, so it is one fixed thing for the
   whole day, and the same chart, day and time zone always give the same report. Nothing here
   is random. A new day begins at the player's own midnight.
   ============================================================ */
import { aspectBetween, type AspectPoint } from './aspects'
import { moonPhaseName } from './chart'
import { dailyScore, dayBounds, TRANSIT_ORBS, type DailyCelestialReport, type SkyNow, type SkyPlacement, type TransitAspect } from './daily'
import { astronomyEngine, type CelestialEphemerisProvider } from './ephemeris'
import { localDay } from './observatory'
import type { BodyId, CelestialBirthRecord, PointId } from './types'
import { ENGINE } from './version'
import { BODIES, degreeIn, rad, round6, signAt, ZODIAC } from './zodiac'

export type { DailyCelestialReport, SkyNow, TransitAspect } from './daily'

const STATION: Record<BodyId, number> = { sun: 0, moon: 0, mercury: 0.1, venus: 0.07, mars: 0.04, jupiter: 0.01, saturn: 0.005, uranus: 0.002, neptune: 0.001, pluto: 0.001 }

/** Where everything is at a moment. */
export function skyAt(ms: number, provider: CelestialEphemerisProvider = astronomyEngine): SkyNow {
  const bodies = {} as Record<BodyId, SkyPlacement>
  for (const b of BODIES) {
    const p = provider.position(b, ms), speed = provider.speed(b, ms)
    bodies[b] = { lon: round6(p.lon), sign: signAt(p.lon), degree: round6(degreeIn(p.lon)), speed: round6(speed), retrograde: speed < 0, stationary: Math.abs(speed) < STATION[b] }
  }
  const angle = provider.moonPhase(ms)
  return { at: ms, bodies, moonPhase: { angle: round6(angle), name: moonPhaseName(angle), illumination: round6((1 - Math.cos(rad(angle))) / 2) } }
}

const natalPoints = (natal: CelestialBirthRecord): AspectPoint[] => [
  ...BODIES.map(b => ({ id: b as PointId, lon: natal.bodies[b].lon, speed: 0 })),
  ...(natal.angles ? [{ id: 'ascendant' as PointId, lon: natal.angles.ascendant.lon, speed: 0 }, { id: 'midheaven' as PointId, lon: natal.angles.midheaven.lon, speed: 0 }] : []),
]

/** When, during [from, to], a transit is exact (its orb falls to almost nothing), or null. */
function exactDuring(provider: CelestialEphemerisProvider, body: BodyId, natalLon: number, angle: number, from: number, to: number): number | null {
  const orbAt = (ms: number) => { const d = ((provider.position(body, ms).lon - natalLon) % 360 + 360) % 360, sep = d > 180 ? 360 - d : d; return Math.abs(sep - angle) }
  const N = 12, step = (to - from) / N
  let best = from, bestOrb = Infinity
  for (let i = 0; i <= N; i++) { const t = from + i * step, o = orbAt(t); if (o < bestOrb) { bestOrb = o; best = t } }
  let lo = Math.max(from, best - step), hi = Math.min(to, best + step)
  for (let i = 0; i < 40; i++) {                          // golden-section search for the closest moment
    const m1 = hi - (hi - lo) / 1.618, m2 = lo + (hi - lo) / 1.618
    if (orbAt(m1) < orbAt(m2)) hi = m2; else lo = m1
  }
  const at = Math.round((lo + hi) / 2 / 1000) * 1000
  return orbAt(at) < 0.02 && at >= from && at <= to ? at : null
}

/** A Cozmling's sky for one calendar day in its player's time zone. */
export function readDaily(natal: CelestialBirthRecord, o: { timeZone: string; now: number; day?: string; provider?: CelestialEphemerisProvider }): DailyCelestialReport {
  const p = o.provider ?? astronomyEngine, day = o.day ?? localDay(o.now, o.timeZone)
  const { start, end, noon } = dayBounds(day, o.timeZone)
  const now = skyAt(noon, p), first = natal.houses ? ZODIAC.indexOf(natal.houses[0]) : -1
  const sky = {} as DailyCelestialReport['sky']
  for (const b of BODIES) sky[b] = { ...now.bodies[b], house: first < 0 ? null : ((ZODIAC.indexOf(now.bodies[b].sign) - first + 12) % 12) + 1 }

  // planets changing sign, or turning, during the day
  const ingresses: DailyCelestialReport['ingresses'] = [], stations: DailyCelestialReport['stations'] = []
  for (const b of BODIES) {
    const s0 = signAt(p.position(b, start).lon), s1 = signAt(p.position(b, end).lon)
    if (s0 !== s1) {
      let lo = start, hi = end
      while (hi - lo > 1000) { const mid = Math.floor((lo + hi) / 2); if (signAt(p.position(b, mid).lon) === s0) lo = mid; else hi = mid }
      ingresses.push({ body: b, from: s0, to: s1, at: hi })
    }
    if (b === 'sun' || b === 'moon') continue
    const v0 = p.speed(b, start), v1 = p.speed(b, end)
    if (Math.sign(v0) !== Math.sign(v1)) {
      let lo = start, hi = end
      while (hi - lo > 60_000) { const mid = Math.floor((lo + hi) / 2); if (Math.sign(p.speed(b, mid)) === Math.sign(v0)) lo = mid; else hi = mid }
      stations.push({ body: b, turns: v1 < 0 ? 'retrograde' : 'direct', at: hi })
    }
  }

  // today's planets to the birth chart
  const transits: TransitAspect[] = []
  for (const b of BODIES) for (const n of natalPoints(natal)) {
    const a = aspectBetween({ id: b, lon: sky[b].lon, speed: sky[b].speed }, n, TRANSIT_ORBS)
    if (a) transits.push({ ...a, a: b, score: 0, exactAt: null })
  }
  for (const t of transits) t.score = dailyScore(t)
  transits.sort((x, y) => y.score - x.score || x.orb - y.orb)
  for (const t of transits.slice(0, 8)) {
    const n = natalPoints(natal).find(x => x.id === t.b)!
    t.exactAt = exactDuring(p, t.a, n.lon, t.angle, start, end)
  }

  return {
    schema: 1, companionId: natal.companionId, day, timeZone: o.timeZone, at: noon, dayStart: start, dayEnd: end, natalMoment: natal.moment.ms,
    engine: { name: ENGINE.name, version: ENGINE.version, library: p.library.name, libraryVersion: p.library.version },
    sky, moonPhase: now.moonPhase, ingresses, stations, transits, calculatedAt: o.now,
  }
}
