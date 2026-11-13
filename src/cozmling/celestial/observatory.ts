/* ============================================================
   THE ORIGIN OBSERVATORY, and the clocks.

   Every Cozmling is born at the same fictional observatory. It stands on a real spot, the
   summit of Mauna Kea in Hawaii, so the Rising sign and houses can be worked out. Hawaii
   keeps one clock all year (UTC−10, no daylight saving).

   The birth rule (chosen by the site owner): a Cozmling is born on the birthday its player
   chose, at the minute its egg hatches, both read on the observatory's clock.

   Everything is held in UTC. Time zones are only used to read and show wall clocks, and only
   through the browser's own time-zone database (Intl), so daylight saving is handled by it.
   ============================================================ */
import { parseBirthday } from '../domain/starprint'
import type { Birthplace } from './types'

export const ORIGIN_OBSERVATORY: Birthplace = {
  id: 'origin-observatory',
  version: 1,
  name: 'The Origin Observatory',
  place: 'Mauna Kea, Hawaii',
  latitude: 19.8207,
  longitude: -155.4681,
  elevationM: 4205,
  timeZone: 'Pacific/Honolulu',
  fictional: true,
}

export interface WallClock { y: number; m: number; d: number; hh: number; mm: number; ss: number }

const formats = new Map<string, Intl.DateTimeFormat>()
/** The wall clock in a time zone at a moment. */
export function wallClock(ms: number, timeZone: string): WallClock {
  let f = formats.get(timeZone)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    formats.set(timeZone, f)
  }
  const o: Record<string, number> = {}
  for (const p of f.formatToParts(new Date(ms))) if (p.type !== 'literal') o[p.type] = Number(p.value)
  return { y: o.year, m: o.month, d: o.day, hh: o.hour === 24 ? 0 : o.hour, mm: o.minute, ss: o.second }
}

/** How far a time zone's clock is ahead of UTC at a moment, in milliseconds. To the second: before standard time,
    many places kept local mean time, minutes and seconds off the hour (Paris +0:09:21, Kathmandu +5:41:16). */
export function zoneOffsetMs(ms: number, timeZone: string): number {
  const t = Math.floor(ms / 1000) * 1000, c = wallClock(t, timeZone)
  return Date.UTC(c.y, c.m - 1, c.d, c.hh, c.mm, c.ss) - t
}
/** The same, in whole minutes (for showing). */
export const zoneOffsetMinutes = (ms: number, timeZone: string) => Math.round(zoneOffsetMs(ms, timeZone) / 60_000)

const DAY = 86_400_000
/** The moment a wall clock in a time zone shows a given time, by the IANA rules (the same as Python's zoneinfo, fold 0):
    - when the clocks go back and a time happens twice, the first time;
    - when the clocks go forward and a time is skipped, it is read with the offset from before the change, so it
      lands just after the gap (02:30 on a spring-forward night is 03:30). */
export function wallClockToUtc(c: WallClock, timeZone: string): number {
  const asUtc = Date.UTC(c.y, c.m - 1, c.d, c.hh, c.mm, c.ss)
  const shows = (t: number) => { const w = wallClock(t, timeZone); return w.y === c.y && w.m === c.m && w.d === c.d && w.hh === c.hh && w.mm === c.mm && w.ss === c.ss }
  // the offsets in force around this wall time: before and after any change of offset near it (Samoa once skipped a whole day)
  const before = zoneOffsetMs(asUtc - 2 * DAY, timeZone)
  const offsets = new Set([before, zoneOffsetMs(asUtc, timeZone), zoneOffsetMs(asUtc + 2 * DAY, timeZone)])
  const when = [...offsets].map(o => asUtc - o).filter(shows).sort((a, b) => a - b)
  return when.length ? when[0] : asUtc - before
}

const pad = (n: number, w = 2) => String(n).padStart(w, '0')
/** The calendar day (YYYY-MM-DD) a moment falls on in a time zone. */
export const localDay = (ms: number, timeZone: string) => { const c = wallClock(ms, timeZone); return `${pad(c.y, 4)}-${pad(c.m)}-${pad(c.d)}` }
export const wallClockText = (c: WallClock) => `${pad(c.y, 4)}-${pad(c.m)}-${pad(c.d)}T${pad(c.hh)}:${pad(c.mm)}:${pad(c.ss)}`

/** The player's own time zone, or UTC if the browser won't say. */
export function playerTimeZone(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' } catch { return 'UTC' }
}

/**
 * The moment of birth: the chosen birthday, at the time of day (to the second) the egg hatched,
 * both on the observatory's clock. Null if the birthday isn't a real date.
 */
export function birthMoment(birthday: string, hatchedAt: number, place: Birthplace = ORIGIN_OBSERVATORY): number | null {
  const b = parseBirthday(birthday)
  if (!b) return null
  const t = wallClock(hatchedAt, place.timeZone)
  return wallClockToUtc({ y: b.y, m: b.m, d: b.d, hh: t.hh, mm: t.mm, ss: t.ss }, place.timeZone)
}

/** The first and last second of a birthday on the observatory's clock. */
export function birthdayBounds(birthday: string, place: Birthplace = ORIGIN_OBSERVATORY): { start: number; end: number } | null {
  const b = parseBirthday(birthday)
  if (!b) return null
  return { start: wallClockToUtc({ y: b.y, m: b.m, d: b.d, hh: 0, mm: 0, ss: 0 }, place.timeZone), end: wallClockToUtc({ y: b.y, m: b.m, d: b.d, hh: 23, mm: 59, ss: 59 }, place.timeZone) }
}

/** "3:14 pm" on the observatory's clock (or any time zone's). */
export function clockText(ms: number, timeZone: string, withDate = false): string {
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit', ...(withDate ? { year: 'numeric', month: 'long', day: 'numeric' } : {}) }).format(new Date(ms)).replace(' AM', ' am').replace(' PM', ' pm')
  } catch { return new Date(ms).toISOString() }
}
