/* ============================================================
   DailyAstrologySource: where a day's theme comes from.

   A theme has two separate parts:
   - the day's kind (play, comfort, curiosity…), which chooses the story. It comes from the day, the
     Cozmling's growth stage and its story so far, and never from its sign or its chart, so every
     Cozmling at the same stage with the same story history gets the same story on the same day.
   - today's sky reading (the strongest transit to its birth chart, and how it might read), shown
     beside the story as optional symbolism. It never chooses anything.

   The story engine asks for "today's theme" and never cares which source gave it, so a properly
   licensed feed could be added later without changing the engine. Sources, in the order asked:

     editorial    a theme written by COZMC for a given date (a table in this file; empty for now)
     licensed     reserved for an authorised, licensed feed. Not built: nothing is fetched, copied
                  or scraped from anyone (Horoscope.com included) without a licence.
     first-party  the default, and always available: the day's kind from the rotation below, and
                  the sky reading worked out on the device (celestial/transits.ts).

   A source that is switched off, has nothing for the day, or fails, is skipped, so a story is
   always written. Every final word of a story is original COZMC writing (themes.ts).
   ============================================================ */
import type { Stage } from '../../companion/look'
import type { DailyCelestialReport, TransitAspect } from '../celestial/daily'
import type { CelestialBirthRecord } from '../celestial/types'
import { LIBRARY, ENGINE } from '../celestial/version'
import { ASPECT_WORDS } from '../celestial/interpret'
import { DAY_KINDS, type DayKind } from './themes'

export type SourceId = 'editorial' | 'licensed' | 'first-party'
export interface SourceInfo { id: SourceId; name: string; detail: string }

/** A day's theme for one Cozmling. Anything a source leaves out is written by the story engine. */
export interface DailyTheme {
  source: SourceInfo
  /** chooses the story: from the day, its growth stage and its story so far, never its sign or chart */
  kind: DayKind
  /** for the sky reading beside the story only: today's strongest transit, or null on a quiet day */
  transit: TransitAspect | null
  mood: 'flow' | 'tension' | 'blend' | null
  title?: string
  words?: [string, string, string]
}

export interface ThemeInput {
  report: DailyCelestialReport
  natal: CelestialBirthRecord
  /** what the story may draw on: its growth stage, and the kinds of its last stories (most recent last) */
  stage: Stage
  recentKinds: DayKind[]
}

/**
 * The kind of day: a steady rotation by day and growth stage that skips the kinds of its last two
 * stories. The same day, stage and story history always give the same kind, whatever the sign,
 * birthplace or chart. (Before November 2026 the kind came from the strongest transit to the birth
 * chart; that is now only shown as the sky reading.)
 */
export function storyKind(day: string, stage: Stage, recentKinds: DayKind[]): DayKind {
  let h = 2166136261
  for (const ch of `${day}|${stage}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0
  const recent = new Set(recentKinds.slice(-2))
  for (let i = 0; i < DAY_KINDS.length; i++) {
    const k = DAY_KINDS[(h + i) % DAY_KINDS.length]
    if (!recent.has(k)) return k
  }
  return DAY_KINDS[h % DAY_KINDS.length]
}
export interface DailyAstrologySource {
  id: SourceId
  enabled: boolean
  /** The theme for this day, or null if this source has nothing for it. */
  themeFor(input: ThemeInput): DailyTheme | null
}

/** The day's kind from the rotation; the sky reading from today's strongest transit. */
export const firstParty: DailyAstrologySource = {
  id: 'first-party',
  enabled: true,
  themeFor({ report, stage, recentKinds }) {
    const t = report.transits[0] ?? null
    return {
      source: { id: 'first-party', name: 'COZMC story', detail: `Chosen from the day, its growth stage and its story so far. Its sky reading is worked out on this device from today’s real sky (${LIBRARY.name} ${LIBRARY.version}, ${ENGINE.name} ${ENGINE.version}).` },
      kind: storyKind(report.day, stage, recentKinds),
      transit: t,
      mood: t ? ASPECT_WORDS[t.kind].mood : null,
    }
  },
}

/** Themes written by COZMC for particular dates (YYYY-MM-DD): the same for every Cozmling. The sky reading still comes from the sky. */
export const EDITORIAL: Record<string, { kind: DayKind; title?: string; words?: [string, string, string] }> = {}

export const editorial: DailyAstrologySource = {
  id: 'editorial',
  enabled: true,
  themeFor(input) {
    const e = EDITORIAL[input.report.day]
    if (!e) return null
    const base = firstParty.themeFor(input)!
    return { ...base, ...e, source: { id: 'editorial', name: 'COZMC editorial theme', detail: `Written by COZMC for ${input.report.day}, the same for every Cozmling. Its sky reading comes from today’s real sky.` } }
  },
}

/** Reserved: an authorised, licensed daily feed. Off, and empty: nothing is ever fetched without a licence. */
export const licensed: DailyAstrologySource = { id: 'licensed', enabled: false, themeFor: () => null }

export const SOURCES: DailyAstrologySource[] = [editorial, licensed, firstParty]

const KINDS = new Set<DayKind>(DAY_KINDS)
const valid = (t: DailyTheme | null): t is DailyTheme => !!t && KINDS.has(t.kind) && !!t.source

/** Today's theme: from the first source that has one. The first-party reading always answers. */
export function themeFor(input: ThemeInput, sources: DailyAstrologySource[] = SOURCES): DailyTheme {
  for (const s of sources) {
    if (!s.enabled) continue
    try { const t = s.themeFor(input); if (valid(t)) return t } catch { /* a failing source is skipped */ }
  }
  return firstParty.themeFor(input)!
}
