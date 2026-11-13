/* The living sky's report, in a form any page can read without loading the astronomy: its shape,
   how a day is ranked, where a day begins and ends, and whether a saved report is still today's.
   The astronomy that fills it in is in transits.ts. */
import { WEIGHT, type OrbRules } from './aspects'
import { localDay, wallClock, wallClockToUtc } from './observatory'
import type { Aspect, BodyId, CelestialBirthRecord, MoonPhaseName } from './types'
import type { ZodiacSign } from '../types'
import { ENGINE, LIBRARY } from './version'
import { round6 } from './zodiac'

/** Tighter than a birth chart's: a day's sky only counts what is close. */
export const TRANSIT_ORBS: OrbRules = { conjunction: 3, sextile: 2, square: 3, trine: 3, opposition: 3, luminaryBonus: 1, angleOrb: 2 }
/** For a day's story, the fast movers matter most: the Moon's aspects change every few hours, Saturn's over months. */
export const DAILY_WEIGHT: Record<BodyId, number> = { moon: 1, sun: 0.9, mercury: 0.85, venus: 0.85, mars: 0.8, jupiter: 0.6, saturn: 0.55, uranus: 0.4, neptune: 0.4, pluto: 0.4 }

export interface SkyPlacement { lon: number; sign: ZodiacSign; degree: number; speed: number; retrograde: boolean; stationary: boolean }
export interface SkyNow { at: number; bodies: Record<BodyId, SkyPlacement>; moonPhase: { angle: number; name: MoonPhaseName; illumination: number } }

/** A transit: today's planet (a) making an aspect to a point in the birth chart (b). */
export interface TransitAspect extends Aspect {
  a: BodyId
  /** When it is exact, if that happens during the day. */
  exactAt: number | null
}
export interface DailyCelestialReport {
  schema: 1
  companionId: string
  /** The player's calendar day (YYYY-MM-DD) in `timeZone`. */
  day: string
  timeZone: string
  /** Midday that day in that time zone: the moment the report is read for. */
  at: number
  dayStart: number
  dayEnd: number
  /** The birth chart it was compared with. */
  natalMoment: number
  engine: { name: string; version: number; library: string; libraryVersion: string }
  sky: Record<BodyId, SkyPlacement & { house: number | null }>
  moonPhase: SkyNow['moonPhase']
  ingresses: { body: BodyId; from: ZodiacSign; to: ZodiacSign; at: number }[]
  stations: { body: BodyId; turns: 'retrograde' | 'direct'; at: number }[]
  transits: TransitAspect[]
  calculatedAt: number
}

/** The first and last moment of a calendar day in a time zone, and its midday. Daylight saving is the zone's own. */
export function dayBounds(day: string, timeZone: string) {
  const [y, m, d] = day.split('-').map(Number)
  const start = wallClockToUtc({ y, m, d, hh: 0, mm: 0, ss: 0 }, timeZone)
  const next = new Date(Date.UTC(y, m - 1, d + 1)), ny = next.getUTCFullYear(), nm = next.getUTCMonth() + 1, nd = next.getUTCDate()
  const end = wallClockToUtc({ y: ny, m: nm, d: nd, hh: 0, mm: 0, ss: 0 }, timeZone) - 1000
  return { start, end, noon: wallClockToUtc({ y, m, d, hh: 12, mm: 0, ss: 0 }, timeZone) }
}
/** The next local midnight after a moment: when a new day's report is due. */
export function nextMidnight(ms: number, timeZone: string) { return dayBounds(localDay(ms, timeZone), timeZone).end + 1000 }

/** Rank for a day: how close, how fast the planet moves (so the day's own news comes first), how personal the point. */
export const dailyScore = (t: Aspect & { a: BodyId }) => round6((1 - t.orb / t.allowed) * DAILY_WEIGHT[t.a] * WEIGHT[t.b] * (t.applying ? 1.08 : 1))

/** Was a saved report read for this chart, by this engine? (It may be from an earlier day.) */
export function reportIsFor(r: unknown, natal: CelestialBirthRecord): r is DailyCelestialReport {
  const x = r as DailyCelestialReport | null | undefined
  return !!x && typeof x === 'object' && x.schema === 1 && x.companionId === natal.companionId && x.natalMoment === natal.moment.ms
    && x.engine?.version === ENGINE.version && x.engine?.libraryVersion === LIBRARY.version
    && typeof x.day === 'string' && !!x.sky && typeof x.sky === 'object' && Array.isArray(x.transits) && Array.isArray(x.ingresses) && Array.isArray(x.stations)
}
/** Is a saved report still today's? (Same day, time zone, chart and engine.) */
export function reportIsCurrent(r: unknown, natal: CelestialBirthRecord, timeZone: string, now: number): r is DailyCelestialReport {
  return reportIsFor(r, natal) && r.timeZone === timeZone && r.day === localDay(now, timeZone)
}

/** "Friday, November 13" for a report's day. */
export function dayText(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  try { return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(Date.UTC(y, m - 1, d))) } catch { return day }
}

/** For the hour hand of a clock: 0 = midnight. */
export const hourOf = (ms: number, timeZone: string) => { const c = wallClock(ms, timeZone); return c.hh + c.mm / 60 }
