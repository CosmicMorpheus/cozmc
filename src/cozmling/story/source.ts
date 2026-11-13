/* ============================================================
   DailyAstrologySource: where a day's celestial theme comes from.

   The story engine asks for "today's theme for this Cozmling" and never cares which source gave it,
   so a properly licensed horoscope feed could be added later without changing the engine.
   Sources, in the order they are asked:

     editorial    a theme written by COZMC for a given date (a table in this file; empty for now)
     licensed     reserved for an authorised, licensed feed. Not built: nothing is fetched, copied
                  or scraped from anyone (Horoscope.com included) without a licence.
     first-party  the default, and always available: worked out on the device from today's real
                  sky against the Cozmling's own birth chart (celestial/transits.ts).

   A source that is switched off, has nothing for the day, or fails, is skipped, so a story is
   always written. Every final word of a story is original COZMC writing (themes.ts).
   ============================================================ */
import type { DailyCelestialReport, TransitAspect } from '../celestial/daily'
import type { CelestialBirthRecord } from '../celestial/types'
import { LIBRARY, ENGINE } from '../celestial/version'
import { ASPECT_WORDS } from '../celestial/interpret'
import { KIND_BY_POINT, type DayKind } from './themes'

export type SourceId = 'editorial' | 'licensed' | 'first-party'
export interface SourceInfo { id: SourceId; name: string; detail: string }

/** A day's theme for one Cozmling. Anything a source leaves out is written by the story engine. */
export interface DailyTheme {
  source: SourceInfo
  kind: DayKind
  /** the transit the day is built on (the strongest one today), or null on a quiet day */
  transit: TransitAspect | null
  mood: 'flow' | 'tension' | 'blend' | null
  title?: string
  words?: [string, string, string]
}

export interface ThemeInput { report: DailyCelestialReport; natal: CelestialBirthRecord }
export interface DailyAstrologySource {
  id: SourceId
  enabled: boolean
  /** The theme for this day, or null if this source has nothing for it. */
  themeFor(input: ThemeInput): DailyTheme | null
}

/** Today's strongest transit gives the day its kind; on a quiet day, the day is open. */
export const firstParty: DailyAstrologySource = {
  id: 'first-party',
  enabled: true,
  themeFor({ report }) {
    const t = report.transits[0] ?? null
    return {
      source: { id: 'first-party', name: 'COZMC sky reading', detail: `Worked out on this device from today’s real sky (${LIBRARY.name} ${LIBRARY.version}, ${ENGINE.name} ${ENGINE.version}).` },
      kind: t ? KIND_BY_POINT[t.b] : 'quiet',
      transit: t,
      mood: t ? ASPECT_WORDS[t.kind].mood : null,
    }
  },
}

/** Themes written by COZMC for particular dates (YYYY-MM-DD). The day's transit still comes from the sky. */
export const EDITORIAL: Record<string, { kind: DayKind; title?: string; words?: [string, string, string] }> = {}

export const editorial: DailyAstrologySource = {
  id: 'editorial',
  enabled: true,
  themeFor(input) {
    const e = EDITORIAL[input.report.day]
    if (!e) return null
    const base = firstParty.themeFor(input)!
    return { ...base, ...e, source: { id: 'editorial', name: 'COZMC editorial theme', detail: `Written by COZMC for ${input.report.day}, with the transit from today’s real sky.` } }
  },
}

/** Reserved: an authorised, licensed daily feed. Off, and empty: nothing is ever fetched without a licence. */
export const licensed: DailyAstrologySource = { id: 'licensed', enabled: false, themeFor: () => null }

export const SOURCES: DailyAstrologySource[] = [editorial, licensed, firstParty]

const KINDS = new Set<DayKind>(['play', 'comfort', 'curiosity', 'connection', 'courage', 'growth', 'reflection', 'creativity', 'dreams', 'change', 'quiet'])
const valid = (t: DailyTheme | null): t is DailyTheme => !!t && KINDS.has(t.kind) && !!t.source

/** Today's theme: from the first source that has one. The first-party reading always answers. */
export function themeFor(input: ThemeInput, sources: DailyAstrologySource[] = SOURCES): DailyTheme {
  for (const s of sources) {
    if (!s.enabled) continue
    try { const t = s.themeFor(input); if (valid(t)) return t } catch { /* a failing source is skipped */ }
  }
  return firstParty.themeFor(input)!
}
