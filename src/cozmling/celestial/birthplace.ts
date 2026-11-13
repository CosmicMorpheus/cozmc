/* Where a Cozmling is born: the COZMC default (the Origin Observatory on Mauna Kea), a real place its player chose,
   or one picked at random. Light helpers for showing and checking a birthplace; no astronomy here.

   Privacy: a birthplace is only ever a place a player picks for their Cozmling. The site never asks where the
   player is, never reads their location, and keeps the birthplace in this browser only (with the Cozmling). */
import { ORIGIN_OBSERVATORY } from './observatory'
import type { Birthplace } from './types'

export const isDefaultPlace = (p: Birthplace | null | undefined) => !p || p.id === ORIGIN_OBSERVATORY.id
/** The place in a phrase: "the Origin Observatory on Mauna Kea", or "Paris, France". */
export const placePhrase = (p: Birthplace | null | undefined) => (isDefaultPlace(p) ? 'the Origin Observatory on Mauna Kea' : p!.place)
/** Whose clock its birth moment is read on: "Mauna Kea", or "Paris". */
export const clockName = (p: Birthplace | null | undefined) => (isDefaultPlace(p) ? 'Mauna Kea' : p!.name)
/** "48.87° N, 2.33° E" */
export const coordsText = (p: { latitude: number; longitude: number }) => `${Math.abs(p.latitude).toFixed(2)}° ${p.latitude >= 0 ? 'N' : 'S'}, ${Math.abs(p.longitude).toFixed(2)}° ${p.longitude >= 0 ? 'E' : 'W'}`
/** The tag a Starprint keeps of the birthplace (and its version) it was read for. */
export const placeTag = (p: Birthplace) => `${p.id}-${p.version}`

const zones = new Map<string, boolean>()
/** Can this time zone be read here (by this browser's own time zone database)? */
export function zoneSupported(timeZone: string): boolean {
  let ok = zones.get(timeZone)
  if (ok === undefined) { try { new Intl.DateTimeFormat('en-US', { timeZone }); ok = true } catch { ok = false } zones.set(timeZone, ok) }
  return ok
}

/** Is it shaped like a birthplace? (For saved records: no check that this browser knows its time zone, so a save is
    never set aside just because a browser's time zone database is older.) */
export function placeShapeProblem(p: unknown): string | null {
  const b = p as Birthplace | null
  if (!b || typeof b !== 'object') return 'not a place'
  if (typeof b.id !== 'string' || !b.id || typeof b.name !== 'string' || !b.name.trim() || typeof b.place !== 'string') return 'unnamed place'
  if (typeof b.latitude !== 'number' || typeof b.longitude !== 'number' || !Number.isFinite(b.latitude) || !Number.isFinite(b.longitude) || Math.abs(b.latitude) > 90 || Math.abs(b.longitude) > 180) return 'not on the globe'
  if (typeof b.timeZone !== 'string' || !b.timeZone) return 'no time zone'
  if (typeof b.version !== 'number' || typeof b.fictional !== 'boolean') return 'incomplete'
  return null
}
/** Why a birthplace can't be chosen here and now, or null (its shape, and a time zone this browser can read). */
export const birthplaceProblem = (p: unknown): string | null => placeShapeProblem(p) ?? (zoneSupported((p as Birthplace).timeZone) ? null : 'unknown time zone')
