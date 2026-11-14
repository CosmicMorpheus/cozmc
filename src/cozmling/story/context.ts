/* ============================================================
   THE NARRATIVE CONTEXT: everything a day's story draws on, gathered from the real game state.

   - Its voice: the archetype it speaks in (its Starprint's), with its birth chart, for the sky reading
     beside the story. Neither chooses anything: the story comes from the day, its growth stage and
     its story so far (`seed`, `recentKinds`), the same for every Starprint and chart.
   - Today's sky: the day's report (celestial/daily.ts): the strongest transit, the Moon.
   - Its condition: Food (sustenance), Fun (happiness), Energy, asleep or awake, mood and need,
     by the same care rules as its meters; its home and life stage in the original scene.
   - You and it: how long since you last looked after it, how many days this week, what you have
     done together since yesterday's story, arcade runs.
   - Milestones: its birthday, how close it is to its next stage.
   Read-only: nothing here changes the Cozmling.
   ============================================================ */
import { mood, settle, type HomeId, type Mood, type Need } from '../../companion/care'
import type { Stage } from '../../companion/look'
import type { DailyCelestialReport } from '../celestial/daily'
import { dayBounds, hourOf } from '../celestial/daily'
import { localDay } from '../celestial/observatory'
import type { CelestialBirthRecord, MoonPhaseName } from '../celestial/types'
import { nameOf, petOf } from '../domain/care'
import { originalHome, originalProgress, originalStage } from '../integrations/originalScene'
import type { Companion, Element, JourneyEvent, ZodiacSign } from '../types'
import type { DayKind } from './themes'
import { voiceOf, type Archetype } from './voices'

export interface Counters { fed: number; played: number; pets: number; arcade: number }
export interface NarrativeContext {
  companionId: string
  name: string
  kind: Companion['kind']
  /** the player's calendar day, its time zone, and the hour (0–23) the story is written */
  day: string
  timeZone: string
  hour: number
  home: HomeId
  stage: Stage
  natal: CelestialBirthRecord
  personality: { sun: ZodiacSign; moon: ZodiacSign; rising: ZodiacSign | null; archetype: string | null; element: Element | null }
  /** the archetype it speaks in (its Starprint's; a first-version Cozmling's Sun sign's), or null */
  voice: Archetype | null
  /** the kinds of its last two stories before today, most recent last: part of its story history */
  recentKinds: DayKind[]
  /** what steadies every choice of words: the day, its growth stage and its story history (never its id, sign or chart) */
  seed: string
  condition: { food: number; fun: number; energy: number; asleep: boolean; mood: Mood; need: Need | null }
  counters: Counters
  relationship: {
    hatchedToday: boolean
    daysSinceHatch: number | null
    /** whole days since the last day you looked after it (before today), or null if you never have */
    daysAway: number | null
    /** days in the last week (before today) on which you looked after it */
    careDaysThisWeek: number
    /** what you have done together since the last story was written, or null if this is its first */
    sinceLastStory: Counters | null
  }
  milestones: { birthday: boolean; next: { stage: Stage; pointsToGo: number } | null }
  sky: { report: DailyCelestialReport; moonPhase: MoonPhaseName; moonSign: ZodiacSign }
}

const daysBetween = (a: string, b: string) => {
  const t = (d: string) => { const [y, m, dd] = d.split('-').map(Number); return Date.UTC(y, m - 1, dd) }
  return Math.round((t(b) - t(a)) / 86_400_000)
}
const countersOf = (p: { fed: number; played: number; pets: number; arcade?: number }): Counters => ({ fed: p.fed, played: p.played, pets: p.pets, arcade: p.arcade ?? 0 })

/** Everything today's story draws on. `c` must have a birth sky; `report` is today's for it. */
export function narrativeContext(c: Companion, report: DailyCelestialReport, events: JourneyEvent[], now: number): NarrativeContext {
  const natal = c.celestial
  if (!natal) throw new Error('A daily story needs a birth sky.')
  const tz = report.timeZone, day = report.day, { start } = dayBounds(day, tz)
  const pet = settle(petOf(c), now), m = mood(pet)
  const counters = countersOf(pet)

  const hatchedAt = c.hatch.status === 'hatched' ? c.hatch.hatchedAt : null
  const careDays = [...new Set(events.filter(e => e.type === 'care' && e.at < start).map(e => localDay(e.at, tz)))].sort()
  const lastCareDay = careDays[careDays.length - 1] ?? null
  const earlier = events.filter(e => e.type === 'story' && e.at < start && typeof e.data?.snapshot === 'object').sort((a, b) => a.at - b.at)
  const lastStory = earlier[earlier.length - 1]
  const recentKinds = earlier.slice(-2).map(e => e.data!.kind).filter((k): k is DayKind => typeof k === 'string')
  const before = lastStory ? (lastStory.data!.snapshot as { counters?: Counters }).counters : null
  const progress = originalProgress(c)

  return {
    companionId: c.companionId, name: nameOf(c), kind: c.kind, day, timeZone: tz, hour: Math.floor(hourOf(now, tz)),
    home: originalHome(c), stage: originalStage(c), natal,
    voice: voiceOf(c), recentKinds, seed: `${day}|${originalStage(c)}|${recentKinds.join(',')}`,
    personality: {
      sun: natal.bodies.sun.sign, moon: natal.bodies.moon.sign, rising: natal.angles?.ascendant.sign ?? null,
      archetype: c.kind === 'adventurer' ? c.starprint.archetype : null, element: c.kind === 'adventurer' ? c.starprint.element : null,
    },
    condition: { food: Math.round(pet.food), fun: Math.round(pet.fun), energy: Math.round(pet.energy), asleep: !!pet.asleep, mood: m.mood, need: m.need },
    counters,
    relationship: {
      hatchedToday: hatchedAt != null && localDay(hatchedAt, tz) === day,
      daysSinceHatch: hatchedAt == null ? null : Math.max(0, daysBetween(localDay(hatchedAt, tz), day)),
      daysAway: lastCareDay ? daysBetween(lastCareDay, day) : null,
      careDaysThisWeek: careDays.filter(d => { const n = daysBetween(d, day); return n >= 1 && n <= 7 }).length,
      sinceLastStory: before ? { fed: Math.max(0, counters.fed - before.fed), played: Math.max(0, counters.played - before.played), pets: Math.max(0, counters.pets - before.pets), arcade: Math.max(0, counters.arcade - before.arcade) } : null,
    },
    milestones: {
      birthday: c.kind === 'adventurer' && c.starprint.chosenBirthday.slice(5) === day.slice(5),
      next: progress.next ? { stage: progress.next.stage, pointsToGo: Math.max(0, progress.next.at - progress.points) } : null,
    },
    sky: { report, moonPhase: report.moonPhase.name, moonSign: report.sky.moon.sign },
  }
}
